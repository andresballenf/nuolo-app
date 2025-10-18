import { Platform } from 'react-native';

/**
 * Centralized Product ID Configuration
 *
 * All In-App Purchase product IDs are defined here.
 * These must match the product IDs configured in:
 * - Apple App Store Connect
 * - Google Play Console
 */

export const PRODUCT_IDS = {
  // ============================================================
  // SUBSCRIPTION
  // ============================================================

  /**
   * Unlimited Monthly Subscription
   * - Unlimited audio guides
   * - Monthly auto-renewal
   * - Price: $29.99/month
   */
  UNLIMITED_MONTHLY: Platform.select({
    ios: 'nuolo_unlimited_monthly',
    android: 'nuolo_unlimited_monthly',
    default: 'nuolo_unlimited_monthly',
  }),

  // ============================================================
  // ATTRACTION PACKAGES (Consumable)
  // ============================================================
  // These are consumable because users "use up" the audio guide credits
  // as they generate guides. Users can purchase multiple times.

  /**
   * Basic Package
   * - 5 audio guide credits
   * - Price: $3.99
   */
  BASIC_PACKAGE: Platform.select({
    ios: 'nuolo_basic_package',
    android: 'nuolo_basic_package',
    default: 'nuolo_basic_package',
  }),

  /**
   * Standard Package
   * - 20 audio guide credits
   * - Price: $9.99
   * - Most Popular
   */
  STANDARD_PACKAGE: Platform.select({
    ios: 'nuolo_standard_package',
    android: 'nuolo_standard_package',
    default: 'nuolo_standard_package',
  }),

  /**
   * Premium Package
   * - 50 audio guide credits
   * - Price: $19.99
   * - Best Value
   */
  PREMIUM_PACKAGE: Platform.select({
    ios: 'nuolo_premium_package',
    android: 'nuolo_premium_package',
    default: 'nuolo_premium_package',
  }),
} as const;

/**
 * Product Type Classification
 */
export const PRODUCT_TYPES = {
  SUBSCRIPTION: 'subscription' as const,
  PACKAGE: 'consumable' as const, // Packages are consumable (credits that get used up)
  ATTRACTION: 'consumable' as const, // Individual attractions are also consumable
} as const;

/**
 * Legacy Product IDs (for existing subscriptions only)
 * These are no longer available for new purchases but must be
 * maintained for receipt validation and existing subscribers.
 *
 * DO NOT DELETE - Required for App Store/Play Store compliance
 */
export const LEGACY_PRODUCT_IDS = {
  PREMIUM_MONTHLY: Platform.select({
    ios: 'nuolo_premium_monthly',
    android: 'nuolo_premium_monthly',
    default: 'nuolo_premium_monthly',
  }),
  PREMIUM_YEARLY: Platform.select({
    ios: 'nuolo_premium_yearly',
    android: 'nuolo_premium_yearly',
    default: 'nuolo_premium_yearly',
  }),
  LIFETIME: Platform.select({
    ios: 'nuolo_lifetime',
    android: 'nuolo_lifetime',
    default: 'nuolo_lifetime',
  }),
} as const;

/**
 * All product IDs (active + legacy)
 * Used for receipt validation and purchase history
 */
export const ALL_PRODUCT_IDS = {
  ...PRODUCT_IDS,
  ...LEGACY_PRODUCT_IDS,
} as const;

const isProductId = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.length > 0;

/**
 * Get all active product IDs as array
 */
export function getActiveProductIds(): string[] {
  return Object.values(PRODUCT_IDS).filter(isProductId);
}

/**
 * Get all product IDs (including legacy) as array
 */
export function getAllProductIds(): string[] {
  return Object.values(ALL_PRODUCT_IDS).filter(isProductId);
}

/**
 * Check if a product ID is a legacy product
 */
export function isLegacyProduct(productId: string): boolean {
  return Object.values(LEGACY_PRODUCT_IDS)
    .filter(isProductId)
    .includes(productId);
}

/**
 * Check if a product ID is a subscription
 */
export function isSubscription(productId: string): boolean {
  return productId.includes('unlimited_monthly') ||
         productId.includes('premium_monthly') ||
         productId.includes('premium_yearly') ||
         productId.includes('lifetime');
}

/**
 * Check if a product ID is a package
 */
export function isPackage(productId: string): boolean {
  return productId.includes('package');
}
