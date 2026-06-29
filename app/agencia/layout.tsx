"use client"

import type React from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  LayoutDashboard,
  Users,
  Plane,
  Building2,
  Link2,
  MessageSquare,
  FileText,
  Map,
  UserCog,
  Coins,
  BarChart3,
  Settings,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Bell,
  Search,
  Plus,
  Menu,
  X,
  LifeBuoy,
  User,
  CreditCard,
  LogOut,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AgencyProvider, useAgency } from "@/contexts/agency-context"
import { RouteGuard } from "@/components/auth/route-guard"
import { useAuth } from "@/contexts/auth-context"
import { SupportFab } from "@/components/support/support-fab"
import { QuickGuideModal } from "@/components/onboarding/quick-guide-modal"

const AGENCY_QUICK_GUIDE_STORAGE_KEY = "vuei_agency_quick_guide_seen_v1"

const navItems = [
  { href: "/agencia", icon: LayoutDashboard, label: "Início" },
  { href: "/agencia/clientes", icon: Users, label: "Clientes" },
  { href: "/agencia/viagens", icon: Plane, label: "Viagens" },
  { href: "/agencia/suporte", icon: LifeBuoy, label: "Suporte" },
  { href: "/agencia/creditos", icon: Coins, label: "Créditos" },
  { href: "/agencia/configuracoes", icon: Settings, label: "Configurações" },
]

const primaryNavItems = navItems.filter((item) =>
  ["/agencia", "/agencia/clientes", "/agencia/viagens", "/agencia/suporte"].includes(item.href)
)

export default function AgencyLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard allowedRoles={["agency_owner", "agency_member"]}>
      <AgencyProvider>
        <AgencyLayoutInner>{children}</AgencyLayoutInner>
      </AgencyProvider>
    </RouteGuard>
  )
}

function AgencyLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [quickGuideOpen, setQuickGuideOpen] = useState(false)
  const { profile, signOut } = useAuth()
  const { credits, conciergeRequests, agency, workspaceLoading, subscription, limitDialog, clearLimitDialog, canCreateMoreTrips, showPlanLimitDialog, trips } = useAgency()
  const [agencyNotifications, setAgencyNotifications] = useState<Array<{
    id: string
    title: string
    message: string
    type: "info" | "warning" | "success"
    read: boolean
    href: string
  }>>([])
  
  const pendingRequests = conciergeRequests.filter(r => r.status === "pending").length
  const unreadNotifications = agencyNotifications.filter((notification) => !notification.read).length
  const displayName = agency?.name || profile?.name || "Agência"
  const displayPlan = subscription.definition.name
  const headerImageUrl = agency?.logo || profile?.avatarUrl || undefined
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "AG"

  const markAgencyNotificationRead = (id: string) => {
    setAgencyNotifications((prev) => prev.map((notification) => notification.id === id ? { ...notification, read: true } : notification))
  }

  const clearAgencyNotifications = () => {
    setAgencyNotifications([])
  }

  const handleSignOut = async () => {
    void signOut()
    router.replace("/login")
  }

  const accountMenuItems = [
    { label: "Minha conta", href: "/agencia/configuracoes", icon: User },
    { label: "Minha agência", href: "/agencia/configuracoes", icon: Building2 },
    { label: "Equipe", href: "/agencia/equipe", icon: UserCog },
    { label: "Créditos IA", href: "/agencia/creditos", icon: Coins },
    { label: "Assinatura", href: "/agencia/planos", icon: CreditCard },
    { label: "Configurações", href: "/agencia/configuracoes", icon: Settings },
  ]

  const agencyPlanCredits = Math.max(subscription.definition.monthlyCredits, 1)
  const agencyCreditsProgress = Math.min((credits.balance / agencyPlanCredits) * 100, 100)
  const agencyCreditsActionHref = subscription.code === "free" ? "/agencia/planos" : "/agencia/creditos"
  const agencyCreditsActionLabel = subscription.code === "free" ? "Fazer upgrade" : "Comprar créditos"

  const handleOpenCreateTrip = () => {
    if (!canCreateMoreTrips) {
      showPlanLimitDialog("trip_limit")
      return
    }

    router.push("/agencia/viagens/criar")
  }

  useEffect(() => {
    if (!notificationsOpen) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNotificationsOpen(false)
      }
    }

    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [notificationsOpen])

  useEffect(() => {
    if (workspaceLoading || typeof window === "undefined" || trips.length > 0) return
    if (window.localStorage.getItem(AGENCY_QUICK_GUIDE_STORAGE_KEY) === "1") return

    window.localStorage.setItem(AGENCY_QUICK_GUIDE_STORAGE_KEY, "1")
    setQuickGuideOpen(true)
  }, [workspaceLoading, trips.length])

  const renderNotificationsMenu = () => (
    <div className="agency-dropdown absolute right-0 top-full z-50 mt-3 w-80 overflow-hidden rounded-2xl border backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <span className="text-sm font-semibold text-foreground">Notificações</span>
        <div className="flex items-center gap-2">
          {agencyNotifications.length > 0 ? (
            <button
              onClick={() => {
                setAgencyNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })))
                setNotificationsOpen(false)
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Marcar lidas
            </button>
          ) : null}
          <button onClick={() => setNotificationsOpen(false)} className="rounded-lg p-1 text-muted-foreground hover:bg-slate-100 hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {agencyNotifications.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <p className="text-sm font-medium text-foreground">Nenhuma notificação</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Quando houver atualizações importantes da sua agência, elas aparecerão aqui.
            </p>
          </div>
        ) : (
          agencyNotifications.map((notification) => (
            <div
              key={notification.id}
              className={cn(
                "border-b border-border/60 px-4 py-3 transition-colors hover:bg-slate-50",
                !notification.read && "bg-primary/5",
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "mt-1.5 h-2 w-2 rounded-full",
                    notification.type === "success" && "bg-emerald-400",
                    notification.type === "warning" && "bg-amber-400",
                    notification.type === "info" && "bg-primary",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{notification.title}</p>
                  <p className="text-xs text-muted-foreground">{notification.message}</p>
                  <Link
                    href={notification.href}
                    className="mt-2 inline-block text-xs text-primary hover:underline"
                    onClick={() => {
                      markAgencyNotificationRead(notification.id)
                      setNotificationsOpen(false)
                    }}
                  >
                    Abrir item relacionado
                  </Link>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      {agencyNotifications.length > 0 ? (
        <div className="border-t border-border/60 px-4 py-3">
          <button
            onClick={() => {
              clearAgencyNotifications()
              setNotificationsOpen(false)
            }}
            className="text-xs text-primary hover:underline"
          >
            Limpar notificações
          </button>
        </div>
      ) : null}
    </div>
  )

  return (
    <div className="agency-shell min-h-screen bg-[radial-gradient(circle_at_top,_rgba(55,190,255,0.1),_transparent_35%),linear-gradient(180deg,#f7f7f8_0%,#f5f5f7_100%)] text-foreground">
      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarCollapsed ? 80 : 260 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="fixed left-0 top-0 z-40 hidden h-screen border-r border-border/60 bg-white/82 shadow-[18px_0_48px_rgba(15,23,42,0.06)] backdrop-blur-2xl lg:block"
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between border-b border-border/60 px-4">
            <Link href="/agencia" className="flex items-center gap-3">
              <div className="relative h-8 w-8 flex-shrink-0">
                <Image src="/vuei-logo.png" alt="Vuei" fill className="object-contain" />
              </div>
              <AnimatePresence>
                {!sidebarCollapsed && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <span className="text-lg font-semibold text-foreground">Vuei</span>
                    <Badge variant="outline" className="ml-2 border-primary/20 bg-primary/10 text-[10px] text-primary">
                      Agência
                    </Badge>
                  </motion.div>
                )}
              </AnimatePresence>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="h-8 w-8 rounded-xl text-muted-foreground hover:bg-[#f8fafc] hover:text-foreground"
            >
              {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 overflow-y-auto p-3">
            {primaryNavItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/agencia" && pathname.startsWith(item.href))
              return (
                <Link key={item.href} href={item.href}>
                  <motion.div
                    className={cn(
                      "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-gradient-to-r from-primary/16 via-primary/10 to-transparent text-foreground shadow-[0_12px_30px_rgba(11,86,216,0.08)]"
                        : "text-muted-foreground hover:bg-[#f8fafc] hover:text-foreground"
                    )}
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeIndicator"
                        className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-primary to-accent"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    <item.icon
                      className={cn(
                        "h-5 w-5 flex-shrink-0 transition-colors",
                        isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                      )}
                    />
                    <AnimatePresence>
                      {!sidebarCollapsed && (
                        <motion.span
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: "auto" }}
                          exit={{ opacity: 0, width: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden whitespace-nowrap"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {isActive && (
                      <motion.div
                        className="absolute inset-0 -z-10 rounded-xl bg-gradient-to-r from-primary/10 to-transparent opacity-50"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.5 }}
                      />
                    )}
                  </motion.div>
                </Link>
              )
            })}
          </nav>

          <div className="border-t border-border/60 p-4">
            <div className={cn("rounded-2xl border border-border/60 bg-white/92 p-4 shadow-sm", sidebarCollapsed && "px-2 py-3")}>
              <div className={cn("flex items-start gap-3", sidebarCollapsed && "flex-col items-center gap-2 text-center")}>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/18 to-accent/14 text-primary">
                  <Coins className="h-5 w-5" />
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
                    className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                    initial={false}
                    animate={{ width: `${agencyCreditsProgress}%` }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  />
                </div>
                {!sidebarCollapsed && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {credits.balance} de {agencyPlanCredits} créditos considerados no saldo atual
                  </p>
                )}
              </div>
              <Link
                href={agencyCreditsActionHref}
                className={cn(
                  "mt-4 flex w-full items-center justify-center rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10",
                  sidebarCollapsed && "px-2 text-xs"
                )}
                aria-label={agencyCreditsActionLabel}
              >
                {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : agencyCreditsActionLabel}
              </Link>
            </div>
          </div>

          {/* Credits Card */}
          <AnimatePresence>
            {false && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="border-t border-border/60 p-4"
              >
                <div className="agency-subtle-card rounded-2xl p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-xs font-medium text-muted-foreground">Créditos IA</span>
                  </div>
                  <div className="mb-2 text-2xl font-bold text-foreground">{credits.balance}</div>
                  <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((credits.balance / 1000) * 100, 100)}%` }}
                      transition={{ duration: 1, delay: 0.5 }}
                    />
                  </div>
                  <Link href="/agencia/planos">
                    <Button size="sm" className="w-full rounded-xl border border-primary/15 bg-white text-primary hover:bg-primary/5">
                      Ver planos
                    </Button>
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.aside>

      {/* Mobile Header */}
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-border/60 bg-white/88 backdrop-blur-xl lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(true)} className="h-9 w-9">
              <Menu className="h-5 w-5" />
            </Button>
            <Link href="/agencia" className="flex items-center gap-2">
              <div className="relative h-7 w-7">
                <Image src="/vuei-logo.png" alt="Vuei" fill className="object-contain" />
              </div>
              <span className="font-semibold">Vuei</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Button variant="ghost" size="icon" className="relative h-9 w-9" onClick={() => setNotificationsOpen((prev) => !prev)}>
                <Bell className="h-5 w-5" />
                {unreadNotifications > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />}
              </Button>
              {notificationsOpen ? renderNotificationsMenu() : null}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                  <Avatar className="h-8 w-8 border border-border/60">
                    <AvatarImage src={headerImageUrl} />
                    <AvatarFallback className="bg-primary/20 text-xs text-primary">{initials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 agency-dropdown">
                {accountMenuItems.map((item) => (
                  <DropdownMenuItem key={item.label} className="gap-2" onClick={() => router.push(item.href)}>
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem
                  className="gap-2"
                  onSelect={(event) => {
                    event.preventDefault()
                    setQuickGuideOpen(true)
                  }}
                >
                  <BookOpen className="h-4 w-4" />
                  Guia rápido
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 text-red-500 focus:text-red-500" onClick={() => void handleSignOut()}>
                  <LogOut className="h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-slate-900/24 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed left-0 top-0 z-50 h-full w-72 border-r border-border/60 bg-white lg:hidden"
            >
              <div className="flex h-14 items-center justify-between border-b border-border/60 px-4">
                <Link href="/agencia" className="flex items-center gap-2">
                  <div className="relative h-7 w-7">
                    <Image src="/vuei-logo.png" alt="Vuei" fill className="object-contain" />
                  </div>
                  <span className="font-semibold">Vuei</span>
                  <Badge variant="outline" className="border-primary/30 bg-primary/10 text-[10px] text-primary">
                    Agência
                  </Badge>
                </Link>
                <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)} className="h-8 w-8">
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <nav className="space-y-1 p-3">
                {primaryNavItems.map((item) => {
                  const isActive = pathname === item.href || (item.href !== "/agencia" && pathname.startsWith(item.href))
                  return (
                    <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)}>
                      <div
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                          isActive
                            ? "bg-gradient-to-r from-primary/16 via-primary/10 to-transparent text-foreground"
                            : "text-muted-foreground hover:bg-[#f8fafc] hover:text-foreground"
                        )}
                      >
                        <item.icon className={cn("h-5 w-5", isActive ? "text-primary" : "")} />
                        {item.label}
                      </div>
                    </Link>
                  )
                })}
              </nav>
              <div className="px-3 pb-4">
                <div className="rounded-2xl border border-border/60 bg-white/92 p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/18 to-accent/14 text-primary">
                      <Coins className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Créditos IA</p>
                      <div className="mt-1 flex items-end gap-2">
                        <span className="text-2xl font-semibold leading-none text-foreground">{credits.balance}</span>
                        <span className="text-xs text-muted-foreground">Plano {subscription.definition.name}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200/80">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                        initial={false}
                        animate={{ width: `${agencyCreditsProgress}%` }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {credits.balance} de {agencyPlanCredits} créditos considerados no saldo atual
                    </p>
                  </div>
                  <Link
                    href={agencyCreditsActionHref}
                    className="mt-4 flex w-full items-center justify-center rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {agencyCreditsActionLabel}
                  </Link>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Header */}
      <header
        className={cn(
          "fixed right-0 top-0 z-30 hidden h-16 border-b border-border/60 bg-white/74 backdrop-blur-2xl transition-all duration-300 lg:block",
          sidebarCollapsed ? "left-20" : "left-[260px]"
        )}
      >
        <div className="flex h-full items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar clientes, viagens..."
                className="h-10 w-80 rounded-xl border border-border/70 bg-[#fbfbfc] pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button size="sm" className="gap-2 bg-gradient-to-r from-primary to-accent text-white hover:opacity-90" onClick={handleOpenCreateTrip}>
              <Plus className="h-4 w-4" />
              Nova Viagem
            </Button>
            <div className="relative">
              <Button variant="ghost" size="icon" className="relative h-10 w-10" onClick={() => setNotificationsOpen((prev) => !prev)}>
                <Bell className="h-5 w-5" />
                {(pendingRequests > 0 || unreadNotifications > 0) && (
                  <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-black">
                    {Math.max(pendingRequests, unreadNotifications)}
                  </span>
                )}
              </Button>
              {notificationsOpen ? renderNotificationsMenu() : null}
            </div>
            <div className="flex items-center gap-3 border-l border-border/60 pl-3">
              <div className="text-right">
                <div className="text-sm font-medium text-foreground">{displayName}</div>
                <div className="text-xs text-muted-foreground">{displayPlan}</div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-11 rounded-full px-2 hover:bg-primary/5">
                    <Avatar className="h-10 w-10 border-2 border-primary/20">
                      <AvatarImage src={headerImageUrl} />
                      <AvatarFallback className="bg-primary/20 text-primary">{initials}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 agency-dropdown">
                  {accountMenuItems.map((item) => (
                    <DropdownMenuItem key={item.label} className="gap-2" onClick={() => router.push(item.href)}>
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem
                    className="gap-2"
                    onSelect={(event) => {
                      event.preventDefault()
                      setQuickGuideOpen(true)
                    }}
                  >
                    <BookOpen className="h-4 w-4" />
                    Guia rápido
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="gap-2 text-red-500 focus:text-red-500" onClick={() => void handleSignOut()}>
                    <LogOut className="h-4 w-4" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {notificationsOpen ? (
        <div
          className="fixed inset-0 z-20"
          onClick={() => setNotificationsOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      {/* Main Content */}
      <main
        className={cn(
          "min-h-screen pt-14 transition-all duration-300 lg:pt-16",
          sidebarCollapsed ? "lg:pl-20" : "lg:pl-[260px]"
        )}
      >
        <div className="p-4 lg:p-6">
          {workspaceLoading ? (
            <div className="agency-subtle-card rounded-2xl p-6 text-sm text-muted-foreground">
              Carregando workspace da agência...
            </div>
          ) : (
            children
          )}
        </div>
      </main>

      <QuickGuideModal
        open={quickGuideOpen}
        onOpenChange={setQuickGuideOpen}
        variant="agency"
        onCreateTrip={() => {
          setQuickGuideOpen(false)
          handleOpenCreateTrip()
        }}
      />

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-white/92 backdrop-blur-xl lg:hidden">
        <div className="flex items-center justify-around py-2">
          {primaryNavItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/agencia" && pathname.startsWith(item.href))
            return (
              <Link key={item.href} href={item.href}>
                <motion.div
                  className={cn(
                    "relative flex flex-col items-center gap-1 rounded-xl px-4 py-2 transition-colors",
                    isActive ? "bg-primary/8 text-primary" : "text-muted-foreground"
                  )}
                  whileTap={{ scale: 0.95 }}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="text-[10px] font-medium">{item.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="mobileActiveTab"
                      className="absolute -top-0.5 h-0.5 w-8 rounded-full bg-gradient-to-r from-primary to-accent"
                    />
                  )}
                </motion.div>
              </Link>
            )
          })}
        </div>
      </nav>

      <Dialog open={Boolean(limitDialog)} onOpenChange={(open) => { if (!open) clearLimitDialog() }}>
        <DialogContent className="agency-dialog sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{limitDialog?.title}</DialogTitle>
            <DialogDescription>{limitDialog?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            {limitDialog?.actionHref ? (
              <Button asChild className="w-full bg-gradient-to-r from-primary to-accent text-white">
                <Link href={limitDialog.actionHref} onClick={() => clearLimitDialog()}>
                  {limitDialog.actionLabel}
                </Link>
              </Button>
            ) : (
              <Button className="w-full bg-gradient-to-r from-primary to-accent text-white" onClick={() => clearLimitDialog()}>
                {limitDialog?.actionLabel ?? "Entendi"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SupportFab portalType="agency" agencyId={agency?.id ?? profile?.agencyId ?? null} />
    </div>
  )
}
