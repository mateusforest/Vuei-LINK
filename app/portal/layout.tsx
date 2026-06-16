"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Home, 
  Plane, 
  FileText, 
  MessageCircle, 
  Coins, 
  Share2, 
  WifiOff, 
  Settings,
  Plus,
  ChevronLeft,
  ChevronRight,
  User
} from "lucide-react"
import { useIsMobile } from "@/components/ui/use-mobile"
import { cn } from "@/lib/utils"
import { TripsProvider, useTrips } from "@/contexts/trips-context"
import { RouteGuard } from "@/components/auth/route-guard"
import { useAuth } from "@/contexts/auth-context"
import { CreateTripButton } from "@/components/portal/create-trip-button"

const navItems = [
  { href: "/portal", icon: Home, label: "Início" },
  { href: "/portal/viagem", icon: Plane, label: "Viagem" },
  { href: "/portal/documentos", icon: FileText, label: "Documentos" },
  { href: "/portal/concierge", icon: MessageCircle, label: "Concierge" },
  { href: "/portal/creditos", icon: Coins, label: "Créditos" },
]

const secondaryNavItems = [
  { href: "/portal/compartilhar", icon: Share2, label: "Compartilhar" },
  { href: "/portal/offline", icon: WifiOff, label: "Offline" },
  { href: "/portal/configuracoes", icon: Settings, label: "Configurações" },
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
  const isMobile = useIsMobile()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { credits } = useTrips()
  const { profile } = useAuth()
  const firstName = profile?.name?.trim().split(" ")[0] ?? ""
  const initials = profile?.name
    ? profile.name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("")
    : "VP"

  return (
    <div className="portal-shell min-h-screen bg-background text-foreground">
      {/* Desktop Sidebar */}
      {!isMobile && (
        <motion.aside
          initial={false}
          animate={{ width: sidebarCollapsed ? 80 : 240 }}
          className="fixed left-0 top-0 z-40 h-full border-r border-border/60 vuei-glass"
        >
          <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="p-6 flex items-center justify-between">
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
                className="p-2 rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
              >
                {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </button>
            </div>

            {/* Main Navigation */}
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
                          : "text-muted-foreground hover:bg-[#f8fafc] hover:text-foreground"
                      )}
                    >
                      <item.icon size={20} className={isActive ? "text-primary" : ""} />
                      <AnimatePresence>
                        {!sidebarCollapsed && (
                          <motion.span
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: "auto" }}
                            exit={{ opacity: 0, width: 0 }}
                            className="font-medium text-sm whitespace-nowrap overflow-hidden"
                          >
                            {item.label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </Link>
                  )
                })}
              </div>

              {/* Create Trip Button */}
              <div className="my-6 px-1">
                <CreateTripButton
                  className={cn(
                    "flex w-full items-center justify-center gap-2 rounded-xl py-3 font-semibold transition-all duration-300",
                    "bg-gradient-to-r from-[#37beff] to-[#0b56d8] text-white shadow-[0_18px_36px_rgba(11,86,216,0.18)] hover:opacity-95",
                    sidebarCollapsed ? "px-3" : "px-4"
                  )}
                >
                  <Plus size={20} />
                  {!sidebarCollapsed && <span>Nova Viagem</span>}
                </CreateTripButton>
              </div>

              {/* Secondary Navigation */}
              <div className="space-y-1 border-t border-border/60 pt-4">
                {secondaryNavItems.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-3 transition-all duration-300",
                        isActive
                          ? "bg-gradient-to-r from-[#37beff]/14 to-[#0b56d8]/12 text-[#0b56d8] shadow-[inset_0_0_0_1px_rgba(11,86,216,0.08)]"
                          : "text-muted-foreground hover:bg-[#f8fafc] hover:text-foreground"
                      )}
                    >
                      <item.icon size={20} className={isActive ? "text-primary" : ""} />
                      <AnimatePresence>
                        {!sidebarCollapsed && (
                          <motion.span
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: "auto" }}
                            exit={{ opacity: 0, width: 0 }}
                            className="font-medium text-sm whitespace-nowrap overflow-hidden"
                          >
                            {item.label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </Link>
                  )
                })}
              </div>
            </nav>

            {/* User Profile */}
            <div className="p-4 border-t border-border/50">
            <div className={cn(
                "flex cursor-pointer items-center gap-3 rounded-xl p-2 transition-colors hover:bg-[#f8fafc]",
                sidebarCollapsed && "justify-center"
              )}>
                <div className="relative w-10 h-10 overflow-hidden rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  {profile?.avatarUrl ? (
                    <Image src={profile.avatarUrl} alt={profile.name} fill className="object-cover rounded-full" />
                  ) : (
                    <span className="text-sm font-semibold text-primary-foreground">{initials}</span>
                  )}
                </div>
                {!sidebarCollapsed && (
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{firstName || "Conta"}</p>
                    <p className="text-xs text-muted-foreground truncate">{profile?.email ?? "Portal Vuei"}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.aside>
      )}

      {/* Mobile Header */}
      {isMobile && (
        <header className="fixed left-0 right-0 top-0 z-40 border-b border-border/60 vuei-glass">
          <div className="flex items-center justify-between px-4 py-3">
            <Link href="/portal">
              <Image
                src="/vuei-logo.png"
                alt="Vuei"
                width={80}
                height={28}
                className="object-contain"
              />
            </Link>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-border/60 bg-white/80 px-3 py-1.5">
                <Coins size={14} className="text-primary" />
                <span className="text-xs font-medium">{credits.balance}</span>
              </div>
              <Link
                href="/portal/configuracoes"
                aria-label="Abrir configuracoes"
                className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#37beff] to-[#0b56d8] ring-1 ring-border/50 transition-transform duration-200 active:scale-95"
              >
                {profile?.avatarUrl ? (
                  <Image src={profile.avatarUrl} alt={profile.name} fill className="object-cover rounded-full" />
                ) : (
                  <span className="text-[10px] font-semibold text-primary-foreground">{initials}</span>
                )}
              </Link>
            </div>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main
        className={cn(
          "min-h-screen transition-all duration-300",
          isMobile ? "pt-16 pb-24 px-4" : sidebarCollapsed ? "ml-20 p-8" : "ml-60 p-8"
        )}
      >
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 vuei-glass">
          <div className="flex items-center justify-around py-2 px-2">
            {navItems.slice(0, 4).map((item) => {
              const isActive = pathname === item.href || (item.href !== "/portal" && pathname.startsWith(item.href))
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl px-4 py-2 transition-all duration-300",
                    isActive
                      ? "bg-gradient-to-b from-[#37beff]/10 to-[#0b56d8]/10 text-[#0b56d8]"
                      : "text-muted-foreground"
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
    </div>
  )
}
