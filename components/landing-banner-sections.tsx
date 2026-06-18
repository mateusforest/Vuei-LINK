"use client"

import Image from "next/image"
import Link from "next/link"

type BannerSectionProps = {
  id?: string
  src: string
  alt: string
  width: number
  height: number
  priority?: boolean
  eager?: boolean
  className?: string
  imageClassName?: string
  sizes: string
  ctaHref?: string
  ctaLabel?: string
  ctaClassName?: string
}

function BannerSection({
  id,
  src,
  alt,
  width,
  height,
  priority = false,
  eager = false,
  className = "",
  imageClassName = "",
  sizes,
  ctaHref,
  ctaLabel,
  ctaClassName,
}: BannerSectionProps) {
  return (
    <section id={id} className={className}>
      <div className="relative overflow-hidden rounded-[28px] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:rounded-[34px]">
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          priority={priority}
          loading={eager ? "eager" : "lazy"}
          sizes={sizes}
          className={`block h-auto w-full ${imageClassName}`.trim()}
        />
        {ctaHref ? (
          <Link
            href={ctaHref}
            aria-label={ctaLabel}
            className={`absolute focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b56d8] focus-visible:ring-offset-4 ${ctaClassName ?? ""}`.trim()}
          />
        ) : null}
      </div>
    </section>
  )
}

export function LandingBannerSections() {
  return (
    <div className="relative px-4 pb-12 pt-28 sm:px-6 sm:pb-16 sm:pt-32 lg:px-8 lg:pb-20 lg:pt-36">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(circle_at_top_left,rgba(93,224,230,0.1),transparent_28%),radial-gradient(circle_at_top_right,rgba(0,74,173,0.08),transparent_24%),linear-gradient(180deg,#fbfbfd_0%,rgba(245,247,250,0.92)_62%,rgba(244,246,249,0)_100%)]" />

      <div className="relative z-10 mx-auto flex w-full max-w-[1880px] flex-col gap-4 sm:gap-5 lg:gap-6">
        <BannerSection
          src="/images/landing-hero-banner.png"
          alt="Banner principal do Vuei com o texto Sua viagem. Sem caos."
          width={2560}
          height={1200}
          priority
          eager
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) calc(100vw - 48px), 1880px"
          className="scroll-mt-32"
          ctaHref="/signup"
          ctaLabel="Criar minha viagem"
          ctaClassName="left-[8.4%] top-[63.4%] h-[10.6%] w-[20.5%] min-w-[10rem] rounded-[1.1rem] md:left-[8.9%] md:top-[64.1%] md:h-[10.2%] md:w-[18.4%]"
        />

        <BannerSection
          id="como-funciona"
          src="/images/landing-antes-depois-banner.png"
          alt="Antes e depois de organizar a viagem com o Vuei."
          width={2560}
          height={800}
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) calc(100vw - 48px), 1880px"
          className="scroll-mt-32"
        />

        <BannerSection
          id="concierge"
          src="/images/landing-concierge-banner.png"
          alt="Banner do concierge do Vuei com perguntas e respostas da viagem."
          width={2560}
          height={850}
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) calc(100vw - 48px), 1880px"
          className="scroll-mt-32"
        />

        <BannerSection
          src="/images/landing-compartilhamento-banner.png"
          alt="Banner de compartilhamento do Vuei mostrando a viagem compartilhada com toda a familia."
          width={2560}
          height={700}
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) calc(100vw - 48px), 1880px"
          imageClassName="-mb-[12.5%] -mt-[12.5%] scale-[1.001]"
        />

        <BannerSection
          src="/images/landing-cta-final-banner.png"
          alt="Banner final do Vuei com chamada para criar viagem."
          width={2560}
          height={650}
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) calc(100vw - 48px), 1880px"
          ctaHref="/signup"
          ctaLabel="Criar viagem"
          ctaClassName="left-[40.2%] top-[46%] h-[24%] w-[19.6%] min-w-[10rem] rounded-[1.2rem] md:left-[40.5%] md:top-[46.2%] md:h-[24.4%] md:w-[19.3%]"
        />
      </div>
    </div>
  )
}
