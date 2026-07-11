"use client"

import { useState } from "react"
import { Cta } from "@/components/landing-v2/cta"
import { Hero } from "@/components/landing-v2/hero"
import { LinkDetails } from "@/components/landing-v2/link-details"
import { LinkSteps } from "@/components/landing-v2/link-steps"
import { SharedLink } from "@/components/landing-v2/shared-link"
import { SiteFooter } from "@/components/landing-v2/site-footer"
import { SiteHeader } from "@/components/landing-v2/site-header"

export function PublicLanding() {
  const [destination, setDestination] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [ceremony, setCeremony] = useState(false)

  function openPreparation(nextDestination?: string) {
    if (typeof nextDestination === "string") {
      setDestination(nextDestination)
    }

    setSubmitted(true)
    requestAnimationFrame(() => {
      document.getElementById("preparar-viagem")?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }

  function openEmptyPreparation() {
    setDestination("")
    setStartDate("")
    setEndDate("")
    openPreparation("")
  }

  return (
    <main className="landing-shell min-h-screen w-full bg-background text-foreground">
      <SiteHeader onCreateTrip={openEmptyPreparation} />
      <Hero
        destination={destination}
        startDate={startDate}
        endDate={endDate}
        submitted={submitted}
        ceremony={ceremony}
        onDestinationChange={setDestination}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onCeremonyChange={setCeremony}
        onOpenPreparation={openPreparation}
      />
      <LinkSteps />
      <LinkDetails />
      <SharedLink />
      <Cta />
      <SiteFooter />
    </main>
  )
}
