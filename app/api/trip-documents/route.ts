import { NextRequest, NextResponse } from "next/server"
import { createSupabaseAdminClient, hasSupabaseAdminEnv, isMissingSupabaseAdminEnvError } from "@/lib/supabase/admin"
import { resolveTripLinkAccess as resolveTripLinkRequest } from "@/lib/security/trip-link-access"
import { resolveAuthenticatedTripAccess } from "@/lib/security/trip-authenticated-access"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/types"
import { parseHttpByteRange } from "@/lib/files/http-byte-range"

export const runtime = "nodejs"

const DOCUMENTS_BUCKET = "vuei-documents"

type TripRow = Database["public"]["Tables"]["trips"]["Row"]
type DocumentRow = Database["public"]["Tables"]["documents"]["Row"]
type ItineraryRow = Database["public"]["Tables"]["trip_itineraries"]["Row"]

type AccessMode = "admin" | "public"

async function resolveTripByLinkAccess(params: {
  tripId?: string | null
  tripSlug?: string | null
  adminToken?: string | null
  publicToken?: string | null
  accessMode: AccessMode
}) {
  const supabase = createSupabaseAdminClient()
  const accessResult = await resolveTripLinkRequest(supabase, {
    tripId: params.tripId,
    tripSlug: params.tripSlug,
    adminToken: params.adminToken,
    publicToken: params.publicToken,
    accessMode: params.accessMode,
  })

  return {
    supabase,
    trip: accessResult.trip,
    error: accessResult.error,
  }
}

async function resolveDocument(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  tripId: string,
  documentId: string,
) {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("trip_id", tripId)
    .eq("id", documentId)
    .maybeSingle()

  if (error) {
    return { document: null as DocumentRow | null, error: error.message }
  }

  if (!data) {
    return { document: null as DocumentRow | null, error: "Documento n?o ?ncontrado." }
  }

  return { document: data as DocumentRow, error: null }
}

async function resolveItinerary(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  tripId: string,
  itineraryId: string,
) {
  const { data, error } = await supabase
    .from("trip_itineraries")
    .select("*")
    .eq("trip_id", tripId)
    .eq("id", itineraryId)
    .maybeSingle()

  if (error) {
    return { itinerary: null as ItineraryRow | null, error: error.message }
  }

  if (!data) {
    return { itinerary: null as ItineraryRow | null, error: "Roteiro não encontrado." }
  }

  return { itinerary: data as ItineraryRow, error: null }
}

function resolveMimeTypeFromPath(path: string) {
  const normalizedPath = path.toLowerCase().split("?")[0]
  if (normalizedPath.endsWith(".pdf")) return "application/pdf"
  if (normalizedPath.endsWith(".png")) return "image/png"
  if (normalizedPath.endsWith(".jpg") || normalizedPath.endsWith(".jpeg")) return "image/jpeg"
  if (normalizedPath.endsWith(".webp")) return "image/webp"
  return "application/octet-stream"
}

function buildDisposition(filename: string, mode: "inline" | "download") {
  const encodedName = encodeURIComponent(filename)
  return `${mode === "download" ? "attachment" : "inline"}; filename*=UTF-8''${encodedName}`
}

function buildErrorResponse(message: string, status: number, mode: "inline" | "download") {
  if (mode === "download") {
    return NextResponse.json({ error: message }, { status })
  }

  const safeMessage = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")

  return new NextResponse(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Documento indispon?vel</title></head><body style="margin:0;background:#0b1220;color:#fff;font-family:Inter,system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;"><div style="max-width:420px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);border-radius:24px;padding:24px;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,.28);"><h1 style="font-size:20px;margin:0 0 12px;">N?o foi poss?vel abrir este documento</h1><p style="margin:0;color:rgba(255,255,255,.72);line-height:1.6;">${safeMessage}</p></div></body></html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  )
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const tripId = url.searchParams.get("tripId")
    const tripSlug = url.searchParams.get("tripSlug")
    const documentId = url.searchParams.get("documentId")
    const itineraryId = url.searchParams.get("itineraryId")
    const adminToken = url.searchParams.get("adminToken")
    const publicToken = url.searchParams.get("publicToken") || url.searchParams.get("token")
    const accessMode = (url.searchParams.get("accessMode") === "admin" ? "admin" : "public") as AccessMode
    const dispositionMode = url.searchParams.get("disposition") === "download" ? "download" : "inline"

    if (!documentId && !itineraryId) {
      return buildErrorResponse("Documento inv?lido.", 400, dispositionMode)
    }

    let adminClient: ReturnType<typeof createSupabaseAdminClient> | null = null
    let trip: TripRow | null = null

    const serverClient = await createSupabaseServerClient()
    const authResult = serverClient ? await serverClient.auth.getUser() : null
    const sessionUser = authResult?.data.user ?? null

    if (serverClient && sessionUser && tripId && accessMode !== "public") {
      const accessResult = await resolveAuthenticatedTripAccess(serverClient, sessionUser.id, { tripId })
      if (!accessResult.trip) {
        return buildErrorResponse(accessResult.error ?? "Voc? n?o tem permiss?o para acessar este documento.", 403, dispositionMode)
      }

      if (!hasSupabaseAdminEnv()) {
        return buildErrorResponse("A configura??o administrativa do servidor n?o ?sta dispon?vel no momento.", 503, dispositionMode)
      }

      adminClient = createSupabaseAdminClient()
      trip = accessResult.trip
    } else {
      if (!hasSupabaseAdminEnv()) {
        return buildErrorResponse("A configura??o administrativa do servidor n?o ?sta dispon?vel no momento.", 503, dispositionMode)
      }

      const accessResult = await resolveTripByLinkAccess({
        tripId,
        tripSlug,
        adminToken,
        publicToken,
        accessMode,
      })

      if (!accessResult.trip) {
        return buildErrorResponse(accessResult.error ?? "Acesso inv?lido a este documento.", 403, dispositionMode)
      }

      adminClient = accessResult.supabase
      trip = accessResult.trip
    }

    if (!adminClient || !trip) {
      return buildErrorResponse("N?o foi poss?vel validar este documento.", 403, dispositionMode)
    }

    let filePath: string | null = null
    let fileName = "documento"
    let mimeType = "application/octet-stream"

    if (documentId) {
      const documentResult = await resolveDocument(adminClient, trip.id, documentId)
      if (!documentResult.document) {
        return buildErrorResponse(documentResult.error ?? "Documento n?o ?ncontrado.", 404, dispositionMode)
      }

      const document = documentResult.document
      const isPrivateDocument =
        document.is_private === true ||
        document.visibility === "private" ||
        document.visibility === "agency_only"

      if (accessMode === "public" && isPrivateDocument) {
        return buildErrorResponse("Este documento n?o ?sta dispon?vel no link publico.", 403, dispositionMode)
      }

      filePath = document.file_path
      fileName = document.name || fileName
      mimeType = document.mime_type || (filePath ? resolveMimeTypeFromPath(filePath) : mimeType)
    } else if (itineraryId) {
      const itineraryResult = await resolveItinerary(adminClient, trip.id, itineraryId)
      if (!itineraryResult.itinerary) {
        return buildErrorResponse(itineraryResult.error ?? "Roteiro n?o ?ncontrado.", 404, dispositionMode)
      }

      const itinerary = itineraryResult.itinerary
      if (itinerary.mode === "simple" || !["completed", "uploaded"].includes(itinerary.status)) {
        return buildErrorResponse("Arquivo indispon?vel para este roteiro.", 400, dispositionMode)
      }

      if (itinerary.document_id) {
        const documentResult = await resolveDocument(adminClient, trip.id, itinerary.document_id)
        if (documentResult.document) {
          const document = documentResult.document
          const isPrivateDocument =
            document.is_private === true ||
            document.visibility === "private" ||
            document.visibility === "agency_only"

          if (accessMode === "public" && isPrivateDocument) {
            return buildErrorResponse("Este roteiro n?o ?sta dispon?vel no link publico.", 403, dispositionMode)
          }

          filePath = document.file_path
          fileName = document.name || itinerary.title || "roteiro"
          mimeType = document.mime_type || (filePath ? resolveMimeTypeFromPath(filePath) : mimeType)
        }
      }

      if (!filePath && itinerary.pdf_url) {
        filePath = itinerary.pdf_url
        fileName = itinerary.title || "roteiro"
        mimeType = resolveMimeTypeFromPath(filePath)
      }
    }

    if (!filePath) {
      return buildErrorResponse("Arquivo indispon?vel para este documento.", 400, dispositionMode)
    }

    const fileResult = await adminClient.storage.from(DOCUMENTS_BUCKET).download(filePath)
    if (fileResult.error || !fileResult.data) {
      return buildErrorResponse(fileResult.error?.message || "N?o foi poss?vel abrir este documento agora.", 400, dispositionMode)
    }

    const arrayBuffer = await fileResult.data.arrayBuffer()
    const byteRange = parseHttpByteRange(request.headers.get("range"), arrayBuffer.byteLength)
    const responseHeaders = {
      "Content-Type": mimeType,
      "Content-Disposition": buildDisposition(fileName, dispositionMode),
      "Cache-Control": "private, max-age=60",
      "Accept-Ranges": "bytes",
      "X-Content-Type-Options": "nosniff",
    }

    if (byteRange) {
      const body = arrayBuffer.slice(byteRange.start, byteRange.end + 1)
      return new NextResponse(body, {
        status: 206,
        headers: {
          ...responseHeaders,
          "Content-Length": String(body.byteLength),
          "Content-Range": `bytes ${byteRange.start}-${byteRange.end}/${arrayBuffer.byteLength}`,
        },
      })
    }

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        ...responseHeaders,
        "Content-Length": String(arrayBuffer.byteLength),
      },
    })
  } catch (error) {
    if (isMissingSupabaseAdminEnvError(error)) {
      return buildErrorResponse("A configura??o administrativa do servidor n?o ?sta dispon?vel no momento.", 503, "inline")
    }

    const message = error instanceof Error ? error.message : "N?o foi poss?vel abrir este documento agora."
    console.error("[TRIP DOCUMENTS] get error", message)
    return buildErrorResponse(message, 500, "inline")
  }
}
