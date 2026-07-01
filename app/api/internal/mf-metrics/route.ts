import { NextResponse } from "next/server"

import { getMFMetrics } from "@/lib/mf-control"

export async function GET() {
  try {
    const metrics = await getMFMetrics()
    return NextResponse.json(metrics)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao carregar metricas MF."

    return NextResponse.json(
      { error: message },
      { status: 500 },
    )
  }
}
