import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import { storage } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

// Safely import IAP module with fallback
let InAppPurchases: any = null;
try {
  InAppPurchases = require('expo-in-app-purchases');
} catch (error) {
  console.log('In-App Purchases module not available - using mock implementation');
  // Mock implementation for when module is not available
  InAppPurchases = {
    connectAsync: async () => Promise.resolve(),
    disconnectAsync: async () => Promise.resolve(),
    getProductsAsync: async () => ({ responseCode: 0, results: [] }),
    purchaseItemAsync: async () => ({ responseCode: 1, results: [] }),
    getPurchaseHistoryAsync: async () => ({ responseCode: 0, results: [] }),
    finishTransactionAsync: async () => Promise.resolve(),
    IAPResponseCode: {
      OK: 0,
      USER_CANCELED: 1,
      ERROR: 2,
      DEFERRED: 3
    }
  };
}

export type EntitlementStatus = 'free' | 'premium' | 'unlimited';

export interface AttractionPackage {
  id: string;
  name: string;
  description: string;
  attractions: string[];
  price: number;
  localizedPrice?: string;
  popular?: boolean;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  features: string[];
  price: number;
  period: 'monthly' | 'yearly';
  localizedPrice?: string;
  discount?: string;
  popular?: boolean;
}

export interface UserEntitlements {
  status: EntitlementStatus;
  freeGuidesUsed: number;
  freeGuidesLimit: number;
  ownedPackages: string[];
  subscriptionExpiry?: Date;
  lastPurchaseDate?: Date;
  restoredPurchases: boolean;
}

export interface PurchaseError {
  code: string;
  message: string;
  userFriendly: string;
}

interface PurchaseContextType {
  // Entitlement state
  entitlements: UserEntitlements;
  isLoading: boolean;
  
  // Available products
  attractionPackages: AttractionPackage[];
  subscriptionPlans: SubscriptionPlan[];
  
  // Purchase methods
  purchasePackage: (packageId: string) => Promise<boolean>;
  purchaseSubscription: (planId: string) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  
  // Entitlement checks
  canAccessAttraction: (attractionId: string) => boolean;
  canGenerateAudioGuide: () => { canGenerate: boolean; reason?: string };
  isAttractionUnlocked: (attractionId: string) => boolean;
  
  // Paywall triggers
  showPaywall: (trigger: 'free_limit' | 'premium_attraction' | 'manual') => void;
  hidePaywall: () => void;
  paywallVisible: boolean;
  paywallTrigger?: 'free_limit' | 'premium_attraction' | 'manual';
  
  // Error handling
  purchaseError: PurchaseError | null;
  clearError: () => void;
  
  // A/B testing
  pricingVariant: 'A' | 'B';
}

const PurchaseContext = createContext<PurchaseContextType | undefined>(undefined);

// Product IDs - Match these with your App Store Connect / Google Play Console configuration
const PRODUCT_IDS = {
  // Attraction Packages
  CITY_HIGHLIGHTS: 'com.nuolo.package.city_highlights',
  MUSEUMS_BUNDLE: 'com.nuolo.package.museums',
  ARCHITECTURE_TOUR: 'com.nuolo.package.architecture',
  
  // Subscriptions
  MONTHLY_PREMIUM: 'com.nuolo.subscription.monthly',
  YEARLY_PREMIUM: 'com.nuolo.subscription.yearly',
};

const ENTITLEMENTS_KEY = 'user_entitlements';
const FREE_GUIDES_LIMIT = 2;

export function PurchaseProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  
  // State management
  const [entitlements, setEntitlements] = useState<UserEntitlements>({
    status: 'free',
    freeGuidesUsed: 0,
    freeGuidesLimit: FREE_GUIDES_LIMIT,
    ownedPackages: [],
    restoredPurchases: false,
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [paywallTrigger, setPaywallTrigger] = useState<'free_limit' | 'premium_attraction' | 'manual'>();
  const [purchaseError, setPurchaseError] = useState<PurchaseError | null>(null);
  const [pricingVariant] = useState<'A' | 'B'>(() => Math.random() > 0.5 ? 'A' : 'B');
  
  // Product data - in production, fetch from your backend
  const [attractionPackages] = useState<AttractionPackage[]>([
    {
      id: PRODUCT_IDS.CITY_HIGHLIGHTS,
      name: 'City Highlights',
      description: 'Top 15 must-see attractions in the city center',
      attractions: ['attraction_1', 'attraction_2'], // Your attraction IDs
      price: 4.99,
      popular: true,
    },
    {
      id: PRODUCT_IDS.MUSEUMS_BUNDLE,
      name: 'Museums Collection',
      description: 'Complete guides for all major museums',
      attractions: ['museum_1', 'museum_2'],
      price: 7.99,
    },
    {
      id: PRODUCT_IDS.ARCHITECTURE_TOUR,
      name: 'Architecture Tour',
      description: 'Detailed architectural history and design insights',
      attractions: ['arch_1', 'arch_2'],
      price: 5.99,
    },
  ]);
  
  const [subscriptionPlans] = useState<SubscriptionPlan[]>([
    {
      id: PRODUCT_IDS.MONTHLY_PREMIUM,
      name: 'Premium Monthly',
      description: 'Unlimited audio guides',
      features: [
        'Unlimited audio guides',
        'Offline listening',
        'Premium narration',
        'Exclusive content',
      ],
      price: 9.99,
      period: 'monthly',
    },
    {
      id: PRODUCT_IDS.YEARLY_PREMIUM,
      name: 'Premium Yearly',
      description: 'Unlimited audio guides + 40% savings',
      features: [
        'Unlimited audio guides',
        'Offline listening',
        'Premium narration',
        'Exclusive content',
        'Priority support',
      ],
      price: 59.99,
      period: 'yearly',
      discount: '40% off',
      popular: true,
    },
  ]);
  
  // Initialize In-App Purchases
  useEffect(() => {
    initializePurchases();
    return () => {
      // Only call if module is available
      if (InAppPurchases && InAppPurchases.finishTransactionAsync) {
        InAppPurchases.finishTransactionAsync().catch(() => {
          // Ignore cleanup errors
        });
      }
    };
  }, []);
  
  // Load entitlements on user change
  useEffect(() => {
    if (user) {
      loadUserEntitlements();
    } else {
      // Reset to free tier when logged out
      setEntitlements({
        status: 'free',
        freeGuidesUsed: 0,
        freeGuidesLimit: FREE_GUIDES_LIMIT,
        ownedPackages: [],
        restoredPurchases: false,
      });
    }
  }, [user?.id]);
  
  const initializePurchases = async () => {
    try {
      setIsLoading(true);
      
      // Check if IAP module is available
      if (!InAppPurchases || !InAppPurchases.connectAsync) {
        console.log('In-App Purchases not available in this environment');
        return;
      }
      
      // Connect to store - handle "Already connected" gracefully
      try {
        await InAppPurchases.connectAsync();
      } catch (connectError: any) {
        // If already connected, that's fine - continue
        if (!connectError?.message?.includes('Already connected')) {
          // If module not found, just log and continue
          if (connectError?.message?.includes('native module') || 
              connectError?.message?.includes('ExpoInAppPurchases')) {
            console.log('IAP native module not available - continuing without IAP');
            return;
          }
          throw connectError;
        }
        console.log('IAP already connected, continuing...');
      }
      
      // Get product info
      const productIds = Object.values(PRODUCT_IDS);
      const { results: products } = await InAppPurchases.getProductsAsync(productIds);
      
      // Update packages with localized prices
      const updatedPackages = attractionPackages.map(pkg => {
        const product = products?.find((p: any) => p.productId === pkg.id);
        return {
          ...pkg,
          localizedPrice: product?.price || `$${pkg.price}`,
        };
      });
      
      const updatedPlans = subscriptionPlans.map(plan => {
        const product = products?.find((p: any) => p.productId === plan.id);
        return {
          ...plan,
          localizedPrice: product?.price || `$${plan.price}`,
        };
      });
      
      console.log('In-App Purchases initialized successfully');
      console.log('Products loaded:', products?.length || 0);
      
    } catch (error) {
      console.error('Failed to initialize In-App Purchases:', error);
      // Only show error if it's not a module availability issue
      if (error instanceof Error && 
          !error.message.includes('native module') && 
          !error.message.includes('ExpoInAppPurchases')) {
        setPurchaseError({
          code: 'INIT_ERROR',
          message: error.message,
          userFriendly: 'Unable to load store information. Please try again later.',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const loadUserEntitlements = async () => {
    try {
      setIsLoading(true);
      
      // Load from local storage first for quick response
      const localEntitlements = await storage.getObject<UserEntitlements>(ENTITLEMENTS_KEY);
      if (localEntitlements) {
        setEntitlements(localEntitlements);
      }
      
      // Then sync with backend if user is authenticated
      if (user) {
        const { data: serverEntitlements } = await supabase
          .from('user_entitlements')
          .select('*')
          .eq('user_id', user.id)
          .single();
        
        if (serverEntitlements) {
          const entitlementsData: UserEntitlements = {
            status: serverEntitlements.status,
            freeGuidesUsed: serverEntitlements.free_guides_used,
            freeGuidesLimit: serverEntitlements.free_guides_limit,
            ownedPackages: serverEntitlements.owned_packages || [],
            subscriptionExpiry: serverEntitlements.subscription_expiry 
              ? new Date(serverEntitlements.subscription_expiry) 
              : undefined,
            lastPurchaseDate: serverEntitlements.last_purchase_date 
              ? new Date(serverEntitlements.last_purchase_date) 
              : undefined,
            restoredPurchases: serverEntitlements.restored_purchases || false,
          };
          
          setEntitlements(entitlementsData);
          await storage.setObject(ENTITLEMENTS_KEY, entitlementsData);
        }
      }
    } catch (error) {
      console.error('Error loading user entitlements:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const saveEntitlements = async (newEntitlements: UserEntitlements) => {
    try {
      // Save locally
      await storage.setObject(ENTITLEMENTS_KEY, newEntitlements);
      
      // Save to backend if authenticated
      if (user) {
        await supabase
          .from('user_entitlements')
          .upsert({
            user_id: user.id,
            status: newEntitlements.status,
            free_guides_used: newEntitlements.freeGuidesUsed,
            free_guides_limit: newEntitlements.freeGuidesLimit,
            owned_packages: newEntitlements.ownedPackages,
            subscription_expiry: newEntitlements.subscriptionExpiry?.toISOString(),
            last_purchase_date: newEntitlements.lastPurchaseDate?.toISOString(),
            restored_purchases: newEntitlements.restoredPurchases,
            updated_at: new Date().toISOString(),
          });
      }
    } catch (error) {
      console.error('Error saving entitlements:', error);
    }
  };
  
  const purchasePackage = useCallback(async (packageId: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setPurchaseError(null);
      
      const { responseCode, results } = await InAppPurchases.purchaseItemAsync(packageId);
      
      if (responseCode === InAppPurchases.IAPResponseCode.OK) {
        // Purchase successful - update entitlements
        const newEntitlements = {
          ...entitlements,
          ownedPackages: [...entitlements.ownedPackages, packageId],
          lastPurchaseDate: new Date(),
        };
        
        setEntitlements(newEntitlements);
        await saveEntitlements(newEntitlements);
        
        // Close paywall
        setPaywallVisible(false);
        
        return true;
      } else {
        throw new Error(`Purchase failed with code: ${responseCode}`);
      }
    } catch (error) {
      console.error('Package purchase failed:', error);
      
      setPurchaseError({
        code: 'PURCHASE_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
        userFriendly: 'Purchase failed. Please try again or contact support.',
      });
      
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [entitlements]);
  
  const purchaseSubscription = useCallback(async (planId: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setPurchaseError(null);
      
      const { responseCode } = await InAppPurchases.purchaseItemAsync(planId);
      
      if (responseCode === InAppPurchases.IAPResponseCode.OK) {
        // Calculate expiry date
        const plan = subscriptionPlans.find(p => p.id === planId);
        const expiryDate = new Date();
        if (plan?.period === 'yearly') {
          expiryDate.setFullYear(expiryDate.getFullYear() + 1);
        } else {
          expiryDate.setMonth(expiryDate.getMonth() + 1);
        }
        
        const newEntitlements = {
          ...entitlements,
          status: 'unlimited' as EntitlementStatus,
          subscriptionExpiry: expiryDate,
          lastPurchaseDate: new Date(),
        };
        
        setEntitlements(newEntitlements);
        await saveEntitlements(newEntitlements);
        
        // Close paywall
        setPaywallVisible(false);
        
        return true;
      } else {
        throw new Error(`Subscription purchase failed with code: ${responseCode}`);
      }
    } catch (error) {
      console.error('Subscription purchase failed:', error);
      
      setPurchaseError({
        code: 'SUBSCRIPTION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
        userFriendly: 'Subscription failed. Please try again or contact support.',
      });
      
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [entitlements, subscriptionPlans]);
  
  const restorePurchases = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      setPurchaseError(null);
      
      const { responseCode, results } = await InAppPurchases.getPurchaseHistoryAsync();
      
      if (responseCode === InAppPurchases.IAPResponseCode.OK && results) {
        const validPurchases = results.filter(purchase => 
          Object.values(PRODUCT_IDS).includes(purchase.productId)
        );
        
        if (validPurchases.length > 0) {
          // Determine new entitlements based on restored purchases
          const ownedPackages: string[] = [];
          let subscriptionExpiry: Date | undefined;
          let status: EntitlementStatus = entitlements.status;
          
          validPurchases.forEach(purchase => {
            if (purchase.productId === PRODUCT_IDS.MONTHLY_PREMIUM) {
              status = 'unlimited';
              subscriptionExpiry = new Date(purchase.purchaseTime + 30 * 24 * 60 * 60 * 1000);
            } else if (purchase.productId === PRODUCT_IDS.YEARLY_PREMIUM) {
              status = 'unlimited';
              subscriptionExpiry = new Date(purchase.purchaseTime + 365 * 24 * 60 * 60 * 1000);
            } else {
              ownedPackages.push(purchase.productId);
              if (ownedPackages.length > 0) {
                status = 'premium';
              }
            }
          });
          
          const newEntitlements = {
            ...entitlements,
            status,
            ownedPackages,
            subscriptionExpiry,
            restoredPurchases: true,
          };
          
          setEntitlements(newEntitlements);
          await saveEntitlements(newEntitlements);
          
          Alert.alert(
            'Purchases Restored',
            `Successfully restored ${validPurchases.length} purchase(s).`
          );
          
          return true;
        } else {
          Alert.alert(
            'No Purchases Found',
            'No previous purchases were found to restore.'
          );
          return false;
        }
      } else {
        throw new Error(`Restore failed with code: ${responseCode}`);
      }
    } catch (error) {
      console.error('Restore purchases failed:', error);
      
      setPurchaseError({
        code: 'RESTORE_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
        userFriendly: 'Failed to restore purchases. Please try again.',
      });
      
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [entitlements]);
  
  // Entitlement check functions
  const canAccessAttraction = useCallback((attractionId: string): boolean => {
    if (entitlements.status === 'unlimited') return true;
    
    // Check if attraction is in owned packages
    return entitlements.ownedPackages.some(packageId => {
      const pkg = attractionPackages.find(p => p.id === packageId);
      return pkg?.attractions.includes(attractionId) || false;
    });
  }, [entitlements, attractionPackages]);
  
  const canGenerateAudioGuide = useCallback((): { canGenerate: boolean; reason?: string } => {
    // Unlimited subscribers can always generate
    if (entitlements.status === 'unlimited') {
      return { canGenerate: true };
    }
    
    // Check free limit
    if (entitlements.freeGuidesUsed < entitlements.freeGuidesLimit) {
      return { canGenerate: true };
    }
    
    return {
      canGenerate: false,
      reason: `You've used ${entitlements.freeGuidesUsed}/${entitlements.freeGuidesLimit} free guides.`,
    };
  }, [entitlements]);
  
  const isAttractionUnlocked = useCallback((attractionId: string): boolean => {
    return canAccessAttraction(attractionId) || canGenerateAudioGuide().canGenerate;
  }, [canAccessAttraction, canGenerateAudioGuide]);
  
  // Paywall management
  const showPaywall = useCallback((trigger: 'free_limit' | 'premium_attraction' | 'manual') => {
    setPaywallTrigger(trigger);
    setPaywallVisible(true);
  }, []);
  
  const hidePaywall = useCallback(() => {
    setPaywallVisible(false);
    setPaywallTrigger(undefined);
  }, []);
  
  const clearError = useCallback(() => {
    setPurchaseError(null);
  }, []);
  
  return (
    <PurchaseContext.Provider
      value={{
        entitlements,
        isLoading,
        attractionPackages,
        subscriptionPlans,
        purchasePackage,
        purchaseSubscription,
        restorePurchases,
        canAccessAttraction,
        canGenerateAudioGuide,
        isAttractionUnlocked,
        showPaywall,
        hidePaywall,
        paywallVisible,
        paywallTrigger,
        purchaseError,
        clearError,
        pricingVariant,
      }}
    >
      {children}
    </PurchaseContext.Provider>
  );
}

export function usePurchase() {
  const context = useContext(PurchaseContext);
  if (context === undefined) {
    throw new Error('usePurchase must be used within a PurchaseProvider');
  }
  return context;
}