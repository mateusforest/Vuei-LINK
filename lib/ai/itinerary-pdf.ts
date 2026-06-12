import { readFile } from "node:fs/promises"
import path from "node:path"
import type { GeneratedItineraryContent, GeneratedItineraryDay, GeneratedItineraryActivity } from "@/lib/ai/itinerary-generation"
type ChromiumRuntime = typeof import("@sparticuz/chromium")["default"]
type PuppeteerRuntime = typeof import("puppeteer-core")["default"]

interface TripPdfBranding {
  agencyName: string | null
  agencyLogoUrl: string | null
  consultantName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  website?: string | null
  isAgency?: boolean
}

interface TripPdfFlight {
  airline: string | null
  flightNumber: string | null
  bookingReference: string | null
  originAirport: string | null
  destinationAirport: string | null
  departureAt: string | null
  arrivalAt: string | null
  passengerName: string | null
  terminal: string | null
  gate: string | null
  seat: string | null
  baggageInfo: string | null
}

interface TripPdfHotel {
  name: string | null
  address: string | null
  checkIn: string | null
  checkOut: string | null
  confirmationCode: string | null
  notes: string | null
}

interface TripPdfDocument {
  name: string
  type: string
}

interface TripPdfQuickInfo {
  currency?: string | null
  language?: string | null
  timezone?: string | null
  weather?: string | null
  emergency?: string | null
  baggage?: string | null
  documents?: string[] | null
}

interface TripPdfInput {
  title: string
  destination: string
  country: string | null
  startDate: string | null
  endDate: string | null
  travelersCount: number
  travelersLabel: string
  travelerName: string | null
  tripSummary: string | null
  heroImage: string | null
  usefulInfo: string[]
  contacts: Array<{ label: string; value: string }>
  branding: TripPdfBranding
  hotels: TripPdfHotel[]
  flights: TripPdfFlight[]
  documents: TripPdfDocument[]
  quickInfo: TripPdfQuickInfo
  content: GeneratedItineraryContent
}

const PRIMARY = "#1f8fd6"
const SECONDARY = "#37c6e0"
const DARK = "#0f172a"
const TEXT = "#1f2937"
const MUTED = "#6b7280"
const BORDER = "#dbe7f3"
const SOFT = "#eef7fb"

function logItineraryPdfDev(stage: string, details?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") return
  console.log("[AI][ITINERARY][PDF]", stage, details ?? {})
}

async function loadPuppeteerRuntime(): Promise<PuppeteerRuntime> {
  const module = await import("puppeteer-core")
  return module.default
}

async function loadChromiumRuntime(): Promise<ChromiumRuntime> {
  const module = await import("@sparticuz/chromium")
  return module.default
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function safeText(value: string | null | undefined, fallback = "Nao informado") {
  return value && value.trim() ? escapeHtml(value.trim()) : fallback
}

function formatDate(value: string | null | undefined, fallback = "Nao informado") {
  if (!value) return fallback
  const parsed = new Date(`${value}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return escapeHtml(value)
  return escapeHtml(
    parsed.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
  )
}

function calculateTripDuration(startDate: string | null | undefined, endDate: string | null | undefined) {
  if (!startDate || !endDate) return null
  const start = new Date(`${startDate}T12:00:00`)
  const end = new Date(`${endDate}T12:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null
  const days = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1
  return `${days} dia(s)`
}

function groupActivitiesByPeriod(day: GeneratedItineraryDay) {
  return {
    morning: day.activities.filter((activity) => activity.period === "morning"),
    afternoon: day.activities.filter((activity) => activity.period === "afternoon"),
    evening: day.activities.filter((activity) => activity.period === "evening"),
    flexible: day.activities.filter((activity) => activity.period === "flexible"),
  }
}

function periodLabel(period: "morning" | "afternoon" | "evening" | "flexible") {
  switch (period) {
    case "morning":
      return "Manha"
    case "afternoon":
      return "Tarde"
    case "evening":
      return "Noite"
    default:
      return "Flexivel"
  }
}

function activityTypeLabel(type: GeneratedItineraryActivity["type"]) {
  switch (type) {
    case "food":
      return "Gastronomia"
    case "transport":
      return "Transportes"
    case "experience":
      return "Experiencia"
    case "flight":
      return "Voo"
    case "hotel":
      return "Hospedagem"
    case "attraction":
      return "Passeio"
    default:
      return "Atividade"
  }
}

async function assetToDataUrl(url: string | null | undefined) {
  if (!url) return null

  try {
    if (url.startsWith("data:")) return url

    if (url.startsWith("http://") || url.startsWith("https://")) {
      const response = await fetch(url)
      if (!response.ok) return url
      const contentType = response.headers.get("content-type") || "image/png"
      const buffer = Buffer.from(await response.arrayBuffer())
      return `data:${contentType};base64,${buffer.toString("base64")}`
    }

    const normalized = url.startsWith("/") ? url.slice(1) : url
    const localPath = path.join(/* turbopackIgnore: true */ process.cwd(), "public", normalized)
    const file = await readFile(localPath)
    const extension = path.extname(localPath).toLowerCase()
    const contentType =
      extension === ".svg"
        ? "image/svg+xml"
        : extension === ".jpg" || extension === ".jpeg"
          ? "image/jpeg"
          : extension === ".webp"
            ? "image/webp"
            : "image/png"

    return `data:${contentType};base64,${file.toString("base64")}`
  } catch {
    return url
  }
}

function renderPeriodCard(title: string, activities: GeneratedItineraryActivity[]) {
  if (activities.length === 0) {
    return `
      <div class="period-card">
        <div class="period-title">${title}</div>
        <p class="period-empty">Sem atividade confirmada para este periodo.</p>
      </div>
    `
  }

  return `
    <div class="period-card">
      <div class="period-title">${title}</div>
      <div class="period-list">
        ${activities
          .map(
            (activity) => `
              <div class="period-item">
                <div class="period-item-head">
                  <span class="period-time">${safeText(activity.time, "Sugestao")}</span>
                  <span class="period-type">${activityTypeLabel(activity.type)}</span>
                </div>
                <div class="period-name">${safeText(activity.title)}</div>
                <div class="period-location">${safeText(activity.location, "Local a confirmar")}</div>
                ${activity.description ? `<div class="period-description">${safeText(activity.description, "")}</div>` : ""}
              </div>
            `,
          )
          .join("")}
      </div>
    </div>
  `
}

function renderExperiences(days: GeneratedItineraryDay[]) {
  const cards = days.flatMap((day) =>
    day.activities
      .filter((activity) => activity.highlight || activity.type === "experience" || activity.type === "food" || activity.type === "transport")
      .slice(0, 3)
      .map((activity) => ({
        day: day.day,
        date: day.date,
        activity,
      })),
  )

  if (cards.length === 0) {
    return `<div class="empty-card">Nenhuma experiencia adicional foi cadastrada alem do roteiro dia a dia.</div>`
  }

  return `
    <div class="experience-grid">
      ${cards
        .map(
          ({ day, date, activity }) => `
            <article class="experience-card">
              <div class="experience-chip">Dia ${day}${date ? ` • ${safeText(date, "")}` : ""}</div>
              <h3>${safeText(activity.title)}</h3>
              <p class="experience-meta">${activityTypeLabel(activity.type)}${activity.location ? ` • ${safeText(activity.location, "")}` : ""}</p>
              ${activity.description ? `<p class="experience-description">${safeText(activity.description, "")}</p>` : ""}
            </article>
          `,
        )
        .join("")}
    </div>
  `
}

function renderImportantInfo(input: TripPdfInput) {
  const documentItems = input.documents.length
    ? input.documents.map((document) => `<li><strong>${safeText(document.name)}</strong> • ${safeText(document.type)}</li>`).join("")
    : `<li>Nenhum documento adicional cadastrado.</li>`

  const baggageInfo = input.flights.map((flight) => flight.baggageInfo).filter((value): value is string => Boolean(value && value.trim()))
  const flightContacts = input.contacts.length
    ? input.contacts.map((contact) => `<li><strong>${safeText(contact.label)}</strong>: ${safeText(contact.value)}</li>`).join("")
    : `<li>Nenhum contato util cadastrado.</li>`

  return `
    <div class="info-grid">
      <article class="info-card">
        <h3>Documentos</h3>
        <ul>${documentItems}</ul>
      </article>
      <article class="info-card">
        <h3>Moeda e idioma</h3>
        <ul>
          <li><strong>Moeda</strong>: ${safeText(input.quickInfo.currency ?? null)}</li>
          <li><strong>Idioma</strong>: ${safeText(input.quickInfo.language ?? null)}</li>
          <li><strong>Fuso</strong>: ${safeText(input.quickInfo.timezone ?? null)}</li>
        </ul>
      </article>
      <article class="info-card">
        <h3>Clima e bagagem</h3>
        <ul>
          <li><strong>Clima</strong>: ${safeText(input.quickInfo.weather ?? null)}</li>
          <li><strong>Bagagem</strong>: ${safeText(baggageInfo[0] ?? input.quickInfo.baggage ?? null)}</li>
          <li><strong>Emergencia</strong>: ${safeText(input.quickInfo.emergency ?? null)}</li>
        </ul>
      </article>
      <article class="info-card">
        <h3>Contatos uteis</h3>
        <ul>${flightContacts}</ul>
      </article>
    </div>
  `
}

function renderHotels(input: TripPdfInput) {
  if (input.hotels.length === 0) {
    return `<div class="empty-card">Nenhuma hospedagem real cadastrada para esta viagem.</div>`
  }

  return input.hotels
    .map(
      (hotel) => `
        <article class="hotel-card">
          <div class="hotel-image"></div>
          <div class="hotel-content">
            <h3>${safeText(hotel.name, "Hospedagem")}</h3>
            <p class="hotel-address">${safeText(hotel.address, "Endereco nao informado")}</p>
            <div class="hotel-grid">
              <div><span>Check-in</span><strong>${formatDate(hotel.checkIn)}</strong></div>
              <div><span>Check-out</span><strong>${formatDate(hotel.checkOut)}</strong></div>
              <div><span>Confirmacao</span><strong>${safeText(hotel.confirmationCode, "Nao informada")}</strong></div>
            </div>
            ${hotel.notes ? `<div class="hotel-notes">${safeText(hotel.notes, "")}</div>` : ""}
          </div>
        </article>
      `,
    )
    .join("")
}

function renderSummaryCards(input: TripPdfInput) {
  const accommodation = input.hotels[0]?.name ?? "Nao informada"
  const documentsStatus = input.documents.length > 0 ? `${input.documents.length} documento(s) cadastrado(s)` : "Nenhum documento cadastrado"
  const flightStatus = input.flights.length > 0 ? `${input.flights.length} voo(s) cadastrado(s)` : "Nenhuma passagem cadastrada"
  const duration = calculateTripDuration(input.startDate, input.endDate) ?? "Periodo nao informado"
  const summaryItems = [
    ["Destino", `${input.destination}${input.country ? `, ${input.country}` : ""}`],
    ["Periodo", `${formatDate(input.startDate)} - ${formatDate(input.endDate)}`],
    ["Viajantes", input.travelersLabel || `${input.travelersCount} pessoa(s)`],
    ["Hospedagem", accommodation],
    ["Passagens", flightStatus],
    ["Documentos", documentsStatus],
  ]

  return `
    <div class="summary-grid">
      ${summaryItems
        .map(
          ([label, value]) => `
            <article class="summary-card">
              <span>${escapeHtml(label)}</span>
              <strong>${escapeHtml(value)}</strong>
            </article>
          `,
        )
        .join("")}
    </div>
    <div class="duration-pill">${escapeHtml(duration)}</div>
  `
}

function renderHtml(input: TripPdfInput, assets: { heroImage: string | null; agencyLogo: string | null }) {
  const isAgency = input.branding.isAgency === true && Boolean(input.branding.agencyName)
  const travelWindow = `${formatDate(input.startDate)} - ${formatDate(input.endDate)}`

  return `<!DOCTYPE html>
  <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <style>
        @page { size: A4; margin: 0; }
        * { box-sizing: border-box; }
        html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: ${TEXT}; background: #ffffff; }
        main { width: 100%; }
        section { page-break-after: always; }
        section:last-child { page-break-after: auto; }
        p, li, strong, span, h1, h2, h3, h4, div { overflow-wrap: anywhere; word-break: break-word; }
        .page { padding: 40px 42px; }
        .cover { min-height: 1122px; position: relative; color: #fff; background: ${DARK}; overflow: hidden; }
        .cover::before { content: ""; position: absolute; inset: 0; background-image: ${assets.heroImage ? `url('${assets.heroImage}')` : `linear-gradient(135deg, ${PRIMARY}, ${SECONDARY})`}; background-size: cover; background-position: center; transform: scale(1.04); }
        .cover::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(15,23,42,0.42), rgba(15,23,42,0.78) 55%, rgba(15,23,42,0.9)); }
        .cover-inner { position: relative; z-index: 2; min-height: 1122px; padding: 52px 56px; display: flex; flex-direction: column; }
        .cover-top { display: flex; justify-content: space-between; align-items: flex-start; }
        .vuei-badge { display: inline-flex; align-items: center; gap: 10px; border: 1px solid rgba(255,255,255,0.22); border-radius: 999px; padding: 12px 18px; background: rgba(255,255,255,0.08); backdrop-filter: blur(12px); font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; }
        .agency-card { display: inline-flex; align-items: center; gap: 14px; border: 1px solid rgba(255,255,255,0.18); border-radius: 20px; padding: 14px 18px; background: rgba(255,255,255,0.08); max-width: 340px; }
        .agency-card img { width: 56px; height: 56px; object-fit: contain; border-radius: 16px; background: rgba(255,255,255,0.96); padding: 6px; }
        .agency-card strong { display: block; font-size: 16px; margin-bottom: 4px; }
        .agency-card span { display: block; font-size: 12px; color: rgba(255,255,255,0.78); }
        .cover-main { margin-top: auto; max-width: 610px; }
        .eyebrow { font-size: 13px; text-transform: uppercase; letter-spacing: 0.22em; color: rgba(255,255,255,0.8); margin-bottom: 16px; }
        .cover-title { font-size: 56px; line-height: 1.03; font-weight: 700; margin: 0 0 18px; }
        .cover-meta { display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 24px; }
        .cover-meta span { background: rgba(255,255,255,0.12); border-radius: 999px; padding: 9px 14px; font-size: 14px; }
        .cover-summary { font-size: 20px; line-height: 1.6; color: rgba(255,255,255,0.84); margin: 0; }
        .cover-line { margin-top: auto; width: 92px; height: 4px; border-radius: 999px; background: ${SECONDARY}; }
        .section-head { margin-bottom: 24px; page-break-inside: avoid; }
        .section-head .eyebrow-dark { display: inline-flex; align-items: center; margin-bottom: 10px; padding: 8px 14px; border-radius: 999px; background: rgba(31,143,214,0.1); color: ${PRIMARY}; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 700; }
        .section-head h2 { display: inline-block; width: 100%; font-size: 34px; margin: 0; color: #fff; background: linear-gradient(90deg, ${PRIMARY}, ${SECONDARY}); border-radius: 22px; padding: 16px 22px; }
        .section-head p { margin: 14px 4px 0; color: ${MUTED}; line-height: 1.65; max-width: 640px; }
        .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 20px; }
        .summary-card { border: 1px solid ${BORDER}; border-radius: 20px; padding: 18px; background: #fff; min-height: 100px; }
        .summary-card span { display: block; color: ${MUTED}; font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 10px; }
        .summary-card strong { font-size: 17px; line-height: 1.5; color: ${DARK}; }
        .summary-panels { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 16px; margin-top: 20px; }
        .panel { border-radius: 22px; padding: 20px; border: 1px solid ${BORDER}; background: ${SOFT}; page-break-inside: avoid; }
        .panel h3 { margin: 0 0 12px; font-size: 20px; color: ${DARK}; }
        .panel p, .panel li { color: ${TEXT}; line-height: 1.7; }
        .panel ul { padding-left: 18px; margin: 0; }
        .duration-pill { display: inline-flex; align-items: center; justify-content: center; padding: 12px 22px; border-radius: 999px; background: rgba(55,198,224,0.14); color: ${PRIMARY}; font-weight: 700; margin-top: 8px; }
        .day-card { border: 1px solid ${BORDER}; border-radius: 26px; background: #fff; padding: 20px; margin-bottom: 16px; page-break-inside: auto; break-inside: auto; }
        .day-card:first-child { margin-top: 0; }
        .day-header { display: grid; grid-template-columns: 88px 1fr; gap: 18px; align-items: start; margin-bottom: 18px; padding: 18px; border-radius: 22px; background: linear-gradient(90deg, ${PRIMARY}, ${SECONDARY}); page-break-inside: avoid; break-inside: avoid; }
        .day-badge { width: 94px; border-radius: 24px; background: ${PRIMARY}; color: #fff; padding: 16px 12px; text-align: center; }
        .day-badge span { display: block; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; opacity: 0.86; }
        .day-badge strong { display: block; font-size: 32px; margin-top: 6px; }
        .day-header h3 { margin: 0 0 6px; font-size: 28px; color: #fff; }
        .day-date { color: rgba(255,255,255,0.86); margin-bottom: 10px; font-weight: 600; }
        .day-summary { color: rgba(255,255,255,0.96); line-height: 1.75; }
        .period-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 14px; page-break-inside: auto; break-inside: auto; }
        .period-card { background: #f8fbfe; border: 1px solid ${BORDER}; border-radius: 20px; padding: 16px; min-height: 0; page-break-inside: avoid; break-inside: avoid; }
        .period-title { font-size: 13px; text-transform: uppercase; letter-spacing: 0.16em; color: #fff; margin: -16px -16px 14px; font-weight: 700; background: ${PRIMARY}; padding: 12px 16px; border-radius: 20px 20px 14px 14px; }
        .period-empty { color: ${MUTED}; font-size: 14px; line-height: 1.6; }
        .period-item { padding: 0 0 12px; margin-bottom: 12px; border-bottom: 1px solid rgba(31,143,214,0.12); page-break-inside: avoid; break-inside: avoid; }
        .period-item:last-child { margin-bottom: 0; padding-bottom: 0; border-bottom: 0; }
        .period-item-head { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 7px; align-items: center; }
        .period-time { color: ${PRIMARY}; font-size: 12px; font-weight: 700; }
        .period-type { color: ${MUTED}; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }
        .period-name { color: ${DARK}; font-size: 16px; font-weight: 700; margin-bottom: 4px; }
        .period-location, .period-description { color: ${TEXT}; font-size: 13px; line-height: 1.6; }
        .day-bottom { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 14px; page-break-inside: avoid; break-inside: avoid; }
        .note-box { border-radius: 18px; padding: 16px; background: #f8fbfe; border: 1px solid ${BORDER}; }
        .note-box strong { display: block; margin-bottom: 8px; font-size: 14px; color: ${DARK}; }
        .note-box p { margin: 0; line-height: 1.7; color: ${TEXT}; }
        .hotel-card { display: grid; grid-template-columns: 220px 1fr; border: 1px solid ${BORDER}; border-radius: 24px; overflow: hidden; background: #fff; margin-bottom: 16px; page-break-inside: avoid; break-inside: avoid; }
        .hotel-image { min-height: 240px; background: linear-gradient(135deg, ${PRIMARY}, ${SECONDARY}); background-size: cover; background-position: center; }
        .hotel-content { padding: 22px; }
        .hotel-content h3 { margin: 0 0 8px; font-size: 30px; color: ${DARK}; }
        .hotel-address { color: ${MUTED}; margin: 0 0 16px; }
        .hotel-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
        .hotel-grid div { padding: 14px; border-radius: 18px; background: ${SOFT}; }
        .hotel-grid span { display: block; color: ${MUTED}; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 6px; }
        .hotel-grid strong { color: ${DARK}; font-size: 14px; line-height: 1.5; }
        .hotel-notes { padding: 16px; border-radius: 18px; background: rgba(55,198,224,0.12); line-height: 1.7; }
        .experience-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .experience-card { border: 1px solid ${BORDER}; border-radius: 22px; background: #fff; overflow: hidden; page-break-inside: avoid; break-inside: avoid; }
        .experience-card::before { content: ""; display: block; height: 6px; background: linear-gradient(90deg, ${PRIMARY}, ${SECONDARY}); }
        .experience-card { padding: 18px; }
        .experience-chip { display: inline-flex; padding: 6px 12px; border-radius: 999px; background: rgba(31,143,214,0.1); color: ${PRIMARY}; font-size: 12px; font-weight: 700; margin-bottom: 12px; }
        .experience-card h3 { margin: 0 0 8px; font-size: 22px; color: ${DARK}; }
        .experience-meta { color: ${MUTED}; margin: 0 0 10px; font-size: 13px; }
        .experience-description { color: ${TEXT}; line-height: 1.7; margin: 0; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .info-card { border: 1px solid ${BORDER}; border-radius: 22px; padding: 18px; background: #fff; page-break-inside: avoid; break-inside: avoid; }
        .info-card h3 { margin: 0 0 12px; font-size: 21px; color: ${DARK}; }
        .info-card ul { padding-left: 18px; margin: 0; }
        .info-card li { line-height: 1.8; color: ${TEXT}; margin-bottom: 4px; }
        .empty-card { border: 1px dashed ${BORDER}; border-radius: 24px; padding: 24px; color: ${MUTED}; background: #fbfdff; }
        .footer-page { background: ${DARK}; color: #fff; min-height: 1122px; }
        .footer-main { display: flex; flex-direction: column; justify-content: space-between; min-height: 1014px; }
        .footer-hero { text-align: center; padding-top: 120px; }
        .footer-hero h2 { margin: 0 0 14px; font-size: 48px; }
        .footer-hero p { margin: 0 auto; max-width: 620px; color: rgba(255,255,255,0.74); line-height: 1.8; }
        .footer-card { border-radius: 28px; background: rgba(255,255,255,0.08); padding: 28px; margin: 56px 0; }
        .footer-card-row { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
        .footer-brand { display: flex; align-items: center; gap: 18px; }
        .footer-brand img { width: 70px; height: 70px; object-fit: contain; background: rgba(255,255,255,0.96); border-radius: 20px; padding: 8px; }
        .footer-brand-badge { width: 70px; height: 70px; border-radius: 50%; background: ${PRIMARY}; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 700; }
        .footer-brand h3 { margin: 0 0 5px; font-size: 24px; }
        .footer-brand p { margin: 0; color: rgba(255,255,255,0.68); }
        .footer-links { display: flex; gap: 12px; flex-wrap: wrap; }
        .footer-link { padding: 11px 15px; border-radius: 999px; background: rgba(255,255,255,0.08); color: #fff; font-size: 13px; }
        .footer-bottom { border-top: 1px solid rgba(255,255,255,0.12); padding-top: 20px; display: flex; justify-content: space-between; align-items: center; color: rgba(255,255,255,0.58); font-size: 13px; }
        .powered { display: flex; align-items: center; gap: 8px; }
        .vuei-wordmark { font-weight: 800; letter-spacing: -0.04em; background: linear-gradient(90deg, ${SECONDARY}, #1f8fd6 55%, #1556c4); -webkit-background-clip: text; color: transparent; }
      </style>
    </head>
    <body>
      <main>
        <section class="cover">
          <div class="cover-inner">
            <div class="cover-top">
              ${isAgency ? `
                <div class="agency-card">
                  ${assets.agencyLogo ? `<img src="${assets.agencyLogo}" alt="${safeText(input.branding.agencyName, "Agencia")}" />` : ""}
                  <div>
                    <strong>${safeText(input.branding.agencyName, "Agencia parceira")}</strong>
                    <span>${input.branding.consultantName ? `Consultor: ${safeText(input.branding.consultantName, "")}` : "Roteiro produzido com branding da agencia"}</span>
                  </div>
                </div>
              ` : `<div></div>`}
              <div class="vuei-badge"><span>Criado com</span><span class="vuei-wordmark">Vuei</span></div>
            </div>
            <div class="cover-main">
              <div class="eyebrow">Roteiro Personalizado</div>
              <h1 class="cover-title">${safeText(input.destination)}</h1>
              <div class="cover-meta">
                ${input.travelerName ? `<span>${safeText(input.travelerName)}</span>` : ""}
                <span>${travelWindow}</span>
                <span>${safeText(input.country, "Destino internacional")}</span>
              </div>
              <p class="cover-summary">${safeText(input.tripSummary, "Uma experiencia organizada com contexto real da sua viagem.")}</p>
            </div>
            <div class="cover-line"></div>
          </div>
        </section>

        <section class="page">
          <div class="section-head">
            <div class="eyebrow-dark">Visao Geral</div>
            <h2>Resumo da Viagem</h2>
            <p>Dados reais da sua viagem reunidos em um resumo claro, consistente e pronto para consulta.</p>
          </div>
          ${renderSummaryCards(input)}
          <div class="summary-panels">
            <article class="panel">
              <h3>Resumo executivo</h3>
              <p>${safeText(input.content.summary ?? input.tripSummary, "Resumo indisponivel no momento.")}</p>
              ${input.usefulInfo.length > 0 ? `<ul>${input.usefulInfo.map((item) => `<li>${safeText(item, "")}</li>`).join("")}</ul>` : ""}
            </article>
            <article class="panel">
              <h3>Observacoes</h3>
              ${input.content.observations.length > 0 ? `<ul>${input.content.observations.map((item) => `<li>${safeText(item, "")}</li>`).join("")}</ul>` : `<p>Nenhuma observacao adicional cadastrada.</p>`}
            </article>
          </div>
        </section>

        <section class="page" style="background:#f7fafc;">
          <div class="section-head" style="text-align:center;">
            <div class="eyebrow-dark">Programacao Completa</div>
            <h2>Dia a Dia</h2>
            <p>Cada dia segue a estrutura do template oficial, agora preenchida com o contexto real da viagem e as sugestoes geradas pela IA.</p>
          </div>
          ${input.content.days
            .map((day) => {
              const periods = groupActivitiesByPeriod(day)
              return `
                <article class="day-card">
                  <div class="day-header">
                    <div class="day-badge"><span>Dia</span><strong>${day.day}</strong></div>
                    <div>
                      <h3>${safeText(day.title)}</h3>
                      <div class="day-date">${safeText(day.date, "Data a confirmar")}</div>
                      <div class="day-summary">${safeText(day.summary, "Sem resumo adicional para este dia.")}</div>
                    </div>
                  </div>
                  <div class="period-grid">
                    ${renderPeriodCard("Manha", periods.morning)}
                    ${renderPeriodCard("Tarde", periods.afternoon)}
                    ${renderPeriodCard("Noite", periods.evening.length > 0 ? periods.evening : periods.flexible)}
                  </div>
                  <div class="day-bottom">
                    <div class="note-box">
                      <strong>Dicas e notas uteis</strong>
                      <p>${safeText(day.tips, "Sem dicas adicionais para este dia.")}</p>
                    </div>
                    <div class="note-box">
                      <strong>Observacoes importantes</strong>
                      <p>${safeText(day.important, "Nenhuma observacao critica registrada para este dia.")}</p>
                    </div>
                  </div>
                </article>
              `
            })
            .join("")}
        </section>

        <section class="page">
          <div class="section-head">
            <div class="eyebrow-dark">Onde Voce Vai Ficar</div>
            <h2>Hospedagem</h2>
          </div>
          ${renderHotels(input)}
        </section>

        <section class="page" style="background:#f7fafc;">
          <div class="section-head" style="text-align:center;">
            <div class="eyebrow-dark">Momentos Especiais</div>
            <h2>Experiencias e Passeios</h2>
            <p>Recortes de experiencias, gastronomia e deslocamentos derivados do roteiro completo.</p>
          </div>
          ${renderExperiences(input.content.days)}
        </section>

        <section class="page">
          <div class="section-head" style="text-align:center;">
            <div class="eyebrow-dark">Prepare-se</div>
            <h2>Informacoes Importantes</h2>
            <p>Somente informacoes reais cadastradas ou estados honestos quando algo ainda nao estiver disponivel.</p>
          </div>
          ${renderImportantInfo(input)}
        </section>

        <section class="footer-page">
          <div class="page footer-main">
            <div class="footer-hero">
              <h2>Boa viagem!</h2>
              <p>Esperamos que esta experiencia seja inesquecivel. Este roteiro foi preparado para facilitar seu acesso aos principais detalhes da viagem.</p>
            </div>
            <div>
              <div class="footer-card">
                <div class="footer-card-row">
                  <div class="footer-brand">
                    ${isAgency
                      ? assets.agencyLogo
                        ? `<img src="${assets.agencyLogo}" alt="${safeText(input.branding.agencyName, "Agencia")}" />`
                        : `<div class="footer-brand-badge">${safeText(input.branding.agencyName?.charAt(0) ?? "A", "A")}</div>`
                      : `<div class="footer-brand-badge">V</div>`}
                    <div>
                      <h3>${isAgency ? safeText(input.branding.agencyName, "Agencia parceira") : "Vuei"}</h3>
                      <p>${isAgency ? safeText(input.branding.website ?? input.branding.contactEmail ?? "Branding da agencia", "Branding da agencia") : "Criado com Vuei"}</p>
                    </div>
                  </div>
                  <div class="footer-links">
                    ${input.branding.contactPhone ? `<span class="footer-link">${safeText(input.branding.contactPhone, "")}</span>` : ""}
                    ${input.branding.contactEmail ? `<span class="footer-link">${safeText(input.branding.contactEmail, "")}</span>` : ""}
                    ${input.branding.consultantName ? `<span class="footer-link">Consultor: ${safeText(input.branding.consultantName, "")}</span>` : ""}
                  </div>
                </div>
              </div>
              <div class="footer-bottom">
                <div class="powered"><span>Roteiro gerado com</span><span class="vuei-wordmark">Vuei</span></div>
                <div>${isAgency ? "Branding da agencia aplicado" : "Versao individual do roteiro"}</div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </body>
  </html>`
}

async function resolveExecutablePath(chromium: ChromiumRuntime | null) {
  const envExecutable = process.env.PUPPETEER_EXECUTABLE_PATH
  if (envExecutable) return envExecutable

  if (process.platform === "win32") {
    const windowsCandidates = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    ]

    for (const candidate of windowsCandidates) {
      try {
        await readFile(candidate)
        return candidate
      } catch {
        // continua procurando
      }
    }
  }

  if (!chromium) {
    throw new Error("Chromium serverless indisponivel para este runtime.")
  }

  chromium.setGraphicsMode = false
  return chromium.executablePath()
}

export async function buildTripItineraryPdf(input: TripPdfInput) {
  logItineraryPdfDev("start", {
    destination: input.destination,
    days: input.content.days.length,
    hasHeroImage: Boolean(input.heroImage),
    hasAgencyLogo: Boolean(input.branding.agencyLogoUrl),
  })

  const [heroImage, agencyLogo] = await Promise.all([
    assetToDataUrl(input.heroImage),
    assetToDataUrl(input.branding.agencyLogoUrl),
  ])
  logItineraryPdfDev("assets_resolved", {
    heroImageResolved: Boolean(heroImage),
    agencyLogoResolved: Boolean(agencyLogo),
  })

  const html = renderHtml(input, { heroImage, agencyLogo })
  logItineraryPdfDev("html_rendered", {
    htmlLength: html.length,
  })

  const puppeteer = await loadPuppeteerRuntime()
  const chromium = process.platform === "win32" && !process.env.PUPPETEER_EXECUTABLE_PATH
    ? null
    : await loadChromiumRuntime()
  const executablePath = await resolveExecutablePath(chromium)
  const launchArgs =
    process.platform === "win32"
      ? ["--headless=new", "--disable-gpu", "--disable-crash-reporter", "--disable-features=Crashpad", "--no-first-run", "--allow-file-access-from-files"]
      : await puppeteer.defaultArgs({
          args: chromium?.args ?? [],
          headless: "shell",
        })

  logItineraryPdfDev("executable_resolved", {
    executablePath,
    platform: process.platform,
    chromiumMode: chromium ? "serverless" : "local",
  })

  const browser = await puppeteer.launch({
    executablePath,
    args: launchArgs,
    headless: process.platform === "win32" ? true : "shell",
    defaultViewport: {
      width: 1440,
      height: 2048,
      deviceScaleFactor: 2,
    },
  })
  logItineraryPdfDev("browser_launched")

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: "load" })
    logItineraryPdfDev("content_loaded")
    await page.evaluate(async () => {
      const pendingImages = Array.from(document.images).filter((image) => !image.complete)
      await Promise.all(
        pendingImages.map(
          (image) =>
            new Promise<void>((resolve) => {
              image.addEventListener("load", () => resolve(), { once: true })
              image.addEventListener("error", () => resolve(), { once: true })
            }),
        ),
      )
    })
    await page.emulateMediaType("screen")
    logItineraryPdfDev("page_ready_for_pdf")

    const pdfBytes = Buffer.from(
      await page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: "0", right: "0", bottom: "0", left: "0" },
      }),
    )

    logItineraryPdfDev("pdf_created", {
      bytes: pdfBytes.byteLength,
    })

    return pdfBytes
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida ao gerar PDF."
    logItineraryPdfDev("error", {
      message,
    })
    throw error
  } finally {
    await browser.close()
  }
}
