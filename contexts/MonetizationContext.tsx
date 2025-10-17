import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { monetizationService, SubscriptionStatus, UserEntitlements, AttractionPack, AttractionPackage } from '../services/MonetizationService';
import { useAuth } from './AuthContext';

export interface MonetizationState {
  subscription: SubscriptionStatus;
  entitlements: UserEntitlements;
  loading: boolean;
  error: string | null;
  initialized: boolean;
  
  // Product data
  attractionPacks: AttractionPack[];
  attractionPackages: AttractionPackage[];
  
  // Actions
  purchaseAttraction: (attractionId: string) => Promise<boolean>;
  purchasePack: (packId: string) => Promise<boolean>;
  purchaseAttractionPackage?: (packageId: string) => Promise<boolean>;
  purchaseSubscription: () => Promise<boolean>;
  restorePurchases: () => Promise<void>;
  refreshEntitlements: () => Promise<void>;
  
  // Content access
  canAccessAttraction: (attractionId: string) => Promise<boolean>;
  recordAttractionUsage: (attractionId: string) => Promise<void>;
  
  // Paywall
  showPaywall: boolean;
  setShowPaywall: (show: boolean) => void;
  paywallContext?: {
    trigger: 'free_limit' | 'premium_attraction' | 'manual';
    attractionId?: string;
    attractionName?: string;
  };
}

const MonetizationContext = createContext<MonetizationState | undefined>(undefined);

export function MonetizationProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  
  const [subscription, setSubscription] = useState<SubscriptionStatus>({
    isActive: false,
    type: 'free',
    expiresAt: null,
    inGracePeriod: false,
    inTrial: false,
    trialEndsAt: null,
  });
  
  const [entitlements, setEntitlements] = useState<UserEntitlements>({
    hasUnlimitedAccess: false,
    totalAttractionLimit: 2,
    remainingFreeAttractions: 2,
    attractionsUsed: 0,
    ownedAttractions: [],
    ownedPacks: [],
    ownedPackages: [],
  });
  
  const [attractionPacks, setAttractionPacks] = useState<AttractionPack[]>([]);
  const [attractionPackages, setAttractionPackages] = useState<AttractionPackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallContext, setPaywallContext] = useState<{
    trigger: 'free_limit' | 'premium_attraction' | 'manual';
    attractionId?: string;
    attractionName?: string;
  }>();

  // Initialize monetization service when user authenticates
  useEffect(() => {
    if (isAuthenticated && user) {
      // Initialize first, then set user ID after initialization completes
      initializeMonetization().then(() => {
        // Only set user ID AFTER initialization completes
        monetizationService.setUserId(user.id).catch(error => {
          console.error('Failed to set RevenueCat user ID:', error);
        });
      }).catch(error => {
        console.error('Monetization initialization failed:', error);
      });
    } else {
      resetToFreeState();
      // Only log out if RevenueCat is initialized
      monetizationService.logoutUser().catch(error => {
        console.error('Failed to logout RevenueCat user:', error);
      });
    }
  }, [isAuthenticated, user]);

  // Cleanup on unmount to prevent "Already connected" errors
  useEffect(() => {
    return () => {
      // Cleanup monetization service when component unmounts
      monetizationService.cleanup().catch(error => {
        console.error('Error cleaning up monetization service:', error);
      });
    };
  }, []);

  const initializeMonetization = async () => {
    if (initialized) return;

    setLoading(true);
    setError(null);

    try {
      // Initialize RevenueCat first
      await monetizationService.initialize();

      // Load product data (doesn't require RevenueCat to be fully ready)
      await Promise.all([
        loadAttractionPacks(),
        loadAttractionPackages(),
      ]);

      setInitialized(true);
      console.log('MonetizationProvider initialized successfully');

      // Refresh entitlements AFTER initialization is complete
      if (user) {
        await refreshEntitlements();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize monetization';
      setError(errorMessage);
      console.error('MonetizationProvider initialization failed:', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const loadAttractionPacks = async () => {
    try {
      const packs = await monetizationService.getAttractionPacks();
      setAttractionPacks(packs);
    } catch (err) {
      console.error('Failed to load attraction packs:', err);
    }
  };

  const loadAttractionPackages = async () => {
    try {
      const packages = await monetizationService.getAttractionPackages();
      setAttractionPackages(packages);
    } catch (err) {
      console.error('Failed to load attraction packages:', err);
    }
  };

  const refreshEntitlements = useCallback(async () => {
    if (!user) return;
    
    try {
      const [subStatus, userEntitlements] = await Promise.all([
        monetizationService.getSubscriptionStatus(user.id),
        monetizationService.getUserEntitlements(user.id),
      ]);
      
      setSubscription(subStatus);
      setEntitlements(userEntitlements);
      
      console.log('Entitlements refreshed:', {
        subscription: subStatus,
        entitlements: userEntitlements,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh entitlements';
      setError(errorMessage);
      console.error('Failed to refresh entitlements:', errorMessage);
    }
  }, [user]);

  const resetToFreeState = () => {
    setSubscription({
      isActive: false,
      type: 'free',
      expiresAt: null,
      inGracePeriod: false,
      inTrial: false,
      trialEndsAt: null,
    });
    
    setEntitlements({
      hasUnlimitedAccess: false,
      totalAttractionLimit: 2,
      remainingFreeAttractions: 2,
      attractionsUsed: 0,
      ownedAttractions: [],
      ownedPacks: [],
      ownedPackages: [],
    });
    
    setAttractionPacks([]);
    setAttractionPackages([]);
    setInitialized(false);
    setError(null);
  };

  const purchaseAttraction = useCallback(async (attractionId: string): Promise<boolean> => {
    if (!user) {
      setError('User must be authenticated to make purchases');
      return false;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const success = await monetizationService.purchaseSingleAttraction(attractionId);
      if (success) {
        await refreshEntitlements();
        setShowPaywall(false); // Close paywall on successful purchase
        console.log('Successfully purchased attraction:', attractionId);
      }
      return success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Purchase failed';
      setError(errorMessage);
      console.error('Attraction purchase failed:', errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [user, refreshEntitlements]);

  const purchasePack = useCallback(async (packId: string): Promise<boolean> => {
    if (!user) {
      setError('User must be authenticated to make purchases');
      return false;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const success = await monetizationService.purchaseAttractionPack(packId);
      if (success) {
        await refreshEntitlements();
        setShowPaywall(false); // Close paywall on successful purchase
        console.log('Successfully purchased pack:', packId);
      }
      return success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Purchase failed';
      setError(errorMessage);
      console.error('Pack purchase failed:', errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [user, refreshEntitlements]);

  const purchaseSubscription = useCallback(async (): Promise<boolean> => {
    if (!user) {
      setError('User must be authenticated to make purchases');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      // Only unlimited_monthly subscription is available
      const success = await monetizationService.purchaseSubscription('unlimited_monthly');
      if (success) {
        await refreshEntitlements();
        setShowPaywall(false); // Close paywall on successful purchase
        console.log('Successfully purchased unlimited monthly subscription');
      }
      return success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Subscription purchase failed';
      setError(errorMessage);
      console.error('Subscription purchase failed:', errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [user, refreshEntitlements]);

  const purchaseAttractionPackage = useCallback(async (packageId: string): Promise<boolean> => {
    if (!user) {
      setError('User must be authenticated to make purchases');
      return false;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const success = await monetizationService.purchaseAttractionPackage(packageId);
      if (success) {
        await refreshEntitlements();
        setShowPaywall(false); // Close paywall on successful purchase
        console.log('Successfully purchased package:', packageId);
      }
      return success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Package purchase failed';
      setError(errorMessage);
      console.error('Package purchase failed:', errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [user, refreshEntitlements]);

  const restorePurchases = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      await monetizationService.restorePurchases();
      await refreshEntitlements();
      console.log('Purchases restored successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Restore failed';
      setError(errorMessage);
      console.error('Restore purchases failed:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [refreshEntitlements]);

  const canAccessAttraction = useCallback(async (attractionId: string): Promise<boolean> => {
    if (!user) return false;
    
    try {
      return await monetizationService.canUserAccessAttraction(user.id, attractionId);
    } catch (err) {
      console.error('Failed to check attraction access:', err);
      return false;
    }
  }, [user]);

  const recordAttractionUsage = useCallback(async (attractionId: string): Promise<void> => {
    if (!user) return;

    // Only record usage for free tier users (not unlimited subscribers)
    const hasUnlimitedAccess = subscription.isActive && subscription.type === 'unlimited_monthly';
    // Legacy subscriptions also get unlimited access
    const hasLegacySubscription = subscription.isActive &&
      ['premium_monthly', 'premium_yearly', 'lifetime'].includes(subscription.type || '');
    if (hasUnlimitedAccess || hasLegacySubscription) return;
    
    try {
      await monetizationService.recordAttractionUsage(user.id, attractionId);
      // Refresh entitlements to update remaining free attractions count
      await refreshEntitlements();
      console.log('Recorded attraction usage:', attractionId);
    } catch (err) {
      console.error('Failed to record attraction usage:', err);
    }
  }, [user, subscription.isActive, subscription.type, refreshEntitlements]);

  // Enhanced setShowPaywall function that accepts context
  const setShowPaywallWithContext = useCallback((show: boolean, context?: {
    trigger: 'free_limit' | 'premium_attraction' | 'manual';
    attractionId?: string;
    attractionName?: string;
  }) => {
    setShowPaywall(show);
    if (show && context) {
      setPaywallContext(context);
    } else {
      setPaywallContext(undefined);
    }
  }, []);

  // Development helper - reset free counter
  const resetFreeCounter = useCallback(async () => {
    if (!user) return;
    
    try {
      await monetizationService.resetUserAttractionUsage(user.id);
      await refreshEntitlements();
      console.log('Free counter reset successfully');
    } catch (err) {
      console.error('Failed to reset free counter:', err);
    }
  }, [user, refreshEntitlements]);

  const contextValue: MonetizationState = {
    subscription,
    entitlements,
    loading,
    error,
    initialized,
    attractionPacks,
    attractionPackages,
    purchaseAttraction,
    purchasePack,
    purchaseAttractionPackage,
    purchaseSubscription,
    restorePurchases,
    refreshEntitlements,
    canAccessAttraction,
    recordAttractionUsage,
    showPaywall,
    setShowPaywall: setShowPaywallWithContext,
    paywallContext,
    // @ts-ignore - Development only
    resetFreeCounter: __DEV__ ? resetFreeCounter : undefined,
  };

  return (
    <MonetizationContext.Provider value={contextValue}>
      {children}
    </MonetizationContext.Provider>
  );
}

export function useMonetization() {
  const context = useContext(MonetizationContext);
  if (context === undefined) {
    throw new Error('useMonetization must be used within a MonetizationProvider');
  }
  return context;
}

// Helper hook for checking content access
export function useContentAccess() {
  const { entitlements, subscription, canAccessAttraction, recordAttractionUsage } = useMonetization();

  const checkAttractionAccess = async (attractionId: string): Promise<{
    hasAccess: boolean;
    reason: 'premium' | 'owned' | 'free_remaining' | 'blocked';
    message?: string;
  }> => {
    // Unlimited subscribers have unlimited access
    if (subscription.isActive && subscription.type === 'unlimited_monthly') {
      return { hasAccess: true, reason: 'premium' };
    }

    // Legacy subscription holders also have unlimited access
    if (subscription.isActive &&
        ['premium_monthly', 'premium_yearly', 'lifetime'].includes(subscription.type || '')) {
      return { hasAccess: true, reason: 'premium' };
    }

    // Check if user has package access
    if (entitlements.totalAttractionLimit > 2 && entitlements.attractionsUsed < entitlements.totalAttractionLimit) {
      return { hasAccess: true, reason: 'owned' };
    }

    // Check if user owns this specific attraction
    if (entitlements.ownedAttractions.includes(attractionId)) {
      return { hasAccess: true, reason: 'owned' };
    }

    // Check free tier allowance
    if (entitlements.remainingFreeAttractions > 0) {
      return { hasAccess: true, reason: 'free_remaining' };
    }

    // Blocked - show upgrade options
    return {
      hasAccess: false,
      reason: 'blocked',
      message: 'Upgrade to premium for unlimited access, or purchase this attraction individually.'
    };
  };

  const generateAudioGuideWithValidation = async (attractionId: string, attractionName?: string): Promise<{
    canGenerate: boolean;
    shouldShowPaywall: boolean;
    shouldRecordUsage: boolean;
    paywallContext?: {
      trigger: 'free_limit' | 'premium_attraction';
      attractionId: string;
      attractionName?: string;
    };
  }> => {
    const accessResult = await checkAttractionAccess(attractionId);
    
    if (accessResult.hasAccess) {
      return {
        canGenerate: true,
        shouldShowPaywall: false,
        shouldRecordUsage: accessResult.reason === 'free_remaining',
      };
    } else {
      // Determine paywall trigger based on reason
      const trigger = entitlements.remainingFreeAttractions === 0 ? 'free_limit' : 'premium_attraction';
      
      return {
        canGenerate: false,
        shouldShowPaywall: true,
        shouldRecordUsage: false,
        paywallContext: {
          trigger,
          attractionId,
          attractionName,
        },
      };
    }
  };

  return {
    checkAttractionAccess,
    generateAudioGuideWithValidation,
    entitlements,
    subscription,
  };
}