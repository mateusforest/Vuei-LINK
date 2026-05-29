import { Header } from "@/components/header"
import { HeroSection } from "@/components/hero-section"
import { HowItWorksSection } from "@/components/how-it-works-section"
import { ConciergeSection } from "@/components/concierge-section"
import { PWASection } from "@/components/pwa-section"
import { Footer } from "@/components/footer"
import { PWAPopup } from "@/components/pwa-popup"

export default function Home() {
  return (
    <main className="relative min-h-screen bg-black overflow-hidden">
      <Header />
      <HeroSection />
      <HowItWorksSection />
      <ConciergeSection />
      <PWASection />
      <Footer />
      <PWAPopup />
    </main>
  )
}
