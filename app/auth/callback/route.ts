import { NextResponse } from "next/server"
import type { EmailOtpType } from "@supabase/supabase-js"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { buildAbsoluteAppUrl } from "@/lib/app-url"

function resolveSafeNextPath(next: string | null) {
  if (!next || !next.startsWith("/")) {
    return "/reset-password"
  }

  if (next.startsWith("//")) {
    return "/reset-password"
  }

  return next
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const tokenHash = requestUrl.searchParams.get("token_hash")
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null
  const next = resolveSafeNextPath(requestUrl.searchParams.get("next"))

  const fallbackUrl = new URL("/forgot-password?error=invalid-recovery-link", buildAbsoluteAppUrl("/"))
  const nextUrl = new URL(next, buildAbsoluteAppUrl("/"))

  const supabase = await createSupabaseServerClient()
  if (!supabase) {
    fallbackUrl.searchParams.set("error", "supabase-unavailable")
    return NextResponse.redirect(fallbackUrl)
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      fallbackUrl.searchParams.set("error", "recovery-code-failed")
      return NextResponse.redirect(fallbackUrl)
    }

    return NextResponse.redirect(nextUrl)
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    })

    if (error) {
      fallbackUrl.searchParams.set("error", "recovery-token-failed")
      return NextResponse.redirect(fallbackUrl)
    }

    return NextResponse.redirect(nextUrl)
  }

  return NextResponse.redirect(fallbackUrl)
}
