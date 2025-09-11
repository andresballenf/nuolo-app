import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { format, isToday, isTomorrow } from 'date-fns';

import { usePurchase } from '../../contexts/PurchaseContext';

interface EntitlementStatusProps {
  variant?: 'compact' | 'detailed' | 'banner';
  showUpgradeButton?: boolean;
  onUpgrade?: () => void;
}

export const EntitlementStatus: React.FC<EntitlementStatusProps> = ({
  variant = 'compact',
  showUpgradeButton = true,
  onUpgrade,
}) => {
  const {
    entitlements,
    showPaywall,
  } = usePurchase();

  const statusInfo = useMemo(() => {
    const now = new Date();
    const hasSubscription = entitlements.status === 'unlimited';
    const hasPremium = entitlements.status === 'premium';
    const subscriptionExpiry = entitlements.subscriptionExpiry;

    // Check subscription status
    if (hasSubscription && subscriptionExpiry) {
      const isActive = now < subscriptionExpiry;
      const daysUntilExpiry = Math.ceil((subscriptionExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (!isActive) {
        return {
          status: 'expired',
          title: 'Subscription Expired',
          subtitle: `Expired ${format(subscriptionExpiry, 'MMM dd')}`,
          color: '#EF4444',
          backgroundColor: '#FEF2F2',
          icon: 'error',
          urgent: true,
        };
      }

      if (daysUntilExpiry <= 3) {
        return {
          status: 'expiring',
          title: 'Subscription Expiring Soon',
          subtitle: isToday(subscriptionExpiry) ? 'Expires today' : 
                   isTomorrow(subscriptionExpiry) ? 'Expires tomorrow' :
                   `Expires in ${daysUntilExpiry} days`,
          color: '#F59E0B',
          backgroundColor: '#FEF3C7',
          icon: 'warning',
          urgent: true,
        };
      }

      if (daysUntilExpiry <= 7) {
        return {
          status: 'renewing',
          title: 'Premium Active',
          subtitle: `Renews ${format(subscriptionExpiry, 'MMM dd')}`,
          color: '#84cc16',
          backgroundColor: '#F0FDF4',
          icon: 'verified',
          urgent: false,
        };
      }

      return {
        status: 'active',
        title: 'Premium Active',
        subtitle: 'Unlimited access',
        color: '#84cc16',
        backgroundColor: '#F0FDF4',
        icon: 'verified',
        urgent: false,
      };
    }

    // Premium with packages
    if (hasPremium) {
      const packageCount = entitlements.ownedPackages.length;
      return {
        status: 'premium',
        title: `${packageCount} Package${packageCount > 1 ? 's' : ''} Owned`,
        subtitle: 'Upgrade for unlimited access',
        color: '#F59E0B',
        backgroundColor: '#FEF3C7',
        icon: 'star',
        urgent: false,
      };
    }

    // Free tier
    const remaining = entitlements.freeGuidesLimit - entitlements.freeGuidesUsed;
    if (remaining <= 0) {
      return {
        status: 'limit_reached',
        title: 'Free Guides Used Up',
        subtitle: 'Upgrade to continue listening',
        color: '#EF4444',
        backgroundColor: '#FEF2F2',
        icon: 'block',
        urgent: true,
      };
    }

    if (remaining === 1) {
      return {
        status: 'last_free',
        title: '1 Free Guide Left',
        subtitle: 'Make it count!',
        color: '#F59E0B',
        backgroundColor: '#FEF3C7',
        icon: 'looks-one',
        urgent: false,
      };
    }

    return {
      status: 'free',
      title: `${remaining} Free Guides Left`,
      subtitle: 'Discover amazing places',
      color: '#6B7280',
      backgroundColor: '#F3F4F6',
      icon: 'explore',
      urgent: false,
    };
  }, [entitlements]);

  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade();
    } else {
      const trigger = statusInfo.status === 'limit_reached' ? 'free_limit' : 'manual';
      showPaywall(trigger);
    }
  };

  if (variant === 'compact') {
    return (
      <TouchableOpacity
        style={[styles.compactContainer, { backgroundColor: statusInfo.backgroundColor }]}
        onPress={statusInfo.urgent || entitlements.status === 'free' ? handleUpgrade : undefined}
        activeOpacity={statusInfo.urgent || entitlements.status === 'free' ? 0.7 : 1}
      >
        <MaterialIcons 
          name={statusInfo.icon as any} 
          size={20} 
          color={statusInfo.color} 
        />
        <View style={styles.compactTextContainer}>
          <Text style={[styles.compactTitle, { color: statusInfo.color }]}>
            {statusInfo.title}
          </Text>
        </View>
        {(statusInfo.urgent || entitlements.status === 'free') && (
          <MaterialIcons name="chevron-right" size={20} color={statusInfo.color} />
        )}
      </TouchableOpacity>
    );
  }

  if (variant === 'banner') {
    if (!statusInfo.urgent && entitlements.status !== 'free') {
      return null; // Don't show banner for non-urgent states
    }

    return (
      <TouchableOpacity 
        style={styles.bannerContainer}
        onPress={handleUpgrade}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={statusInfo.status === 'limit_reached' ? ['#FEF2F2', '#FECACA'] : ['#FEF3C7', '#FDE68A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.bannerGradient}
        >
          <View style={styles.bannerContent}>
            <MaterialIcons 
              name={statusInfo.icon as any} 
              size={24} 
              color={statusInfo.color} 
            />
            <View style={styles.bannerTextContainer}>
              <Text style={[styles.bannerTitle, { color: statusInfo.color }]}>
                {statusInfo.title}
              </Text>
              <Text style={[styles.bannerSubtitle, { color: statusInfo.color }]}>
                {statusInfo.subtitle}
              </Text>
            </View>
            <View style={[styles.bannerButton, { borderColor: statusInfo.color }]}>
              <Text style={[styles.bannerButtonText, { color: statusInfo.color }]}>
                Upgrade
              </Text>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  // Detailed variant
  return (
    <View style={[styles.detailedContainer, { backgroundColor: statusInfo.backgroundColor }]}>
      <View style={styles.detailedHeader}>
        <View style={styles.detailedIconContainer}>
          <MaterialIcons 
            name={statusInfo.icon as any} 
            size={28} 
            color={statusInfo.color} 
          />
        </View>
        <View style={styles.detailedTextContainer}>
          <Text style={[styles.detailedTitle, { color: statusInfo.color }]}>
            {statusInfo.title}
          </Text>
          <Text style={[styles.detailedSubtitle, { color: statusInfo.color }]}>
            {statusInfo.subtitle}
          </Text>
        </View>
      </View>

      {/* Additional Info */}
      {entitlements.status === 'free' && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill,
                { 
                  width: `${(entitlements.freeGuidesUsed / entitlements.freeGuidesLimit) * 100}%`,
                  backgroundColor: statusInfo.color 
                }
              ]} 
            />
          </View>
          <Text style={[styles.progressText, { color: statusInfo.color }]}>
            {entitlements.freeGuidesUsed} of {entitlements.freeGuidesLimit} used
          </Text>
        </View>
      )}

      {entitlements.ownedPackages.length > 0 && (
        <View style={styles.packagesContainer}>
          <Text style={[styles.packagesTitle, { color: statusInfo.color }]}>
            Owned Packages:
          </Text>
          <Text style={[styles.packagesText, { color: statusInfo.color }]}>
            {entitlements.ownedPackages.length} attraction package{entitlements.ownedPackages.length > 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {showUpgradeButton && (statusInfo.urgent || entitlements.status !== 'unlimited') && (
        <TouchableOpacity
          style={[styles.upgradeButton, { borderColor: statusInfo.color }]}
          onPress={handleUpgrade}
        >
          <Text style={[styles.upgradeButtonText, { color: statusInfo.color }]}>
            {statusInfo.status === 'expired' ? 'Resubscribe' : 'Upgrade Now'}
          </Text>
          <MaterialIcons name="arrow-forward" size={16} color={statusInfo.color} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  // Compact variant
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  compactTextContainer: {
    flex: 1,
    marginLeft: 8,
  },
  compactTitle: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Banner variant
  bannerContainer: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  bannerGradient: {
    padding: 16,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  bannerSubtitle: {
    fontSize: 14,
  },
  bannerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  bannerButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Detailed variant
  detailedContainer: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  detailedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailedIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  detailedTextContainer: {
    flex: 1,
  },
  detailedTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  detailedSubtitle: {
    fontSize: 14,
  },

  // Progress bar (for free tier)
  progressContainer: {
    marginTop: 12,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    textAlign: 'center',
  },

  // Packages info
  packagesContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.3)',
  },
  packagesTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  packagesText: {
    fontSize: 12,
  },

  // Upgrade button
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  upgradeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 4,
  },
});