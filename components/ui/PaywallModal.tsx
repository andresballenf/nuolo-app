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
import { AttractionPackage } from '../../services/MonetizationService';

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

const PACKAGE_FEATURES: Record<string, FeatureHighlight[]> = {
  basic: [
    {
      icon: 'headset',
      title: '5 Audio Guides',
      description: 'Perfect for exploring a new destination',
    },
    {
      icon: 'offline-pin',
      title: 'Offline Access',
      description: 'Download and listen without internet',
    },
  ],
  standard: [
    {
      icon: 'headset',
      title: '20 Audio Guides',
      description: 'Great for frequent travelers and explorers',
    },
    {
      icon: 'offline-pin',
      title: 'Offline Access',
      description: 'Download and listen without internet',
    },
    {
      icon: 'star',
      title: 'Premium Content',
      description: 'Access to exclusive audio guides',
    },
  ],
  premium: [
    {
      icon: 'headset',
      title: '50 Audio Guides',
      description: 'Maximum value for travel enthusiasts',
    },
    {
      icon: 'offline-pin',
      title: 'Offline Access',
      description: 'Download and listen without internet',
    },
    {
      icon: 'star',
      title: 'Premium Content',
      description: 'Access to all exclusive audio guides',
    },
  ],
};

const UNLIMITED_FEATURES: FeatureHighlight[] = [
  {
    icon: 'all-inclusive',
    title: 'Unlimited Access',
    description: 'Listen to as many guides as you want',
  },
  {
    icon: 'update',
    title: 'New Content Monthly',
    description: 'Fresh audio guides added regularly',
  },
  {
    icon: 'high-quality',
    title: 'Premium Narration',
    description: 'High-quality audio with expert storytelling',
  },
];

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
    purchaseSubscription,
    purchaseAttractionPackage,
    restorePurchases,
    loading,
    error,
  } = useMonetization();
  
  const [purchasing, setPurchasing] = useState(false);
  const [selectedOption, setSelectedOption] = useState<'basic' | 'standard' | 'premium' | 'unlimited'>('standard');
  const [packages, setPackages] = useState<AttractionPackage[]>([]);
  const [showPackages, setShowPackages] = useState(true);

  useEffect(() => {
    if (visible) {
      // Reset any previous error states
      loadPackages();
    }
  }, [visible]);

  const loadPackages = async () => {
    try {
      // Mock packages data - in real app would come from MonetizationService
      const mockPackages: AttractionPackage[] = [
        {
          id: 'basic_package',
          name: 'Basic Package',
          description: 'Perfect for trying out premium content',
          attraction_count: 5,
          price_usd: 3.99,
          apple_product_id: 'nuolo_basic_package',
          google_product_id: 'nuolo_basic_package',
          sort_order: 1,
          active: true,
        },
        {
          id: 'standard_package',
          name: 'Standard Package',
          description: 'Great value for regular travelers',
          attraction_count: 20,
          price_usd: 9.99,
          apple_product_id: 'nuolo_standard_package',
          google_product_id: 'nuolo_standard_package',
          sort_order: 2,
          badge_text: 'Most Popular',
          active: true,
        },
        {
          id: 'premium_package',
          name: 'Premium Package',
          description: 'Maximum flexibility for frequent explorers',
          attraction_count: 50,
          price_usd: 19.99,
          apple_product_id: 'nuolo_premium_package',
          google_product_id: 'nuolo_premium_package',
          sort_order: 3,
          badge_text: 'Best Value',
          active: true,
        },
      ];
      setPackages(mockPackages);
    } catch (error) {
      console.error('Failed to load packages:', error);
    }
  };

  const handlePurchase = async () => {
    setPurchasing(true);
    
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      let success = false;
      let successMessage = '';
      
      if (selectedOption === 'unlimited') {
        success = await purchaseSubscription('unlimited_monthly');
        successMessage = 'Welcome to Nuolo Unlimited! You now have unlimited access to all audio guides.';
      } else {
        const selectedPackage = packages.find(pkg => pkg.id === `${selectedOption}_package`);
        if (selectedPackage && purchaseAttractionPackage) {
          success = await purchaseAttractionPackage(selectedPackage.id);
          successMessage = `Welcome to Nuolo ${selectedPackage.name}! You now have access to ${selectedPackage.attraction_count} audio guides.`;
        }
      }
      
      if (success) {
        Alert.alert(
          'Purchase Successful! 🎉',
          successMessage,
          [{ text: 'Start Exploring', onPress: onClose }]
        );
      } else {
        Alert.alert(
          'Purchase Failed',
          'Something went wrong with your purchase. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Purchase error:', error);
      Alert.alert(
        'Purchase Error',
        'An unexpected error occurred. Please try again later.',
        [{ text: 'OK' }]
      );
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestorePurchases = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await restorePurchases();
      Alert.alert(
        'Purchases Restored',
        'Your previous purchases have been successfully restored.'
      );
    } catch (err) {
      console.error('Restore purchases failed:', err);
      Alert.alert(
        'Restore Failed',
        'Unable to restore purchases. Please try again later.'
      );
    }
  };

  const getOptionPrice = (option: 'basic' | 'standard' | 'premium' | 'unlimited') => {
    if (option === 'unlimited') return '$29.99/month';
    const pkg = packages.find(p => p.id === `${option}_package`);
    return pkg ? `$${pkg.price_usd}` : '$0';
  };

  const renderPackageOption = (pkg: AttractionPackage, optionKey: 'basic' | 'standard' | 'premium') => {
    const isSelected = selectedOption === optionKey;
    const pricePerAttraction = (pkg.price_usd / pkg.attraction_count).toFixed(2);
    
    return (
      <TouchableOpacity
        key={pkg.id}
        style={[
          styles.packageOption,
          isSelected && styles.packageOptionSelected,
          optionKey === 'standard' && styles.popularPackage,
        ]}
        onPress={() => setSelectedOption(optionKey)}
        activeOpacity={0.7}
      >
        {pkg.badge_text && (
          <View style={[styles.badge, optionKey === 'standard' ? styles.popularBadge : styles.valueBadge]}>
            <Text style={styles.badgeText}>{pkg.badge_text}</Text>
          </View>
        )}
        
        <View style={styles.packageHeader}>
          <Text style={[styles.packageName, isSelected && styles.packageNameSelected]}>
            {pkg.name}
          </Text>
          <Text style={[styles.packagePrice, isSelected && styles.packagePriceSelected]}>
            ${pkg.price_usd}
          </Text>
        </View>
        
        <Text style={[styles.packageDescription, isSelected && styles.packageDescriptionSelected]}>
          {pkg.attraction_count} audio guides
        </Text>
        
        <Text style={styles.pricePerUnit}>
          Only ${pricePerAttraction} per guide
        </Text>
        
        <View style={styles.packageFeatures}>
          {PACKAGE_FEATURES[optionKey]?.map((feature, idx) => (
            <View key={idx} style={styles.featureRow}>
              <MaterialIcons 
                name={feature.icon} 
                size={16} 
                color={isSelected ? '#84cc16' : '#6b7280'} 
                style={styles.featureIcon}
              />
              <Text style={[styles.featureText, isSelected && styles.featureTextSelected]}>
                {feature.title}
              </Text>
            </View>
          ))}
        </View>
      </TouchableOpacity>
    );
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {/* Package/Unlimited Toggle */}
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleButton, showPackages && styles.toggleButtonActive]}
              onPress={() => setShowPackages(true)}
            >
              <Text style={[styles.toggleText, showPackages && styles.toggleTextActive]}>Packages</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, !showPackages && styles.toggleButtonActive]}
              onPress={() => { setShowPackages(false); setSelectedOption('unlimited'); }}
            >
              <Text style={[styles.toggleText, !showPackages && styles.toggleTextActive]}>Unlimited</Text>
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.content}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Hero Section */}
            <LinearGradient
              colors={['#84cc16', '#65a30d']}
              style={styles.heroSection}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <MaterialIcons name="headset" size={48} color="white" style={styles.heroIcon} />
              <Text style={styles.heroTitle}>
                {trigger === 'free_limit' 
                  ? 'You\'ve Used Your Free Guides' 
                  : trigger === 'premium_attraction'
                  ? 'Unlock This Premium Guide'
                  : 'Choose Your Plan'
                }
              </Text>
              <Text style={styles.heroSubtitle}>
                {trigger === 'free_limit'
                  ? `Choose a package or get unlimited access`
                  : trigger === 'premium_attraction' && attractionName
                  ? `Get instant access to ${attractionName} and more`
                  : showPackages 
                    ? 'Perfect packages for every traveler'
                    : 'Unlimited access to all audio guides'
                }
              </Text>
            </LinearGradient>

            {showPackages ? (
              <>
                {/* Current Status */}
                {!subscription.isActive && (
                  <View style={styles.statusSection}>
                    <View style={styles.statusRow}>
                      <MaterialIcons name="info" size={20} color="#6b7280" />
                      <View style={styles.statusInfo}>
                        <Text style={styles.statusTitle}>Free Tier</Text>
                        <Text style={styles.statusText}>
                          {entitlements.remainingAttractions || 2} of 2 free guides remaining
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Package Options */}
                <View style={styles.packagesSection}>
                  <Text style={styles.sectionTitle}>Choose Your Package</Text>
                  <View style={styles.packagesGrid}>
                    {packages.map((pkg, index) => {
                      const optionKey = pkg.id.replace('_package', '') as 'basic' | 'standard' | 'premium';
                      return renderPackageOption(pkg, optionKey);
                    })}
                  </View>
                </View>
              </>
            ) : (
              <>
                {/* Unlimited Plan */}
                <View style={styles.unlimitedSection}>
                  <TouchableOpacity
                    style={[styles.unlimitedOption, styles.unlimitedOptionSelected]}
                    activeOpacity={0.7}
                  >
                    <View style={styles.unlimitedHeader}>
                      <MaterialIcons name="all-inclusive" size={32} color="#84cc16" />
                      <View style={styles.unlimitedInfo}>
                        <Text style={styles.unlimitedName}>Unlimited Monthly</Text>
                        <Text style={styles.unlimitedPrice}>$29.99/month</Text>
                      </View>
                    </View>
                    
                    <Text style={styles.unlimitedDescription}>
                      Listen to as many guides as you want
                    </Text>
                    
                    <View style={styles.unlimitedFeatures}>
                      {UNLIMITED_FEATURES.map((feature, idx) => (
                        <View key={idx} style={styles.featureRow}>
                          <MaterialIcons 
                            name={feature.icon} 
                            size={16} 
                            color="#84cc16" 
                            style={styles.featureIcon}
                          />
                          <Text style={styles.unlimitedFeatureText}>
                            {feature.title}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Purchase Button */}
            <View style={styles.purchaseSection}>
              <Button
                title={purchasing 
                  ? 'Processing...' 
                  : showPackages
                    ? `Get ${packages.find(p => p.id === `${selectedOption}_package`)?.name || 'Package'} - ${getOptionPrice(selectedOption)}`
                    : 'Get Unlimited Monthly - $29.99/month'
                }
                onPress={handlePurchase}
                disabled={purchasing || loading}
                style={styles.purchaseButton}
                variant="primary"
              />
              
              <TouchableOpacity 
                style={styles.restoreButton} 
                onPress={handleRestorePurchases}
                disabled={loading}
              >
                <Text style={styles.restoreButtonText}>Restore Purchases</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#84cc16" />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    flex: 1,
    marginTop: 60,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 4,
    margin: 16,
    marginBottom: 0,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  toggleButtonActive: {
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  toggleTextActive: {
    color: '#1f2937',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  heroSection: {
    margin: 20,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    marginBottom: 24,
  },
  heroIcon: {
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: 'white',
    textAlign: 'center',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 22,
  },
  statusSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statusInfo: {
    marginLeft: 12,
    flex: 1,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  statusText: {
    fontSize: 14,
    color: '#6b7280',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  packagesSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  packagesGrid: {
    gap: 12,
  },
  packageOption: {
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 16,
    position: 'relative',
    backgroundColor: 'white',
  },
  packageOptionSelected: {
    borderColor: '#84cc16',
    backgroundColor: '#f7fee7',
  },
  popularPackage: {
    borderColor: '#84cc16',
  },
  badge: {
    position: 'absolute',
    top: -8,
    left: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1,
  },
  popularBadge: {
    backgroundColor: '#84cc16',
  },
  valueBadge: {
    backgroundColor: '#3b82f6',
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  packageName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  packageNameSelected: {
    color: '#365314',
  },
  packagePrice: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  packagePriceSelected: {
    color: '#365314',
  },
  packageDescription: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 4,
  },
  packageDescriptionSelected: {
    color: '#365314',
  },
  pricePerUnit: {
    fontSize: 14,
    color: '#84cc16',
    fontWeight: '500',
    marginBottom: 12,
  },
  packageFeatures: {
    gap: 6,
  },
  unlimitedSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  unlimitedOption: {
    borderWidth: 2,
    borderColor: '#84cc16',
    borderRadius: 16,
    padding: 20,
    backgroundColor: '#f7fee7',
  },
  unlimitedOptionSelected: {
    backgroundColor: '#f7fee7',
  },
  unlimitedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  unlimitedInfo: {
    marginLeft: 12,
    flex: 1,
  },
  unlimitedName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#365314',
  },
  unlimitedPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#84cc16',
  },
  unlimitedDescription: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 16,
  },
  unlimitedFeatures: {
    gap: 8,
  },
  unlimitedFeatureText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#365314',
    flex: 1,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureIcon: {
    marginRight: 8,
  },
  featureText: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
  featureTextSelected: {
    color: '#365314',
    fontWeight: '500',
  },
  purchaseSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  purchaseButton: {
    marginBottom: 8,
  },
  restoreButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  restoreButtonText: {
    fontSize: 16,
    color: '#84cc16',
    fontWeight: '500',
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 20,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#dc2626',
    textAlign: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});