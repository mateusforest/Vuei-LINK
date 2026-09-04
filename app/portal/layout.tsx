"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import {
  Home,
  Plane,
  Coins,
  Share2,
  WifiOff,
  Settings,
  LifeBuoy,
  Plus,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  User,
  LogOut,
  Luggage,
} from "lucide-react"
import { useIsMobile } from "@/components/ui/use-mobile"
import { cn } from "@/lib/utils"
import { TripsProvider, useTrips } from "@/contexts/trips-context"
import { RouteGuard } from "@/components/auth/route-guard"
import { useAuth } from "@/contexts/auth-context"
import { CreateTripButton } from "@/components/portal/create-trip-button"
import { SupportFab } from "@/components/support/support-fab"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { QuickGuideModal } from "@/components/onboarding/quick-guide-modal"
import {
  getTravelerTripLinkStoreSummary,
  TRAVELER_TRIP_LINK_BALANCE_CHANGED_EVENT,
} from "@/lib/repositories/traveler-trip-link-repository"

const TRAVELER_QUICK_GUIDE_STORAGE_KEY = "vuei_traveler_quick_guide_seen_v1"

const navItems = [
  { href: "/portal", icon: Home, label: "Início" },
  { href: "/portal/viagem", icon: Plane, label: "Viagem" },
  { href: "/portal/suporte", icon: LifeBuoy, label: "Suporte" },
]

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <RouteGuard allowedRoles={["traveler"]}>
      <TripsProvider>
        <PortalLayoutInner>{children}</PortalLayoutInner>
      </TripsProvider>
    </RouteGuard>
  )
}

function PortalLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const isMobile = useIsMobile()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileHeaderOffset, setMobileHeaderOffset] = useState(132)
  const [quickGuideOpen, setQuickGuideOpen] = useState(false)
  const [tripLinkBalance, setTripLinkBalance] = useState<number | null>(null)
  const mobileHeaderRef = useRef<HTMLElement | null>(null)
  const { credits, subscription, trips, loadingTrips } = useTrips()
  const { profile, signOut } = useAuth()
  const firstName = profile?.name?.trim().split(" ")[0] ?? ""
  const initials = profile?.name
    ? profile.name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("")
    : "VP"

  const accountMenuItems = [
    { label: "Minha conta", href: "/portal/configuracoes", icon: User },
    { label: "Comprar viagens", href: "/portal/viagens/comprar", icon: Luggage },
    { label: "Créditos", href: "/portal/creditos", icon: Coins },
    { label: "Configurações", href: "/portal/configuracoes", icon: Settings },
    { label: "Offline", href: "/portal/offline", icon: WifiOff },
    { label: "Compartilhar", href: "/portal/compartilhar", icon: Share2 },
  ]
  const travelerPlanCredits = Math.max(subscription.definition.monthlyCredits, 1)
  const travelerCreditsProgress = Math.min((credits.balance / travelerPlanCredits) * 100, 100)
  const travelerCreditsActionHref = subscription.code === "free" ? "/portal/planos" : "/portal/creditos"
  const travelerCreditsActionLabel = subscription.code === "free" ? "Fazer upgrade" : "Comprar créditos"

  const handleSignOut = async () => {
    void signOut()
    router.replace("/login")
  }

  useEffect(() => {
    if (!isMobile) return

    const updateMobileHeaderOffset = () => {
      const nextHeight = mobileHeaderRef.current?.offsetHeight ?? 132
      setMobileHeaderOffset(nextHeight)
    }

    updateMobileHeaderOffset()

    const headerElement = mobileHeaderRef.current
    const resizeObserver =
      typeof ResizeObserver !== "undefined" && headerElement
        ? new ResizeObserver(() => updateMobileHeaderOffset())
        : null

    if (resizeObserver && headerElement) {
      resizeObserver.observe(headerElement)
    }

    window.addEventListener("resize", updateMobileHeaderOffset)
    window.addEventListener("orientationchange", updateMobileHeaderOffset)

    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener("resize", updateMobileHeaderOffset)
      window.removeEventListener("orientationchange", updateMobileHeaderOffset)
    }
  }, [isMobile])

  useEffect(() => {
    if (loadingTrips || typeof window === "undefined" || trips.length > 0) return
    if (window.localStorage.getItem(TRAVELER_QUICK_GUIDE_STORAGE_KEY) === "1") return

    window.localStorage.setItem(TRAVELER_QUICK_GUIDE_STORAGE_KEY, "1")
    setQuickGuideOpen(true)
  }, [loadingTrips, trips.length])

  useEffect(() => {
    let mounted = true

    const loadTripLinkBalance = async () => {
      const result = await getTravelerTripLinkStoreSummary()
      if (mounted && result.data) setTripLinkBalance(result.data.balance)
    }

    void loadTripLinkBalance()
    window.addEventListener(TRAVELER_TRIP_LINK_BALANCE_CHANGED_EVENT, loadTripLinkBalance)
    return () => {
      mounted = false
      window.removeEventListener(TRAVELER_TRIP_LINK_BALANCE_CHANGED_EVENT, loadTripLinkBalance)
    }
  }, [])

  return (
    <div className="portal-shell min-h-screen bg-background text-foreground">
      {!isMobile && (
        <motion.aside
          initial={false}
          animate={{ width: sidebarCollapsed ? 80 : 240 }}
          className="fixed left-0 top-0 z-40 h-full border-r border-border/60 vuei-glass"
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between p-6">
              <Link href="/portal" className="flex items-center gap-3">
                <Image
                  src="/vuei-logo.png"
                  alt="Vuei"
                  width={sidebarCollapsed ? 32 : 100}
                  height={32}
                  className="object-contain"
                />
              </Link>
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              >
                {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </button>
            </div>

            <nav className="flex-1 px-3 py-4">
              <div className="space-y-1">
                {navItems.map((item) => {
                  const isActive = pathname === item.href || (item.href !== "/portal" && pathname.startsWith(item.href))
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-3 transition-all duration-300",
                        isActive
                          ? "bg-gradient-to-r from-[#37beff]/14 to-[#0b56d8]/12 text-[#0b56d8] shadow-[inset_0_0_0_1px_rgba(11,86,216,0.08)]"
                          : "text-muted-foreground hover:bg-[#f8fafc] hover:text-foreground",
                      )}
                    >
                      <item.icon size={20} className={isActive ? "text-primary" : ""} />
                      <AnimatePresence>
                        {!sidebarCollapsed && (
                          <motion.span
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: "auto" }}
                            exit={{ opacity: 0, width: 0 }}
                            className="overflow-hidden whitespace-nowrap text-sm font-medium"
                          >
                            {item.label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </Link>
                  )
                })}
              </div>

              <div className="my-6 px-1">
                <CreateTripButton
                  className={cn(
                    "flex w-full items-center justify-center gap-2 rounded-xl py-3 font-semibold transition-all duration-300",
                    "bg-gradient-to-r from-[#37beff] to-[#0b56d8] text-white shadow-[0_18px_36px_rgba(11,86,216,0.18)] hover:opacity-95",
                    sidebarCollapsed ? "px-3" : "px-4",
                  )}
                >
                  <Plus size={20} />
                  {!sidebarCollapsed && <span>Nova Viagem</span>}
                </CreateTripButton>
              </div>
            </nav>

            <div className="space-y-3 px-4 pb-4">
              <div className={cn("rounded-2xl border border-border/60 bg-white/90 p-4 shadow-sm", sidebarCollapsed && "px-2 py-3")}>
                <div className={cn("flex items-start gap-3", sidebarCollapsed && "flex-col items-center gap-2 text-center")}>
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#37beff]/18 to-[#0b56d8]/14 text-[#0b56d8]">
                    <Coins size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    {!sidebarCollapsed && <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Créditos IA</p>}
                    <div className={cn("mt-1 flex items-end gap-2", sidebarCollapsed && "mt-0 flex-col items-center gap-1")}>
                      <span className="text-2xl font-semibold leading-none text-foreground">{credits.balance}</span>
                      {!sidebarCollapsed && <span className="text-xs text-muted-foreground">Plano {subscription.definition.name}</span>}
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200/80">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-[#37beff] to-[#0b56d8]"
                      initial={false}
                      animate={{ width: `${travelerCreditsProgress}%` }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                    />
                  </div>
                  {!sidebarCollapsed && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {credits.balance} de {travelerPlanCredits} créditos considerados no saldo atual
                    </p>
                  )}
                </div>
                <Link
                  href={travelerCreditsActionHref}
                  className={cn(
                    "mt-4 flex w-full items-center justify-center rounded-xl border border-[#0b56d8]/15 bg-[#0b56d8]/5 px-3 py-2 text-sm font-medium text-[#0b56d8] transition-colors hover:bg-[#0b56d8]/10",
                    sidebarCollapsed && "px-2 text-xs"
                  )}
                  aria-label={travelerCreditsActionLabel}
                >
                  {sidebarCollapsed ? <ChevronRight size={16} /> : travelerCreditsActionLabel}
                </Link>
              </div>
              <div className={cn("rounded-2xl border border-[#0b56d8]/12 bg-white/90 p-4 shadow-sm", sidebarCollapsed && "px-2 py-3")}>
                <div className={cn("flex items-center gap-3", sidebarCollapsed && "justify-center")}>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#37beff]/18 to-[#0b56d8]/14 text-[#0b56d8]">
                    <Luggage size={18} />
                  </div>
                  {!sidebarCollapsed ? (
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Viagens disponíveis</p>
                      <p className="mt-1 text-2xl font-semibold leading-none text-foreground">{tripLinkBalance ?? "—"}</p>
                    </div>
                  ) : null}
                </div>
                <Link
                  href="/portal/viagens/comprar"
                  className={cn(
                    "mt-4 flex w-full items-center justify-center rounded-xl border border-[#0b56d8]/15 bg-[#0b56d8]/5 px-3 py-2 text-sm font-medium text-[#0b56d8] transition-colors hover:bg-[#0b56d8]/10",
                    sidebarCollapsed && "px-2",
                  )}
                  aria-label="Comprar viagens"
                >
                  {sidebarCollapsed ? <ChevronRight size={16} /> : "Comprar viagens"}
                </Link>
              </div>
            </div>

            <div className="border-t border-border/50 p-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-[#f8fafc]",
                      sidebarCollapsed && "justify-center",
                    )}
                  >
                    <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary to-secondary">
                      {profile?.avatarUrl ? (
                        <Image src={profile.avatarUrl} alt={profile.name} fill className="rounded-full object-cover" />
                      ) : (
                        <span className="text-sm font-semibold text-primary-foreground">{initials}</span>
                      )}
                    </div>
                    {!sidebarCollapsed && (
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{firstName || "Conta"}</p>
                        <p className="truncate text-xs text-muted-foreground">{profile?.email ?? "Portal Vuei"}</p>
                      </div>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="portal-dropdown w-56 border-border/50">
                  {accountMenuItems.map((item) => (
                    <DropdownMenuItem key={item.href} asChild>
                      <Link href={item.href} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem onSelect={(event) => {
                    event.preventDefault()
                    setQuickGuideOpen(true)
                  }}>
                    <BookOpen className="h-4 w-4" />
                    <span>Guia rápido</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => void handleSignOut()} className="flex items-center gap-2 text-red-600 focus:text-red-600">
                    <LogOut className="h-4 w-4" />
                    <span>Sair</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </motion.aside>
      )}

      {isMobile && (
        <header ref={mobileHeaderRef} className="fixed left-0 right-0 top-0 z-40 border-b border-border/60 vuei-glass">
          <div className="px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)]">
            <div className="flex items-center justify-between">
              <Link href="/portal">
                <Image
                  src="/vuei-logo.png"
                  alt="Vuei"
                  width={80}
                  height={28}
                  className="object-contain"
                />
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    aria-label="Abrir menu da conta"
                    className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#37beff] to-[#0b56d8] ring-1 ring-border/50 transition-transform duration-200 active:scale-95"
                  >
                    {profile?.avatarUrl ? (
                      <Image src={profile.avatarUrl} alt={profile.name} fill className="rounded-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-semibold text-primary-foreground">{initials}</span>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="portal-dropdown w-56 border-border/50">
                  {accountMenuItems.map((item) => (
                    <DropdownMenuItem key={item.href} asChild>
                      <Link href={item.href} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem onSelect={(event) => {
                    event.preventDefault()
                    setQuickGuideOpen(true)
                  }}>
                    <BookOpen className="h-4 w-4" />
                    <span>Guia rápido</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => void handleSignOut()} className="flex items-center gap-2 text-red-600 focus:text-red-600">
                    <LogOut className="h-4 w-4" />
                    <span>Sair</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link
                href="/portal/viagens/comprar"
                className="flex min-w-0 items-center gap-2 rounded-full border border-border/60 bg-white/85 px-3 py-2 text-slate-900 transition-colors hover:bg-white"
              >
                <Luggage size={14} className="shrink-0 text-primary" />
                <span className="truncate text-xs font-medium">
                  {tripLinkBalance ?? "—"} {tripLinkBalance === 1 ? "viagem" : "viagens"}
                </span>
              </Link>
              <Link
                href="/portal/creditos"
                className="flex min-w-0 items-center gap-2 rounded-full border border-border/60 bg-white/85 px-3 py-2 text-slate-900 transition-colors hover:bg-white"
              >
                <Coins size={14} className="text-primary" />
                <span className="truncate text-xs font-medium">{credits.balance} créditos</span>
              </Link>
              <Link
                href="/portal/offline"
                className="flex items-center gap-2 rounded-full border border-border/60 bg-white/85 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-white"
              >
                <WifiOff size={14} className="text-primary" />
                <span>Offline</span>
              </Link>
              <Link
                href="/portal/suporte"
                className="flex items-center gap-2 rounded-full border border-border/60 bg-white/85 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-white"
              >
                <LifeBuoy size={14} className="text-primary" />
                <span>Suporte</span>
              </Link>
            </div>
          </div>
        </header>
      )}

      <main
        className={cn(
          "min-h-screen transition-all duration-300",
          isMobile ? "px-4 pb-[calc(env(safe-area-inset-bottom)+104px)]" : sidebarCollapsed ? "ml-20 p-8" : "ml-60 p-8",
        )}
        style={isMobile ? { paddingTop: `calc(${mobileHeaderOffset}px + 16px)` } : undefined}
      >
        {children}
      </main>

      <QuickGuideModal open={quickGuideOpen} onOpenChange={setQuickGuideOpen} variant="traveler" />

      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 vuei-glass">
          <div className="flex items-center justify-around px-2 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/portal" && pathname.startsWith(item.href))
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl px-4 py-2 transition-all duration-300",
                    isActive ? "bg-gradient-to-b from-[#37beff]/10 to-[#0b56d8]/10 text-[#0b56d8]" : "text-muted-foreground",
                  )}
                >
                  <item.icon size={22} />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </Link>
              )
            })}
            <CreateTripButton className="flex h-auto flex-col items-center gap-1 rounded-xl bg-gradient-to-r from-[#37beff] to-[#0b56d8] px-3 py-1.5 shadow-[0_14px_28px_rgba(11,86,216,0.18)]">
              <Plus size={22} className="text-white" />
              <span className="text-[10px] font-medium text-white">Criar</span>
            </CreateTripButton>
          </div>
        </nav>
      )}

      <SupportFab portalType="traveler" agencyId={profile?.agencyId ?? null} />
    </div>
  )
}
