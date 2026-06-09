import type { GeneratedItineraryContent } from "@/lib/ai/itinerary-generation"

interface TripPdfBranding {
  agencyName: string | null
  agencyLogoUrl: string | null
}

interface TripPdfInput {
  title: string
  destination: string
  country: string | null
  startDate: string | null
  endDate: string | null
  travelersCount: number
  travelersLabel: string
  tripSummary: string | null
  usefulInfo: string[]
  contacts: Array<{ label: string; value: string }>
  branding: TripPdfBranding
  content: GeneratedItineraryContent
}

interface PdfLine {
  text: string
  size?: number
  color?: [number, number, number]
  gapAfter?: number
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")
}

function formatDate(value: string | null) {
  if (!value) return "Nao informado"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function wrapText(text: string, maxChars = 88) {
  if (!text.trim()) return [""]

  const words = text.trim().split(/\s+/)
  const lines: string[] = []
  let current = ""

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= maxChars) {
      current = candidate
      continue
    }

    if (current) lines.push(current)
    current = word
  }

  if (current) lines.push(current)
  return lines
}

function buildPdfLines(input: TripPdfInput): PdfLine[] {
  const headerName = input.branding.agencyName || "Vuei"
  const travelWindow = `${formatDate(input.startDate)} a ${formatDate(input.endDate)}`
  const lines: PdfLine[] = [
    { text: headerName, size: 24, color: [0.0, 0.29, 0.68], gapAfter: 10 },
    { text: input.branding.agencyName ? "Roteiro completo com branding da agencia" : "Roteiro completo criado com Vuei", size: 11, color: [0.18, 0.23, 0.32], gapAfter: 18 },
    { text: input.title, size: 22, color: [0.06, 0.12, 0.18], gapAfter: 8 },
    { text: `${input.destination}${input.country ? ` • ${input.country}` : ""}`, size: 14, color: [0.18, 0.23, 0.32], gapAfter: 4 },
    { text: `Datas: ${travelWindow}`, size: 12, color: [0.18, 0.23, 0.32], gapAfter: 2 },
    { text: `Viajantes: ${input.travelersLabel || `${input.travelersCount} pessoa(s)`}`, size: 12, color: [0.18, 0.23, 0.32], gapAfter: 18 },
  ]

  if (input.tripSummary) {
    lines.push({ text: "Resumo da viagem", size: 16, color: [0.0, 0.52, 0.78], gapAfter: 8 })
    for (const summaryLine of wrapText(input.tripSummary, 92)) {
      lines.push({ text: summaryLine, size: 11, color: [0.12, 0.16, 0.24], gapAfter: 3 })
    }
    lines.push({ text: "", gapAfter: 10 })
  }

  if (input.content.summary) {
    lines.push({ text: "Visao geral do roteiro", size: 16, color: [0.0, 0.52, 0.78], gapAfter: 8 })
    for (const summaryLine of wrapText(input.content.summary, 92)) {
      lines.push({ text: summaryLine, size: 11, color: [0.12, 0.16, 0.24], gapAfter: 3 })
    }
    lines.push({ text: "", gapAfter: 10 })
  }

  for (const day of input.content.days) {
    lines.push({ text: `Dia ${day.day} • ${day.title}`, size: 16, color: [0.0, 0.29, 0.68], gapAfter: 6 })
    if (day.date) {
      lines.push({ text: day.date, size: 11, color: [0.2, 0.24, 0.34], gapAfter: 6 })
    }
    if (day.summary) {
      for (const line of wrapText(day.summary, 92)) {
        lines.push({ text: line, size: 11, color: [0.12, 0.16, 0.24], gapAfter: 3 })
      }
    }

    for (const activity of day.activities) {
      const activityTitle = [activity.time, activity.title].filter(Boolean).join(" • ")
      lines.push({ text: activityTitle || "Atividade", size: 12, color: [0.06, 0.12, 0.18], gapAfter: 3 })
      if (activity.location) {
        lines.push({ text: `Local: ${activity.location}`, size: 10, color: [0.2, 0.24, 0.34], gapAfter: 2 })
      }
      if (activity.description) {
        for (const line of wrapText(activity.description, 88)) {
          lines.push({ text: `- ${line}`, size: 10, color: [0.18, 0.22, 0.32], gapAfter: 2 })
        }
      }
      lines.push({ text: "", gapAfter: 3 })
    }

    if (day.tips) {
      lines.push({ text: `Dica: ${day.tips}`, size: 10, color: [0.0, 0.52, 0.78], gapAfter: 4 })
    }
    if (day.important) {
      lines.push({ text: `Importante: ${day.important}`, size: 10, color: [0.72, 0.18, 0.16], gapAfter: 4 })
    }

    lines.push({ text: "", gapAfter: 10 })
  }

  if (input.usefulInfo.length > 0 || input.content.usefulTips.length > 0) {
    lines.push({ text: "Dicas uteis", size: 16, color: [0.0, 0.52, 0.78], gapAfter: 8 })
    for (const info of [...input.usefulInfo, ...input.content.usefulTips]) {
      for (const line of wrapText(`- ${info}`, 92)) {
        lines.push({ text: line, size: 10, color: [0.18, 0.22, 0.32], gapAfter: 2 })
      }
    }
    lines.push({ text: "", gapAfter: 10 })
  }

  if (input.content.observations.length > 0) {
    lines.push({ text: "Observacoes", size: 16, color: [0.0, 0.52, 0.78], gapAfter: 8 })
    for (const observation of input.content.observations) {
      for (const line of wrapText(`- ${observation}`, 92)) {
        lines.push({ text: line, size: 10, color: [0.18, 0.22, 0.32], gapAfter: 2 })
      }
    }
    lines.push({ text: "", gapAfter: 10 })
  }

  if (input.contacts.length > 0 || input.content.contacts.length > 0) {
    lines.push({ text: "Contatos importantes", size: 16, color: [0.0, 0.52, 0.78], gapAfter: 8 })
    for (const contact of [...input.contacts, ...input.content.contacts]) {
      lines.push({ text: `${contact.label}: ${contact.value}`, size: 10, color: [0.18, 0.22, 0.32], gapAfter: 3 })
    }
  }

  return lines
}

export function buildTripItineraryPdf(input: TripPdfInput) {
  const lines = buildPdfLines(input)
  const pageWidth = 595
  const pageHeight = 842
  const left = 48
  const top = 780
  const bottom = 56
  const pages: string[] = []
  let currentPage = ""
  let currentY = top

  function startPage() {
    currentPage = "BT\n/F1 11 Tf\n"
    currentY = top
  }

  function pushPage() {
    currentPage += "ET\n"
    pages.push(currentPage)
  }

  startPage()

  for (const line of lines) {
    const size = line.size ?? 11
    const gapAfter = line.gapAfter ?? 4
    const color = line.color ?? [0.12, 0.16, 0.24]
    const lineHeight = size + gapAfter

    if (currentY - lineHeight < bottom) {
      pushPage()
      startPage()
    }

    currentPage += `${color[0].toFixed(3)} ${color[1].toFixed(3)} ${color[2].toFixed(3)} rg\n`
    currentPage += `/F1 ${size} Tf\n`
    currentPage += `1 0 0 1 ${left} ${currentY} Tm\n`
    currentPage += `(${escapePdfText(line.text)}) Tj\n`
    currentY -= lineHeight
  }

  currentY -= 18
  if (currentY < bottom) {
    pushPage()
    startPage()
  }
  currentPage += "0.200 0.240 0.340 rg\n/F1 10 Tf\n"
  currentPage += `1 0 0 1 ${left} ${currentY} Tm\n(Criado com Vuei) Tj\n`
  pushPage()

  const objects: string[] = []
  objects.push("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj")

  const kids = pages.map((_, index) => `${3 + index * 2} 0 R`).join(" ")
  objects.push(`2 0 obj << /Type /Pages /Kids [${kids}] /Count ${pages.length} >> endobj`)

  pages.forEach((content, index) => {
    const pageObjectNumber = 3 + index * 2
    const contentObjectNumber = pageObjectNumber + 1
    objects.push(`${pageObjectNumber} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${3 + pages.length * 2} 0 R >> >> /Contents ${contentObjectNumber} 0 R >> endobj`)
    objects.push(`${contentObjectNumber} 0 obj << /Length ${content.length} >> stream\n${content}endstream\nendobj`)
  })

  const fontObjectNumber = 3 + pages.length * 2
  objects.push(`${fontObjectNumber} 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj`)

  let pdf = "%PDF-1.4\n"
  const offsets: number[] = [0]
  for (const object of objects) {
    offsets.push(pdf.length)
    pdf += `${object}\n`
  }

  const xrefOffset = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += "0000000000 65535 f \n"
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${offsets[index].toString().padStart(10, "0")} 00000 n \n`
  }

  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  return Buffer.from(pdf, "utf-8")
}
