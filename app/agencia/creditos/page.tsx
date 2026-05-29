"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
  Sparkles,
  TrendingUp,
  Clock,
  Zap,
  CreditCard,
  CheckCircle,
  ArrowRight,
  Crown,
  Check,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useAgency } from "@/contexts/agency-context"

const packages = [
  {
    id: 1,
    name: "Starter",
    credits: 500,
    price: 49,
    pricePerCredit: "R$ 0,10",
    popular: false,
  },
  {
    id: 2,
    name: "Pro",
    credits: 1500,
    price: 119,
    pricePerCredit: "R$ 0,08",
    popular: true,
    savings: "20%",
  },
  {
    id: 3,
    name: "Business",
    credits: 5000,
    price: 349,
    pricePerCredit: "R$ 0,07",
    popular: false,
    savings: "30%",
  },
]

const plans = [
  {
    name: "Basico",
    price: 0,
    features: ["100 creditos/mes", "Concierge basico", "1 usuario"],
    current: false,
  },
  {
    name: "Pro",
    price: 199,
    features: ["1000 creditos/mes", "Concierge ilimitado", "5 usuarios", "Templates premium", "Suporte prioritario"],
    current: true,
  },
  {
    name: "Enterprise",
    price: 499,
    features: ["Creditos ilimitados", "API acesso", "Usuarios ilimitados", "White label", "Gerente dedicado"],
    current: false,
  },
]

export default function CreditsPage() {
  const { credits, addCredits } = useAgency()
  const [purchasing, setPurchasing] = useState<number | null>(null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)

  const handlePurchase = async (pkg: typeof packages[0]) => {
    setPurchasing(pkg.id)
    await new Promise(resolve => setTimeout(resolve, 1500))
    addCredits(pkg.credits)
    setPurchasing(null)
  }

  // Calculate usage stats
  const todayUsage = credits.history
    .filter(h => {
      const today = new Date().toDateString()
      return new Date(h.date).toDateString() === today && h.amount < 0
    })
    .reduce((sum, h) => sum + Math.abs(h.amount), 0)

  const weekUsage = credits.history
    .filter(h => {
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      return new Date(h.date) > weekAgo && h.amount < 0
    })
    .reduce((sum, h) => sum + Math.abs(h.amount), 0)

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Creditos IA</h1>
        <p className="mt-1 text-muted-foreground">Gerencie seus creditos e plano</p>
      </div>

      {/* Balance Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="overflow-hidden border-white/5 bg-gradient-to-br from-card via-primary/5 to-accent/5">
          <CardContent className="p-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Saldo disponivel
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-foreground">{credits.balance.toLocaleString()}</span>
                  <span className="text-muted-foreground">creditos</span>
                </div>
                <div className="mt-4 h-2 w-64 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((credits.balance / 5000) * 100, 100)}%` }}
                    transition={{ duration: 1, delay: 0.3 }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {Math.round((credits.balance / 5000) * 100)}% do limite maximo
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
                  <Zap className="mx-auto h-5 w-5 text-primary" />
                  <p className="mt-2 text-2xl font-bold text-foreground">{todayUsage}</p>
                  <p className="text-xs text-muted-foreground">Usados hoje</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
                  <Clock className="mx-auto h-5 w-5 text-accent" />
                  <p className="mt-2 text-2xl font-bold text-foreground">{weekUsage}</p>
                  <p className="text-xs text-muted-foreground">Esta semana</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
                  <TrendingUp className="mx-auto h-5 w-5 text-green-400" />
                  <p className="mt-2 text-2xl font-bold text-foreground">+12%</p>
                  <p className="text-xs text-muted-foreground">vs mes ant.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Usage History */}
        <Card className="border-white/5 bg-card/50 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Clock className="h-4 w-4 text-primary" />
              Historico de Uso
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {credits.history.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                Nenhum historico ainda
              </div>
            ) : (
              credits.history.slice(0, 6).map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`rounded-lg p-2 ${
                        item.amount > 0 ? "bg-green-500/10" : "bg-primary/10"
                      }`}
                    >
                      {item.amount > 0 ? (
                        <CreditCard className="h-4 w-4 text-green-400" />
                      ) : (
                        <Sparkles className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.action}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        {item.description && ` - ${item.description}`}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`font-semibold ${
                      item.amount > 0 ? "text-green-400" : "text-muted-foreground"
                    }`}
                  >
                    {item.amount > 0 ? "+" : ""}
                    {item.amount}
                  </span>
                </motion.div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Buy Credits */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">Comprar Creditos</h3>
          {packages.map((pkg, index) => (
            <motion.div
              key={pkg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card
                className={`border-white/5 bg-card/50 transition-all hover:border-primary/20 ${
                  pkg.popular ? "border-primary/50 bg-primary/5" : ""
                }`}
              >
                <CardContent className="p-4">
                  {pkg.popular && (
                    <Badge className="mb-2 bg-primary text-[10px] text-white">Mais popular</Badge>
                  )}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{pkg.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {pkg.credits.toLocaleString()} creditos
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-foreground">R$ {pkg.price}</p>
                      <p className="text-xs text-muted-foreground">{pkg.pricePerCredit}/credito</p>
                    </div>
                  </div>
                  {pkg.savings && (
                    <Badge variant="outline" className="mt-2 border-green-500/30 bg-green-500/10 text-green-400">
                      Economia de {pkg.savings}
                    </Badge>
                  )}
                  <Button
                    className={`mt-3 w-full ${
                      pkg.popular
                        ? "bg-gradient-to-r from-primary to-accent text-white"
                        : "border-white/10 bg-white/5 text-foreground hover:bg-white/10"
                    }`}
                    variant={pkg.popular ? "default" : "outline"}
                    onClick={() => handlePurchase(pkg)}
                    disabled={purchasing !== null}
                  >
                    {purchasing === pkg.id ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                        Processando...
                      </>
                    ) : (
                      "Comprar"
                    )}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Plans */}
      <div>
        <h3 className="mb-4 text-sm font-medium text-muted-foreground">Planos</h3>
        <div className="grid gap-4 lg:grid-cols-3">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card
                className={`h-full border-white/5 bg-card/50 ${
                  plan.current ? "border-primary/50 bg-primary/5" : ""
                }`}
              >
                <CardContent className="flex h-full flex-col p-6">
                  {plan.current && (
                    <Badge className="mb-2 w-fit bg-primary text-[10px] text-white">Plano atual</Badge>
                  )}
                  <div className="flex items-center gap-2">
                    {plan.name === "Enterprise" && <Crown className="h-5 w-5 text-yellow-500" />}
                    <h4 className="text-lg font-semibold text-foreground">{plan.name}</h4>
                  </div>
                  <div className="mt-2">
                    <span className="text-3xl font-bold text-foreground">
                      {plan.price === 0 ? "Gratis" : `R$ ${plan.price}`}
                    </span>
                    {plan.price > 0 && <span className="text-muted-foreground">/mes</span>}
                  </div>
                  <ul className="mt-4 flex-1 space-y-2">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle className="h-4 w-4 text-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={`mt-4 w-full ${
                      plan.current
                        ? "border-white/10 bg-white/5 text-muted-foreground"
                        : "bg-gradient-to-r from-primary to-accent text-white"
                    }`}
                    variant={plan.current ? "outline" : "default"}
                    disabled={plan.current}
                    onClick={() => !plan.current && setUpgradeOpen(true)}
                  >
                    {plan.current ? "Plano atual" : "Fazer upgrade"}
                    {!plan.current && <ArrowRight className="ml-2 h-4 w-4" />}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent className="border-white/10 bg-card sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Fazer upgrade</DialogTitle>
            <DialogDescription>Escolha um novo plano para aumentar seus creditos e beneficios.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground">Plano atual</p>
              <p className="text-lg font-semibold text-foreground">Pro</p>
              <p className="text-sm text-muted-foreground">{credits.balance} creditos disponiveis agora</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {plans.filter((plan) => !plan.current).map((plan) => (
                <Card key={plan.name} className="border-white/10 bg-white/[0.02]">
                  <CardContent className="space-y-4 p-5">
                    <div>
                      <p className="text-lg font-semibold text-foreground">{plan.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {plan.price === 0 ? "Gratis" : `R$ ${plan.price}/mes`}
                      </p>
                    </div>
                    <div className="space-y-2">
                      {plan.features.map((feature) => (
                        <div key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Check className="h-4 w-4 text-primary" />
                          {feature}
                        </div>
                      ))}
                    </div>
                    <Button
                      className="w-full bg-gradient-to-r from-primary to-accent text-white"
                      onClick={() => setUpgradeOpen(false)}
                    >
                      Selecionar plano
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
