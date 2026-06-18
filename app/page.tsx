import { Header } from "@/components/header"
import { LandingBannerSections } from "@/components/landing-banner-sections"

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f5f5f7] text-[#111827]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(93,224,230,0.12),transparent_24%),radial-gradient(circle_at_top_right,rgba(0,74,173,0.09),transparent_22%),linear-gradient(180deg,#fcfcfd_0%,#f5f5f7_48%,#f7f8fb_100%)]" />
      <Header />
      <LandingBannerSections />
    </main>
  )
}
