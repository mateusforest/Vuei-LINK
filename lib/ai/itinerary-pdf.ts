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

const PRIMARY = "#b48a3f"
const SECONDARY = "#d6b978"
const DARK = "#171717"
const TEXT = "#2c2c2c"
const MUTED = "#6f6a62"
const BORDER = "#e6e0d5"
const SOFT = "#f7f3ec"
const PAGE_BG = "#fbf9f4"

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
  const normalized = value?.trim()
  if (!normalized) return fallback

  const lowered = normalized.toLowerCase()
  if (lowered === "undefined" || lowered === "null" || lowered === "invalid date" || lowered === "n?o informado") {
    return fallback
  }

  return escapeHtml(normalized)
}

function formatDate(value: string | null | undefined, fallback = "Nao informado") {
  if (!value) return fallback
  const normalized = value.trim()
  if (!normalized || normalized.toLowerCase() === "invalid date") return fallback
  const parsed = new Date(`${normalized}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return fallback
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

function activityTypeLabel(type: GeneratedItineraryActivity["type"]) {
  switch (type) {
    case "food":
      return "Gastronomia"
    case "transport":
      return "Transporte"
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

function renderSectionHeader(params: { number: string; eyebrow: string; title: string; description?: string; center?: boolean }) {
  return `
    <div class="section-head${params.center ? " section-head-center" : ""}">
      <div class="section-index">${escapeHtml(params.number)}</div>
      <div class="section-copy">
        <div class="eyebrow-dark">${escapeHtml(params.eyebrow)}</div>
        <h2>${escapeHtml(params.title)}</h2>
        ${params.description ? `<p>${escapeHtml(params.description)}</p>` : ""}
      </div>
    </div>
  `
}

function renderPeriodCard(title: string, activities: GeneratedItineraryActivity[]) {
  if (activities.length === 0) return ""

  return `
    <div class="period-card">
      <div class="period-title-row">
        <div class="period-title">${title}</div>
        <div class="period-rule"></div>
      </div>
      <div class="period-list">
        ${activities
          .map(
            (activity, index) => `
              <div class="period-item">
                <div class="period-time-column">
                  <span class="period-dot"></span>
                  ${index === activities.length - 1 ? "" : `<span class="period-line"></span>`}
                </div>
                <div class="period-item-body">
                  <div class="period-item-head">
                    <span class="period-time">${safeText(activity.time, "Horario livre")}</span>
                    <span class="period-type">${activityTypeLabel(activity.type)}</span>
                  </div>
                  <div class="period-name">${safeText(activity.title)}</div>
                  ${activity.location ? `<div class="period-location">${safeText(activity.location, "")}</div>` : ""}
                  ${activity.description ? `<div class="period-description">${safeText(activity.description, "")}</div>` : ""}
                </div>
              </div>
            `,
          )
          .join("")}
      </div>
    </div>
  `
}

function renderPeriodGrid(day: GeneratedItineraryDay) {
  const periods = groupActivitiesByPeriod(day)
  const cards = [
    renderPeriodCard("Manha", periods.morning),
    renderPeriodCard("Tarde", periods.afternoon),
    renderPeriodCard("Noite", periods.evening),
    renderPeriodCard("Ao longo do dia", periods.flexible),
  ].filter(Boolean)

  if (cards.length === 0) {
    return `
      <div class="period-card">
        <div class="period-title-row">
          <div class="period-title">Agenda do dia</div>
          <div class="period-rule"></div>
        </div>
        <p class="period-empty">Sem atividade confirmada para este dia.</p>
      </div>
    `
  }

  return cards.join("")
}

function renderSummaryCards(input: TripPdfInput) {
  const accommodation = input.hotels[0]?.name ?? "Nao informada"
  const documentsStatus = input.documents.length > 0 ? `${input.documents.length} documento(s) cadastrados` : "Nenhum documento cadastrado"
  const flightStatus = input.flights.length > 0 ? `${input.flights.length} voo(s) cadastrados` : "Nenhuma passagem cadastrada"
  const duration = calculateTripDuration(input.startDate, input.endDate) ?? "Periodo nao informado"
  const normalizedDestination = input.destination.trim().toLocaleLowerCase("pt-BR")
  const normalizedCountry = input.country?.trim().toLocaleLowerCase("pt-BR")
  const destinationLabel =
    input.country && normalizedCountry && normalizedDestination.includes(normalizedCountry)
      ? input.destination
      : `${input.destination}${input.country ? `, ${input.country}` : ""}`

  const summaryItems = [
    ["Destino", destinationLabel],
    ["Periodo", `${formatDate(input.startDate)} - ${formatDate(input.endDate)}`],
    ["Duracao", duration],
    ["Viajantes", input.travelersLabel || `${input.travelersCount} pessoa(s)`],
    ["Hospedagem", accommodation],
    ["Passagens", flightStatus],
    ["Documentos", documentsStatus],
    ["Pais", safeText(input.country, "Destino internacional")],
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
  `
}

function renderExperiences(days: GeneratedItineraryDay[]) {
  const cards = days.flatMap((day) =>
    day.activities
      .filter((activity) => activity.highlight || activity.type === "experience" || activity.type === "food" || activity.type === "transport")
      .slice(0, 1)
      .map((activity) => ({
        day: day.day,
        date: day.date,
        activity,
      })),
  ).slice(0, 6)

  if (cards.length === 0) {
    return `<div class="empty-card">Nenhuma experiencia adicional foi cadastrada alem do roteiro principal.</div>`
  }

  return `
    <div class="experience-grid">
      ${cards
        .map(
          ({ day, date, activity }) => `
            <article class="experience-card">
              <div class="experience-chip">Dia ${day}${date ? ` &bull; ${safeText(date, "")}` : ""}</div>
              <h3>${safeText(activity.title)}</h3>
              <p class="experience-meta">${activityTypeLabel(activity.type)}${activity.location ? ` &bull; ${safeText(activity.location, "")}` : ""}</p>
              ${activity.description ? `<p class="experience-description">${safeText(activity.description, "")}</p>` : ""}
            </article>
          `,
        )
        .join("")}
    </div>
  `
}

function renderHotels(input: TripPdfInput) {
  if (input.hotels.length === 0) {
    return `<div class="empty-card">Nenhuma hospedagem cadastrada.</div>`
  }

  return `
    <div class="hotel-list">
      ${input.hotels
        .map(
          (hotel) => `
            <article class="hotel-card">
              <div class="hotel-image">
                <div class="hotel-image-badge">Hospedagem</div>
              </div>
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
        .join("")}
    </div>
  `
}

function renderDocumentsSection(input: TripPdfInput) {
  const quickInfoDocuments = Array.isArray(input.quickInfo.documents) ? input.quickInfo.documents.filter(Boolean) : []

  if (input.documents.length === 0 && quickInfoDocuments.length === 0) {
    return `<div class="empty-card">Nenhum documento adicional cadastrado.</div>`
  }

  return `
    <div class="documents-grid">
      ${input.documents.map((document) => `
        <article class="document-card">
          <span class="document-type">${safeText(document.type, "Documento")}</span>
          <h3>${safeText(document.name, "Documento")}</h3>
          <p>Arquivo vinculado ao roteiro atual.</p>
        </article>
      `).join("")}
      ${quickInfoDocuments.map((item) => `
        <article class="document-card">
          <span class="document-type">Checklist</span>
          <h3>${safeText(item, "Documento")}</h3>
          <p>Item importante informado para a viagem.</p>
        </article>
      `).join("")}
    </div>
  `
}

function renderImportantInfo(input: TripPdfInput) {
  const baggageInfo = input.flights.map((flight) => flight.baggageInfo).filter((value): value is string => Boolean(value && value.trim()))
  const flightContacts = input.contacts.length
    ? input.contacts.map((contact) => `<li><strong>${safeText(contact.label)}</strong>: ${safeText(contact.value)}</li>`).join("")
    : `<li>Nenhum contato util cadastrado.</li>`

  return `
    <div class="info-grid">
      <article class="info-card">
        <div class="info-kicker">Contexto local</div>
        <h3>Moeda e idioma</h3>
        <ul>
          <li><strong>Moeda</strong>: ${safeText(input.quickInfo.currency ?? null)}</li>
          <li><strong>Idioma</strong>: ${safeText(input.quickInfo.language ?? null)}</li>
          <li><strong>Fuso</strong>: ${safeText(input.quickInfo.timezone ?? null)}</li>
        </ul>
      </article>
      <article class="info-card">
        <div class="info-kicker">Planejamento</div>
        <h3>Clima e bagagem</h3>
        <ul>
          <li><strong>Clima</strong>: ${safeText(input.quickInfo.weather ?? null)}</li>
          <li><strong>Bagagem</strong>: ${safeText(baggageInfo[0] ?? input.quickInfo.baggage ?? null)}</li>
          <li><strong>Emergencia</strong>: ${safeText(input.quickInfo.emergency ?? null)}</li>
        </ul>
      </article>
      <article class="info-card info-card-wide">
        <div class="info-kicker">Suporte</div>
        <h3>Contatos uteis</h3>
        <ul>${flightContacts}</ul>
      </article>
    </div>
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
        body { margin: 0; font-family: "Geist", "Inter", "Segoe UI", Arial, Helvetica, sans-serif; color: ${TEXT}; background: ${PAGE_BG}; }
        main { width: 100%; }
        p, li, strong, span, h1, h2, h3, h4, div, article, section { overflow-wrap: anywhere; word-break: break-word; }
        p, li { orphans: 3; widows: 3; }
        .page-break { page-break-after: always; break-after: page; }
        .page-break:last-child { page-break-after: auto; break-after: auto; }
        .page { min-height: 1122px; padding: 44px 44px 42px; background: ${PAGE_BG}; }
        .section-page { page-break-before: always; break-before: page; }
        .section-page:first-of-type { page-break-before: auto; break-before: auto; }
        .section-content { display: flex; flex-direction: column; gap: 18px; }
        .avoid-break, .summary-card, .panel, .period-card, .day-card, .note-box, .hotel-card, .experience-card, .info-card, .document-card, .empty-card { break-inside: avoid; page-break-inside: avoid; }
        .cover { min-height: 1122px; position: relative; color: #fff; background: ${DARK}; overflow: hidden; }
        .cover::before { content: ""; position: absolute; inset: 0; background-image: ${assets.heroImage ? `url('${assets.heroImage}')` : `linear-gradient(135deg, ${PRIMARY}, ${SECONDARY})`}; background-size: cover; background-position: center; transform: scale(1.02); }
        .cover::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(12,12,12,0.46), rgba(12,12,12,0.18) 28%, rgba(12,12,12,0.8)); }
        .cover-inner { position: relative; z-index: 2; min-height: 1122px; padding: 52px 56px 58px; display: flex; flex-direction: column; }
        .cover-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; }
        .vuei-badge { display: inline-flex; align-items: center; gap: 10px; border: 1px solid rgba(255,255,255,0.24); border-radius: 999px; padding: 11px 16px; background: rgba(255,255,255,0.08); font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; }
        .agency-card { display: inline-flex; align-items: center; gap: 14px; border: 1px solid rgba(255,255,255,0.24); border-radius: 18px; padding: 14px 18px; background: rgba(255,255,255,0.08); max-width: 360px; }
        .agency-card img { width: 54px; height: 54px; object-fit: contain; border-radius: 14px; background: rgba(255,255,255,0.96); padding: 6px; }
        .agency-card strong { display: block; font-size: 16px; margin-bottom: 4px; }
        .agency-card span { display: block; font-size: 12px; color: rgba(255,255,255,0.78); }
        .cover-main { margin-top: auto; max-width: 620px; padding-bottom: 42px; }
        .eyebrow { font-size: 12px; text-transform: uppercase; letter-spacing: 0.28em; color: rgba(255,255,255,0.8); margin-bottom: 18px; }
        .cover-title { font-size: 64px; line-height: 0.96; letter-spacing: -0.055em; font-weight: 700; margin: 0 0 22px; text-wrap: balance; }
        .cover-meta { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 28px; }
        .cover-meta span { border: 1px solid rgba(255,255,255,0.18); background: rgba(255,255,255,0.1); border-radius: 999px; padding: 9px 14px; font-size: 13px; }
        .cover-summary { font-size: 18px; line-height: 1.75; color: rgba(255,255,255,0.88); margin: 0; max-width: 560px; }
        .cover-line { margin-top: auto; width: 52px; height: 1px; background: rgba(212,185,120,0.9); }
        .section-head { display: grid; grid-template-columns: 54px 1fr; gap: 18px; align-items: start; margin-bottom: 6px; }
        .section-head-center { align-items: start; }
        .section-index { width: 54px; height: 54px; border-radius: 14px; background: #111111; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 14px; letter-spacing: 0.16em; font-weight: 700; }
        .section-copy { min-width: 0; }
        .eyebrow-dark { display: inline-flex; align-items: center; margin-bottom: 10px; color: ${MUTED}; font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; font-weight: 700; }
        .section-head h2 { margin: 0; color: ${DARK}; font-size: 34px; line-height: 1.05; letter-spacing: -0.05em; text-wrap: balance; }
        .section-head p { margin: 12px 0 0; color: ${MUTED}; line-height: 1.72; max-width: 620px; font-size: 14px; }
        .summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
        .summary-card { border: 1px solid ${BORDER}; border-radius: 16px; padding: 16px; background: #ffffff; min-height: 98px; }
        .summary-card span { display: block; color: ${MUTED}; font-size: 10px; text-transform: uppercase; letter-spacing: 0.18em; margin-bottom: 10px; }
        .summary-card strong { font-size: 15px; line-height: 1.5; color: ${DARK}; }
        .summary-panels { display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 14px; }
        .panel { border-radius: 18px; padding: 20px; border: 1px solid ${BORDER}; background: #fffdf9; min-height: 0; }
        .panel h3 { margin: 0 0 10px; font-size: 18px; color: ${DARK}; letter-spacing: -0.02em; }
        .panel p, .panel li { color: ${TEXT}; line-height: 1.7; font-size: 14px; }
        .panel ul { padding-left: 18px; margin: 0; }
        .days-flow { display: grid; gap: 16px; }
        .day-card { border: 1px solid ${BORDER}; border-radius: 22px; background: #ffffff; padding: 18px; box-shadow: 0 8px 30px rgba(23,23,23,0.04); }
        .day-header { display: grid; grid-template-columns: 76px 1fr; gap: 16px; align-items: start; margin-bottom: 16px; padding: 18px; border-radius: 18px; background: linear-gradient(180deg, rgba(180,138,63,0.11), rgba(180,138,63,0.03)); border: 1px solid rgba(180,138,63,0.12); }
        .day-badge { width: 76px; border-radius: 16px; background: ${PRIMARY}; color: #fff; padding: 12px 8px; text-align: center; box-shadow: 0 10px 28px rgba(180,138,63,0.18); }
        .day-badge span { display: block; font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; opacity: 0.88; }
        .day-badge strong { display: block; font-size: 28px; margin-top: 5px; }
        .day-header h3 { margin: 0 0 4px; font-size: 25px; letter-spacing: -0.04em; color: ${DARK}; }
        .day-date { color: ${PRIMARY}; margin-bottom: 8px; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.18em; }
        .day-summary { color: ${TEXT}; line-height: 1.72; font-size: 14px; }
        .period-grid { display: grid; gap: 10px; }
        .period-card { background: #fcfaf6; border: 1px solid ${BORDER}; border-radius: 18px; padding: 16px; min-height: 0; }
        .period-title-row { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
        .period-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.22em; color: ${MUTED}; font-weight: 700; white-space: nowrap; }
        .period-rule { height: 1px; background: ${BORDER}; flex: 1; }
        .period-empty { color: ${MUTED}; font-size: 13px; line-height: 1.65; margin: 0; }
        .period-item { display: grid; grid-template-columns: 18px 1fr; gap: 12px; padding: 0 0 12px; margin-bottom: 12px; }
        .period-item:last-child { margin-bottom: 0; padding-bottom: 0; }
        .period-time-column { position: relative; display: flex; flex-direction: column; align-items: center; }
        .period-dot { width: 9px; height: 9px; border-radius: 50%; background: ${PRIMARY}; margin-top: 6px; box-shadow: 0 0 0 4px rgba(180,138,63,0.12); }
        .period-line { width: 1px; flex: 1; min-height: 42px; background: ${BORDER}; margin-top: 6px; }
        .period-item-body { border-left: 1px solid ${BORDER}; padding-left: 14px; }
        .period-item-head { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 6px; align-items: center; }
        .period-time { color: ${DARK}; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
        .period-type { color: ${PRIMARY}; font-size: 10px; text-transform: uppercase; letter-spacing: 0.16em; font-weight: 700; }
        .period-name { color: ${DARK}; font-size: 16px; font-weight: 700; margin-bottom: 4px; letter-spacing: -0.03em; }
        .period-location, .period-description { color: ${TEXT}; font-size: 13px; line-height: 1.6; }
        .period-location { color: ${MUTED}; margin-bottom: 4px; }
        .day-bottom { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
        .note-box { border-radius: 16px; padding: 16px; background: ${SOFT}; border: 1px solid ${BORDER}; min-height: 0; }
        .note-box strong { display: block; margin-bottom: 8px; font-size: 11px; color: ${MUTED}; text-transform: uppercase; letter-spacing: 0.2em; }
        .note-box p { margin: 0; line-height: 1.72; color: ${TEXT}; font-size: 13px; }
        .hotel-list { display: grid; gap: 14px; }
        .hotel-card { display: grid; grid-template-columns: 180px 1fr; border: 1px solid ${BORDER}; border-radius: 24px; overflow: hidden; background: #fff; }
        .hotel-image { min-height: 220px; background: linear-gradient(160deg, #1b1b1b, #38332b 62%, ${PRIMARY}); padding: 18px; display: flex; align-items: flex-start; }
        .hotel-image-badge { display: inline-flex; padding: 7px 12px; border-radius: 999px; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.16); color: #fff; font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 700; }
        .hotel-content { padding: 20px; }
        .hotel-content h3 { margin: 0 0 8px; font-size: 28px; color: ${DARK}; letter-spacing: -0.04em; }
        .hotel-address { color: ${MUTED}; margin: 0 0 14px; }
        .hotel-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-bottom: 14px; }
        .hotel-grid div { padding: 14px; border-radius: 16px; background: ${SOFT}; }
        .hotel-grid span { display: block; color: ${MUTED}; font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; margin-bottom: 6px; }
        .hotel-grid strong { color: ${DARK}; font-size: 14px; line-height: 1.5; }
        .hotel-notes { padding: 16px; border-radius: 18px; background: rgba(180,138,63,0.1); line-height: 1.72; }
        .experience-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .experience-card { border: 1px solid ${BORDER}; border-radius: 20px; background: #fff; padding: 18px; }
        .experience-card::before { content: ""; display: block; width: 36px; height: 2px; background: ${PRIMARY}; margin-bottom: 18px; }
        .experience-chip { display: inline-flex; padding: 6px 12px; border-radius: 999px; background: rgba(180,138,63,0.1); color: ${PRIMARY}; font-size: 11px; font-weight: 700; margin-bottom: 12px; }
        .experience-card h3 { margin: 0 0 8px; font-size: 20px; color: ${DARK}; }
        .experience-meta { color: ${MUTED}; margin: 0 0 10px; font-size: 13px; }
        .experience-description { color: ${TEXT}; line-height: 1.72; margin: 0; }
        .info-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .info-card { border: 1px solid ${BORDER}; border-radius: 20px; padding: 18px; background: #fff; }
        .info-card-wide { grid-column: 1 / -1; }
        .info-kicker { color: ${MUTED}; font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 700; margin-bottom: 10px; }
        .info-card h3 { margin: 0 0 12px; font-size: 19px; color: ${DARK}; letter-spacing: -0.03em; }
        .info-card ul { padding-left: 18px; margin: 0; }
        .info-card li { line-height: 1.75; color: ${TEXT}; margin-bottom: 4px; }
        .documents-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .document-card { border: 1px solid ${BORDER}; border-radius: 20px; padding: 18px; background: #fff; min-height: 142px; }
        .document-type { display: inline-flex; padding: 6px 11px; border-radius: 999px; background: rgba(180,138,63,0.1); color: ${PRIMARY}; font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; font-weight: 700; margin-bottom: 12px; }
        .document-card h3 { margin: 0 0 8px; color: ${DARK}; font-size: 18px; line-height: 1.3; }
        .document-card p { margin: 0; color: ${MUTED}; font-size: 13px; line-height: 1.7; }
        .empty-card { border: 1px dashed ${BORDER}; border-radius: 24px; padding: 24px; color: ${MUTED}; background: #fffdf9; }
        .footer-page { background: #faf7f1; color: ${DARK}; }
        .footer-main { display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 1014px; text-align: center; }
        .footer-stack { width: 100%; max-width: 720px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 26px; }
        .footer-hero h2 { margin: 0 0 14px; font-size: 52px; letter-spacing: -0.05em; }
        .footer-hero p { margin: 0 auto; max-width: 620px; color: ${MUTED}; line-height: 1.8; }
        .footer-card { width: 100%; border-radius: 28px; background: #ffffff; padding: 28px; border: 1px solid ${BORDER}; }
        .footer-card-row { display: flex; align-items: center; justify-content: space-between; gap: 20px; text-align: left; }
        .footer-brand { display: flex; align-items: center; gap: 18px; }
        .footer-brand img { width: 70px; height: 70px; object-fit: contain; background: ${SOFT}; border-radius: 18px; padding: 8px; }
        .footer-brand-badge { width: 70px; height: 70px; border-radius: 18px; background: #111111; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 700; }
        .footer-brand h3 { margin: 0 0 5px; font-size: 24px; }
        .footer-brand p { margin: 0; color: ${MUTED}; }
        .footer-links { display: flex; gap: 12px; flex-wrap: wrap; justify-content: flex-end; }
        .footer-link { padding: 11px 15px; border-radius: 999px; background: ${SOFT}; color: ${DARK}; font-size: 12px; white-space: nowrap; border: 1px solid ${BORDER}; }
        .footer-bottom { width: 100%; border-top: 1px solid ${BORDER}; padding-top: 18px; display: flex; justify-content: space-between; align-items: center; color: ${MUTED}; font-size: 13px; }
        .powered { display: flex; align-items: center; gap: 8px; }
        .vuei-wordmark { font-weight: 800; letter-spacing: -0.04em; background: linear-gradient(90deg, ${PRIMARY}, ${SECONDARY}); -webkit-background-clip: text; color: transparent; }
      </style>
    </head>
    <body>
      <main>
        <section class="cover page-break">
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

        <section class="page section-page page-break">
          <div class="section-content">
            ${renderSectionHeader({
              number: "01",
              eyebrow: "Visao geral",
              title: "Resumo da viagem",
              description: "Dados reais reunidos em uma pagina dedicada, com leitura limpa e estrutura previsivel.",
            })}
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
          </div>
        </section>

        <section class="page section-page page-break" style="background:#f8f5ef;">
          <div class="section-content">
            ${renderSectionHeader({
              number: "02",
              eyebrow: "Programacao completa",
              title: "Dia a dia",
              description: "Cada dia foi separado em blocos estaveis para evitar mistura de cards, titulos soltos e quebras visuais irregulares.",
              center: true,
            })}
            <div class="days-flow">
              ${input.content.days.map((day) => `
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
                    ${renderPeriodGrid(day)}
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
              `).join("")}
            </div>
          </div>
        </section>

        <section class="page section-page page-break">
          <div class="section-content">
            ${renderSectionHeader({
              number: "03",
              eyebrow: "Onde voce vai ficar",
              title: "Hospedagem",
              description: "Informacoes da hospedagem organizadas em uma pagina propria, sem quebrar cards entre paginas.",
            })}
            ${renderHotels(input)}
          </div>
        </section>

        <section class="page section-page page-break">
          <div class="section-content">
            ${renderSectionHeader({
              number: "04",
              eyebrow: "Momentos especiais",
              title: "Experiencias e passeios",
              description: "Recortes derivados do roteiro completo, com leitura mais editorial e cards de largura padronizada.",
            })}
            ${renderExperiences(input.content.days)}
          </div>
        </section>

        <section class="page section-page page-break">
          <div class="section-content">
            ${renderSectionHeader({
              number: "05",
              eyebrow: "Prepare-se",
              title: "Informacoes importantes",
              description: "Somente informacoes reais cadastradas ou estados honestos quando algo ainda nao estiver disponivel.",
            })}
            ${renderImportantInfo(input)}
          </div>
        </section>

        <section class="page section-page page-break">
          <div class="section-content">
            ${renderSectionHeader({
              number: "06",
              eyebrow: "Arquivos da viagem",
              title: "Documentos",
              description: "Documentos e itens de checklist exibidos em pagina propria para evitar mistura com outras secoes.",
            })}
            ${renderDocumentsSection(input)}
          </div>
        </section>

        <section class="page section-page footer-page">
          <div class="footer-main">
            <div class="footer-stack">
              <div class="footer-hero">
                <h2>Boa viagem!</h2>
                <p>Esperamos que esta experiencia seja inesquecivel. Este roteiro foi preparado para facilitar seu acesso aos principais detalhes da viagem.</p>
              </div>
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
