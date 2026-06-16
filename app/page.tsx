import { Header } from "@/components/header"
import { HeroSection } from "@/components/hero-section"
import { HowItWorksSection } from "@/components/how-it-works-section"
import { ConciergeSection } from "@/components/concierge-section"
import { PWASection } from "@/components/pwa-section"
import { Footer } from "@/components/footer"

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f5f5f7] text-[#111827]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[42rem] bg-[radial-gradient(circle_at_top_left,rgba(93,224,230,0.12),transparent_30%),radial-gradient(circle_at_top_right,rgba(0,74,173,0.08),transparent_28%),linear-gradient(180deg,#fcfcfd_0%,#f5f5f7_62%,#f5f5f7_100%)]" />
      <Header />
      <HeroSection />
      <HowItWorksSection />
      <ConciergeSection />
      <PWASection />
      <Footer />
    </main>
  )
}
