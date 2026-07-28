import { TripsProvider } from "@/contexts/trips-context"
import { TripLanding } from "@/components/public-home/trip-landing"

export default function Home() {
  return (
    <TripsProvider>
      <TripLanding />
    </TripsProvider>
  )
}
