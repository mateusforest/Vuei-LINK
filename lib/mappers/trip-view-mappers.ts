import type { Trip, TripAdminView, TripDocument, TripPublicView } from "@/types"

export type TripPublicSection = "itinerary" | "accommodations" | "flights" | "documents" | "concierge"

export function filterPrivateDocuments(documents: TripDocument[]) {
  return documents.filter((document) => document.visibility === "public_trip" && !document.isPrivate)
}

export function canPublicViewSection(trip: Trip, section: TripPublicSection) {
  switch (section) {
    case "itinerary":
      return trip.permissions.publicCanViewItinerary
    case "accommodations":
      return trip.permissions.publicCanViewAccommodation
    case "flights":
      return trip.permissions.publicCanViewFlights
    case "documents":
      return trip.permissions.publicCanViewPublicDocuments
    case "concierge":
      return trip.permissions.publicCanUseConcierge
    default:
      return false
  }
}

export function mapTripToPublicView(trip: Trip): TripPublicView {
  return {
    id: trip.id,
    slug: trip.slug,
    title: trip.title,
    destination: trip.destination,
    city: trip.city,
    country: trip.country,
    startDate: trip.startDate,
    endDate: trip.endDate,
    status: trip.status,
    coverImage: trip.coverImage,
    visibility: trip.visibility,
    linkActivatedAt: trip.linkActivatedAt,
    linkAccessUntil: trip.linkAccessUntil,
    travelers: trip.travelers.map((traveler) => ({
      id: traveler.id,
      name: traveler.name,
      isPrimary: traveler.isPrimary,
    })),
    itinerary: canPublicViewSection(trip, "itinerary") ? trip.itinerary : [],
    accommodations: canPublicViewSection(trip, "accommodations") ? trip.accommodations : [],
    flights: canPublicViewSection(trip, "flights") ? trip.flights : [],
    documents: canPublicViewSection(trip, "documents") ? filterPrivateDocuments(trip.documents) : [],
    quickInfo: null,
    sharing: {
      publicLink: trip.publicLink,
    },
  }
}

export function mapTripToAdminView(trip: Trip): TripAdminView {
  return {
    ...trip,
    sharing: {
      adminLink: trip.adminLink,
      publicLink: trip.publicLink,
    },
  }
}
