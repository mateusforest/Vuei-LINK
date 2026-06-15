import "server-only"

import type { User } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/types"
import { buildAbsoluteAppUrl } from "@/lib/app-url"
import {
  getStripeClient,
  getStripePriceIdForAgencyCreditPackage,
  getStripePriceIdForAgencyPlan,
} from "@/lib/billing/stripe"
import {
  ensureAgencySubscriptionRow,
  updateAgencyStripeCustomerId,
} from "@/lib/billing/agency-billing"
import { AGENCY_PLAN_DEFINITIONS } from "@/lib/billing/agency-plans"
import { TRAVELER_CREDIT_PACKAGES } from "@/lib/billing/traveler-plans"

type SupabaseDbClient = SupabaseClient<Database>

function getAgencyOwnerDisplayName(agencyName: string, user: User) {
  return (
    agencyName ||
    (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name) ||
    (typeof user.user_metadata?.name === "string" && user.user_metadata.name) ||
    (user.email ? user.email.split("@")[0] : "Agencia Vuei")
  )
}

export async function getOrCreateAgencyStripeCustomer(
  client: SupabaseDbClient,
  params: {
    agencyId: string
    agencyName: string
    user: User
    existingStripeCustomerId?: string | null
  },
) {
  const subscriptionResult = await ensureAgencySubscriptionRow(client, params.agencyId)
  if (subscriptionResult.error || !subscriptionResult.data) {
    return { customerId: null as string | null, error: subscriptionResult.error ?? "Nao foi possivel carregar a assinatura da agencia." }
  }

  if (params.existingStripeCustomerId || subscriptionResult.data.stripe_customer_id) {
    return {
      customerId: params.existingStripeCustomerId ?? subscriptionResult.data.stripe_customer_id,
      error: null,
    }
  }

  const stripe = getStripeClient()
  const customer = await stripe.customers.create({
    email: params.user.email ?? undefined,
    name: getAgencyOwnerDisplayName(params.agencyName, params.user),
    metadata: {
      agency_id: params.agencyId,
      user_id: params.user.id,
      billing_scope: "agency",
    },
  })

  const updateResult = await updateAgencyStripeCustomerId(client, params.agencyId, customer.id)
  if (updateResult.error) {
    return { customerId: null as string | null, error: updateResult.error }
  }

  return { customerId: customer.id, error: null }
}

export async function createAgencySubscriptionCheckout(params: {
  customerId: string
  agencyId: string
  agencyName: string
  userId: string
  planCode: "start" | "pro" | "business"
}) {
  const stripe = getStripeClient()
  const plan = AGENCY_PLAN_DEFINITIONS[params.planCode]
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: params.customerId,
    client_reference_id: params.agencyId,
    line_items: [
      {
        price: getStripePriceIdForAgencyPlan(params.planCode),
        quantity: 1,
      },
    ],
    success_url: buildAbsoluteAppUrl("/agencia/planos?checkout=success"),
    cancel_url: buildAbsoluteAppUrl("/agencia/planos?checkout=canceled"),
    metadata: {
      billing_scope: "agency",
      checkout_type: "subscription",
      agency_id: params.agencyId,
      user_id: params.userId,
      plan_code: params.planCode,
      plan_name: plan.name,
      agency_name: params.agencyName,
    },
    subscription_data: {
      metadata: {
        billing_scope: "agency",
        checkout_type: "subscription",
        agency_id: params.agencyId,
        user_id: params.userId,
        plan_code: params.planCode,
        plan_name: plan.name,
      },
    },
  })

  return session
}

export async function createAgencyCreditPackageCheckout(params: {
  customerId: string
  agencyId: string
  userId: string
  packageCode: "starter" | "popular" | "pro"
}) {
  const stripe = getStripeClient()
  const selectedPackage = TRAVELER_CREDIT_PACKAGES.find((pkg) => pkg.code === params.packageCode)
  if (!selectedPackage) {
    throw new Error("Pacote de creditos invalido.")
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: params.customerId,
    client_reference_id: params.agencyId,
    line_items: [
      {
        price: getStripePriceIdForAgencyCreditPackage(params.packageCode),
        quantity: 1,
      },
    ],
    success_url: buildAbsoluteAppUrl("/agencia/planos?checkout=success"),
    cancel_url: buildAbsoluteAppUrl("/agencia/planos?checkout=canceled"),
    metadata: {
      billing_scope: "agency",
      checkout_type: "credit_package",
      agency_id: params.agencyId,
      user_id: params.userId,
      package_code: selectedPackage.code,
      credits: String(selectedPackage.credits),
    },
    payment_intent_data: {
      metadata: {
        billing_scope: "agency",
        checkout_type: "credit_package",
        agency_id: params.agencyId,
        user_id: params.userId,
        package_code: selectedPackage.code,
        credits: String(selectedPackage.credits),
      },
    },
  })

  return session
}

export async function createAgencyBillingPortalSession(customerId: string) {
  const stripe = getStripeClient()
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: buildAbsoluteAppUrl("/agencia/planos"),
  })
}
