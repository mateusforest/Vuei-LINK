"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { LucideIcon, ChevronRight } from "lucide-react"
import { Card } from "@/components/ui/card"

interface QuickAction {
  icon: LucideIcon
  label: string
  description: string
  href: string
  gradient: string
}

export function QuickActionCard({ action, index }: { action: QuickAction; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
    >
      <Link href={action.href}>
        <Card className="p-4 md:p-5 bg-card/50 border-border/50 vuei-glass group cursor-pointer hover:border-primary/30 transition-all duration-300 h-full">
          <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br ${action.gradient} flex items-center justify-center mb-3`}>
            <action.icon size={20} className="text-primary" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm md:text-base group-hover:text-primary transition-colors">
                {action.label}
              </h3>
              <ChevronRight size={14} className="text-muted-foreground group-hover:text-primary transition-colors hidden md:block" />
            </div>
            <p className="text-xs text-muted-foreground line-clamp-1">
              {action.description}
            </p>
          </div>
        </Card>
      </Link>
    </motion.div>
  )
}
