"use client"

import { useEffect, useState } from "react"
import Image, { type ImageProps } from "next/image"
import { normalizeImageUrl } from "@/lib/trip-destination"

type ImageWithFallbackProps = Omit<ImageProps, "src"> & {
  src?: string | null
  fallbackSrc: string
}

export function ImageWithFallback({ src, fallbackSrc, onError, ...props }: ImageWithFallbackProps) {
  const [currentSrc, setCurrentSrc] = useState(() => normalizeImageUrl(src) ?? fallbackSrc)

  useEffect(() => {
    setCurrentSrc(normalizeImageUrl(src) ?? fallbackSrc)
  }, [src, fallbackSrc])

  return (
    <Image
      {...props}
      src={currentSrc}
      onError={(event) => {
        onError?.(event)
        setCurrentSrc((previous) => (previous === fallbackSrc ? previous : fallbackSrc))
      }}
    />
  )
}
