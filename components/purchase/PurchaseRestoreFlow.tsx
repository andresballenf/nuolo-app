import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withDelay,
} from 'react-native-reanimated';

import { Button } from '../ui/Button';
import { usePurchase } from '../../contexts/PurchaseContext';
import { useAuth } from '../../contexts/AuthContext';

interface PurchaseRestoreFlowProps {
  visible: boolean;
  onClose: () => void;
  onRestoreSuccess?: (restoredCount: number) => void;
  trigger?: 'manual' | 'login' | 'error';
}

type RestoreStep = 'initial' | 'restoring' | 'success' | 'empty' | 'error';

export const PurchaseRestoreFlow: React.FC<PurchaseRestoreFlowProps> = ({
  visible,
  onClose,
  onRestoreSuccess,
  trigger = 'manual',
}) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const {
    restorePurchases,
    entitlements,
    purchaseError,
    clearError,
  } = usePurchase();

  const [currentStep, setCurrentStep] = useState<RestoreStep>('initial');
  const [restoredCount, setRestoredCount] = useState(0);

  // Animated values
  const iconScale = useSharedValue(1);
  const progressOpacity = useSharedValue(0);
  const resultOpacity = useSharedValue(0);

  // Reset state when modal becomes visible
  useEffect(() => {
    if (visible) {
      setCurrentStep('initial');
      setRestoredCount(0);
      iconScale.value = 1;
      progressOpacity.value = 0;
      resultOpacity.value = 0;
      clearError();

      // Auto-start restore if triggered by login
      if (trigger === 'login') {
        setTimeout(() => {
          handleRestore();
        }, 500);
      }
    }
  }, [visible, trigger]);

  const handleRestore = useCallback(async () => {
    try {
      setCurrentStep('restoring');
      
      // Start progress animation
      progressOpacity.value = withSpring(1, { damping: 15 });
      iconScale.value = withSequence(
        withSpring(1.2, { damping: 10 }),
        withSpring(1, { damping: 15 })
      );

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const success = await restorePurchases();
      
      if (success) {
        // Calculate restored items
        const totalRestored = entitlements.ownedPackages.length + 
                             (entitlements.status === 'unlimited' ? 1 : 0);
        
        setRestoredCount(totalRestored);
        
        if (totalRestored > 0) {
          setCurrentStep('success');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onRestoreSuccess?.(totalRestored);
          
          // Success animation
          iconScale.value = withSequence(
            withSpring(0.8, { damping: 10 }),
            withSpring(1.1, { damping: 10 }),
            withSpring(1, { damping: 15 })
          );
        } else {
          setCurrentStep('empty');
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      } else {
        setCurrentStep('error');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }

      // Show result with delay
      resultOpacity.value = withDelay(300, withSpring(1, { damping: 15 }));

    } catch (error) {
      console.error('Restore flow error:', error);
      setCurrentStep('error');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      resultOpacity.value = withDelay(300, withSpring(1, { damping: 15 }));
    }
  }, [restorePurchases, entitlements, onRestoreSuccess]);

  const handleClose = useCallback(() => {
    if (currentStep === 'restoring') {
      return; // Don't allow closing during restore
    }
    
    iconScale.value = withSpring(0.8, { damping: 15 });
    progressOpacity.value = withSpring(0, { damping: 15 });
    resultOpacity.value = withSpring(0, { damping: 15 });
    
    setTimeout(() => {
      onClose();
    }, 200);
  }, [currentStep, onClose]);

  const getStepConfig = () => {
    switch (currentStep) {
      case 'initial':
        return {
          icon: 'restore',
          iconColor: '#84cc16',
          title: 'Restore Purchases',
          subtitle: trigger === 'login' 
            ? 'Welcome back! Let\'s restore your purchases.'
            : 'Restore any previous purchases from your account',
          buttonTitle: 'Start Restore',
          buttonVariant: 'primary' as const,
          showProgress: false,
        };
      
      case 'restoring':
        return {
          icon: 'sync',
          iconColor: '#84cc16',
          title: 'Restoring...',
          subtitle: 'Checking your purchase history',
          buttonTitle: 'Restoring...',
          buttonVariant: 'primary' as const,
          showProgress: true,
        };
      
      case 'success':
        return {
          icon: 'check-circle',
          iconColor: '#10B981',
          title: 'Success!',
          subtitle: `Successfully restored ${restoredCount} purchase${restoredCount > 1 ? 's' : ''}`,
          buttonTitle: 'Done',
          buttonVariant: 'primary' as const,
          showProgress: false,
        };
      
      case 'empty':
        return {
          icon: 'info',
          iconColor: '#6B7280',
          title: 'No Purchases Found',
          subtitle: 'No previous purchases were found for this account',
          buttonTitle: 'OK',
          buttonVariant: 'outline' as const,
          showProgress: false,
        };
      
      case 'error':
        return {
          icon: 'error',
          iconColor: '#EF4444',
          title: 'Restore Failed',
          subtitle: purchaseError?.userFriendly || 'Unable to restore purchases. Please try again.',
          buttonTitle: 'Try Again',
          buttonVariant: 'outline' as const,
          showProgress: false,
        };
    }
  };

  const stepConfig = getStepConfig();

  // Animated styles
  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const progressAnimatedStyle = useAnimatedStyle(() => ({
    opacity: progressOpacity.value,
  }));

  const resultAnimatedStyle = useAnimatedStyle(() => ({
    opacity: resultOpacity.value,
  }));

  const handleButtonPress = () => {
    switch (currentStep) {
      case 'initial':
        handleRestore();
        break;
      case 'error':
        setCurrentStep('initial');
        clearError();
        break;
      default:
        handleClose();
        break;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
          {/* Header */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            disabled={currentStep === 'restoring'}
            accessibilityLabel="Close restore flow"
            accessibilityRole="button"
          >
            <MaterialIcons 
              name="close" 
              size={24} 
              color={currentStep === 'restoring' ? '#9CA3AF' : '#6B7280'} 
            />
          </TouchableOpacity>

          {/* Content */}
          <View style={styles.content}>
            {/* Icon */}
            <Animated.View style={[styles.iconContainer, iconAnimatedStyle]}>
              <MaterialIcons
                name={stepConfig.icon as any}
                size={64}
                color={stepConfig.iconColor}
              />
            </Animated.View>

            {/* Progress Indicator */}
            {stepConfig.showProgress && (
              <Animated.View style={[styles.progressContainer, progressAnimatedStyle]}>
                <ActivityIndicator size="small" color="#84cc16" />
              </Animated.View>
            )}

            {/* Text Content */}
            <View style={styles.textContent}>
              <Text style={styles.title}>{stepConfig.title}</Text>
              <Text style={styles.subtitle}>{stepConfig.subtitle}</Text>
            </View>

            {/* Success Details */}
            {currentStep === 'success' && (
              <Animated.View style={[styles.successDetails, resultAnimatedStyle]}>
                {entitlements.status === 'unlimited' && (
                  <View style={styles.restoredItem}>
                    <MaterialIcons name="verified" size={20} color="#10B981" />
                    <Text style={styles.restoredItemText}>Premium Subscription</Text>
                  </View>
                )}
                
                {entitlements.ownedPackages.map((packageId, index) => (
                  <View key={packageId} style={styles.restoredItem}>
                    <MaterialIcons name="place" size={20} color="#10B981" />
                    <Text style={styles.restoredItemText}>
                      Attraction Package {index + 1}
                    </Text>
                  </View>
                ))}
              </Animated.View>
            )}

            {/* Account Info */}
            {user && (
              <View style={styles.accountInfo}>
                <MaterialIcons name="account-circle" size={16} color="#6B7280" />
                <Text style={styles.accountText}>{user.email}</Text>
              </View>
            )}
          </View>

          {/* Action Button */}
          <Button
            title={stepConfig.buttonTitle}
            variant={stepConfig.buttonVariant}
            onPress={handleButtonPress}
            loading={currentStep === 'restoring'}
            disabled={currentStep === 'restoring'}
            style={styles.actionButton}
          />

          {/* Help Text */}
          {currentStep === 'empty' && (
            <TouchableOpacity 
              style={styles.helpButton}
              onPress={() => {
                // Open support or purchase flow
                handleClose();
              }}
            >
              <Text style={styles.helpText}>
                Need help? Contact Support
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
      },
      android: {
        elevation: 16,
      },
    }),
  },

  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
    padding: 8,
  },

  content: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 24,
  },

  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  progressContainer: {
    position: 'absolute',
    top: 96, // Below icon
    alignSelf: 'center',
  },

  textContent: {
    alignItems: 'center',
    marginBottom: 16,
  },

  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },

  successDetails: {
    width: '100%',
    marginBottom: 16,
  },

  restoredItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    marginBottom: 8,
  },

  restoredItemText: {
    fontSize: 14,
    color: '#059669',
    marginLeft: 8,
    fontWeight: '500',
  },

  accountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },

  accountText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },

  actionButton: {
    width: '100%',
  },

  helpButton: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },

  helpText: {
    fontSize: 14,
    color: '#84cc16',
    fontWeight: '500',
  },
});