"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  LayoutDashboard,
  Building2,
  Users,
  Plane,
  MessageSquare,
  Brain,
  Coins,
  FileText,
  BarChart3,
  Wallet,
  Settings,
  Bell,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Sparkles,
  Search,
  Command,
  User,
  Shield,
  LogOut,
  Check
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
import { MasterProvider, useMaster } from "@/contexts/master-context"
import { RouteGuard } from "@/components/auth/route-guard"
import { useAuth } from "@/contexts/auth-context"

const navItems = [
  { href: "/master", icon: LayoutDashboard, label: "Overview" },
  { href: "/master/agencias", icon: Building2, label: "Agencias" },
  { href: "/master/usuarios", icon: Users, label: "Usuarios" },
  { href: "/master/viagens", icon: Plane, label: "Viagens" },
  { href: "/master/concierge", icon: MessageSquare, label: "Concierge" },
  { href: "/master/ia", icon: Brain, label: "Central IA" },
  { href: "/master/creditos", icon: Coins, label: "Creditos" },
  { href: "/master/templates", icon: FileText, label: "Templates" },
  { href: "/master/analytics", icon: BarChart3, label: "Analytics" },
  { href: "/master/financeiro", icon: Wallet, label: "Financeiro" },
  { href: "/master/configuracoes", icon: Settings, label: "Configuracoes" },
]

export default function MasterLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard allowedRoles={["master"]}>
      <MasterProvider>
        <MasterLayoutInner>{children}</MasterLayoutInner>
      </MasterProvider>
    </RouteGuard>
  )
}

function MasterLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { signOut, profile } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  
  const { credits, notifications, markNotificationRead, markAllNotificationsRead, searchGlobal, loadingState } = useMaster()
  const unreadCount = notifications.filter(n => !n.read).length
  const searchResults = searchQuery.length > 1 ? searchGlobal(searchQuery) : { agencies: [], users: [], trips: [] }
  const hasResults = searchResults.agencies.length > 0 || searchResults.users.length > 0 || searchResults.trips.length > 0

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setSearchOpen(true)
      }
      if (e.key === "Escape") {
        setSearchOpen(false)
        setSearchQuery("")
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const handleSearchSelect = (type: string, id: string) => {
    setSearchOpen(false)
    setSearchQuery("")
    if (type === "agency") router.push(`/master/agencias?id=${id}`)
    else if (type === "user") router.push(`/master/usuarios?id=${id}`)
    else if (type === "trip") router.push(`/master/viagens?id=${id}`)
  }

  const profileName = profile?.name || profile?.email || "Master"
  const profileInitials = profileName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  const handleSignOut = async () => {
    void signOut()
    router.replace("/login")
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Background Grid */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(93,224,230,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(93,224,230,0.02)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />
      
      {/* Ambient Glow */}
      <div className="fixed top-0 left-1/4 w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(93,224,230,0.08)_0%,transparent_70%)] pointer-events-none blur-3xl" />
      <div className="fixed bottom-0 right-1/4 w-[500px] h-[500px] bg-[radial-gradient(circle,rgba(0,74,173,0.08)_0%,transparent_70%)] pointer-events-none blur-3xl" />

      {/* Search Modal */}
      <AnimatePresence>
        {searchOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setSearchOpen(false); setSearchQuery("") }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-xl z-50 p-4"
            >
              <div className="bg-card/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
                  <Search className="h-5 w-5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Buscar agencias, usuarios, viagens..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                  <kbd className="px-2 py-1 text-xs bg-white/5 border border-white/10 rounded text-muted-foreground">ESC</kbd>
                </div>
                
                {searchQuery.length > 1 && (
                  <div className="max-h-80 overflow-y-auto p-2">
                    {!hasResults ? (
                      <p className="text-sm text-muted-foreground text-center py-8">Nenhum resultado encontrado</p>
                    ) : (
                      <div className="space-y-4">
                        {searchResults.agencies.length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground px-2 mb-1">Agencias</p>
                            {searchResults.agencies.slice(0, 3).map(agency => (
                              <button
                                key={agency.id}
                                onClick={() => handleSearchSelect("agency", agency.id)}
                                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-left"
                              >
                                <Building2 className="h-4 w-4 text-primary" />
                                <div>
                                  <p className="text-sm font-medium">{agency.name}</p>
                                  <p className="text-xs text-muted-foreground">{agency.owner}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                        {searchResults.users.length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground px-2 mb-1">Usuarios</p>
                            {searchResults.users.slice(0, 3).map(user => (
                              <button
                                key={user.id}
                                onClick={() => handleSearchSelect("user", user.id)}
                                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-left"
                              >
                                <Users className="h-4 w-4 text-accent" />
                                <div>
                                  <p className="text-sm font-medium">{user.name}</p>
                                  <p className="text-xs text-muted-foreground">{user.email}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                        {searchResults.trips.length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground px-2 mb-1">Viagens</p>
                            {searchResults.trips.slice(0, 3).map(trip => (
                              <button
                                key={trip.id}
                                onClick={() => handleSearchSelect("trip", trip.id)}
                                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-left"
                              >
                                <Plane className="h-4 w-4 text-emerald-400" />
                                <div>
                                  <p className="text-sm font-medium">{trip.name}</p>
                                  <p className="text-xs text-muted-foreground">{trip.destination}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 80 : 260 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="fixed left-0 top-0 bottom-0 z-40 hidden lg:flex flex-col border-r border-white/5 bg-black/40 backdrop-blur-xl"
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-white/5">
          <Link href="/master" className="flex items-center gap-3">
            <div className="relative w-8 h-8 flex-shrink-0">
              <Image src="/vuei-logo.png" alt="Vuei" fill className="object-contain" />
            </div>
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col"
                >
                  <span className="text-sm font-semibold text-foreground">Vuei</span>
                  <span className="text-[10px] font-medium text-primary/80 uppercase tracking-wider">Master</span>
                </motion.div>
              )}
            </AnimatePresence>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-white/5"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 px-3 overflow-y-auto scrollbar-none">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/master" && pathname.startsWith(item.href))
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300",
                      isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeNavMaster"
                        className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/20 to-accent/10 border border-primary/20"
                        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                      />
                    )}
                    {isActive && (
                      <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-primary to-accent rounded-full shadow-[0_0_12px_rgba(93,224,230,0.5)]" />
                    )}
                    <item.icon className={cn("relative z-10 h-5 w-5 flex-shrink-0 transition-colors duration-300", isActive && "text-primary")} />
                    <AnimatePresence>
                      {!collapsed && (
                        <motion.span
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          transition={{ duration: 0.2 }}
                          className="relative z-10 text-sm font-medium"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {collapsed && (
                      <div className="absolute left-full ml-2 px-2 py-1 bg-card border border-border rounded-md text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                        {item.label}
                      </div>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Bottom Section */}
        <div className="p-3 border-t border-white/5">
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-3 rounded-xl bg-gradient-to-br from-primary/10 to-accent/5 border border-primary/10"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold text-foreground">Vuei Platform</span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Portal Master v2.0
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 w-72 z-50 flex flex-col border-r border-white/5 bg-background/95 backdrop-blur-xl lg:hidden"
            >
              <div className="h-16 flex items-center justify-between px-4 border-b border-white/5">
                <Link href="/master" className="flex items-center gap-3">
                  <div className="relative w-8 h-8">
                    <Image src="/vuei-logo.png" alt="Vuei" fill className="object-contain" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">Vuei</span>
                    <span className="text-[10px] font-medium text-primary/80 uppercase tracking-wider">Master</span>
                  </div>
                </Link>
                <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} className="h-8 w-8">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <nav className="flex-1 py-6 px-3 overflow-y-auto">
                <ul className="space-y-1">
                  {navItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== "/master" && pathname.startsWith(item.href))
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={cn(
                            "relative flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300",
                            isActive
                              ? "text-foreground bg-gradient-to-r from-primary/20 to-accent/10 border border-primary/20"
                              : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                          )}
                        >
                          <item.icon className={cn("h-5 w-5", isActive && "text-primary")} />
                          <span className="text-sm font-medium">{item.label}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className={cn("min-h-screen transition-all duration-300", collapsed ? "lg:pl-20" : "lg:pl-[260px]")}>
        {/* Header */}
        <header className={cn(
          "sticky top-0 z-30 h-16 flex items-center justify-between px-4 lg:px-8 transition-all duration-300",
          scrolled ? "bg-background/80 backdrop-blur-xl border-b border-white/5 shadow-[0_4px_20px_rgba(0,0,0,0.3)]" : "bg-transparent"
        )}>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} className="lg:hidden h-9 w-9">
              <Menu className="h-5 w-5" />
            </Button>
            <button
              onClick={() => setSearchOpen(true)}
              className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors cursor-pointer group"
            >
              <Search className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">Buscar...</span>
              <div className="flex items-center gap-1 ml-8">
                <kbd className="px-1.5 py-0.5 text-[10px] font-medium bg-white/5 border border-white/10 rounded text-muted-foreground">
                  <Command className="h-2.5 w-2.5 inline" />
                </kbd>
                <kbd className="px-1.5 py-0.5 text-[10px] font-medium bg-white/5 border border-white/10 rounded text-muted-foreground">K</kbd>
              </div>
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Credits Badge */}
            <Link
              href="/master/creditos"
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 hover:border-primary/40 transition-colors"
            >
              <Coins className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold text-foreground">{(credits.totalAvailable / 1000).toFixed(1)}M</span>
              <span className="text-[10px] text-muted-foreground">creditos</span>
            </Link>

            {/* Notifications */}
            <DropdownMenu open={notificationsOpen} onOpenChange={setNotificationsOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-9 w-9 hover:bg-white/5">
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-primary rounded-full text-[10px] font-bold flex items-center justify-center text-black">
                      {unreadCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 bg-card/95 backdrop-blur-xl border-white/10">
                <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
                  <span className="text-sm font-semibold">Notificacoes</span>
                  {unreadCount > 0 && (
                    <button onClick={markAllNotificationsRead} className="text-xs text-primary hover:underline">
                      Marcar todas como lidas
                    </button>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Sem notificacoes</p>
                  ) : (
                    notifications.slice(0, 5).map(notification => (
                      <div
                        key={notification.id}
                        onClick={() => markNotificationRead(notification.id)}
                        className={cn(
                          "px-4 py-3 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors",
                          !notification.read && "bg-primary/5"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            "w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
                            notification.type === "success" && "bg-emerald-400",
                            notification.type === "warning" && "bg-amber-400",
                            notification.type === "error" && "bg-red-400",
                            notification.type === "info" && "bg-primary"
                          )} />
                          <div>
                            <p className="text-sm font-medium">{notification.title}</p>
                            <p className="text-xs text-muted-foreground">{notification.message}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-9 gap-2 px-2 hover:bg-white/5">
                  <Avatar className="h-7 w-7 border border-white/10">
                    <AvatarImage src={profile?.avatarUrl || undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-[10px] font-semibold text-white">{profileInitials}</AvatarFallback>
                  </Avatar>
                  <div className="hidden md:flex flex-col items-start">
                    <span className="text-xs font-medium">{profileName}</span>
                    <span className="text-[10px] text-muted-foreground">Master</span>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-card/95 backdrop-blur-xl border-white/10">
                <DropdownMenuItem className="text-xs gap-2" onClick={() => router.push("/master/configuracoes")}>
                  <User className="h-3.5 w-3.5" />
                  Meu Perfil
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs gap-2" onClick={() => router.push("/master/configuracoes")}>
                  <Shield className="h-3.5 w-3.5" />
                  Seguranca
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs gap-2" onClick={() => router.push("/master/configuracoes")}>
                  <Settings className="h-3.5 w-3.5" />
                  Configuracoes
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/5" />
                <DropdownMenuItem className="text-xs text-red-400 gap-2" onClick={() => void handleSignOut()}>
                  <LogOut className="h-3.5 w-3.5" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="p-4 lg:p-8">
          {loadingState ? (
            <div className="rounded-2xl border border-white/5 bg-card/40 p-6 text-sm text-muted-foreground">
              Carregando dados do portal master...
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  )
}
