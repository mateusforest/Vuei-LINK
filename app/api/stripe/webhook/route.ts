import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin"
import {
  getStripeClient,
  getStripeWebhookSecret,
  getStripePriceIdForTravelerPremium,
  getStripePriceIdForTravelerVueiPlus,
  getStripePriceIdForAgencyPlan,
} from "@/lib/billing/stripe"
import {
  findTravelerSubscriptionByCustomerId,
  findTravelerSubscriptionByVueiPlusSubscriptionId,
  grantTravelerPlanCycleFromInvoice,
  updateTravelerStripeCustomerId,
  upsertTravelerSubscriptionFromStripe,
  upsertTravelerVueiPlusSubscriptionFromStripe,
} from "@/lib/billing/traveler-billing"
import { TRAVELER_VUEI_PLUS_BILLING_SCOPE } from "@/lib/billing/traveler-membership"
import { getTravelerCreditPackage } from "@/lib/billing/traveler-plans"
import {
  createAgencyPlanCreditCycleFromInvoice,
  findAgencySubscriptionByCustomerId,
  findAgencySubscriptionByStripeSubscriptionId,
  grantAgencyPurchasedCredits,
  updateAgencyStripeCustomerId,
  updateAgencySubscriptionFromStripe,
} from "@/lib/billing/agency-billing"
import {
  TRAVELER_TRIP_LINK_BILLING_SCOPE,
  TRAVELER_TRIP_LINK_CHECKOUT_TYPE,
  resolveTravelerTripLinkFulfillment,
} from "@/lib/billing/traveler-trip-link-catalog"
import { getTravelerTripLinkPriceMap } from "@/lib/billing/traveler-trip-link-products"
import { createWalletService } from "@/lib/wallet"

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

function logUnknownStripePriceId(params: {
  eventType: string
  billingScope: "traveler" | "agency" | "traveler_vuei_plus"
  priceId: string | null | undefined
  subscriptionId?: string | null
  customerId?: string | null
}) {
  console.error("[stripe-webhook] price_id desconhecido", {
    eventType: params.eventType,
    billingScope: params.billingScope,
    priceId: params.priceId ?? null,
    subscriptionId: params.subscriptionId ?? null,
    customerId: params.customerId ?? null,
  })
}

function resolveTravelerPlanFromPriceId(priceId: string | null | undefined) {
  return priceId === safePrice(getStripePriceIdForTravelerPremium) ? "premium" : null
}

function isTravelerVueiPlusSubscription(subscription: Stripe.Subscription) {
  const priceId = subscription.items.data[0]?.price?.id ?? null
  return (
    getMetadataValue(subscription.metadata, "billing_scope") === TRAVELER_VUEI_PLUS_BILLING_SCOPE ||
    priceId === safePrice(getStripePriceIdForTravelerVueiPlus)
  )
}

function resolveAgencyPlanFromPriceId(priceId: string | null | undefined) {
  if (priceId === safePrice(() => getStripePriceIdForAgencyPlan("start"))) return "start" as const
  if (priceId === safePrice(() => getStripePriceIdForAgencyPlan("pro"))) return "pro" as const
  if (priceId === safePrice(() => getStripePriceIdForAgencyPlan("business"))) return "business" as const
  return null
}

function getMetadataValue(metadata: Record<string, string> | null | undefined, key: string) {
  const value = metadata?.[key]
  return typeof value === "string" && value.length > 0 ? value : null
}

function getStripeExpandableId(value: string | { id: string } | null | undefined) {
  if (typeof value === "string") return value
  return value && typeof value.id === "string" ? value.id : null
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

  const resolvedPlanCode = resolveTravelerPlanFromPriceId(priceId)
  if (!resolvedPlanCode) {
    logUnknownStripePriceId({
      eventType: "customer.subscription",
      billingScope: "traveler",
      priceId,
      subscriptionId: subscription.id,
      customerId: typeof subscription.customer === "string" ? subscription.customer : null,
    })
    return { error: "Price ID da assinatura traveler n?o reconhecido." }
  }

  const result = await upsertTravelerSubscriptionFromStripe(adminClient, {
    userId,
    planCode: resolvedPlanCode,
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

async function upsertTravelerVueiPlusFromStripeObject(
  subscription: Stripe.Subscription,
  fallbackUserId?: string | null,
) {
  const adminClient = createSupabaseAdminClient()
  const priceId = subscription.items.data[0]?.price?.id ?? null
  const expectedPriceId = safePrice(getStripePriceIdForTravelerVueiPlus)
  let userId = fallbackUserId ?? getMetadataValue(subscription.metadata, "user_id")

  if (!userId) {
    const bySubscription = await findTravelerSubscriptionByVueiPlusSubscriptionId(adminClient, subscription.id)
    if (bySubscription.error) return { data: null, error: bySubscription.error, userId: null }
    userId = bySubscription.data?.user_id ?? null
  }

  if (!userId && typeof subscription.customer === "string") {
    const byCustomer = await findTravelerSubscriptionByCustomerId(adminClient, subscription.customer)
    if (byCustomer.error) return { data: null, error: byCustomer.error, userId: null }
    userId = byCustomer.data?.user_id ?? null
  }

  if (!userId) {
    return { data: null, error: "Nao foi possivel identificar o traveler desta assinatura Vuei+.", userId: null }
  }

  if (!expectedPriceId || priceId !== expectedPriceId) {
    logUnknownStripePriceId({
      eventType: "customer.subscription.vuei_plus",
      billingScope: "traveler_vuei_plus",
      priceId,
      subscriptionId: subscription.id,
      customerId: typeof subscription.customer === "string" ? subscription.customer : null,
    })
    return { data: null, error: "Price ID da assinatura Vuei+ nao reconhecido.", userId }
  }

  const period = getStripeSubscriptionPeriod(subscription)
  const result = await upsertTravelerVueiPlusSubscriptionFromStripe(adminClient, {
    userId,
    status: mapStripeSubscriptionStatus(subscription.status),
    stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : null,
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId,
    currentPeriodStart: period.currentPeriodStart,
    currentPeriodEnd: period.currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  })

  return { data: result.data, error: result.error, userId }
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

  const resolvedPlanCode = resolveAgencyPlanFromPriceId(priceId)
  if (!resolvedPlanCode) {
    logUnknownStripePriceId({
      eventType: "customer.subscription",
      billingScope: "agency",
      priceId,
      subscriptionId: subscription.id,
      customerId: typeof subscription.customer === "string" ? subscription.customer : null,
    })
    return { error: "Price ID da assinatura da ag?ncia n?o reconhecido." }
  }

  const result = await updateAgencySubscriptionFromStripe(adminClient, {
    agencyId,
    planCode: resolvedPlanCode,
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

async function handleTravelerTripLinkCheckoutPaid(session: Stripe.Checkout.Session) {
  const metadataUserId = getMetadataValue(session.metadata, "user_id")
  const userId = session.client_reference_id
  const metadataProductCode = getMetadataValue(session.metadata, "product_code")
  const customerId = getStripeExpandableId(session.customer)

  if (!userId || !metadataUserId || userId !== metadataUserId || !customerId) {
    return "Identidade incompleta ou divergente na compra de viagens traveler."
  }

  const stripe = getStripeClient()
  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 2 })
  const lineItem = lineItems.data[0]
  const priceId = lineItem?.price?.id ?? null
  const fulfillment = resolveTravelerTripLinkFulfillment({
    paymentStatus: session.payment_status,
    lineItemCount: lineItems.data.length,
    lineItemQuantity: lineItem?.quantity,
    priceId,
    metadataProductCode,
    unitAmount: lineItem?.price?.unit_amount,
    currency: lineItem?.price?.currency,
  }, getTravelerTripLinkPriceMap())

  if (fulfillment.status === "not_paid") return null
  if (fulfillment.status === "invalid") {
    logUnknownStripePriceId({
      eventType: "checkout.session.trip_link",
      billingScope: "traveler",
      priceId,
      customerId,
    })
    return fulfillment.reason
  }
  const { product } = fulfillment

  const adminClient = createSupabaseAdminClient()
  const customerOwner = await findTravelerSubscriptionByCustomerId(adminClient, customerId)
  if (customerOwner.error) return customerOwner.error
  if (!customerOwner.data || customerOwner.data.user_id !== userId) {
    return "O Customer Stripe nao pertence ao traveler informado na compra de viagens."
  }

  const walletService = createWalletService(adminClient)
  const walletProduct = await walletService.getProductByCode(product.code)
  if (
    !walletProduct?.active ||
    walletProduct.assetType !== "trip_link" ||
    walletProduct.quantity !== product.quantity
  ) {
    return "Produto de viagens ausente ou divergente na wallet."
  }

  const wallet = await walletService.getOrCreateWallet({ ownerType: "traveler", ownerUserId: userId })
  await walletService.grantPurchase({
    walletId: wallet.id,
    assetType: "trip_link",
    quantity: product.quantity,
    walletProductId: walletProduct.id,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: getStripeExpandableId(session.payment_intent),
    createdBy: userId,
    reason: `Compra do pacote ${product.name}`,
    source: "stripe_checkout",
    idempotencyKey: `traveler-trip-link-purchase:${session.id}`,
    metadata: {
      billing_scope: TRAVELER_TRIP_LINK_BILLING_SCOPE,
      checkout_type: TRAVELER_TRIP_LINK_CHECKOUT_TYPE,
      product_code: product.code,
      quantity: product.quantity,
      stripe_price_id: priceId,
      activation_validity: product.validityLabel,
      non_expiring: false,
    },
  })

  return null
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

async function handleSubscriptionCheckoutCompleted(
  session: Stripe.Checkout.Session,
  billingScope: "traveler" | "agency" | "traveler_vuei_plus",
) {
  const adminClient = createSupabaseAdminClient()

  if (billingScope === "traveler" || billingScope === "traveler_vuei_plus") {
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
      if (billingScope === "traveler_vuei_plus") {
        const updateResult = await upsertTravelerVueiPlusFromStripeObject(subscription, userId)
        return updateResult.error ?? null
      }
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
  if (!planCode) {
    logUnknownStripePriceId({
      eventType: "invoice.paid",
      billingScope: "traveler",
      priceId,
      subscriptionId: subscription.id,
      customerId: typeof subscription.customer === "string" ? subscription.customer : null,
    })
    return "Price ID da assinatura traveler n?o reconhecido para conceder cr?ditos mensais."
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
  if (!planCode) {
    logUnknownStripePriceId({
      eventType: "invoice.paid",
      billingScope: "agency",
      priceId,
      subscriptionId: subscription.id,
      customerId: typeof subscription.customer === "string" ? subscription.customer : null,
    })
    return "Price ID da assinatura da agência não reconhecido para conceder créditos mensais."
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

  if (isTravelerVueiPlusSubscription(subscription)) {
    const result = await upsertTravelerVueiPlusFromStripeObject(subscription)
    return result.error ?? null
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

  if (isTravelerVueiPlusSubscription(subscription)) {
    const result = await upsertTravelerVueiPlusFromStripeObject(subscription)
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

  if (isTravelerVueiPlusSubscription(subscription)) {
    const result = await upsertTravelerVueiPlusFromStripeObject(subscription)
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

          if (
            checkoutType === TRAVELER_TRIP_LINK_CHECKOUT_TYPE &&
            billingScope === TRAVELER_TRIP_LINK_BILLING_SCOPE
          ) {
            processingError = await handleTravelerTripLinkCheckoutPaid(session)
          } else if (checkoutType === "credit_package" && billingScope === "agency") {
            processingError = await handleAgencyCreditPackageCheckoutCompleted(session)
          } else if (checkoutType === "credit_package") {
            processingError = await handleTravelerCreditPackageCheckoutCompleted(session)
          } else if (checkoutType === "subscription" && billingScope === "agency") {
            processingError = await handleSubscriptionCheckoutCompleted(session, "agency")
          } else if (checkoutType === "subscription" && billingScope === TRAVELER_VUEI_PLUS_BILLING_SCOPE) {
            processingError = await handleSubscriptionCheckoutCompleted(session, "traveler_vuei_plus")
          } else if (checkoutType === "subscription") {
            processingError = await handleSubscriptionCheckoutCompleted(session, "traveler")
          }
        }
        break

      case "checkout.session.async_payment_succeeded":
        {
          const session = event.data.object as Stripe.Checkout.Session
          const checkoutType = getMetadataValue(session.metadata, "checkout_type")
          const billingScope = getMetadataValue(session.metadata, "billing_scope")

          if (
            checkoutType === TRAVELER_TRIP_LINK_CHECKOUT_TYPE &&
            billingScope === TRAVELER_TRIP_LINK_BILLING_SCOPE
          ) {
            processingError = await handleTravelerTripLinkCheckoutPaid(session)
          }
        }
        break

      case "checkout.session.async_payment_failed":
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
