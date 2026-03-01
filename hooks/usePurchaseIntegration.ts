import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { useMonetization, useContentAccess } from '../contexts/MonetizationContext';
import { useAudio } from '../contexts/AudioContext';
import type { PointOfInterest } from '../services/GooglePlacesService';
import { logger } from '../lib/logger';

type AttractionAction = 'play' | 'generate' | 'upgrade';
type PaywallTrigger = 'free_limit' | 'premium_attraction' | 'manual';

interface AttractionCTA {
  text: string;
  action: AttractionAction;
  variant: 'primary' | 'outline';
  disabled: boolean;
}

interface LegacyEntitlements {
  status: 'free' | 'premium' | 'unlimited';
  freeGuidesUsed: number;
  freeGuidesLimit: number;
  ownedPackages: string[];
  subscriptionExpiry?: Date;
  lastPurchaseDate?: Date;
  restoredPurchases: boolean;
}

const LEGACY_SUBSCRIPTION_PLANS = [
  {
    id: 'unlimited_monthly',
    name: 'Unlimited Monthly',
    description: 'Unlimited audio guides',
    features: ['Unlimited audio guides'],
    price: 9.99,
    period: 'monthly' as const,
  },
];

let hasLoggedLegacyHookWarning = false;

const deriveLegacyEntitlements = (
  hasUnlimitedAccess: boolean,
  totalAttractionLimit: number,
  attractionsUsed: number,
  ownedPackageIds: string[],
  subscriptionExpiry: Date | null,
  lastPurchaseDate?: Date | null,
): LegacyEntitlements => {
  const hasPaidCredits = totalAttractionLimit > 2 || ownedPackageIds.length > 0;
  const status: LegacyEntitlements['status'] = hasUnlimitedAccess
    ? 'unlimited'
    : hasPaidCredits
      ? 'premium'
      : 'free';

  return {
    status,
    freeGuidesUsed: attractionsUsed,
    freeGuidesLimit: totalAttractionLimit,
    ownedPackages: ownedPackageIds,
    subscriptionExpiry: subscriptionExpiry ?? undefined,
    lastPurchaseDate: lastPurchaseDate ?? undefined,
    restoredPurchases: false,
  };
};

/**
 * @deprecated Runtime paywall flow is RevenueCatPaywallModal + MonetizationContext.
 * Compatibility hook kept only for legacy/example surfaces.
 */
export const usePurchaseIntegration = () => {
  const monetization = useMonetization();
  const contentAccess = useContentAccess();
  const { generateAudioGuide, isGeneratingAudio } = useAudio();

  useEffect(() => {
    if (hasLoggedLegacyHookWarning) return;
    hasLoggedLegacyHookWarning = true;
    logger.warn(
      'usePurchaseIntegration is deprecated. Use MonetizationContext and RevenueCatPaywallModal in runtime flows.'
    );
  }, []);

  const hasUnlimitedAccess =
    monetization.subscription.isActive &&
    ['unlimited_monthly', 'premium_monthly', 'premium_yearly', 'lifetime'].includes(
      monetization.subscription.type || '',
    );

  const totalAttractionLimit = monetization.entitlements.totalAttractionLimit ?? 2;
  const attractionsUsed = monetization.entitlements.attractionsUsed ?? 0;
  const remainingCredits = Math.max(0, totalAttractionLimit - attractionsUsed);

  const ownedPackageIds = (monetization.entitlements.ownedPackages || []).map(pkg => {
    return pkg.id || pkg.apple_product_id || pkg.google_product_id || pkg.name;
  });

  const legacyEntitlements = useMemo(
    () =>
      deriveLegacyEntitlements(
        hasUnlimitedAccess,
        totalAttractionLimit,
        attractionsUsed,
        ownedPackageIds,
        monetization.subscription.expiresAt,
        null,
      ),
    [
      hasUnlimitedAccess,
      totalAttractionLimit,
      attractionsUsed,
      ownedPackageIds,
      monetization.subscription.expiresAt,
    ],
  );

  const canGenerateAudioGuide = useCallback(() => {
    if (hasUnlimitedAccess) {
      return { canGenerate: true };
    }

    if (remainingCredits > 0) {
      return { canGenerate: true };
    }

    return {
      canGenerate: false,
      reason: 'free_limit_reached',
    };
  }, [hasUnlimitedAccess, remainingCredits]);

  const isAttractionUnlocked = useCallback(
    (attractionId: string): boolean => {
      if (hasUnlimitedAccess) return true;
      if ((monetization.entitlements.ownedAttractions || []).includes(attractionId)) return true;
      return remainingCredits > 0;
    },
    [hasUnlimitedAccess, monetization.entitlements.ownedAttractions, remainingCredits],
  );

  const canAccessAttraction = useCallback(
    (attractionId: string): boolean => {
      return isAttractionUnlocked(attractionId);
    },
    [isAttractionUnlocked],
  );

  const showPaywall = useCallback(
    (trigger: PaywallTrigger) => {
      monetization.setShowPaywall(true, { trigger });
    },
    [monetization],
  );

  /**
   * Attempts to generate an audio guide with monetization validation.
   */
  const generateAudioGuideWithValidation = useCallback(
    async (
      attraction: PointOfInterest,
      options?: {
        language?: string;
        audioLength?: 'short' | 'medium' | 'deep-dive';
        voiceStyle?: 'casual' | 'formal' | 'energetic' | 'calm';
      },
    ) => {
      try {
        const validation = await contentAccess.generateAudioGuideWithValidation(
          attraction.id,
          attraction.name,
        );

        if (!validation.canGenerate) {
          if (validation.shouldShowPaywall) {
            monetization.setShowPaywall(true, validation.paywallContext);
          }
          return false;
        }

        const success = await generateAudioGuide(attraction, options);
        if (success && validation.shouldRecordUsage) {
          await monetization.recordAttractionUsage(attraction.id);
        }

        return success;
      } catch (error) {
        console.error('Audio guide generation with validation failed:', error);
        Alert.alert('Error', 'Failed to generate audio guide. Please try again.');
        return false;
      }
    },
    [contentAccess, monetization, generateAudioGuide],
  );

  /**
   * Checks if an attraction is available for the current user.
   */
  const checkAttractionAccess = useCallback(
    (attractionId: string) => {
      const hasAccess = canAccessAttraction(attractionId);
      const canGenerate = canGenerateAudioGuide().canGenerate;

      return {
        hasAccess,
        canGenerate,
        isUnlocked: hasAccess || canGenerate,
        requiresUpgrade: !hasAccess && !canGenerate,
      };
    },
    [canAccessAttraction, canGenerateAudioGuide],
  );

  /**
   * Gets the appropriate call-to-action for an attraction.
   */
  const getAttractionCTA = useCallback(
    (attractionId: string): AttractionCTA => {
      const access = checkAttractionAccess(attractionId);

      if (access.hasAccess) {
        return {
          text: 'Play Audio Guide',
          action: 'play',
          variant: 'primary',
          disabled: false,
        };
      }

      if (access.canGenerate) {
        return {
          text: 'Generate Audio Guide',
          action: 'generate',
          variant: 'primary',
          disabled: isGeneratingAudio,
        };
      }

      return {
        text: 'Upgrade to Access',
        action: 'upgrade',
        variant: 'outline',
        disabled: false,
      };
    },
    [checkAttractionAccess, isGeneratingAudio],
  );

  /**
   * Handles attraction interaction based on entitlements.
   */
  const handleAttractionInteraction = useCallback(
    async (attraction: PointOfInterest, action: 'play' | 'generate' | 'upgrade') => {
      switch (action) {
        case 'play':
          console.log('Playing audio for:', attraction.name);
          break;

        case 'generate':
          return await generateAudioGuideWithValidation(attraction);

        case 'upgrade': {
          const access = checkAttractionAccess(attraction.id);
          const trigger = access.canGenerate ? 'free_limit' : 'premium_attraction';
          showPaywall(trigger);
          break;
        }
      }

      return false;
    },
    [generateAudioGuideWithValidation, checkAttractionAccess, showPaywall],
  );

  return {
    entitlements: legacyEntitlements,
    paywallVisible: monetization.showPaywall,

    generateAudioGuideWithValidation,
    checkAttractionAccess,
    getAttractionCTA,
    handleAttractionInteraction,

    canGenerateAudioGuide,
    canAccessAttraction,
    isAttractionUnlocked,
  };
};

/**
 * Hook for managing paywall visibility and user flow.
 */
export const usePaywallFlow = () => {
  const monetization = useMonetization();
  const [hasShownPaywall, setHasShownPaywall] = useState(false);

  const paywallTrigger = monetization.paywallContext?.trigger;

  const legacyEntitlements = useMemo(
    () =>
      deriveLegacyEntitlements(
        monetization.subscription.isActive,
        monetization.entitlements.totalAttractionLimit ?? 2,
        monetization.entitlements.attractionsUsed ?? 0,
        (monetization.entitlements.ownedPackages || []).map(pkg => {
          return pkg.id || pkg.apple_product_id || pkg.google_product_id || pkg.name;
        }),
        monetization.subscription.expiresAt,
        null,
      ),
    [monetization],
  );

  useEffect(() => {
    if (monetization.showPaywall && !hasShownPaywall) {
      setHasShownPaywall(true);
      console.log('Paywall displayed:', paywallTrigger);
    }
  }, [monetization.showPaywall, hasShownPaywall, paywallTrigger]);

  const showPaywall = useCallback(
    (trigger: PaywallTrigger, metadata?: Record<string, any>) => {
      console.log('Paywall trigger:', trigger, metadata);
      monetization.setShowPaywall(true, { trigger });
    },
    [monetization],
  );

  const hidePaywall = useCallback(
    (converted: boolean = false) => {
      if (converted) {
        console.log('Paywall conversion:', paywallTrigger);
      } else {
        console.log('Paywall dismissed:', paywallTrigger);
      }

      monetization.setShowPaywall(false);
      setHasShownPaywall(false);
    },
    [monetization, paywallTrigger],
  );

  return {
    paywallVisible: monetization.showPaywall,
    paywallTrigger,
    hasShownPaywall,
    entitlements: legacyEntitlements,
    showPaywall,
    hidePaywall,
  };
};

/**
 * Hook for subscription management and billing.
 */
export const useSubscriptionManagement = () => {
  const monetization = useMonetization();
  const [isManaging, setIsManaging] = useState(false);

  const ownedPackageIds = (monetization.entitlements.ownedPackages || []).map(pkg => {
    return pkg.id || pkg.apple_product_id || pkg.google_product_id || pkg.name;
  });

  const legacyEntitlements = useMemo(
    () =>
      deriveLegacyEntitlements(
        monetization.subscription.isActive,
        monetization.entitlements.totalAttractionLimit ?? 2,
        monetization.entitlements.attractionsUsed ?? 0,
        ownedPackageIds,
        monetization.subscription.expiresAt,
        null,
      ),
    [
      monetization.subscription.isActive,
      monetization.entitlements.totalAttractionLimit,
      monetization.entitlements.attractionsUsed,
      ownedPackageIds,
      monetization.subscription.expiresAt,
    ],
  );

  const handleSubscriptionPurchase = useCallback(
    async (_planId: string) => {
      try {
        setIsManaging(true);
        const success = await monetization.purchaseSubscription();

        if (success) {
          Alert.alert(
            'Subscription Active!',
            'You now have unlimited access to all audio guides.',
            [{ text: 'OK', style: 'default' }],
          );
        }

        return success;
      } catch (error) {
        console.error('Subscription purchase error:', error);
        return false;
      } finally {
        setIsManaging(false);
      }
    },
    [monetization],
  );

  const handlePackagePurchase = useCallback(
    async (packageId: string) => {
      try {
        setIsManaging(true);
        const purchaseFn = monetization.purchaseAttractionPackage ?? monetization.purchasePack;
        const success = await purchaseFn(packageId);

        if (success) {
          const pkg = monetization.attractionPackages.find(p => p.id === packageId);
          Alert.alert(
            'Package Purchased!',
            `You now have access to ${pkg?.name || 'this package'}.`,
            [{ text: 'OK', style: 'default' }],
          );
        }

        return success;
      } catch (error) {
        console.error('Package purchase error:', error);
        return false;
      } finally {
        setIsManaging(false);
      }
    },
    [monetization],
  );

  const handleRestorePurchases = useCallback(async () => {
    try {
      setIsManaging(true);
      await monetization.restorePurchases();
      return true;
    } catch (error) {
      console.error('Restore purchases error:', error);
      return false;
    } finally {
      setIsManaging(false);
    }
  }, [monetization]);

  const getSubscriptionStatus = useCallback(() => {
    const now = new Date();
    const expiry = monetization.subscription.expiresAt;
    const hasActiveSubscription =
      monetization.subscription.isActive &&
      (expiry ? now < expiry : true) &&
      ['unlimited_monthly', 'premium_monthly', 'premium_yearly', 'lifetime'].includes(
        monetization.subscription.type || '',
      );

    if (!hasActiveSubscription) {
      return {
        status: 'inactive',
        message: 'No active subscription',
        action: 'subscribe',
      };
    }

    if (!expiry) {
      return {
        status: 'active',
        message: 'Active subscription',
        action: 'manage',
        urgent: false,
      };
    }

    const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry <= 3) {
      return {
        status: 'expiring',
        message: `Expires in ${daysUntilExpiry} day${daysUntilExpiry > 1 ? 's' : ''}`,
        action: 'renew',
        urgent: true,
      };
    }

    return {
      status: 'active',
      message: `Active until ${expiry.toLocaleDateString()}`,
      action: 'manage',
      urgent: false,
    };
  }, [monetization.subscription]);

  return {
    entitlements: legacyEntitlements,
    subscriptionPlans: LEGACY_SUBSCRIPTION_PLANS,
    attractionPackages: monetization.attractionPackages,
    isLoading: monetization.loading || isManaging,
    purchaseError: monetization.error
      ? {
          code: 'MONETIZATION_ERROR',
          message: monetization.error,
          userFriendly: monetization.error,
        }
      : null,

    handleSubscriptionPurchase,
    handlePackagePurchase,
    handleRestorePurchases,

    getSubscriptionStatus,
  };
};
