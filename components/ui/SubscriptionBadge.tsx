import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useMonetization } from '../../contexts/MonetizationContext';
import * as Haptics from 'expo-haptics';

interface SubscriptionBadgeProps {
  onPress?: () => void;
  style?: any;
}

export const SubscriptionBadge: React.FC<SubscriptionBadgeProps> = ({ 
  onPress,
  style 
}) => {
  const { subscription, entitlements, loading, initialized, refreshEntitlements } = useMonetization();
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!initialized) return;
    refreshEntitlements().catch(error => {
      console.error('Failed to refresh entitlements for SubscriptionBadge:', error);
    });
  }, [initialized, refreshEntitlements]);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Animate press
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    onPress?.();
  };

  if (loading) {
    return null; // Don't show badge while loading
  }

  const getDisplayInfo = () => {
    if (entitlements.hasUnlimitedAccess) {
      return {
        displayValue: '∞',
        isInfinity: true,
        isPaidPackage: false,
        showFreeBadge: false,
        isEmpty: false,
      };
    }

    // Unlimited monthly subscription
    if (subscription.isActive && subscription.type === 'unlimited_monthly') {
      return {
        displayValue: '∞',
        isInfinity: true,
        isPaidPackage: false,
        showFreeBadge: false,
        isEmpty: false,
      };
    }

    // Legacy premium subscriptions (grandfathered)
    if (subscription.isActive &&
        ['premium_monthly', 'premium_yearly', 'lifetime'].includes(subscription.type || '')) {
      return {
        displayValue: '∞',
        isInfinity: true,
        isPaidPackage: false,
        showFreeBadge: false,
        isEmpty: false,
      };
    }

    // Package users (have purchased attraction packages)
    const baseFreeAllowance = 2;
    const hasPaidPackages =
      (entitlements.ownedPacks && entitlements.ownedPacks.length > 0) ||
      entitlements.totalAttractionLimit > baseFreeAllowance;

    // The database function already calculates remaining credits correctly:
    // remainingFreeAttractions = total_attraction_limit - attractions_used
    const remainingCredits = Math.max(0, entitlements.remainingFreeAttractions ?? 0);

    if (hasPaidPackages) {
      // User has purchased packages - show remaining paid credits with diamond badge
      return {
        displayValue: remainingCredits.toString(),
        isInfinity: false,
        isPaidPackage: true,
        showFreeBadge: false,
        isEmpty: remainingCredits === 0,
      };
    }

    // Free tier (default 2 free attractions)
    return {
      displayValue: remainingCredits.toString(),
      isInfinity: false,
      isPaidPackage: false,
      showFreeBadge: true,
      isEmpty: remainingCredits === 0,
    };
  };

  const displayInfo = getDisplayInfo();

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ scale: scaleAnim }] },
        style,
      ]}
    >
      <TouchableOpacity
        style={styles.touchable}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        {/* Main counter display */}
        <View style={styles.counterContainer}>
          {displayInfo.isInfinity ? (
            <MaterialIcons
              name="all-inclusive"
              size={24}
              color="#374151"
            />
          ) : (
            <Text style={[
              styles.counterText,
              displayInfo.isEmpty && styles.counterTextEmpty
            ]}>
              {displayInfo.displayValue}
            </Text>
          )}

          {/* Lock icon for empty state */}
          {displayInfo.isEmpty && (
            <View style={styles.lockOverlay}>
              <MaterialIcons name="lock" size={14} color="#EF4444" />
            </View>
          )}
        </View>

        {/* Diamond badge for paid packages */}
        {displayInfo.isPaidPackage && !displayInfo.isEmpty && (
          <View style={styles.diamondBadge}>
            <MaterialIcons name="diamond" size={12} color="#FFFFFF" />
          </View>
        )}

        {/* Free badge overlay */}
        {displayInfo.showFreeBadge && (
          <View style={styles.freeBadge}>
            <Text style={styles.freeBadgeText}>Free</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  touchable: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  counterContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  counterText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#374151',
    textAlign: 'center',
  },
  counterTextEmpty: {
    color: '#9CA3AF',
  },
  lockOverlay: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  diamondBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#F59E0B',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  freeBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#84cc16',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  freeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
