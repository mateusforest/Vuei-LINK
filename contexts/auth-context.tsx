"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import type { Session, User } from "@supabase/supabase-js"
import type { Profile, UserRole } from "@/types"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { shouldUseSupabase } from "@/lib/data-source"
import { ensureProfile } from "@/lib/auth/ensure-profile"
import { withTimeout } from "@/lib/async/with-timeout"

interface SignInPayload {
  email: string
  password: string
}

interface SignUpPayload {
  email: string
  password: string
  name?: string
  phone?: string
  role?: UserRole
  metadata?: Record<string, unknown>
}

interface AuthContextType {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: (payload: SignInPayload) => Promise<{ error: string | null; user: User | null; profile: Profile | null; session: Session | null }>
  signUp: (payload: SignUpPayload) => Promise<{ error: string | null; user: User | null; profile: Profile | null; session: Session | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)
const BOOTSTRAP_TIMEOUT_MS = 10_000

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabaseEnabled = shouldUseSupabase()
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(supabaseEnabled)
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])
  const bootstrapRunRef = useRef(0)
  const profileRef = useRef<Profile | null>(null)
  const sessionSignatureRef = useRef<string | null>(null)

  const loadProfile = useCallback(
    async (nextUser: User | null) => {
      if (!nextUser || !supabase) {
        setProfile(null)
        profileRef.current = null
        console.log("[BOOT] profile loaded", null)
        return null
      }

      try {
        const ensuredProfile = await withTimeout(
          ensureProfile(nextUser, supabase),
          BOOTSTRAP_TIMEOUT_MS,
          "Profile bootstrap timeout.",
        )

        setProfile(ensuredProfile)
        profileRef.current = ensuredProfile
        console.log("[BOOT] profile loaded", ensuredProfile?.id ?? null)
        console.log("[AUTH] profile loaded", ensuredProfile)
        return ensuredProfile
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha ao carregar profile."
        console.error("[AUTH ERROR]", message)
        console.log("[BOOT] profile loaded", profileRef.current?.id ?? null)
        return profileRef.current
      }
    },
    [supabase],
  )

  const syncAuthState = useCallback(
    async (nextSession: Session | null) => {
      const nextUser = nextSession?.user ?? null
      const nextSignature = nextSession?.access_token ?? nextUser?.id ?? "guest"
      const isSameSession = sessionSignatureRef.current === nextSignature

      setSession(nextSession)
      setUser(nextUser)

      console.log("[BOOT] session loaded", nextUser?.id ?? null)
      console.log("[AUTH] session user", nextUser?.id ?? null)
      console.log("[AUTH] metadata", nextUser?.user_metadata ?? null)

      if (!nextUser) {
        sessionSignatureRef.current = nextSignature
        setProfile(null)
        profileRef.current = null
        console.log("[BOOT] profile loaded", null)
        return null
      }

      if (isSameSession && profileRef.current?.id === nextUser.id) {
        console.log("[BOOT] profile loaded", profileRef.current.id)
        console.log("[AUTH] profile loaded", profileRef.current)
        return profileRef.current
      }

      sessionSignatureRef.current = nextSignature
      return loadProfile(nextUser)
    },
    [loadProfile],
  )

  const refreshProfile = useCallback(async () => {
    if (!supabaseEnabled || !supabase) {
      setProfile(null)
      profileRef.current = null
      return
    }

    await loadProfile(user)
  }, [loadProfile, supabase, supabaseEnabled, user])

  useEffect(() => {
    let mounted = true
    const currentRun = bootstrapRunRef.current + 1
    bootstrapRunRef.current = currentRun

    if (!supabaseEnabled || !supabase) {
      setLoading(false)
      return
    }

    const bootstrap = async () => {
      console.log("[BOOT] started")
      setLoading(true)

      try {
        const sessionResult = await withTimeout(
          supabase.auth.getSession(),
          BOOTSTRAP_TIMEOUT_MS,
          "Auth session bootstrap timeout.",
        )

        if (!mounted || bootstrapRunRef.current !== currentRun) return

        await syncAuthState(sessionResult.data.session ?? null)
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha ao inicializar sessao."
        console.error("[AUTH ERROR]", message)

        if (mounted && bootstrapRunRef.current === currentRun) {
          setSession(null)
          setUser(null)
          setProfile(null)
        }
      } finally {
        if (mounted && bootstrapRunRef.current === currentRun) {
          setLoading(false)
          console.log("[BOOT] finished")
        }
      }
    }

    void bootstrap()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!mounted) return

      await syncAuthState(nextSession ?? null)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase, supabaseEnabled, syncAuthState])

  const signIn = async ({ email, password }: SignInPayload) => {
    if (!supabaseEnabled || !supabase) {
      return { error: "Supabase nao esta configurado neste ambiente.", user: null, profile: null, session: null }
    }

    try {
      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        BOOTSTRAP_TIMEOUT_MS,
        "Auth login timeout.",
      )

      if (error) {
        console.error("[AUTH ERROR]", error.message)
        return { error: error.message, user: null, profile: null, session: null }
      }

      const ensuredProfile = await syncAuthState(data.session ?? null)
      return { error: null, user: data.user ?? null, profile: ensuredProfile, session: data.session ?? null }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro inesperado no login."
      console.error("[AUTH ERROR]", message)
      return { error: message, user: null, profile: null, session: null }
    }
  }

  const signUp = async ({ email, password, name, phone, role, metadata }: SignUpPayload) => {
    const supabaseEnvOk = supabaseEnabled && Boolean(supabase)
    console.log("Supabase env ok", supabaseEnvOk)

    if (!supabaseEnvOk || !supabase) {
      console.error("signUp error", "Supabase nao esta configurado neste ambiente.")
      return { error: "Supabase nao esta configurado neste ambiente.", user: null, profile: null, session: null }
    }

    console.log("signUp started")

    try {
      const { data, error } = await withTimeout(
        supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name,
              phone,
              role,
              ...metadata,
            },
          },
        }),
        BOOTSTRAP_TIMEOUT_MS,
        "Auth signup timeout.",
      )

      if (error) {
        console.error("signUp error", error.message)
        console.error("[AUTH ERROR]", error.message)
        return { error: error.message, user: null, profile: null, session: null }
      }

      const ensuredProfile = await syncAuthState(data.session ?? null)
      console.log("signUp success")

      return {
        error: null,
        user: data.user ?? null,
        profile: ensuredProfile,
        session: data.session ?? null,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro inesperado no cadastro."
      console.error("signUp error", message)
      console.error("[AUTH ERROR]", message)
      return { error: message, user: null, profile: null, session: null }
    }
  }

  const signOut = async () => {
    if (supabaseEnabled && supabase) {
      try {
        await withTimeout(supabase.auth.signOut(), BOOTSTRAP_TIMEOUT_MS, "Auth signout timeout.")
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha ao encerrar sessao."
        console.error("[AUTH ERROR]", message)
      }
    }

    setUser(null)
    setSession(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
