import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin"
import {
  getStripeClient,
  getStripeWebhookSecret,
  getStripePriceIdForTravelerPremium,
  getStripePriceIdForAgencyPlan,
} from "@/lib/billing/stripe"
import {
  findTravelerSubscriptionByCustomerId,
  grantTravelerPlanCycleFromInvoice,
  updateTravelerStripeCustomerId,
  upsertTravelerSubscriptionFromStripe,
} from "@/lib/billing/traveler-billing"
import { getTravelerCreditPackage } from "@/lib/billing/traveler-plans"
import {
  createAgencyPlanCreditCycleFromInvoice,
  findAgencySubscriptionByCustomerId,
  findAgencySubscriptionByStripeSubscriptionId,
  grantAgencyPurchasedCredits,
  updateAgencyStripeCustomerId,
  updateAgencySubscriptionFromStripe,
} from "@/lib/billing/agency-billing"

export const runtime = "nodejs"

function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status) {
  if (status === "active") return "active" as const
  if (status === "trialing") return "trialing" as const
  if (status === "past_due") return "past_due" as const
  if (status === "unpaid") return "unpaid" as const
  if (status === "canceled") return "canceled" as const
  return "incomplete" as const
}

function safePrice(getter: () => string) {
  try {
    return getter()
  } catch {
    return null
  }
}

function resolveTravelerPlanFromPriceId(priceId: string | null | undefined) {
  return priceId === safePrice(getStripePriceIdForTravelerPremium) ? "premium" : "free"
}

function resolveAgencyPlanFromPriceId(priceId: string | null | undefined) {
  if (priceId === safePrice(() => getStripePriceIdForAgencyPlan("start"))) return "start" as const
  if (priceId === safePrice(() => getStripePriceIdForAgencyPlan("pro"))) return "pro" as const
  if (priceId === safePrice(() => getStripePriceIdForAgencyPlan("business"))) return "business" as const
  return "free" as const
}

function getMetadataValue(metadata: Record<string, string> | null | undefined, key: string) {
  const value = metadata?.[key]
  return typeof value === "string" && value.length > 0 ? value : null
}

function getStripeSubscriptionPeriod(subscription: Stripe.Subscription) {
  const rawStart = (subscription as { current_period_start?: number }).current_period_start
  const rawEnd = (subscription as { current_period_end?: number }).current_period_end

  return {
    currentPeriodStart: typeof rawStart === "number" ? new Date(rawStart * 1000).toISOString() : null,
    currentPeriodEnd: typeof rawEnd === "number" ? new Date(rawEnd * 1000).toISOString() : null,
  }
}

function getStripeInvoiceSubscriptionId(invoice: Stripe.Invoice) {
  const subscriptionId = (invoice as { subscription?: string | null }).subscription
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
  const { data, error } = await (adminClient.from("stripe_events" as any) as any)
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
  const metadataUserId = getMetadataValue(subscription.metadata, "user_id")
  let userId = fallbackUserId ?? metadataUserId

  if (!userId && typeof subscription.customer === "string") {
    const byCustomer = await findTravelerSubscriptionByCustomerId(adminClient, subscription.customer)
    if (byCustomer.data) {
      userId = byCustomer.data.user_id
    }
  }

  if (!userId) {
    return { error: "N?o foi poss?vel identificar o traveler desta assinatura Stripe." }
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

async function upsertAgencySubscriptionFromStripeObject(subscription: Stripe.Subscription, fallbackAgencyId?: string | null) {
  const adminClient = createSupabaseAdminClient()
  const priceId = subscription.items.data[0]?.price?.id ?? null
  const metadataAgencyId = getMetadataValue(subscription.metadata, "agency_id")
  let agencyId = fallbackAgencyId ?? metadataAgencyId

  if (!agencyId && typeof subscription.customer === "string") {
    const byCustomer = await findAgencySubscriptionByCustomerId(adminClient, subscription.customer)
    if (byCustomer.data) {
      agencyId = byCustomer.data.agency_id
    }
  }

  if (!agencyId) {
    const bySubscription = await findAgencySubscriptionByStripeSubscriptionId(adminClient, subscription.id)
    if (bySubscription.data) {
      agencyId = bySubscription.data.agency_id
    }
  }

  if (!agencyId) {
    return { error: "N?o foi poss?vel identificar a ag?ncia desta assinatura Stripe." }
  }

  const result = await updateAgencySubscriptionFromStripe(adminClient, {
    agencyId,
    planCode: resolveAgencyPlanFromPriceId(priceId),
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
    agencyId,
  }
}

async function handleTravelerCreditPackageCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid") {
    return null
  }

  const userId = getMetadataValue(session.metadata, "user_id")
  const packageCode = getMetadataValue(session.metadata, "package_code") as "starter" | "popular" | "pro" | null
  const selectedPackage = packageCode ? getTravelerCreditPackage(packageCode) : null

  if (!userId || !selectedPackage) {
    return "Metadata incompleta para registrar a compra de cr?ditos traveler."
  }

  const adminClient = createSupabaseAdminClient()
  const existingTransaction = await (adminClient.from("credit_transactions") as any)
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

async function handleAgencyCreditPackageCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid") {
    return null
  }

  const agencyId = getMetadataValue(session.metadata, "agency_id")
  const userId = getMetadataValue(session.metadata, "user_id")
  const packageCode = getMetadataValue(session.metadata, "package_code") as "starter" | "popular" | "pro" | null
  const selectedPackage = packageCode ? getTravelerCreditPackage(packageCode) : null

  if (!agencyId || !userId || !selectedPackage) {
    return "Metadata incompleta para registrar a compra de cr?ditos da ag?ncia."
  }

  const adminClient = createSupabaseAdminClient()

  if (typeof session.customer === "string") {
    const customerLinkResult = await updateAgencyStripeCustomerId(adminClient, agencyId, session.customer)
    if (customerLinkResult.error) {
      return customerLinkResult.error
    }
  }

  const grantResult = await grantAgencyPurchasedCredits(adminClient, {
    agencyId,
    userId,
    packageCode: selectedPackage.code,
    packageName: selectedPackage.name,
    credits: selectedPackage.credits,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
  })

  return grantResult.error ?? null
}

async function handleSubscriptionCheckoutCompleted(session: Stripe.Checkout.Session, billingScope: "traveler" | "agency") {
  const adminClient = createSupabaseAdminClient()

  if (billingScope === "traveler") {
    const userId = getMetadataValue(session.metadata, "user_id")

    if (typeof session.customer === "string" && userId) {
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

  const agencyId = getMetadataValue(session.metadata, "agency_id")
  if (typeof session.customer === "string" && agencyId) {
    const customerLinkResult = await updateAgencyStripeCustomerId(adminClient, agencyId, session.customer)
    if (customerLinkResult.error) {
      return customerLinkResult.error
    }
  }

  if (typeof session.subscription === "string") {
    const stripe = getStripeClient()
    const subscription = await stripe.subscriptions.retrieve(session.subscription)
    const updateResult = await upsertAgencySubscriptionFromStripeObject(subscription, agencyId)
    return updateResult.error ?? null
  }

  return null
}

async function handleTravelerInvoicePaid(invoice: Stripe.Invoice, subscription: Stripe.Subscription) {
  const subscriptionResult = await upsertTravelerSubscriptionFromStripeObject(subscription)
  if (subscriptionResult.error || !subscriptionResult.data || !subscriptionResult.userId) {
    return subscriptionResult.error ?? "N?o foi poss?vel sincronizar a assinatura traveler apos invoice.paid."
  }

  const priceId = subscription.items.data[0]?.price?.id ?? null
  const planCode = resolveTravelerPlanFromPriceId(priceId)
  if (planCode !== "premium") {
    return null
  }

  const adminClient = createSupabaseAdminClient()
  const { currentPeriodStart, currentPeriodEnd } = getStripeSubscriptionPeriod(subscription)
  if (!currentPeriodStart || !currentPeriodEnd) {
    return "N?o foi poss?vel identificar o periodo da assinatura premium."
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

async function handleAgencyInvoicePaid(invoice: Stripe.Invoice, subscription: Stripe.Subscription) {
  const subscriptionResult = await upsertAgencySubscriptionFromStripeObject(subscription)
  if (subscriptionResult.error || !subscriptionResult.data || !subscriptionResult.agencyId) {
    return subscriptionResult.error ?? "N?o foi poss?vel sincronizar a assinatura da ag?ncia apos invoice.paid."
  }

  const priceId = subscription.items.data[0]?.price?.id ?? null
  const planCode = resolveAgencyPlanFromPriceId(priceId)
  if (planCode === "free") {
    return null
  }

  const { currentPeriodStart, currentPeriodEnd } = getStripeSubscriptionPeriod(subscription)
  if (!currentPeriodStart || !currentPeriodEnd) {
    return "N?o foi poss?vel identificar o periodo da assinatura da ag?ncia."
  }

  const adminClient = createSupabaseAdminClient()
  const existingSubscription = await findAgencySubscriptionByStripeSubscriptionId(adminClient, subscription.id)
  if (existingSubscription.error || !existingSubscription.data) {
    return existingSubscription.error ?? "N?o foi poss?vel localizar a subscription canonica da ag?ncia."
  }

  const cycleResult = await createAgencyPlanCreditCycleFromInvoice(adminClient, {
    agencyId: subscriptionResult.agencyId,
    subscriptionId: existingSubscription.data.id,
    planCode,
    periodStart: currentPeriodStart,
    periodEnd: currentPeriodEnd,
    stripeInvoiceId: invoice.id,
  })

  return cycleResult.error ?? null
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const subscriptionId = getStripeInvoiceSubscriptionId(invoice)
  if (!subscriptionId) {
    return null
  }

  const stripe = getStripeClient()
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const billingScope = getMetadataValue(subscription.metadata, "billing_scope")

  if (billingScope === "agency") {
    return handleAgencyInvoicePaid(invoice, subscription)
  }

  return handleTravelerInvoicePaid(invoice, subscription)
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = getStripeInvoiceSubscriptionId(invoice)
  if (!subscriptionId) {
    return null
  }

  const stripe = getStripeClient()
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const billingScope = getMetadataValue(subscription.metadata, "billing_scope")

  if (billingScope === "agency") {
    const result = await upsertAgencySubscriptionFromStripeObject(subscription)
    return result.error ?? null
  }

  const result = await upsertTravelerSubscriptionFromStripeObject(subscription)
  return result.error ?? null
}

async function handleSubscriptionLifecycleEvent(subscription: Stripe.Subscription) {
  const billingScope = getMetadataValue(subscription.metadata, "billing_scope")

  if (billingScope === "agency") {
    const result = await upsertAgencySubscriptionFromStripeObject(subscription)
    return result.error ?? null
  }

  const result = await upsertTravelerSubscriptionFromStripeObject(subscription)
  return result.error ?? null
}

export async function POST(request: Request) {
  if (!hasSupabaseAdminEnv()) {
    return NextResponse.json({ error: "Supabase admin env indispon?vel para o webhook Stripe." }, { status: 503 })
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
          const checkoutType = getMetadataValue(session.metadata, "checkout_type")
          const billingScope = getMetadataValue(session.metadata, "billing_scope")

          if (checkoutType === "credit_package" && billingScope === "agency") {
            processingError = await handleAgencyCreditPackageCheckoutCompleted(session)
          } else if (checkoutType === "credit_package") {
            processingError = await handleTravelerCreditPackageCheckoutCompleted(session)
          } else if (checkoutType === "subscription" && billingScope === "agency") {
            processingError = await handleSubscriptionCheckoutCompleted(session, "agency")
          } else if (checkoutType === "subscription") {
            processingError = await handleSubscriptionCheckoutCompleted(session, "traveler")
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
