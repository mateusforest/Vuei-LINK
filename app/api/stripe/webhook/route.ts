import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin"
import { getStripeClient, getStripeWebhookSecret, getStripePriceIdForTravelerPremium } from "@/lib/billing/stripe"
import {
  ensureTravelerSubscriptionRow,
  findTravelerSubscriptionByCustomerId,
  findTravelerSubscriptionByStripeSubscriptionId,
  grantTravelerPlanCycleFromInvoice,
  updateTravelerStripeCustomerId,
  upsertTravelerSubscriptionFromStripe,
} from "@/lib/billing/traveler-billing"
import { getTravelerCreditPackage } from "@/lib/billing/traveler-plans"

export const runtime = "nodejs"

function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status) {
  if (status === "active") return "active" as const
  if (status === "trialing") return "trialing" as const
  if (status === "past_due") return "past_due" as const
  if (status === "unpaid") return "unpaid" as const
  if (status === "canceled") return "canceled" as const
  return "incomplete" as const
}

function resolveTravelerPlanFromPriceId(priceId: string | null | undefined) {
  return priceId === getStripePriceIdForTravelerPremium() ? "premium" : "free"
}

function getCheckoutMetadataValue(metadata: Record<string, string> | null | undefined, key: string) {
  const value = metadata?.[key]
  return typeof value === "string" && value.length > 0 ? value : null
}

function getStripeSubscriptionPeriod(subscription: Stripe.Subscription) {
  const rawStart = (subscription as any).current_period_start
  const rawEnd = (subscription as any).current_period_end

  return {
    currentPeriodStart: typeof rawStart === "number" ? new Date(rawStart * 1000).toISOString() : null,
    currentPeriodEnd: typeof rawEnd === "number" ? new Date(rawEnd * 1000).toISOString() : null,
  }
}

function getStripeInvoiceSubscriptionId(invoice: Stripe.Invoice) {
  const subscriptionId = (invoice as any).subscription
  return typeof subscriptionId === "string" ? subscriptionId : null
}

async function markStripeEventProcessed(eventId: string, type: string) {
  const adminClient = createSupabaseAdminClient()
  const { error } = await (adminClient.from("stripe_events" as any) as any).insert({
    id: eventId,
    type,
  } as any)

  return error?.message ?? null
}

async function isStripeEventAlreadyProcessed(eventId: string) {
  const adminClient = createSupabaseAdminClient()
  const { data, error } = await (adminClient
    .from("stripe_events" as any) as any)
    .select("id")
    .eq("id", eventId)
    .maybeSingle()

  return {
    exists: Boolean(data),
    error: error?.message ?? null,
  }
}

async function upsertTravelerSubscriptionFromStripeObject(subscription: Stripe.Subscription, fallbackUserId?: string | null) {
  const adminClient = createSupabaseAdminClient()
  const priceId = subscription.items.data[0]?.price?.id ?? null
  const metadataUserId = getCheckoutMetadataValue(subscription.metadata, "user_id")
  let userId = fallbackUserId ?? metadataUserId

  if (!userId && typeof subscription.customer === "string") {
    const byCustomer = await findTravelerSubscriptionByCustomerId(adminClient, subscription.customer)
    if (byCustomer.data) {
      userId = byCustomer.data.user_id
    }
  }

  if (!userId) {
    return { error: "Nao foi possivel identificar o traveler desta assinatura Stripe." }
  }

  const result = await upsertTravelerSubscriptionFromStripe(adminClient, {
    userId,
    planCode: resolveTravelerPlanFromPriceId(priceId),
    status: mapStripeSubscriptionStatus(subscription.status),
    stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : null,
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId,
    currentPeriodStart: getStripeSubscriptionPeriod(subscription).currentPeriodStart,
    currentPeriodEnd: getStripeSubscriptionPeriod(subscription).currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  })

  return {
    data: result.data,
    error: result.error,
    userId,
  }
}

async function handleCreditPackageCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid") {
    return null
  }

  const userId = getCheckoutMetadataValue(session.metadata, "user_id")
  const packageCode = getCheckoutMetadataValue(session.metadata, "package_code") as "starter" | "popular" | "pro" | null
  const selectedPackage = packageCode ? getTravelerCreditPackage(packageCode) : null

  if (!userId || !selectedPackage) {
    return "Metadata incompleta para registrar a compra de creditos traveler."
  }

  const adminClient = createSupabaseAdminClient()

  const existingTransaction = await (adminClient
    .from("credit_transactions") as any)
    .select("id")
    .eq("owner_type", "traveler")
    .eq("owner_user_id", userId)
    .eq("type", "purchase")
    .contains("metadata", { stripe_checkout_session_id: session.id })
    .maybeSingle()

  if (existingTransaction.error) {
    return existingTransaction.error.message
  }

  if (existingTransaction.data) {
    return null
  }

  if (typeof session.customer === "string") {
    const customerLinkResult = await updateTravelerStripeCustomerId(adminClient, userId, session.customer)
    if (customerLinkResult.error) {
      return customerLinkResult.error
    }
  }

  const insertResult = await (adminClient.from("credit_transactions") as any).insert({
    owner_type: "traveler",
    owner_user_id: userId,
    type: "purchase",
    amount: selectedPackage.credits,
    reason: `Compra do pacote ${selectedPackage.name}`,
    source: "stripe_checkout",
    metadata: {
      billing_scope: "traveler",
      checkout_type: "credit_package",
      package_code: selectedPackage.code,
      credits: selectedPackage.credits,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
    },
    created_by: userId,
  } as any)

  return insertResult.error?.message ?? null
}

async function handleSubscriptionCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = getCheckoutMetadataValue(session.metadata, "user_id")

  if (typeof session.customer === "string" && userId) {
    const adminClient = createSupabaseAdminClient()
    const customerLinkResult = await updateTravelerStripeCustomerId(adminClient, userId, session.customer)
    if (customerLinkResult.error) {
      return customerLinkResult.error
    }
  }

  if (typeof session.subscription === "string") {
    const stripe = getStripeClient()
    const subscription = await stripe.subscriptions.retrieve(session.subscription)
    const updateResult = await upsertTravelerSubscriptionFromStripeObject(subscription, userId)
    return updateResult.error ?? null
  }

  return null
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const subscriptionId = getStripeInvoiceSubscriptionId(invoice)
  if (!subscriptionId) {
    return null
  }

  const stripe = getStripeClient()
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const subscriptionResult = await upsertTravelerSubscriptionFromStripeObject(subscription)
  if (subscriptionResult.error || !subscriptionResult.data || !subscriptionResult.userId) {
    return subscriptionResult.error ?? "Nao foi possivel sincronizar a assinatura traveler apos invoice.paid."
  }

  const priceId = subscription.items.data[0]?.price?.id ?? null
  const planCode = resolveTravelerPlanFromPriceId(priceId)
  if (planCode !== "premium") {
    return null
  }

  const adminClient = createSupabaseAdminClient()
  const { currentPeriodStart, currentPeriodEnd } = getStripeSubscriptionPeriod(subscription)
  if (!currentPeriodStart || !currentPeriodEnd) {
    return "Nao foi possivel identificar o periodo da assinatura premium."
  }
  const grantResult = await grantTravelerPlanCycleFromInvoice(adminClient, {
    userId: subscriptionResult.userId,
    subscriptionId: subscriptionResult.data.id,
    planCode,
    periodStart: currentPeriodStart,
    periodEnd: currentPeriodEnd,
    stripeInvoiceId: invoice.id,
    createdBy: subscriptionResult.userId,
  })

  return grantResult.error ?? null
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = getStripeInvoiceSubscriptionId(invoice)
  if (!subscriptionId) {
    return null
  }

  const stripe = getStripeClient()
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const result = await upsertTravelerSubscriptionFromStripeObject(subscription)

  return result.error ?? null
}

async function handleSubscriptionLifecycleEvent(subscription: Stripe.Subscription) {
  const result = await upsertTravelerSubscriptionFromStripeObject(subscription)
  return result.error ?? null
}

export async function POST(request: Request) {
  if (!hasSupabaseAdminEnv()) {
    return NextResponse.json({ error: "Supabase admin env indisponivel para o webhook Stripe." }, { status: 503 })
  }

  const signature = request.headers.get("stripe-signature")
  if (!signature) {
    return NextResponse.json({ error: "Assinatura Stripe ausente." }, { status: 400 })
  }

  const payload = await request.text()
  const stripe = getStripeClient()

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(payload, signature, getStripeWebhookSecret())
  } catch (error) {
    const message = error instanceof Error ? error.message : "Assinatura Stripe invalida."
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const processedCheck = await isStripeEventAlreadyProcessed(event.id)
  if (processedCheck.error) {
    return NextResponse.json({ error: processedCheck.error }, { status: 500 })
  }

  if (processedCheck.exists) {
    return NextResponse.json({ received: true, duplicate: true })
  }

  let processingError: string | null = null

  try {
    switch (event.type) {
      case "checkout.session.completed":
        {
          const session = event.data.object as Stripe.Checkout.Session
          const checkoutType = getCheckoutMetadataValue(session.metadata, "checkout_type")

          if (checkoutType === "credit_package") {
            processingError = await handleCreditPackageCheckoutCompleted(session)
          } else if (checkoutType === "subscription") {
            processingError = await handleSubscriptionCheckoutCompleted(session)
          }
        }
        break

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        processingError = await handleSubscriptionLifecycleEvent(event.data.object as Stripe.Subscription)
        break

      case "invoice.paid":
        processingError = await handleInvoicePaid(event.data.object as Stripe.Invoice)
        break

      case "invoice.payment_failed":
        processingError = await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)
        break

      default:
        break
    }
  } catch (error) {
    processingError = error instanceof Error ? error.message : "Falha inesperada ao processar o webhook Stripe."
  }

  if (processingError) {
    return NextResponse.json({ error: processingError }, { status: 500 })
  }

  const markProcessedError = await markStripeEventProcessed(event.id, event.type)
  if (markProcessedError) {
    return NextResponse.json({ error: markProcessedError }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
