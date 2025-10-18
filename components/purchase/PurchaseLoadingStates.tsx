import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { MaterialIconName } from '../../types/icons';

interface PurchaseLoadingStateProps {
  variant: 'processing' | 'validating' | 'restoring' | 'connecting';
  message?: string;
  showCancel?: boolean;
  onCancel?: () => void;
}

interface LoadingConfig {
  icon: MaterialIconName;
  iconColor: string;
  title: string;
  subtitle: string;
  backgroundColor: string;
}

export const PurchaseLoadingState: React.FC<PurchaseLoadingStateProps> = ({
  variant,
  message,
  showCancel = false,
  onCancel,
}) => {
  // Animated values
  const pulseScale = useSharedValue(1);
  const rotateValue = useSharedValue(0);
  const fadeOpacity = useSharedValue(0.7);

  useEffect(() => {
    // Pulse animation
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 800 }),
        withTiming(1, { duration: 800 })
      ),
      -1,
      false
    );

    // Rotation animation (for connecting state)
    if (variant === 'connecting') {
      rotateValue.value = withRepeat(
        withTiming(360, { duration: 2000 }),
        -1,
        false
      );
    }

    // Fade animation
    fadeOpacity.value = withRepeat(
      withSequence(
        withTiming(0.4, { duration: 1000 }),
        withTiming(0.8, { duration: 1000 })
      ),
      -1,
      true
    );
  }, [variant]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const rotateStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotateValue.value}deg` }],
  }));

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fadeOpacity.value,
  }));

  const getLoadingConfig = (): LoadingConfig => {
    switch (variant) {
      case 'processing':
        return {
          icon: 'payment',
          iconColor: '#84cc16',
          title: 'Processing Payment',
          subtitle: message || 'Please wait while we process your purchase...',
          backgroundColor: '#F0FDF4',
        };
      
      case 'validating':
        return {
          icon: 'verified-user',
          iconColor: '#3B82F6',
          title: 'Validating Purchase',
          subtitle: message || 'Confirming your purchase with the app store...',
          backgroundColor: '#EFF6FF',
        };
      
      case 'restoring':
        return {
          icon: 'restore',
          iconColor: '#F59E0B',
          title: 'Restoring Purchases',
          subtitle: message || 'Checking your purchase history...',
          backgroundColor: '#FEF3C7',
        };
      
      case 'connecting':
        return {
          icon: 'sync',
          iconColor: '#6B7280',
          title: 'Connecting to Store',
          subtitle: message || 'Establishing connection with app store...',
          backgroundColor: '#F3F4F6',
        };
    }
  };

  const config = getLoadingConfig();

  return (
    <View style={[styles.container, { backgroundColor: config.backgroundColor }]}>
      {/* Animated Icon */}
      <Animated.View 
        style={[
          styles.iconContainer,
          variant === 'connecting' ? rotateStyle : pulseStyle
        ]}
      >
        <MaterialIcons
          name={config.icon}
          size={48}
          color={config.iconColor}
        />
      </Animated.View>

      {/* Loading Indicator */}
      <View style={styles.spinnerContainer}>
        <ActivityIndicator size="large" color={config.iconColor} />
      </View>

      {/* Text Content */}
      <Animated.View style={[styles.textContainer, fadeStyle]}>
        <Text style={styles.title}>{config.title}</Text>
        <Text style={styles.subtitle}>{config.subtitle}</Text>
      </Animated.View>

      {/* Progress Dots */}
      <View style={styles.dotsContainer}>
        {[0, 1, 2].map((index) => (
          <ProgressDot key={index} delay={index * 300} color={config.iconColor} />
        ))}
      </View>

      {/* Cancel Button (if applicable) */}
      {showCancel && onCancel && (
        <View style={styles.cancelContainer}>
          <Text style={styles.cancelText} onPress={onCancel}>
            Cancel
          </Text>
        </View>
      )}

      {/* Security Badge */}
      <View style={styles.securityBadge}>
        <MaterialIcons name="security" size={16} color="#6B7280" />
        <Text style={styles.securityText}>
          Secure {Platform.OS === 'ios' ? 'App Store' : 'Google Play'} Transaction
        </Text>
      </View>
    </View>
  );
};

// Progress Dot Component
interface ProgressDotProps {
  delay: number;
  color: string;
}

const ProgressDot: React.FC<ProgressDotProps> = ({ delay, color }) => {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    setTimeout(() => {
      opacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 600 }),
          withTiming(0.3, { duration: 600 })
        ),
        -1,
        false
      );
    }, delay);
  }, [delay]);

  const dotStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    backgroundColor: color,
  }));

  return <Animated.View style={[styles.dot, dotStyle]} />;
};

// Skeleton Loading for Purchase Lists
interface PurchaseSkeletonProps {
  itemCount?: number;
  variant?: 'subscription' | 'package';
}

export const PurchaseSkeleton: React.FC<PurchaseSkeletonProps> = ({
  itemCount = 3,
  variant = 'subscription',
}) => {
  const shimmerValue = useSharedValue(-1);

  useEffect(() => {
    shimmerValue.value = withRepeat(
      withTiming(1, { duration: 1500 }),
      -1,
      false
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerValue.value * 300 }],
  }));

  const renderSkeletonItem = (index: number) => (
    <View key={index} style={styles.skeletonCard}>
      <View style={styles.skeletonHeader}>
        <View style={styles.skeletonTitle} />
        {variant === 'subscription' && (
          <View style={styles.skeletonBadge} />
        )}
      </View>
      
      <View style={styles.skeletonPrice} />
      <View style={styles.skeletonDescription} />
      
      {variant === 'subscription' && (
        <View style={styles.skeletonFeatures}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.skeletonFeature} />
          ))}
        </View>
      )}
      
      <View style={styles.skeletonButton} />
      
      {/* Shimmer overlay */}
      <Animated.View style={[styles.shimmerOverlay, shimmerStyle]} />
    </View>
  );

  return (
    <View style={styles.skeletonContainer}>
      {Array.from({ length: itemCount }, (_, index) => renderSkeletonItem(index))}
    </View>
  );
};

// Error State Component
interface PurchaseErrorStateProps {
  title?: string;
  message?: string;
  actionText?: string;
  onAction?: () => void;
  variant?: 'payment' | 'network' | 'store' | 'generic';
}

interface PurchaseErrorConfig {
  icon: MaterialIconName;
  iconColor: string;
  defaultTitle: string;
  defaultMessage: string;
}

export const PurchaseErrorState: React.FC<PurchaseErrorStateProps> = ({
  title,
  message,
  actionText = 'Try Again',
  onAction,
  variant = 'generic',
}) => {
  const getErrorConfig = (): PurchaseErrorConfig => {
    switch (variant) {
      case 'payment':
        return {
          icon: 'payment',
          iconColor: '#EF4444',
          defaultTitle: 'Payment Failed',
          defaultMessage: 'Your payment could not be processed. Please check your payment method and try again.',
        };
      
      case 'network':
        return {
          icon: 'wifi-off',
          iconColor: '#F59E0B',
          defaultTitle: 'Connection Error',
          defaultMessage: 'Unable to connect to the app store. Please check your internet connection.',
        };
      
      case 'store':
        return {
          icon: 'store',
          iconColor: '#EF4444',
          defaultTitle: 'Store Unavailable',
          defaultMessage: 'The app store is currently unavailable. Please try again later.',
        };
      
      default:
        return {
          icon: 'error',
          iconColor: '#EF4444',
          defaultTitle: 'Purchase Error',
          defaultMessage: 'Something went wrong with your purchase. Please try again.',
        };
    }
  };

  const config = getErrorConfig();

  return (
    <View style={styles.errorContainer}>
      <View style={styles.errorIconContainer}>
        <MaterialIcons
          name={config.icon}
          size={48}
          color={config.iconColor}
        />
      </View>
      
      <Text style={styles.errorTitle}>
        {title || config.defaultTitle}
      </Text>
      
      <Text style={styles.errorMessage}>
        {message || config.defaultMessage}
      </Text>
      
      {onAction && (
        <View style={styles.errorActionContainer}>
          <Text style={styles.errorAction} onPress={onAction}>
            {actionText}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  // Loading State Styles
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  
  spinnerContainer: {
    marginBottom: 24,
  },
  
  textContainer: {
    alignItems: 'center',
    marginBottom: 32,
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
  
  dotsContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 8,
  },
  
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  
  cancelContainer: {
    marginBottom: 16,
  },
  
  cancelText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 16,
  },
  
  securityText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },

  // Skeleton Styles
  skeletonContainer: {
    padding: 16,
    gap: 16,
  },
  
  skeletonCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    position: 'relative',
    overflow: 'hidden',
  },
  
  skeletonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  
  skeletonTitle: {
    width: 140,
    height: 20,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
  },
  
  skeletonBadge: {
    width: 60,
    height: 16,
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
  },
  
  skeletonPrice: {
    width: 80,
    height: 24,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginBottom: 8,
  },
  
  skeletonDescription: {
    width: '100%',
    height: 16,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginBottom: 16,
  },
  
  skeletonFeatures: {
    marginBottom: 20,
  },
  
  skeletonFeature: {
    width: '80%',
    height: 14,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginBottom: 8,
  },
  
  skeletonButton: {
    width: '100%',
    height: 44,
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
  },
  
  shimmerOverlay: {
    position: 'absolute',
    top: 0,
    left: -100,
    right: -100,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    transform: [{ skewX: '-20deg' }],
  },

  // Error State Styles
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  
  errorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  
  errorMessage: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  
  errorActionContainer: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#EF4444',
    borderRadius: 8,
  },
  
  errorAction: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});