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
  type: 'free' | 'premium_monthly' | 'premium_yearly' | 'lifetime' | null;
  expiresAt: Date | null;
  inGracePeriod: boolean;
  inTrial: boolean;
  trialEndsAt: Date | null;
}

export interface UserEntitlements {
  hasUnlimitedAccess: boolean;
  remainingFreeAttractions: number;
  ownedAttractions: string[];
  ownedPacks: string[];
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
      
      // Add dynamic pack product IDs from database
      const { data: packs } = await supabase
        .from('attraction_packs')
        .select('id')
        .eq('is_active', true);
      
      if (packs) {
        productIds.push(...packs.map(pack => pack.id));
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
      purchase_token: purchase.purchaseToken || '',
      transaction_id: purchase.transactionId,
      purchase_date: new Date(purchase.purchaseTime).toISOString(),
      platform: Platform.OS === 'ios' ? 'apple' : 'google',
      attraction_package_id: purchaseType === 'attraction_pack' ? productId : '',
      quantity: 1,
      created_at: new Date().toISOString(),
    });

    if (error) {
      throw error;
    }
  }

  private mapProductToSubscriptionType(productId: string): string {
    if (productId.includes('monthly')) return 'premium_monthly';
    if (productId.includes('yearly')) return 'premium_yearly';
    if (productId.includes('lifetime')) return 'lifetime';
    return 'premium_monthly';
  }

  private calculateExpirationDate(subscriptionType: string, purchaseTime: number): string {
    const purchaseDate = new Date(purchaseTime);
    
    switch (subscriptionType) {
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
      
      // Get individual purchases
      const { data: purchases } = await supabase
        .from('user_purchases')
        .select('*')
        .eq('user_id', userId);

      // Get usage data
      const { data: usage } = await supabase
        .from('user_usage')
        .select('*')
        .eq('user_id', userId)
        .single();

      const ownedAttractions: string[] = [];
      const ownedPacks: string[] = [];

      if (purchases) {
        purchases.forEach(purchase => {
          // Check if it's a pack purchase
          if (purchase.attraction_package_id) {
            ownedPacks.push(purchase.attraction_package_id);
            // Get attraction IDs from the pack
            // This would need to be fetched from attraction_packs table
          } else if (purchase.product_id.startsWith('attraction_')) {
            // Single attraction purchase
            ownedAttractions.push(purchase.product_id.replace('attraction_', ''));
          }
        });
      }

      const usedCount = usage?.attractions_used || 0;
      const remainingFree = Math.max(0, 2 - usedCount);

      return {
        hasUnlimitedAccess: subscription.isActive && subscription.type !== 'free',
        remainingFreeAttractions: remainingFree,
        ownedAttractions: Array.from(new Set(ownedAttractions)),
        ownedPacks: Array.from(new Set(ownedPacks)),
      };
    } catch (error) {
      console.error('Failed to get user entitlements:', error);
      return {
        hasUnlimitedAccess: false,
        remainingFreeAttractions: 2, // Default to full free tier
        ownedAttractions: [],
        ownedPacks: [],
      };
    }
  }

  async recordAttractionUsage(userId: string, attractionId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('record_attraction_usage', {
        user_uuid: userId,
        attraction_id: attractionId
      });

      if (error) {
        console.error('Failed to record attraction usage:', error);
      }
    } catch (error) {
      console.error('Failed to record attraction usage:', error);
    }
  }

  async canUserAccessAttraction(userId: string, attractionId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('can_user_access_attraction', {
        user_uuid: userId,
        attraction_id: attractionId
      });

      if (error) {
        console.error('Failed to check attraction access:', error);
        return false;
      }

      return data || false;
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
      case 'premium_monthly':
        return MonetizationService.PRODUCT_IDS.PREMIUM_MONTHLY!;
      case 'premium_yearly':
        return MonetizationService.PRODUCT_IDS.PREMIUM_YEARLY!;
      case 'lifetime':
        return MonetizationService.PRODUCT_IDS.LIFETIME!;
      default:
        return MonetizationService.PRODUCT_IDS.PREMIUM_MONTHLY!;
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