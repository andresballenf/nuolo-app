import { Platform } from 'react-native';
import * as InAppPurchases from 'expo-in-app-purchases';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  type: 'free' | 'premium_monthly' | 'premium_yearly' | 'lifetime' | 'unlimited_monthly' | null;
  expiresAt: Date | null;
  inGracePeriod: boolean;
  inTrial: boolean;
  trialEndsAt: Date | null;
}

export interface UserEntitlements {
  hasUnlimitedAccess: boolean;
  totalAttractionLimit: number;
  remainingAttractions: number;
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
  active: boolean;
}

export interface PurchaseResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

export class MonetizationService {
  private static instance: MonetizationService | null = null;
  private initialized = false;
  private products: Product[] = [];
  private isConnected = false;
  private purchaseListener: any = null;

  // Product IDs - should match store configurations
  private static readonly PRODUCT_IDS = {
    // Subscriptions
    PREMIUM_MONTHLY: Platform.select({
      ios: 'nuolo_premium_monthly',
      android: 'nuolo_premium_monthly',
      default: 'nuolo_premium_monthly'
    }),
    PREMIUM_YEARLY: Platform.select({
      ios: 'nuolo_premium_yearly',
      android: 'nuolo_premium_yearly', 
      default: 'nuolo_premium_yearly'
    }),
    LIFETIME: Platform.select({
      ios: 'nuolo_lifetime',
      android: 'nuolo_lifetime',
      default: 'nuolo_lifetime'
    }),
    // New unlimited monthly subscription
    UNLIMITED_MONTHLY: Platform.select({
      ios: 'nuolo_unlimited_monthly',
      android: 'nuolo_unlimited_monthly',
      default: 'nuolo_unlimited_monthly'
    }),
    // Attraction packages
    BASIC_PACKAGE: Platform.select({
      ios: 'nuolo_basic_package',
      android: 'nuolo_basic_package',
      default: 'nuolo_basic_package'
    }),
    STANDARD_PACKAGE: Platform.select({
      ios: 'nuolo_standard_package',
      android: 'nuolo_standard_package',
      default: 'nuolo_standard_package'
    }),
    PREMIUM_PACKAGE: Platform.select({
      ios: 'nuolo_premium_package',
      android: 'nuolo_premium_package',
      default: 'nuolo_premium_package'
    }),
  };

  static getInstance(): MonetizationService {
    if (!MonetizationService.instance) {
      MonetizationService.instance = new MonetizationService();
    }
    return MonetizationService.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Check if already connected before attempting to connect
      if (!this.isConnected) {
        try {
          // Initialize platform IAP
          const { responseCode } = await InAppPurchases.connectAsync();
          this.isConnected = responseCode === InAppPurchases.IAPResponseCode.OK;
        } catch (connectError: any) {
          // If already connected, treat it as success
          if (connectError?.message?.includes('Already connected')) {
            this.isConnected = true;
            console.log('IAP service was already connected');
          } else {
            throw connectError;
          }
        }

        if (!this.isConnected) {
          throw new Error('Failed to connect to in-app purchase service');
        }
      }

      // Load available products
      await this.loadProducts();
      
      // Set up purchase listener
      this.setupPurchaseListener();
      
      this.initialized = true;
      console.log('MonetizationService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize MonetizationService:', error);
      throw error;
    }
  }

  private async loadProducts(): Promise<void> {
    try {
      // Get base product IDs
      const productIds = Object.values(MonetizationService.PRODUCT_IDS).filter(Boolean) as string[];
      
      // Add dynamic pack product IDs from database (legacy packs)
      const { data: packs } = await supabase
        .from('attraction_packs')
        .select('id')
        .eq('is_active', true);
      
      if (packs) {
        productIds.push(...packs.map(pack => pack.id));
      }

      // Add new attraction package product IDs
      const { data: packages } = await supabase
        .from('attraction_packages')
        .select('apple_product_id, google_product_id')
        .eq('active', true);
      
      if (packages) {
        const platformKey = Platform.OS === 'ios' ? 'apple_product_id' : 'google_product_id';
        productIds.push(...packages.map(pkg => pkg[platformKey]));
      }

      // Fetch product details from platform store
      const { responseCode, results } = await InAppPurchases.getProductsAsync(productIds);
      
      if (responseCode === InAppPurchases.IAPResponseCode.OK && results) {
        this.products = results.map(product => ({
          productId: product.productId,
          price: product.price,
          currency: product.currency || 'USD',
          localizedPrice: product.localizedPrice,
          title: product.title,
          description: product.description,
          type: this.getProductType(product.productId),
        }));
        
        console.log(`Loaded ${this.products.length} products from store`);
      } else {
        console.warn('Failed to load products from store');
      }
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  }

  private getProductType(productId: string): 'subscription' | 'consumable' | 'non_consumable' {
    if (productId.includes('monthly') || productId.includes('yearly')) {
      return 'subscription';
    }
    if (productId.includes('pack') || productId.includes('attraction')) {
      return 'non_consumable';
    }
    return 'consumable';
  }

  private setupPurchaseListener(): void {
    this.purchaseListener = InAppPurchases.setPurchaseListener(({ responseCode, results, errorCode }) => {
      if (responseCode === InAppPurchases.IAPResponseCode.OK && results) {
        // Process completed purchases
        results.forEach(purchase => this.processPurchase(purchase));
      } else if (responseCode === InAppPurchases.IAPResponseCode.USER_CANCELED) {
        console.log('User canceled purchase');
      } else {
        console.error('Purchase error:', errorCode);
      }
    });
  }

  private async processPurchase(purchase: any): Promise<void> {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No authenticated user for purchase processing');
        return;
      }

      const productId = purchase.productId;
      const transactionId = purchase.transactionId;
      const purchaseTime = new Date(purchase.purchaseTime);

      // Determine purchase type and process accordingly
      if (this.isSubscription(productId)) {
        await this.processSubscriptionPurchase(user.id, productId, purchase);
      } else {
        await this.processOneTimePurchase(user.id, productId, purchase);
      }

      // Acknowledge purchase
      await InAppPurchases.finishTransactionAsync(purchase, true);
      
      // Store receipt locally for offline verification
      await this.storeReceiptLocally(purchase);

      console.log('Purchase processed successfully:', productId);
    } catch (error) {
      console.error('Failed to process purchase:', error);
      // Still acknowledge to prevent repeated processing
      await InAppPurchases.finishTransactionAsync(purchase, false);
    }
  }

  private isSubscription(productId: string): boolean {
    return productId.includes('monthly') || productId.includes('yearly') || productId.includes('lifetime');
  }

  private async processSubscriptionPurchase(
    userId: string,
    productId: string,
    purchase: any
  ): Promise<void> {
    const subscriptionType = this.mapProductToSubscriptionType(productId);
    const expiresAt = this.calculateExpirationDate(subscriptionType, purchase.purchaseTime);

    const { error } = await supabase.from('user_subscriptions').upsert({
      user_id: userId,
      subscription_type: subscriptionType,
      is_active: true,
      platform: Platform.OS === 'ios' ? 'apple' : 'google',
      original_transaction_id: purchase.originalTransactionId || purchase.transactionId,
      product_id: productId,
      purchase_token: purchase.purchaseToken || '',
      purchase_date: new Date(purchase.purchaseTime).toISOString(),
      expiration_date: expiresAt,
      auto_renew: true,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      throw error;
    }
  }

  private async processOneTimePurchase(
    userId: string,
    productId: string,
    purchase: any
  ): Promise<void> {
    // Check if it's a new attraction package
    const { data: attractionPackage } = await supabase
      .from('attraction_packages')
      .select('*')
      .or(`apple_product_id.eq.${productId},google_product_id.eq.${productId}`)
      .single();

    if (attractionPackage) {
      // Handle new attraction package purchase
      const { error } = await supabase.from('user_package_purchases').insert({
        user_id: userId,
        package_id: attractionPackage.id,
        platform_transaction_id: purchase.transactionId,
        purchased_at: new Date(purchase.purchaseTime).toISOString(),
      });

      if (error) {
        throw error;
      }

      // Update user's attraction limit
      await this.updateUserAttractionLimit(userId);
      return;
    }

    // Handle legacy attraction packs and single attractions
    const purchaseType = productId.startsWith('pack_') ? 'attraction_pack' : 'single_attraction';
    
    // Get item data (attraction IDs for packs)
    let itemData: any = { productId };
    if (purchaseType === 'attraction_pack') {
      const { data: pack } = await supabase
        .from('attraction_packs')
        .select('attraction_ids')
        .eq('id', productId)
        .single();
      
      if (pack) {
        itemData = { ...itemData, attractionIds: pack.attraction_ids };
      }
    }

    const { error } = await supabase.from('user_purchases').insert({
      user_id: userId,
      product_id: productId,
      platform_transaction_id: purchase.transactionId,
      purchase_type: purchaseType,
      item_data: itemData,
      purchased_at: new Date(purchase.purchaseTime).toISOString(),
    });

    if (error) {
      throw error;
    }
  }

  private mapProductToSubscriptionType(productId: string): string {
    if (productId.includes('unlimited_monthly')) return 'unlimited_monthly';
    if (productId.includes('premium_monthly')) return 'premium_monthly';
    if (productId.includes('yearly')) return 'premium_yearly';
    if (productId.includes('lifetime')) return 'lifetime';
    return 'premium_monthly';
  }

  private calculateExpirationDate(subscriptionType: string, purchaseTime: number): string {
    const purchaseDate = new Date(purchaseTime);
    
    switch (subscriptionType) {
      case 'unlimited_monthly':
      case 'premium_monthly':
        return new Date(purchaseDate.setMonth(purchaseDate.getMonth() + 1)).toISOString();
      case 'premium_yearly':
        return new Date(purchaseDate.setFullYear(purchaseDate.getFullYear() + 1)).toISOString();
      case 'lifetime':
        return new Date('2099-12-31').toISOString(); // Far future date
      default:
        return new Date(purchaseDate.setMonth(purchaseDate.getMonth() + 1)).toISOString();
    }
  }

  private async storeReceiptLocally(purchase: any): Promise<void> {
    try {
      const receipts = await AsyncStorage.getItem('purchase_receipts');
      const parsedReceipts = receipts ? JSON.parse(receipts) : [];
      parsedReceipts.push({
        ...purchase,
        storedAt: new Date().toISOString(),
      });
      await AsyncStorage.setItem('purchase_receipts', JSON.stringify(parsedReceipts));
    } catch (error) {
      console.error('Failed to store receipt locally:', error);
    }
  }

  // Public API methods

  async getAvailableProducts(): Promise<Product[]> {
    if (!this.initialized) await this.initialize();
    return this.products;
  }

  async getAttractionPacks(): Promise<AttractionPack[]> {
    const { data, error } = await supabase
      .from('attraction_packs')
      .select('*')
      .eq('is_active', true)
      .order('price_cents', { ascending: true });

    if (error) {
      console.error('Failed to fetch attraction packs:', error);
      return [];
    }

    return data || [];
  }

  async getAttractionPackages(): Promise<AttractionPackage[]> {
    const { data, error } = await supabase
      .from('attraction_packages')
      .select('*')
      .eq('active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Failed to fetch attraction packages:', error);
      return [];
    }

    return data || [];
  }

  async purchaseSubscription(subscriptionType: string): Promise<boolean> {
    try {
      if (!this.initialized) await this.initialize();
      
      const productId = this.getProductIdForSubscriptionType(subscriptionType);
      const { responseCode } = await InAppPurchases.purchaseItemAsync(productId);
      return responseCode === InAppPurchases.IAPResponseCode.OK;
    } catch (error) {
      console.error('Subscription purchase failed:', error);
      return false;
    }
  }

  async purchaseSingleAttraction(attractionId: string): Promise<boolean> {
    try {
      if (!this.initialized) await this.initialize();
      
      const productId = `attraction_${attractionId}`;
      const { responseCode } = await InAppPurchases.purchaseItemAsync(productId);
      return responseCode === InAppPurchases.IAPResponseCode.OK;
    } catch (error) {
      console.error('Attraction purchase failed:', error);
      return false;
    }
  }

  async purchaseAttractionPack(packId: string): Promise<boolean> {
    try {
      if (!this.initialized) await this.initialize();
      
      const { responseCode } = await InAppPurchases.purchaseItemAsync(packId);
      return responseCode === InAppPurchases.IAPResponseCode.OK;
    } catch (error) {
      console.error('Pack purchase failed:', error);
      return false;
    }
  }

  async restorePurchases(): Promise<void> {
    try {
      if (!this.initialized) await this.initialize();
      
      const { responseCode, results } = await InAppPurchases.getPurchaseHistoryAsync();
      
      if (responseCode === InAppPurchases.IAPResponseCode.OK && results) {
        // Process each restored purchase
        for (const purchase of results) {
          await this.processPurchase(purchase);
        }
        console.log(`Restored ${results.length} purchases`);
      }
    } catch (error) {
      console.error('Restore purchases failed:', error);
      throw error;
    }
  }

  async getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
    try {
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('expiration_date', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Failed to get subscription status:', error);
      }

      if (!data || data.length === 0) {
        return {
          isActive: false,
          type: 'free',
          expiresAt: null,
          inGracePeriod: false,
          inTrial: false,
          trialEndsAt: null,
        };
      }

      const subscription = data[0];
      const now = new Date();
      const expiresAt = subscription.expiration_date ? new Date(subscription.expiration_date) : null;
      const isActive = subscription.is_active && (!expiresAt || expiresAt > now);

      return {
        isActive,
        type: subscription.subscription_type,
        expiresAt,
        inGracePeriod: false, // Grace period not tracked in current schema
        inTrial: false, // Trial not tracked in current schema
        trialEndsAt: null,
      };
    } catch (error) {
      console.error('Failed to get subscription status:', error);
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
      // Get subscription status
      const subscription = await this.getSubscriptionStatus(userId);
      
      // Get package entitlements using new function
      const { data: packageEntitlements } = await supabase.rpc('get_user_package_entitlements', {
        user_uuid: userId
      });

      const entitlement = packageEntitlements?.[0] || {
        total_attraction_limit: 2,
        attractions_used: 0,
        remaining_attractions: 2,
        owned_packages: []
      };

      // Get owned packages details
      const { data: ownedPackages } = await supabase
        .from('attraction_packages')
        .select('*')
        .in('id', entitlement.owned_packages || [])
        .eq('active', true);

      // Get individual purchases (legacy)
      const { data: purchases } = await supabase
        .from('user_purchases')
        .select('*')
        .eq('user_id', userId);

      const ownedAttractions: string[] = [];
      const ownedPacks: string[] = [];

      if (purchases) {
        purchases.forEach(purchase => {
          if (purchase.purchase_type === 'attraction_pack') {
            ownedPacks.push(purchase.product_id);
          } else if (purchase.product_id.startsWith('attraction_')) {
            ownedAttractions.push(purchase.product_id.replace('attraction_', ''));
          }
        });
      }

      return {
        hasUnlimitedAccess: subscription.isActive && 
          ['unlimited_monthly', 'premium_monthly', 'premium_yearly', 'lifetime'].includes(subscription.type || ''),
        totalAttractionLimit: entitlement.total_attraction_limit,
        remainingAttractions: entitlement.remaining_attractions,
        attractionsUsed: entitlement.attractions_used,
        ownedAttractions: Array.from(new Set(ownedAttractions)),
        ownedPacks: Array.from(new Set(ownedPacks)),
        ownedPackages: ownedPackages || [],
      };
    } catch (error) {
      console.error('Failed to get user entitlements:', error);
      return {
        hasUnlimitedAccess: false,
        totalAttractionLimit: 2,
        remainingAttractions: 2,
        attractionsUsed: 0,
        ownedAttractions: [],
        ownedPacks: [],
        ownedPackages: [],
      };
    }
  }

  async recordAttractionUsage(userId: string, attractionId: string): Promise<void> {
    try {
      // Skip if no userId or attractionId
      if (!userId || !attractionId) {
        console.log('Skipping attraction usage recording - missing userId or attractionId');
        return;
      }

      // First check if user has an active subscription
      const subscription = await this.getSubscriptionStatus(userId);
      const accessType = (subscription && subscription.isActive && subscription.type !== 'free') 
        ? 'premium' 
        : 'free';
      
      // Skip recording for premium/unlimited users
      if (accessType === 'premium') {
        return;
      }

      // Get current usage and package limits
      const { data: currentUsage, error: fetchError } = await supabase
        .from('user_usage')
        .select('usage_count, package_limit')
        .eq('user_id', userId)
        .single();
      
      if (fetchError && fetchError.code !== 'PGRST116') {
        // PGRST116 means no rows found, which is ok for first time users
        console.error('Failed to fetch user_usage:', fetchError);
      }
      
      const currentCount = currentUsage?.usage_count || 0;
      const packageLimit = currentUsage?.package_limit || 2; // Default to free tier
      const newCount = currentCount + 1;
      
      // Don't exceed the user's package limit
      if (newCount > packageLimit) {
        console.log(`Usage would exceed package limit (${packageLimit}) for user ${userId}`);
        return;
      }
      
      // Try to update existing record first
      if (currentUsage) {
        const { error: updateError } = await supabase
          .from('user_usage')
          .update({
            usage_count: newCount,
            package_usage_count: newCount, // Track package usage separately
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);
        
        if (updateError) {
          console.error('Failed to update user_usage:', updateError);
        } else {
          console.log(`Updated attraction usage count: ${newCount}/${packageLimit} for user ${userId}`);
        }
      } else {
        // Get user's package entitlements to set correct limit
        const { data: entitlements } = await supabase.rpc('get_user_package_entitlements', {
          user_uuid: userId
        });
        const userLimit = entitlements?.[0]?.total_attraction_limit || 2;
        
        // Insert new record for first-time users
        const { error: insertError } = await supabase
          .from('user_usage')
          .insert({
            user_id: userId,
            usage_count: newCount,
            package_limit: userLimit,
            package_usage_count: newCount,
            updated_at: new Date().toISOString()
          });
        
        if (insertError) {
          console.error('Failed to insert user_usage:', insertError);
        } else {
          console.log(`Created new usage record with count: ${newCount}/${userLimit} for user ${userId}`);
        }
      }

      // Also try to call the RPC function if it exists (for compatibility)
      try {
        await supabase.rpc('track_attraction_usage', {
          p_access_type: accessType,
          p_attraction_id: attractionId,
          p_user_id: userId
        });
      } catch (rpcError: any) {
        // Ignore RPC errors silently
      }
    } catch (error) {
      console.error('Failed to record attraction usage:', error);
    }
  }

  // Development helper - reset user's free attraction counter
  async resetUserAttractionUsage(userId: string): Promise<void> {
    try {
      // First check if a record exists
      const { data: existingUsage } = await supabase
        .from('user_usage')
        .select('usage_count, package_limit')
        .eq('user_id', userId)
        .single();
      
      if (existingUsage) {
        // Update existing record to 0
        const { error: updateError } = await supabase
          .from('user_usage')
          .update({
            usage_count: 0,
            package_usage_count: 0,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);
        
        if (updateError) {
          console.error('Failed to reset user attraction usage:', updateError);
        } else {
          console.log(`Reset attraction usage from ${existingUsage.usage_count} to 0 for user ${userId}`);
        }
      } else {
        // Get user's package entitlements to set correct limit
        const { data: entitlements } = await supabase.rpc('get_user_package_entitlements', {
          user_uuid: userId
        });
        const userLimit = entitlements?.[0]?.total_attraction_limit || 2;
        
        // No record exists, create one with 0 usage
        const { error: insertError } = await supabase
          .from('user_usage')
          .insert({
            user_id: userId,
            usage_count: 0,
            package_usage_count: 0,
            package_limit: userLimit,
            updated_at: new Date().toISOString()
          });
        
        if (insertError) {
          console.error('Failed to create user usage record:', insertError);
        } else {
          console.log(`Created new usage record with 0/${userLimit} attractions for user ${userId}`);
        }
      }
    } catch (error) {
      console.error('Failed to reset attraction usage:', error);
    }
  }

  async canUserAccessAttraction(userId: string, attractionId: string): Promise<boolean> {
    try {
      // Try the new package-aware function first
      const { data, error } = await supabase.rpc('can_user_access_attraction_with_packages', {
        user_uuid: userId,
        attraction_id: attractionId
      });

      if (!error && data !== null) {
        return data || false;
      }

      // Fallback to legacy function if new one doesn't exist
      const { data: legacyData, error: legacyError } = await supabase.rpc('can_user_access_attraction', {
        user_uuid: userId,
        attraction_id: attractionId
      });

      if (legacyError) {
        console.error('Failed to check attraction access:', legacyError);
        return false;
      }

      return legacyData || false;
    } catch (error) {
      console.error('Failed to check attraction access:', error);
      return false;
    }
  }

  isAttractionInPack(attractionId: string, packId: string): boolean {
    // This would be cached/memoized in a real implementation
    // For now, return false - actual implementation would check pack data
    // TODO: Implement proper pack checking logic with caching
    return false;
  }

  // Cleanup method to disconnect from IAP service
  async cleanup(): Promise<void> {
    try {
      if (this.purchaseListener) {
        // Remove purchase listener
        this.purchaseListener = null;
      }
      
      if (this.isConnected) {
        // Disconnect from IAP service
        await InAppPurchases.disconnectAsync();
        this.isConnected = false;
      }
      
      this.initialized = false;
      this.products = [];
      console.log('MonetizationService cleaned up successfully');
    } catch (error) {
      console.error('Error during MonetizationService cleanup:', error);
    }
  }

  private getProductIdForSubscriptionType(subscriptionType: string): string {
    switch (subscriptionType) {
      case 'unlimited_monthly':
        return MonetizationService.PRODUCT_IDS.UNLIMITED_MONTHLY!;
      case 'premium_monthly':
        return MonetizationService.PRODUCT_IDS.PREMIUM_MONTHLY!;
      case 'premium_yearly':
        return MonetizationService.PRODUCT_IDS.PREMIUM_YEARLY!;
      case 'lifetime':
        return MonetizationService.PRODUCT_IDS.LIFETIME!;
      default:
        return MonetizationService.PRODUCT_IDS.UNLIMITED_MONTHLY!;
    }
  }

  // New method to purchase attraction packages
  async purchaseAttractionPackage(packageId: string): Promise<boolean> {
    try {
      if (!this.initialized) await this.initialize();
      
      // Get the package details to find the correct product ID for the platform
      const { data: packageData, error } = await supabase
        .from('attraction_packages')
        .select('apple_product_id, google_product_id')
        .eq('id', packageId)
        .single();

      if (error || !packageData) {
        console.error('Package not found:', packageId);
        return false;
      }

      const productId = Platform.OS === 'ios' 
        ? packageData.apple_product_id 
        : packageData.google_product_id;
      
      const { responseCode } = await InAppPurchases.purchaseItemAsync(productId);
      return responseCode === InAppPurchases.IAPResponseCode.OK;
    } catch (error) {
      console.error('Package purchase failed:', error);
      return false;
    }
  }

  // Helper method to update user's attraction limit after package purchase
  private async updateUserAttractionLimit(userId: string): Promise<void> {
    try {
      // Get user's highest package limit
      const { data: entitlements } = await supabase.rpc('get_user_package_entitlements', {
        user_uuid: userId
      });

      if (entitlements && entitlements.length > 0) {
        const { total_attraction_limit } = entitlements[0];
        
        // Update or insert user usage with new limit
        await supabase
          .from('user_usage')
          .upsert({
            user_id: userId,
            package_limit: total_attraction_limit,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          });
      }
    } catch (error) {
      console.error('Failed to update user attraction limit:', error);
    }
  }

  // Clean up resources
  dispose(): void {
    if (this.purchaseListener) {
      // Remove the purchase listener
      this.purchaseListener = null;
    }
    this.initialized = false;
    this.isConnected = false;
  }
}

// Export singleton instance
export const monetizationService = MonetizationService.getInstance();