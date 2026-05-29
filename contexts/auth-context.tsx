"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import type { User } from "@supabase/supabase-js"
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
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: (payload: SignInPayload) => Promise<{ error: string | null }>
  signUp: (payload: SignUpPayload) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])

  const refreshProfile = async () => {
    if (!shouldUseSupabase() || !supabase) {
      setProfile(null)
      return
    }

    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser()

    setUser(currentUser ?? null)

    if (!currentUser) {
      setProfile(null)
      return
    }

    const ensuredProfile = await ensureProfile(currentUser, supabase)
    setProfile(ensuredProfile)
  }

  useEffect(() => {
    let mounted = true

    if (!shouldUseSupabase() || !supabase) {
      setLoading(false)
      return
    }

    const bootstrap = async () => {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser()

      if (!mounted) return

      setUser(currentUser ?? null)
      if (currentUser) {
        const ensuredProfile = await ensureProfile(currentUser, supabase)
        if (mounted) setProfile(ensuredProfile)
      } else {
        setProfile(null)
      }
      setLoading(false)
    }

    void bootstrap()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return

      const nextUser = session?.user ?? null
      setUser(nextUser)

      if (nextUser) {
        const ensuredProfile = await ensureProfile(nextUser, supabase)
        if (mounted) setProfile(ensuredProfile)
      } else {
        setProfile(null)
      }

      if (mounted) setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

  const signIn = async ({ email, password }: SignInPayload) => {
    if (!shouldUseSupabase() || !supabase) {
      return { error: "Supabase nao esta configurado neste ambiente." }
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        return { error: error.message }
      }

      setUser(data.user)
      if (data.user) {
        const ensuredProfile = await ensureProfile(data.user, supabase)
        setProfile(ensuredProfile)
      }
      return { error: null }
    } finally {
      setLoading(false)
    }
  }

  const signUp = async ({ email, password, name, phone, role, metadata }: SignUpPayload) => {
    const supabaseEnvOk = shouldUseSupabase() && Boolean(supabase)
    console.log("Supabase env ok", supabaseEnvOk)

    if (!supabaseEnvOk || !supabase) {
      console.error("signUp error", "Supabase nao esta configurado neste ambiente.")
      return { error: "Supabase nao esta configurado neste ambiente." }
    }

    console.log("signUp started")
    setLoading(true)

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
        return { error: error.message }
      }

      if (data.user) {
        const ensuredProfile = await ensureProfile(data.user, supabase)
        setProfile(ensuredProfile)
        setUser(data.user)
      }

      console.log("signUp success")
      return { error: null }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro inesperado no cadastro."
      console.error("signUp error", message)
      return { error: message }
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    if (shouldUseSupabase() && supabase) {
      await supabase.auth.signOut()
    }

    setUser(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut, refreshProfile }}>
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
