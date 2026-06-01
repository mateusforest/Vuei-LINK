"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import type { Session, User } from "@supabase/supabase-js"
import type { Profile, UserRole } from "@/types"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { shouldUseSupabase } from "@/lib/data-source"
import { ensureProfile } from "@/lib/auth/ensure-profile"

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])

  const applyAuthState = async (nextSession: Session | null) => {
    const nextUser = nextSession?.user ?? null
    setSession(nextSession)
    setUser(nextUser)

    console.log("[AUTH] initial session", nextSession?.user?.id ?? null)
    console.log("[AUTH] session user", nextUser?.id ?? null)
    console.log("[AUTH] metadata", nextUser?.user_metadata ?? null)

    if (!nextUser || !supabase) {
      setProfile(null)
      return null
    }

    const ensuredProfile = await ensureProfile(nextUser, supabase)
    setProfile(ensuredProfile)
    console.log("[AUTH] profile loaded", ensuredProfile)
    return ensuredProfile
  }

  const refreshProfile = async () => {
    if (!shouldUseSupabase() || !supabase) {
      setProfile(null)
      return
    }

    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession()

    setLoading(true)
    await applyAuthState(currentSession ?? null)
    setLoading(false)
  }

  useEffect(() => {
    let mounted = true

    if (!shouldUseSupabase() || !supabase) {
      setLoading(false)
      return
    }

    const bootstrap = async () => {
      setLoading(true)
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession()

      if (!mounted) return

      await applyAuthState(currentSession ?? null)
      setLoading(false)
    }

    void bootstrap()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return

      setLoading(true)
      await applyAuthState(session ?? null)

      if (mounted) setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

  const signIn = async ({ email, password }: SignInPayload) => {
    if (!shouldUseSupabase() || !supabase) {
      return { error: "Supabase nao esta configurado neste ambiente.", user: null, profile: null, session: null }
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        console.error("[AUTH ERROR]", error.message)
        return { error: error.message, user: null, profile: null, session: null }
      }

      const ensuredProfile = await applyAuthState(data.session ?? null)
      return { error: null, user: data.user ?? null, profile: ensuredProfile, session: data.session ?? null }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro inesperado no login."
      console.error("[AUTH ERROR]", message)
      return { error: message, user: null, profile: null, session: null }
    } finally {
      setLoading(false)
    }
  }

  const signUp = async ({ email, password, name, phone, role, metadata }: SignUpPayload) => {
    const supabaseEnvOk = shouldUseSupabase() && Boolean(supabase)
    console.log("Supabase env ok", supabaseEnvOk)

    if (!supabaseEnvOk || !supabase) {
      console.error("signUp error", "Supabase nao esta configurado neste ambiente.")
      return { error: "Supabase nao esta configurado neste ambiente.", user: null, profile: null, session: null }
    }

    console.log("signUp started")
    try {
      const { data, error } = await supabase.auth.signUp({
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
      })

      if (error) {
        console.error("signUp error", error.message)
        console.error("[AUTH ERROR]", error.message)
        return { error: error.message, user: null, profile: null, session: null }
      }

      const ensuredProfile = data.user ? await ensureProfile(data.user, supabase) : null
      setSession(data.session ?? null)
      setUser(data.user ?? null)
      setProfile(ensuredProfile)

      console.log("[AUTH] session user", data.user?.id ?? null)
      console.log("[AUTH] metadata", data.user?.user_metadata ?? null)
      console.log("[AUTH] profile loaded", ensuredProfile)

      console.log("signUp success")
      return { error: null, user: data.user ?? null, profile: ensuredProfile, session: data.session ?? null }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro inesperado no cadastro."
      console.error("signUp error", message)
      console.error("[AUTH ERROR]", message)
      return { error: message, user: null, profile: null, session: null }
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    setLoading(true)
    if (shouldUseSupabase() && supabase) {
      await supabase.auth.signOut()
    }

    setUser(null)
    setSession(null)
    setProfile(null)
    setLoading(false)
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
