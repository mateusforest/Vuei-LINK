import type { AiModule } from "@/types"

export interface PromptBuildInput {
  module: AiModule
  systemPrompt: string
  userPromptTemplate?: string | null
  variables?: Record<string, string | number | boolean | null | undefined>
}

function interpolateTemplate(template: string, variables: Record<string, string | number | boolean | null | undefined>) {
  return Object.entries(variables).reduce((result, [key, value]) => {
    return result.replaceAll(`{${key}}`, value == null ? "" : String(value))
  }, template)
}

export function buildPrompt(input: PromptBuildInput) {
  const variables = input.variables || {}
  const userPrompt = input.userPromptTemplate ? interpolateTemplate(input.userPromptTemplate, variables) : ""

  return {
    module: input.module,
    systemPrompt: input.systemPrompt,
    userPrompt,
    variables,
  }
}
