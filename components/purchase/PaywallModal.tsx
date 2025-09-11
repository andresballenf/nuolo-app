import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Dimensions,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Button } from '../ui/Button';
import { usePurchase } from '../../contexts/PurchaseContext';
import type { SubscriptionPlan, AttractionPackage } from '../../contexts/PurchaseContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  trigger?: 'free_limit' | 'premium_attraction' | 'manual';
}

type TabType = 'subscription' | 'packages';

export const PaywallModal: React.FC<PaywallModalProps> = ({
  visible,
  onClose,
  trigger,
}) => {
  const insets = useSafeAreaInsets();
  const {
    subscriptionPlans,
    attractionPackages,
    purchaseSubscription,
    purchasePackage,
    restorePurchases,
    entitlements,
    isLoading,
    purchaseError,
    clearError,
    pricingVariant,
  } = usePurchase();

  const [activeTab, setActiveTab] = useState<TabType>('subscription');
  const [purchasingId, setPurchasingId] = useState<string | null>(null);

  // A/B testing pricing variants
  const getVariantPricing = (plan: SubscriptionPlan) => {
    if (pricingVariant === 'B' && plan.period === 'yearly') {
      // Variant B: Show monthly equivalent pricing
      const monthlyEquivalent = (plan.price / 12).toFixed(2);
      return {
        ...plan,
        displayPrice: `$${monthlyEquivalent}/month`,
        subtitle: `Billed annually ($${plan.localizedPrice || plan.price})`,
      };
    }
    
    return {
      ...plan,
      displayPrice: plan.localizedPrice || `$${plan.price}/${plan.period === 'yearly' ? 'year' : 'month'}`,
    };
  };

  const handleSubscriptionPurchase = useCallback(async (planId: string) => {
    try {
      setPurchasingId(planId);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const success = await purchaseSubscription(planId);
      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Subscription purchase error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setPurchasingId(null);
    }
  }, [purchaseSubscription]);

  const handlePackagePurchase = useCallback(async (packageId: string) => {
    try {
      setPurchasingId(packageId);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const success = await purchasePackage(packageId);
      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Package purchase error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setPurchasingId(null);
    }
  }, [purchasePackage]);

  const handleRestore = useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await restorePurchases();
    } catch (error) {
      console.error('Restore error:', error);
    }
  }, [restorePurchases]);

  const getHeaderContent = () => {
    switch (trigger) {
      case 'free_limit':
        return {
          title: 'You\'ve used your free guides!',
          subtitle: `${entitlements.freeGuidesUsed}/${entitlements.freeGuidesLimit} free audio guides used`,
          icon: 'audiotrack',
        };
      case 'premium_attraction':
        return {
          title: 'Premium Attraction',
          subtitle: 'This attraction requires a premium package or subscription',
          icon: 'star',
        };
      default:
        return {
          title: 'Unlock Premium Features',
          subtitle: 'Get unlimited access to all audio guides',
          icon: 'lock-open',
        };
    }
  };

  const headerContent = getHeaderContent();

  const renderSubscriptionPlan = (plan: SubscriptionPlan) => {
    const variantPlan = getVariantPricing(plan);
    const isLoading = purchasingId === plan.id;
    
    return (
      <TouchableOpacity
        key={plan.id}
        style={[
          styles.planCard,
          plan.popular && styles.popularPlan,
        ]}
        onPress={() => handleSubscriptionPurchase(plan.id)}
        disabled={isLoading}
        activeOpacity={0.8}
      >
        {plan.popular && (
          <View style={styles.popularBadge}>
            <Text style={styles.popularBadgeText}>Most Popular</Text>
          </View>
        )}
        
        <View style={styles.planHeader}>
          <Text style={styles.planName}>{plan.name}</Text>
          {plan.discount && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>{plan.discount}</Text>
            </View>
          )}
        </View>
        
        <Text style={styles.planPrice}>{variantPlan.displayPrice}</Text>
        {variantPlan.subtitle && (
          <Text style={styles.planSubtitle}>{variantPlan.subtitle}</Text>
        )}
        
        <Text style={styles.planDescription}>{plan.description}</Text>
        
        <View style={styles.featuresContainer}>
          {plan.features.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <MaterialIcons name="check-circle" size={16} color="#84cc16" />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>
        
        <Button
          title={isLoading ? 'Processing...' : 'Subscribe Now'}
          variant={plan.popular ? 'primary' : 'outline'}
          loading={isLoading}
          disabled={isLoading}
          style={[styles.planButton, plan.popular && styles.popularPlanButton]}
        />
      </TouchableOpacity>
    );
  };

  const renderAttractionPackage = (pkg: AttractionPackage) => {
    const isLoading = purchasingId === pkg.id;
    
    return (
      <TouchableOpacity
        key={pkg.id}
        style={[
          styles.packageCard,
          pkg.popular && styles.popularPackage,
        ]}
        onPress={() => handlePackagePurchase(pkg.id)}
        disabled={isLoading}
        activeOpacity={0.8}
      >
        {pkg.popular && (
          <View style={styles.popularBadge}>
            <Text style={styles.popularBadgeText}>Popular</Text>
          </View>
        )}
        
        <View style={styles.packageHeader}>
          <MaterialIcons name="place" size={24} color="#84cc16" />
          <Text style={styles.packageName}>{pkg.name}</Text>
        </View>
        
        <Text style={styles.packagePrice}>
          {pkg.localizedPrice || `$${pkg.price}`}
        </Text>
        
        <Text style={styles.packageDescription}>{pkg.description}</Text>
        
        <View style={styles.packageDetails}>
          <View style={styles.packageDetail}>
            <MaterialIcons name="audiotrack" size={16} color="#6B7280" />
            <Text style={styles.packageDetailText}>
              {pkg.attractions.length} audio guides
            </Text>
          </View>
          <View style={styles.packageDetail}>
            <MaterialIcons name="download" size={16} color="#6B7280" />
            <Text style={styles.packageDetailText}>Offline access</Text>
          </View>
        </View>
        
        <Button
          title={isLoading ? 'Processing...' : 'Buy Package'}
          variant="outline"
          loading={isLoading}
          disabled={isLoading}
          style={styles.packageButton}
        />
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header with gradient */}
        <LinearGradient
          colors={['#84cc16', '#65a30d']}
          style={styles.header}
        >
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            accessibilityLabel="Close paywall"
            accessibilityRole="button"
          >
            <MaterialIcons name="close" size={24} color="white" />
          </TouchableOpacity>
          
          <View style={styles.headerContent}>
            <MaterialIcons 
              name={headerContent.icon as any} 
              size={48} 
              color="white" 
            />
            <Text style={styles.headerTitle}>{headerContent.title}</Text>
            <Text style={styles.headerSubtitle}>{headerContent.subtitle}</Text>
          </View>
        </LinearGradient>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'subscription' && styles.activeTab,
            ]}
            onPress={() => setActiveTab('subscription')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'subscription' && styles.activeTabText,
              ]}
            >
              Unlimited Access
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'packages' && styles.activeTab,
            ]}
            onPress={() => setActiveTab('packages')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'packages' && styles.activeTabText,
              ]}
            >
              Attraction Packages
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView 
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contentContainer}
        >
          {activeTab === 'subscription' ? (
            <View style={styles.plansContainer}>
              {subscriptionPlans.map(renderSubscriptionPlan)}
            </View>
          ) : (
            <View style={styles.packagesContainer}>
              {attractionPackages.map(renderAttractionPackage)}
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity
            style={styles.restoreButton}
            onPress={handleRestore}
            disabled={isLoading}
          >
            <Text style={styles.restoreText}>Restore Purchases</Text>
          </TouchableOpacity>
          
          <View style={styles.legalLinks}>
            <TouchableOpacity>
              <Text style={styles.legalText}>Terms of Service</Text>
            </TouchableOpacity>
            <Text style={styles.legalSeparator}>•</Text>
            <TouchableOpacity>
              <Text style={styles.legalText}>Privacy Policy</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Error Display */}
        {purchaseError && (
          <View style={styles.errorContainer}>
            <View style={styles.errorContent}>
              <MaterialIcons name="error" size={24} color="#EF4444" />
              <Text style={styles.errorText}>{purchaseError.userFriendly}</Text>
              <TouchableOpacity onPress={clearError}>
                <MaterialIcons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  
  // Header styles
  header: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 24,
    zIndex: 1,
    padding: 8,
  },
  headerContent: {
    alignItems: 'center',
    marginTop: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginTop: 16,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginTop: 8,
  },
  
  // Tab styles
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    margin: 16,
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#1F2937',
  },
  
  // Content styles
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  
  // Subscription plan styles
  plansContainer: {
    gap: 16,
  },
  planCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    position: 'relative',
  },
  popularPlan: {
    borderColor: '#84cc16',
    transform: [{ scale: 1.02 }],
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    alignSelf: 'center',
    backgroundColor: '#84cc16',
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  planName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  discountBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  discountText: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '600',
  },
  planPrice: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#84cc16',
    marginBottom: 4,
  },
  planSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  planDescription: {
    fontSize: 16,
    color: '#4B5563',
    marginBottom: 16,
  },
  featuresContainer: {
    marginBottom: 24,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    fontSize: 14,
    color: '#4B5563',
    marginLeft: 8,
    flex: 1,
  },
  planButton: {
    marginTop: 'auto',
  },
  popularPlanButton: {
    shadowColor: '#84cc16',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  
  // Package styles
  packagesContainer: {
    gap: 16,
  },
  packageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    position: 'relative',
  },
  popularPackage: {
    borderColor: '#84cc16',
    borderWidth: 2,
  },
  packageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  packageName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginLeft: 8,
  },
  packagePrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#84cc16',
    marginBottom: 8,
  },
  packageDescription: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 16,
  },
  packageDetails: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 16,
  },
  packageDetail: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  packageDetailText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  packageButton: {
    marginTop: 'auto',
  },
  
  // Footer styles
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    alignItems: 'center',
  },
  restoreButton: {
    paddingVertical: 12,
    marginBottom: 16,
  },
  restoreText: {
    fontSize: 16,
    color: '#84cc16',
    fontWeight: '600',
  },
  legalLinks: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legalText: {
    fontSize: 12,
    color: '#6B7280',
  },
  legalSeparator: {
    fontSize: 12,
    color: '#6B7280',
    marginHorizontal: 8,
  },
  
  // Error styles
  errorContainer: {
    position: 'absolute',
    top: 100,
    left: 16,
    right: 16,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  errorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#7F1D1D',
    marginLeft: 8,
  },
});