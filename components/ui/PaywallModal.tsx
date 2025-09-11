import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Button } from './Button';
import { useMonetization } from '../../contexts/MonetizationContext';
import { format } from 'date-fns';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  trigger?: 'free_limit' | 'premium_attraction' | 'manual';
  attractionId?: string;
  attractionName?: string;
}

interface FeatureHighlight {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  description: string;
}

const FEATURES: FeatureHighlight[] = [
  {
    icon: 'headset',
    title: 'Unlimited Audio Guides',
    description: 'Access thousands of professional audio guides worldwide',
  },
  {
    icon: 'download',
    title: 'Offline Listening',
    description: 'Download guides for offline use without internet',
  },
  {
    icon: 'high-quality',
    title: 'Premium Narration',
    description: 'High-quality audio with expert local storytelling',
  },
  {
    icon: 'star',
    title: 'Exclusive Content',
    description: 'Get access to hidden gems and insider stories',
  },
  {
    icon: 'support',
    title: 'Priority Support',
    description: '24/7 customer support for premium subscribers',
  },
];

const PRICING_VARIANTS = {
  A: {
    monthly: { price: 4.99, label: '$4.99/month' },
    yearly: { price: 39.99, label: '$39.99/year', savings: '33% off' },
  },
  B: {
    monthly: { price: 5.99, label: '$5.99/month' },
    yearly: { price: 47.99, label: '$47.99/year', savings: '34% off' },
  },
};

export const PaywallModal: React.FC<PaywallModalProps> = ({
  visible,
  onClose,
  trigger = 'manual',
  attractionId,
  attractionName,
}) => {
  const {
    subscription,
    entitlements,
    loading,
    error,
    attractionPacks,
    purchaseSubscription,
    purchasePack,
    restorePurchases,
  } = useMonetization();

  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [pricingVariant] = useState<'A' | 'B'>(() => Math.random() > 0.5 ? 'A' : 'B');
  const [showFeatures, setShowFeatures] = useState(false);

  // Auto-select yearly plan to highlight savings
  useEffect(() => {
    setSelectedPlan('yearly');
  }, [visible]);

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const handlePurchaseSubscription = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const success = await purchaseSubscription(selectedPlan);
      
      if (success) {
        onClose();
        Alert.alert(
          'Welcome to Premium!',
          'You now have unlimited access to all audio guides. Enjoy exploring!'
        );
      }
    } catch (err) {
      console.error('Subscription purchase failed:', err);
    }
  };

  const handlePurchasePack = async (packId: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const success = await purchasePack(packId);
      
      if (success) {
        onClose();
        Alert.alert(
          'Pack Purchased!',
          'You now have access to all attractions in this pack.'
        );
      }
    } catch (err) {
      console.error('Pack purchase failed:', err);
    }
  };

  const handleRestorePurchases = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await restorePurchases();
      
      Alert.alert(
        'Purchases Restored',
        'Your previous purchases have been successfully restored.'
      );
    } catch (err) {
      console.error('Restore purchases failed:', err);
    }
  };

  const getHeaderContent = () => {
    switch (trigger) {
      case 'free_limit':
        return {
          title: "You've used your free audio guides!",
          subtitle: `You've used ${2 - entitlements.remainingFreeAttractions}/2 free guides. Upgrade for unlimited access.`,
          emoji: '🎧',
        };
      case 'premium_attraction':
        return {
          title: attractionName ? `Unlock ${attractionName}` : 'Unlock Premium Content',
          subtitle: attractionName 
            ? `Get unlimited access to ${attractionName} and thousands more attractions worldwide.`
            : 'Get unlimited access to premium attractions worldwide.',
          emoji: '✨',
        };
      default:
        return {
          title: 'Upgrade to Premium',
          subtitle: 'Unlock unlimited audio guides and premium features',
          emoji: '🌟',
        };
    }
  };

  const headerContent = getHeaderContent();
  const currentPricing = PRICING_VARIANTS[pricingVariant];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header with gradient */}
        <LinearGradient
          colors={['#84cc16', '#65a30d']}
          style={styles.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <MaterialIcons name="close" size={24} color="#ffffff" />
          </TouchableOpacity>

          <View style={styles.headerContent}>
            <Text style={styles.headerEmoji}>{headerContent.emoji}</Text>
            <Text style={styles.headerTitle}>{headerContent.title}</Text>
            <Text style={styles.headerSubtitle}>{headerContent.subtitle}</Text>
          </View>
        </LinearGradient>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Subscription Plans */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Choose Your Plan</Text>
            
            {/* Monthly Plan */}
            <TouchableOpacity
              style={[
                styles.planCard,
                selectedPlan === 'monthly' && styles.planCardSelected,
              ]}
              onPress={() => setSelectedPlan('monthly')}
              accessible={true}
              accessibilityRole="radio"
              accessibilityState={{ selected: selectedPlan === 'monthly' }}
            >
              <View style={styles.planHeader}>
                <View style={styles.planInfo}>
                  <Text style={styles.planName}>Premium Monthly</Text>
                  <Text style={styles.planPrice}>{currentPricing.monthly.label}</Text>
                </View>
                <View style={[
                  styles.radioButton,
                  selectedPlan === 'monthly' && styles.radioButtonSelected,
                ]}>
                  {selectedPlan === 'monthly' && (
                    <MaterialIcons name="check" size={16} color="#ffffff" />
                  )}
                </View>
              </View>
              <Text style={styles.planDescription}>
                Unlimited access to all audio guides
              </Text>
            </TouchableOpacity>

            {/* Yearly Plan */}
            <TouchableOpacity
              style={[
                styles.planCard,
                styles.planCardPopular,
                selectedPlan === 'yearly' && styles.planCardSelected,
              ]}
              onPress={() => setSelectedPlan('yearly')}
              accessible={true}
              accessibilityRole="radio"
              accessibilityState={{ selected: selectedPlan === 'yearly' }}
            >
              <View style={styles.popularBadge}>
                <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
              </View>
              
              <View style={styles.planHeader}>
                <View style={styles.planInfo}>
                  <Text style={styles.planName}>Premium Yearly</Text>
                  <View style={styles.planPricing}>
                    <Text style={styles.planPrice}>{currentPricing.yearly.label}</Text>
                    <View style={styles.savingsBadge}>
                      <Text style={styles.savingsText}>{currentPricing.yearly.savings}</Text>
                    </View>
                  </View>
                </View>
                <View style={[
                  styles.radioButton,
                  selectedPlan === 'yearly' && styles.radioButtonSelected,
                ]}>
                  {selectedPlan === 'yearly' && (
                    <MaterialIcons name="check" size={16} color="#ffffff" />
                  )}
                </View>
              </View>
              <Text style={styles.planDescription}>
                Best value • Unlimited access + exclusive content
              </Text>
            </TouchableOpacity>
          </View>

          {/* Features Section */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.featuresHeader}
              onPress={() => setShowFeatures(!showFeatures)}
              accessible={true}
              accessibilityRole="button"
              accessibilityState={{ expanded: showFeatures }}
            >
              <Text style={styles.sectionTitle}>What's included</Text>
              <MaterialIcons 
                name={showFeatures ? "keyboard-arrow-up" : "keyboard-arrow-down"} 
                size={24} 
                color="#6B7280" 
              />
            </TouchableOpacity>

            {showFeatures && (
              <View style={styles.featuresContainer}>
                {FEATURES.map((feature, index) => (
                  <View key={index} style={styles.featureItem}>
                    <View style={styles.featureIcon}>
                      <MaterialIcons name={feature.icon} size={20} color="#84cc16" />
                    </View>
                    <View style={styles.featureContent}>
                      <Text style={styles.featureTitle}>{feature.title}</Text>
                      <Text style={styles.featureDescription}>{feature.description}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Attraction Packs (if applicable) */}
          {attractionPacks.length > 0 && trigger === 'premium_attraction' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Or buy individual packs</Text>
              
              {attractionPacks.slice(0, 3).map((pack) => (
                <TouchableOpacity
                  key={pack.id}
                  style={styles.packCard}
                  onPress={() => handlePurchasePack(pack.id)}
                  disabled={loading}
                >
                  <View style={styles.packInfo}>
                    <Text style={styles.packName}>{pack.name}</Text>
                    <Text style={styles.packDescription}>{pack.description}</Text>
                    <Text style={styles.packAttractions}>
                      {pack.attraction_ids.length} attractions included
                    </Text>
                  </View>
                  <View style={styles.packPrice}>
                    <Text style={styles.packPriceText}>${pack.price_usd}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Error Display */}
          {error && (
            <View style={styles.errorContainer}>
              <MaterialIcons name="error-outline" size={20} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>

        {/* Bottom Actions */}
        <View style={styles.bottomActions}>
          <Button
            title={loading ? 'Processing...' : `Start ${selectedPlan === 'yearly' ? 'Yearly' : 'Monthly'} Plan`}
            onPress={handlePurchaseSubscription}
            disabled={loading}
            loading={loading}
            size="lg"
            style={styles.subscribeButton}
          />

          <View style={styles.footerActions}>
            <TouchableOpacity
              onPress={handleRestorePurchases}
              disabled={loading}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Restore previous purchases"
            >
              <Text style={styles.linkText}>Restore Purchases</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleClose}
              disabled={loading}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Maybe later"
            >
              <Text style={styles.linkText}>Maybe Later</Text>
            </TouchableOpacity>
          </View>

          {/* Legal Text */}
          <Text style={styles.legalText}>
            Subscriptions auto-renew unless cancelled. You can cancel anytime in Settings.
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 30,
    paddingHorizontal: 20,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  headerContent: {
    alignItems: 'center',
    paddingTop: 20,
  },
  headerEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 22,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  planCard: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    position: 'relative',
  },
  planCardPopular: {
    borderColor: '#84cc16',
    backgroundColor: '#F7FEE7',
  },
  planCardSelected: {
    borderColor: '#84cc16',
    backgroundColor: '#F7FEE7',
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    left: 16,
    backgroundColor: '#84cc16',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  planInfo: {
    flex: 1,
  },
  planName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  planPricing: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  planPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#84cc16',
  },
  savingsBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  savingsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
  },
  planDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    backgroundColor: '#84cc16',
    borderColor: '#84cc16',
  },
  featuresHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
  },
  featuresContainer: {
    marginTop: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F9FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  packCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  packInfo: {
    flex: 1,
  },
  packName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  packDescription: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  packAttractions: {
    fontSize: 11,
    color: '#84cc16',
    fontWeight: '500',
  },
  packPrice: {
    paddingLeft: 12,
  },
  packPriceText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    marginLeft: 8,
    flex: 1,
  },
  bottomActions: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  subscribeButton: {
    marginBottom: 16,
  },
  footerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  linkText: {
    fontSize: 14,
    color: '#6B7280',
    textDecorationLine: 'underline',
  },
  legalText: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 16,
  },
});