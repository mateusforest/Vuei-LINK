"use client"

import { SupportCenter } from "@/components/support/support-center"

export default function AgencySupportPage() {
  return (
    <SupportCenter
      portalType="agency"
      title="Suporte"
      subtitle="Acompanhe os chamados da sua agência."
      emptyTitle="Sua agência ainda não abriu nenhum chamado."
      emptyDescription="Abra um novo chamado pelo botão de suporte e acompanhe por aqui as respostas e o status."
    />
  )
}
