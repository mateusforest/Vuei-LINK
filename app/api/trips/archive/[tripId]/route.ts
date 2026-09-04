import { NextResponse } from "next/server"
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { resolveAuthenticatedTripAccess } from "@/lib/security/trip-authenticated-access"
import { resolveTripLinkLifecycle } from "@/lib/security/trip-link-lifecycle"
import type { Database } from "@/lib/supabase/types"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ tripId: string }> }
type DocumentRow = Database["public"]["Tables"]["documents"]["Row"]
type FlightRow = Database["public"]["Tables"]["trip_flights"]["Row"]
type HotelRow = Database["public"]["Tables"]["trip_hotels"]["Row"]
type ItineraryRow = Database["public"]["Tables"]["trip_itineraries"]["Row"]
type TravelerRow = Database["public"]["Tables"]["trip_travelers"]["Row"]

export async function GET(_: Request, { params }: RouteContext) {
  if (!hasSupabaseAdminEnv()) {
    return NextResponse.json({ error: "Arquivo de viagens indisponivel neste ambiente." }, { status: 503 })
  }

  const serverClient = await createSupabaseServerClient()
  if (!serverClient) {
    return NextResponse.json({ error: "Sessao indisponivel." }, { status: 503 })
  }

  const { data: { user }, error: authError } = await serverClient.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Entre para acessar seu arquivo de viagens." }, { status: 401 })
  }

  const { tripId } = await params
  const access = await resolveAuthenticatedTripAccess(serverClient, user.id, { tripId })
  if (!access.trip || access.trip.owner_type !== "traveler" || access.trip.owner_user_id !== user.id) {
    return NextResponse.json(
      { error: access.error ?? "Voce nao tem acesso a esta viagem arquivada.", code: "archive_access_denied" },
      { status: 403 },
    )
  }

  const lifecycle = resolveTripLinkLifecycle({
    ownerType: access.trip.owner_type,
    visibility: access.trip.visibility,
    status: access.trip.status,
    endDate: access.trip.end_date,
    linkActivatedAt: access.trip.link_activated_at,
    linkAccessUntil: access.trip.link_access_until,
  })
  if (lifecycle !== "ended") {
    return NextResponse.json({ error: "Esta viagem ainda nao faz parte do arquivo." }, { status: 409 })
  }

  const adminClient = createSupabaseAdminClient()
  const [documents, flights, hotels, itineraries, travelers] = await Promise.all([
    adminClient.from("documents").select("*").eq("trip_id", access.trip.id).order("created_at", { ascending: false }),
    adminClient.from("trip_flights").select("*").eq("trip_id", access.trip.id).order("departure_at", { ascending: true, nullsFirst: false }),
    adminClient.from("trip_hotels").select("*").eq("trip_id", access.trip.id).order("created_at", { ascending: true }),
    adminClient.from("trip_itineraries").select("*").eq("trip_id", access.trip.id).order("created_at", { ascending: false }),
    adminClient.from("trip_travelers").select("*").eq("trip_id", access.trip.id).order("is_primary", { ascending: false }),
  ])
  const error = documents.error || flights.error || hotels.error || itineraries.error || travelers.error
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    trip: {
      id: access.trip.id,
      slug: access.trip.slug,
      title: access.trip.title,
      destination: access.trip.destination,
      city: access.trip.city,
      country: access.trip.country,
      startDate: access.trip.start_date,
      endDate: access.trip.end_date,
      coverImage: access.trip.cover_image,
      linkAccessUntil: access.trip.link_access_until,
    },
    documents: ((documents.data ?? []) as DocumentRow[]).map((item) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      mimeType: item.mime_type,
      size: item.size_bytes,
      createdAt: item.created_at,
    })),
    flights: ((flights.data ?? []) as FlightRow[]).map((item) => ({
      id: item.id,
      airline: item.airline,
      flightNumber: item.flight_number,
      originAirport: item.origin_airport,
      destinationAirport: item.destination_airport,
      departureAt: item.departure_at,
      arrivalAt: item.arrival_at,
    })),
    hotels: ((hotels.data ?? []) as HotelRow[]).map((item) => ({
      id: item.id,
      name: item.hotel_name ?? item.name,
      address: item.address,
      checkIn: item.check_in,
      checkOut: item.check_out,
      confirmationCode: item.confirmation_number ?? item.confirmation_code,
    })),
    itineraries: ((itineraries.data ?? []) as ItineraryRow[]).map((item) => ({
      id: item.id,
      title: item.title,
      mode: item.mode,
      status: item.status,
      content: item.content,
      hasFile: Boolean(item.document_id || item.pdf_url),
    })),
    travelers: ((travelers.data ?? []) as TravelerRow[]).map((item) => ({
      id: item.id,
      name: item.name,
      isPrimary: item.is_primary,
    })),
  }, { headers: { "Cache-Control": "private, no-store" } })
}
