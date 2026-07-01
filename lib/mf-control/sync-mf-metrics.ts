import "server-only"

import { withTimeout } from "@/lib/async/with-timeout"
import { getMFMetrics, type MFMetrics } from "@/lib/mf-control/get-mf-metrics"

const MF_SYNC_TIMEOUT_MS = 15_000

export interface MFMetricsSyncResult {
  ok: boolean
  endpoint: string | null
  status: number | null
  metrics: MFMetrics | null
  responseBody: unknown
  error: string | null
}

function getMFControlCenterConfig() {
  return {
    baseUrl: process.env.MF_CONTROL_CENTER_URL?.trim() || "",
    apiKey: process.env.MF_INTERNAL_API_KEY?.trim() || "",
  }
}

function buildMFControlCenterSyncUrl(baseUrl: string) {
  return `${baseUrl.replace(/\/+$/, "")}/api/sync/vuei`
}

export function hasMFControlCenterEnv() {
  const { baseUrl, apiKey } = getMFControlCenterConfig()
  return Boolean(baseUrl && apiKey)
}

async function parseResponseBody(response: Response) {
  const contentType = response.headers.get("content-type") || ""

  if (contentType.includes("application/json")) {
    try {
      return await response.json()
    } catch {
      return null
    }
  }

  try {
    return await response.text()
  } catch {
    return null
  }
}

export async function syncMFMetrics(): Promise<MFMetricsSyncResult> {
  const metrics = await getMFMetrics()
  const { baseUrl, apiKey } = getMFControlCenterConfig()

  if (!baseUrl || !apiKey) {
    return {
      ok: false,
      endpoint: null,
      status: null,
      metrics,
      responseBody: null,
      error: "MF Control Center nao configurado. Defina MF_CONTROL_CENTER_URL e MF_INTERNAL_API_KEY.",
    }
  }

  const endpoint = buildMFControlCenterSyncUrl(baseUrl)

  try {
    const response = await withTimeout(
      fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-mf-internal-key": apiKey,
        },
        body: JSON.stringify(metrics),
        cache: "no-store",
      }),
      MF_SYNC_TIMEOUT_MS,
      "Tempo limite excedido ao sincronizar metricas com o MF Control Center.",
    )

    const responseBody = await parseResponseBody(response)

    if (!response.ok) {
      return {
        ok: false,
        endpoint,
        status: response.status,
        metrics,
        responseBody,
        error: `MF Control Center respondeu com HTTP ${response.status}.`,
      }
    }

    return {
      ok: true,
      endpoint,
      status: response.status,
      metrics,
      responseBody,
      error: null,
    }
  } catch (error) {
    return {
      ok: false,
      endpoint,
      status: null,
      metrics,
      responseBody: null,
      error: error instanceof Error ? error.message : "Falha desconhecida ao sincronizar metricas com o MF Control Center.",
    }
  }
}
