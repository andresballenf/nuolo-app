import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';

import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { usePurchase } from '../../contexts/PurchaseContext';
import { useAuth } from '../../contexts/AuthContext';

interface SubscriptionManagerProps {
  onUpgrade?: () => void;
  onManageBilling?: () => void;
}

export const SubscriptionManager: React.FC<SubscriptionManagerProps> = ({
  onUpgrade,
  onManageBilling,
}) => {
  const { user } = useAuth();
  const {
    entitlements,
    subscriptionPlans,
    attractionPackages,
    restorePurchases,
    isLoading,
    showPaywall,
  } = usePurchase();

  const [isRestoring, setIsRestoring] = useState(false);

  const handleRestore = useCallback(async () => {
    try {
      setIsRestoring(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await restorePurchases();
    } catch (error) {
      console.error('Restore error:', error);
      Alert.alert('Error', 'Failed to restore purchases. Please try again.');
    } finally {
      setIsRestoring(false);
    }
  }, [restorePurchases]);

  const handleManageBilling = useCallback(() => {
    if (onManageBilling) {
      onManageBilling();
      return;
    }

    // Platform-specific billing management
    const url = Platform.select({
      ios: 'https://apps.apple.com/account/subscriptions',
      android: 'https://play.google.com/store/account/subscriptions',
      default: 'https://nuolo.com/account', // Your web account page
    });

    Linking.openURL(url).catch(err => {
      console.error('Failed to open billing URL:', err);
      Alert.alert('Error', 'Unable to open billing management. Please visit your app store account.');
    });
  }, [onManageBilling]);

  const getStatusColor = () => {
    switch (entitlements.status) {
      case 'unlimited':
        return '#10B981'; // Green
      case 'premium':
        return '#F59E0B'; // Amber
      default:
        return '#6B7280'; // Gray
    }
  };

  const getStatusIcon = () => {
    switch (entitlements.status) {
      case 'unlimited':
        return 'verified';
      case 'premium':
        return 'star';
      default:
        return 'account-circle';
    }
  };

  const getCurrentPlan = () => {
    if (entitlements.status === 'unlimited') {
      return subscriptionPlans.find(plan => 
        entitlements.subscriptionExpiry && 
        (new Date().getTime() < entitlements.subscriptionExpiry.getTime())
      );
    }
    return null;
  };

  const isSubscriptionActive = () => {
    return entitlements.status === 'unlimited' && 
           entitlements.subscriptionExpiry && 
           new Date() < entitlements.subscriptionExpiry;
  };

  const getDaysUntilExpiry = () => {
    if (!entitlements.subscriptionExpiry) return null;
    
    const now = new Date();
    const expiry = entitlements.subscriptionExpiry;
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };

  const currentPlan = getCurrentPlan();
  const daysUntilExpiry = getDaysUntilExpiry();
  const isActive = isSubscriptionActive();

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Account Status Card */}
      <Card style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <View style={styles.statusIconContainer}>
            <MaterialIcons 
              name={getStatusIcon() as any} 
              size={32} 
              color={getStatusColor()} 
            />
          </View>
          <View style={styles.statusInfo}>
            <Text style={styles.statusTitle}>
              {entitlements.status === 'unlimited' ? 'Premium Subscriber' :
               entitlements.status === 'premium' ? 'Premium User' :
               'Free User'}
            </Text>
            <Text style={styles.statusEmail}>{user?.email}</Text>
          </View>
        </View>

        {/* Subscription Details */}
        {entitlements.status === 'unlimited' && entitlements.subscriptionExpiry && (
          <View style={styles.subscriptionDetails}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Plan:</Text>
              <Text style={styles.detailValue}>
                {currentPlan?.name || 'Premium Subscription'}
              </Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Status:</Text>
              <View style={styles.statusBadge}>
                <MaterialIcons 
                  name={isActive ? 'check-circle' : 'cancel'} 
                  size={16} 
                  color={isActive ? '#10B981' : '#EF4444'} 
                />
                <Text style={[
                  styles.statusBadgeText,
                  { color: isActive ? '#10B981' : '#EF4444' }
                ]}>
                  {isActive ? 'Active' : 'Expired'}
                </Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>
                {isActive ? 'Renews:' : 'Expired:'}
              </Text>
              <Text style={styles.detailValue}>
                {format(entitlements.subscriptionExpiry, 'MMM dd, yyyy')}
              </Text>
            </View>

            {daysUntilExpiry !== null && isActive && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Days remaining:</Text>
                <Text style={[
                  styles.detailValue,
                  daysUntilExpiry <= 7 && styles.warningText
                ]}>
                  {daysUntilExpiry} days
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Free Tier Usage */}
        {entitlements.status === 'free' && (
          <View style={styles.freeUsageContainer}>
            <Text style={styles.usageTitle}>Free Guides Used</Text>
            <View style={styles.usageBar}>
              <View 
                style={[
                  styles.usageProgress,
                  { 
                    width: `${(entitlements.freeGuidesUsed / entitlements.freeGuidesLimit) * 100}%`,
                    backgroundColor: entitlements.freeGuidesUsed >= entitlements.freeGuidesLimit ? '#EF4444' : '#84cc16'
                  }
                ]}
              />
            </View>
            <Text style={styles.usageText}>
              {entitlements.freeGuidesUsed} of {entitlements.freeGuidesLimit} used
            </Text>
            
            {entitlements.freeGuidesUsed >= entitlements.freeGuidesLimit && (
              <View style={styles.limitReachedContainer}>
                <MaterialIcons name="info" size={20} color="#F59E0B" />
                <Text style={styles.limitReachedText}>
                  You've reached your free limit. Upgrade to get unlimited access!
                </Text>
              </View>
            )}
          </View>
        )}
      </Card>

      {/* Owned Packages */}
      {entitlements.ownedPackages.length > 0 && (
        <Card style={styles.packagesCard}>
          <Text style={styles.cardTitle}>Your Attraction Packages</Text>
          {entitlements.ownedPackages.map((packageId) => {
            const pkg = attractionPackages.find(p => p.id === packageId);
            if (!pkg) return null;

            return (
              <View key={packageId} style={styles.packageItem}>
                <View style={styles.packageIcon}>
                  <MaterialIcons name="place" size={20} color="#84cc16" />
                </View>
                <View style={styles.packageInfo}>
                  <Text style={styles.packageName}>{pkg.name}</Text>
                  <Text style={styles.packageDescription}>
                    {pkg.attractions.length} attractions included
                  </Text>
                </View>
                <MaterialIcons name="check-circle" size={20} color="#10B981" />
              </View>
            );
          })}
        </Card>
      )}

      {/* Action Buttons */}
      <Card style={styles.actionsCard}>
        <Text style={styles.cardTitle}>Account Actions</Text>

        {/* Upgrade Button */}
        {entitlements.status !== 'unlimited' && (
          <Button
            title="Upgrade to Premium"
            variant="primary"
            style={styles.actionButton}
            onPress={() => {
              if (onUpgrade) {
                onUpgrade();
              } else {
                showPaywall('manual');
              }
            }}
          />
        )}

        {/* Manage Billing Button */}
        {entitlements.status === 'unlimited' && (
          <Button
            title="Manage Billing"
            variant="outline"
            style={styles.actionButton}
            onPress={handleManageBilling}
          />
        )}

        {/* Restore Purchases Button */}
        <Button
          title="Restore Purchases"
          variant="outline"
          style={styles.actionButton}
          loading={isRestoring}
          disabled={isRestoring}
          onPress={handleRestore}
        />

        {/* Contact Support */}
        <TouchableOpacity
          style={styles.supportButton}
          onPress={() => {
            const emailUrl = 'mailto:support@nuolo.com?subject=Account Support';
            Linking.openURL(emailUrl);
          }}
        >
          <MaterialIcons name="help" size={20} color="#6B7280" />
          <Text style={styles.supportText}>Contact Support</Text>
        </TouchableOpacity>
      </Card>

      {/* Billing Information */}
      <Card style={styles.billingInfoCard}>
        <Text style={styles.cardTitle}>Billing Information</Text>
        
        <View style={styles.infoItem}>
          <MaterialIcons name="payment" size={20} color="#6B7280" />
          <Text style={styles.infoText}>
            Billing is managed through your {Platform.OS === 'ios' ? 'App Store' : 'Google Play'} account
          </Text>
        </View>

        <View style={styles.infoItem}>
          <MaterialIcons name="security" size={20} color="#6B7280" />
          <Text style={styles.infoText}>
            Your payment information is secure and encrypted
          </Text>
        </View>

        <View style={styles.infoItem}>
          <MaterialIcons name="cancel" size={20} color="#6B7280" />
          <Text style={styles.infoText}>
            Cancel anytime from your account settings
          </Text>
        </View>

        {entitlements.lastPurchaseDate && (
          <View style={styles.lastPurchaseContainer}>
            <Text style={styles.lastPurchaseText}>
              Last purchase: {format(entitlements.lastPurchaseDate, 'MMM dd, yyyy')}
            </Text>
          </View>
        )}
      </Card>

      {/* Development Info (remove in production) */}
      {__DEV__ && (
        <Card style={styles.debugCard}>
          <Text style={styles.cardTitle}>Debug Info</Text>
          <Text style={styles.debugText}>
            Status: {entitlements.status}
          </Text>
          <Text style={styles.debugText}>
            Free guides: {entitlements.freeGuidesUsed}/{entitlements.freeGuidesLimit}
          </Text>
          <Text style={styles.debugText}>
            Packages: {entitlements.ownedPackages.length}
          </Text>
          {entitlements.subscriptionExpiry && (
            <Text style={styles.debugText}>
              Expiry: {entitlements.subscriptionExpiry.toISOString()}
            </Text>
          )}
        </Card>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#F9FAFB',
  },

  // Status Card
  statusCard: {
    marginBottom: 16,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  statusEmail: {
    fontSize: 14,
    color: '#6B7280',
  },

  // Subscription Details
  subscriptionDetails: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusBadgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  warningText: {
    color: '#F59E0B',
  },

  // Free Usage
  freeUsageContainer: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 16,
  },
  usageTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  usageBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  usageProgress: {
    height: '100%',
    borderRadius: 4,
  },
  usageText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  limitReachedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  limitReachedText: {
    fontSize: 14,
    color: '#92400E',
    marginLeft: 8,
    flex: 1,
  },

  // Packages Card
  packagesCard: {
    marginBottom: 16,
  },
  packageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  packageIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  packageInfo: {
    flex: 1,
  },
  packageName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  packageDescription: {
    fontSize: 14,
    color: '#6B7280',
  },

  // Actions Card
  actionsCard: {
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  actionButton: {
    marginBottom: 12,
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  supportText: {
    fontSize: 16,
    color: '#6B7280',
    marginLeft: 8,
  },

  // Billing Info
  billingInfoCard: {
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#4B5563',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  lastPurchaseContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  lastPurchaseText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },

  // Debug Card
  debugCard: {
    marginBottom: 16,
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 1,
  },
  debugText: {
    fontSize: 12,
    color: '#92400E',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});