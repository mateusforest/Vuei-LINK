"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  FileText,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  MapPin,
  Calendar,
  Clock,
  Star,
  Copy,
  Edit,
  Trash2,
  Eye,
  Sparkles,
  X,
  Check
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useMaster } from "@/contexts/master-context"

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
}

const stagger = {
  animate: { transition: { staggerChildren: 0.1 } }
}

const templates = [
  {
    id: 1,
    name: "Japão Completo",
    destination: "Japão",
    days: 14,
    experiences: 28,
    category: "Asia",
    featured: true,
    usageCount: 1247,
    image: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400",
  },
  {
    id: 2,
    name: "Disney Orlando",
    destination: "Orlando, EUA",
    days: 7,
    experiences: 14,
    category: "Parques",
    featured: true,
    usageCount: 2341,
    image: "https://images.unsplash.com/photo-1597466599360-3b9775841aec?w=400",
  },
  {
    id: 3,
    name: "Europa Clássica",
    destination: "Multi-destino",
    days: 21,
    experiences: 42,
    category: "Europa",
    featured: false,
    usageCount: 892,
    image: "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=400",
  },
  {
    id: 4,
    name: "Caribe Relaxante",
    destination: "Caribe",
    days: 7,
    experiences: 12,
    category: "Praia",
    featured: false,
    usageCount: 567,
    image: "https://images.unsplash.com/photo-1590523741831-ab7e8b8f9c7f?w=400",
  },
  {
    id: 5,
    name: "Lua de Mel Maldivas",
    destination: "Maldivas",
    days: 10,
    experiences: 18,
    category: "Romântico",
    featured: true,
    usageCount: 423,
    image: "https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=400",
  },
  {
    id: 6,
    name: "Cruzeiro Mediterrâneo",
    destination: "Mediterrâneo",
    days: 12,
    experiences: 24,
    category: "Cruzeiros",
    featured: false,
    usageCount: 312,
    image: "https://images.unsplash.com/photo-1548574505-5e239809ee19?w=400",
  },
]

const categories = [
  { value: "all", label: "Todas" },
  { value: "asia", label: "Ásia" },
  { value: "europa", label: "Europa" },
  { value: "parques", label: "Parques" },
  { value: "praia", label: "Praia" },
  { value: "romantico", label: "Romântico" },
  { value: "cruzeiros", label: "Cruzeiros" },
]

export default function MasterTemplatesPage() {
  const { templates, addTemplate, deleteTemplate, toggleTemplateFeatured } = useMaster()
  
  const [searchQuery, setSearchQuery] = useState("")
  const [showNewModal, setShowNewModal] = useState(false)
  const [newTemplate, setNewTemplate] = useState({ name: "", destination: "", days: "", category: "Europa" })

  const filteredTemplates = templates.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.destination.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleCreateTemplate = () => {
    if (!newTemplate.name || !newTemplate.destination || !newTemplate.days) return
    addTemplate({
      name: newTemplate.name,
      destination: newTemplate.destination,
      days: parseInt(newTemplate.days),
      category: newTemplate.category,
      experiences: Math.floor(parseInt(newTemplate.days) * 2),
      image: "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=400"
    })
    setNewTemplate({ name: "", destination: "", days: "", category: "Europa" })
    setShowNewModal(false)
  }

  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={stagger}
      className="space-y-8"
    >
      {/* Header */}
      <motion.div variants={fadeInUp} className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">
            Templates Master
          </h1>
          <p className="text-sm text-muted-foreground">
            Roteiros oficiais e experiências base da plataforma
          </p>
        </div>
        <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white gap-2 w-fit" onClick={() => setShowNewModal(true)}>
          <Plus className="h-4 w-4" />
          Novo Template
        </Button>
      </motion.div>

      {/* Stats */}
      <motion.div variants={fadeInUp} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-white/5 bg-black/40 backdrop-blur-xl p-5">
          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground">Total Templates</span>
            <div className="text-2xl font-bold text-foreground">{templates.length}</div>
          </div>
        </Card>
        <Card className="border-white/5 bg-black/40 backdrop-blur-xl p-5">
          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground">Destinos</span>
            <div className="text-2xl font-bold text-foreground">{new Set(templates.map(t => t.destination)).size}</div>
          </div>
        </Card>
        <Card className="border-white/5 bg-black/40 backdrop-blur-xl p-5">
          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground">Usos Este Mes</span>
            <div className="text-2xl font-bold text-foreground">{templates.reduce((sum, t) => sum + t.usageCount, 0).toLocaleString()}</div>
          </div>
        </Card>
        <Card className="border-white/5 bg-black/40 backdrop-blur-xl p-5">
          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground">Em Destaque</span>
            <div className="text-2xl font-bold text-foreground">{templates.filter(t => t.featured).length}</div>
          </div>
        </Card>
      </motion.div>

      {/* Filters */}
      <motion.div variants={fadeInUp} className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-black/40 border-white/10 focus:border-primary/50"
          />
        </div>
        <div className="flex gap-3">
          <Select defaultValue="all">
            <SelectTrigger className="w-[150px] bg-black/40 border-white/10">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent className="bg-card border-white/10">
              {categories.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" className="border-white/10 hover:bg-white/5">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>

      {/* Templates Grid */}
      <motion.div variants={fadeInUp} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((template) => (
          <Card
            key={template.id}
            className="group relative overflow-hidden border-white/5 bg-black/40 backdrop-blur-xl hover:border-primary/20 transition-all duration-300"
          >
            {/* Image */}
            <div className="relative h-40 overflow-hidden">
              <img
                src={template.image}
                alt={template.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              
              {/* Featured Badge */}
              {template.featured && (
                <div className="absolute top-3 left-3 px-2 py-1 bg-yellow-500/20 border border-yellow-500/30 rounded-full flex items-center gap-1">
                  <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                  <span className="text-xs font-medium text-yellow-400">Destaque</span>
                </div>
              )}

              {/* Actions */}
              <div className="absolute top-3 right-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 bg-black/40 hover:bg-black/60 backdrop-blur-sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 bg-card/95 backdrop-blur-xl border-white/10">
                    <DropdownMenuItem className="text-xs gap-2" onClick={() => toggleTemplateFeatured(template.id)}>
                      <Star className="h-3.5 w-3.5" />
                      {template.featured ? "Remover Destaque" : "Destacar"}
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-xs gap-2">
                      <Copy className="h-3.5 w-3.5" />
                      Duplicar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-white/5" />
                    <DropdownMenuItem className="text-xs gap-2 text-red-400" onClick={() => deleteTemplate(template.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Category */}
              <div className="absolute bottom-3 left-3">
                <span className="px-2 py-1 bg-primary/20 border border-primary/30 rounded-full text-xs font-medium text-primary">
                  {template.category}
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-1">{template.name}</h3>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {template.destination}
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    {template.days} dias
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5" />
                    {template.experiences} exp.
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {template.usageCount.toLocaleString()} usos
                </div>
              </div>
            </div>
          </Card>
        ))}
      </motion.div>

      {/* Load More */}
      <motion.div variants={fadeInUp} className="flex justify-center">
        <Button variant="outline" className="border-white/10 hover:bg-white/5">
          Carregar mais templates
        </Button>
      </motion.div>

      {/* New Template Modal */}
      <AnimatePresence>
        {showNewModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setShowNewModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-2xl p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">Novo Template</h3>
                <button onClick={() => setShowNewModal(false)} className="p-2 hover:bg-white/5 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-white/50 uppercase tracking-wider">Nome</Label>
                  <Input
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                    placeholder="Ex: Europa Classica"
                    className="mt-1 bg-white/5 border-white/10"
                  />
                </div>
                <div>
                  <Label className="text-xs text-white/50 uppercase tracking-wider">Destino</Label>
                  <Input
                    value={newTemplate.destination}
                    onChange={(e) => setNewTemplate({ ...newTemplate, destination: e.target.value })}
                    placeholder="Ex: Paris, Franca"
                    className="mt-1 bg-white/5 border-white/10"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-white/50 uppercase tracking-wider">Dias</Label>
                    <Input
                      type="number"
                      value={newTemplate.days}
                      onChange={(e) => setNewTemplate({ ...newTemplate, days: e.target.value })}
                      placeholder="Ex: 7"
                      className="mt-1 bg-white/5 border-white/10"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-white/50 uppercase tracking-wider">Categoria</Label>
                    <Select value={newTemplate.category} onValueChange={(v) => setNewTemplate({ ...newTemplate, category: v })}>
                      <SelectTrigger className="mt-1 bg-white/5 border-white/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-white/10">
                        <SelectItem value="Europa">Europa</SelectItem>
                        <SelectItem value="Asia">Asia</SelectItem>
                        <SelectItem value="Parques">Parques</SelectItem>
                        <SelectItem value="Praia">Praia</SelectItem>
                        <SelectItem value="Romantico">Romantico</SelectItem>
                        <SelectItem value="Cruzeiros">Cruzeiros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  onClick={handleCreateTemplate}
                  disabled={!newTemplate.name || !newTemplate.destination || !newTemplate.days}
                  className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Criar Template
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
