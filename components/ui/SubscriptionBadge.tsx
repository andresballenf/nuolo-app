import React from 'react';
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
  const { subscription, entitlements, loading } = useMonetization();
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

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

  const getBadgeInfo = () => {
    if (subscription.isActive && subscription.type !== 'free') {
      return {
        text: 'Premium',
        icon: 'check-circle',
        backgroundColor: '#84cc16',
        textColor: '#FFFFFF',
        iconColor: '#FFFFFF',
      };
    }

    if (entitlements.remainingFreeAttractions > 0) {
      return {
        text: `Free ${entitlements.remainingFreeAttractions}/2`,
        icon: null,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        textColor: '#374151',
        iconColor: '#84cc16',
      };
    }

    return {
      text: 'Free 0/2',
      icon: 'lock',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      textColor: '#EF4444',
      iconColor: '#EF4444',
    };
  };

  const badgeInfo = getBadgeInfo();

  return (
    <Animated.View
      style={[
        styles.container,
        { 
          backgroundColor: badgeInfo.backgroundColor,
          transform: [{ scale: scaleAnim }],
        },
        style,
      ]}
    >
      <TouchableOpacity
        style={styles.touchable}
        onPress={handlePress}
        activeOpacity={1}
      >
        <View style={styles.content}>
          {badgeInfo.icon && (
            <MaterialIcons 
              name={badgeInfo.icon as any} 
              size={14} 
              color={badgeInfo.iconColor} 
              style={styles.icon}
            />
          )}
          <Text style={[styles.text, { color: badgeInfo.textColor }]}>
            {badgeInfo.text}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 28,
    minWidth: 60,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  touchable: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});