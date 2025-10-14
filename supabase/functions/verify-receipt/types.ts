/**
 * Type definitions for receipt verification
 */

export interface VerifyReceiptRequest {
  receipt: string; // Base64 receipt data (iOS) or purchase token (Android)
  platform: 'ios' | 'android';
  productId: string;
  transactionId?: string;
}

export interface VerifyReceiptResponse {
  valid: boolean;
  transactionId?: string;
  orderId?: string; // Android only
  purchaseTime?: number;
  expiryTime?: number; // For subscriptions
  error?: string;
  code?: string;
}

export interface AppleReceiptResponse {
  status: number;
  receipt?: {
    bundle_id: string;
    in_app: Array<{
      product_id: string;
      transaction_id: string;
      original_transaction_id: string;
      purchase_date_ms: string;
      expires_date_ms?: string;
    }>;
    original_transaction_id?: string;
    transaction_id?: string;
  };
  latest_receipt_info?: Array<{
    product_id: string;
    transaction_id: string;
    original_transaction_id: string;
    purchase_date_ms: string;
    expires_date_ms?: string;
  }>;
  environment?: 'Sandbox' | 'Production';
}

export interface GooglePurchaseResponse {
  kind: string;
  purchaseTimeMillis: string;
  purchaseState: number; // 0 = purchased, 1 = cancelled, 2 = pending
  consumptionState: number;
  orderId: string;
  acknowledgementState: number;
  productId?: string;
}

export interface GoogleSubscriptionResponse {
  kind: string;
  startTimeMillis: string;
  expiryTimeMillis: string;
  autoRenewing: boolean;
  priceCurrencyCode: string;
  priceAmountMicros: string;
  countryCode: string;
  orderId: string;
  acknowledgementState: number;
  purchaseType?: number;
}
