import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { format, formatDistanceToNow } from 'date-fns';
import { useMonetization } from '../../contexts/MonetizationContext';

export type EntitlementVariant = 'compact' | 'banner' | 'detailed';

interface EntitlementStatusProps {
  variant?: EntitlementVariant;
  style?: ViewStyle;
  onUpgradePress?: () => void;
  showUpgradeButton?: boolean;
}

export const EntitlementStatus: React.FC<EntitlementStatusProps> = ({
  variant = 'compact',
  style,
  onUpgradePress,
  showUpgradeButton = true,
}) => {
  const { subscription, entitlements, loading } = useMonetization();

  if (loading) {
    return (
      <View style={[styles.container, styles.loading, style]}>
        <MaterialIcons name="hourglass-empty" size={16} color="#9CA3AF" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const getStatusInfo = () => {
    if (subscription.isActive && subscription.type !== 'free') {
      return {
        type: 'premium' as const,
        icon: 'star' as const,
        title: subscription.type === 'lifetime' ? 'Lifetime Premium' : 'Premium Active',
        subtitle: subscription.type === 'lifetime' 
          ? 'Unlimited access forever'
          : subscription.expiresAt 
            ? `Expires ${formatDistanceToNow(subscription.expiresAt, { addSuffix: true })}`
            : 'Unlimited access',
        color: '#84cc16',
        backgroundColor: '#F7FEE7',
        borderColor: '#84cc16',
      };
    }

    if (entitlements.ownedPacks.length > 0 || entitlements.ownedAttractions.length > 0) {
      const totalOwned = entitlements.ownedPacks.length + entitlements.ownedAttractions.length;
      return {
        type: 'partial' as const,
        icon: 'collections' as const,
        title: 'Premium Content',
        subtitle: `${totalOwned} pack${totalOwned === 1 ? '' : 's'}/attraction${totalOwned === 1 ? '' : 's'} owned`,
        color: '#F59E0B',
        backgroundColor: '#FFFBEB',
        borderColor: '#F59E0B',
      };
    }

    // Free tier
    return {
      type: 'free' as const,
      icon: 'free-breakfast' as const,
      title: 'Free Tier',
      subtitle: `${entitlements.remainingFreeAttractions}/2 free guides remaining`,
      color: entitlements.remainingFreeAttractions > 0 ? '#10B981' : '#EF4444',
      backgroundColor: entitlements.remainingFreeAttractions > 0 ? '#ECFDF5' : '#FEF2F2',
      borderColor: entitlements.remainingFreeAttractions > 0 ? '#10B981' : '#EF4444',
    };
  };

  const statusInfo = getStatusInfo();

  const handleUpgradePress = () => {
    onUpgradePress?.();
  };

  if (variant === 'compact') {
    return (
      <View style={[styles.container, styles.compact, style]}>
        <View 
          style={[
            styles.statusIndicator, 
            { backgroundColor: statusInfo.backgroundColor, borderColor: statusInfo.borderColor }
          ]}
        >
          <MaterialIcons name={statusInfo.icon} size={16} color={statusInfo.color} />
          <Text style={[styles.compactText, { color: statusInfo.color }]}>
            {statusInfo.type === 'premium' ? 'Premium' : 
             statusInfo.type === 'partial' ? 'Partial' : 
             `${entitlements.remainingFreeAttractions}/2`}
          </Text>
        </View>

        {showUpgradeButton && statusInfo.type !== 'premium' && (
          <TouchableOpacity
            onPress={handleUpgradePress}
            style={styles.upgradeButtonCompact}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Upgrade to premium"
          >
            <Text style={styles.upgradeButtonCompactText}>Upgrade</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (variant === 'banner') {
    if (statusInfo.type === 'premium') {
      return (
        <LinearGradient
          colors={['#84cc16', '#65a30d']}
          style={[styles.container, styles.banner, styles.premiumBanner, style]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <View style={styles.bannerContent}>
            <MaterialIcons name={statusInfo.icon} size={24} color="#ffffff" />
            <View style={styles.bannerText}>
              <Text style={styles.bannerTitle}>{statusInfo.title}</Text>
              <Text style={styles.bannerSubtitle}>{statusInfo.subtitle}</Text>
            </View>
          </View>
          <MaterialIcons name="check-circle" size={24} color="#ffffff" />
        </LinearGradient>
      );
    }

    return (
      <View 
        style={[
          styles.container, 
          styles.banner, 
          { backgroundColor: statusInfo.backgroundColor, borderColor: statusInfo.borderColor },
          style
        ]}
      >
        <View style={styles.bannerContent}>
          <MaterialIcons name={statusInfo.icon} size={24} color={statusInfo.color} />
          <View style={styles.bannerText}>
            <Text style={[styles.bannerTitle, { color: statusInfo.color }]}>
              {statusInfo.title}
            </Text>
            <Text style={styles.bannerSubtitle}>{statusInfo.subtitle}</Text>
          </View>
        </View>

        {showUpgradeButton && statusInfo.type !== 'premium' && (
          <TouchableOpacity
            onPress={handleUpgradePress}
            style={[styles.upgradeButton, { borderColor: statusInfo.color }]}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Upgrade to premium"
          >
            <Text style={[styles.upgradeButtonText, { color: statusInfo.color }]}>
              Upgrade
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Detailed variant
  return (
    <View style={[styles.container, styles.detailed, style]}>
      <View style={styles.detailedHeader}>
        <View style={styles.detailedTitleRow}>
          <MaterialIcons name={statusInfo.icon} size={28} color={statusInfo.color} />
          <View style={styles.detailedTitleText}>
            <Text style={styles.detailedTitle}>{statusInfo.title}</Text>
            <Text style={styles.detailedSubtitle}>{statusInfo.subtitle}</Text>
          </View>
        </View>

        {subscription.expiresAt && statusInfo.type === 'premium' && (
          <View style={styles.expiryInfo}>
            <Text style={styles.expiryLabel}>
              {subscription.type?.includes('monthly') ? 'Monthly' : 
               subscription.type?.includes('yearly') ? 'Yearly' : 'Lifetime'}
            </Text>
            {subscription.type !== 'lifetime' && (
              <Text style={styles.expiryDate}>
                Until {format(subscription.expiresAt, 'MMM d, yyyy')}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Usage Stats */}
      <View style={styles.usageStats}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Free Guides</Text>
          <Text style={styles.statValue}>
            {entitlements.remainingFreeAttractions}/2 remaining
          </Text>
        </View>

        {entitlements.ownedPacks.length > 0 && (
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Owned Packs</Text>
            <Text style={styles.statValue}>{entitlements.ownedPacks.length}</Text>
          </View>
        )}

        {entitlements.ownedAttractions.length > 0 && (
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Individual Attractions</Text>
            <Text style={styles.statValue}>{entitlements.ownedAttractions.length}</Text>
          </View>
        )}

        {subscription.isActive && subscription.type !== 'free' && (
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Status</Text>
            <View style={styles.activeStatus}>
              <View style={styles.activeIndicator} />
              <Text style={styles.activeText}>Active</Text>
            </View>
          </View>
        )}
      </View>

      {showUpgradeButton && statusInfo.type !== 'premium' && (
        <TouchableOpacity
          onPress={handleUpgradePress}
          style={styles.upgradeButtonDetailed}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Upgrade to premium"
        >
          <LinearGradient
            colors={['#84cc16', '#65a30d']}
            style={styles.upgradeButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <MaterialIcons name="star" size={18} color="#ffffff" />
            <Text style={styles.upgradeButtonDetailedText}>Upgrade to Premium</Text>
            <MaterialIcons name="arrow-forward" size={18} color="#ffffff" />
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
  },
  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginLeft: 8,
  },

  // Compact variant
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  compactText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  upgradeButtonCompact: {
    backgroundColor: '#84cc16',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  upgradeButtonCompactText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },

  // Banner variant
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  premiumBanner: {
    borderWidth: 0,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  bannerText: {
    marginLeft: 12,
    flex: 1,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  bannerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
  },
  upgradeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 16,
    marginLeft: 12,
  },
  upgradeButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Detailed variant
  detailed: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
  },
  detailedHeader: {
    marginBottom: 16,
  },
  detailedTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  detailedTitleText: {
    marginLeft: 12,
    flex: 1,
  },
  detailedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  detailedSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  expiryInfo: {
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
  },
  expiryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 2,
  },
  expiryDate: {
    fontSize: 11,
    color: '#6B7280',
  },
  usageStats: {
    marginBottom: 16,
  },
  statItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  statLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  statValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  activeStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  activeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10B981',
  },
  upgradeButtonDetailed: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  upgradeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  upgradeButtonDetailedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginHorizontal: 8,
  },
});