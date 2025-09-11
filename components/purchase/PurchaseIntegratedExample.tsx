import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

// Import the purchase system components
import {
  PaywallModal,
  SubscriptionManager,
  EntitlementStatus,
  PurchaseRestoreFlow,
} from './index';

// Import integration hooks
import {
  usePurchaseIntegration,
  usePaywallFlow,
  useSubscriptionManagement,
} from '../../hooks/usePurchaseIntegration';

// Mock attraction data for demo
const DEMO_ATTRACTION = {
  id: 'demo-attraction-1',
  name: 'Historic Downtown Cathedral',
  coordinate: { latitude: 40.7128, longitude: -74.0060 },
  description: 'A beautiful cathedral with rich history',
  rating: 4.8,
};

/**
 * Example integration showing how to use the purchase system
 * with existing app components like the map view and attraction cards
 */
export const PurchaseIntegratedExample: React.FC = () => {
  const [activeView, setActiveView] = useState<'map' | 'subscription' | 'settings'>('map');
  const [showRestoreFlow, setShowRestoreFlow] = useState(false);

  // Purchase integration hooks
  const {
    entitlements,
    checkAttractionAccess,
    getAttractionCTA,
    handleAttractionInteraction,
  } = usePurchaseIntegration();

  const {
    paywallVisible,
    hidePaywall,
  } = usePaywallFlow();

  const {
    isLoading,
    handleSubscriptionPurchase,
    handlePackagePurchase,
  } = useSubscriptionManagement();

  // Get CTA button info for demo attraction
  const attractionCTA = getAttractionCTA(DEMO_ATTRACTION.id);
  const attractionAccess = checkAttractionAccess(DEMO_ATTRACTION.id);

  const handleAttractionPress = async () => {
    await handleAttractionInteraction(DEMO_ATTRACTION, attractionCTA.action);
  };

  const renderMapView = () => (
    <View style={styles.mapContainer}>
      {/* Entitlement Status Banner */}
      <EntitlementStatus 
        variant="banner" 
        showUpgradeButton={true}
      />

      {/* Map View Simulation */}
      <View style={styles.mapSimulation}>
        <Text style={styles.mapTitle}>Map View</Text>
        <Text style={styles.mapSubtitle}>Attractions near you</Text>

        {/* Demo Attraction Card */}
        <View style={styles.attractionCard}>
          <View style={styles.attractionHeader}>
            <MaterialIcons name="place" size={24} color="#84cc16" />
            <View style={styles.attractionInfo}>
              <Text style={styles.attractionName}>{DEMO_ATTRACTION.name}</Text>
              <Text style={styles.attractionDescription}>
                {DEMO_ATTRACTION.description}
              </Text>
            </View>
          </View>

          {/* Access Status */}
          <View style={styles.accessStatus}>
            <MaterialIcons 
              name={attractionAccess.hasAccess ? 'check-circle' : 
                    attractionAccess.canGenerate ? 'radio-button-unchecked' : 
                    'lock'} 
              size={16} 
              color={attractionAccess.hasAccess ? '#10B981' : 
                     attractionAccess.canGenerate ? '#F59E0B' : 
                     '#EF4444'} 
            />
            <Text style={[
              styles.accessText,
              {
                color: attractionAccess.hasAccess ? '#10B981' : 
                       attractionAccess.canGenerate ? '#F59E0B' : 
                       '#EF4444'
              }
            ]}>
              {attractionAccess.hasAccess ? 'Unlocked' :
               attractionAccess.canGenerate ? 'Free Guide Available' :
               'Premium Required'}
            </Text>
          </View>

          {/* Action Button */}
          <TouchableOpacity
            style={[
              styles.ctaButton,
              attractionCTA.variant === 'primary' ? styles.primaryButton : styles.outlineButton
            ]}
            onPress={handleAttractionPress}
            disabled={attractionCTA.disabled || isLoading}
          >
            <Text style={[
              styles.ctaText,
              attractionCTA.variant === 'primary' ? styles.primaryText : styles.outlineText
            ]}>
              {attractionCTA.text}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Compact Status Display */}
      <EntitlementStatus 
        variant="compact" 
        showUpgradeButton={false}
      />
    </View>
  );

  const renderSubscriptionView = () => (
    <View style={styles.subscriptionContainer}>
      <View style={styles.viewHeader}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => setActiveView('map')}
        >
          <MaterialIcons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.viewTitle}>Subscription</Text>
      </View>

      <SubscriptionManager 
        onUpgrade={() => {
          // Custom upgrade flow if needed
          console.log('Upgrade requested from subscription manager');
        }}
        onManageBilling={() => {
          // Custom billing management if needed
          console.log('Billing management requested');
        }}
      />
    </View>
  );

  const renderSettingsView = () => (
    <View style={styles.settingsContainer}>
      <View style={styles.viewHeader}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => setActiveView('map')}
        >
          <MaterialIcons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.viewTitle}>Settings</Text>
      </View>

      {/* Detailed Entitlement Status */}
      <EntitlementStatus 
        variant="detailed" 
        showUpgradeButton={true}
      />

      {/* Settings Options */}
      <View style={styles.settingsOptions}>
        <TouchableOpacity 
          style={styles.settingItem}
          onPress={() => setActiveView('subscription')}
        >
          <MaterialIcons name="card-membership" size={24} color="#6B7280" />
          <Text style={styles.settingText}>Manage Subscription</Text>
          <MaterialIcons name="chevron-right" size={24} color="#9CA3AF" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.settingItem}
          onPress={() => setShowRestoreFlow(true)}
        >
          <MaterialIcons name="restore" size={24} color="#6B7280" />
          <Text style={styles.settingText}>Restore Purchases</Text>
          <MaterialIcons name="chevron-right" size={24} color="#9CA3AF" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem}>
          <MaterialIcons name="help" size={24} color="#6B7280" />
          <Text style={styles.settingText}>Purchase Support</Text>
          <MaterialIcons name="chevron-right" size={24} color="#9CA3AF" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Main Content */}
      {activeView === 'map' && renderMapView()}
      {activeView === 'subscription' && renderSubscriptionView()}
      {activeView === 'settings' && renderSettingsView()}

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={[styles.navItem, activeView === 'map' && styles.activeNavItem]}
          onPress={() => setActiveView('map')}
        >
          <MaterialIcons 
            name="map" 
            size={24} 
            color={activeView === 'map' ? '#84cc16' : '#6B7280'} 
          />
          <Text style={[
            styles.navText,
            activeView === 'map' && styles.activeNavText
          ]}>Map</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.navItem, activeView === 'subscription' && styles.activeNavItem]}
          onPress={() => setActiveView('subscription')}
        >
          <MaterialIcons 
            name="card-membership" 
            size={24} 
            color={activeView === 'subscription' ? '#84cc16' : '#6B7280'} 
          />
          <Text style={[
            styles.navText,
            activeView === 'subscription' && styles.activeNavText
          ]}>Premium</Text>
          
          {/* Badge for free users */}
          {entitlements.status === 'free' && (
            <View style={styles.navBadge}>
              <Text style={styles.navBadgeText}>!</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.navItem, activeView === 'settings' && styles.activeNavItem]}
          onPress={() => setActiveView('settings')}
        >
          <MaterialIcons 
            name="settings" 
            size={24} 
            color={activeView === 'settings' ? '#84cc16' : '#6B7280'} 
          />
          <Text style={[
            styles.navText,
            activeView === 'settings' && styles.activeNavText
          ]}>Settings</Text>
        </TouchableOpacity>
      </View>

      {/* Paywall Modal */}
      <PaywallModal
        visible={paywallVisible}
        onClose={hidePaywall}
      />

      {/* Purchase Restore Flow */}
      <PurchaseRestoreFlow
        visible={showRestoreFlow}
        onClose={() => setShowRestoreFlow(false)}
        onRestoreSuccess={(count) => {
          console.log(`Restored ${count} purchases`);
          setShowRestoreFlow(false);
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },

  // Map View Styles
  mapContainer: {
    flex: 1,
  },
  mapSimulation: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  mapSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 32,
  },

  // Attraction Card Styles
  attractionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  attractionHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  attractionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  attractionName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  attractionDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  accessStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  accessText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  ctaButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#84cc16',
  },
  outlineButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#84cc16',
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '600',
  },
  primaryText: {
    color: '#FFFFFF',
  },
  outlineText: {
    color: '#84cc16',
  },

  // View Header Styles
  viewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  viewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },

  // Container Styles
  subscriptionContainer: {
    flex: 1,
  },
  settingsContainer: {
    flex: 1,
  },

  // Settings Styles
  settingsOptions: {
    padding: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 8,
  },
  settingText: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    marginLeft: 12,
  },

  // Bottom Navigation Styles
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingBottom: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    position: 'relative',
  },
  activeNavItem: {
    // Active state handled by color changes
  },
  navText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  activeNavText: {
    color: '#84cc16',
    fontWeight: '600',
  },
  navBadge: {
    position: 'absolute',
    top: 4,
    right: '30%',
    backgroundColor: '#EF4444',
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
});