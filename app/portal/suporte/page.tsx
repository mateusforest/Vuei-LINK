"use client"

import { SupportCenter } from "@/components/support/support-center"

export default function PortalSupportPage() {
  return (
    <SupportCenter
      portalType="traveler"
      title="Suporte"
      subtitle="Acompanhe seus chamados e respostas da equipe Vuei."
      emptyTitle="Você ainda não abriu nenhum chamado."
      emptyDescription="Quando precisar de ajuda, abra um chamado e acompanhe por aqui o andamento e as respostas."
    />
  )
}
