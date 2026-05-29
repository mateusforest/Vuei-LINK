"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  FileText, 
  Image as ImageIcon,
  Shield,
  Lock,
  Eye,
  EyeOff,
  Upload,
  Plus,
  MoreVertical,
  Download,
  Trash2,
  Fingerprint,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  X
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
}

// Mock documents data
const documents = [
  {
    id: "1",
    name: "Passaporte",
    type: "passport",
    icon: FileText,
    isPrivate: true,
    hasFile: true,
    expiryDate: "2028-05-15",
    thumbnail: "/placeholder-doc.jpg"
  },
  {
    id: "2",
    name: "RG",
    type: "id",
    icon: FileText,
    isPrivate: true,
    hasFile: true,
    thumbnail: "/placeholder-doc.jpg"
  },
  {
    id: "3",
    name: "CNH",
    type: "license",
    icon: FileText,
    isPrivate: true,
    hasFile: false,
  },
  {
    id: "4",
    name: "Visto Portugal",
    type: "visa",
    icon: FileText,
    isPrivate: false,
    hasFile: true,
    expiryDate: "2025-12-31",
    thumbnail: "/placeholder-doc.jpg"
  },
  {
    id: "5",
    name: "Voucher Hotel",
    type: "voucher",
    icon: ImageIcon,
    isPrivate: false,
    hasFile: true,
    thumbnail: "/placeholder-doc.jpg"
  },
  {
    id: "6",
    name: "Seguro Viagem",
    type: "insurance",
    icon: Shield,
    isPrivate: false,
    hasFile: true,
    thumbnail: "/placeholder-doc.jpg"
  },
]

export default function DocumentosPage() {
  const [selectedDoc, setSelectedDoc] = useState<typeof documents[0] | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showPinModal, setShowPinModal] = useState(false)
  const [pinVerified, setPinVerified] = useState(false)
  const [pin, setPin] = useState("")

  const privateDocuments = documents.filter(d => d.isPrivate)
  const sharedDocuments = documents.filter(d => !d.isPrivate)

  const handleViewPrivate = () => {
    if (!pinVerified) {
      setShowPinModal(true)
    }
  }

  const verifyPin = () => {
    if (pin.length === 4) {
      setPinVerified(true)
      setShowPinModal(false)
      setPin("")
    }
  }

  return (
    <motion.div
      initial="initial"
      animate="animate"
      className="space-y-6 max-w-4xl mx-auto"
    >
      {/* Header */}
      <motion.div variants={fadeInUp} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Documentos</h1>
          <p className="text-sm text-muted-foreground">Seus documentos de viagem seguros</p>
        </div>
        <Button 
          onClick={() => setShowUploadModal(true)}
          className="rounded-xl bg-gradient-to-r from-primary to-secondary text-primary-foreground vuei-button-glow"
        >
          <Plus size={18} className="mr-2" />
          Adicionar
        </Button>
      </motion.div>

      {/* Security Notice */}
      <motion.div variants={fadeInUp}>
        <Card className="p-4 bg-primary/5 border-primary/20">
          <div className="flex items-start gap-3">
            <Shield size={20} className="text-primary shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-sm">Documentos Protegidos</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Documentos privados são protegidos por PIN e não aparecem no link compartilhável.
              </p>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Private Documents Section */}
      <motion.div variants={fadeInUp}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Lock size={16} className="text-primary" />
            <h2 className="font-semibold">Documentos Privados</h2>
            <Badge variant="secondary" className="bg-muted/50 text-xs">
              {privateDocuments.length}
            </Badge>
          </div>
          {!pinVerified && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-primary text-xs"
              onClick={handleViewPrivate}
            >
              <Fingerprint size={14} className="mr-1" />
              Desbloquear
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {privateDocuments.map((doc, index) => (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
            >
              <Card 
                className={`p-4 bg-card/50 border-border/50 vuei-glass cursor-pointer hover:border-primary/30 transition-all duration-300 relative overflow-hidden ${!pinVerified ? 'select-none' : ''}`}
                onClick={() => pinVerified && setSelectedDoc(doc)}
              >
                {/* Blur overlay when locked */}
                {!pinVerified && (
                  <div className="absolute inset-0 backdrop-blur-md bg-background/50 z-10 flex items-center justify-center">
                    <Lock size={24} className="text-muted-foreground" />
                  </div>
                )}

                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${doc.hasFile ? 'bg-primary/20' : 'bg-muted/50'}`}>
                    <doc.icon size={18} className={doc.hasFile ? 'text-primary' : 'text-muted-foreground'} />
                  </div>
                  <Badge className="bg-amber-500/20 text-amber-400 border-0 text-[10px]">
                    <EyeOff size={10} className="mr-1" />
                    Privado
                  </Badge>
                </div>
                <h3 className="font-medium text-sm truncate">{doc.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {doc.hasFile ? "Documento salvo" : "Não adicionado"}
                </p>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Shared Documents Section */}
      <motion.div variants={fadeInUp}>
        <div className="flex items-center gap-2 mb-4">
          <Eye size={16} className="text-secondary" />
          <h2 className="font-semibold">Documentos Compartilháveis</h2>
          <Badge variant="secondary" className="bg-muted/50 text-xs">
            {sharedDocuments.length}
          </Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {sharedDocuments.map((doc, index) => (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
            >
              <Card 
                className="p-4 bg-card/50 border-border/50 vuei-glass cursor-pointer hover:border-primary/30 transition-all duration-300"
                onClick={() => setSelectedDoc(doc)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${doc.hasFile ? 'bg-secondary/20' : 'bg-muted/50'}`}>
                    <doc.icon size={18} className={doc.hasFile ? 'text-secondary' : 'text-muted-foreground'} />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical size={14} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="vuei-glass">
                      <DropdownMenuItem>
                        <Download size={14} className="mr-2" />
                        Baixar
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Lock size={14} className="mr-2" />
                        Tornar privado
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive">
                        <Trash2 size={14} className="mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <h3 className="font-medium text-sm truncate">{doc.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  {doc.expiryDate && (
                    <p className="text-xs text-muted-foreground">
                      Validade: {new Date(doc.expiryDate).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                  {doc.hasFile && (
                    <CheckCircle2 size={12} className="text-green-500" />
                  )}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Privacy Info */}
      <motion.div variants={fadeInUp}>
        <Card className="p-4 bg-muted/20 border-border/50">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="text-muted-foreground shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p>Documentos privados são visíveis apenas para você após verificação biométrica ou PIN.</p>
              <p className="mt-1">Ao compartilhar sua viagem, apenas documentos compartilháveis serão visíveis.</p>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* PIN Modal */}
      <Dialog open={showPinModal} onOpenChange={setShowPinModal}>
        <DialogContent className="vuei-glass border-border/50 max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Fingerprint size={20} className="text-primary" />
              Verificação de Segurança
            </DialogTitle>
            <DialogDescription>
              Digite seu PIN de 4 dígitos para acessar documentos privados.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* PIN Input */}
            <div className="flex justify-center gap-3">
              {[0, 1, 2, 3].map((index) => (
                <div
                  key={index}
                  className={`w-12 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-all ${
                    pin.length > index 
                      ? 'border-primary bg-primary/10' 
                      : 'border-border/50 bg-muted/20'
                  }`}
                >
                  {pin[index] ? "•" : ""}
                </div>
              ))}
            </div>

            {/* Numeric Keypad */}
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'].map((num, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  className={`h-14 text-xl font-medium rounded-xl ${num === null ? 'invisible' : ''}`}
                  onClick={() => {
                    if (num === 'del') {
                      setPin(prev => prev.slice(0, -1))
                    } else if (num !== null && pin.length < 4) {
                      const newPin = pin + num
                      setPin(newPin)
                      if (newPin.length === 4) {
                        setTimeout(verifyPin, 200)
                      }
                    }
                  }}
                >
                  {num === 'del' ? <X size={20} /> : num}
                </Button>
              ))}
            </div>

            {/* Face ID Option */}
            <Button variant="outline" className="w-full rounded-xl border-border/50">
              <Fingerprint size={18} className="mr-2" />
              Usar Face ID
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload Modal */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="vuei-glass border-border/50">
          <DialogHeader>
            <DialogTitle>Adicionar Documento</DialogTitle>
            <DialogDescription>
              Faça upload de um novo documento para sua viagem.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Upload Area */}
            <div className="border-2 border-dashed border-border/50 rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
              <Upload size={32} className="mx-auto text-muted-foreground mb-3" />
              <p className="font-medium">Arraste um arquivo ou clique para selecionar</p>
              <p className="text-sm text-muted-foreground mt-1">PDF, JPG, PNG até 10MB</p>
            </div>

            {/* Document Type Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de documento</label>
              <div className="grid grid-cols-2 gap-2">
                {['Passaporte', 'RG', 'CNH', 'Visto', 'Voucher', 'Seguro', 'Outro'].map((type) => (
                  <Button
                    key={type}
                    variant="outline"
                    className="rounded-xl border-border/50 justify-start"
                  >
                    {type}
                  </Button>
                ))}
              </div>
            </div>

            {/* Privacy Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/50">
              <div className="flex items-center gap-2">
                <Lock size={16} className="text-primary" />
                <span className="text-sm font-medium">Documento privado</span>
              </div>
              <Button variant="ghost" size="sm" className="text-xs">
                Ativado
              </Button>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowUploadModal(false)}>
              Cancelar
            </Button>
            <Button className="flex-1 rounded-xl bg-gradient-to-r from-primary to-secondary text-primary-foreground">
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
