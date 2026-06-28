"use client"

import { useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Search,
  Upload,
  FileText,
  Image,
  File,
  MoreHorizontal,
  Download,
  Trash2,
  Eye,
  X,
  FolderOpen,
  Pencil,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useAgency, type AgencyDocument } from "@/contexts/agency-context"
import { getSignedDocumentUrl, updateDocumentMetadata } from "@/lib/repositories/documents-repository"
import { validateDocumentFile } from "@/lib/files/file-validation"
import { DOCUMENT_UPLOAD_TYPE_OPTIONS } from "@/lib/constants/document-upload-types"

const documentTypes = [
  { value: "all", label: "Todos" },
  { value: "passport", label: "Passaportes" },
  { value: "visa", label: "Vistos" },
  { value: "voucher", label: "Vouchers" },
  { value: "ticket", label: "Passagens" },
  { value: "itinerary", label: "Roteiros" },
  { value: "admission_ticket", label: "Ingressos" },
  { value: "insurance", label: "Seguros" },
]

const FLIGHT_EXTRACTION_INSUFFICIENT_CREDITS_MESSAGE = "Créditos insuficientes\n\nVocê não possui créditos suficientes para extrair automaticamente os dados desta passagem.\n\nAdicione créditos ou altere seu plano para continuar utilizando a Extração IA."

function resolveFlightExtractionErrorMessage(error?: string) {
  const normalizedError = (error || "").toLowerCase()
  if (normalizedError.includes("saldo insuficiente") || normalizedError.includes("créditos insuficientes") || normalizedError.includes("creditos insuficientes")) {
    return FLIGHT_EXTRACTION_INSUFFICIENT_CREDITS_MESSAGE
  }

  return "Não foi possível extrair os dados desta passagem. Envie um cartão de embarque individual ou uma imagem limpa, sem cortes e com todos os dados visíveis."
}

const FLIGHT_EXTRACTION_FAILURE_MESSAGE = "Não foi possível extrair os dados desta passagem. Envie um cartão de embarque individual ou uma imagem limpa, sem cortes e com todos os dados visíveis."

function shouldShowFlightGuidance(message?: string) {
  const normalizedMessage = (message || "").toLowerCase()
  return normalizedMessage.includes("não foi possível extrair os dados desta passagem") || normalizedMessage.includes("nÃ£o foi possÃ­vel extrair os dados desta passagem") || normalizedMessage.includes("nao foi possivel extrair os dados desta passagem")
}

function FlightExtractionGuidanceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="agency-dialog sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-slate-950">Como obter a melhor extração</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <p className="text-sm text-slate-600">A IA funciona melhor quando a passagem está completa, legível e sem cortes.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-900">Correto</p>
              <ul className="mt-3 space-y-2 text-sm text-emerald-800">
                <li>- Cartão de embarque individual</li>
                <li>- Todos os dados visíveis</li>
                <li>- QR Code completo</li>
                <li>- Boa resolução</li>
                <li>- Sem cortes</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">Evite</p>
              <ul className="mt-3 space-y-2 text-sm text-amber-800">
                <li>- Prints cortados</li>
                <li>- Voucher com vários voos</li>
                <li>- Documento desfocado</li>
                <li>- QR Code cortado</li>
                <li>- Parte da passagem escondida</li>
              </ul>
            </div>
          </div>
          <Button onClick={() => onOpenChange(false)} className="w-full bg-gradient-to-r from-primary to-accent text-white hover:opacity-90">
            Entendi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const getFileIcon = (type: string) => {
  switch (type) {
    case "passport":
    case "visa":
      return FileText
    case "voucher":
    case "insurance":
    case "ticket":
    case "itinerary":
    case "admission_ticket":
      return File
    default:
      return Image
  }
}

export default function DocumentsPage() {
  const { documents, clients, trips, addDocument, deleteDocument, getClientById, getTripById, isUsingRealData, workspaceError } = useAgency()
  const [searchQuery, setSearchQuery] = useState("")
  const [filter, setFilter] = useState("all")
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [guidanceOpen, setGuidanceOpen] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [actionError, setActionError] = useState("")
  const [actionNotice, setActionNotice] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [editingDocument, setEditingDocument] = useState<AgencyDocument | null>(null)
  const [editingDocumentName, setEditingDocumentName] = useState("")
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [uploadData, setUploadData] = useState({
    name: "",
    type: "voucher" as AgencyDocument["type"],
    clientId: "",
    tripId: "",
    isPrivate: false
  })
  const activeClients = clients.filter((client) => client.status === "active")

  const filteredDocs = documents.filter((doc) => {
    const client = doc.clientId ? getClientById(doc.clientId) : null
    const trip = doc.tripId ? getTripById(doc.tripId) : null
    
    const matchesSearch =
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (client?.name.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
    const matchesType = filter === "all" || doc.type === filter
    return matchesSearch && matchesType
  })

  const handleUpload = async () => {
    if (!selectedFile) return
    setUploading(true)
    setActionError("")
    setActionNotice("")
    const created = await addDocument({
      name: uploadData.name.trim() || selectedFile.name,
      type: uploadData.type,
      clientId: uploadData.clientId || undefined,
      tripId: uploadData.tripId || undefined,
      isPrivate: uploadData.isPrivate,
      visibility: uploadData.isPrivate ? "private" : "agency_only",
      file: selectedFile,
    })
    setUploading(false)
    if (created && uploadData.type === "ticket" && created.flightExtractionStatus === "failed") {
      setActionError(resolveFlightExtractionErrorMessage(created.extractionError))
      setUploadModalOpen(false)
      setSelectedFile(null)
      setUploadData({ name: "", type: "voucher", clientId: "", tripId: "", isPrivate: false })
      return
    }

    if (created) {
      const isTicketUpload = uploadData.type === "ticket"
      if (isTicketUpload) {
        if (created.flightExtractionStatus === "failed") {
          setActionError("Não foi possível extrair os dados desta passagem. Envie um cartão de embarque individual ou uma imagem limpa, sem cortes e com todos os dados visíveis.")
        } else {
          setActionNotice("Passagem anexada. Estamos extraindo as informações.")
        }
        setUploadModalOpen(false)
        setSelectedFile(null)
        setUploadData({ name: "", type: "voucher", clientId: "", tripId: "", isPrivate: false })
        return
      }

      if (uploadData.type === "ticket") {
        if (created.flightExtractionStatus === "failed") {
          setActionError(created.extractionError || "Passagem anexada, mas não foi possível iniciar a extração agora.")
          setActionError("NÃ£o foi possÃ­vel extrair os dados desta passagem. Envie um cartÃ£o de embarque individual ou uma imagem limpa, sem cortes e com todos os dados visÃ­veis.")
        } else {
          setActionNotice("Passagem anexada. Estamos extraindo as informações.")
        }
      } else if (uploadData.type === "itinerary") {
        setActionNotice("Roteiro anexado com sucesso.")
      } else {
        setActionNotice("Documento anexado com sucesso.")
      }
      setUploadModalOpen(false)
      setSelectedFile(null)
      setUploadData({ name: "", type: "voucher", clientId: "", tripId: "", isPrivate: false })
      return
    }

    setActionError(workspaceError || "Não foi possível enviar o documento.")
  }

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que desej? excluir este documento?")) {
      await deleteDocument(id)
    }
  }

  const handleSelectFile = (file?: File | null) => {
    if (!file) return
    const validation = validateDocumentFile(file)
    if (!validation.valid) {
      setActionError(validation.error || "Arquivo inv?lido.")
      setActionNotice("")
      return
    }

    setActionError("")
    setActionNotice("")
    setSelectedFile(file)
  }

  const handleStartEdit = (doc: AgencyDocument) => {
    setActionError("")
    setActionNotice("")
    setEditingDocument(doc)
    setEditingDocumentName(doc.name || "")
    setEditModalOpen(true)
  }

  const handleSaveDocumentName = async () => {
    if (!editingDocument) return

    const trimmedName = editingDocumentName.trim()
    if (!trimmedName) {
      setActionError("Informe um nome para o documento.")
      return
    }

    setSavingEdit(true)
    setActionError("")

    const result = await updateDocumentMetadata(editingDocument.id, {
      name: trimmedName,
    })

    setSavingEdit(false)

    if (!result.data) {
      setActionError(result.error || "Não foi possível atualizar o nome do documento.")
      return
    }

    setEditModalOpen(false)
    window.location.reload()
  }

  const handleOpenDocument = async (doc: AgencyDocument) => {
    if (doc.filePath && isUsingRealData) {
      const result = await getSignedDocumentUrl(doc.filePath)
      if (!result.data) {
        setActionError(result.error || "Não foi possível abrir o documento.")
        return
      }

      window.open(result.data, "_blank", "noopener,noreferrer")
      return
    }

    if (doc.fileUrl) {
      window.open(doc.fileUrl, "_blank", "noopener,noreferrer")
      return
    }

    setActionError("Documento sem arquivo disponível para visualização.")
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Documentos</h1>
          <p className="mt-1 text-muted-foreground">{documents.length} documentos armazenados</p>
        </div>
        <Button
          onClick={() => setUploadModalOpen(true)}
          className="gap-2 bg-gradient-to-r from-primary to-accent text-white hover:opacity-90"
        >
          <Upload className="h-4 w-4" />
          Upload
        </Button>
      </div>

      {/* Search and Filters */}
      {actionError ? (
        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="p-4 text-sm text-red-300">
            <p>{actionError}</p>
            {shouldShowFlightGuidance(actionError) ? (
              <button type="button" onClick={() => setGuidanceOpen(true)} className="mt-2 text-xs font-medium text-red-200 underline underline-offset-4 transition hover:text-red-100">
                Ver dicas para uma extração melhor
              </button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
      {!actionError && actionNotice ? (
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-4 text-sm text-emerald-300">{actionNotice}</CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar documentos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 w-full rounded-xl border border-white/5 bg-white/5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
          />
        </div>
      </div>

      {/* Type Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {documentTypes.map((type) => (
          <Button
            key={type.value}
            variant="outline"
            size="sm"
            onClick={() => setFilter(type.value)}
            className={`flex-shrink-0 border-white/10 ${
              filter === type.value
                ? "bg-primary/20 text-primary"
                : "bg-transparent text-muted-foreground hover:bg-white/5"
            }`}
          >
            {type.label}
          </Button>
        ))}
      </div>

      {/* Documents List */}
      {filteredDocs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <FolderOpen className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Nenhum documento encontrado</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {searchQuery ? "Tente buscar com outros termos" : "Faça upload do primeiro documento"}
          </p>
          {!searchQuery && (
            <Button onClick={() => setUploadModalOpen(true)} className="gap-2">
              <Upload className="w-4 h-4" />
              Upload
            </Button>
          )}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-2"
        >
          {filteredDocs.map((doc, index) => {
            const FileIcon = getFileIcon(doc.type)
            const client = doc.clientId ? getClientById(doc.clientId) : null
            const trip = doc.tripId ? getTripById(doc.tripId) : null
            
            return (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="group border-white/5 bg-card/50 transition-all hover:border-primary/20 hover:bg-card/80">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className={`rounded-xl p-3 ${doc.isPrivate ? "bg-yellow-500/10" : "bg-primary/10"}`}>
                      <FileIcon className={`h-5 w-5 ${doc.isPrivate ? "text-yellow-500" : "text-primary"}`} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium text-foreground">{doc.name}</p>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        {client && (
                          <div className="flex items-center gap-1">
                            <Avatar className="h-4 w-4">
                              <AvatarFallback className="bg-primary/20 text-[8px] text-primary">
                                {client.name.split(" ").map(n => n[0]).join("")}
                              </AvatarFallback>
                            </Avatar>
                            {client.name}
                          </div>
                        )}
                        {trip && <span>{trip.destination}</span>}
                        <span>{formatDate(doc.createdAt)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => void handleOpenDocument(doc)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => void handleOpenDocument(doc)}>
                        <Download className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="border-white/10 bg-card">
                          <DropdownMenuItem onClick={() => handleStartEdit(doc)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-white/10" />
                          <DropdownMenuItem 
                            onClick={() => handleDelete(doc.id)}
                            className="text-red-400 focus:text-red-400"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>
      )}

      {/* Upload Modal */}
      <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
        <DialogContent className="agency-dialog sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-950">Upload de Documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div
              className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                dragOver ? "border-primary bg-primary/5" : "border-border/70 bg-white hover:border-primary/40"
              }`}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                handleSelectFile(e.dataTransfer.files?.[0])
              }}
              onClick={() => {
                fileInputRef.current?.click()
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                className="hidden"
                onChange={(e) => handleSelectFile(e.target.files?.[0])}
              />
              {uploading ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
                  <p className="text-sm text-slate-600">Enviando...</p>
                </div>
              ) : selectedFile ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="rounded-xl bg-primary/10 p-3">
                    <FileText className="h-8 w-8 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-slate-950">{selectedFile.name}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); setSelectedFile(null) }}
                    className="text-xs text-slate-600 hover:bg-sky-50 hover:text-slate-900"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Remover
                  </Button>
                </div>
              ) : (
                <>
                  <Upload className="mx-auto h-10 w-10 text-slate-400" />
                  <p className="mt-2 text-sm text-slate-900">Arraste arquivos ou clique para selecionar</p>
                  <p className="mt-1 text-xs text-slate-500">PDF, JPG, PNG ate 10MB</p>
                </>
              )}
            </div>

            <div>
              <Label className="text-slate-700">Nome do documento</Label>
              <input
                type="text"
                value={uploadData.name}
                onChange={(e) => setUploadData({ ...uploadData, name: e.target.value })}
                placeholder={selectedFile ? selectedFile.name : "Ex: Voucher do hotel"}
                className="mt-1.5 h-10 w-full rounded-xl border border-border/70 bg-white px-3 text-sm text-slate-950 placeholder:text-slate-400 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
              <p className="mt-1 text-xs text-slate-500">Opcional. Se nao preencher, manteremos o nome atual do arquivo.</p>
            </div>

            <div>
              <Label className="text-slate-700">Tipo de documento</Label>
              <select
                value={uploadData.type}
                onChange={(e) => setUploadData({ ...uploadData, type: e.target.value as AgencyDocument["type"] })}
                className="mt-1.5 h-10 w-full appearance-none rounded-xl border border-border/70 bg-white px-3 text-sm text-slate-950 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(71,85,105,0.9)'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}
              >
                {DOCUMENT_UPLOAD_TYPE_OPTIONS.map((type) => (
                  <option key={type.value} value={type.value} className="bg-white text-slate-950">
                    {type.label}
                  </option>
                ))}
              </select>
              {uploadData.type === "ticket" ? (
                <div className="mt-2 space-y-1 text-xs leading-5 text-slate-600">
                  <p>Para melhor leitura, envie um cart&#227;o de embarque individual ou uma imagem limpa da passagem, sem cortes e com todos os dados vis&#237;veis.</p>
                  <div className="hidden">
                  <p>Para melhor leitura, envie um cartão de embarque individual ou uma imagem limpa da passagem, sem cortes e com todos os dados visíveis.</p>
                  <p>Para viagens de ida e volta, envie cada trecho separadamente.</p>
                  <p className="hidden">
                  Para melhor leitura, envie um cartÃ£o de embarque individual ou uma imagem limpa da passagem, sem cortes e com todos os dados visÃ­veis. Para ida e volta, envie cada trecho separadamente.
                  </p>
                  </div>
                  <p>Para viagens de ida e volta, envie cada trecho separadamente.</p>
                  <button type="button" onClick={() => setGuidanceOpen(true)} className="pt-1 text-left text-[12px] font-medium text-primary underline underline-offset-4 transition hover:text-primary/80">
                    Ver dicas para uma extração melhor
                  </button>
                </div>
              ) : null}
            </div>

            <div>
              <Label className="text-slate-700">Cliente</Label>
              <select
                value={uploadData.clientId}
                onChange={(e) => setUploadData({ ...uploadData, clientId: e.target.value })}
                className="mt-1.5 h-10 w-full appearance-none rounded-xl border border-border/70 bg-white px-3 text-sm text-slate-950 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(71,85,105,0.9)'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}
              >
                <option value="" className="bg-white text-slate-500">Selecionar cliente</option>
                {activeClients.map(c => (
                  <option key={c.id} value={c.id} className="bg-white text-slate-950">{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-slate-700">Viagem</Label>
              <select
                value={uploadData.tripId}
                onChange={(e) => setUploadData({ ...uploadData, tripId: e.target.value })}
                className="mt-1.5 h-10 w-full appearance-none rounded-xl border border-border/70 bg-white px-3 text-sm text-slate-950 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(71,85,105,0.9)'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}
              >
                <option value="" className="bg-white text-slate-500">Selecionar viagem</option>
                {trips.map(t => (
                  <option key={t.id} value={t.id} className="bg-white text-slate-950">{t.name} - {t.clientName}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setUploadModalOpen(false)}
                className="flex-1 border-border/70 bg-white text-slate-900 hover:bg-sky-50"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
                className="flex-1 bg-gradient-to-r from-primary to-accent text-white disabled:opacity-50"
              >
                <Upload className="mr-2 h-4 w-4" />
                Enviar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="agency-dialog sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-950">Editar nome do documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-slate-700">Nome do documento</Label>
              <input
                type="text"
                value={editingDocumentName}
                onChange={(e) => setEditingDocumentName(e.target.value)}
                placeholder="Ex: Voucher do hotel"
                className="mt-1.5 h-10 w-full rounded-xl border border-border/70 bg-white px-3 text-sm text-slate-950 placeholder:text-slate-400 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setEditModalOpen(false)}
                className="flex-1 border-border/70 bg-white text-slate-900 hover:bg-sky-50"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => void handleSaveDocumentName()}
                disabled={savingEdit}
                className="flex-1 bg-gradient-to-r from-primary to-accent text-white disabled:opacity-50"
              >
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <FlightExtractionGuidanceDialog open={guidanceOpen} onOpenChange={setGuidanceOpen} />
    </div>
  )
}
