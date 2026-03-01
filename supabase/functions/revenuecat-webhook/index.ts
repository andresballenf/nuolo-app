import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-revenuecat-signature',
};

const revenueCatWebhookAuthorization = Deno.env.get('REVENUECAT_WEBHOOK_AUTHORIZATION');

const jsonResponse = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

interface RevenueCatWebhookEvent {
  api_version: string;
  event: {
    type: string;
    app_user_id: string;
    aliases: string[];
    original_app_user_id: string;
    product_id: string;
    entitlement_ids: string[] | null;
    period_type: string;
    purchased_at_ms: number;
    expiration_at_ms: number | null;
    environment: string;
    presented_offering_id: string | null;
    transaction_id: string;
    original_transaction_id: string;
    is_trial_conversion: boolean;
    store: string;
    takehome_percentage: number;
    price: number;
    currency: string;
    tax_percentage: number;
    commission_percentage: number;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!revenueCatWebhookAuthorization) {
    console.error('[SECURITY] REVENUECAT_WEBHOOK_AUTHORIZATION is not configured');
    return jsonResponse(500, { error: 'Webhook configuration error' });
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader || authHeader !== revenueCatWebhookAuthorization) {
    console.warn('[SECURITY] Unauthorized webhook request blocked');
    return jsonResponse(401, { error: 'Unauthorized' });
  }

  try {
    // Read body first
    const body = await req.text();

    // Parse event
    const webhookEvent: RevenueCatWebhookEvent = JSON.parse(body);
    console.log('[WEBHOOK] Received event:', webhookEvent.event.type);

    // Create Supabase client with service role
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user ID from app_user_id (this should be the Supabase user UUID)
    const userId = webhookEvent.event.app_user_id;
    if (!isUuid(userId)) {
      console.warn('[SECURITY] Invalid RevenueCat app_user_id; skipping event', {
        eventType: webhookEvent.event.type,
      });
      return jsonResponse(202, { received: true, ignored: true, reason: 'invalid_app_user_id' });
    }

    const eventId = buildWebhookEventId(webhookEvent.event);
    const shouldProcess = await reserveWebhookEvent(supabaseClient, {
      eventId,
      userId,
      productId: webhookEvent.event.product_id,
      store: webhookEvent.event.store,
    });

    if (!shouldProcess) {
      console.log('[WEBHOOK] Duplicate event ignored:', eventId);
      return jsonResponse(200, { received: true, deduplicated: true });
    }

    // Handle different event types
    switch (webhookEvent.event.type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'NON_RENEWING_PURCHASE':
        await handlePurchase(supabaseClient, webhookEvent, userId);
        break;

      case 'CANCELLATION':
        await handleCancellation(supabaseClient, webhookEvent, userId);
        break;

      case 'EXPIRATION':
        await handleExpiration(supabaseClient, webhookEvent, userId);
        break;

      case 'BILLING_ISSUE':
        await handleBillingIssue(supabaseClient, webhookEvent, userId);
        break;

      case 'PRODUCT_CHANGE':
        await handleProductChange(supabaseClient, webhookEvent, userId);
        break;

      default:
        console.log('[WEBHOOK] Unhandled event type:', webhookEvent.event.type);
    }

    // Return success
    return jsonResponse(200, { received: true });
  } catch (error) {
    console.error('[ERROR] Webhook processing failed:', error);
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

async function handlePurchase(
  supabaseClient: any,
  event: RevenueCatWebhookEvent,
  userId: string
) {
  const eventData = event.event;

  // Determine if this is an unlimited subscription or a credit package
  // Unlimited monthly is a subscription, basic/standard/premium are consumable packages
  const isUnlimitedSubscription = eventData.product_id.includes('unlimited_monthly');
  const isConsumablePackage = eventData.product_id.includes('basic') ||
                              eventData.product_id.includes('standard') ||
                              eventData.product_id.includes('premium');

  if (isUnlimitedSubscription) {
    // Handle unlimited monthly subscription (one active at a time)
    const subscriptionType = 'unlimited_monthly';
    const upsertError = await upsertSubscriptionWithFallback(
      supabaseClient,
      userId,
      subscriptionType,
      eventData
    );
    if (upsertError) {
      console.error('[ERROR] Failed to update unlimited subscription:', upsertError);
      throw upsertError;
    }

    console.log(`[SUCCESS] Updated unlimited subscription for user ${userId}`);
  } else if (isConsumablePackage) {
    // Handle consumable credit packages (can purchase multiple times)
    const { error } = await supabaseClient.from('user_package_purchases').insert({
      user_id: userId,
      package_id: getPackageId(eventData.product_id),
      platform_transaction_id: eventData.transaction_id,
      purchased_at: new Date(eventData.purchased_at_ms).toISOString(),
    });

    if (error) {
      console.error('[ERROR] Failed to record package purchase:', error);
      throw error;
    }

    // Update user's attraction limit based on packages owned
    await updateUserAttractionLimit(supabaseClient, userId);

    console.log(`[SUCCESS] Recorded package purchase for user ${userId}`);
  } else {
    // Handle other subscription types (premium_monthly, premium_yearly, lifetime)
    const subscriptionType = getSubscriptionType(eventData.product_id);
    const upsertError = await upsertSubscriptionWithFallback(
      supabaseClient,
      userId,
      subscriptionType,
      eventData
    );
    if (upsertError) {
      console.error('[ERROR] Failed to update subscription:', upsertError);
      throw upsertError;
    }

    console.log(`[SUCCESS] Updated ${subscriptionType} subscription for user ${userId}`);
  }
}

async function handleCancellation(
  supabaseClient: any,
  event: RevenueCatWebhookEvent,
  userId: string
) {
  let { error } = await supabaseClient
    .from('user_subscriptions')
    .update({
      auto_renew: false,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('original_transaction_id', event.event.original_transaction_id);

  if (error && isMissingColumnError(error)) {
    const fallback = await supabaseClient
      .from('user_subscriptions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('original_transaction_id', event.event.original_transaction_id);

    error = fallback.error;
  }

  if (error) {
    console.error('[ERROR] Failed to update subscription cancellation:', error);
    throw error;
  }

  console.log(`[SUCCESS] Updated subscription cancellation for user ${userId}`);
}

async function handleExpiration(
  supabaseClient: any,
  event: RevenueCatWebhookEvent,
  userId: string
) {
  let { error } = await supabaseClient
    .from('user_subscriptions')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('original_transaction_id', event.event.original_transaction_id);

  if (error && isMissingColumnError(error)) {
    const fallback = await supabaseClient
      .from('user_subscriptions')
      .update({
        status: 'expired',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('original_transaction_id', event.event.original_transaction_id);

    error = fallback.error;
  }

  if (error) {
    console.error('[ERROR] Failed to update subscription expiration:', error);
    throw error;
  }

  console.log(`[SUCCESS] Updated subscription expiration for user ${userId}`);
}

async function handleBillingIssue(
  supabaseClient: any,
  event: RevenueCatWebhookEvent,
  userId: string
) {
  // Log billing issue for monitoring
  console.warn(`[BILLING] Billing issue for user ${userId}:`, event.event.product_id);

  // You might want to send a notification to the user here
  // For now, just log it
}

async function handleProductChange(
  supabaseClient: any,
  event: RevenueCatWebhookEvent,
  userId: string
) {
  // Handle subscription upgrade/downgrade
  const subscriptionType = getSubscriptionType(event.event.product_id);

  let { error } = await supabaseClient
    .from('user_subscriptions')
    .update({
      subscription_type: subscriptionType,
      product_id: event.event.product_id,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('original_transaction_id', event.event.original_transaction_id);

  if (error && isMissingColumnError(error)) {
    const fallback = await supabaseClient
      .from('user_subscriptions')
      .update({
        subscription_type: subscriptionType,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('original_transaction_id', event.event.original_transaction_id);

    error = fallback.error;
  }

  if (error) {
    console.error('[ERROR] Failed to update product change:', error);
    throw error;
  }

  console.log(`[SUCCESS] Updated product change for user ${userId}`);
}

async function updateUserAttractionLimit(supabaseClient: any, userId: string) {
  try {
    const { data: entitlements } = await supabaseClient.rpc(
      'get_user_entitlements_v2',
      { user_uuid: userId }
    );

    if (entitlements && entitlements.length > 0) {
      const { total_attraction_limit } = entitlements[0];

      await supabaseClient.from('user_usage').upsert(
        {
          user_id: userId,
          package_limit: total_attraction_limit,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
    }
  } catch (error) {
    console.error('[ERROR] Failed to update user attraction limit:', error);
  }
}

function mapStoreToPlatform(store: string): 'ios' | 'android' {
  if (store === 'PLAY_STORE' || store === 'GOOGLE_PLAY') {
    return 'android';
  }
  return 'ios';
}

function isMissingColumnError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: string }).code;
  return code === '42703';
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function buildWebhookEventId(event: RevenueCatWebhookEvent['event']): string {
  const transactionKey =
    event.transaction_id ||
    event.original_transaction_id ||
    `${event.app_user_id}:${event.product_id}:${event.purchased_at_ms ?? Date.now()}`;
  return `${event.type}:${transactionKey}`;
}

async function reserveWebhookEvent(
  supabaseClient: any,
  params: {
    eventId: string;
    userId: string;
    productId: string;
    store: string;
  }
): Promise<boolean> {
  const { error } = await supabaseClient.from('processed_transactions').insert({
    transaction_id: params.eventId,
    user_id: params.userId,
    product_id: params.productId,
    platform: mapStoreToPlatform(params.store),
    processed_at: new Date().toISOString(),
  });

  if (!error) {
    return true;
  }

  if ((error as { code?: string }).code === '23505') {
    return false;
  }

  throw error;
}

async function upsertSubscriptionWithFallback(
  supabaseClient: any,
  userId: string,
  subscriptionType: string,
  eventData: RevenueCatWebhookEvent['event']
): Promise<any | null> {
  const expirationDate = eventData.expiration_at_ms
    ? new Date(eventData.expiration_at_ms).toISOString()
    : null;
  const platform = mapStoreToPlatform(eventData.store);

  const modernAttempt = await supabaseClient.from('user_subscriptions').upsert(
    {
      user_id: userId,
      subscription_type: subscriptionType,
      is_active: true,
      platform,
      original_transaction_id: eventData.original_transaction_id,
      purchase_token: eventData.transaction_id,
      product_id: eventData.product_id,
      purchase_date: new Date(eventData.purchased_at_ms).toISOString(),
      expiration_date: expirationDate,
      auto_renew: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'original_transaction_id' }
  );

  if (!modernAttempt.error) {
    return null;
  }

  if (!isMissingColumnError(modernAttempt.error)) {
    return modernAttempt.error;
  }

  const legacyAttempt = await supabaseClient.from('user_subscriptions').upsert(
    {
      user_id: userId,
      subscription_type: subscriptionType,
      status: 'active',
      platform,
      original_transaction_id: eventData.original_transaction_id,
      latest_receipt_info: eventData,
      expires_at: expirationDate,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'original_transaction_id' }
  );

  return legacyAttempt.error ?? null;
}

function getSubscriptionType(productId: string): string {
  if (productId.includes('unlimited_monthly')) return 'unlimited_monthly';
  if (productId.includes('premium_monthly')) return 'premium_monthly';
  if (productId.includes('yearly')) return 'premium_yearly';
  if (productId.includes('lifetime')) return 'lifetime';
  return 'unlimited_monthly';
}

function getPackageId(productId: string): string {
  // Map RevenueCat product IDs to package IDs
  if (productId.includes('basic')) return 'basic_package';
  if (productId.includes('standard')) return 'standard_package';
  if (productId.includes('premium')) return 'premium_package';
  return productId;
}

// Removed hexToBytes function - RevenueCat uses simple string comparison, not HMAC
