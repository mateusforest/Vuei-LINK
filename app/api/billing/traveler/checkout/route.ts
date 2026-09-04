import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json(
    {
      error: "O Premium Individual não está disponível para novas assinaturas.",
      code: "premium_legacy_only",
    },
    { status: 410 },
  )
}
