import "server-only"

import type { User } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/types"
import { getStripeClient } from "@/lib/billing/stripe"
import { ensureTravelerSubscriptionRow, updateTravelerStripeCustomerId } from "@/lib/billing/traveler-billing"

function getTravelerDisplayName(user: User) {
  return (
    (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name) ||
    (typeof user.user_metadata?.name === "string" && user.user_metadata.name) ||
    (user.email ? user.email.split("@")[0] : "Viajante Vuei")
  )
}

export async function ensureTravelerStripeCustomer(
  client: SupabaseClient<Database>,
  user: User,
) {
  const subscriptionResult = await ensureTravelerSubscriptionRow(client, user.id)
  if (subscriptionResult.error || !subscriptionResult.data) {
    return { customerId: null as string | null, error: subscriptionResult.error ?? "Nao foi possivel carregar a assinatura traveler." }
  }

  if (subscriptionResult.data.stripe_customer_id) {
    return { customerId: subscriptionResult.data.stripe_customer_id, error: null }
  }

  const stripe = getStripeClient()
  const customer = await stripe.customers.create({
    email: user.email ?? undefined,
    name: getTravelerDisplayName(user),
    metadata: {
      user_id: user.id,
      billing_scope: "traveler",
    },
  })

  const updateResult = await updateTravelerStripeCustomerId(client, user.id, customer.id)
  if (updateResult.error) {
    return { customerId: null as string | null, error: updateResult.error }
  }

  return { customerId: customer.id, error: null }
}
