import { NextRequest, NextResponse } from "next/server"
import { createSupabaseAdminClient, hasSupabaseAdminEnv, isMissingSupabaseAdminEnvError } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { resolveAuthenticatedTripAccess } from "@/lib/security/trip-authenticated-access"
import { resolveTripLinkAccess } from "@/lib/security/trip-link-access"
import type { Database } from "@/lib/supabase/types"

export const runtime = "nodejs"

type TripRow = Database["public"]["Tables"]["trips"]["Row"]
type DocumentRow = Database["public"]["Tables"]["documents"]["Row"]
type FlightRow = Database["public"]["Tables"]["trip_flights"]["Row"]
type HotelRow = Database["public"]["Tables"]["trip_hotels"]["Row"]
type ItineraryRow = Database["public"]["Tables"]["trip_itineraries"]["Row"]
type TripTravelerRow = Database["public"]["Tables"]["trip_travelers"]["Row"]
type AccessMode = "admin" | "public"

function mapDocumentRow(row: DocumentRow) {
  return {
    id: row.id,
    tripId: row.trip_id,
    clientId: row.client_id,
    agencyId: row.agency_id,
    ownerUserId: row.owner_user_id,
    name: row.name,
    type: row.type,
    fileUrl: row.file_url,
    filePath: row.file_path,
    mimeType: row.mime_type,
    size: row.size_bytes,
    isPrivate: row.is_private,
    visibility: row.visibility,
    aiExtractedData: (row.ai_extracted_data ?? {}) as Record<string, unknown>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapFlightRow(row: FlightRow) {
  return {
    id: row.id,
    tripId: row.trip_id,
    documentId: row.document_id,
    airline: row.airline,
    flightNumber: row.flight_number,
    bookingReference: row.booking_reference,
    originAirport: row.origin_airport,
    destinationAirport: row.destination_airport,
    departureAt: row.departure_at,
    arrivalAt: row.arrival_at,
    passengerName: row.passenger_name,
    qrCodePayload: row.qr_code_payload,
    baggageInfo: row.baggage_info,
    terminal: row.terminal,
    gate: row.gate,
    seat: row.seat,
    extractedData: (row.extracted_data ?? {}) as Record<string, unknown>,
    extractionStatus: row.extraction_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapHotelRow(row: HotelRow) {
  return {
    id: row.id,
    tripId: row.trip_id,
    documentId: row.document_id,
    name: row.hotel_name ?? row.name ?? "",
    hotelName: row.hotel_name ?? null,
    address: row.address ?? null,
    checkIn: row.check_in ?? null,
    checkOut: row.check_out ?? null,
    confirmationCode: row.confirmation_number ?? row.confirmation_code ?? null,
    confirmationNumber: row.confirmation_number ?? null,
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapItineraryRow(row: ItineraryRow) {
  return {
    id: row.id,
    tripId: row.trip_id,
    documentId: row.document_id,
    title: row.title,
    mode: row.mode,
    status: row.status,
    content: row.content,
    pdfUrl: row.pdf_url,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapTripTravelerRow(row: TripTravelerRow) {
  const isPrimary = row.is_primary === true || row.role === "primary"
  return {
    id: row.id,
    tripId: row.trip_id,
    name: row.name,
    role: isPrimary ? "primary" : "companion",
    isPrimary,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function resolveSectionsTrip(params: {
  tripId?: string | null
  tripSlug?: string | null
  adminToken?: string | null
  publicToken?: string | null
  accessMode: AccessMode
}) {
  const supabase = createSupabaseAdminClient()

  if (params.accessMode === "public") {
    const result = await resolveTripLinkAccess(supabase, params)
    return { supabase, trip: result.trip, error: result.error }
  }

  if (params.adminToken) {
    const result = await resolveTripLinkAccess(supabase, params)
    return { supabase, trip: result.trip, error: result.error }
  }

  const serverClient = await createSupabaseServerClient()
  const authResult = serverClient ? await serverClient.auth.getUser() : null
  const sessionUser = authResult?.data.user ?? null

  if (!serverClient || !sessionUser) {
    return { supabase, trip: null as TripRow | null, error: "Acesso administrativo inválido." }
  }

  const result = await resolveAuthenticatedTripAccess(serverClient, sessionUser.id, {
    tripId: params.tripId,
    tripSlug: params.tripSlug,
  })

  return { supabase, trip: result.trip, error: result.error }
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } })
}

export async function GET(request: NextRequest) {
  try {
    if (!hasSupabaseAdminEnv()) {
      return errorResponse("A configuração administrativa do servidor não está disponível no momento.", 503)
    }

    const url = new URL(request.url)
    const accessMode = url.searchParams.get("accessMode") === "admin" ? "admin" : "public"
    const accessResult = await resolveSectionsTrip({
      tripId: url.searchParams.get("tripId"),
      tripSlug: url.searchParams.get("tripSlug"),
      adminToken: url.searchParams.get("adminToken"),
      publicToken: url.searchParams.get("publicToken") || url.searchParams.get("token"),
      accessMode,
    })

    if (!accessResult.trip) {
      return errorResponse(accessResult.error ?? "Acesso inválido à viagem.", 403)
    }

    let documentsQuery = accessResult.supabase
      .from("documents")
      .select("*")
      .eq("trip_id", accessResult.trip.id)
      .order("created_at", { ascending: false })

    if (accessMode === "public") {
      documentsQuery = documentsQuery.eq("visibility", "public_trip").eq("is_private", false)
    }

    const [documentsResult, flightsResult, hotelsResult, itinerariesResult, travelersResult] = await Promise.all([
      documentsQuery,
      accessResult.supabase
        .from("trip_flights")
        .select("*")
        .eq("trip_id", accessResult.trip.id)
        .order("departure_at", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true }),
      accessResult.supabase.from("trip_hotels").select("*").eq("trip_id", accessResult.trip.id).order("created_at", { ascending: true }),
      accessResult.supabase.from("trip_itineraries").select("*").eq("trip_id", accessResult.trip.id).order("created_at", { ascending: false }),
      accessMode === "admin"
        ? accessResult.supabase
            .from("trip_travelers")
            .select("*")
            .eq("trip_id", accessResult.trip.id)
            .order("is_primary", { ascending: false })
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [] as TripTravelerRow[], error: null }),
    ])

    const firstError =
      documentsResult.error?.message ||
      flightsResult.error?.message ||
      hotelsResult.error?.message ||
      itinerariesResult.error?.message ||
      travelersResult.error?.message

    if (firstError) {
      return errorResponse(firstError, 400)
    }

    return NextResponse.json(
      {
        documents: (documentsResult.data ?? []).map((row) => mapDocumentRow(row as DocumentRow)),
        flights: (flightsResult.data ?? []).map((row) => mapFlightRow(row as FlightRow)),
        hotels: (hotelsResult.data ?? []).map((row) => mapHotelRow(row as HotelRow)),
        itineraries: (itinerariesResult.data ?? []).map((row) => mapItineraryRow(row as ItineraryRow)),
        travelers: (travelersResult.data ?? []).map((row) => mapTripTravelerRow(row as TripTravelerRow)),
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    if (isMissingSupabaseAdminEnvError(error)) {
      return errorResponse("A configuração administrativa do servidor não está disponível no momento.", 503)
    }

    const message = error instanceof Error ? error.message : "Não foi possível carregar as seções da viagem."
    console.error("[TRIP SECTIONS] get error", message)
    return errorResponse(message, 500)
  }
}
