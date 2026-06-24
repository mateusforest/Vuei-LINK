import { NextResponse } from "next/server"
import type { EmailOtpType } from "@supabase/supabase-js"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { buildAbsoluteAppUrl } from "@/lib/app-url"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const tokenHash = requestUrl.searchParams.get("token_hash")
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null
  const next = requestUrl.searchParams.get("next") ?? "/reset-password"

  const fallbackUrl = new URL("/forgot-password?error=invalid-recovery-link", buildAbsoluteAppUrl("/"))
  const nextUrl = new URL(next.startsWith("/") ? next : "/reset-password", buildAbsoluteAppUrl("/"))

  if (!tokenHash || !type) {
    return NextResponse.redirect(fallbackUrl)
  }

  const supabase = await createSupabaseServerClient()
  if (!supabase) {
    fallbackUrl.searchParams.set("error", "supabase-unavailable")
    return NextResponse.redirect(fallbackUrl)
  }

  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  })

  if (error) {
    fallbackUrl.searchParams.set("error", "recovery-failed")
    return NextResponse.redirect(fallbackUrl)
  }

  return NextResponse.redirect(nextUrl)
}
