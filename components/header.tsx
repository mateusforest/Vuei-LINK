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
      className={`fixed top-4 left-1/2 z-50 w-[95%] max-w-6xl -translate-x-1/2 transition-all duration-500 ${
        isScrolled
          ? "rounded-[22px] border border-black/6 bg-white/72 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur-2xl"
          : "bg-transparent"
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
              className="group relative text-sm text-black/68 transition-colors duration-300 hover:text-black"
            >
              {item.label}
              <span className="absolute -bottom-1 left-0 h-px w-0 bg-gradient-to-r from-[#5de0e6] to-[#004aad] transition-all duration-300 group-hover:w-full" />
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
            href="/cadastro"
            className="group relative inline-flex items-center overflow-hidden rounded-full bg-gradient-to-r from-[#32b8ff] to-[#0b56d8] px-6 py-2.5 text-sm font-medium text-white shadow-[0_12px_30px_rgba(11,86,216,0.22)]"
          >
            <span className="relative z-10">Criar minha viagem</span>
            <div className="absolute inset-0 bg-gradient-to-r from-[#0b56d8] to-[#32b8ff] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
          </Link>
        </motion.div>

        {/* Mobile Menu Toggle */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="text-black/75 transition-colors hover:text-black md:hidden"
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
            className="overflow-hidden rounded-b-[22px] border-x border-b border-black/6 bg-white/92 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-2xl md:hidden"
          >
            <div className="px-6 py-4 space-y-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block text-black/72 transition-colors hover:text-black"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/cadastro"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block w-full rounded-full bg-gradient-to-r from-[#32b8ff] to-[#0b56d8] px-6 py-3 text-center text-sm font-medium text-white"
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
