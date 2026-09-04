"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import type { CreditBalance, CreditTransaction, Trip as CanonicalTrip, TripStatus } from "@/types"
import { useAuth } from "@/contexts/auth-context"
import { createTrip as createTripInRepository, deleteTrip as deleteTripInRepository, listTripsByUser } from "@/lib/repositories/trips-repository"
import { claimPendingTrip } from "@/lib/repositories/pending-trip-claim-repository"
import { shouldUseSupabase } from "@/lib/data-source"
import { withTimeout } from "@/lib/async/with-timeout"
import { clearPendingTrip, readPendingTrip, setPendingTripRedirectToShare, shouldRedirectPendingTripToShare } from "@/lib/pending-trip"
import {
  clearPendingTripClaimSession,
  readPendingTripClaimSessions,
  writeClaimedTripBagFocus,
} from "@/lib/pending-trip-claim"
import { buildAdminTripUrl, buildPublicTripUrl } from "@/lib/security/link-tokens"
import {
  buildUniqueTripSlug,
  extractTripsStoragePayload,
  mapStoredTripToTrip,
  slugifyTripBase,
  TRIP_STORAGE_SCHEMA_VERSION,
  type LegacyStoredTrip,
} from "@/lib/mappers/trip-mappers"
import {
  CREDITS_STORAGE_SCHEMA_VERSION,
  extractCreditsStoragePayload,
  mapCreditHistoryToTransactions,
  mapLegacyCreditsToCreditBalance,
  type LegacyCreditsState,
} from "@/lib/mappers/credit-mappers"
import { resolveTravelerPlan, resolveTravelerPlanFromBillingStatus, type TravelerPlanSnapshot } from "@/lib/billing/traveler-plans"
import { getTravelerBillingStatus } from "@/lib/repositories/traveler-billing-repository"
import { resolveTripHeroImage } from "@/lib/trip-destination"
import { listCreditTransactions } from "@/lib/repositories/credits-repository"
import { CREDIT_BALANCE_CHANGED_EVENT } from "@/lib/credits/credit-events"

export interface Trip extends Pick<CanonicalTrip, "id" | "slug" | "destination" | "country" | "city" | "startDate" | "endDate" | "coverImage" | "visibility" | "linkActivatedAt" | "linkAccessUntil" | "linkActivationTransactionId" | "createdAt"> {
  id: string
  slug: string
  name: string
  destination: string
  country: string
  city: string
  startDate: string
  endDate: string
  style: string
  companions: string
  passengersCount: number
  status: Extract<TripStatus, "draft" | "upcoming" | "ongoing" | "completed">
  coverImage: string
  adminLink: string
  shareLink: string
  createdAt: string
}

type NewTripInput = Omit<
  Trip,
  | "id"
  | "slug"
  | "adminLink"
  | "shareLink"
  | "createdAt"
  | "coverImage"
  | "visibility"
  | "linkActivatedAt"
  | "linkAccessUntil"
  | "linkActivationTransactionId"
> & {
  coverImage?: string | null
  visibility?: CanonicalTrip["visibility"]
}

interface TripsContextCredits {
  balance: number
  history: { action: string; amount: number; date: string; source: string }[]
  canonicalBalance?: CreditBalance
  canonicalTransactions?: CreditTransaction[]
}

interface TripsContextType {
  trips: Trip[]
  activeTrip: Trip | null
  activeTripsCount: number
  canCreateMoreTrips: boolean
  loadingTrips: boolean
  credits: TripsContextCredits
  subscription: TravelerPlanSnapshot
  addTrip: (trip: NewTripInput) => Trip
  syncTripFromBackend: (trip: CanonicalTrip) => Trip
  updateTrip: (id: string, data: Partial<Trip>) => void
  deleteTrip: (id: string) => Promise<{ success: boolean; error?: string | null }>
  setActiveTrip: (id: string | null) => void
  getTripBySlug: (slug: string) => Trip | undefined
  useCredits: (amount: number, source: string, action: string) => boolean
  addCredits: (amount: number) => void
}

interface PersistedTripsPayload {
  schemaVersion: number
  trips: Trip[]
}

interface PersistedCreditsPayload {
  schemaVersion: number
  credits: LegacyCreditsState
}

const TripsContext = createContext<TripsContextType | undefined>(undefined)

const destinationImages: Record<string, string> = {
  paris: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&q=80",
  france: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&q=80",
  lisboa: "https://images.unsplash.com/photo-1585208798174-6cedd86e019a?w=800&q=80",
  lisbon: "https://images.unsplash.com/photo-1585208798174-6cedd86e019a?w=800&q=80",
  portugal: "https://images.unsplash.com/photo-1585208798174-6cedd86e019a?w=800&q=80",
  tokyo: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80",
  japan: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80",
  japao: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80",
  "new york": "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=800&q=80",
  "nova york": "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=800&q=80",
  eua: "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=800&q=80",
  usa: "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=800&q=80",
  london: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800&q=80",
  londres: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800&q=80",
  england: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800&q=80",
  inglaterra: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800&q=80",
  rome: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800&q=80",
  roma: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800&q=80",
  italy: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800&q=80",
  italia: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800&q=80",
  barcelona: "https://images.unsplash.com/photo-1583422409516-2895a77efded?w=800&q=80",
  spain: "https://images.unsplash.com/photo-1583422409516-2895a77efded?w=800&q=80",
  espanha: "https://images.unsplash.com/photo-1583422409516-2895a77efded?w=800&q=80",
  dubai: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&q=80",
  "rio de janeiro": "https://images.unsplash.com/photo-1483729558449-99ef09a8c325?w=800&q=80",
  rio: "https://images.unsplash.com/photo-1483729558449-99ef09a8c325?w=800&q=80",
  brasil: "https://images.unsplash.com/photo-1483729558449-99ef09a8c325?w=800&q=80",
  brazil: "https://images.unsplash.com/photo-1483729558449-99ef09a8c325?w=800&q=80",
  amsterdam: "https://images.unsplash.com/photo-1534351590666-13e3e96b5017?w=800&q=80",
  berlin: "https://images.unsplash.com/photo-1560969184-10fe8719e047?w=800&q=80",
  berlim: "https://images.unsplash.com/photo-1560969184-10fe8719e047?w=800&q=80",
  germany: "https://images.unsplash.com/photo-1560969184-10fe8719e047?w=800&q=80",
  alemanha: "https://images.unsplash.com/photo-1560969184-10fe8719e047?w=800&q=80",
  sydney: "https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=800&q=80",
  australia: "https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=800&q=80",
  miami: "https://images.unsplash.com/photo-1514214246283-d427a95c5d2f?w=800&q=80",
  cancun: "https://images.unsplash.com/photo-1552074284-5e88ef1aef18?w=800&q=80",
  mexico: "https://images.unsplash.com/photo-1552074284-5e88ef1aef18?w=800&q=80",
  maldives: "https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=800&q=80",
  maldivas: "https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=800&q=80",
  default: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80",
}

function getImageForDestination(destination: string): string {
  const searchTerm = destination.toLowerCase()
  for (const [key, url] of Object.entries(destinationImages)) {
    if (searchTerm.includes(key)) {
      return url
    }
  }
  return destinationImages.default
}

function normalizeTripLinks(trips: Trip[]): Trip[] {
  const usedSlugs: string[] = []

  return trips.map((trip) => {
    const baseSlug = slugifyTripBase(trip.name, trip.destination)
    const slug = buildUniqueTripSlug(baseSlug, usedSlugs)
    usedSlugs.push(slug)

    return {
      ...trip,
      slug,
      adminLink: buildAdminTripUrl(slug),
      shareLink: buildPublicTripUrl(slug),
    }
  })
}

function parseDestination(destination: string): { city: string; country: string } {
  const parts = destination.split(",").map((part) => part.trim())
  if (parts.length >= 2) {
    return { city: parts[0], country: parts[parts.length - 1] }
  }
  return { city: destination, country: "" }
}

function getPassengersCount(companions: string): number {
  switch (companions) {
    case "sozinho":
      return 1
    case "casal":
      return 2
    case "familia":
      return 4
    case "amigos":
      return 6
    default:
      return 1
  }
}

function mapCanonicalTripToLegacyTrip(trip: CanonicalTrip, companions = "sozinho"): Trip {
  return {
    id: trip.id,
    slug: trip.slug,
    name: trip.title,
    destination: trip.destination,
    country: trip.country || "",
    city: trip.city || trip.destination,
    startDate: trip.startDate || "",
    endDate: trip.endDate || "",
    style: trip.style || "",
    companions,
    passengersCount: trip.travelersCount,
    status: trip.status === "draft" || trip.status === "ongoing" || trip.status === "completed" ? trip.status : "upcoming",
    coverImage: resolveTripHeroImage({
      coverImage: trip.coverImage,
      destination: trip.destination,
      city: trip.city,
      country: trip.country,
    }),
    adminLink: trip.adminLink,
    shareLink: trip.publicLink,
    visibility: trip.visibility,
    linkActivatedAt: trip.linkActivatedAt,
    linkAccessUntil: trip.linkAccessUntil,
    linkActivationTransactionId: trip.linkActivationTransactionId,
    createdAt: trip.createdAt,
  }
}

function buildCanonicalCredits(balance: number, history: TripsContextCredits["history"]) {
  return {
    canonicalBalance: mapLegacyCreditsToCreditBalance({ balance, history }, "profile", "local-traveler"),
    canonicalTransactions: mapCreditHistoryToTransactions(history, "profile", "local-traveler"),
  }
}

function inferCompanionsFromCount(count: number) {
  if (count <= 1) return "sozinho"
  if (count === 2) return "casal"
  if (count <= 4) return "familia"
  return "amigos"
}

const STORAGE_KEY = "vuei_trips"
const CREDITS_KEY = "vuei_credits"
const TRIPS_BOOT_TIMEOUT_MS = 10_000

function isActiveTripStatus(status: Trip["status"]) {
  return status === "draft" || status === "upcoming" || status === "ongoing"
}

export function TripsProvider({ children }: { children: ReactNode }) {
  // Mantemos a persistência local nesta fase para não alterar o fluxo aprovado.
  // A migracao gradual para trips-repository/credits-repository fica isolada fora deste contexto.
  const { user, profile, loading } = useAuth()
  const defaultCreditsHistory = [
    { action: "Bonus de boas-vindas", amount: 100, date: new Date().toISOString(), source: "Sistema" },
    { action: "Promocao de lancamento", amount: 50, date: new Date().toISOString(), source: "Sistema" },
  ]
  const [trips, setTrips] = useState<Trip[]>([])
  const [activeTrip, setActiveTripState] = useState<Trip | null>(null)
  const [credits, setCredits] = useState<TripsContextCredits>(() => ({
    balance: 150,
    history: defaultCreditsHistory,
    ...buildCanonicalCredits(150, defaultCreditsHistory),
  }))
  const [isLoaded, setIsLoaded] = useState(false)
  const [loadingTrips, setLoadingTrips] = useState(false)
  const [subscription, setSubscription] = useState<TravelerPlanSnapshot>(() => resolveTravelerPlan(profile))
  const activeTripsCount = trips.filter((trip) => isActiveTripStatus(trip.status)).length
  const canCreateMoreTrips = true

  useEffect(() => {
    if (typeof window === "undefined") return

    if (!shouldUseSupabase()) {
      const storedTripsPayload = extractTripsStoragePayload(window.localStorage.getItem(STORAGE_KEY))
      const normalizedTrips = normalizeTripLinks(
        storedTripsPayload.trips.map((storedTrip) => {
          const canonicalTrip = mapStoredTripToTrip({ ...storedTrip, ownerType: "traveler" })
          return mapCanonicalTripToLegacyTrip(canonicalTrip, storedTrip.companions || "sozinho")
        })
      )
      setTrips(normalizedTrips)
      if (normalizedTrips.length > 0) {
        setActiveTripState(normalizedTrips[0])
      }
    }

    const defaultCreditsState: LegacyCreditsState = {
      balance: 150,
      history: defaultCreditsHistory,
    }
    const storedCreditsPayload = extractCreditsStoragePayload(window.localStorage.getItem(CREDITS_KEY), defaultCreditsState)
    setCredits({
      balance: storedCreditsPayload.credits.balance,
      history: storedCreditsPayload.credits.history,
      ...buildCanonicalCredits(storedCreditsPayload.credits.balance, storedCreditsPayload.credits.history),
    })

    setIsLoaded(true)
  }, [])

  useEffect(() => {
    if (!isLoaded || typeof window === "undefined") return
    if (shouldUseSupabase()) return

    const payload: PersistedTripsPayload = {
      schemaVersion: TRIP_STORAGE_SCHEMA_VERSION,
      trips,
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  }, [trips, isLoaded])

  useEffect(() => {
    if (!isLoaded || typeof window === "undefined") return

    const payload: PersistedCreditsPayload = {
      schemaVersion: CREDITS_STORAGE_SCHEMA_VERSION,
      credits: {
        balance: credits.balance,
        history: credits.history,
      },
    }
    window.localStorage.setItem(CREDITS_KEY, JSON.stringify(payload))
  }, [credits, isLoaded])

  useEffect(() => {
    if (!isLoaded) return

    if (!shouldUseSupabase()) {
      setSubscription(resolveTravelerPlan(profile))
      return
    }

    if (!user) {
      setSubscription(resolveTravelerPlan(profile))
      return
    }

    let mounted = true

    const syncBillingStatus = async () => {
      const [statusResult, historyResult] = await Promise.all([
        getTravelerBillingStatus(),
        listCreditTransactions("profile", user.id),
      ])
      if (!mounted || statusResult.error || !statusResult.data) return
      const billingStatus = statusResult.data
      const nextHistory = historyResult.data?.map((transaction) => ({
        action: transaction.reason || transaction.type,
        amount: transaction.amount,
        date: transaction.createdAt,
        source: transaction.source || "Supabase",
      })) ?? []

      setSubscription(resolveTravelerPlanFromBillingStatus(billingStatus))
      setCredits({
        balance: billingStatus.totalAvailable,
        history: nextHistory,
        ...buildCanonicalCredits(billingStatus.totalAvailable, nextHistory),
      })
    }

    void syncBillingStatus()

    const handleWindowFocus = () => {
      void syncBillingStatus()
    }

    window.addEventListener("focus", handleWindowFocus)

    return () => {
      mounted = false
      window.removeEventListener("focus", handleWindowFocus)
    }
  }, [isLoaded, profile, user])

  useEffect(() => {
    if (!isLoaded || !user?.id || !shouldUseSupabase() || typeof window === "undefined") return

    let active = true

    const refreshCredits = async () => {
      const [statusResult, historyResult] = await Promise.all([
        getTravelerBillingStatus(),
        listCreditTransactions("profile", user.id),
      ])

      if (!active || statusResult.error || !statusResult.data) return

      const billingStatus = statusResult.data
      const nextHistory = historyResult.data?.map((transaction) => ({
        action: transaction.reason || transaction.type,
        amount: transaction.amount,
        date: transaction.createdAt,
        source: transaction.source || "Supabase",
      })) ?? []

      setSubscription(resolveTravelerPlanFromBillingStatus(billingStatus))
      setCredits({
        balance: billingStatus.totalAvailable,
        history: nextHistory,
        ...buildCanonicalCredits(billingStatus.totalAvailable, nextHistory),
      })
    }

    const handleCreditsChanged = () => {
      void refreshCredits()
    }

    window.addEventListener(CREDIT_BALANCE_CHANGED_EVENT, handleCreditsChanged as EventListener)
    return () => {
      active = false
      window.removeEventListener(CREDIT_BALANCE_CHANGED_EVENT, handleCreditsChanged as EventListener)
    }
  }, [isLoaded, user?.id])

  useEffect(() => {
    if (!isLoaded || loading || !shouldUseSupabase()) return

    if (!user) {
      setTrips([])
      setActiveTripState(null)
      setLoadingTrips(false)
      return
    }

    let mounted = true

    const syncRemoteTrips = async () => {
      console.log("[BOOT] started")
      console.log("[TRIPS] loading user trips", user.id)
      setLoadingTrips(true)

      try {
        const result = await withTimeout(
          listTripsByUser(user.id),
          TRIPS_BOOT_TIMEOUT_MS,
          "Trips bootstrap timeout.",
        )
        if (!mounted) return

        if (result.source !== "supabase") {
          return
        }

        if (result.error) {
          console.error("[TRIPS] load error", result.error)
          return
        }

        const remoteTrips = result.data.map((trip) =>
          mapCanonicalTripToLegacyTrip(trip, inferCompanionsFromCount(trip.travelersCount))
        )

        console.log("[TRIPS] loaded trips", remoteTrips.length)
        console.log("[BOOT] trips loaded", remoteTrips.length)
        setTrips(remoteTrips)
        setActiveTripState((current) => {
          if (current) {
            const matched = remoteTrips.find((trip) => trip.id === current.id || trip.slug === current.slug)
            if (matched) return matched
          }
          return remoteTrips[0] ?? null
        })

        const pendingClaimSessions = readPendingTripClaimSessions()
        let claimedTripToFocus: Trip | null = null

        for (const pendingClaimSession of pendingClaimSessions) {
          const claimResult = await claimPendingTrip(pendingClaimSession.claimToken)
          const isDefinitiveClaimError =
            claimResult.code === "claim_invalid" ||
            claimResult.code === "claim_expired" ||
            claimResult.code === "claim_already_claimed"

          if (claimResult.data) {
            const nextTrip = mapCanonicalTripToLegacyTrip(
              claimResult.data,
              inferCompanionsFromCount(claimResult.data.travelersCount),
            )

            setTrips((prev) => [nextTrip, ...prev.filter((trip) => trip.id !== nextTrip.id)])
            claimedTripToFocus ??= nextTrip
            clearPendingTripClaimSession(pendingClaimSession.tripId)
            continue
          }

          console.error("[TRIPS] pending claim error", claimResult.error)
          if (isDefinitiveClaimError) {
            clearPendingTripClaimSession(pendingClaimSession.tripId)
          }
        }

        if (claimedTripToFocus) {
          setActiveTripState(claimedTripToFocus)
          writeClaimedTripBagFocus(claimedTripToFocus.id)
        }

        const pendingTrip = readPendingTrip()
        if (!pendingTrip) return

        const pendingResult = await createTripInRepository({
          title: pendingTrip.title,
          destination: pendingTrip.destination,
          startDate: pendingTrip.startDate,
          endDate: pendingTrip.endDate,
          style: pendingTrip.style,
          travelersCount: pendingTrip.travelersCount,
          ownerType: "traveler",
          ownerUserId: user.id,
          status: "draft",
          visibility: "private",
          creditsSummary: { balance: null, used: null, total: null },
        })

        if (pendingResult.source === "supabase" && pendingResult.data) {
          const nextTrip = mapCanonicalTripToLegacyTrip(
            pendingResult.data,
            inferCompanionsFromCount(pendingResult.data.travelersCount)
          )
          const shouldReturnToPortal = shouldRedirectPendingTripToShare()

          setTrips((prev) => [nextTrip, ...prev.filter((trip) => trip.id !== nextTrip.id)])
          setActiveTripState(nextTrip)
          clearPendingTrip()
          setPendingTripRedirectToShare(false)
          console.log("[TRIPS] loaded trips", remoteTrips.length + 1)
          console.log("[BOOT] trips loaded", remoteTrips.length + 1)

          if (shouldReturnToPortal && typeof window !== "undefined") {
            window.location.replace("/portal")
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha ao carregar viagens."
        console.error("[TRIPS] load error", message)
      } finally {
        if (mounted) {
          setLoadingTrips(false)
          console.log("[BOOT] finished")
        }
      }
    }

    void syncRemoteTrips()

    return () => {
      mounted = false
    }
  }, [isLoaded, loading, user])

  const addTrip = useCallback((tripData: NewTripInput) => {
    const parsedDestination = parseDestination(tripData.destination)
    const city = tripData.city || parsedDestination.city
    const country = tripData.country || parsedDestination.country
    const baseSlug = slugifyTripBase(tripData.name, tripData.destination)
    const slug = buildUniqueTripSlug(baseSlug, trips.map((trip) => trip.slug))
    const id = `trip-${Date.now()}`

    const newTrip: Trip = {
      ...tripData,
      id,
      slug,
      city,
      country,
      passengersCount: getPassengersCount(tripData.companions),
      coverImage: resolveTripHeroImage({
        coverImage: tripData.coverImage,
        destination: tripData.destination,
        city: tripData.city,
        country: tripData.country,
      }),
      adminLink: buildAdminTripUrl(slug),
      shareLink: buildPublicTripUrl(slug),
      visibility: tripData.visibility ?? "private",
      linkActivatedAt: null,
      linkAccessUntil: null,
      linkActivationTransactionId: null,
      createdAt: new Date().toISOString(),
    }

    setTrips((prev) => [newTrip, ...prev])
    setActiveTripState(newTrip)

    return newTrip
  }, [trips])

  const syncTripFromBackend = useCallback((trip: CanonicalTrip) => {
    const legacyTrip = mapCanonicalTripToLegacyTrip(trip, inferCompanionsFromCount(trip.travelersCount))

    setTrips((prev) => {
      const remaining = prev.filter((item) => item.id !== legacyTrip.id && item.slug !== legacyTrip.slug)
      return [legacyTrip, ...remaining]
    })
    setActiveTripState(legacyTrip)

    return legacyTrip
  }, [])

  const updateTrip = useCallback((id: string, data: Partial<Trip>) => {
    setTrips((prev) => prev.map((trip) => (trip.id === id ? { ...trip, ...data } : trip)))
    if (activeTrip?.id === id) {
      setActiveTripState((prev) => (prev ? { ...prev, ...data } : null))
    }
  }, [activeTrip])

  const deleteTrip = useCallback(async (id: string) => {
    const previousTrips = trips
    const previousActiveTrip = activeTrip
    const nextTrips = previousTrips.filter((trip) => trip.id !== id)

    setTrips(nextTrips)
    if (previousActiveTrip?.id === id) {
      setActiveTripState(nextTrips[0] ?? null)
    }

    if (shouldUseSupabase()) {
      const result = await deleteTripInRepository(id)
      if (!result.success) {
        console.error("[TRIPS] delete error", result.error)
        setTrips(previousTrips)
        setActiveTripState(previousActiveTrip)
        return { success: false, error: result.error ?? "Não foi possível excluir a viagem." }
      }
    }

    return { success: true, error: null }
  }, [activeTrip, trips])

  const setActiveTrip = useCallback((id: string | null) => {
    if (id === null) {
      setActiveTripState(null)
      return
    }

    const trip = trips.find((item) => item.id === id)
    setActiveTripState(trip || null)
  }, [trips])

  const getTripBySlug = useCallback((slug: string) => trips.find((trip) => trip.slug === slug), [trips])

  const useCredits = useCallback((amount: number, source: string, action: string) => {
    if (credits.balance < amount) return false

    setCredits((prev) => {
      const history = [{ action, amount: -amount, date: new Date().toISOString(), source }, ...prev.history]
      const balance = prev.balance - amount

      return {
        balance,
        history,
        ...buildCanonicalCredits(balance, history),
      }
    })
    return true
  }, [credits.balance])

  const addCredits = useCallback((amount: number) => {
    setCredits((prev) => {
      const history = [{ action: "Compra de creditos", amount, date: new Date().toISOString(), source: "Compra" }, ...prev.history]
      const balance = prev.balance + amount

      return {
        balance,
        history,
        ...buildCanonicalCredits(balance, history),
      }
    })
  }, [])

  return (
    <TripsContext.Provider
      value={{
        trips,
        activeTrip,
        activeTripsCount,
        canCreateMoreTrips,
        loadingTrips,
        credits,
        subscription,
        addTrip,
        syncTripFromBackend,
        updateTrip,
        deleteTrip,
        setActiveTrip,
        getTripBySlug,
        useCredits,
        addCredits,
      }}
    >
      {children}
    </TripsContext.Provider>
  )
}

export function useTrips() {
  const context = useContext(TripsContext)
  if (context === undefined) {
    throw new Error("useTrips must be used within a TripsProvider")
  }
  return context
}
