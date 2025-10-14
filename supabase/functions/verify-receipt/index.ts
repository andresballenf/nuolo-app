import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyAppleReceipt } from './apple-verifier.ts';
import { verifyGoogleReceipt } from './google-verifier.ts';
import type { VerifyReceiptRequest, VerifyReceiptResponse } from './types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's auth token
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verify user is authenticated
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: VerifyReceiptRequest = await req.json();
    const { receipt, platform, productId, transactionId } = body;

    if (!receipt || !platform || !productId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: receipt, platform, productId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if transaction was already processed (replay attack prevention)
    const { data: existingTransaction } = await supabaseClient
      .from('processed_transactions')
      .select('id')
      .eq('transaction_id', transactionId)
      .single();

    if (existingTransaction) {
      console.warn('[SECURITY] Duplicate transaction detected:', transactionId);
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'Transaction already processed',
          code: 'DUPLICATE_TRANSACTION',
        } as VerifyReceiptResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify receipt with appropriate platform
    let verificationResult: VerifyReceiptResponse;

    if (platform === 'ios') {
      verificationResult = await verifyAppleReceipt(receipt, productId);
    } else if (platform === 'android') {
      verificationResult = await verifyGoogleReceipt(receipt, productId);
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid platform. Must be ios or android' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If verification successful, record the transaction
    if (verificationResult.valid && verificationResult.transactionId) {
      const { error: insertError } = await supabaseClient
        .from('processed_transactions')
        .insert({
          transaction_id: verificationResult.transactionId,
          user_id: user.id,
          product_id: productId,
          platform: platform,
          processed_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error('[ERROR] Failed to record transaction:', insertError);
        // Continue anyway - verification succeeded
      }
    }

    // Return verification result
    return new Response(JSON.stringify(verificationResult), {
      status: verificationResult.valid ? 200 : 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[ERROR] Receipt verification failed:', error);
    return new Response(
      JSON.stringify({
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      } as VerifyReceiptResponse),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
