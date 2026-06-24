"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import type { Session, User } from "@supabase/supabase-js"
import type { Profile, UserRole } from "@/types"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { shouldUseSupabase } from "@/lib/data-source"
import { ensureProfile } from "@/lib/auth/ensure-profile"
import { withTimeout } from "@/lib/async/with-timeout"
import { devLog, startPerfMeasure } from "@/lib/dev/perf"
import { buildAbsoluteAppUrl } from "@/lib/app-url"

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
  initialized: boolean
  signIn: (payload: SignInPayload) => Promise<{ error: string | null; user: User | null; profile: Profile | null; session: Session | null }>
  signUp: (payload: SignUpPayload) => Promise<{ error: string | null; user: User | null; profile: Profile | null; session: Session | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>
  updatePassword: (password: string) => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)
const BOOTSTRAP_TIMEOUT_MS = 20_000
const DEFAULT_PROFILE_SETTINGS = {
  language: "pt-BR",
  darkMode: true,
  notificationsEnabled: true,
  biometricEnabled: false,
  pinEnabled: false,
  quickAccess: {
    enabled: false,
    pinHash: null,
    pinSalt: null,
    pinIterations: null,
  },
} as const

function reportAuthBootstrapIssue(message: string) {
  if (message.toLowerCase().includes("timeout")) {
    console.warn("[AUTH WARN]", message)
    return
  }

  console.error("[AUTH ERROR]", message)
}

function resolveOptimisticRole(user: User): UserRole {
  const role = user.user_metadata?.role
  return role === "agency_owner" || role === "agency_member" || role === "master" ? role : "traveler"
}

function buildOptimisticProfile(user: User, currentProfile: Profile | null): Profile {
  const now = new Date().toISOString()
  const fallbackName =
    (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name) ||
    (typeof user.user_metadata?.name === "string" && user.user_metadata.name) ||
    currentProfile?.name ||
    user.email?.split("@")[0] ||
    "Viajante"

  return {
    id: user.id,
    email: user.email ?? currentProfile?.email ?? "",
    name: fallbackName,
    phone: typeof user.user_metadata?.phone === "string" ? user.user_metadata.phone : currentProfile?.phone ?? null,
    avatarUrl: typeof user.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : currentProfile?.avatarUrl ?? null,
    role: currentProfile?.role ?? resolveOptimisticRole(user),
    agencyId: currentProfile?.agencyId ?? null,
    creditsBalance: currentProfile?.creditsBalance ?? 0,
    settings: currentProfile?.settings ?? DEFAULT_PROFILE_SETTINGS,
    createdAt: currentProfile?.createdAt ?? now,
    updatedAt: now,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabaseEnabled = shouldUseSupabase()
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(supabaseEnabled)
  const [initialized, setInitialized] = useState(!supabaseEnabled)
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])
  const bootstrapRunRef = useRef(0)
  const profileRef = useRef<Profile | null>(null)
  const sessionSignatureRef = useRef<string | null>(null)
  const profileRequestRef = useRef(0)

  const loadProfile = useCallback(
    async (nextUser: User | null) => {
      const requestId = profileRequestRef.current + 1
      profileRequestRef.current = requestId

      if (!nextUser || !supabase) {
        setProfile(null)
        profileRef.current = null
        devLog("boot.profile.loaded", null)
        return null
      }

      try {
        const perf = startPerfMeasure("auth.profile")
        const ensuredProfile = await withTimeout(
          ensureProfile(nextUser, supabase),
          BOOTSTRAP_TIMEOUT_MS,
          "Profile bootstrap timeout.",
        )

        if (profileRequestRef.current !== requestId) {
          return profileRef.current
        }

        setProfile(ensuredProfile)
        profileRef.current = ensuredProfile
        perf.end({ userId: nextUser.id, profileId: ensuredProfile?.id ?? null })
        devLog("boot.profile.loaded", ensuredProfile?.id ?? null)
        return ensuredProfile
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha ao carregar profile."
        reportAuthBootstrapIssue(message)
        devLog("boot.profile.loaded", profileRef.current?.id ?? null)
        return profileRef.current
      }
    },
    [supabase],
  )

  const syncAuthState = useCallback(
    async (nextSession: Session | null, options?: { deferProfile?: boolean }) => {
      const nextUser = nextSession?.user ?? null
      const nextSignature = nextSession?.access_token ?? nextUser?.id ?? "guest"
      const isSameSession = sessionSignatureRef.current === nextSignature

      setSession(nextSession)
      setUser(nextUser)

      devLog("boot.session.loaded", nextUser?.id ?? null)

      if (!nextUser) {
        sessionSignatureRef.current = nextSignature
        setProfile(null)
        profileRef.current = null
        devLog("boot.profile.loaded", null)
        return null
      }

      const optimisticProfile = buildOptimisticProfile(nextUser, profileRef.current)
      if (!isSameSession || profileRef.current?.id !== nextUser.id) {
        setProfile(optimisticProfile)
        profileRef.current = optimisticProfile
      }

      if (isSameSession && profileRef.current?.id === nextUser.id) {
        devLog("boot.profile.loaded", profileRef.current.id)
        return profileRef.current
      }

      sessionSignatureRef.current = nextSignature
      if (options?.deferProfile) {
        void loadProfile(nextUser)
        return optimisticProfile
      }

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
      setInitialized(true)
      return
    }

    const bootstrap = async () => {
      const perf = startPerfMeasure("auth.bootstrap")
      setLoading(true)

      try {
        const sessionResult = await withTimeout(
          supabase.auth.getSession(),
          BOOTSTRAP_TIMEOUT_MS,
          "Auth session bootstrap timeout.",
        )

        if (!mounted || bootstrapRunRef.current !== currentRun) return

        await syncAuthState(sessionResult.data.session ?? null, { deferProfile: true })
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha ao inicializar sessao."
        reportAuthBootstrapIssue(message)

        if (mounted && bootstrapRunRef.current === currentRun) {
          setSession(null)
          setUser(null)
          setProfile(null)
        }
      } finally {
        if (mounted && bootstrapRunRef.current === currentRun) {
          setLoading(false)
          setInitialized(true)
          perf.end({ userId: session?.user?.id ?? null })
        }
      }
    }

    void bootstrap()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (!mounted) return

      if (event === "INITIAL_SESSION") {
        return
      }

      if (event === "TOKEN_REFRESHED") {
        const nextUser = nextSession?.user ?? null
        setSession(nextSession)
        setUser(nextUser)
        devLog("boot.session.loaded", nextUser?.id ?? null)
        return
      }

      setLoading(true)
      setInitialized(false)

      try {
        await syncAuthState(nextSession ?? null, { deferProfile: true })
      } finally {
        if (!mounted) return
        setLoading(false)
        setInitialized(true)
      }
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
    setUser(null)
    setSession(null)
    setProfile(null)
    sessionSignatureRef.current = "guest"
    profileRef.current = null

    if (supabaseEnabled && supabase) {
      try {
        void withTimeout(supabase.auth.signOut(), BOOTSTRAP_TIMEOUT_MS, "Auth signout timeout.").catch((error) => {
          const message = error instanceof Error ? error.message : "Falha ao encerrar sessao."
          console.error("[AUTH ERROR]", message)
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha ao encerrar sessao."
        console.error("[AUTH ERROR]", message)
      }
    }
  }

  const requestPasswordReset = async (email: string) => {
    if (!supabaseEnabled || !supabase) {
      return { error: "Supabase nao esta configurado neste ambiente." }
    }

    try {
      const { error } = await withTimeout(
        supabase.auth.resetPasswordForEmail(email, {
          redirectTo: buildAbsoluteAppUrl("/auth/callback?next=/reset-password"),
        }),
        BOOTSTRAP_TIMEOUT_MS,
        "Auth password reset timeout.",
      )

      if (error) {
        console.error("[AUTH ERROR]", error.message)
        return { error: error.message }
      }

      return { error: null }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro inesperado ao solicitar recuperacao de senha."
      console.error("[AUTH ERROR]", message)
      return { error: message }
    }
  }

  const updatePassword = async (password: string) => {
    if (!supabaseEnabled || !supabase) {
      return { error: "Supabase nao esta configurado neste ambiente." }
    }

    try {
      const { error } = await withTimeout(
        supabase.auth.updateUser({ password }),
        BOOTSTRAP_TIMEOUT_MS,
        "Auth update password timeout.",
      )

      if (error) {
        console.error("[AUTH ERROR]", error.message)
        return { error: error.message }
      }

      return { error: null }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro inesperado ao atualizar a senha."
      console.error("[AUTH ERROR]", message)
      return { error: message }
    }
  }

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, initialized, signIn, signUp, signOut, refreshProfile, requestPasswordReset, updatePassword }}>
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
