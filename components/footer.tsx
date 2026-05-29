"use client"

import { motion, useInView } from "framer-motion"
import { useRef } from "react"
import Image from "next/image"
import Link from "next/link"

export function Footer() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-50px" })

  return (
    <footer className="relative py-16 overflow-hidden" ref={ref}>
      <div className="relative z-10 max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="flex flex-col md:flex-row items-center justify-between gap-8"
        >
          {/* Logo */}
          <Image
            src="/vuei-logo.png"
            alt="Vuei"
            width={100}
            height={34}
            className="h-8 w-auto opacity-60 hover:opacity-100 transition-opacity"
          />

          {/* Copyright */}
          <p className="text-sm text-white/30">
            © {new Date().getFullYear()} Vuei. Todos os direitos reservados.
          </p>

          {/* Links */}
          <div className="flex items-center gap-6">
            <Link href="/privacidade" className="text-sm text-white/40 hover:text-white transition-colors">
              Privacidade
            </Link>
            <Link href="/termos" className="text-sm text-white/40 hover:text-white transition-colors">
              Termos
            </Link>
          </div>
        </motion.div>
      </div>
    </footer>
  )
}
