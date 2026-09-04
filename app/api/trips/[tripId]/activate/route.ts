import { NextResponse } from "next/server"
import { ensureProfile } from "@/lib/auth/ensure-profile"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createWalletService } from "@/lib/wallet"
import type { WalletActivateTravelerTripErrorCode } from "@/types"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ tripId: string }>
}

type ActivationErrorDefinition = {
  status: number
  code: WalletActivateTravelerTripErrorCode
  error: string
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function errorResponse(definition: ActivationErrorDefinition) {
  return NextResponse.json(
    {
      error: definition.error,
      code: definition.code,
    },
    { status: definition.status },
  )
}

function resolveActivationError(error: unknown): ActivationErrorDefinition {
  const message = error instanceof Error ? error.message : ""

  if (message.includes("trip_link_insufficient_balance") || message.includes("Saldo insuficiente para consumo na wallet.")) {
    return {
      status: 409,
      code: "wallet_insufficient_balance",
      error: "Você não possui viagens disponíveis para ativar esta viagem.",
    }
  }

  if (message.includes("trip_activation_auth_required")) {
    return {
      status: 401,
      code: "unauthorized",
      error: "Login obrigatorio para ativar a viagem.",
    }
  }

  if (message.includes("trip_activation_not_found")) {
    return {
      status: 404,
      code: "trip_not_found",
      error: "Viagem nao encontrada.",
    }
  }

  if (message.includes("trip_activation_forbidden")) {
    return {
      status: 403,
      code: "trip_activation_forbidden",
      error: "Voce nao tem permissao para ativar esta viagem.",
    }
  }

  if (message.includes("trip_activation_owner_type_invalid")) {
    return {
      status: 409,
      code: "trip_owner_type_invalid",
      error: "Esta rota ativa apenas viagens de viajantes.",
    }
  }

  if (message.includes("trip_activation_status_invalid")) {
    return {
      status: 409,
      code: "trip_activation_status_invalid",
      error: "Uma viagem cancelada nao pode ter o link ativado.",
    }
  }

  if (message.includes("trip_activation_end_date_required")) {
    return {
      status: 409,
      code: "trip_activation_end_date_required",
      error: "Informe a data final da viagem antes de ativar o link.",
    }
  }

  if (message.includes("trip_activation_period_ended")) {
    return {
      status: 409,
      code: "trip_activation_period_ended",
      error: "O período de acesso desta viagem já terminou e ela não pode ser ativada.",
    }
  }

  if (message.includes("trip_activation_idempotency_conflict")) {
    return {
      status: 409,
      code: "trip_activation_idempotency_conflict",
      error: "A ativacao desta viagem entrou em conflito. Atualize a pagina e tente novamente.",
    }
  }

  if (
    message.includes("trip_activation_transaction_invalid") ||
    message.includes("traveler_trip_link_activation_transaction_invalid")
  ) {
    return {
      status: 409,
      code: "trip_activation_transaction_invalid",
      error: "Nao foi possivel validar o consumo do Link desta viagem.",
    }
  }

  if (message.includes("trip_activation_wallet_inactive")) {
    return {
      status: 409,
      code: "wallet_inactive",
      error: "Sua carteira de Links nao esta ativa.",
    }
  }

  return {
    status: 500,
    code: "trip_activation_failed",
    error: "Nao foi possivel ativar o Link da Viagem.",
  }
}

export async function POST(_: Request, { params }: RouteContext) {
  const supabase = await createSupabaseServerClient()
  if (!supabase) {
    return errorResponse({
      status: 503,
      code: "supabase_unavailable",
      error: "Supabase indisponivel para ativar a viagem.",
    })
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return errorResponse({
      status: 401,
      code: "unauthorized",
      error: "Login obrigatorio para ativar a viagem.",
    })
  }

  const { tripId: rawTripId } = await params
  const tripId = rawTripId.trim()
  if (!UUID_PATTERN.test(tripId)) {
    return errorResponse({
      status: 400,
      code: "invalid_trip_id",
      error: "Identificador da viagem invalido.",
    })
  }

  try {
    const profile = await ensureProfile(user, supabase)
    if (!profile || profile.role !== "traveler") {
      return errorResponse({
        status: 403,
        code: "traveler_required",
        error: "Esta rota esta disponivel apenas para viajantes.",
      })
    }

    const walletService = createWalletService(supabase)
    const activation = await walletService.activateTravelerTripWithWallet({ tripId })

    return NextResponse.json(activation)
  } catch (error) {
    const failure = resolveActivationError(error)
    if (failure.status >= 500) {
      console.error("[TRIP] activation route error", error instanceof Error ? error.message : error)
    }
    return errorResponse(failure)
  }
}
