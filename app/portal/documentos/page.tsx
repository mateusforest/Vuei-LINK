"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  FileText,
  Fingerprint,
  Image as ImageIcon,
  Lock,
  MoreVertical,
  Plus,
  Shield,
  Trash2,
  Upload,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useTrips } from "@/contexts/trips-context"
import { useAuth } from "@/contexts/auth-context"
import {
  createDocumentMetadata,
  deleteDocument,
  getSignedDocumentUrl,
  listDocumentsByTrip,
  updateDocumentMetadata,
  uploadDocumentFile,
  type DocumentMetadataPayload,
} from "@/lib/repositories/documents-repository"
import { formatFileSize, getDocumentTypeFromMime, validateDocumentFile } from "@/lib/files/file-validation"
import {
  authenticateQuickAccessBiometric,
  getQuickAccessMethods,
  verifyQuickAccessPin,
} from "@/lib/auth/quick-access"
import { DOCUMENT_UPLOAD_TYPE_OPTIONS } from "@/lib/constants/document-upload-types"
import type { Document, DocumentVisibility } from "@/types"

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
}

function getDocumentIcon(type: string) {
  return type === "voucher" ? ImageIcon : FileText
}

export default function DocumentosPage() {
  const router = useRouter()
  const { activeTrip, trips } = useTrips()
  const { profile } = useAuth()
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showPinModal, setShowPinModal] = useState(false)
  const [pinVerified, setPinVerified] = useState(false)
  const [pin, setPin] = useState("")
  const [isUnlocking, setIsUnlocking] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [toastMessage, setToastMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [pinErrorMessage, setPinErrorMessage] = useState("")
  const [uploadForm, setUploadForm] = useState({
    name: "",
    type: "other",
    isPrivate: true,
  })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const currentTrip = activeTrip ?? trips[0] ?? null
  const quickAccessOwnerId = profile?.id ?? null
  const quickAccessMethods = useMemo(
    () => getQuickAccessMethods(quickAccessOwnerId, profile?.settings),
    [quickAccessOwnerId, profile?.settings],
  )

  useEffect(() => {
    if (!toastMessage) return
    const timer = window.setTimeout(() => setToastMessage(""), 2200)
    return () => window.clearTimeout(timer)
  }, [toastMessage])

  useEffect(() => {
    let mounted = true

    const loadDocuments = async () => {
      if (!currentTrip?.id) {
        setDocuments([])
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setErrorMessage("")
      const result = await listDocumentsByTrip(currentTrip.id)
      if (!mounted) return

      if (result.error) {
        setErrorMessage(result.error)
        setDocuments([])
      } else {
        setDocuments(result.data)
      }

      setIsLoading(false)
    }

    void loadDocuments()

    return () => {
      mounted = false
    }
  }, [currentTrip?.id])

  const privateDocuments = useMemo(() => documents.filter((document) => document.isPrivate), [documents])
  const sharedDocuments = useMemo(() => documents.filter((document) => !document.isPrivate), [documents])

  const handleViewPrivate = () => {
    if (!pinVerified) {
      setPinErrorMessage("")
      setShowPinModal(true)
    }
  }

  const verifyPin = async () => {
    if (!quickAccessOwnerId) {
      setPinErrorMessage("Faça login novamente para liberar documentos privados desta conta.")
      return
    }

    if (!quickAccessMethods.pinEnabled) {
      setPinErrorMessage("PIN da conta não configurado. Configure em Configurações.")
      return
    }

    setIsUnlocking(true)
    setPinErrorMessage("")

    try {
      const isValid = await verifyQuickAccessPin(quickAccessOwnerId, pin, { profileSettings: profile?.settings })
      if (!isValid) {
        setPinErrorMessage("PIN inválido.")
        return
      }

      setPinVerified(true)
      setShowPinModal(false)
      setPin("")
      setToastMessage("Documentos privados liberados.")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível validar o PIN desta conta."
      setPinErrorMessage(message)
    } finally {
      setIsUnlocking(false)
    }
  }

  const handleBiometricUnlock = async () => {
    if (!quickAccessOwnerId) {
      setPinErrorMessage("Faça login novamente para liberar documentos privados desta conta.")
      return
    }

    if (!quickAccessMethods.biometricEnabled) {
      setPinErrorMessage("Biometria não configurada neste dispositivo.")
      return
    }

    setIsUnlocking(true)
    setPinErrorMessage("")

    try {
      const authenticated = await authenticateQuickAccessBiometric(quickAccessOwnerId)
      if (!authenticated) {
        setPinErrorMessage("Não foi possível validar a biometria neste dispositivo.")
        return
      }

      setPinVerified(true)
      setShowPinModal(false)
      setToastMessage("Documentos privados liberados.")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível validar a biometria."
      setPinErrorMessage(message)
    } finally {
      setIsUnlocking(false)
    }
  }

  const resetUploadState = () => {
    setUploadForm({ name: "", type: "other", isPrivate: true })
    setSelectedFile(null)
    setShowUploadModal(false)
  }

  const handleUpload = async () => {
    if (!currentTrip?.id || !profile?.id) {
      setErrorMessage("Crie ou selecione uma viagem antes de anexar documentos.")
      return
    }

    if (!selectedFile) {
      setErrorMessage("Selecione um arquivo antes de salvar.")
      return
    }

    const validation = validateDocumentFile(selectedFile)
    if (!validation.valid) {
      setErrorMessage(validation.error ?? "Arquivo inválido.")
      return
    }

    setIsSaving(true)
    setErrorMessage("")

    try {
      const safeName = uploadForm.name.trim() || selectedFile.name.replace(/\.[^.]+$/, "")
      const visibility: DocumentVisibility = uploadForm.isPrivate ? "private" : "public_trip"
      const safeFileName = selectedFile.name.replace(/\s+/g, "-")
      const filePath = `${profile.id}/${currentTrip.id}/documents/${Date.now()}-${safeFileName}`

      const uploadResult = await uploadDocumentFile(selectedFile, filePath)
      if (uploadResult.error || !uploadResult.data) {
        setErrorMessage(uploadResult.error ?? "Não foi possível enviar o arquivo.")
        return
      }

      const payload: DocumentMetadataPayload = {
        tripId: currentTrip.id,
        clientId: null,
        agencyId: profile.agencyId,
        ownerUserId: profile.id,
        name: safeName,
        type: uploadForm.type || getDocumentTypeFromMime(selectedFile.type),
        filePath: uploadResult.data.path,
        fileUrl: uploadResult.data.fileUrl,
        mimeType: selectedFile.type,
        size: selectedFile.size,
        isPrivate: uploadForm.isPrivate,
        visibility,
        aiExtractedData: {},
      }

      const metadataResult = await createDocumentMetadata(payload)
      if (metadataResult.error || !metadataResult.data) {
        setErrorMessage(metadataResult.error ?? "Não foi possível salvar os dados do documento.")
        return
      }

      setDocuments((prev) => [metadataResult.data!, ...prev])
      setToastMessage("Documento anexado com sucesso.")
      resetUploadState()
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (documentId: string) => {
    const result = await deleteDocument(documentId)
    if (result.error) {
      setErrorMessage(result.error)
      return
    }

    setDocuments((prev) => prev.filter((document) => document.id !== documentId))
    setSelectedDoc((prev) => (prev?.id === documentId ? null : prev))
    setToastMessage("Documento excluído.")
  }

  const handleTogglePrivacy = async (document: Document) => {
    const nextPrivate = !document.isPrivate
    const result = await updateDocumentMetadata(document.id, {
      isPrivate: nextPrivate,
      visibility: nextPrivate ? "private" : "public_trip",
    })

    if (result.error || !result.data) {
      setErrorMessage(result.error ?? "Não foi possível atualizar a visibilidade.")
      return
    }

    setDocuments((prev) => prev.map((item) => (item.id === document.id ? result.data! : item)))
    setToastMessage(nextPrivate ? "Documento privado." : "Documento compartilhável.")
  }

  const handleDownload = async (document: Document) => {
    if (!document.filePath && !document.fileUrl) {
      setErrorMessage("Este documento ainda não possui arquivo anexado.")
      return
    }

    const urlResult = document.filePath ? await getSignedDocumentUrl(document.filePath) : { data: document.fileUrl, error: null }
    if (urlResult.error || !urlResult.data) {
      setErrorMessage(urlResult.error ?? "Não foi possível abrir o documento.")
      return
    }

    window.open(urlResult.data, "_blank", "noopener,noreferrer")
  }

  return (
    <motion.div initial="initial" animate="animate" className="space-y-6 max-w-4xl mx-auto">
      <motion.div variants={fadeInUp} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Documentos</h1>
          <p className="text-sm text-muted-foreground">
            {currentTrip ? `Arquivos reais da viagem ${currentTrip.name}` : "Selecione uma viagem para gerenciar os documentos."}
          </p>
        </div>
        <Button
          onClick={() => setShowUploadModal(true)}
          className="rounded-xl bg-gradient-to-r from-primary to-secondary text-primary-foreground vuei-button-glow"
          disabled={!currentTrip}
        >
          <Plus size={18} className="mr-2" />
          Adicionar
        </Button>
      </motion.div>

      {errorMessage && (
        <motion.div variants={fadeInUp}>
          <Card className="p-4 bg-red-500/10 border-red-500/20 text-sm text-red-300">{errorMessage}</Card>
        </motion.div>
      )}

      <motion.div variants={fadeInUp}>
        <Card className="p-4 bg-primary/5 border-primary/20">
          <div className="flex items-start gap-3">
            <Shield size={20} className="text-primary shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-sm">Documentos protegidos</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Documentos privados não aparecem no link compartilhável e exigem verificação local antes da visualização.
              </p>
            </div>
          </div>
        </Card>
      </motion.div>

      <motion.div variants={fadeInUp}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Lock size={16} className="text-primary" />
            <h2 className="font-semibold">Documentos privados</h2>
            <Badge variant="secondary" className="bg-muted/50 text-xs">{privateDocuments.length}</Badge>
          </div>
          {!pinVerified && privateDocuments.length > 0 && (
            <Button variant="ghost" size="sm" className="text-primary text-xs" onClick={handleViewPrivate}>
              <Fingerprint size={14} className="mr-1" />
              Desbloquear
            </Button>
          )}
        </div>

        {isLoading ? (
          <Card className="p-6 bg-card/50 border-border/50 text-sm text-muted-foreground">Carregando documentos...</Card>
        ) : privateDocuments.length === 0 ? (
          <Card className="p-6 bg-card/50 border-border/50 text-sm text-muted-foreground">Nenhum documento adicionado.</Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {privateDocuments.map((doc) => {
              const Icon = getDocumentIcon(doc.type)
              return (
                <Card
                  key={doc.id}
                  className={`p-4 bg-card/50 border-border/50 vuei-glass cursor-pointer hover:border-primary/30 transition-all duration-300 relative overflow-hidden ${!pinVerified ? "select-none" : ""}`}
                  onClick={() => pinVerified && setSelectedDoc(doc)}
                >
                  {!pinVerified && (
                    <div className="absolute inset-0 backdrop-blur-md bg-background/50 z-10 flex items-center justify-center">
                      <Lock size={24} className="text-muted-foreground" />
                    </div>
                  )}

                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${doc.filePath || doc.fileUrl ? "bg-primary/20" : "bg-muted/50"}`}>
                      <Icon size={18} className={doc.filePath || doc.fileUrl ? "text-primary" : "text-muted-foreground"} />
                    </div>
                    <Badge className="bg-amber-500/20 text-amber-400 border-0 text-[10px]">
                      <EyeOff size={10} className="mr-1" />
                      Privado
                    </Badge>
                  </div>
                  <h3 className="font-medium text-sm truncate">{doc.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {doc.size ? formatFileSize(doc.size) : "Documento salvo"}
                  </p>
                </Card>
              )
            })}
          </div>
        )}
      </motion.div>

      <motion.div variants={fadeInUp}>
        <div className="flex items-center gap-2 mb-4">
          <Eye size={16} className="text-secondary" />
          <h2 className="font-semibold">Documentos compartilhaveis</h2>
          <Badge variant="secondary" className="bg-muted/50 text-xs">{sharedDocuments.length}</Badge>
        </div>

        {isLoading ? (
          <Card className="p-6 bg-card/50 border-border/50 text-sm text-muted-foreground">Carregando documentos...</Card>
        ) : sharedDocuments.length === 0 ? (
          <Card className="p-6 bg-card/50 border-border/50 text-sm text-muted-foreground">Nenhum documento adicionado.</Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {sharedDocuments.map((doc) => {
              const Icon = getDocumentIcon(doc.type)
              return (
                <Card key={doc.id} className="p-4 bg-card/50 border-border/50 vuei-glass cursor-pointer hover:border-primary/30 transition-all duration-300" onClick={() => setSelectedDoc(doc)}>
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${doc.filePath || doc.fileUrl ? "bg-secondary/20" : "bg-muted/50"}`}>
                      <Icon size={18} className={doc.filePath || doc.fileUrl ? "text-secondary" : "text-muted-foreground"} />
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical size={14} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="portal-dropdown">
                        <DropdownMenuItem onClick={() => void handleDownload(doc)}>
                          <Download size={14} className="mr-2" />
                          Baixar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void handleTogglePrivacy(doc)}>
                          <Lock size={14} className="mr-2" />
                          Tornar privado
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => void handleDelete(doc.id)}>
                          <Trash2 size={14} className="mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <h3 className="font-medium text-sm truncate">{doc.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-muted-foreground">{doc.size ? formatFileSize(doc.size) : "Documento salvo"}</p>
                    {(doc.filePath || doc.fileUrl) && <CheckCircle2 size={12} className="text-green-500" />}
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </motion.div>

      <motion.div variants={fadeInUp}>
        <Card className="p-4 bg-muted/20 border-border/50">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="text-muted-foreground shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p>Documentos privados ficam visíveis apenas dentro do portal e não entram no link público.</p>
              <p className="mt-1">Somente arquivos realmente anexados aparecem nesta area. Sem fallback de documentos falsos.</p>
            </div>
          </div>
        </Card>
      </motion.div>

      <Dialog open={showPinModal} onOpenChange={setShowPinModal}>
        <DialogContent className="portal-dialog border-border/50 max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Fingerprint size={20} className="text-primary" />
              Verificacao de seguranca
            </DialogTitle>
            <DialogDescription>
              Desbloqueie os documentos privados com o PIN da conta ou com a biometria configurada neste dispositivo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {quickAccessMethods.pinEnabled ? (
              <>
                <Input
                  type="password"
                  maxLength={4}
                  value={pin}
                  onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="0000"
                  className="text-center text-2xl tracking-[0.6em]"
                />
                <Button className="w-full" onClick={() => void verifyPin()} disabled={pin.length !== 4 || isUnlocking}>
                  {isUnlocking ? "Validando..." : "Usar PIN"}
                </Button>
              </>
            ) : (
              <Card className="border-border/50 bg-muted/20 p-4 text-sm text-muted-foreground">
                PIN da conta não configurado. Configure em Configurações para liberar documentos privados aqui.
              </Card>
            )}

            {quickAccessMethods.biometricEnabled && (
              <Button variant="outline" className="w-full" onClick={() => void handleBiometricUnlock()} disabled={isUnlocking}>
                <Fingerprint size={16} className="mr-2" />
                {isUnlocking ? "Validando..." : "Usar Face ID / biometria"}
              </Button>
            )}

            {!quickAccessMethods.pinEnabled && !quickAccessMethods.biometricEnabled && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push("/portal/configuracoes?quickAccess=1&returnTo=%2Fportal%2Fdocumentos")}
              >
                Configurar acesso rapido neste dispositivo
              </Button>
            )}

            {pinErrorMessage && (
              <p className="text-sm text-red-300">{pinErrorMessage}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="portal-dialog max-h-[min(90vh,760px)] overflow-y-auto border-border/50 p-0 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="px-6 pt-6 text-slate-950">Adicionar documento</DialogTitle>
            <DialogDescription className="px-6 text-slate-600">Selecione um arquivo real para esta viagem. Sem preenchimento automatico falso.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-6 py-5">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-800">Nome do documento</Label>
              <Input
                value={uploadForm.name}
                onChange={(event) => setUploadForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Ex: Voucher do hotel"
                className="h-11 rounded-2xl border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-800">Arquivo</Label>
              <Input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                className="h-11 rounded-2xl border-slate-200 bg-white text-slate-900 file:mr-3 file:rounded-xl file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700"
              />
              {selectedFile && <p className="text-xs text-muted-foreground">{selectedFile.name} • {formatFileSize(selectedFile.size)}</p>}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-800">Tipo</Label>
              <div className="grid grid-cols-2 gap-2">
                {DOCUMENT_UPLOAD_TYPE_OPTIONS.map((item) => (
                  <Button
                    key={item.value}
                    type="button"
                    variant={uploadForm.type === item.value ? "default" : "outline"}
                    className={
                      uploadForm.type === item.value
                        ? "justify-start rounded-xl bg-gradient-to-r from-primary to-secondary text-primary-foreground shadow-none"
                        : "justify-start rounded-xl border-slate-200 bg-white text-slate-700 hover:border-primary/30 hover:bg-sky-50 hover:text-slate-900"
                    }
                    onClick={() => setUploadForm((prev) => ({ ...prev, type: item.value }))}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center gap-2">
                <Lock size={16} className="text-primary" />
                <span className="text-sm font-medium text-slate-800">Documento privado</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-xl text-xs text-slate-700 hover:bg-white hover:text-slate-900"
                onClick={() => setUploadForm((prev) => ({ ...prev, isPrivate: !prev.isPrivate }))}
              >
                {uploadForm.isPrivate ? "Ativado" : "Compartilhável"}
              </Button>
            </div>
          </div>

          <div className="flex gap-3 px-6 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-1">
            <Button
              variant="outline"
              className="flex-1 rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
              onClick={resetUploadState}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button className="flex-1 rounded-xl bg-gradient-to-r from-primary to-secondary text-primary-foreground" onClick={() => void handleUpload()} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Upload size={16} className="mr-2 animate-pulse" />
                  Salvando
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedDoc} onOpenChange={(open) => !open && setSelectedDoc(null)}>
        <DialogContent className="portal-dialog border-border/50 max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedDoc?.name}</DialogTitle>
            <DialogDescription>Gerencie o documento selecionado.</DialogDescription>
          </DialogHeader>
          {selectedDoc && (
            <div className="space-y-4 py-2">
              <div className="rounded-xl border border-border/50 bg-muted/20 p-4 text-sm text-muted-foreground">
                <p>Tipo: {selectedDoc.type}</p>
                <p>Visibilidade: {selectedDoc.isPrivate ? "Privado" : "Compartilhável"}</p>
                <p>Tamanho: {selectedDoc.size ? formatFileSize(selectedDoc.size) : "Não informado"}</p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => void handleTogglePrivacy(selectedDoc)}>
                  {selectedDoc.isPrivate ? "Tornar público" : "Tornar privado"}
                </Button>
                <Button className="flex-1" onClick={() => void handleDownload(selectedDoc)}>
                  <Download size={16} className="mr-2" />
                  Abrir
                </Button>
                <Button variant="destructive" className="flex-1" onClick={() => void handleDelete(selectedDoc.id)}>
                  Excluir
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-emerald-500/30 bg-emerald-500/20 px-4 py-2 text-sm text-emerald-400">
          {toastMessage}
        </div>
      )}
    </motion.div>
  )
}
