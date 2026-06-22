import { NextRequest, NextResponse } from "next/server"
import { createSupabaseAdminClient, hasSupabaseAdminEnv, isMissingSupabaseAdminEnvError } from "@/lib/supabase/admin"
import { resolveTripLinkAccess } from "@/lib/security/trip-link-access"
import { resolveDocumentMimeType } from "@/lib/files/file-validation"
import type { Database } from "@/lib/supabase/types"

export const runtime = "nodejs"
export const maxDuration = 60

const DOCUMENTS_BUCKET = "vuei-documents"

type TripRow = Database["public"]["Tables"]["trips"]["Row"]
type DocumentRow = Database["public"]["Tables"]["documents"]["Row"]
type FlightRow = Database["public"]["Tables"]["trip_flights"]["Row"]
type HotelRow = Database["public"]["Tables"]["trip_hotels"]["Row"]
type ItineraryRow = Database["public"]["Tables"]["trip_itineraries"]["Row"]

function asBoolean(value: FormDataEntryValue | string | null | undefined) {
  return value === "true" || value === "1" || value === true
}

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

async function resolveTripAdminAccess(params: {
  tripId?: string | null
  tripSlug?: string | null
  adminToken?: string | null
}) {
  const supabase = createSupabaseAdminClient()
  const accessResult = await resolveTripLinkAccess(supabase, {
    tripId: params.tripId,
    tripSlug: params.tripSlug,
    adminToken: params.adminToken,
    accessMode: "admin",
  })

  return {
    supabase,
    trip: accessResult.trip,
    error: accessResult.error,
  }
}

function getMissingAdminConfigResponse() {
  return NextResponse.json(
    { error: "A configura??o administrativa do servidor n?o ?sta dispon?vel no momento." },
    { status: 503 },
  )
}

async function uploadToStorage(supabase: ReturnType<typeof createSupabaseAdminClient>, file: File, path: string) {
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const contentType = resolveDocumentMimeType(file) || undefined
  const { data, error } = await supabase.storage.from(DOCUMENTS_BUCKET).upload(path, buffer, {
    cacheControl: "3600",
    upsert: true,
    contentType,
  })

  if (error) {
    throw new Error(error.message)
  }

  return data.path
}

async function deleteStoragePath(supabase: ReturnType<typeof createSupabaseAdminClient>, path?: string | null) {
  if (!path) return
  const { error } = await supabase.storage.from(DOCUMENTS_BUCKET).remove([path])
  if (error) {
    throw new Error(error.message)
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!hasSupabaseAdminEnv()) {
      console.error("[TRIP ADMIN] missing admin env", {
        hasPublicSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL),
        hasServiceRoleKey: Boolean(
          process.env.SUPABASE_SERVICE_ROLE_KEY ||
          process.env.SUPABASE_SERVICE_KEY ||
          process.env.SUPABASE_SECRET_KEY,
        ),
      })
      return getMissingAdminConfigResponse()
    }

    const url = new URL(request.url)
    const tripId = url.searchParams.get("tripId")
    const tripSlug = url.searchParams.get("tripSlug")
    const adminToken = url.searchParams.get("adminToken")

    const { supabase, trip, error } = await resolveTripAdminAccess({ tripId, tripSlug, adminToken })
    if (error || !trip) {
      return NextResponse.json({ error: error ?? "Acesso administrativo inv?lido." }, { status: 403 })
    }

    const [documentsResult, flightsResult, hotelsResult, itinerariesResult] = await Promise.all([
      supabase.from("documents").select("*").eq("trip_id", trip.id).order("created_at", { ascending: false }),
      supabase.from("trip_flights").select("*").eq("trip_id", trip.id).order("departure_at", { ascending: true, nullsFirst: false }).order("created_at", { ascending: true }),
      supabase.from("trip_hotels").select("*").eq("trip_id", trip.id).order("created_at", { ascending: true }),
      supabase.from("trip_itineraries").select("*").eq("trip_id", trip.id).order("created_at", { ascending: false }),
    ])

    const firstError =
      documentsResult.error?.message ||
      flightsResult.error?.message ||
      hotelsResult.error?.message ||
      itinerariesResult.error?.message

    if (firstError) {
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    return NextResponse.json({
      documents: (documentsResult.data ?? []).map((row) => mapDocumentRow(row as DocumentRow)),
      flights: (flightsResult.data ?? []).map((row) => mapFlightRow(row as FlightRow)),
      hotels: (hotelsResult.data ?? []).map((row) => mapHotelRow(row as HotelRow)),
      itineraries: (itinerariesResult.data ?? []).map((row) => mapItineraryRow(row as ItineraryRow)),
    })
  } catch (error) {
    if (isMissingSupabaseAdminEnvError(error)) {
      console.error("[TRIP ADMIN] get error", error)
      return getMissingAdminConfigResponse()
    }

    const message = error instanceof Error ? error.message : "N?o foi poss?vel carregar os dados administrativos da viagem."
    console.error("[TRIP ADMIN] get error", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!hasSupabaseAdminEnv()) {
      console.error("[TRIP ADMIN] missing admin env", {
        hasPublicSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL),
        hasServiceRoleKey: Boolean(
          process.env.SUPABASE_SERVICE_ROLE_KEY ||
          process.env.SUPABASE_SERVICE_KEY ||
          process.env.SUPABASE_SECRET_KEY,
        ),
      })
      return getMissingAdminConfigResponse()
    }

    const contentType = request.headers.get("content-type") ?? ""

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      const action = String(formData.get("action") ?? "")
      const tripId = String(formData.get("tripId") ?? "")
      const tripSlug = String(formData.get("tripSlug") ?? "")
      const adminToken = String(formData.get("adminToken") ?? "")
      const file = formData.get("file")

      const { supabase, trip, error } = await resolveTripAdminAccess({ tripId, tripSlug, adminToken })
      if (error || !trip) {
        return NextResponse.json({ error: error ?? "Acesso administrativo inv?lido." }, { status: 403 })
      }

      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Arquivo obrigatorio para esta a??o." }, { status: 400 })
      }

      const resolvedMimeType = resolveDocumentMimeType(file) || null

      if (action === "uploadDocument") {
        const normalizedName = file.name.replace(/\s+/g, "-")
        const path = `${trip.owner_user_id ?? trip.agency_id ?? "trip"}/${trip.id}/documents/${Date.now()}-${normalizedName}`
        const storedPath = await uploadToStorage(supabase, file, path)
        const insertPayload: Database["public"]["Tables"]["documents"]["Insert"] = {
          trip_id: trip.id,
          client_id: null,
          agency_id: trip.agency_id,
          owner_user_id: trip.owner_user_id,
          name: String(formData.get("name") ?? file.name.replace(/\.[^.]+$/, "")),
          type: String(formData.get("type") ?? "other"),
          file_path: storedPath,
          file_url: null,
          mime_type: resolvedMimeType,
          size_bytes: file.size ?? null,
          is_private: asBoolean(formData.get("isPrivate")),
          visibility: (String(formData.get("visibility") ?? "private") as Database["public"]["Tables"]["documents"]["Insert"]["visibility"]),
          ai_extracted_data: {},
        }

        const { data, error: insertError } = await supabase.from("documents").insert(insertPayload).select("*").single()
        if (insertError) {
          return NextResponse.json({ error: insertError.message }, { status: 400 })
        }

        return NextResponse.json({ document: mapDocumentRow(data as DocumentRow) })
      }

      if (action === "uploadTicket") {
        const normalizedName = file.name.replace(/\s+/g, "-")
        const path = `${trip.owner_user_id ?? trip.agency_id ?? "trip"}/${trip.id}/tickets/${Date.now()}-${normalizedName}`
        const storedPath = await uploadToStorage(supabase, file, path)

        const { data: documentData, error: documentError } = await supabase
          .from("documents")
          .insert({
            trip_id: trip.id,
            client_id: null,
            agency_id: trip.agency_id,
            owner_user_id: trip.owner_user_id,
            name: String(formData.get("name") ?? file.name.replace(/\.[^.]+$/, "")),
            type: "ticket",
            file_path: storedPath,
            file_url: null,
            mime_type: resolvedMimeType,
            size_bytes: file.size ?? null,
            is_private: false,
            visibility: "public_trip",
            ai_extracted_data: {},
          })
          .select("*")
          .single()

        if (documentError) {
          return NextResponse.json({ error: documentError.message }, { status: 400 })
        }

        const { data: flightData, error: flightError } = await supabase
          .from("trip_flights")
          .insert({
            trip_id: trip.id,
            document_id: documentData.id,
            extracted_data: {},
            extraction_status: "pending",
          })
          .select("*")
          .single()

        if (flightError) {
          return NextResponse.json({ error: flightError.message }, { status: 400 })
        }

        return NextResponse.json({
          document: mapDocumentRow(documentData as DocumentRow),
          flight: mapFlightRow(flightData as FlightRow),
        })
      }

      if (action === "uploadItineraryDocument") {
        const normalizedName = file.name.replace(/\s+/g, "-")
        const path = `${trip.owner_user_id ?? trip.agency_id ?? "trip"}/${trip.id}/itineraries/${Date.now()}-${normalizedName}`
        const storedPath = await uploadToStorage(supabase, file, path)

        const title = String(formData.get("title") ?? file.name.replace(/\.[^.]+$/, ""))
        const { data: documentData, error: documentError } = await supabase
          .from("documents")
          .insert({
            trip_id: trip.id,
            client_id: null,
            agency_id: trip.agency_id,
            owner_user_id: trip.owner_user_id,
            name: title,
            type: "itinerary",
            file_path: storedPath,
            file_url: null,
            mime_type: resolvedMimeType,
            size_bytes: file.size ?? null,
            is_private: false,
            visibility: "public_trip",
            ai_extracted_data: {
              source: "manual_itinerary_upload",
              ai_used: false,
            },
          })
          .select("*")
          .single()

        if (documentError) {
          return NextResponse.json({ error: documentError.message }, { status: 400 })
        }

        const { data: itineraryData, error: itineraryError } = await supabase
          .from("trip_itineraries")
          .insert({
            trip_id: trip.id,
            document_id: documentData.id,
            title,
            mode: "uploaded",
            status: "uploaded",
            content: { days: [] },
            pdf_url: documentData.file_path,
            created_by: trip.owner_user_id,
          })
          .select("*")
          .single()

        if (itineraryError) {
          return NextResponse.json({ error: itineraryError.message }, { status: 400 })
        }

        return NextResponse.json({
          document: mapDocumentRow(documentData as DocumentRow),
          itinerary: mapItineraryRow(itineraryData as ItineraryRow),
        })
      }

      return NextResponse.json({ error: "Acao administrativa invalida." }, { status: 400 })
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const action = typeof body?.action === "string" ? body.action : ""
    const tripId = typeof body?.tripId === "string" ? body.tripId : ""
    const tripSlug = typeof body?.tripSlug === "string" ? body.tripSlug : ""
    const adminToken = typeof body?.adminToken === "string" ? body.adminToken : ""

    const { supabase, trip, error } = await resolveTripAdminAccess({ tripId, tripSlug, adminToken })
    if (error || !trip) {
      return NextResponse.json({ error: error ?? "Acesso administrativo inv?lido." }, { status: 403 })
    }

    if (action === "saveHotel") {
      const hotelId = typeof body?.hotelId === "string" ? body.hotelId : null
      const payload = {
        trip_id: trip.id,
        document_id: typeof body?.documentId === "string" ? body.documentId : undefined,
        name: typeof body?.name === "string" ? body.name : "",
        address: typeof body?.address === "string" ? body.address : null,
        check_in: typeof body?.checkIn === "string" ? body.checkIn : null,
        check_out: typeof body?.checkOut === "string" ? body.checkOut : null,
        confirmation_code: typeof body?.confirmationCode === "string" ? body.confirmationCode : null,
        notes: typeof body?.notes === "string" ? body.notes : null,
      }

      const result = hotelId
        ? await supabase.from("trip_hotels").update(payload).eq("id", hotelId).select("*").single()
        : await supabase.from("trip_hotels").insert(payload).select("*").single()

      if (result.error) {
        return NextResponse.json({ error: result.error.message }, { status: 400 })
      }

      return NextResponse.json({ hotel: mapHotelRow(result.data as HotelRow) })
    }

    if (action === "deleteHotel") {
      const hotelId = typeof body?.hotelId === "string" ? body.hotelId : ""
      const { error: deleteError } = await supabase.from("trip_hotels").delete().eq("id", hotelId)
      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 400 })
      }

      return NextResponse.json({ success: true })
    }

    if (action === "saveSimpleItinerary") {
      const itineraryId = typeof body?.itineraryId === "string" ? body.itineraryId : null
      const payload = {
        trip_id: trip.id,
        title: typeof body?.title === "string" ? body.title : `Roteiro simples - ${trip.destination || "Viagem"}`,
        mode: "simple" as const,
        status: "completed" as const,
        content: (body?.content as Record<string, unknown>) ?? { days: [] },
        created_by: trip.owner_user_id,
      }

      const result = itineraryId
        ? await supabase.from("trip_itineraries").update(payload).eq("id", itineraryId).select("*").single()
        : await supabase.from("trip_itineraries").insert(payload).select("*").single()

      if (result.error) {
        return NextResponse.json({ error: result.error.message }, { status: 400 })
      }

      return NextResponse.json({ itinerary: mapItineraryRow(result.data as ItineraryRow) })
    }

    if (action === "deleteItinerary") {
      const itineraryId = typeof body?.itineraryId === "string" ? body.itineraryId : ""
      const linkedDocumentId = typeof body?.documentId === "string" ? body.documentId : null
      const linkedDocumentPath = typeof body?.documentPath === "string" ? body.documentPath : null

      if (linkedDocumentPath) {
        await deleteStoragePath(supabase, linkedDocumentPath)
      }

      const { error: itineraryError } = await supabase.from("trip_itineraries").delete().eq("id", itineraryId)
      if (itineraryError) {
        return NextResponse.json({ error: itineraryError.message }, { status: 400 })
      }

      if (linkedDocumentId) {
        const { error: documentError } = await supabase.from("documents").delete().eq("id", linkedDocumentId)
        if (documentError) {
          return NextResponse.json({ error: documentError.message }, { status: 400 })
        }
      }

      return NextResponse.json({ success: true })
    }

    if (action === "upsertFlight") {
      const flightId = typeof body?.flightId === "string" ? body.flightId : null
      const payload = {
        trip_id: trip.id,
        document_id: typeof body?.documentId === "string" ? body.documentId : null,
        airline: typeof body?.airline === "string" ? body.airline : null,
        flight_number: typeof body?.flightNumber === "string" ? body.flightNumber : null,
        booking_reference: typeof body?.bookingReference === "string" ? body.bookingReference : null,
        origin_airport: typeof body?.originAirport === "string" ? body.originAirport : null,
        destination_airport: typeof body?.destinationAirport === "string" ? body.destinationAirport : null,
        departure_at: typeof body?.departureAt === "string" ? body.departureAt : null,
        arrival_at: typeof body?.arrivalAt === "string" ? body.arrivalAt : null,
        passenger_name: typeof body?.passengerName === "string" ? body.passengerName : null,
        qr_code_payload: typeof body?.qrCodePayload === "string" ? body.qrCodePayload : null,
        baggage_info: typeof body?.baggageInfo === "string" ? body.baggageInfo : null,
        terminal: typeof body?.terminal === "string" ? body.terminal : null,
        gate: typeof body?.gate === "string" ? body.gate : null,
        seat: typeof body?.seat === "string" ? body.seat : null,
        extracted_data: (body?.extractedData as Record<string, unknown>) ?? {},
        extraction_status: typeof body?.extractionStatus === "string" ? body.extractionStatus : "manual",
      }

      const result = flightId
        ? await supabase.from("trip_flights").update(payload).eq("id", flightId).select("*").single()
        : await supabase.from("trip_flights").insert(payload).select("*").single()

      if (result.error) {
        return NextResponse.json({ error: result.error.message }, { status: 400 })
      }

      return NextResponse.json({ flight: mapFlightRow(result.data as FlightRow) })
    }

    if (action === "deleteFlight") {
      const flightId = typeof body?.flightId === "string" ? body.flightId : ""
      const documentId = typeof body?.documentId === "string" ? body.documentId : null
      const documentPath = typeof body?.documentPath === "string" ? body.documentPath : null

      if (documentPath) {
        await deleteStoragePath(supabase, documentPath)
      }

      const { error: flightError } = await supabase.from("trip_flights").delete().eq("id", flightId)
      if (flightError) {
        return NextResponse.json({ error: flightError.message }, { status: 400 })
      }

      if (documentId) {
        const { error: documentError } = await supabase.from("documents").delete().eq("id", documentId)
        if (documentError) {
          return NextResponse.json({ error: documentError.message }, { status: 400 })
        }
      }

      return NextResponse.json({ success: true })
    }

    if (action === "deleteDocument") {
      const documentId = typeof body?.documentId === "string" ? body.documentId : ""
      const documentPath = typeof body?.documentPath === "string" ? body.documentPath : null
      const linkedFlightId = typeof body?.linkedFlightId === "string" ? body.linkedFlightId : null

      if (documentPath) {
        await deleteStoragePath(supabase, documentPath)
      }

      if (linkedFlightId) {
        const { error: flightError } = await supabase.from("trip_flights").delete().eq("id", linkedFlightId)
        if (flightError) {
          return NextResponse.json({ error: flightError.message }, { status: 400 })
        }
      }

      const { error: documentError } = await supabase.from("documents").delete().eq("id", documentId)
      if (documentError) {
        return NextResponse.json({ error: documentError.message }, { status: 400 })
      }

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Acao administrativa invalida." }, { status: 400 })
  } catch (error) {
    if (isMissingSupabaseAdminEnvError(error)) {
      console.error("[TRIP ADMIN] post error", error)
      return getMissingAdminConfigResponse()
    }

    const message = error instanceof Error ? error.message : "N?o foi poss?vel concluir esta a??o administrativa."
    console.error("[TRIP ADMIN] post error", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
