"use client"

import type React from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  LayoutDashboard,
  Users,
  Plane,
  Link2,
  MessageSquare,
  FileText,
  Map,
  UserCog,
  Coins,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Bell,
  Search,
  Plus,
  Menu,
  X,
  Sparkles,
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
import { AgencyProvider, useAgency } from "@/contexts/agency-context"
import { RouteGuard } from "@/components/auth/route-guard"
import { useAuth } from "@/contexts/auth-context"
import { getAgencyByOwner } from "@/lib/repositories/agencies-repository"
import { withTimeout } from "@/lib/async/with-timeout"
import type { Agency } from "@/types"

const navItems = [
  { href: "/agencia", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/agencia/clientes", icon: Users, label: "Clientes" },
  { href: "/agencia/viagens", icon: Plane, label: "Viagens" },
  { href: "/agencia/links", icon: Link2, label: "Links" },
  { href: "/agencia/concierge", icon: MessageSquare, label: "Concierge" },
  { href: "/agencia/documentos", icon: FileText, label: "Documentos" },
  { href: "/agencia/roteiros-ia", icon: Map, label: "Roteiros IA" },
  { href: "/agencia/equipe", icon: UserCog, label: "Equipe" },
  { href: "/agencia/creditos", icon: Coins, label: "Creditos" },
  { href: "/agencia/analytics", icon: BarChart3, label: "Analytics" },
  { href: "/agencia/configuracoes", icon: Settings, label: "Configuracoes" },
]

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const { user, profile } = useAuth()
  const { credits, conciergeRequests } = useAgency()
  const [agencyProfile, setAgencyProfile] = useState<Agency | null>(null)
  const [agencyNotifications, setAgencyNotifications] = useState([
    {
      id: "agency-notification-1",
      title: "Nova solicitacao do concierge",
      message: "Maria Silva pediu apoio para o roteiro de Paris.",
      type: "info",
      read: false,
      href: "/agencia/concierge",
    },
    {
      id: "agency-notification-2",
      title: "Credito em nivel de atencao",
      message: "Seu saldo atual merece acompanhamento antes da proxima campanha.",
      type: "warning",
      read: false,
      href: "/agencia/creditos",
    },
    {
      id: "agency-notification-3",
      title: "Nova viagem criada",
      message: "Uma nova viagem foi adicionada ao portal da agencia.",
      type: "success",
      read: true,
      href: "/agencia/viagens",
    },
  ])
  
  const pendingRequests = conciergeRequests.filter(r => r.status === "pending").length
  const unreadNotifications = agencyNotifications.filter((notification) => !notification.read).length
  const displayName = agencyProfile?.name || profile?.name || "Agencia"
  const displayPlan = agencyProfile?.plan ? agencyProfile.plan[0].toUpperCase() + agencyProfile.plan.slice(1) : "Agency"
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "AG"

  useEffect(() => {
    if (!user?.id) return

    let active = true

    const loadAgency = async () => {
      try {
        const result = await withTimeout(getAgencyByOwner(user.id), 10_000, "Agency bootstrap timeout.")
        if (active) {
          setAgencyProfile(result.data)
          console.log("[BOOT] agency loaded", result.data?.id ?? null)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha ao carregar agencia."
        console.error("[AUTH ERROR]", message)
        if (active) {
          setAgencyProfile(null)
          console.log("[BOOT] agency loaded", null)
        }
      }
    }

    void loadAgency()

    return () => {
      active = false
    }
  }, [user?.id])

  const markAgencyNotificationRead = (id: string) => {
    setAgencyNotifications((prev) => prev.map((notification) => notification.id === id ? { ...notification, read: true } : notification))
  }

  const clearAgencyNotifications = () => {
    setAgencyNotifications([])
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarCollapsed ? 80 : 260 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="fixed left-0 top-0 z-40 hidden h-screen border-r border-white/5 bg-card/50 backdrop-blur-xl lg:block"
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between border-b border-white/5 px-4">
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
                    <Badge variant="outline" className="ml-2 border-primary/30 bg-primary/10 text-[10px] text-primary">
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
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 overflow-y-auto p-3">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/agencia" && pathname.startsWith(item.href))
              return (
                <Link key={item.href} href={item.href}>
                  <motion.div
                    className={cn(
                      "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-gradient-to-r from-primary/20 to-accent/10 text-foreground"
                        : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
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

          {/* Credits Card */}
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="border-t border-white/5 p-4"
              >
                <div className="rounded-xl bg-gradient-to-br from-primary/10 via-accent/5 to-transparent p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-xs font-medium text-muted-foreground">Créditos IA</span>
                  </div>
                  <div className="mb-2 text-2xl font-bold text-foreground">{credits.balance}</div>
                  <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((credits.balance / 1000) * 100, 100)}%` }}
                      transition={{ duration: 1, delay: 0.5 }}
                    />
                  </div>
                  <Link href="/agencia/creditos">
                    <Button size="sm" className="w-full bg-primary/20 text-primary hover:bg-primary/30">
                      Comprar mais
                    </Button>
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.aside>

      {/* Mobile Header */}
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/5 bg-card/80 backdrop-blur-xl lg:hidden">
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
            <DropdownMenu open={notificationsOpen} onOpenChange={setNotificationsOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-9 w-9">
                  <Bell className="h-5 w-5" />
                  {unreadNotifications > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 border-white/10 bg-card/95 backdrop-blur-xl">
                <div className="flex items-center justify-between border-b border-white/5 px-4 py-2">
                  <span className="text-sm font-semibold">Notificacoes</span>
                  {agencyNotifications.length > 0 && (
                    <button onClick={clearAgencyNotifications} className="text-xs text-primary hover:underline">
                      Limpar
                    </button>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {agencyNotifications.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">Sem notificacoes</p>
                  ) : (
                    agencyNotifications.map((notification) => (
                      <DropdownMenuItem
                        key={notification.id}
                        className={`cursor-pointer items-start gap-3 border-b border-white/5 px-4 py-3 ${!notification.read ? "bg-primary/5" : ""}`}
                        onClick={() => {
                          markAgencyNotificationRead(notification.id)
                          setNotificationsOpen(false)
                        }}
                      >
                        <div
                          className={`mt-1 h-2 w-2 rounded-full ${
                            notification.type === "success"
                              ? "bg-emerald-400"
                              : notification.type === "warning"
                                ? "bg-amber-400"
                                : "bg-primary"
                          }`}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{notification.title}</p>
                          <p className="text-xs text-muted-foreground">{notification.message}</p>
                          <Link href={notification.href} className="mt-2 inline-block text-xs text-primary hover:underline">
                            Abrir item relacionado
                          </Link>
                        </div>
                      </DropdownMenuItem>
                    ))
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            <Avatar className="h-8 w-8 border border-white/10">
              <AvatarImage src={profile?.avatarUrl ?? "/placeholder.svg"} />
              <AvatarFallback className="bg-primary/20 text-xs text-primary">{initials}</AvatarFallback>
            </Avatar>
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
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed left-0 top-0 z-50 h-full w-72 border-r border-white/5 bg-card lg:hidden"
            >
              <div className="flex h-14 items-center justify-between border-b border-white/5 px-4">
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
                {navItems.map((item) => {
                  const isActive = pathname === item.href || (item.href !== "/agencia" && pathname.startsWith(item.href))
                  return (
                    <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)}>
                      <div
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                          isActive
                            ? "bg-gradient-to-r from-primary/20 to-accent/10 text-foreground"
                            : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                        )}
                      >
                        <item.icon className={cn("h-5 w-5", isActive ? "text-primary" : "")} />
                        {item.label}
                      </div>
                    </Link>
                  )
                })}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Header */}
      <header
        className={cn(
          "fixed right-0 top-0 z-30 hidden h-16 border-b border-white/5 bg-card/50 backdrop-blur-xl transition-all duration-300 lg:block",
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
                className="h-10 w-80 rounded-xl border border-white/5 bg-white/5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/agencia/viagens/criar">
              <Button size="sm" className="gap-2 bg-gradient-to-r from-primary to-accent text-white hover:opacity-90">
                <Plus className="h-4 w-4" />
                Nova Viagem
              </Button>
            </Link>
            <DropdownMenu open={notificationsOpen} onOpenChange={setNotificationsOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-10 w-10">
                  <Bell className="h-5 w-5" />
                  {(pendingRequests > 0 || unreadNotifications > 0) && (
                    <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-black">
                      {Math.max(pendingRequests, unreadNotifications)}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 border-white/10 bg-card/95 backdrop-blur-xl">
                <div className="flex items-center justify-between border-b border-white/5 px-4 py-2">
                  <span className="text-sm font-semibold">Notificacoes</span>
                  {agencyNotifications.length > 0 && (
                    <button onClick={clearAgencyNotifications} className="text-xs text-primary hover:underline">
                      Limpar notificacoes
                    </button>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {agencyNotifications.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">Sem notificacoes</p>
                  ) : (
                    agencyNotifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`cursor-pointer border-b border-white/5 px-4 py-3 transition-colors hover:bg-white/5 ${!notification.read ? "bg-primary/5" : ""}`}
                        onClick={() => markAgencyNotificationRead(notification.id)}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`mt-1.5 h-2 w-2 rounded-full ${
                              notification.type === "success"
                                ? "bg-emerald-400"
                                : notification.type === "warning"
                                  ? "bg-amber-400"
                                  : "bg-primary"
                            }`}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{notification.title}</p>
                            <p className="text-xs text-muted-foreground">{notification.message}</p>
                            <Link
                              href={notification.href}
                              className="mt-2 inline-block text-xs text-primary hover:underline"
                              onClick={() => setNotificationsOpen(false)}
                            >
                              Abrir item relacionado
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <DropdownMenuSeparator className="bg-white/5" />
                <DropdownMenuItem
                  className="justify-center text-xs text-muted-foreground"
                  onClick={() => {
                    setAgencyNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })))
                    setNotificationsOpen(false)
                  }}
                >
                  Marcar como lidas
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="flex items-center gap-3 border-l border-white/10 pl-3">
              <div className="text-right">
                <div className="text-sm font-medium text-foreground">{displayName}</div>
                <div className="text-xs text-muted-foreground">{displayPlan}</div>
              </div>
              <Avatar className="h-10 w-10 border-2 border-primary/30">
                <AvatarImage src={profile?.avatarUrl ?? "/placeholder.svg"} />
                <AvatarFallback className="bg-primary/20 text-primary">{initials}</AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main
        className={cn(
          "min-h-screen pt-14 transition-all duration-300 lg:pt-16",
          sidebarCollapsed ? "lg:pl-20" : "lg:pl-[260px]"
        )}
      >
        <div className="p-4 lg:p-6">{children}</div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/5 bg-card/90 backdrop-blur-xl lg:hidden">
        <div className="flex items-center justify-around py-2">
          {[navItems[0], navItems[1], navItems[2], navItems[4], navItems[10]].map((item) => {
            const isActive = pathname === item.href || (item.href !== "/agencia" && pathname.startsWith(item.href))
            return (
              <Link key={item.href} href={item.href}>
                <motion.div
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl px-4 py-2 transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                  whileTap={{ scale: 0.95 }}
                >
                  <item.icon className={cn("h-5 w-5", isActive && "drop-shadow-[0_0_8px_rgba(93,224,230,0.5)]")} />
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
    </div>
  )
}
