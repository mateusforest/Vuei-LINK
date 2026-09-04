"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Archive, ArrowLeft, Calendar, FileText, Hotel, Loader2, LockKeyhole, MapPin, Plane, Route } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ImageWithFallback } from "@/components/system/image-with-fallback"
import { resolveTripHeroImage } from "@/lib/trip-destination"
import { buildTripDocumentAccessHref } from "@/lib/trips/trip-document-view"

type ArchiveData = {
  trip: {
    id: string
    slug: string
    title: string
    destination: string
    city: string | null
    country: string | null
    startDate: string | null
    endDate: string | null
    coverImage: string | null
    linkAccessUntil: string | null
  }
  documents: Array<{ id: string; name: string; type: string; mimeType: string | null; size: number | null; createdAt: string }>
  flights: Array<{ id: string; airline: string | null; flightNumber: string | null; originAirport: string | null; destinationAirport: string | null; departureAt: string | null; arrivalAt: string | null }>
  hotels: Array<{ id: string; name: string | null; address: string | null; checkIn: string | null; checkOut: string | null; confirmationCode: string | null }>
  itineraries: Array<{ id: string; title: string; mode: string; status: string; content: unknown; hasFile: boolean }>
  travelers: Array<{ id: string; name: string; isPrimary: boolean }>
}

function formatDate(value: string | null) {
  if (!value) return "Data nao informada"
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR")
}

export default function ArchivedTripPage() {
  const params = useParams<{ tripId: string }>()
  const tripId = params.tripId
  const [data, setData] = useState<ArchiveData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const load = async () => {
      const response = await fetch(`/api/trips/archive/${encodeURIComponent(tripId)}`, { cache: "no-store" })
      const body = await response.json().catch(() => null) as (ArchiveData & { error?: string }) | null
      if (!active) return
      if (!response.ok || !body?.trip) {
        setError(body?.error ?? "Nao foi possivel abrir esta viagem arquivada.")
      } else {
        setData(body)
      }
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [tripId])

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>
  }

  if (!data) {
    return (
      <Card className="mx-auto max-w-xl border-border/50 bg-card/60 p-8 text-center vuei-glass">
        <LockKeyhole className="mx-auto mb-4 text-amber-400" size={36} />
        <h1 className="text-2xl font-semibold">Arquivo protegido</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild variant="outline"><Link href="/portal/viagem">Voltar</Link></Button>
          <Button asChild><Link href="/portal/planos">Conhecer Vuei+</Link></Button>
        </div>
      </Card>
    )
  }

  const { trip } = data
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Button asChild variant="ghost" className="px-0 text-muted-foreground">
        <Link href="/portal/viagem"><ArrowLeft size={16} className="mr-2" />Viagens arquivadas</Link>
      </Button>

      <Card className="relative min-h-64 overflow-hidden border-border/50">
        <ImageWithFallback
          src={trip.coverImage}
          fallbackSrc={resolveTripHeroImage({ destination: trip.destination, city: trip.city, country: trip.country })}
          alt={trip.title}
          fill
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/10" />
        <div className="absolute inset-x-0 bottom-0 p-6 text-white">
          <Badge className="mb-3 border-white/20 bg-black/35 text-white"><Archive size={13} className="mr-1" />Arquivo Vuei+</Badge>
          <h1 className="text-3xl font-semibold">{trip.title}</h1>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-white/80">
            <span className="flex items-center gap-1"><MapPin size={14} />{trip.destination}</span>
            <span className="flex items-center gap-1"><Calendar size={14} />{formatDate(trip.startDate)} - {formatDate(trip.endDate)}</span>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <ArchiveSection icon={<Plane size={19} />} title="Passagens" empty="Nenhuma passagem preservada.">
          {data.flights.map((flight) => (
            <ArchiveRow key={flight.id} title={[flight.airline, flight.flightNumber].filter(Boolean).join(" ") || "Voo"} detail={`${flight.originAirport ?? "Origem"} → ${flight.destinationAirport ?? "Destino"}`} />
          ))}
        </ArchiveSection>

        <ArchiveSection icon={<Hotel size={19} />} title="Hospedagens" empty="Nenhuma hospedagem preservada.">
          {data.hotels.map((hotel) => <ArchiveRow key={hotel.id} title={hotel.name || "Hospedagem"} detail={hotel.address || `${formatDate(hotel.checkIn)} - ${formatDate(hotel.checkOut)}`} />)}
        </ArchiveSection>

        <ArchiveSection icon={<FileText size={19} />} title="Documentos" empty="Nenhum documento preservado.">
          {data.documents.map((document) => (
            <a key={document.id} href={buildTripDocumentAccessHref({ tripId: trip.id, tripSlug: trip.slug, accessMode: "admin", documentId: document.id })} className="block rounded-xl border border-border/40 bg-background/40 p-3 transition hover:border-primary/40">
              <p className="font-medium">{document.name}</p><p className="text-xs text-muted-foreground">{document.type}</p>
            </a>
          ))}
        </ArchiveSection>

        <ArchiveSection icon={<Route size={19} />} title="Roteiros" empty="Nenhum roteiro preservado.">
          {data.itineraries.map((itinerary) => itinerary.hasFile ? (
            <a key={itinerary.id} href={buildTripDocumentAccessHref({ tripId: trip.id, tripSlug: trip.slug, accessMode: "admin", itineraryId: itinerary.id })} className="block rounded-xl border border-border/40 bg-background/40 p-3 transition hover:border-primary/40">
              <p className="font-medium">{itinerary.title}</p><p className="text-xs text-muted-foreground">Abrir arquivo do roteiro</p>
            </a>
          ) : <ArchiveRow key={itinerary.id} title={itinerary.title} detail="Roteiro preservado sem arquivo" />)}
        </ArchiveSection>
      </div>
    </div>
  )
}

function ArchiveSection({ icon, title, empty, children }: { icon: React.ReactNode; title: string; empty: string; children: React.ReactNode }) {
  const hasContent = Array.isArray(children) ? children.length > 0 : Boolean(children)
  return (
    <Card className="border-border/50 bg-card/55 p-5 vuei-glass">
      <div className="mb-4 flex items-center gap-2 text-primary">{icon}<h2 className="text-lg font-semibold text-foreground">{title}</h2></div>
      <div className="space-y-2">{hasContent ? children : <p className="text-sm text-muted-foreground">{empty}</p>}</div>
    </Card>
  )
}

function ArchiveRow({ title, detail }: { title: string; detail: string }) {
  return <div className="rounded-xl border border-border/40 bg-background/40 p-3"><p className="font-medium">{title}</p><p className="text-xs text-muted-foreground">{detail}</p></div>
}
