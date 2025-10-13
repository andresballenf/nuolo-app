import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { usePurchase } from '../contexts/PurchaseContext';
import { useAudio } from '../contexts/AudioContext';
import type { PointOfInterest } from '../services/GooglePlacesService';

type AttractionAction = 'play' | 'generate' | 'upgrade';

interface AttractionCTA {
  text: string;
  action: AttractionAction;
  variant: 'primary' | 'outline';
  disabled: boolean;
}

/**
 * Hook that integrates purchase entitlements with the audio guide generation flow
 */
export const usePurchaseIntegration = () => {
  const {
    entitlements,
    canGenerateAudioGuide,
    canAccessAttraction,
    isAttractionUnlocked,
    showPaywall,
    paywallVisible,
  } = usePurchase();

  const { generateAudioGuide, isGeneratingAudio } = useAudio();

  /**
   * Attempts to generate an audio guide with purchase validation
   */
  const generateAudioGuideWithValidation = useCallback(async (
    attraction: PointOfInterest,
    options?: {
      language?: string;
      audioLength?: 'short' | 'medium' | 'deep-dive';
      voiceStyle?: 'casual' | 'formal' | 'energetic' | 'calm';
    }
  ) => {
    try {
      // Check if user can generate audio guide
      const { canGenerate, reason } = canGenerateAudioGuide();
      
      if (!canGenerate) {
        // Show paywall with appropriate trigger
        showPaywall('free_limit');
        return false;
      }

      // Check if this specific attraction requires premium access
      const isPremiumAttraction = !isAttractionUnlocked(attraction.id);
      
      if (isPremiumAttraction) {
        showPaywall('premium_attraction');
        return false;
      }

      // Generate the audio guide
      const success = await generateAudioGuide(attraction, options);
      
      if (success) {
        // Update free guide usage if user is on free tier
        if (entitlements.status === 'free') {
          // This would be handled by the PurchaseContext internally
          console.log('Free guide consumed successfully');
        }
      }

      return success;

    } catch (error) {
      console.error('Audio guide generation with validation failed:', error);
      Alert.alert('Error', 'Failed to generate audio guide. Please try again.');
      return false;
    }
  }, [
    canGenerateAudioGuide,
    isAttractionUnlocked,
    showPaywall,
    generateAudioGuide,
    entitlements.status,
  ]);

  /**
   * Checks if an attraction is available for the current user
   */
  const checkAttractionAccess = useCallback((attractionId: string) => {
    const hasAccess = canAccessAttraction(attractionId);
    const canGenerate = canGenerateAudioGuide().canGenerate;
    
    return {
      hasAccess,
      canGenerate,
      isUnlocked: hasAccess || canGenerate,
      requiresUpgrade: !hasAccess && !canGenerate,
    };
  }, [canAccessAttraction, canGenerateAudioGuide]);

  /**
   * Gets the appropriate call-to-action for an attraction
   */
  const getAttractionCTA = useCallback((attractionId: string): AttractionCTA => {
    const access = checkAttractionAccess(attractionId);

    if (access.hasAccess) {
      return {
        text: 'Play Audio Guide',
        action: 'play',
        variant: 'primary' as const,
        disabled: false,
      };
    }

    if (access.canGenerate) {
      return {
        text: 'Generate Audio Guide',
        action: 'generate',
        variant: 'primary' as const,
        disabled: isGeneratingAudio,
      };
    }

    return {
      text: 'Upgrade to Access',
      action: 'upgrade',
      variant: 'outline' as const,
      disabled: false,
    };
  }, [checkAttractionAccess, isGeneratingAudio]);

  /**
   * Handles attraction interaction based on entitlements
   */
  const handleAttractionInteraction = useCallback(async (
    attraction: PointOfInterest,
    action: 'play' | 'generate' | 'upgrade'
  ) => {
    switch (action) {
      case 'play':
        // Audio playback logic would be handled by AudioContext
        console.log('Playing audio for:', attraction.name);
        break;
        
      case 'generate':
        return await generateAudioGuideWithValidation(attraction);
        
      case 'upgrade':
        const access = checkAttractionAccess(attraction.id);
        const trigger = access.canGenerate ? 'free_limit' : 'premium_attraction';
        showPaywall(trigger);
        break;
    }
    
    return false;
  }, [generateAudioGuideWithValidation, checkAttractionAccess, showPaywall]);

  return {
    // Entitlement status
    entitlements,
    paywallVisible,
    
    // Core functions
    generateAudioGuideWithValidation,
    checkAttractionAccess,
    getAttractionCTA,
    handleAttractionInteraction,
    
    // Utility functions
    canGenerateAudioGuide,
    canAccessAttraction,
    isAttractionUnlocked,
  };
};

/**
 * Hook for managing paywall visibility and user flow
 */
export const usePaywallFlow = () => {
  const {
    paywallVisible,
    paywallTrigger,
    showPaywall,
    hidePaywall,
    entitlements,
  } = usePurchase();

  const [hasShownPaywall, setHasShownPaywall] = useState(false);

  // Track paywall display for analytics
  useEffect(() => {
    if (paywallVisible && !hasShownPaywall) {
      setHasShownPaywall(true);
      // Analytics tracking would go here
      console.log('Paywall displayed:', paywallTrigger);
    }
  }, [paywallVisible, hasShownPaywall, paywallTrigger]);

  /**
   * Shows paywall with analytics tracking
   */
  const showPaywallWithTracking = useCallback((
    trigger: 'free_limit' | 'premium_attraction' | 'manual',
    metadata?: Record<string, any>
  ) => {
    // Analytics tracking
    console.log('Paywall trigger:', trigger, metadata);
    
    showPaywall(trigger);
  }, [showPaywall]);

  /**
   * Hides paywall with conversion tracking
   */
  const hidePaywallWithTracking = useCallback((converted: boolean = false) => {
    if (converted) {
      console.log('Paywall conversion:', paywallTrigger);
    } else {
      console.log('Paywall dismissed:', paywallTrigger);
    }
    
    hidePaywall();
    setHasShownPaywall(false);
  }, [hidePaywall, paywallTrigger]);

  return {
    paywallVisible,
    paywallTrigger,
    hasShownPaywall,
    entitlements,
    showPaywall: showPaywallWithTracking,
    hidePaywall: hidePaywallWithTracking,
  };
};

/**
 * Hook for subscription management and billing
 */
export const useSubscriptionManagement = () => {
  const {
    entitlements,
    subscriptionPlans,
    attractionPackages,
    purchaseSubscription,
    purchasePackage,
    restorePurchases,
    isLoading,
    purchaseError,
  } = usePurchase();

  const [isManaging, setIsManaging] = useState(false);

  /**
   * Handles subscription purchase with error handling
   */
  const handleSubscriptionPurchase = useCallback(async (planId: string) => {
    try {
      setIsManaging(true);
      const success = await purchaseSubscription(planId);
      
      if (success) {
        Alert.alert(
          'Subscription Active!',
          'You now have unlimited access to all audio guides.',
          [{ text: 'OK', style: 'default' }]
        );
      }
      
      return success;
    } catch (error) {
      console.error('Subscription purchase error:', error);
      return false;
    } finally {
      setIsManaging(false);
    }
  }, [purchaseSubscription]);

  /**
   * Handles package purchase with error handling
   */
  const handlePackagePurchase = useCallback(async (packageId: string) => {
    try {
      setIsManaging(true);
      const success = await purchasePackage(packageId);
      
      if (success) {
        const pkg = attractionPackages.find(p => p.id === packageId);
        Alert.alert(
          'Package Purchased!',
          `You now have access to ${pkg?.name || 'this package'}.`,
          [{ text: 'OK', style: 'default' }]
        );
      }
      
      return success;
    } catch (error) {
      console.error('Package purchase error:', error);
      return false;
    } finally {
      setIsManaging(false);
    }
  }, [purchasePackage, attractionPackages]);

  /**
   * Handles purchase restoration with user feedback
   */
  const handleRestorePurchases = useCallback(async () => {
    try {
      setIsManaging(true);
      const success = await restorePurchases();
      
      if (!success) {
        Alert.alert(
          'Restore Failed',
          'Unable to restore purchases. Please try again or contact support.',
          [{ text: 'OK', style: 'default' }]
        );
      }
      
      return success;
    } catch (error) {
      console.error('Restore purchases error:', error);
      return false;
    } finally {
      setIsManaging(false);
    }
  }, [restorePurchases]);

  /**
   * Gets subscription status summary
   */
  const getSubscriptionStatus = useCallback(() => {
    const now = new Date();
    const hasActiveSubscription = entitlements.status === 'unlimited' &&
      entitlements.subscriptionExpiry &&
      now < entitlements.subscriptionExpiry;

    if (!hasActiveSubscription) {
      return {
        status: 'inactive',
        message: 'No active subscription',
        action: 'subscribe',
      };
    }

    const daysUntilExpiry = Math.ceil(
      (entitlements.subscriptionExpiry!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

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
      message: `Active until ${entitlements.subscriptionExpiry!.toLocaleDateString()}`,
      action: 'manage',
      urgent: false,
    };
  }, [entitlements]);

  return {
    entitlements,
    subscriptionPlans,
    attractionPackages,
    isLoading: isLoading || isManaging,
    purchaseError,
    
    // Actions
    handleSubscriptionPurchase,
    handlePackagePurchase,
    handleRestorePurchases,
    
    // Status
    getSubscriptionStatus,
  };
};