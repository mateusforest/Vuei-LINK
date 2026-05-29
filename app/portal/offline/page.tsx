"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { 
  WifiOff, 
  Download, 
  Check, 
  FileText,
  Route,
  Building,
  Plane,
  Shield,
  HardDrive,
  RefreshCw,
  Clock,
  AlertCircle,
  CheckCircle2,
  Loader2
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
}

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
}

// Mock offline data
const offlineItems = [
  { id: "1", name: "Roteiro completo", type: "itinerary", icon: Route, size: "2.3 MB", saved: true },
  { id: "2", name: "Passaporte", type: "document", icon: FileText, size: "1.1 MB", saved: true },
  { id: "3", name: "Voucher Hotel", type: "document", icon: Building, size: "0.8 MB", saved: true },
  { id: "4", name: "Passagens", type: "document", icon: Plane, size: "0.5 MB", saved: true },
  { id: "5", name: "Seguro Viagem", type: "document", icon: Shield, size: "0.6 MB", saved: false },
]

export default function OfflinePage() {
  const [downloading, setDownloading] = useState<string | null>(null)
  const [downloadProgress, setDownloadProgress] = useState(0)
  
  const savedItems = offlineItems.filter(i => i.saved)
  const totalSize = savedItems.reduce((acc, item) => acc + parseFloat(item.size), 0).toFixed(1)
  const lastSync = "Há 2 horas"

  const handleDownload = (id: string) => {
    setDownloading(id)
    setDownloadProgress(0)
    
    const interval = setInterval(() => {
      setDownloadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          setDownloading(null)
          return 100
        }
        return prev + 10
      })
    }, 200)
  }

  const handleDownloadAll = () => {
    setDownloading('all')
    setDownloadProgress(0)
    
    const interval = setInterval(() => {
      setDownloadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          setDownloading(null)
          return 100
        }
        return prev + 5
      })
    }, 200)
  }

  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={staggerContainer}
      className="space-y-6 max-w-4xl mx-auto"
    >
      {/* Header */}
      <motion.div variants={fadeInUp} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Modo Offline</h1>
          <p className="text-sm text-muted-foreground">Acesse sua viagem sem internet</p>
        </div>
        <Badge className="bg-green-500/20 text-green-400 border-0">
          <CheckCircle2 size={14} className="mr-1" />
          Disponível
        </Badge>
      </motion.div>

      {/* Status Card */}
      <motion.div variants={fadeInUp}>
        <Card className="p-6 bg-gradient-to-br from-primary/10 via-card/50 to-secondary/10 border-primary/20 vuei-glass">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <WifiOff size={28} className="text-primary-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Viagem salva offline</h3>
                <p className="text-sm text-muted-foreground">
                  {savedItems.length} itens salvos • {totalSize} MB
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock size={12} />
                  <span>Última sincronização</span>
                </div>
                <p className="text-sm font-medium">{lastSync}</p>
              </div>
              <Button 
                variant="outline" 
                size="icon"
                className="rounded-xl border-border/50"
                onClick={handleDownloadAll}
                disabled={downloading !== null}
              >
                {downloading === 'all' ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <RefreshCw size={18} />
                )}
              </Button>
            </div>
          </div>

          {/* Download Progress */}
          {downloading === 'all' && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Sincronizando...</span>
                <span>{downloadProgress}%</span>
              </div>
              <Progress value={downloadProgress} className="h-2" />
            </div>
          )}
        </Card>
      </motion.div>

      {/* Saved Items */}
      <motion.div variants={fadeInUp}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Conteúdo Offline</h2>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-primary text-xs"
            onClick={handleDownloadAll}
            disabled={downloading !== null}
          >
            <Download size={14} className="mr-1" />
            Baixar tudo
          </Button>
        </div>

        <Card className="bg-card/50 border-border/50 vuei-glass divide-y divide-border/50">
          {offlineItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  item.saved ? 'bg-primary/20' : 'bg-muted/50'
                }`}>
                  <item.icon size={18} className={item.saved ? 'text-primary' : 'text-muted-foreground'} />
                </div>
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.size}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {downloading === item.id ? (
                  <div className="flex items-center gap-2">
                    <Progress value={downloadProgress} className="w-16 h-1" />
                    <Loader2 size={16} className="animate-spin text-primary" />
                  </div>
                ) : item.saved ? (
                  <Badge className="bg-green-500/20 text-green-400 border-0 text-xs">
                    <Check size={12} className="mr-1" />
                    Salvo
                  </Badge>
                ) : (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleDownload(item.id)}
                    className="text-primary text-xs"
                  >
                    <Download size={14} className="mr-1" />
                    Baixar
                  </Button>
                )}
              </div>
            </div>
          ))}
        </Card>
      </motion.div>

      {/* Storage Info */}
      <motion.div variants={fadeInUp}>
        <Card className="p-5 bg-card/50 border-border/50 vuei-glass">
          <div className="flex items-center gap-3 mb-4">
            <HardDrive size={20} className="text-muted-foreground" />
            <h3 className="font-semibold">Armazenamento</h3>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Usado</span>
              <span>{totalSize} MB de 50 MB</span>
            </div>
            <Progress value={(parseFloat(totalSize) / 50) * 100} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {(50 - parseFloat(totalSize)).toFixed(1)} MB disponíveis para mais conteúdo
            </p>
          </div>
        </Card>
      </motion.div>

      {/* Info Notice */}
      <motion.div variants={fadeInUp}>
        <Card className="p-4 bg-muted/20 border-border/50">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="text-muted-foreground shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p>O conteúdo offline fica disponível por 30 dias após a última sincronização.</p>
              <p className="mt-1">Para manter seus dados atualizados, conecte-se à internet periodicamente.</p>
            </div>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  )
}
