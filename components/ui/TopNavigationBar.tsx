import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Animated,
  Platform,
  Image,
  TextInput,
  Keyboard,
  Dimensions,
  FlatList,
  InteractionManager,
  AppState,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MapPreferencesMenu } from '../map/MapPreferencesMenu';
import { ProfileMenu } from './ProfileMenu';
import { SubscriptionBadge } from './SubscriptionBadge';
import { Tooltip } from './Tooltip';
import { useAuth } from '../../contexts/AuthContext';
import { useMonetization } from '../../contexts/MonetizationContext';
import { useApp } from '../../contexts/AppContext';
import Constants from 'expo-constants';
import { monetizationService } from '../../services/MonetizationService';
import { logger } from '../../lib/logger';

interface TopNavigationBarProps {
  // Search functionality
  isSearching: boolean;
  onSearchThisArea: () => void;
  onSearchByQuery?: (query: string) => void;

  // Map preferences
  mapType: 'satellite' | 'hybrid' | 'terrain';
  mapTilt: number;
  onMapTypeChange: (type: 'satellite' | 'hybrid' | 'terrain') => void;
  onMapTiltChange: (tilt: number) => void;

  // Profile & Settings
  onProfilePress: () => void;
  onSettingsPress?: () => void;

  // GPS Enable
  onEnableGPS?: () => void;
  isEnablingGPS?: boolean;
}

// Storage keys for search history
const SEARCH_HISTORY_KEY = '@nuolo_search_history';
const MAX_HISTORY_ITEMS = 10;

// Popular search suggestions
const POPULAR_SEARCHES = [
  'Museums',
  'Parks',
  'Restaurants',
  'Historical Sites',
  'Art Galleries',
  'Churches',
  'Monuments',
  'Shopping',
];

export const TopNavigationBar: React.FC<TopNavigationBarProps> = ({
  isSearching,
  onSearchThisArea,
  onSearchByQuery,
  mapType,
  mapTilt,
  onMapTypeChange,
  onMapTiltChange,
  onProfilePress,
  onSettingsPress,
  onEnableGPS,
  isEnablingGPS = false,
}) => {
  // Get auth context
  const { user, isAuthenticated } = useAuth();
  const { setShowPaywall, showPaywall } = useMonetization();
  const { gpsStatus } = useApp();
  
  // State for menus
  const [showMapPreferences, setShowMapPreferences] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  
  // Single-flight guard and diagnostics state for opening paywall
  const isOpeningPaywallRef = useRef(false);
  const [isOpeningPaywall, setIsOpeningPaywall] = useState(false);
  const appForegroundedAtRef = useRef<number>(Date.now());
  
  const appStateRef = useRef<'active' | 'background' | 'inactive' | 'unknown'>('active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      appStateRef.current = state as any;
      if (state === 'active') {
        appForegroundedAtRef.current = Date.now();
      }
    });
    return () => {
      isOpeningPaywallRef.current = false;
      sub.remove();
    };
  }, []);
  
  // Animation values for button presses
  const searchButtonScale = useRef(new Animated.Value(1)).current;
  const mapButtonScale = useRef(new Animated.Value(1)).current;
  const profileButtonScale = useRef(new Animated.Value(1)).current;
  const gpsButtonScale = useRef(new Animated.Value(1)).current;

  const searchExpandAnim = useRef(new Animated.Value(0)).current;
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const searchInputRef = useRef<TextInput | null>(null);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const SCREEN_WIDTH = Dimensions.get('window').width;
  const [toolbarWidth, setToolbarWidth] = useState<number | null>(null);
  const defaultExpandedWidth = SCREEN_WIDTH - 32;

  // Load search history on mount
  useEffect(() => {
    loadSearchHistory();
  }, []);

  // Load search history from storage
  const loadSearchHistory = useCallback(async () => {
    try {
      const history = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
      if (history) {
        setSearchHistory(JSON.parse(history));
      }
    } catch (error) {
      console.error('Failed to load search history:', error);
    }
  }, []);

  // Save search to history
  const saveToHistory = useCallback(async (query: string) => {
    try {
      const trimmedQuery = query.trim();
      if (!trimmedQuery) return;

      // Remove duplicates and add to front
      const newHistory = [
        trimmedQuery,
        ...searchHistory.filter(item => item.toLowerCase() !== trimmedQuery.toLowerCase())
      ].slice(0, MAX_HISTORY_ITEMS);

      setSearchHistory(newHistory);
      await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory));
    } catch (error) {
      console.error('Failed to save search history:', error);
    }
  }, [searchHistory]);

  // Clear search history
  const clearSearchHistory = useCallback(async () => {
    try {
      setSearchHistory([]);
      await AsyncStorage.removeItem(SEARCH_HISTORY_KEY);
    } catch (error) {
      console.error('Failed to clear search history:', error);
    }
  }, []);

  // Get filtered suggestions based on query
  const getFilteredSuggestions = useCallback(() => {
    if (!searchQuery.trim()) {
      // Show history and popular searches when no query
      return {
        history: searchHistory,
        popular: POPULAR_SEARCHES
      };
    }

    const lowerQuery = searchQuery.toLowerCase();
    const filteredHistory = searchHistory.filter(item =>
      item.toLowerCase().includes(lowerQuery)
    );
    const filteredPopular = POPULAR_SEARCHES.filter(item =>
      item.toLowerCase().includes(lowerQuery) &&
      !searchHistory.includes(item)
    );

    return {
      history: filteredHistory,
      popular: filteredPopular
    };
  }, [searchQuery, searchHistory]);

  // Get user initial for profile button
  const getUserInitial = () => {
    if (!user) return null;
    if (user.profile?.fullName) {
      return user.profile.fullName.charAt(0).toUpperCase();
    }
    if (user.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return null;
  };

  // Animation helper function
  const animateButtonPress = (animValue: Animated.Value, callback?: () => void) => {
    // Add haptic feedback on iOS
    if (Platform.OS === 'ios') {
      // React Native has built-in haptic feedback for iOS
      const ReactNativeHaptic = require('react-native').Haptics;
      ReactNativeHaptic?.impact?.(ReactNativeHaptic.ImpactFeedbackStyle.Light);
    }
    
    Animated.sequence([
      Animated.timing(animValue, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(animValue, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      callback?.();
    });
  };

  useEffect(() => {
    Animated.timing(searchExpandAnim, {
      toValue: isSearchExpanded ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start(() => {
      if (isSearchExpanded) {
        searchInputRef.current?.focus();
      } else {
        searchInputRef.current?.blur();
      }
    });

    if (!isSearchExpanded) {
      Keyboard.dismiss();
    }
  }, [isSearchExpanded, searchExpandAnim]);

  const handleOpenSearch = () => {
    setIsSearchExpanded(true);
    setShowSuggestions(true);
  };

  const handleCancelSearch = () => {
    setIsSearchExpanded(false);
    setSearchQuery('');
    setShowSuggestions(false);
    setIsSearchLoading(false);

    // Clear debounce timer
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setShowSuggestions(true);
    searchInputRef.current?.focus();
  };

  const handleSubmitSearch = async (query?: string) => {
    const searchTerm = (query || searchQuery).trim();
    if (!searchTerm) return;

    try {
      setIsSearchLoading(true);
      setShowSuggestions(false);

      // Save to history
      await saveToHistory(searchTerm);

      // Execute search
      onSearchByQuery?.(searchTerm);

      // Close search after a short delay to show loading state
      setTimeout(() => {
        setIsSearchLoading(false);
        setIsSearchExpanded(false);
        setSearchQuery('');
      }, 500);
    } catch (error) {
      console.error('Search failed:', error);
      setIsSearchLoading(false);
    }
  };

  const handleSuggestionPress = (suggestion: string) => {
    setSearchQuery(suggestion);
    handleSubmitSearch(suggestion);
  };

  const handleCollapsedPress = () => {
    if (isSearchExpanded) {
      handleSubmitSearch();
    } else {
      handleOpenSearch();
    }
  };

  const expandedSearchWidth = Math.max(toolbarWidth ?? defaultExpandedWidth, 44);

  const interpolatedSearchWidth = searchExpandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [44, expandedSearchWidth],
  });

  const interpolatedSearchRadius = searchExpandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [22, 22],
  });

  const searchContentOpacity = searchExpandAnim.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [0, 0.4, 1],
  });

  const handleTopRowLayout = useCallback((event: { nativeEvent: { layout: { width: number } } }) => {
    setToolbarWidth(event.nativeEvent.layout.width);
  }, []);

  const handleOpenPaywallPress = useCallback(async () => {
    // Android: no special handling needed
    if (Platform.OS !== 'ios') {
      setShowPaywall(true, { trigger: 'manual' });
      return;
    }

    if (isOpeningPaywallRef.current) {
      logger.debug('Paywall open suppressed by single-flight guard');
      return;
    }

    isOpeningPaywallRef.current = true;
    setIsOpeningPaywall(true);

    const rcStatus = monetizationService.getRevenueCatStatus();
    const diagnostics = {
      rcConfigured: rcStatus.configured,
      rcInitialized: rcStatus.initialized,
      hasCurrentOffering: rcStatus.hasCurrentOffering,
      offeringId: rcStatus.currentOfferingIdentifier,
      packageCount: rcStatus.availablePackageCount,
      appUserId: user?.id ?? null,
      os: Platform.OS,
      osVersion: Platform.Version,
      deviceModel: (Constants as any)?.deviceName || 'unknown',
      buildNumber:
        (Constants?.expoConfig as any)?.ios?.buildNumber ||
        (Constants?.nativeBuildVersion as any) ||
        (Constants?.expoConfig as any)?.version ||
        'unknown',
      networkReachability: 'unknown',
      timeSinceAppForegroundedMs: Date.now() - appForegroundedAtRef.current,
      isOpeningPaywall: isOpeningPaywallRef.current,
      navState: { isFocused: true },
      appOwnership: (Constants as any)?.appOwnership,
      executionEnvironment: (Constants as any)?.executionEnvironment,
    };

    logger.info('Subscriptions badge tapped - attempting to open paywall', diagnostics);

    try {
      const ensure = await monetizationService.ensurePurchasesReady(6000);
      logger.debug('ensurePurchasesReady result', ensure);

      if (!ensure.ready) {
        logger.warn('Blocking paywall navigation: purchases not ready', {
          diagnostics,
          ensure,
        });
        Alert.alert(
          'Please Try Again',
          'The store is still getting ready. Please try again in a moment.'
        );
        return;
      }

      // Defer until interactions have finished to avoid transition conflicts
      await new Promise<void>((resolve) => {
        InteractionManager.runAfterInteractions(() => resolve());
      });

      // Ensure app is in foreground
      if (appStateRef.current !== 'active') {
        logger.warn('Aborting paywall navigation: app not active', {
          appState: appStateRef.current,
        });
        return;
      }

      // Avoid duplicate modal
      if (showPaywall) {
        logger.debug('Paywall already visible - skipping duplicate presentation');
        return;
      }

      setShowPaywall(true, { trigger: 'manual' });
    } catch (error) {
      logger.error('Error while opening paywall', { error, diagnostics });
      Alert.alert('Something went wrong', 'Unable to open the store just yet. Please try again.');
    } finally {
      isOpeningPaywallRef.current = false;
      setIsOpeningPaywall(false);
    }
  }, [setShowPaywall, showPaywall, user?.id]);

  return (
    <View style={styles.container}>
      <View style={styles.buttonContainer} onLayout={handleTopRowLayout}>
        {/* Search Area Button - Pill shaped */}
        <Animated.View
          style={[
            styles.searchButton,
            isSearching && styles.searchButtonSearching,
            {
              transform: [{ scale: searchButtonScale }],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.searchButtonTouchable}
            onPress={() => animateButtonPress(searchButtonScale, onSearchThisArea)}
            disabled={isSearching}
            activeOpacity={1}
          >
            {isSearching ? (
              <View style={styles.searchingContent}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.searchButtonText}>Searching...</Text>
              </View>
            ) : (
              <View style={styles.searchContent}>
                <Image 
                  source={require('../../assets/images/nuolo-icon-small.png')} 
                  style={styles.searchIcon}
                />
                <Text style={styles.searchButtonText}>Search this area</Text>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Subscription Badge */}
        <SubscriptionBadge
          onPress={handleOpenPaywallPress}
          disabled={isOpeningPaywall}
          loading={isOpeningPaywall}
          style={styles.subscriptionBadge}
        />

        {/* GPS Enable Button - Show when GPS is not active */}
        {!gpsStatus.active && onEnableGPS && (
          <Tooltip text="Enable GPS" position="bottom">
            <Animated.View
              style={[
                styles.circularButton,
                styles.gpsButton,
                {
                  transform: [{ scale: gpsButtonScale }],
                },
              ]}
            >
              <TouchableOpacity
                style={styles.circularButtonTouchable}
                onPress={() => animateButtonPress(gpsButtonScale, onEnableGPS)}
                activeOpacity={1}
                disabled={isEnablingGPS}
              >
                {isEnablingGPS ? (
                  <ActivityIndicator size="small" color="#84cc16" />
                ) : (
                  <MaterialIcons name="my-location" size={24} color="#84cc16" />
                )}
              </TouchableOpacity>
            </Animated.View>
          </Tooltip>
        )}

        {/* Map Preferences Button - Circular with Tooltip */}
        <Tooltip text="Map Preferences" position="bottom">
          <Animated.View
            style={[
              styles.circularButton,
              {
                transform: [{ scale: mapButtonScale }],
              },
            ]}
          >
            <TouchableOpacity
              style={styles.circularButtonTouchable}
              onPress={() => animateButtonPress(mapButtonScale, () => {
                if (onSettingsPress) {
                  onSettingsPress();
                } else {
                  setShowMapPreferences(true);
                }
              })}
              activeOpacity={1}
            >
              <MaterialIcons name="layers" size={24} color="#374151" />
            </TouchableOpacity>
          </Animated.View>
        </Tooltip>

        {/* Profile Button - Circular */}
        <Animated.View
          style={[
            styles.circularButton,
            {
              transform: [{ scale: profileButtonScale }],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.circularButtonTouchable}
            onPress={() => animateButtonPress(profileButtonScale, () => {
              if (onProfilePress) {
                onProfilePress();
              } else {
                setShowProfileMenu(true);
              }
            })}
            activeOpacity={1}
          >
            {isAuthenticated && getUserInitial() ? (
              <View style={styles.userInitialContainer}>
                <Text style={styles.userInitial}>{getUserInitial()}</Text>
              </View>
            ) : (
              <MaterialIcons name="account-circle" size={24} color="#374151" />
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Secondary Row - Expandable Search */}
      <View style={[styles.secondaryRow, { justifyContent: isSearchExpanded ? 'flex-start' : 'flex-end' }]}>
        <Animated.View
          style={[
            styles.expandableSearchContainer,
            {
              width: interpolatedSearchWidth,
              borderRadius: interpolatedSearchRadius,
              paddingHorizontal: isSearchExpanded ? 16 : 4,
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.searchToggleButton,
              isSearchExpanded && styles.searchToggleButtonActive,
            ]}
            onPress={handleCollapsedPress}
            activeOpacity={0.85}
          >
            <MaterialIcons
              name="search"
              size={24}
              color={isSearchExpanded ? '#84cc16' : '#6B7280'}
            />
          </TouchableOpacity>

          {isSearchExpanded && (
            <Animated.View style={[styles.searchInputWrapper, { opacity: searchContentOpacity }]}>
              <TextInput
                ref={searchInputRef}
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  setShowSuggestions(true);
                }}
                placeholder="Search attractions"
                placeholderTextColor="#9CA3AF"
                style={styles.searchInput}
                returnKeyType="search"
                onSubmitEditing={() => handleSubmitSearch()}
                onFocus={() => setShowSuggestions(true)}
                autoFocus={false}
                autoCorrect={false}
                autoCapitalize="words"
              />

              {searchQuery.length > 0 && (
                <TouchableOpacity
                  style={styles.searchClearButton}
                  onPress={handleClearSearch}
                  accessibilityLabel="Clear search"
                >
                  <MaterialIcons name="cancel" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.searchCloseButton}
                onPress={handleCancelSearch}
                accessibilityLabel="Close search"
              >
                <MaterialIcons name="chevron-right" size={16} color="#6B7280" />
              </TouchableOpacity>
            </Animated.View>
          )}
        </Animated.View>

        {/* Search Suggestions Dropdown */}
        {isSearchExpanded && showSuggestions && !isSearchLoading && (
          <View
            style={[
              styles.suggestionsContainer,
              {
                width: expandedSearchWidth,
                maxWidth: expandedSearchWidth,
              },
            ]}
          >
            {(() => {
              const { history, popular } = getFilteredSuggestions();
              const hasHistory = history.length > 0;
              const hasPopular = popular.length > 0;

              if (!hasHistory && !hasPopular) {
                return (
                  <View style={styles.emptySuggestions}>
                    <MaterialIcons name="location-searching" size={40} color="#D1D5DB" />
                    <Text style={styles.emptySuggestionsText}>
                      {searchQuery.trim() ? 'No matching suggestions' : 'Search for places, attractions, or landmarks'}
                    </Text>
                  </View>
                );
              }

              return (
                <FlatList
                  data={[
                    ...(hasHistory ? [{ type: 'header' as const, title: 'Recent Searches' }] : []),
                    ...history.map(item => ({ type: 'history' as const, value: item })),
                    ...(hasPopular ? [{ type: 'header' as const, title: 'Popular Searches' }] : []),
                    ...popular.map(item => ({ type: 'popular' as const, value: item })),
                  ]}
                  keyExtractor={(item, index) => `${item.type}-${index}`}
                  renderItem={({ item }) => {
                    if (item.type === 'header') {
                      return (
                        <View style={styles.suggestionHeader}>
                          <Text style={styles.suggestionHeaderText}>{item.title}</Text>
                          {item.title === 'Recent Searches' && history.length > 0 && (
                            <TouchableOpacity onPress={clearSearchHistory}>
                              <Text style={styles.clearHistoryButton}>Clear</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    }

                    // Type narrowing: if not header, then it must have value
                    const suggestionValue = 'value' in item ? item.value : '';

                    return (
                      <TouchableOpacity
                        style={styles.suggestionItem}
                        onPress={() => handleSuggestionPress(suggestionValue)}
                      >
                        <MaterialIcons
                          name={item.type === 'history' ? 'history' : 'explore'}
                          size={20}
                          color={item.type === 'history' ? '#9CA3AF' : '#84cc16'}
                        />
                        <Text style={styles.suggestionText}>{suggestionValue}</Text>
                        <MaterialIcons name="north-west" size={16} color="#D1D5DB" />
                      </TouchableOpacity>
                    );
                  }}
                  style={styles.suggestionsList}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                />
              );
            })()}
          </View>
        )}

        {/* Search Loading Indicator */}
        {isSearchExpanded && isSearchLoading && (
          <View style={styles.searchLoadingContainer}>
            <ActivityIndicator size="small" color="#84cc16" />
            <Text style={styles.searchLoadingText}>Searching...</Text>
          </View>
        )}
      </View>

      {/* Map Preferences Menu */}
      <MapPreferencesMenu
        isVisible={showMapPreferences}
        onClose={() => setShowMapPreferences(false)}
        mapType={mapType}
        mapTilt={mapTilt}
        onMapTypeChange={onMapTypeChange}
        onMapTiltChange={onMapTiltChange}
      />

      {/* Profile Menu */}
      <ProfileMenu
        isVisible={showProfileMenu}
        onClose={() => setShowProfileMenu(false)}
        onNavigateToSettings={() => {
          setShowProfileMenu(false);
          // TODO: Navigate to settings page
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Platform.OS === 'ios' ? 60 : 50, // Extra padding for dynamic island
    paddingHorizontal: 16,
    zIndex: 1000,
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: '100%',
    alignSelf: 'center',
  },
  secondaryRow: {
    marginTop: 10,
    flexDirection: 'row',
    width: '100%',
    position: 'relative',
  },
  searchButton: {
    height: 44,
    backgroundColor: '#84cc16',
    borderRadius: 22,
    paddingHorizontal: 20,
    justifyContent: 'center',
    flex: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  searchButtonSearching: {
    backgroundColor: '#84cc16',
    opacity: 0.9,
  },
  searchContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  searchingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  searchIcon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
  },
  searchButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  searchButtonTouchable: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circularButton: {
    width: 44,
    height: 44,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  circularButtonTouchable: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInitialContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#84cc16',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInitial: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  subscriptionBadge: {
    marginHorizontal: 4,
  },
  gpsButton: {
    borderWidth: 2,
    borderColor: '#84cc16',
    backgroundColor: '#F0FDF4',
  },
  expandableSearchContainer: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
    height: 44,
  },
  searchToggleButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  searchToggleButtonActive: {
    backgroundColor: 'transparent',
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '400',
    paddingVertical: 0,
  },
  searchClearButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    marginRight: 4,
  },
  searchCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 52,
    left: 0,
    maxHeight: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
    zIndex: 1001,
  },
  suggestionsList: {
    maxHeight: 320,
  },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 0,
  },
  suggestionHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  clearHistoryButton: {
    fontSize: 13,
    fontWeight: '600',
    color: '#84cc16',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
    borderBottomWidth: 0,
  },
  suggestionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    color: '#1F2937',
  },
  emptySuggestions: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 16,
  },
  emptySuggestionsText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
  searchLoadingContainer: {
    position: 'absolute',
    top: 52,
    right: 0,
    minWidth: 200,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  searchLoadingText: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500',
  },
});
