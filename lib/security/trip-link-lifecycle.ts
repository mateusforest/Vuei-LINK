export interface TripLinkLifecycleSnapshot {
  ownerType: "traveler" | "agency"
  visibility: "private" | "public"
  linkActivatedAt: string | null
  linkAccessUntil: string | null
}

export function isTripPublicLinkActive(snapshot: TripLinkLifecycleSnapshot) {
  if (snapshot.visibility !== "public") return false
  if (snapshot.ownerType === "agency") return true

  return Boolean(snapshot.linkActivatedAt)
}
