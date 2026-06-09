const OPENAI_MODEL = process.env.OPENAI_CONCIERGE_MODEL ?? "gpt-4.1-mini"

export interface ConciergeHistoryMessage {
  role: string
  content: string
}

export async function requestConciergeReply(systemPrompt: string, history: ConciergeHistoryMessage[], userPrompt: string) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return {
      ok: false as const,
      calledModel: false as const,
      model: null,
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      },
      error: "A IA operacional ainda nao esta configurada no servidor. Defina OPENAI_API_KEY para habilitar respostas reais.",
    }
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.3,
      max_completion_tokens: 600,
      messages: [
        { role: "system", content: systemPrompt },
        ...history.map((message) => ({
          role: message.role === "assistant" ? "assistant" : "user",
          content: message.content,
        })),
        { role: "user", content: userPrompt },
      ],
    }),
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    return {
      ok: false as const,
      calledModel: true as const,
      model: OPENAI_MODEL,
      usage: {
        inputTokens: data?.usage?.prompt_tokens ?? 0,
        outputTokens: data?.usage?.completion_tokens ?? 0,
        totalTokens: data?.usage?.total_tokens ?? 0,
      },
      error: data?.error?.message || "A chamada real de IA falhou no servidor.",
    }
  }

  const content = data?.choices?.[0]?.message?.content?.trim?.()
  if (!content) {
    return {
      ok: false as const,
      calledModel: true as const,
      model: OPENAI_MODEL,
      usage: {
        inputTokens: data?.usage?.prompt_tokens ?? 0,
        outputTokens: data?.usage?.completion_tokens ?? 0,
        totalTokens: data?.usage?.total_tokens ?? 0,
      },
      error: "A IA nao retornou uma resposta valida para esta pergunta.",
    }
  }

  return {
    ok: true as const,
    calledModel: true as const,
    content,
    model: OPENAI_MODEL,
    usage: {
      inputTokens: data?.usage?.prompt_tokens ?? 0,
      outputTokens: data?.usage?.completion_tokens ?? 0,
      totalTokens: data?.usage?.total_tokens ?? 0,
    },
  }
}
