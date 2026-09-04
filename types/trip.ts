import type { ProfileQuickAccessSettings } from "./profile"

export type TripStatus = "draft" | "upcoming" | "ongoing" | "completed" | "cancelled"

export type TripOwnerType = "traveler" | "agency"

export type TripVisibility = "private" | "public"

export type TripActivationStatus = "activated" | "already_activated"

export interface TripActivationResult {
  status: TripActivationStatus
  tripId: string
  transactionId: string | null
  linkActivatedAt: string
  linkAccessUntil: string | null
  balance: number
}

export interface TripTraveler {
  id: string
  name: string
  role: "primary" | "companion" | "adult" | "child" | "guest"
  email: string | null
  phone: string | null
  avatarUrl: string | null
  isPrimary: boolean
}

export interface TripFlight {
  id: string
  segmentType: "outbound" | "return" | "internal"
  airline: string | null
  flightNumber: string | null
  originCode: string | null
  originCity: string | null
  originDateTime: string | null
  destinationCode: string | null
  destinationCity: string | null
  destinationDateTime: string | null
  terminal: string | null
  gate: string | null
  seat: string | null
  status: string | null
}

export interface TripAccommodation {
  id: string
  name: string
  address: string | null
  city: string | null
  country: string | null
  checkInDateTime: string | null
  checkOutDateTime: string | null
  roomType: string | null
  confirmationCode: string | null
  contactPhone: string | null
  imageUrl: string | null
}

export interface TripItineraryItem {
  id: string
  day: number
  title: string
  time: string | null
  type: "attraction" | "food" | "transport" | "hotel" | "experience" | "flight" | "other"
  notes: string | null
  highlight: boolean
}

export interface TripDocument {
  id: string
  name: string
  type: string
  fileUrl: string | null
  filePath: string | null
  mimeType: string | null
  size: number | null
  isPrivate: boolean
  visibility: "private" | "public_trip" | "agency_only"
  createdAt: string | null
  updatedAt: string | null
}

export interface TripPermissions {
  publicCanViewItinerary: boolean
  publicCanViewAccommodation: boolean
  publicCanViewFlights: boolean
  publicCanViewPublicDocuments: boolean
  publicCanUseConcierge: boolean
  tripPin?: ProfileQuickAccessSettings | null
}

export type TripPermissionSettings = TripPermissions

export interface TripCreditsSummary {
  balance: number | null
  used: number | null
  total: number | null
}

export interface Trip {
  id: string
  title: string
  slug: string
  destination: string
  country: string | null
  city: string | null
  startDate: string | null
  endDate: string | null
  status: TripStatus
  style: string | null
  ownerType: TripOwnerType
  ownerUserId: string | null
  agencyId: string | null
  clientId: string | null
  adminToken: string | null
  publicToken: string | null
  adminLink: string
  publicLink: string
  coverImage: string | null
  visibility: TripVisibility
  linkActivatedAt: string | null
  linkAccessUntil: string | null
  linkActivationTransactionId: string | null
  travelersCount: number
  travelers: TripTraveler[]
  flights: TripFlight[]
  accommodations: TripAccommodation[]
  itinerary: TripItineraryItem[]
  documents: TripDocument[]
  permissions: TripPermissions
  creditsSummary: TripCreditsSummary | null
  offlineEnabled: boolean
  createdAt: string
  updatedAt: string
}

export interface TripQuickInfo {
  currency?: string | null
  language?: string | null
  timezone?: string | null
  emergencyPhone?: string | null
}

export interface TripCardData {
  id: string
  slug: string
  title: string
  destination: string
  status: TripStatus
  coverImage: string | null
  adminLink: string
  publicLink: string
  startDate: string | null
  endDate: string | null
  visibility: TripVisibility
  linkActivatedAt: string | null
  linkAccessUntil: string | null
}

export interface TripLinkPageData {
  id: string
  slug: string
  title: string
  destination: string
  city: string | null
  country: string | null
  startDate: string | null
  endDate: string | null
  status: TripStatus
  coverImage: string | null
  travelersCount: number
  adminLink: string
  publicLink: string
  visibility: TripVisibility
  linkActivatedAt: string | null
  linkAccessUntil: string | null
}

export interface TripPublicView {
  id: string
  slug: string
  title: string
  destination: string
  city: string | null
  country: string | null
  startDate: string | null
  endDate: string | null
  status: TripStatus
  coverImage: string | null
  visibility: TripVisibility
  linkActivatedAt: string | null
  linkAccessUntil: string | null
  travelers: Array<Pick<TripTraveler, "id" | "name" | "isPrimary">>
  itinerary: TripItineraryItem[]
  accommodations: TripAccommodation[]
  flights: TripFlight[]
  documents: TripDocument[]
  quickInfo: TripQuickInfo | null
  sharing: {
    publicLink: string
  }
}

export interface TripAdminView extends Trip {
  sharing: {
    adminLink: string
    publicLink: string
  }
}
