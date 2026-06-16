import { NextRequest, NextResponse } from "next/server"
import { createSupabaseAdminClient, hasSupabaseAdminEnv, isMissingSupabaseAdminEnvError } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/types"

export const runtime = "nodejs"

const DOCUMENTS_BUCKET = "vuei-documents"

type TripRow = Database["public"]["Tables"]["trips"]["Row"]
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"]
type AgencyMemberRow = Database["public"]["Tables"]["agency_members"]["Row"]
type DocumentRow = Database["public"]["Tables"]["documents"]["Row"]

type AccessMode = "admin" | "public"

async function getProfile(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  userId: string,
) {
  const { data, error } = await client
    .from("profiles")
    .select("id, role, agency_id")
    .eq("id", userId)
    .maybeSingle()

  if (error) {
    return { data: null as ProfileRow | null, error: error.message }
  }

  return { data: data as ProfileRow | null, error: null }
}

async function getAccessibleTrip(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  userId: string,
  tripId: string,
  profile: ProfileRow | null,
) {
  const tripResult = await client.from("trips").select("*").eq("id", tripId).maybeSingle()

  if (tripResult.error) {
    return { trip: null as TripRow | null, membership: null as AgencyMemberRow | null, error: tripResult.error.message }
  }

  const trip = tripResult.data as TripRow | null
  if (!trip) {
    return { trip: null as TripRow | null, membership: null as AgencyMemberRow | null, error: "Viagem nao encontrada." }
  }

  if (profile?.role === "master" || trip.owner_user_id === userId) {
    return { trip, membership: null as AgencyMemberRow | null, error: null }
  }

  if (!trip.agency_id) {
    return { trip: null as TripRow | null, membership: null as AgencyMemberRow | null, error: "Voce nao tem permissao para acessar este documento." }
  }

  const membershipResult = await client
    .from("agency_members")
    .select("*")
    .eq("agency_id", trip.agency_id)
    .eq("profile_id", userId)
    .eq("status", "active")
    .maybeSingle()

  if (membershipResult.error) {
    return { trip: null as TripRow | null, membership: null as AgencyMemberRow | null, error: membershipResult.error.message }
  }

  if (!membershipResult.data) {
    return { trip: null as TripRow | null, membership: null as AgencyMemberRow | null, error: "Voce nao tem permissao para acessar este documento." }
  }

  return { trip, membership: membershipResult.data as AgencyMemberRow, error: null }
}

async function resolveTripByLinkAccess(params: {
  tripId?: string | null
  tripSlug?: string | null
  adminToken?: string | null
  publicToken?: string | null
  accessMode: AccessMode
}) {
  const supabase = createSupabaseAdminClient()

  let query = supabase.from("trips").select("*")
  if (params.tripId) {
    query = query.eq("id", params.tripId)
  } else if (params.tripSlug) {
    query = query.eq("slug", params.tripSlug)
  } else if (params.accessMode === "admin" && params.adminToken) {
    query = query.eq("admin_token", params.adminToken)
  } else if (params.accessMode === "public" && params.publicToken) {
    query = query.eq("public_token", params.publicToken)
  } else {
    return { supabase, trip: null as TripRow | null, error: "Link da viagem invalido." }
  }

  const { data, error } = await query.maybeSingle()
  if (error) {
    return { supabase, trip: null as TripRow | null, error: error.message }
  }

  const trip = data as TripRow | null
  if (!trip) {
    return { supabase, trip: null as TripRow | null, error: "Viagem nao encontrada." }
  }

  if (params.accessMode === "admin") {
    const tokenMatches = Boolean(params.adminToken && trip.admin_token === params.adminToken)
    const slugMatches = Boolean(params.tripSlug && trip.slug === params.tripSlug)

    if (!tokenMatches && !slugMatches) {
      return { supabase, trip: null as TripRow | null, error: "Acesso administrativo invalido para este documento." }
    }
  } else {
    const tokenMatches = Boolean(params.publicToken && trip.public_token === params.publicToken)
    const slugMatches = Boolean(params.tripSlug && trip.slug === params.tripSlug && trip.visibility === "public")

    if (!trip.visibility || trip.visibility !== "public") {
      return { supabase, trip: null as TripRow | null, error: "Esta viagem nao esta disponivel publicamente." }
    }

    if (!tokenMatches && !slugMatches) {
      return { supabase, trip: null as TripRow | null, error: "Acesso publico invalido para este documento." }
    }
  }

  return { supabase, trip, error: null as string | null }
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
    return { document: null as DocumentRow | null, error: "Documento nao encontrado." }
  }

  return { document: data as DocumentRow, error: null }
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
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Documento indisponivel</title></head><body style="margin:0;background:#0b1220;color:#fff;font-family:Inter,system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;"><div style="max-width:420px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);border-radius:24px;padding:24px;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,.28);"><h1 style="font-size:20px;margin:0 0 12px;">Nao foi possivel abrir este documento</h1><p style="margin:0;color:rgba(255,255,255,.72);line-height:1.6;">${safeMessage}</p></div></body></html>`,
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
    const adminToken = url.searchParams.get("adminToken")
    const publicToken = url.searchParams.get("publicToken") || url.searchParams.get("token")
    const accessMode = (url.searchParams.get("accessMode") === "admin" ? "admin" : "public") as AccessMode
    const dispositionMode = url.searchParams.get("disposition") === "download" ? "download" : "inline"

    if (!documentId) {
      return buildErrorResponse("Documento invalido.", 400, dispositionMode)
    }

    let adminClient: ReturnType<typeof createSupabaseAdminClient> | null = null
    let trip: TripRow | null = null

    const serverClient = await createSupabaseServerClient()
    const authResult = serverClient ? await serverClient.auth.getUser() : null
    const sessionUser = authResult?.data.user ?? null

    if (serverClient && sessionUser && tripId && accessMode !== "public") {
      const profileResult = await getProfile(serverClient, sessionUser.id)
      if (!profileResult.data) {
        return buildErrorResponse(profileResult.error ?? "Perfil do usuario nao encontrado.", 403, dispositionMode)
      }

      const accessResult = await getAccessibleTrip(serverClient, sessionUser.id, tripId, profileResult.data)
      if (!accessResult.trip) {
        return buildErrorResponse(accessResult.error ?? "Voce nao tem permissao para acessar este documento.", 403, dispositionMode)
      }

      if (!hasSupabaseAdminEnv()) {
        return buildErrorResponse("A configuracao administrativa do servidor nao esta disponivel no momento.", 503, dispositionMode)
      }

      adminClient = createSupabaseAdminClient()
      trip = accessResult.trip
    } else {
      if (!hasSupabaseAdminEnv()) {
        return buildErrorResponse("A configuracao administrativa do servidor nao esta disponivel no momento.", 503, dispositionMode)
      }

      const accessResult = await resolveTripByLinkAccess({
        tripId,
        tripSlug,
        adminToken,
        publicToken,
        accessMode,
      })

      if (!accessResult.trip) {
        return buildErrorResponse(accessResult.error ?? "Acesso invalido a este documento.", 403, dispositionMode)
      }

      adminClient = accessResult.supabase
      trip = accessResult.trip
    }

    if (!adminClient || !trip) {
      return buildErrorResponse("Nao foi possivel validar este documento.", 403, dispositionMode)
    }

    const documentResult = await resolveDocument(adminClient, trip.id, documentId)
    if (!documentResult.document) {
      return buildErrorResponse(documentResult.error ?? "Documento nao encontrado.", 404, dispositionMode)
    }

    const document = documentResult.document
    const isPrivateDocument =
      document.is_private === true ||
      document.visibility === "private" ||
      document.visibility === "agency_only"

    if (accessMode === "public" && isPrivateDocument) {
      return buildErrorResponse("Este documento nao esta disponivel no link publico.", 403, dispositionMode)
    }

    if (!document.file_path) {
      return buildErrorResponse("Arquivo indisponivel para este documento.", 400, dispositionMode)
    }

    const fileResult = await adminClient.storage.from(DOCUMENTS_BUCKET).download(document.file_path)
    if (fileResult.error || !fileResult.data) {
      return buildErrorResponse(fileResult.error?.message || "Nao foi possivel abrir este documento agora.", 400, dispositionMode)
    }

    const arrayBuffer = await fileResult.data.arrayBuffer()
    const fileName = document.name || "documento"

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": document.mime_type || "application/octet-stream",
        "Content-Disposition": buildDisposition(fileName, dispositionMode),
        "Cache-Control": "private, max-age=60",
      },
    })
  } catch (error) {
    if (isMissingSupabaseAdminEnvError(error)) {
      return buildErrorResponse("A configuracao administrativa do servidor nao esta disponivel no momento.", 503, "inline")
    }

    const message = error instanceof Error ? error.message : "Nao foi possivel abrir este documento agora."
    console.error("[TRIP DOCUMENTS] get error", message)
    return buildErrorResponse(message, 500, "inline")
  }
}
