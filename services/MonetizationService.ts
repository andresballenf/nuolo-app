import { Platform } from 'react-native';
import Purchases, {
  PurchasesOfferings,
  PurchasesPackage,
  CustomerInfo,
  PurchasesEntitlementInfo,
  LOG_LEVEL,
} from 'react-native-purchases';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { monetizationRpcContract } from './MonetizationRpcContract';

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
};

export interface Product {
  productId: string;
  price: string;
  currency: string;
  localizedPrice: string;
  title: string;
  description: string;
  type: 'subscription' | 'consumable' | 'non_consumable';
}

export interface SubscriptionStatus {
  isActive: boolean;
  // Current subscription: unlimited_monthly
  // Legacy types maintained for existing subscribers: premium_monthly, premium_yearly, lifetime
  type: 'free' | 'unlimited_monthly' | 'premium_monthly' | 'premium_yearly' | 'lifetime' | null;
  expiresAt: Date | null;
  inGracePeriod: boolean;
  inTrial: boolean;
  trialEndsAt: Date | null;
}

export interface UserEntitlements {
  hasUnlimitedAccess: boolean;
  totalAttractionLimit: number;
  remainingFreeAttractions: number;
  attractionsUsed: number;
  ownedAttractions: string[];
  ownedPacks: string[];
  ownedPackages: AttractionPackage[];
}

export interface AttractionPack {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  attraction_ids: string[];
  apple_product_id: string;
  google_product_id: string;
  currency: string;
  is_active: boolean;
}

export interface AttractionPackage {
  id: string;
  name: string;
  description: string;
  attraction_count: number;
  price_usd: number;
  apple_product_id: string;
  google_product_id: string;
  sort_order: number;
  badge_text?: string;
  is_active: boolean;
}

export interface PurchaseResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

interface RevenueCatStatus {
  initialized: boolean;
  configured: boolean;
  hasCurrentOffering: boolean;
  currentOfferingIdentifier: string | null;
  availablePackageCount: number;
}

export class MonetizationService {
  private static instance: MonetizationService | null = null;
  private initialized = false;
  private revenueCatConfigured = false;
  private currentOfferings: PurchasesOfferings | null = null;

  // Entitlement identifiers / internal package IDs
  private static readonly ENTITLEMENTS = {
    UNLIMITED: 'unlimited', // For unlimited monthly subscription
    BASIC_PACKAGE: 'basic_package', // For basic package (5 guides)
    STANDARD_PACKAGE: 'standard_package', // For standard package (20 guides)
    PREMIUM_PACKAGE: 'premium_package', // For premium package (50 guides)
  };

  private static readonly PRODUCT_IDS = {
    UNLIMITED_MONTHLY: 'nuolo_unlimited_monthly',
    BASIC_PACKAGE: 'nuolo_basic_package',
    STANDARD_PACKAGE: 'nuolo_standard_package',
    PREMIUM_PACKAGE: 'nuolo_premium_package',
  } as const;

  private static readonly PACKAGE_CONFIGS: Array<{
    id: string;
    productId: string;
    attractionLimit: number;
    entitlementId?: string;
  }> = [
    {
      id: MonetizationService.ENTITLEMENTS.BASIC_PACKAGE,
      productId: MonetizationService.PRODUCT_IDS.BASIC_PACKAGE,
      attractionLimit: 5,
      entitlementId: MonetizationService.ENTITLEMENTS.BASIC_PACKAGE,
    },
    {
      id: MonetizationService.ENTITLEMENTS.STANDARD_PACKAGE,
      productId: MonetizationService.PRODUCT_IDS.STANDARD_PACKAGE,
      attractionLimit: 20,
      entitlementId: MonetizationService.ENTITLEMENTS.STANDARD_PACKAGE,
    },
    {
      id: MonetizationService.ENTITLEMENTS.PREMIUM_PACKAGE,
      productId: MonetizationService.PRODUCT_IDS.PREMIUM_PACKAGE,
      attractionLimit: 50,
      entitlementId: MonetizationService.ENTITLEMENTS.PREMIUM_PACKAGE,
    },
  ] as const;

  private static readonly UNLIMITED_USAGE_LIMIT = 1000000;

  static getInstance(): MonetizationService {
    if (!MonetizationService.instance) {
      MonetizationService.instance = new MonetizationService();
    }
    return MonetizationService.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.info('RevenueCat already initialized, skipping');
      return;
    }

    logger.info('RevenueCat starting initialization');
    try {
      // Check if we're running in Expo Go (can't use native modules)
      const constantsModule = await import('expo-constants');
      const Constants = constantsModule.default ?? constantsModule;
      const appOwnership = Constants?.appOwnership ?? null;
      const executionEnvironment = Constants?.executionEnvironment ?? null;
      const isExpoGo = appOwnership === 'expo' && executionEnvironment === 'storeClient';

      if (isExpoGo) {
        logger.warn('Running in Expo Go - RevenueCat not available. Use development build or production build.');
        this.initialized = true;
        return;
      }

      const apiKey = Platform.select({
        ios: Constants.expoConfig?.extra?.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ||
             process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ||
             'YOUR_IOS_API_KEY_HERE',
        android: Constants.expoConfig?.extra?.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ||
                 process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ||
                 'YOUR_ANDROID_API_KEY_HERE',
        default: '',
      });

      logger.info('RevenueCat API key check', {
        platform: Platform.OS,
        hasKey: apiKey && !apiKey.includes('YOUR_'),
        keyPrefix: apiKey ? apiKey.substring(0, 5) : 'none'
      });

      if (!apiKey || apiKey.includes('YOUR_')) {
        // For development: allow running without API keys to test UI
        if (__DEV__) {
          logger.warn('RevenueCat API key not configured - running in mock mode');
          this.initialized = true;
          return;
        }
        throw new Error('RevenueCat API key not configured. Please set up your API keys in app.config.js');
      }

      // Enable debug logging in development
      if (__DEV__) {
        Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      }

      // Configure Purchases
      Purchases.configure({ apiKey });
      this.revenueCatConfigured = true;

      // Load offerings
      await this.loadOfferings();

      this.initialized = true;
      logger.info('RevenueCat initialization complete');
    } catch (error: unknown) {
      // In development, allow the app to continue even if RevenueCat fails
      if (__DEV__) {
        logger.warn('RevenueCat initialization failed - continuing in mock mode', error);
        this.initialized = true;
        return;
      }
      logger.error('RevenueCat initialization failed', error);
      throw error instanceof Error ? error : new Error(getErrorMessage(error));
    }
  }

  private async loadOfferings(): Promise<void> {
    if (!this.revenueCatConfigured) {
      logger.warn('RevenueCat not configured, skipping offerings load');
      return;
    }

    try {
      const offerings = await Purchases.getOfferings();
      this.currentOfferings = offerings;

      if (offerings.current) {
        logger.info('RevenueCat offerings loaded', {
          offeringId: offerings.current.identifier,
          packageCount: offerings.current.availablePackages.length,
        });
      } else {
        logger.warn('No current offering found in RevenueCat');
      }
    } catch (error: unknown) {
      logger.error('Failed to load offerings', error);
      throw error;
    }
  }

  // Public API methods

  async getAvailableProducts(): Promise<Product[]> {
    if (!this.initialized) await this.initialize();

    if (!this.revenueCatConfigured || !this.currentOfferings?.current) {
      return [];
    }

    const products: Product[] = [];

    for (const pkg of this.currentOfferings.current.availablePackages) {
      const product = pkg.product;
      products.push({
        productId: product.identifier,
        price: product.priceString,
        currency: product.currencyCode,
        localizedPrice: product.priceString,
        title: product.title,
        description: product.description,
        type: this.getProductType(product.identifier),
      });
    }

    return products;
  }

  private getProductType(productId: string): 'subscription' | 'consumable' | 'non_consumable' {
    if (productId.includes('monthly') || productId.includes('yearly') || productId.includes('lifetime')) {
      return 'subscription';
    }
    if (productId.includes('package') || productId.includes('attraction')) {
      return 'consumable';
    }
    return 'consumable';
  }

  async getAttractionPacks(): Promise<AttractionPack[]> {
    const { data, error } = await supabase
      .from('attraction_packs')
      .select('*')
      .eq('is_active', true)
      .order('price_cents', { ascending: true });

    if (error) {
      logger.error('Failed to fetch attraction packs', error);
      return [];
    }

    return data || [];
  }

  async getAttractionPackages(): Promise<AttractionPackage[]> {
    const { data, error } = await supabase
      .from('attraction_packages')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      logger.error('Failed to fetch attraction packages', error);
      return [];
    }

    return data || [];
  }

  async purchaseSubscription(subscriptionType: string): Promise<boolean> {
    try {
      if (!this.initialized) await this.initialize();

      if (!this.revenueCatConfigured) {
        logger.error('RevenueCat not configured - cannot purchase subscription');
        return false;
      }

      const pkg = this.findPackageByType('subscription');
      if (!pkg) {
        throw new Error('Subscription package not found');
      }

      const { customerInfo } = await Purchases.purchasePackage(pkg);

      // Sync with Supabase
      await this.syncCustomerInfo(customerInfo);

      logger.info('Subscription purchased successfully');
      return true;
    } catch (error: any) {
      if (error.userCancelled) {
        logger.info('User cancelled subscription purchase');
        return false;
      }
      logger.error('Subscription purchase failed', error);
      return false;
    }
  }

  async purchaseSingleAttraction(attractionId: string): Promise<boolean> {
    try {
      if (!this.initialized) await this.initialize();

      // Single attractions not supported with RevenueCat packages
      // Consider using consumables or directing users to packages
      logger.warn('Single attraction purchases not implemented with RevenueCat');
      return false;
    } catch (error) {
      logger.error('Attraction purchase failed', error);
      return false;
    }
  }

  async purchaseAttractionPack(packId: string): Promise<boolean> {
    try {
      if (!this.initialized) await this.initialize();

      if (!this.revenueCatConfigured) {
        logger.error('RevenueCat not configured - cannot purchase pack');
        return false;
      }

      const pkg = this.findPackageById(packId);
      if (!pkg) {
        throw new Error(`Package not found: ${packId}`);
      }

      const { customerInfo } = await Purchases.purchasePackage(pkg);

      // Sync with Supabase
      await this.syncCustomerInfo(customerInfo);

      logger.info('Package purchased successfully', { packId });
      return true;
    } catch (error: any) {
      if (error.userCancelled) {
        logger.info('User cancelled package purchase');
        return false;
      }
      logger.error('Package purchase failed', error);
      return false;
    }
  }

  async purchaseAttractionPackage(packageId: string): Promise<boolean> {
    try {
      if (!this.initialized) await this.initialize();

      if (!this.revenueCatConfigured) {
        logger.error('RevenueCat not configured - cannot purchase package');
        return false;
      }

      const pkg = this.findPackageByEntitlement(packageId);
      if (!pkg) {
        throw new Error(`Package not found: ${packageId}`);
      }

      const { customerInfo } = await Purchases.purchasePackage(pkg);

      // Sync with Supabase
      await this.syncCustomerInfo(customerInfo);

      logger.info('Attraction package purchased successfully', { packageId });
      return true;
    } catch (error: any) {
      if (error.userCancelled) {
        logger.info('User cancelled attraction package purchase');
        return false;
      }
      logger.error('Attraction package purchase failed', error);
      return false;
    }
  }

  async restorePurchases(): Promise<void> {
    try {
      if (!this.initialized) await this.initialize();

      if (!this.revenueCatConfigured) {
        logger.error('RevenueCat not configured - cannot restore purchases');
        throw new Error('RevenueCat not configured');
      }

      const customerInfo = await Purchases.restorePurchases();

      // Sync restored purchases with Supabase
      await this.syncCustomerInfo(customerInfo);

      logger.info('Purchases restored successfully');
    } catch (error) {
      logger.error('Restore purchases failed', error);
      throw error;
    }
  }

  /**
   * Exposes current RevenueCat configuration/offerings status for diagnostics.
   */
  getRevenueCatStatus(): RevenueCatStatus {
    const current = this.currentOfferings?.current ?? null;
    return {
      initialized: this.initialized,
      configured: this.revenueCatConfigured,
      hasCurrentOffering: Boolean(current && current.availablePackages && current.availablePackages.length > 0),
      currentOfferingIdentifier: current?.identifier ?? null,
      availablePackageCount: current?.availablePackages?.length ?? 0,
    };
  }

  /**
   * Ensures Purchases is configured and offerings are available.
   * Attempts to fetch offerings with a timeout. Returns diagnostics.
   */
  async ensurePurchasesReady(timeoutMs = 6000): Promise<{
    ready: boolean;
    status: RevenueCatStatus;
    offerings?: PurchasesOfferings | null;
    reason?: string;
  }> {
    // If not initialized, try to initialize quickly (non-throwing in dev)
    if (!this.initialized) {
      try {
        await this.initialize();
      } catch (e) {
        logger.warn('ensurePurchasesReady: initialize failed', e);
      }
    }

    const statusBefore = this.getRevenueCatStatus();

    // If not configured, we're not ready
    if (!this.revenueCatConfigured) {
      logger.warn('ensurePurchasesReady: RevenueCat not configured');
      return { ready: false, status: statusBefore, offerings: this.currentOfferings, reason: 'not_configured' };
    }

    // Helper to fetch offerings
    const fetchOfferings = async () => {
      try {
        const offerings = await Purchases.getOfferings();
        this.currentOfferings = offerings;
        if (offerings?.current) {
          logger.info('ensurePurchasesReady: offerings fetched', {
            offeringId: offerings.current.identifier,
            packageCount: offerings.current.availablePackages.length,
          });
        }
        return offerings;
      } catch (err) {
        logger.error('ensurePurchasesReady: fetching offerings failed', err);
        throw err;
      }
    };

    // Race with timeout
    const result = await Promise.race<Promise<PurchasesOfferings | null>>([
      fetchOfferings(),
      new Promise<PurchasesOfferings | null>((_, reject) =>
        setTimeout(() => reject(new Error('offerings_timeout')), Math.max(1000, timeoutMs))
      ),
    ]).catch((e) => {
      logger.warn('ensurePurchasesReady: offerings fetch timed out or failed', e);
      return null;
    });

    const current = result?.current ?? this.currentOfferings?.current ?? null;
    const hasPackages = Boolean(current && current.availablePackages && current.availablePackages.length > 0);

    const statusAfter = this.getRevenueCatStatus();
    const ready = this.revenueCatConfigured && hasPackages;

    if (!ready) {
      logger.warn('ensurePurchasesReady: not ready after fetch', {
        statusAfter,
        reason: !this.revenueCatConfigured
          ? 'not_configured'
          : !current
          ? 'no_current_offering'
          : 'no_packages',
      });
    }

    return {
      ready,
      status: statusAfter,
      offerings: this.currentOfferings,
      reason: ready
        ? undefined
        : !this.revenueCatConfigured
        ? 'not_configured'
        : !current
        ? 'no_current_offering'
        : 'no_packages',
    };
  }

  async getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
    try {
      if (!this.revenueCatConfigured) {
        logger.warn('RevenueCat not configured, falling back to subscription RPC v2');
        return this.getSubscriptionStatusFromRpcV2(userId);
      }

      const customerInfo = await Purchases.getCustomerInfo();
      await this.syncCustomerInfo(customerInfo);

      const activeEntitlements = customerInfo.entitlements?.active ?? {};
      const activeEntitlementValues = Object.values(activeEntitlements) as PurchasesEntitlementInfo[];
      const activeSubscriptions = new Set(customerInfo.activeSubscriptions ?? []);

      const unlimitedEntitlement =
        activeEntitlements[MonetizationService.ENTITLEMENTS.UNLIMITED] ||
        activeEntitlementValues.find(
          entitlement => entitlement.productIdentifier === MonetizationService.PRODUCT_IDS.UNLIMITED_MONTHLY
        );

      const hasUnlimited =
        Boolean(unlimitedEntitlement) ||
        activeSubscriptions.has(MonetizationService.PRODUCT_IDS.UNLIMITED_MONTHLY);

      if (hasUnlimited) {
        const subscriptionInfo =
          customerInfo.subscriptionsByProductIdentifier?.[MonetizationService.PRODUCT_IDS.UNLIMITED_MONTHLY] ?? null;

        const expirationIso =
          unlimitedEntitlement?.expirationDate ??
          subscriptionInfo?.expiresDate ??
          customerInfo.allExpirationDates?.[MonetizationService.PRODUCT_IDS.UNLIMITED_MONTHLY] ??
          null;

        const periodType = subscriptionInfo?.periodType ?? unlimitedEntitlement?.periodType ?? null;

        const gracePeriodExpires = subscriptionInfo?.gracePeriodExpiresDate
          ? new Date(subscriptionInfo.gracePeriodExpiresDate)
          : null;

        const trialEndsAtIso =
          periodType && (periodType === 'TRIAL' || periodType === 'INTRO')
            ? subscriptionInfo?.expiresDate ?? unlimitedEntitlement?.expirationDate ?? null
            : null;

        return {
          isActive: true,
          type: 'unlimited_monthly',
          expiresAt: expirationIso ? new Date(expirationIso) : null,
          inGracePeriod: gracePeriodExpires ? gracePeriodExpires > new Date() : false,
          inTrial: periodType === 'TRIAL' || periodType === 'INTRO',
          trialEndsAt: trialEndsAtIso ? new Date(trialEndsAtIso) : null,
        };
      }

      return this.getSubscriptionStatusFromRpcV2(userId);
    } catch (error: unknown) {
      logger.error('Failed to get subscription status', error);
      try {
        return await this.getSubscriptionStatusFromRpcV2(userId);
      } catch (fallbackError) {
        logger.error('Subscription status RPC fallback failed', fallbackError);
      }
      return {
        isActive: false,
        type: 'free',
        expiresAt: null,
        inGracePeriod: false,
        inTrial: false,
        trialEndsAt: null,
      };
    }
  }

  async getUserEntitlements(userId: string): Promise<UserEntitlements> {
    try {
      let hasUnlimitedFromRevenueCat = false;

      if (!this.revenueCatConfigured) {
        logger.warn('RevenueCat not configured, using entitlement RPC v2 only');
      } else {
        try {
          const customerInfo = await Purchases.getCustomerInfo();
          await this.syncCustomerInfo(customerInfo);

          const activeEntitlements = customerInfo.entitlements?.active ?? {};
          const activeEntitlementValues = Object.values(activeEntitlements) as PurchasesEntitlementInfo[];
          const activeSubscriptions = new Set(customerInfo.activeSubscriptions ?? []);

          const unlimitedEntitlement =
            activeEntitlements[MonetizationService.ENTITLEMENTS.UNLIMITED] ||
            activeEntitlementValues.find(
              entitlement => entitlement.productIdentifier === MonetizationService.PRODUCT_IDS.UNLIMITED_MONTHLY
            );

          hasUnlimitedFromRevenueCat =
            Boolean(unlimitedEntitlement) ||
            activeSubscriptions.has(MonetizationService.PRODUCT_IDS.UNLIMITED_MONTHLY);
        } catch (error) {
          logger.error('Failed to read RevenueCat entitlements; using RPC v2 fallback', error);
        }
      }

      const rpcState = await this.getUserEntitlementsFromRpcV2(userId);
      const hasUnlimitedAccess = hasUnlimitedFromRevenueCat || rpcState.hasUnlimitedAccess;
      const totalAttractionLimit = hasUnlimitedAccess
        ? MonetizationService.UNLIMITED_USAGE_LIMIT
        : Math.max(2, rpcState.totalAttractionLimit);
      const attractionsUsed = Math.max(0, rpcState.attractionsUsed);
      const remainingAttractions = hasUnlimitedAccess
        ? MonetizationService.UNLIMITED_USAGE_LIMIT
        : Math.max(0, totalAttractionLimit - attractionsUsed);

      let packageDetails: AttractionPackage[] = [];
      if (rpcState.ownedPackages.length > 0) {
        const { data: packagesData, error: packagesError } = await supabase
          .from('attraction_packages')
          .select('*')
          .in('id', rpcState.ownedPackages)
          .eq('is_active', true);

        if (packagesError) {
          logger.error('Failed to fetch owned attraction packages', packagesError);
        } else if (packagesData) {
          packageDetails = packagesData;
        }
      }

      return {
        hasUnlimitedAccess,
        totalAttractionLimit,
        remainingFreeAttractions: remainingAttractions,
        attractionsUsed,
        ownedAttractions: [],
        ownedPacks: rpcState.ownedPackages,
        ownedPackages: packageDetails,
      };
    } catch (error: unknown) {
      logger.error('Failed to get user entitlements', error);
      try {
        const rpcState = await this.getUserEntitlementsFromRpcV2(userId);
        const totalLimit = Math.max(2, rpcState.totalAttractionLimit);
        return {
          hasUnlimitedAccess: rpcState.hasUnlimitedAccess,
          totalAttractionLimit: rpcState.hasUnlimitedAccess
            ? MonetizationService.UNLIMITED_USAGE_LIMIT
            : totalLimit,
          remainingFreeAttractions: rpcState.hasUnlimitedAccess
            ? MonetizationService.UNLIMITED_USAGE_LIMIT
            : Math.max(0, totalLimit - rpcState.attractionsUsed),
          attractionsUsed: rpcState.attractionsUsed,
          ownedAttractions: [],
          ownedPacks: rpcState.ownedPackages,
          ownedPackages: [],
        };
      } catch (fallbackError) {
        logger.error('Failed to get user entitlements from RPC fallback', fallbackError);
        return {
          hasUnlimitedAccess: false,
          totalAttractionLimit: 2,
          remainingFreeAttractions: 2,
          attractionsUsed: 0,
          ownedAttractions: [],
          ownedPacks: [],
          ownedPackages: [],
        };
      }
    }
  }

  async recordAttractionUsage(userId: string, attractionId: string): Promise<void> {
    if (!userId || !attractionId) {
      logger.warn('Skipping attraction usage recording: missing userId or attractionId');
      return;
    }

    const v2Result = await monetizationRpcContract.recordAttractionUsageV2(userId, attractionId);
    if (v2Result) {
      logger.info('Attraction usage handled via RPC v2', {
        recorded: v2Result.recorded,
        reason: v2Result.reason,
        totalAttractionLimit: v2Result.totalAttractionLimit,
        attractionsUsed: v2Result.attractionsUsed,
        attractionsRemaining: v2Result.attractionsRemaining,
      });
      return;
    }

    logger.warn('record_attraction_usage_v2 unavailable; using legacy fallback path');

    try {
      const subscription = await this.getSubscriptionStatus(userId);
      if (subscription.isActive && subscription.type !== 'free') {
        return;
      }

      const { data: entitlementsData, error: entitlementsError } = await supabase.rpc(
        'get_user_package_entitlements',
        { user_uuid: userId }
      );

      if (entitlementsError) {
        logger.error('Failed to get user entitlements', entitlementsError);
        return;
      }

      const entitlements = entitlementsData?.[0];
      if (!entitlements) {
        logger.error('No entitlements found for user', { userId });
        return;
      }

      const actualLimit = this.parseNumber(entitlements.total_attraction_limit, 2);
      const currentCount = this.parseNumber(entitlements.attractions_used, 0);
      const newCount = currentCount + 1;

      if (newCount > actualLimit) {
        logger.info('Skipping usage update: user is at entitlement limit', {
          userId,
          actualLimit,
          currentCount,
        });
        return;
      }

      const { data: currentUsage, error: fetchError } = await supabase
        .from('user_usage')
        .select('usage_count')
        .eq('user_id', userId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        logger.error('Failed to fetch user_usage', fetchError);
      }

      if (currentUsage) {
        const { error: updateError } = await supabase
          .from('user_usage')
          .update({
            usage_count: newCount,
            package_usage_count: newCount,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        if (updateError) {
          logger.error('Failed to update user_usage', updateError);
        } else {
          logger.info('Updated attraction usage count in fallback path', {
            userId,
            usageCount: newCount,
            limit: actualLimit,
          });
        }
      } else {
        const { error: insertError } = await supabase
          .from('user_usage')
          .insert({
            user_id: userId,
            usage_count: newCount,
            package_usage_count: newCount,
            updated_at: new Date().toISOString(),
          });

        if (insertError) {
          logger.error('Failed to insert user_usage', insertError);
        } else {
          logger.info('Created new usage record in fallback path', {
            userId,
            usageCount: newCount,
            limit: actualLimit,
          });
        }
      }
    } catch (error: unknown) {
      logger.error('Failed to record attraction usage', error);
    }
  }

  async resetUserAttractionUsage(userId: string): Promise<void> {
    try {
      const { data: existingUsage } = await supabase
        .from('user_usage')
        .select('usage_count, package_limit')
        .eq('user_id', userId)
        .single();

      if (existingUsage) {
        const { error: updateError } = await supabase
          .from('user_usage')
          .update({
            usage_count: 0,
            package_usage_count: 0,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        if (updateError) {
          logger.error('Failed to reset user attraction usage', updateError);
        } else {
          logger.info('Reset attraction usage', {
            userId,
            previousUsageCount: existingUsage.usage_count,
          });
        }
      } else {
        const { error: insertError } = await supabase
          .from('user_usage')
          .insert({
            user_id: userId,
            usage_count: 0,
            package_usage_count: 0,
            package_limit: 2,
            updated_at: new Date().toISOString(),
          });

        if (insertError) {
          logger.error('Failed to create user usage record', insertError);
        } else {
          logger.info('Created new user usage record', { userId });
        }
      }
    } catch (error: unknown) {
      logger.error('Failed to reset attraction usage', error);
    }
  }

  async canUserAccessAttraction(userId: string, attractionId: string): Promise<boolean> {
    try {
      const v2Access = await monetizationRpcContract.canUserAccessAttractionV2(userId, attractionId);
      if (v2Access !== null) {
        return v2Access;
      }

      logger.warn('can_user_access_attraction_v2 unavailable; falling back to legacy RPCs');

      const { data, error } = await supabase.rpc('can_user_access_attraction_with_packages', {
        user_uuid: userId,
        attraction_id: attractionId,
      });

      if (!error && data !== null) {
        return data || false;
      }

      // Fallback to legacy function
      const { data: legacyData, error: legacyError } = await supabase.rpc('can_user_access_attraction', {
        user_uuid: userId,
        attraction_id: attractionId,
      });

      if (legacyError) {
        logger.error('Failed to check attraction access', legacyError);
        return false;
      }

      return legacyData || false;
    } catch (error: unknown) {
      logger.error('Failed to check attraction access', error);
      return false;
    }
  }

  isAttractionInPack(attractionId: string, packId: string): boolean {
    return false;
  }

  // Cleanup method
  async cleanup(): Promise<void> {
    try {
      this.initialized = false;
      this.revenueCatConfigured = false;
      this.currentOfferings = null;
      logger.info('MonetizationService cleaned up successfully');
    } catch (error: unknown) {
      logger.error('Error during MonetizationService cleanup', error);
    }
  }

  dispose(): void {
    this.initialized = false;
    this.revenueCatConfigured = false;
    this.currentOfferings = null;
  }

  // Helper methods

  private findPackageByType(type: 'subscription' | 'package'): PurchasesPackage | null {
    if (!this.currentOfferings?.current) return null;

    for (const pkg of this.currentOfferings.current.availablePackages) {
      if (type === 'subscription' && this.isSubscription(pkg.product.identifier)) {
        return pkg;
      }
      if (type === 'package' && this.isPackage(pkg.product.identifier)) {
        return pkg;
      }
    }

    return null;
  }

  private findPackageById(packId: string): PurchasesPackage | null {
    if (!this.currentOfferings?.current) return null;

    return this.currentOfferings.current.availablePackages.find(
      pkg => pkg.identifier === packId || pkg.product.identifier === packId
    ) || null;
  }

  private findPackageByEntitlement(identifier: string): PurchasesPackage | null {
    if (!this.currentOfferings?.current) return null;

    const normalizedIdentifier = identifier.toLowerCase();
    const config = MonetizationService.PACKAGE_CONFIGS.find(cfg => {
      const candidates = [cfg.id, cfg.entitlementId, cfg.productId]
        .filter((value): value is string => Boolean(value))
        .map(value => value.toLowerCase());
      return candidates.includes(normalizedIdentifier);
    });

    const matchTargets = new Set<string>(
      [
        normalizedIdentifier,
        identifier,
        config?.id,
        config?.entitlementId,
        config?.productId,
      ]
        .filter((value): value is string => Boolean(value))
        .map(value => value.toLowerCase())
    );

    for (const pkg of this.currentOfferings.current.availablePackages) {
      const packageIdentifier = pkg.identifier?.toLowerCase?.() ?? '';
      const productIdentifier = pkg.product?.identifier?.toLowerCase?.() ?? '';

      if (
        (packageIdentifier && matchTargets.has(packageIdentifier)) ||
        (productIdentifier && matchTargets.has(productIdentifier))
      ) {
        return pkg;
      }
    }

    logger.warn('No RevenueCat package matched identifier', {
      identifier,
      candidates: Array.from(matchTargets),
      availablePackages: this.currentOfferings.current.availablePackages.map(pkg => ({
        identifier: pkg.identifier,
        productIdentifier: pkg.product?.identifier,
      })),
    });

    return null;
  }

  private isSubscription(productId: string): boolean {
    return productId.includes('unlimited_monthly') ||
           productId.includes('premium_monthly') ||
           productId.includes('yearly') ||
           productId.includes('lifetime');
  }

  private isPackage(productId: string): boolean {
    return productId.includes('package');
  }

  private async getSubscriptionStatusFromRpcV2(userId: string): Promise<SubscriptionStatus> {
    const state = await monetizationRpcContract.getSubscriptionStateV2(userId);
    if (!state) {
      return {
        isActive: false,
        type: 'free',
        expiresAt: null,
        inGracePeriod: false,
        inTrial: false,
        trialEndsAt: null,
      };
    }

    return {
      isActive: state.isActive,
      type: this.normalizeSubscriptionType(state.subscriptionType),
      expiresAt: this.parseDate(state.expiresAt),
      inGracePeriod: state.inGracePeriod,
      inTrial: state.inTrial,
      trialEndsAt: this.parseDate(state.trialEndsAt),
    };
  }

  private async getUserEntitlementsFromRpcV2(userId: string): Promise<{
    hasUnlimitedAccess: boolean;
    totalAttractionLimit: number;
    attractionsUsed: number;
    attractionsRemaining: number;
    ownedPackages: string[];
  }> {
    const v2Entitlements = await monetizationRpcContract.getUserEntitlementsV2(userId);
    if (v2Entitlements) {
      return {
        hasUnlimitedAccess: v2Entitlements.hasUnlimitedAccess,
        totalAttractionLimit: Math.max(0, v2Entitlements.totalAttractionLimit),
        attractionsUsed: Math.max(0, v2Entitlements.attractionsUsed),
        attractionsRemaining: Math.max(0, v2Entitlements.attractionsRemaining),
        ownedPackages: v2Entitlements.ownedPackages,
      };
    }

    logger.warn('Failed to load entitlements from RPC v2; using legacy RPC fallback');

    const { data: packageEntitlements, error: packageEntitlementsError } = await supabase.rpc(
      'get_user_package_entitlements',
      { user_uuid: userId }
    );

    if (packageEntitlementsError) {
      logger.error('Failed to load package entitlements from legacy RPC', packageEntitlementsError);
      return {
        hasUnlimitedAccess: false,
        totalAttractionLimit: 2,
        attractionsUsed: 0,
        attractionsRemaining: 2,
        ownedPackages: [],
      };
    }

    const legacyRow = Array.isArray(packageEntitlements) ? packageEntitlements[0] : packageEntitlements;
    const totalAttractionLimit = Math.max(2, this.parseNumber(legacyRow?.total_attraction_limit, 2));
    const attractionsUsed = Math.max(0, this.parseNumber(legacyRow?.attractions_used, 0));
    return {
      hasUnlimitedAccess: this.parseBoolean(legacyRow?.has_unlimited_access, false),
      totalAttractionLimit,
      attractionsUsed,
      attractionsRemaining: Math.max(0, totalAttractionLimit - attractionsUsed),
      ownedPackages: this.parseStringArray(legacyRow?.owned_packages),
    };
  }

  private normalizeSubscriptionType(rawType: string | null): SubscriptionStatus['type'] {
    switch (rawType) {
      case 'free':
      case 'unlimited_monthly':
      case 'premium_monthly':
      case 'premium_yearly':
      case 'lifetime':
        return rawType;
      default:
        if (rawType) {
          logger.warn('Unexpected subscription type from monetization contract', { rawType });
        }
        return 'free';
    }
  }

  private parseBoolean(value: unknown, fallback = false): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') return true;
      if (normalized === 'false') return false;
    }
    return fallback;
  }

  private parseDate(value: unknown): Date | null {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.valueOf())) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.valueOf())) {
        return parsed;
      }
    }
    return null;
  }

  private parseStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.filter((entry): entry is string => typeof entry === 'string');
    }
    return [];
  }

  private parseNumber(value: unknown, fallback = 0): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    if (value instanceof Number) {
      const primitive = value.valueOf();
      if (Number.isFinite(primitive)) {
        return primitive;
      }
    }
    return fallback;
  }

  private async syncCustomerInfo(customerInfo: CustomerInfo): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Sync RevenueCat customer ID to Supabase
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          revenuecat_customer_id: customerInfo.originalAppUserId,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'id',
        });

      if (error) {
        logger.error('Failed to sync RevenueCat customer ID', error);
      }
    } catch (error) {
      logger.error('Failed to sync customer info', error);
    }
  }

  // Set user ID for RevenueCat
  async setUserId(userId: string): Promise<void> {
    try {
      if (!this.revenueCatConfigured) {
        logger.warn('RevenueCat not configured, skipping setUserId');
        return;
      }
      await Purchases.logIn(userId);
      logger.info('RevenueCat user ID set', { userId });
    } catch (error) {
      logger.error('Failed to set RevenueCat user ID', error);
    }
  }

  // Log out user from RevenueCat
  async logoutUser(): Promise<void> {
    try {
      if (!this.revenueCatConfigured) {
        logger.warn('RevenueCat not configured, skipping logoutUser');
        return;
      }
      await Purchases.logOut();
      logger.info('RevenueCat user logged out');
    } catch (error) {
      logger.error('Failed to logout RevenueCat user', error);
    }
  }
}

// Export singleton instance
export const monetizationService = MonetizationService.getInstance();
