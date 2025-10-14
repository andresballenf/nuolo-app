import type { GooglePurchaseResponse, GoogleSubscriptionResponse, VerifyReceiptResponse } from './types.ts';

/**
 * Verify Google Play purchase
 *
 * Uses Google Play Developer API to validate purchase tokens.
 * Requires Google service account credentials with appropriate permissions.
 *
 * @param purchaseToken - Purchase token from Google Play
 * @param productId - Expected product ID
 * @returns Verification result with transaction details
 */
export async function verifyGoogleReceipt(
  purchaseToken: string,
  productId: string
): Promise<VerifyReceiptResponse> {
  const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT');

  if (!serviceAccountJson) {
    console.error('[ERROR] GOOGLE_SERVICE_ACCOUNT not configured');
    return {
      valid: false,
      error: 'Server configuration error',
      code: 'MISSING_CREDENTIALS',
    };
  }

  try {
    // Parse service account credentials
    const serviceAccount = JSON.parse(serviceAccountJson);
    const packageName = 'com.nuolo.app'; // Your app's package name

    // Get OAuth access token
    const accessToken = await getGoogleAccessToken(serviceAccount);

    // Determine if it's a subscription or product
    // Try product first, then subscription
    let result = await verifyProduct(accessToken, packageName, productId, purchaseToken);

    if (!result.valid && result.code === 'NOT_FOUND') {
      // Try as subscription
      result = await verifySubscription(accessToken, packageName, productId, purchaseToken);
    }

    return result;
  } catch (error) {
    console.error('[ERROR] Google verification failed:', error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      code: 'GOOGLE_API_ERROR',
    };
  }
}

/**
 * Verify a one-time product purchase
 */
async function verifyProduct(
  accessToken: string,
  packageName: string,
  productId: string,
  purchaseToken: string
): Promise<VerifyReceiptResponse> {
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/products/${productId}/tokens/${purchaseToken}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return {
          valid: false,
          error: 'Product not found',
          code: 'NOT_FOUND',
        };
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: GooglePurchaseResponse = await response.json();

    // Check purchase state (0 = purchased, 1 = cancelled)
    if (data.purchaseState !== 0) {
      return {
        valid: false,
        error: 'Purchase cancelled or pending',
        code: 'INVALID_STATE',
      };
    }

    console.log('[SUCCESS] Google product verified:', {
      orderId: data.orderId,
      productId,
    });

    return {
      valid: true,
      transactionId: data.orderId,
      orderId: data.orderId,
      purchaseTime: parseInt(data.purchaseTimeMillis, 10),
    };
  } catch (error) {
    console.error('[ERROR] Product verification failed:', error);
    throw error;
  }
}

/**
 * Verify a subscription purchase
 */
async function verifySubscription(
  accessToken: string,
  packageName: string,
  subscriptionId: string,
  purchaseToken: string
): Promise<VerifyReceiptResponse> {
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${subscriptionId}/tokens/${purchaseToken}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return {
          valid: false,
          error: 'Subscription not found',
          code: 'NOT_FOUND',
        };
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: GoogleSubscriptionResponse = await response.json();

    // Check if subscription is active
    const now = Date.now();
    const expiryTime = parseInt(data.expiryTimeMillis, 10);

    if (expiryTime < now) {
      return {
        valid: false,
        error: 'Subscription expired',
        code: 'EXPIRED',
      };
    }

    console.log('[SUCCESS] Google subscription verified:', {
      orderId: data.orderId,
      subscriptionId,
      expiryTime,
    });

    return {
      valid: true,
      transactionId: data.orderId,
      orderId: data.orderId,
      purchaseTime: parseInt(data.startTimeMillis, 10),
      expiryTime,
    };
  } catch (error) {
    console.error('[ERROR] Subscription verification failed:', error);
    throw error;
  }
}

/**
 * Get OAuth 2.0 access token for Google APIs
 * Uses service account JWT authentication
 */
async function getGoogleAccessToken(serviceAccount: any): Promise<string> {
  const { client_email, private_key } = serviceAccount;

  if (!client_email || !private_key) {
    throw new Error('Invalid service account credentials');
  }

  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600; // 1 hour

  // Create JWT header
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  // Create JWT claim set
  const claimSet = {
    iss: client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    exp: expiry,
    iat: now,
  };

  // Encode header and claim set
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaimSet = base64UrlEncode(JSON.stringify(claimSet));

  // Create signature input
  const signatureInput = `${encodedHeader}.${encodedClaimSet}`;

  // Sign with private key using Web Crypto API
  const privateKeyPem = private_key.replace(/\\n/g, '\n');
  const keyData = pemToArrayBuffer(privateKeyPem);

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signatureInput)
  );

  const signature = base64UrlEncode(signatureBuffer);

  // Create JWT
  const jwt = `${signatureInput}.${signature}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenResponse.ok) {
    throw new Error(`Failed to get access token: ${tokenResponse.statusText}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

/**
 * Convert PEM private key to ArrayBuffer
 */
function pemToArrayBuffer(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');

  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);

  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes.buffer;
}

/**
 * Base64 URL encode
 */
function base64UrlEncode(data: string | ArrayBuffer): string {
  let base64: string;

  if (typeof data === 'string') {
    base64 = btoa(data);
  } else {
    const bytes = new Uint8Array(data);
    const binary = Array.from(bytes).map(byte => String.fromCharCode(byte)).join('');
    base64 = btoa(binary);
  }

  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
