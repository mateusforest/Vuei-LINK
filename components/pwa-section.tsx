"use client"

import { motion, useInView } from "framer-motion"
import Image from "next/image"
import { useRef } from "react"

export function PWASection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  return (
    <section id="pwa" className="relative py-32 overflow-hidden" ref={ref}>
      {/* Background */}
      <div className="absolute inset-0 vuei-grid opacity-30" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="w-full"
        >
          <Image
            src="/images/vuei-install-banner.png"
            alt="Banner oficial de instalacao do Vuei"
            width={1876}
            height={839}
            className="block h-auto w-full"
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 92vw, 1280px"
            priority={false}
          />
        </motion.div>
      </div>
    </section>
  )
}
