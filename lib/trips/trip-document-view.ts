export type TripDocumentLike = {
  id?: string | null
  type?: string | null
  visibility?: string | null
  private?: boolean | null
  isPrivate?: boolean | null
  is_private?: boolean | null
}

export function getTripDocuments<T extends TripDocumentLike = TripDocumentLike>(tripData: { documents?: unknown } | null | undefined) {
  return Array.isArray(tripData?.documents) ? (tripData.documents as T[]) : []
}

export function isPrivateTripDocument(document: TripDocumentLike) {
  return (
    document.private === true ||
    document.isPrivate === true ||
    document.is_private === true ||
    document.visibility === "private" ||
    document.visibility === "agency_only"
  )
}

export function getPublicTripDocuments<T extends TripDocumentLike>(documents: T[]) {
  return documents.filter((document) => !isPrivateTripDocument(document))
}

export function getContentTripDocuments<T extends TripDocumentLike>(documents: T[]) {
  return documents.filter((document) => document.type !== "itinerary")
}

export function getTicketTripDocuments<T extends TripDocumentLike>(documents: T[]) {
  return documents.filter((document) => document.type === "ticket")
}

export function findTripDocument<T extends TripDocumentLike>(documents: T[], documentId?: string | null) {
  if (!documentId) return null
  return documents.find((document) => document.id === documentId) ?? null
}

export function getTripDocumentCounts(documents: TripDocumentLike[]) {
  const contentDocuments = getContentTripDocuments(documents)

  return {
    total: documents.length,
    content: contentDocuments.length,
    public: getPublicTripDocuments(contentDocuments).length,
    private: contentDocuments.filter(isPrivateTripDocument).length,
    tickets: getTicketTripDocuments(contentDocuments).length,
    itineraries: documents.filter((document) => document.type === "itinerary").length,
  }
}

export function buildTripDocumentAccessHref(params: {
  tripId: string
  tripSlug: string
  accessMode: "admin" | "public"
  documentId?: string | null
  itineraryId?: string | null
  adminToken?: string | null
  publicToken?: string | null
  disposition?: "inline" | "download"
}) {
  const searchParams = new URLSearchParams({
    tripId: params.tripId,
    tripSlug: params.tripSlug,
    accessMode: params.accessMode,
    disposition: params.disposition ?? "inline",
  })

  if (params.documentId) searchParams.set("documentId", params.documentId)
  if (params.itineraryId) searchParams.set("itineraryId", params.itineraryId)
  if (params.adminToken) searchParams.set("adminToken", params.adminToken)
  if (params.publicToken) searchParams.set("publicToken", params.publicToken)

  return `/api/trip-documents?${searchParams.toString()}`
}

export function buildTripSectionsAccessHref(params: {
  tripId: string
  tripSlug: string
  accessMode: "admin" | "public"
  adminToken?: string | null
  publicToken?: string | null
}) {
  const searchParams = new URLSearchParams({
    tripId: params.tripId,
    tripSlug: params.tripSlug,
    accessMode: params.accessMode,
  })

  if (params.adminToken) searchParams.set("adminToken", params.adminToken)
  if (params.publicToken) searchParams.set("publicToken", params.publicToken)

  return `/api/trip-sections?${searchParams.toString()}`
}
