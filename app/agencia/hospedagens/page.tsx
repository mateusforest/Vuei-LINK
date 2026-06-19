"use client"

import { useEffect, useMemo, useState } from "react"
import { Building2, CalendarDays, FileText, Loader2, MapPin, Plus, Search } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useAgency } from "@/contexts/agency-context"
import { useAuth } from "@/contexts/auth-context"
import { createDocumentMetadata, getSignedDocumentUrl, uploadDocumentFile } from "@/lib/repositories/documents-repository"
import { createTripHotel, listTripHotels, updateTripHotel, type TripHotelRecord } from "@/lib/repositories/trip-hotels-repository"
import { validateDocumentFile } from "@/lib/files/file-validation"

function sanitizeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9.\-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
}

function formatShortDate(value?: string | null) {
  if (!value) return "N?o informado"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
}

function getNightCount(checkIn?: string | null, checkOut?: string | null) {
  if (!checkIn || !checkOut) return null
  const start = new Date(checkIn)
  const end = new Date(checkOut)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  return diff > 0 ? diff : null
}

export default function AgencyHotelsPage() {
  const { agencyId, clients, trips, documents, refreshAgencyWorkspace } = useAgency()
  const { user } = useAuth()
  const [selectedClientId, setSelectedClientId] = useState("")
  const [selectedTripId, setSelectedTripId] = useState("")
  const [tripHotels, setTripHotels] = useState<TripHotelRecord[]>([])
  const [loadingHotels, setLoadingHotels] = useState(false)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState("")
  const [actionNotice, setActionNotice] = useState("")
  const [voucherFile, setVoucherFile] = useState<File | null>(null)
  const [formData, setFormData] = useState({
    hotelName: "",
    address: "",
    checkIn: "",
    checkOut: "",
    confirmationCode: "",
    notes: "",
  })

  const activeClients = useMemo(() => clients.filter((client) => client.status === "active"), [clients])
  const availableTrips = useMemo(
    () => trips.filter((trip) => !selectedClientId || trip.clientId === selectedClientId),
    [selectedClientId, trips],
  )

  useEffect(() => {
    if (!selectedClientId) return
    if (!availableTrips.some((trip) => trip.id === selectedTripId)) {
      setSelectedTripId("")
    }
  }, [availableTrips, selectedClientId, selectedTripId])

  useEffect(() => {
    let active = true

    async function loadHotels() {
      if (!selectedTripId) {
        if (active) setTripHotels([])
        return
      }

      setLoadingHotels(true)
      const result = await listTripHotels(selectedTripId)
      if (!active) return
      setTripHotels(result.data ?? [])
      setLoadingHotels(false)
    }

    void loadHotels()

    return () => {
      active = false
    }
  }, [selectedTripId])

  const handleSelectVoucher = (file?: File | null) => {
    if (!file) return
    const validation = validateDocumentFile(file)
    if (!validation.valid) {
      setActionError(validation.error || "Arquivo inv?lido para voucher.")
      setActionNotice("")
      return
    }

    setActionError("")
    setActionNotice("")
    setVoucherFile(file)
  }

  const handleOpenVoucher = async (hotel: TripHotelRecord) => {
    const linkedDocument = documents.find((document) => document.id === hotel.documentId)
    if (!linkedDocument) {
      setActionError("Voucher n?o ?ncontrado para esta hospedagem.")
      return
    }

    if (linkedDocument.filePath) {
      const signedUrlResult = await getSignedDocumentUrl(linkedDocument.filePath)
      if (!signedUrlResult.data) {
        setActionError(signedUrlResult.error || "N?o foi poss?vel abrir o voucher.")
        return
      }

      window.open(signedUrlResult.data, "_blank", "noopener,noreferrer")
      return
    }

    if (linkedDocument.fileUrl) {
      window.open(linkedDocument.fileUrl, "_blank", "noopener,noreferrer")
      return
    }

    setActionError("Voucher sem arquivo dispon?vel para abertura.")
  }

  const resetForm = () => {
    setFormData({
      hotelName: "",
      address: "",
      checkIn: "",
      checkOut: "",
      confirmationCode: "",
      notes: "",
    })
    setVoucherFile(null)
  }

  const handleSaveHotel = async () => {
    if (!agencyId || !user?.id) {
      setActionError("Sessao da ag?ncia indispon?vel para cadastrar hospedagem.")
      return
    }

    const selectedTrip = trips.find((trip) => trip.id === selectedTripId)
    if (!selectedTrip) {
      setActionError("Selecione uma viagem valida antes de salvar.")
      return
    }

    if (!formData.hotelName.trim()) {
      setActionError("Informe o nome do hotel.")
      return
    }

    setSaving(true)
    setActionError("")
    setActionNotice("")

    const hotelResult = await createTripHotel({
      tripId: selectedTrip.id,
      name: formData.hotelName.trim(),
      address: formData.address.trim() || null,
      checkIn: formData.checkIn || null,
      checkOut: formData.checkOut || null,
      confirmationCode: formData.confirmationCode.trim() || null,
      notes: formData.notes.trim() || null,
    })

    if (!hotelResult.data) {
      setSaving(false)
      setActionError(hotelResult.error || "N?o foi poss?vel salvar a hospedagem.")
      return
    }

    let savedHotel = hotelResult.data
    let notice = "Hospedagem salva com sucesso."

    if (voucherFile) {
      const safeName = sanitizeFileName(voucherFile.name)
      const path = `${user.id}/${agencyId}/${selectedTrip.id}/hotel-vouchers/${Date.now()}-${safeName}`
      const uploadResult = await uploadDocumentFile({ file: voucherFile, path })

      if (!uploadResult.data) {
        notice = "Hospedagem salva, mas o voucher n?o foi anexado."
      } else {
        const documentResult = await createDocumentMetadata({
          tripId: selectedTrip.id,
          clientId: selectedTrip.clientId,
          agencyId,
          ownerUserId: user.id,
          name: `Voucher - ${formData.hotelName.trim()}`,
          type: "voucher",
          filePath: uploadResult.data.path,
          fileUrl: uploadResult.data.fileUrl ?? null,
          mimeType: voucherFile.type || null,
          size: voucherFile.size ?? null,
          isPrivate: false,
          visibility: "public_trip",
          aiExtractedData: {
            source: "agency_hotel_upload",
            hotel_name: formData.hotelName.trim(),
          },
        })

        if (!documentResult.data) {
          notice = "Hospedagem salva, mas o voucher n?o foi vinculado."
        } else {
          const hotelWithVoucher = await updateTripHotel(savedHotel.id, {
            documentId: documentResult.data.id,
          })

          if (hotelWithVoucher.data) {
            savedHotel = hotelWithVoucher.data
          } else {
            notice = "Hospedagem salva, mas o voucher n?o foi vinculado."
          }
        }
      }
    }

    await refreshAgencyWorkspace()
    const hotelsResult = await listTripHotels(selectedTrip.id)
    setTripHotels(hotelsResult.data ?? (savedHotel ? [savedHotel, ...tripHotels] : tripHotels))
    setSaving(false)
    setActionNotice(notice)
    resetForm()
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Hospedagens</h1>
          <p className="mt-1 text-muted-foreground">Cadastre hotel, endereco e voucher da viagem do cliente.</p>
        </div>
      </div>

      {actionError ? (
        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="p-4 text-sm text-red-300">{actionError}</CardContent>
        </Card>
      ) : null}
      {!actionError && actionNotice ? (
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-4 text-sm text-emerald-300">{actionNotice}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Card className="border-border/60 bg-white/88">
          <CardContent className="space-y-5 p-5">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Nova hospedagem</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="clientId">Cliente</Label>
                <select
                  id="clientId"
                  value={selectedClientId}
                  onChange={(event) => setSelectedClientId(event.target.value)}
                  className="h-11 w-full rounded-xl border border-border/70 bg-white px-3 text-sm text-foreground focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
                >
                  <option value="">Selecione um cliente</option>
                  {activeClients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tripId">Viagem</Label>
                <select
                  id="tripId"
                  value={selectedTripId}
                  onChange={(event) => setSelectedTripId(event.target.value)}
                  className="h-11 w-full rounded-xl border border-border/70 bg-white px-3 text-sm text-foreground focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
                >
                  <option value="">Selecione uma viagem</option>
                  {availableTrips.map((trip) => (
                    <option key={trip.id} value={trip.id}>
                      {trip.name} • {trip.destination}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hotelName">Nome do hotel</Label>
              <input
                id="hotelName"
                value={formData.hotelName}
                onChange={(event) => setFormData((prev) => ({ ...prev, hotelName: event.target.value }))}
                className="h-11 w-full rounded-xl border border-border/70 bg-white px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
                placeholder="Ex.: Hotel Fasano Salvador"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hotelAddress">Endereço</Label>
              <input
                id="hotelAddress"
                value={formData.address}
                onChange={(event) => setFormData((prev) => ({ ...prev, address: event.target.value }))}
                className="h-11 w-full rounded-xl border border-border/70 bg-white px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
                placeholder="Rua, numero e cidade"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="checkIn">Check-in</Label>
                <input
                  id="checkIn"
                  type="date"
                  value={formData.checkIn}
                  onChange={(event) => setFormData((prev) => ({ ...prev, checkIn: event.target.value }))}
                  className="h-11 w-full rounded-xl border border-border/70 bg-white px-3 text-sm text-foreground focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="checkOut">Check-out</Label>
                <input
                  id="checkOut"
                  type="date"
                  value={formData.checkOut}
                  onChange={(event) => setFormData((prev) => ({ ...prev, checkOut: event.target.value }))}
                  className="h-11 w-full rounded-xl border border-border/70 bg-white px-3 text-sm text-foreground focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
              <Label htmlFor="confirmationCode">Código da reserva</Label>
                <input
                  id="confirmationCode"
                  value={formData.confirmationCode}
                  onChange={(event) => setFormData((prev) => ({ ...prev, confirmationCode: event.target.value }))}
                  className="h-11 w-full rounded-xl border border-border/70 bg-white px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
                  placeholder="Opcional"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="voucherFile">Voucher</Label>
                <input
                  id="voucherFile"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  onChange={(event) => handleSelectVoucher(event.target.files?.[0])}
                  className="block h-11 w-full rounded-xl border border-border/70 bg-white px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-primary"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hotelNotes">Observações</Label>
              <textarea
                id="hotelNotes"
                value={formData.notes}
                onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))}
                className="min-h-[96px] w-full rounded-xl border border-border/70 bg-white px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
                placeholder="Informações extras da hospedagem"
              />
            </div>

            <Button
              onClick={() => void handleSaveHotel()}
              disabled={saving}
              className="h-11 gap-2 bg-gradient-to-r from-primary to-accent text-white hover:opacity-90"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {saving ? "Salvando hospedagem..." : "Salvar hospedagem"}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-white/88">
          <CardContent className="space-y-5 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Hospedagens da viagem</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedTripId ? "Acompanhe os dados que vão aparecer no link da viagem." : "Selecione uma viagem para visualizar as hospedagens."}
                </p>
              </div>
              <Search className="h-4 w-4 text-muted-foreground" />
            </div>

            {loadingHotels ? (
              <div className="rounded-2xl border border-border/60 bg-[#fbfbfc] p-5 text-sm text-muted-foreground">
                Carregando hospedagens...
              </div>
            ) : !selectedTripId ? (
              <div className="rounded-2xl border border-dashed border-border/70 bg-[#fbfbfc] p-5 text-sm text-muted-foreground">
                Escolha um cliente e uma viagem para listar as hospedagens.
              </div>
            ) : tripHotels.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 bg-[#fbfbfc] p-5 text-sm text-muted-foreground">
                Nenhuma hospedagem cadastrada para esta viagem.
              </div>
            ) : (
              <div className="space-y-3">
                {tripHotels.map((hotel) => {
                  const nights = getNightCount(hotel.checkIn, hotel.checkOut)
                  return (
                    <div key={hotel.id} className="rounded-2xl border border-border/60 bg-[#fbfbfc] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-foreground">{hotel.name || "Hospedagem sem nome"}</p>
                          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-4 w-4 shrink-0" />
                            <span className="line-clamp-2">{hotel.address || "Endereço não informado"}</span>
                          </div>
                        </div>
                        {hotel.documentId ? (
                          <Button variant="outline" size="sm" className="shrink-0" onClick={() => void handleOpenVoucher(hotel)}>
                            <FileText className="mr-2 h-4 w-4" />
                            Voucher
                          </Button>
                        ) : null}
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-border/60 bg-white px-3 py-2.5">
                          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                            <CalendarDays className="h-3.5 w-3.5" />
                            Check-in
                          </div>
                          <p className="mt-1 text-sm font-medium text-foreground">{formatShortDate(hotel.checkIn)}</p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-white px-3 py-2.5">
                          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                            <CalendarDays className="h-3.5 w-3.5" />
                            Check-out
                          </div>
                          <p className="mt-1 text-sm font-medium text-foreground">{formatShortDate(hotel.checkOut)}</p>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span className="rounded-full border border-border/60 bg-white px-3 py-1.5">
                          {nights ? `${nights} noite(s)` : "Noites a confirmar"}
                        </span>
                        {hotel.confirmationCode ? (
                          <span className="rounded-full border border-border/60 bg-white px-3 py-1.5">
                            Reserva {hotel.confirmationCode}
                          </span>
                        ) : null}
                      </div>

                      {hotel.notes ? <p className="mt-3 text-sm text-muted-foreground">{hotel.notes}</p> : null}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
