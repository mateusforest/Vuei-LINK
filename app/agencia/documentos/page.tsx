"use client"

import { useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Search,
  Upload,
  FileText,
  Image,
  File,
  Lock,
  Unlock,
  MoreHorizontal,
  Download,
  Trash2,
  Eye,
  Shield,
  X,
  FolderOpen,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  const [privacyFilter, setPrivacyFilter] = useState<"all" | "private" | "shared">("all")
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [actionError, setActionError] = useState("")
  const [actionNotice, setActionNotice] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
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
    const matchesPrivacy =
      privacyFilter === "all" ||
      (privacyFilter === "private" && doc.isPrivate) ||
      (privacyFilter === "shared" && !doc.isPrivate)
    return matchesSearch && matchesType && matchesPrivacy
  })

  const handleUpload = async () => {
    if (!uploadData.name || !selectedFile) return
    setUploading(true)
    setActionError("")
    setActionNotice("")
    const created = await addDocument({
      name: uploadData.name,
      type: uploadData.type,
      clientId: uploadData.clientId || undefined,
      tripId: uploadData.tripId || undefined,
      isPrivate: uploadData.isPrivate,
      visibility: uploadData.isPrivate ? "private" : "agency_only",
      file: selectedFile,
    })
    setUploading(false)
    if (created) {
      if (uploadData.type === "ticket") {
        if (created.flightExtractionStatus === "failed") {
          setActionError(created.extractionError || "Passagem anexada, mas nao foi possivel iniciar a extracao agora.")
        } else {
          setActionNotice("Passagem anexada. Estamos extraindo as informacoes.")
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

    setActionError(workspaceError || "Nao foi possivel enviar o documento.")
  }

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir este documento?")) {
      await deleteDocument(id)
    }
  }

  const handleSelectFile = (file?: File | null) => {
    if (!file) return
    const validation = validateDocumentFile(file)
    if (!validation.valid) {
      setActionError(validation.error || "Arquivo invalido.")
      setActionNotice("")
      return
    }

    setActionError("")
    setActionNotice("")
    setSelectedFile(file)
    setUploadData((prev) => ({ ...prev, name: prev.name || file.name }))
  }

  const handleOpenDocument = async (doc: AgencyDocument) => {
    if (doc.filePath && isUsingRealData) {
      const result = await getSignedDocumentUrl(doc.filePath)
      if (!result.data) {
        setActionError(result.error || "Nao foi possivel abrir o documento.")
        return
      }

      window.open(result.data, "_blank", "noopener,noreferrer")
      return
    }

    if (doc.fileUrl) {
      window.open(doc.fileUrl, "_blank", "noopener,noreferrer")
      return
    }

    setActionError("Documento sem arquivo disponivel para visualizacao.")
  }

  const handleTogglePrivacy = async (doc: AgencyDocument) => {
    if (!isUsingRealData) return

    const nextPrivate = !doc.isPrivate
    const result = await updateDocumentMetadata(doc.id, {
      isPrivate: nextPrivate,
      visibility: nextPrivate ? "private" : "agency_only",
    })

    if (!result.data) {
      setActionError(result.error || "Nao foi possivel atualizar a privacidade do documento.")
      return
    }

    window.location.reload()
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

      {/* Security Notice */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="rounded-lg bg-primary/10 p-2">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Documentos protegidos</p>
            <p className="text-xs text-muted-foreground">
              Docs privados requerem PIN/Face ID e nao aparecem nos links compartilhados
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Search and Filters */}
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
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
          {[
            { value: "all", label: "Todos" },
            { value: "private", label: "Privados" },
            { value: "shared", label: "Compartilhaveis" },
          ].map((item) => (
            <Button
              key={item.value}
              variant="outline"
              size="sm"
              onClick={() => setPrivacyFilter(item.value as typeof privacyFilter)}
              className={`flex-shrink-0 border-white/10 ${
                privacyFilter === item.value
                  ? "bg-primary/20 text-primary"
                  : "bg-transparent text-muted-foreground hover:bg-white/5"
              }`}
            >
              {item.value === "private" && <Lock className="mr-1 h-3 w-3" />}
              {item.value === "shared" && <Unlock className="mr-1 h-3 w-3" />}
              {item.label}
            </Button>
          ))}
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
            {searchQuery ? "Tente buscar com outros termos" : "Faca upload do primeiro documento"}
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
                        {doc.isPrivate && (
                          <Badge variant="outline" className="border-yellow-500/30 bg-yellow-500/10 text-[10px] text-yellow-500">
                            <Lock className="mr-1 h-2.5 w-2.5" />
                            Privado
                          </Badge>
                        )}
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
                          <DropdownMenuItem onClick={() => void handleTogglePrivacy(doc)}>
                            {doc.isPrivate ? (
                              <>
                                <Unlock className="mr-2 h-4 w-4" />
                                Tornar compartilhavel
                              </>
                            ) : (
                              <>
                                <Lock className="mr-2 h-4 w-4" />
                                Tornar privado
                              </>
                            )}
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
        <DialogContent className="border-white/10 bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload de Documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div
              className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${
                dragOver ? "border-primary bg-primary/5" : "border-white/10 hover:border-white/20"
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
                  <div className="w-8 h-8 border-2 border-white/30 border-t-primary rounded-full animate-spin" />
                  <p className="text-sm text-muted-foreground">Enviando...</p>
                </div>
              ) : uploadData.name ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="p-3 rounded-xl bg-primary/10">
                    <FileText className="h-8 w-8 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-foreground">{uploadData.name}</p>
                  <Button 
                    variant="ghost"
                    size="sm" 
                    onClick={(e) => { e.stopPropagation(); setUploadData({ ...uploadData, name: "" }); setSelectedFile(null) }}
                    className="text-xs text-muted-foreground"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Remover
                  </Button>
                </div>
              ) : (
                <>
                  <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
                  <p className="mt-2 text-sm text-foreground">Arraste arquivos ou clique para selecionar</p>
                  <p className="mt-1 text-xs text-muted-foreground">PDF, JPG, PNG ate 10MB</p>
                </>
              )}
            </div>

            <div>
              <Label className="text-muted-foreground">Tipo de documento</Label>
              <select 
                value={uploadData.type}
                onChange={(e) => setUploadData({ ...uploadData, type: e.target.value as AgencyDocument["type"] })}
                className="mt-1.5 h-10 w-full rounded-xl border border-white/10 bg-[#0a0a0a] px-3 text-sm text-foreground appearance-none"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(255,255,255,0.4)'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}
              >
                <option value="voucher" className="bg-[#0a0a0a]">Voucher</option>
                <option value="ticket" className="bg-[#0a0a0a]">Passagem</option>
                <option value="admission_ticket" className="bg-[#0a0a0a]">Ingresso</option>
                <option value="itinerary" className="bg-[#0a0a0a]">Roteiro</option>
                <option value="passport" className="bg-[#0a0a0a]">Passaporte</option>
                <option value="visa" className="bg-[#0a0a0a]">Visto</option>
                <option value="insurance" className="bg-[#0a0a0a]">Seguro</option>
                <option value="other" className="bg-[#0a0a0a]">Outro</option>
              </select>
            </div>

            <div>
              <Label className="text-muted-foreground">Cliente</Label>
              <select 
                value={uploadData.clientId}
                onChange={(e) => setUploadData({ ...uploadData, clientId: e.target.value })}
                className="mt-1.5 h-10 w-full rounded-xl border border-white/10 bg-[#0a0a0a] px-3 text-sm text-foreground appearance-none"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(255,255,255,0.4)'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}
              >
                <option value="" className="bg-[#0a0a0a]">Selecionar cliente</option>
                {activeClients.map(c => (
                  <option key={c.id} value={c.id} className="bg-[#0a0a0a]">{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-muted-foreground">Viagem</Label>
              <select 
                value={uploadData.tripId}
                onChange={(e) => setUploadData({ ...uploadData, tripId: e.target.value })}
                className="mt-1.5 h-10 w-full rounded-xl border border-white/10 bg-[#0a0a0a] px-3 text-sm text-foreground appearance-none"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(255,255,255,0.4)'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}
              >
                <option value="" className="bg-[#0a0a0a]">Selecionar viagem</option>
                {trips.map(t => (
                  <option key={t.id} value={t.id} className="bg-[#0a0a0a]">{t.name} - {t.clientName}</option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-white/5 bg-white/[0.02]">
              <input
                type="checkbox"
                checked={uploadData.isPrivate}
                onChange={(e) => setUploadData({ ...uploadData, isPrivate: e.target.checked })}
                className="w-4 h-4 rounded border-white/20 bg-white/5 text-primary focus:ring-primary/50"
              />
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-yellow-500" />
                <span className="text-sm text-foreground">Documento privado</span>
              </div>
            </label>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setUploadModalOpen(false)}
                className="flex-1 border-white/10"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleUpload}
                disabled={!uploadData.name || !selectedFile || uploading}
                className="flex-1 bg-gradient-to-r from-primary to-accent text-white disabled:opacity-50"
              >
                <Upload className="mr-2 h-4 w-4" />
                Enviar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
