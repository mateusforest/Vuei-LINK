import { NextResponse } from "next/server"
import { shouldUseSupabase } from "@/lib/data-source"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/types"
import { requestItineraryGeneration } from "@/lib/ai/itinerary-generation"
import { buildTripItineraryPdf } from "@/lib/ai/itinerary-pdf"
import { getCompleteItineraryCreditCost, getSimpleItineraryCreditCost, estimateCostUsd } from "@/lib/ai/credit-consumption"
import { createAiUsageLog } from "@/lib/ai/usage-logs"

type JsonObject = Record<string, unknown>
type TripRow = Database["public"]["Tables"]["trips"]["Row"]
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"]
type AgencyMemberRow = Database["public"]["Tables"]["agency_members"]["Row"]
type DocumentRow = Database["public"]["Tables"]["documents"]["Row"]
type HotelRow = Database["public"]["Tables"]["trip_hotels"]["Row"]
type FlightRow = Database["public"]["Tables"]["trip_flights"]["Row"]
type TripItineraryRow = Database["public"]["Tables"]["trip_itineraries"]["Row"]

interface GenerateItineraryRequestBody {
  tripId?: string
  mode?: "simple" | "complete_pdf"
}

async function getProfile(client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>, userId: string) {
  const { data, error } = await client
    .from("profiles")
    .select("id, role, agency_id, email, name")
    .eq("id", userId)
    .maybeSingle()

  return { data: (data as ProfileRow | null) ?? null, error: error?.message ?? null }
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
    return { trip: null as TripRow | null, membership: null as AgencyMemberRow | null, error: "Voce nao tem permissao para gerar roteiros desta viagem." }
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

  if (!membershipResult.data || !["owner", "admin", "member"].includes(membershipResult.data.role)) {
    return { trip: null as TripRow | null, membership: null as AgencyMemberRow | null, error: "Voce nao tem permissao para gerar roteiros desta viagem." }
  }

  return { trip, membership: membershipResult.data as AgencyMemberRow, error: null }
}

async function getCreditsBalance(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  ownerType: "traveler" | "agency",
  ownerId: string,
) {
  if (ownerType === "agency") {
    const { data, error } = await client.from("agencies").select("credits_balance").eq("id", ownerId).maybeSingle()
    return { balance: data?.credits_balance ?? 0, error: error?.message ?? null }
  }

  const { data, error } = await client.from("profiles").select("credits_balance").eq("id", ownerId).maybeSingle()
  return { balance: data?.credits_balance ?? 0, error: error?.message ?? null }
}

function buildTripContext(params: {
  trip: TripRow
  documents: DocumentRow[]
  hotels: HotelRow[]
  flights: FlightRow[]
}) {
  const { trip, documents, hotels, flights } = params
  const hotelsSummary = hotels.length
    ? hotels.map((hotel) => `${hotel.name ?? hotel.hotel_name ?? "Hospedagem"} (${hotel.check_in ?? "check-in nao informado"} -> ${hotel.check_out ?? "check-out nao informado"})`).join("; ")
    : "Nenhuma hospedagem adicionada."
  const flightsSummary = flights.length
    ? flights.map((flight) => `${flight.airline ?? "Companhia nao informada"} ${flight.flight_number ?? ""} ${flight.origin_airport ?? ""} -> ${flight.destination_airport ?? ""}`.trim()).join("; ")
    : "Nenhuma passagem adicionada."
  const documentsSummary = documents.length
    ? documents.map((document) => `${document.name} [${document.type}]${document.is_private ? " (privado)" : ""}`).join("; ")
    : "Nenhum documento adicional."

  return [
    `Viagem: ${trip.title}`,
    `Destino: ${trip.destination}${trip.city ? `, ${trip.city}` : ""}${trip.country ? `, ${trip.country}` : ""}`,
    `Periodo: ${trip.start_date ?? "nao informado"} ate ${trip.end_date ?? "nao informado"}`,
    `Status: ${trip.status}`,
    `Estilo: ${trip.style ?? "nao informado"}`,
    `Quantidade de viajantes: ${trip.travelers_count}`,
    `Hospedagens: ${hotelsSummary}`,
    `Passagens: ${flightsSummary}`,
    `Documentos: ${documentsSummary}`,
    "Quando faltar informacao critica, mantenha null ou trate como sugestao geral.",
  ].join("\n")
}

async function insertGeneratingItinerary(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  tripId: string,
  title: string,
  mode: "simple" | "complete_pdf",
  createdBy: string,
) {
  const { data, error } = await client
    .from("trip_itineraries")
    .insert({
      trip_id: tripId,
      title,
      mode,
      status: "generating",
      content: { days: [] },
      created_by: createdBy,
    })
    .select("*")
    .single()

  return { data: (data as TripItineraryRow | null) ?? null, error: error?.message ?? null }
}

async function updateItinerary(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  itineraryId: string,
  payload: Database["public"]["Tables"]["trip_itineraries"]["Update"],
) {
  const { data, error } = await client
    .from("trip_itineraries")
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itineraryId)
    .select("*")
    .single()

  return { data: (data as TripItineraryRow | null) ?? null, error: error?.message ?? null }
}

async function registerItineraryCreditConsumption(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  payload: {
    ownerType: "traveler" | "agency"
    ownerUserId: string | null
    agencyId: string | null
    amount: number
    tripId: string
    itineraryId: string
    mode: "simple" | "complete_pdf"
    createdBy: string
    failed?: boolean
  },
) {
  return client.from("credit_transactions").insert({
    owner_type: payload.ownerType,
    owner_user_id: payload.ownerType === "traveler" ? payload.ownerUserId : null,
    agency_id: payload.ownerType === "agency" ? payload.agencyId : null,
    type: "consume",
    amount: -payload.amount,
    reason: `Geracao de roteiro ${payload.mode === "simple" ? "simples" : "completo"} para a viagem`,
    source: payload.failed ? "ai_itinerary_generation_failed" : "ai_itinerary_generation",
    metadata: {
      module: "itinerary",
      trip_id: payload.tripId,
      itinerary_id: payload.itineraryId,
      mode: payload.mode,
      failed: payload.failed ?? false,
    },
    created_by: payload.createdBy,
  })
}

export async function POST(request: Request) {
  if (!shouldUseSupabase()) {
    return NextResponse.json({ error: "A geracao operacional real de roteiros so fica disponivel quando o Supabase estiver ativo." }, { status: 503 })
  }

  const body = (await request.json().catch(() => null)) as GenerateItineraryRequestBody | null
  const tripId = body?.tripId?.trim?.()
  const mode = body?.mode

  if (!tripId || (mode !== "simple" && mode !== "complete_pdf")) {
    return NextResponse.json({ error: "Trip e modo valido sao obrigatorios para gerar o roteiro." }, { status: 400 })
  }

  const supabase = await createSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json({ error: "Supabase server client indisponivel." }, { status: 503 })
  }

  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 401 })
  }
  if (!authData.user) {
    return NextResponse.json({ error: "Entre para gerar roteiros reais desta viagem." }, { status: 401 })
  }

  const profileResult = await getProfile(supabase, authData.user.id)
  if (!profileResult.data) {
    return NextResponse.json({ error: profileResult.error ?? "Perfil do usuario nao encontrado." }, { status: 403 })
  }

  const accessResult = await getAccessibleTrip(supabase, authData.user.id, tripId, profileResult.data)
  if (!accessResult.trip) {
    return NextResponse.json({ error: accessResult.error ?? "Viagem nao encontrada." }, { status: 403 })
  }

  const ownerType = accessResult.membership ? "agency" : "traveler"
  const ownerId = ownerType === "agency" ? accessResult.trip.agency_id : authData.user.id
  if (!ownerId) {
    return NextResponse.json({ error: "Nao foi possivel identificar o responsavel pelos creditos desta geracao." }, { status: 400 })
  }

  const creditCost = mode === "simple" ? getSimpleItineraryCreditCost() : getCompleteItineraryCreditCost()
  const balanceResult = await getCreditsBalance(supabase, ownerType, ownerId)
  if (balanceResult.error) {
    return NextResponse.json({ error: balanceResult.error }, { status: 500 })
  }
  if ((balanceResult.balance ?? 0) < creditCost) {
    return NextResponse.json({ error: "Saldo insuficiente para gerar este roteiro com IA." }, { status: 402 })
  }

  const generatingRecord = await insertGeneratingItinerary(
    supabase,
    accessResult.trip.id,
    mode === "simple" ? `Roteiro simples • ${accessResult.trip.title}` : `Roteiro completo • ${accessResult.trip.title}`,
    mode,
    authData.user.id,
  )

  if (!generatingRecord.data) {
    return NextResponse.json({ error: generatingRecord.error ?? "Nao foi possivel iniciar a geracao do roteiro." }, { status: 500 })
  }

  const [documentsResult, hotelsResult, flightsResult, agencyResult] = await Promise.all([
    supabase.from("documents").select("*").eq("trip_id", accessResult.trip.id).order("created_at", { ascending: false }),
    supabase.from("trip_hotels").select("*").eq("trip_id", accessResult.trip.id).order("created_at", { ascending: true }),
    supabase.from("trip_flights").select("*").eq("trip_id", accessResult.trip.id).order("departure_at", { ascending: true, nullsFirst: false }),
    accessResult.trip.agency_id ? supabase.from("agencies").select("id, name, branding, logo_url").eq("id", accessResult.trip.agency_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ])

  const context = buildTripContext({
    trip: accessResult.trip,
    documents: (documentsResult.data ?? []) as DocumentRow[],
    hotels: (hotelsResult.data ?? []) as HotelRow[],
    flights: (flightsResult.data ?? []) as FlightRow[],
  })

  const aiResult = await requestItineraryGeneration({
    mode,
    tripTitle: accessResult.trip.title,
    destination: accessResult.trip.destination,
    travelContext: context,
  })

  if (!aiResult.calledModel) {
    await updateItinerary(supabase, generatingRecord.data.id, {
      status: "failed",
      content: {
        days: [],
        error: aiResult.error,
      },
    })

    return NextResponse.json({ error: aiResult.error ?? "A IA nao foi chamada para gerar o roteiro." }, { status: 503 })
  }

  const usageMetadata: JsonObject = {
    source: "itinerary_generation",
    mode,
    raw_response: aiResult.rawText,
    structured_result: aiResult.data,
    travel_context: context,
    estimatedCostUsd: estimateCostUsd(aiResult.usage.inputTokens, aiResult.usage.outputTokens),
    processed_at: new Date().toISOString(),
  }

  if (!aiResult.ok || !aiResult.data) {
    await updateItinerary(supabase, generatingRecord.data.id, {
      status: "failed",
      content: {
        days: [],
        error: aiResult.error,
      },
    })

    await createAiUsageLog(supabase, {
      ownerUserId: ownerType === "traveler" ? authData.user.id : null,
      agencyId: accessResult.trip.agency_id,
      tripId: accessResult.trip.id,
      feature: "itinerary_generation",
      model: aiResult.model,
      inputTokens: aiResult.usage.inputTokens,
      outputTokens: aiResult.usage.outputTokens,
      totalTokens: aiResult.usage.totalTokens,
      creditAmount: creditCost,
      status: "failed",
      metadata: usageMetadata,
    })

    const failedCreditInsert = await registerItineraryCreditConsumption(supabase, {
      ownerType,
      ownerUserId: authData.user.id,
      agencyId: accessResult.trip.agency_id,
      amount: creditCost,
      tripId: accessResult.trip.id,
      itineraryId: generatingRecord.data.id,
      mode,
      createdBy: authData.user.id,
      failed: true,
    })

    if (failedCreditInsert.error) {
      console.error("[AI][ITINERARY] failed credit transaction error", failedCreditInsert.error.message)
    }

    return NextResponse.json({ error: aiResult.error ?? "Nao foi possivel gerar o roteiro." }, { status: 422 })
  }

  let document: DocumentRow | null = null
  let pdfPath: string | null = null

  if (mode === "complete_pdf") {
    const branding = (agencyResult.data?.branding ?? {}) as Record<string, unknown>
    const usefulInfo = [
      accessResult.trip.country ? `Pais: ${accessResult.trip.country}` : null,
      accessResult.trip.city ? `Cidade base: ${accessResult.trip.city}` : null,
      hotelsResult.data?.[0]?.name ? `Hospedagem principal: ${hotelsResult.data[0].name}` : null,
    ].filter((entry): entry is string => Boolean(entry))

    const pdfBytes = buildTripItineraryPdf({
      title: aiResult.data.title,
      destination: accessResult.trip.destination,
      country: accessResult.trip.country,
      startDate: accessResult.trip.start_date,
      endDate: accessResult.trip.end_date,
      travelersCount: accessResult.trip.travelers_count,
      travelersLabel: `${accessResult.trip.travelers_count} pessoa(s)`,
      tripSummary: aiResult.data.summary,
      usefulInfo,
      contacts: [],
      branding: {
        agencyName: agencyResult.data?.name ?? null,
        agencyLogoUrl:
          (typeof branding.logoUrl === "string" && branding.logoUrl) ||
          agencyResult.data?.logo_url ||
          null,
      },
      content: aiResult.data,
    })

    pdfPath = `${authData.user.id}/${accessResult.trip.id}/itineraries/${Date.now()}-roteiro-completo.pdf`
    const upload = await supabase.storage.from("vuei-documents").upload(pdfPath, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    })

    if (upload.error) {
      await updateItinerary(supabase, generatingRecord.data.id, {
        status: "failed",
        content: {
          ...aiResult.data,
          error: upload.error.message,
        },
      })

      await createAiUsageLog(supabase, {
        ownerUserId: ownerType === "traveler" ? authData.user.id : null,
        agencyId: accessResult.trip.agency_id,
        tripId: accessResult.trip.id,
        feature: "itinerary_generation",
        model: aiResult.model,
        inputTokens: aiResult.usage.inputTokens,
        outputTokens: aiResult.usage.outputTokens,
        totalTokens: aiResult.usage.totalTokens,
        creditAmount: creditCost,
        status: "failed",
        metadata: {
          ...usageMetadata,
          upload_error: upload.error.message,
        },
      })

      const failedCreditInsert = await registerItineraryCreditConsumption(supabase, {
        ownerType,
        ownerUserId: authData.user.id,
        agencyId: accessResult.trip.agency_id,
        amount: creditCost,
        tripId: accessResult.trip.id,
        itineraryId: generatingRecord.data.id,
        mode,
        createdBy: authData.user.id,
        failed: true,
      })

      if (failedCreditInsert.error) {
        console.error("[AI][ITINERARY] failed credit transaction error", failedCreditInsert.error.message)
      }

      return NextResponse.json({ error: upload.error.message }, { status: 500 })
    }

    const documentInsert = await supabase
      .from("documents")
      .insert({
        trip_id: accessResult.trip.id,
        agency_id: accessResult.trip.agency_id,
        owner_user_id: accessResult.trip.owner_user_id,
        name: `Roteiro completo • ${accessResult.trip.title}`,
        type: "itinerary",
        file_path: upload.data.path,
        mime_type: "application/pdf",
        size_bytes: pdfBytes.byteLength,
        is_private: false,
        visibility: "public_trip",
        ai_extracted_data: {
          source: "itinerary_generation",
          mode,
          generated: true,
        },
      })
      .select("*")
      .single()

    if (documentInsert.error || !documentInsert.data) {
      await updateItinerary(supabase, generatingRecord.data.id, {
        status: "failed",
        content: {
          ...aiResult.data,
          error: documentInsert.error?.message || "Nao foi possivel registrar o PDF do roteiro.",
        },
      })

      await createAiUsageLog(supabase, {
        ownerUserId: ownerType === "traveler" ? authData.user.id : null,
        agencyId: accessResult.trip.agency_id,
        tripId: accessResult.trip.id,
        feature: "itinerary_generation",
        model: aiResult.model,
        inputTokens: aiResult.usage.inputTokens,
        outputTokens: aiResult.usage.outputTokens,
        totalTokens: aiResult.usage.totalTokens,
        creditAmount: creditCost,
        status: "failed",
        metadata: {
          ...usageMetadata,
          document_error: documentInsert.error?.message || "Nao foi possivel registrar o PDF do roteiro.",
        },
      })

      const failedCreditInsert = await registerItineraryCreditConsumption(supabase, {
        ownerType,
        ownerUserId: authData.user.id,
        agencyId: accessResult.trip.agency_id,
        amount: creditCost,
        tripId: accessResult.trip.id,
        itineraryId: generatingRecord.data.id,
        mode,
        createdBy: authData.user.id,
        failed: true,
      })

      if (failedCreditInsert.error) {
        console.error("[AI][ITINERARY] failed credit transaction error", failedCreditInsert.error.message)
      }

      return NextResponse.json({ error: documentInsert.error?.message || "Nao foi possivel registrar o PDF do roteiro." }, { status: 500 })
    }

    document = documentInsert.data as DocumentRow
  }

  const itineraryUpdate = await updateItinerary(supabase, generatingRecord.data.id, {
    document_id: document?.id ?? null,
    title: aiResult.data.title,
    status: "completed",
    content: aiResult.data,
    pdf_url: pdfPath,
  })

  if (!itineraryUpdate.data) {
    await createAiUsageLog(supabase, {
      ownerUserId: ownerType === "traveler" ? authData.user.id : null,
      agencyId: accessResult.trip.agency_id,
      tripId: accessResult.trip.id,
      feature: "itinerary_generation",
      model: aiResult.model,
      inputTokens: aiResult.usage.inputTokens,
      outputTokens: aiResult.usage.outputTokens,
      totalTokens: aiResult.usage.totalTokens,
      creditAmount: creditCost,
      status: "failed",
      metadata: {
        ...usageMetadata,
        finalize_error: itineraryUpdate.error ?? "Nao foi possivel finalizar o roteiro gerado.",
      },
    })

    const failedCreditInsert = await registerItineraryCreditConsumption(supabase, {
      ownerType,
      ownerUserId: authData.user.id,
      agencyId: accessResult.trip.agency_id,
      amount: creditCost,
      tripId: accessResult.trip.id,
      itineraryId: generatingRecord.data.id,
      mode,
      createdBy: authData.user.id,
      failed: true,
    })

    if (failedCreditInsert.error) {
      console.error("[AI][ITINERARY] failed credit transaction error", failedCreditInsert.error.message)
    }

    return NextResponse.json({ error: itineraryUpdate.error ?? "Nao foi possivel finalizar o roteiro gerado." }, { status: 500 })
  }

  const usageInsert = await createAiUsageLog(supabase, {
    ownerUserId: ownerType === "traveler" ? authData.user.id : null,
    agencyId: accessResult.trip.agency_id,
    tripId: accessResult.trip.id,
    feature: "itinerary_generation",
    model: aiResult.model,
    inputTokens: aiResult.usage.inputTokens,
    outputTokens: aiResult.usage.outputTokens,
    totalTokens: aiResult.usage.totalTokens,
    creditAmount: creditCost,
    status: "completed",
    metadata: usageMetadata,
  })

  if (usageInsert.error) {
    console.error("[AI][ITINERARY] usage log error", usageInsert.error)
  }

  const creditInsert = await registerItineraryCreditConsumption(supabase, {
    ownerType,
    ownerUserId: authData.user.id,
    agencyId: accessResult.trip.agency_id,
    amount: creditCost,
    tripId: accessResult.trip.id,
    itineraryId: itineraryUpdate.data.id,
    mode,
    createdBy: authData.user.id,
  })

  if (creditInsert.error) {
    console.error("[AI][ITINERARY] credit transaction error", creditInsert.error.message)
  }

  return NextResponse.json({
    itinerary: itineraryUpdate.data,
    document,
  })
}
