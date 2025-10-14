import type { AppleReceiptResponse, VerifyReceiptResponse } from './types.ts';

/**
 * Verify Apple App Store receipt
 *
 * Uses Apple's verifyReceipt endpoint to validate purchase receipts.
 * Automatically handles sandbox/production environment detection.
 *
 * @param receipt - Base64 encoded receipt data
 * @param productId - Expected product ID
 * @returns Verification result with transaction details
 */
export async function verifyAppleReceipt(
  receipt: string,
  productId: string
): Promise<VerifyReceiptResponse> {
  const sharedSecret = Deno.env.get('APPLE_SHARED_SECRET');

  if (!sharedSecret) {
    console.error('[ERROR] APPLE_SHARED_SECRET not configured');
    return {
      valid: false,
      error: 'Server configuration error',
      code: 'MISSING_SECRET',
    };
  }

  // Try production endpoint first
  let response = await verifyWithApple(receipt, sharedSecret, false);

  // If production returns sandbox receipt error (21007), retry with sandbox
  if (response.status === 21007) {
    console.log('[INFO] Sandbox receipt detected, retrying with sandbox endpoint');
    response = await verifyWithApple(receipt, sharedSecret, true);
  }

  // Check status code
  if (response.status !== 0) {
    const errorMessage = getAppleErrorMessage(response.status);
    console.error(`[ERROR] Apple verification failed: ${errorMessage} (status: ${response.status})`);
    return {
      valid: false,
      error: errorMessage,
      code: `APPLE_${response.status}`,
    };
  }

  // Validate receipt data exists
  if (!response.receipt || !response.receipt.in_app || response.receipt.in_app.length === 0) {
    console.error('[ERROR] No purchase data in receipt');
    return {
      valid: false,
      error: 'Invalid receipt data',
      code: 'NO_PURCHASE_DATA',
    };
  }

  // Find the purchase matching the product ID
  const purchase = response.receipt.in_app.find(
    (item) => item.product_id === productId
  );

  if (!purchase) {
    console.error(`[ERROR] Product ID ${productId} not found in receipt`);
    return {
      valid: false,
      error: 'Product ID mismatch',
      code: 'PRODUCT_MISMATCH',
    };
  }

  // Extract transaction details
  const transactionId = purchase.transaction_id;
  const purchaseTime = parseInt(purchase.purchase_date_ms, 10);
  const expiryTime = purchase.expires_date_ms
    ? parseInt(purchase.expires_date_ms, 10)
    : undefined;

  console.log('[SUCCESS] Apple receipt verified:', {
    transactionId,
    productId,
    environment: response.environment,
  });

  return {
    valid: true,
    transactionId,
    purchaseTime,
    expiryTime,
  };
}

/**
 * Call Apple's verifyReceipt API
 */
async function verifyWithApple(
  receipt: string,
  sharedSecret: string,
  sandbox: boolean
): Promise<AppleReceiptResponse> {
  const url = sandbox
    ? 'https://sandbox.itunes.apple.com/verifyReceipt'
    : 'https://buy.itunes.apple.com/verifyReceipt';

  const requestBody = {
    'receipt-data': receipt,
    'password': sharedSecret,
    'exclude-old-transactions': true, // Only return latest transaction info
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: AppleReceiptResponse = await response.json();
    return data;
  } catch (error) {
    console.error('[ERROR] Apple API request failed:', error);
    throw error;
  }
}

/**
 * Get human-readable error message for Apple status codes
 */
function getAppleErrorMessage(status: number): string {
  const errorMessages: Record<number, string> = {
    21000: 'The App Store could not read the JSON object you provided',
    21002: 'The data in the receipt-data property was malformed or missing',
    21003: 'The receipt could not be authenticated',
    21004: 'The shared secret you provided does not match the shared secret on file',
    21005: 'The receipt server is not currently available',
    21006: 'This receipt is valid but the subscription has expired',
    21007: 'This receipt is from the test environment, but it was sent to the production environment',
    21008: 'This receipt is from the production environment, but it was sent to the test environment',
    21009: 'Internal data access error',
    21010: 'The user account cannot be found or has been deleted',
  };

  return errorMessages[status] || `Unknown error (status: ${status})`;
}
