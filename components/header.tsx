"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"
import Link from "next/link"
import { Menu, X } from "lucide-react"

const navItems = [
  { label: "Como funciona", href: "#como-funciona" },
  { label: "Concierge", href: "#concierge" },
  { label: "Entrar", href: "/login" },
]

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-6xl transition-all duration-500 ${
        isScrolled ? "vuei-glass rounded-2xl" : "bg-transparent"
      }`}
    >
      <nav className="flex items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link href="/" className="relative group">
          <motion.div
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.3 }}
          >
            <Image
              src="/vuei-logo.png"
              alt="Vuei"
              width={140}
              height={48}
              className="h-12 w-auto"
              priority
            />
          </motion.div>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-8">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-white/70 hover:text-white transition-colors duration-300 relative group"
            >
              {item.label}
              <span className="absolute -bottom-1 left-0 w-0 h-px bg-gradient-to-r from-[#5de0e6] to-[#004aad] group-hover:w-full transition-all duration-300" />
            </Link>
          ))}
        </div>

        {/* CTA Button */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="hidden md:block"
        >
          <Link
            href="/onboarding"
            className="relative inline-flex items-center px-6 py-2.5 text-sm font-medium text-black bg-gradient-to-r from-[#5de0e6] to-[#004aad] rounded-xl overflow-hidden group"
          >
            <span className="relative z-10">Criar minha viagem</span>
            <div className="absolute inset-0 bg-gradient-to-r from-[#004aad] to-[#5de0e6] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          </Link>
        </motion.div>

        {/* Mobile Menu Toggle */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden text-white/80 hover:text-white transition-colors"
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="md:hidden vuei-glass rounded-b-2xl overflow-hidden"
          >
            <div className="px-6 py-4 space-y-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block text-white/70 hover:text-white transition-colors"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/onboarding"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block w-full text-center px-6 py-3 text-sm font-medium text-black bg-gradient-to-r from-[#5de0e6] to-[#004aad] rounded-xl"
              >
                Criar minha viagem
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
