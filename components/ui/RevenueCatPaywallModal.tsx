import React, { useEffect } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import RevenueCatUI from 'react-native-purchases-ui';
import { useMonetization } from '../../contexts/MonetizationContext';
import { logger } from '../../lib/logger';
import { TelemetryService } from '../../services/TelemetryService';

interface RevenueCatPaywallModalProps {
  visible: boolean;
  onClose: () => void;
  trigger?: 'free_limit' | 'premium_attraction' | 'manual';
  attractionId?: string;
  attractionName?: string;
}

/**
 * RevenueCat Native Paywall Modal
 *
 * Uses RevenueCat's native paywall UI component (RevenueCatUI.Paywall)
 * which provides a beautifully designed, conversion-optimized paywall
 * that's automatically configured from your RevenueCat dashboard.
 *
 * Benefits:
 * - Native UI with platform-specific design (iOS/Android)
 * - Automatically syncs with RevenueCat dashboard configuration
 * - Built-in A/B testing support
 * - Handles purchase flow automatically
 * - No need to manually manage product display or purchase logic
 */
export const RevenueCatPaywallModal: React.FC<RevenueCatPaywallModalProps> = ({
  visible,
  onClose,
  trigger = 'manual',
  attractionId,
  attractionName,
}) => {
  const { refreshEntitlements, initialized } = useMonetization();

  useEffect(() => {
    if (visible) {
      TelemetryService.increment('paywall_open_success');
      logger.info('RevenueCat paywall opened', { trigger, attractionId, attractionName });
    }
  }, [visible, trigger, attractionId, attractionName]);

  const handleDismiss = async () => {
    TelemetryService.increment('paywall_dismissed');
    logger.info('RevenueCat paywall dismissed');

    // Refresh entitlements to check if a purchase was made
    await refreshEntitlements();

    // Close the modal
    onClose();
  };

  const handleRestoreCompleted = async ({ customerInfo }: any) => {
    TelemetryService.increment('paywall_restore_success');
    logger.info('RevenueCat restore completed', {
      hasActiveSubscription: customerInfo?.entitlements?.active !== undefined,
    });

    // Refresh entitlements after restore
    await refreshEntitlements();
  };

  const handlePurchaseCompleted = async ({ customerInfo }: any) => {
    TelemetryService.increment('paywall_purchase_success');
    logger.info('RevenueCat purchase completed', {
      hasActiveSubscription: customerInfo?.entitlements?.active !== undefined,
    });
    await refreshEntitlements();
  };

  const handlePurchaseError = ({ error }: { error: unknown }) => {
    TelemetryService.increment('paywall_purchase_error');
    logger.error('RevenueCat purchase failed', error);
  };

  // Don't show paywall if MonetizationService isn't initialized
  if (!visible || !initialized) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/*
          RevenueCat Native Paywall Component

          This component automatically:
          - Displays your configured paywall from RevenueCat dashboard
          - Handles the entire purchase flow
          - Syncs with your A/B tests
          - Shows platform-native UI (iOS/Android specific)
          - Manages loading states and errors

          You can configure the paywall appearance in:
          RevenueCat Dashboard → Paywalls → Create/Edit Paywall
        */}
        <RevenueCatUI.Paywall
          options={{
            // Optional: You can specify a specific offering here
            // If not specified, it will use the current offering
            // offering: specificOffering,
          }}
          onPurchaseCompleted={handlePurchaseCompleted}
          onPurchaseError={handlePurchaseError}
          onRestoreCompleted={handleRestoreCompleted}
          onDismiss={handleDismiss}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});
