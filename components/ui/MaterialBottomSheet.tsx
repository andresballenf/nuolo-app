import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  TouchableOpacity,
  Text,
  ScrollView,
  FlatList,
  Image,
  ActivityIndicator,
  Platform,
  AccessibilityInfo,
  SafeAreaView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { PointOfInterest } from '../../services/GooglePlacesService';
import { Button } from './Button';
import { useAudio } from '../../contexts/AudioContext';
import { AttractionListItem } from './AttractionListItem';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Material Design 3 Constants
const MD3_CORNER_RADIUS = 28;
const MD3_HANDLE_WIDTH = 32;
const MD3_HANDLE_HEIGHT = 4;
const MD3_ELEVATION = 3;
const MD3_ANIMATION_DURATION = 300;
const VELOCITY_THRESHOLD = 0.3;
const SWIPE_THRESHOLD = 50;

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// Sheet height states - Updated for better UX
const SHEET_HEIGHTS = {
  HIDDEN: 0,
  DETAIL: 0.2,     // 20% - Single attraction detail view
  COLLAPSED: 0.4,  // 40% - Default view for list
  HALF: 0.6,       // 60% - Medium expansion
  EXPANDED: 0.8,   // 80% - Full expansion for more content
};

// Mini player height constants
const MINI_PLAYER_HEIGHT = 64;
const MINI_PLAYER_WITH_SAFE_AREA_IOS = 98;
const MINI_PLAYER_WITH_SAFE_AREA_ANDROID = 70;

// Content types
export type SheetContentType = 'attractions' | 'settings' | 'profile' | 'attraction-detail';

// Sheet states - Simplified
export type SheetState = 'hidden' | 'detail' | 'collapsed' | 'half' | 'expanded';

interface MaterialBottomSheetProps {
  // Content type and data
  contentType: SheetContentType;
  attractions?: PointOfInterest[];
  selectedAttraction?: PointOfInterest | null;
  
  // State management
  isVisible: boolean;
  currentState?: SheetState;
  onStateChange?: (state: SheetState) => void;
  
  // Callbacks
  onAttractionSelect?: (attraction: PointOfInterest) => void;
  onBackPress?: () => void;
  onClose?: () => void;
  onGenerateAudioGuide?: (attraction: PointOfInterest) => void;
  onPlayAudioGuide?: () => void;
  onMapRecenter?: (lat: number, lng: number) => void;
  
  // Content data
  attractionInfo?: string | null;
  attractionAudio?: string | null;
  isLoading?: boolean;
  
  // User location for distance calculation
  userLocation?: { lat: number; lng: number } | null;
  
  // Settings and Profile content (passed as children for flexibility)
  settingsContent?: React.ReactNode;
  profileContent?: React.ReactNode;
}

const MaterialBottomSheetComponent: React.FC<MaterialBottomSheetProps> = ({
  contentType,
  attractions = [],
  selectedAttraction,
  isVisible,
  currentState = 'hidden',
  onStateChange,
  onAttractionSelect,
  onBackPress,
  onClose,
  onGenerateAudioGuide,
  onPlayAudioGuide,
  onMapRecenter,
  attractionInfo,
  attractionAudio,
  isLoading = false,
  userLocation,
  settingsContent,
  profileContent,
}) => {
  const insets = useSafeAreaInsets();
  // State - use currentState prop as initial value
  const [sheetState, setSheetState] = useState<SheetState>(() => currentState);
  const isMounted = useRef(false);
  
  // Animation values - use lazy initialization to avoid function calls during render
  const translateY = useRef<Animated.Value | null>(null);
  // Backdrop removed - Standard bottom sheets don't use backdrop per MD3 specs
  const contentOpacity = useRef<Animated.Value | null>(null);
  
  // Initialize animation values once
  if (!translateY.current) {
    const initialHeight = (() => {
      switch (currentState) {
        case 'hidden':
          return SCREEN_HEIGHT;
        case 'detail':
          return SCREEN_HEIGHT * (1 - SHEET_HEIGHTS.DETAIL);
        case 'collapsed':
          return SCREEN_HEIGHT * (1 - SHEET_HEIGHTS.COLLAPSED);
        case 'half':
          return SCREEN_HEIGHT * (1 - SHEET_HEIGHTS.HALF);
        case 'expanded':
          return SCREEN_HEIGHT * (1 - SHEET_HEIGHTS.EXPANDED);
        default:
          return SCREEN_HEIGHT;
      }
    })();
    
    translateY.current = new Animated.Value(initialHeight);
    // No backdrop initialization for standard bottom sheet
    contentOpacity.current = new Animated.Value(1);
  }
  
  // Track if component is mounted
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  // Refs
  const lastGestureY = useRef(0);
  const currentHeight = useRef(0);
  
  // Get audio context
  const audioContext = useAudio();
  const { isPlaying, currentTrack, showFloatingPlayer, isGeneratingAudio, generatingForId } = audioContext;
  
  // Calculate bottom offset based on mini player visibility
  const bottomOffset = useMemo(() => {
    if (showFloatingPlayer && (currentTrack || isGeneratingAudio)) {
      return Platform.select({
        ios: MINI_PLAYER_WITH_SAFE_AREA_IOS,
        android: MINI_PLAYER_WITH_SAFE_AREA_ANDROID,
        default: MINI_PLAYER_HEIGHT,
      });
    }
    return 0;
  }, [showFloatingPlayer, currentTrack, isGeneratingAudio]);
  
  // Calculate sheet heights with bottom offset for mini player
  const getSheetHeight = useCallback((state: SheetState): number => {
    const availableHeight = SCREEN_HEIGHT - bottomOffset;
    switch (state) {
      case 'hidden':
        return SCREEN_HEIGHT;
      case 'detail':
        return availableHeight * (1 - SHEET_HEIGHTS.DETAIL) + bottomOffset;
      case 'collapsed':
        return availableHeight * (1 - SHEET_HEIGHTS.COLLAPSED) + bottomOffset;
      case 'half':
        return availableHeight * (1 - SHEET_HEIGHTS.HALF) + bottomOffset;
      case 'expanded':
        return availableHeight * (1 - SHEET_HEIGHTS.EXPANDED) + bottomOffset;
      default:
        return SCREEN_HEIGHT;
    }
  }, [bottomOffset]);
  
  // Calculate distance in miles
  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): string => {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    if (distance < 0.1) {
      return `${Math.round(distance * 5280)} ft`; // Convert to feet
    }
    return `${distance.toFixed(1)} mi`;
  }, []);
  
  // Define animateToState first (before panResponder)
  const animateToState = useCallback((state: SheetState) => {
    // Only animate if mounted to prevent updates during render
    if (!isMounted.current) return;
    
    // Additional safety: don't animate if we're already at the target state
    if (state === sheetState) return;
    
    const targetY = getSheetHeight(state);
    
    // Announce state change to screen readers
    const announcements: Record<SheetState, string> = {
      hidden: 'Bottom sheet closed',
      detail: 'Attraction details opened',
      collapsed: 'Bottom sheet opened',
      half: 'Bottom sheet expanded to half screen',
      expanded: 'Bottom sheet fully expanded',
    };
    
    AccessibilityInfo.announceForAccessibility(announcements[state]);
    
    // Provide haptic feedback for state transitions
    if (state !== sheetState) {
      if (state === 'hidden') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (state === 'expanded') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
    
    // Standard bottom sheet - Only animate translateY, no backdrop
    Animated.spring(translateY.current!, {
      toValue: targetY,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start(() => {
      // Defer state updates to next tick to avoid render-time updates
      setTimeout(() => {
        if (isMounted.current) {
          setSheetState(state);
          onStateChange?.(state);
          currentHeight.current = targetY;
        }
      }, 0);
    });
  }, [getSheetHeight, onStateChange, sheetState]);
  
  // Pan responder for drag gestures - memoized to prevent recreation
  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        lastGestureY.current = (translateY.current as any)._value;
      },
      onPanResponderMove: (_, gestureState) => {
        const newY = lastGestureY.current + gestureState.dy;
        
        // Constrain movement
        const minY = getSheetHeight('expanded');
        const maxY = SCREEN_HEIGHT;
        const constrainedY = Math.max(minY, Math.min(maxY, newY));
        
        translateY.current!.setValue(constrainedY);
        
        // No backdrop updates for standard bottom sheet
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dy, vy } = gestureState;
        
        // Determine target state based on velocity and position
        let targetState: SheetState = sheetState;
        
        // If in attraction detail view, restrict to detail state only
        if (contentType === 'attraction-detail') {
          if ((vy > VELOCITY_THRESHOLD || dy > SWIPE_THRESHOLD) && sheetState === 'detail') {
            targetState = 'hidden';
          } else {
            targetState = 'detail'; // Always snap back to detail (20%)
          }
        } else {
          // Normal behavior for list view
          if (vy > VELOCITY_THRESHOLD || dy > SWIPE_THRESHOLD) {
            // Swiping down
            if (sheetState === 'expanded') targetState = 'half';
            else if (sheetState === 'half') targetState = 'collapsed';
            else if (sheetState === 'collapsed') targetState = 'hidden';
          } else if (vy < -VELOCITY_THRESHOLD || dy < -SWIPE_THRESHOLD) {
            // Swiping up
            if (sheetState === 'collapsed') targetState = 'half';
            else if (sheetState === 'half') targetState = 'expanded';
          } else {
            // Snap to nearest state
            const currentY = (translateY.current as any)._value;
            const states: SheetState[] = ['hidden', 'detail', 'collapsed', 'half', 'expanded'];
            let minDistance = SCREEN_HEIGHT;
            
            states.forEach(state => {
              const stateHeight = getSheetHeight(state);
              const distance = Math.abs(currentY - stateHeight);
              if (distance < minDistance) {
                minDistance = distance;
                targetState = state;
              }
            });
          }
        }
        
        animateToState(targetState);
      },
    }),
    [sheetState, contentType, getSheetHeight, animateToState]
  );
  
  // Handle back navigation
  const handleBack = useCallback(() => {
    Animated.timing(contentOpacity.current!, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      onBackPress?.();
      Animated.timing(contentOpacity.current!, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });
  }, [onBackPress]);
  
  // Handle attraction selection
  const handleAttractionSelect = useCallback((attraction: PointOfInterest) => {
    Animated.timing(contentOpacity.current!, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      onAttractionSelect?.(attraction);
      // Defer animateToState to avoid potential render-time updates
      setTimeout(() => {
        animateToState('detail');
      }, 0);
      Animated.timing(contentOpacity.current!, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });
  }, [onAttractionSelect, animateToState]);
  
  // Sync external state changes
  useEffect(() => {
    // Only sync if external state is different from internal state
    if (currentState && currentState !== sheetState && isMounted.current) {
      // Directly set the state without animation to sync
      setSheetState(currentState);
      // Then animate to the new position
      const targetY = getSheetHeight(currentState);
      // Standard bottom sheet - Only animate translateY
      Animated.spring(translateY.current!, {
        toValue: targetY,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    }
  }, [currentState, sheetState, getSheetHeight]);
  
  // Handle visibility and content type changes
  useEffect(() => {
    // Skip on initial mount
    if (!isMounted.current) return;
    
    // Only handle if visibility changes
    if (!isVisible && sheetState !== 'hidden') {
      animateToState('hidden');
    } else if (isVisible && sheetState === 'hidden') {
      // Determine initial state based on content type
      if (contentType === 'attractions' && attractions.length > 0) {
        animateToState('collapsed');
      } else if (contentType === 'settings' || contentType === 'profile') {
        animateToState('collapsed');
      } else if (contentType === 'attraction-detail') {
        animateToState('detail');
      }
    }
  }, [isVisible, contentType, attractions.length, sheetState, animateToState]); // Include proper dependencies
  
  // Render attraction list item - memoized for performance
  const renderAttractionItem = useCallback(({ item }: { item: PointOfInterest }) => {
    const distance = userLocation 
      ? calculateDistance(userLocation.lat, userLocation.lng, item.coordinate.latitude, item.coordinate.longitude)
      : null;
    
    return (
      <AttractionListItem
        attraction={item}
        distance={distance}
        isLoading={isGeneratingAudio && generatingForId === item.id}
        isPlaying={currentTrack?.id === item.id && isPlaying}
        showDetails={false}
        onPress={() => handleAttractionSelect(item)}
        onPlayPress={() => onGenerateAudioGuide?.(item)}
        onMenuPress={() => handleAttractionSelect(item)}
      />
    );
  }, [userLocation, calculateDistance, handleAttractionSelect, isGeneratingAudio, generatingForId, currentTrack, isPlaying, onGenerateAudioGuide]);
  
  // Render content based on type
  const renderContent = () => {
    switch (contentType) {
      case 'attractions':
        return (
          <Animated.View style={[styles.content, { opacity: contentOpacity.current || 1 }]}>
            <FlatList
              data={attractions}
              keyExtractor={(item) => item.id}
              renderItem={renderAttractionItem}
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
              removeClippedSubviews={true}
              maxToRenderPerBatch={10}
              windowSize={10}
              initialNumToRender={5}
              ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <MaterialIcons name="explore" size={48} color="#9CA3AF" />
                  <Text style={styles.emptyStateText}>No attractions found</Text>
                </View>
              }
            />
          </Animated.View>
        );
      
      case 'attraction-detail':
        if (!selectedAttraction) return null;
        
        const distance = userLocation 
          ? calculateDistance(userLocation.lat, userLocation.lng, 
              selectedAttraction.coordinate.latitude, selectedAttraction.coordinate.longitude)
          : null;
        
        return (
          <Animated.View style={[styles.content, { opacity: contentOpacity.current || 1 }]}>
            <View style={styles.detailContainer}>
              {/* Use same list item component but with details shown */}
              <AttractionListItem
                attraction={selectedAttraction}
                distance={distance}
                isLoading={isGeneratingAudio && generatingForId === selectedAttraction.id}
                isPlaying={currentTrack?.id === selectedAttraction.id && isPlaying}
                showDetails={true}
                onPress={() => {}}
                onPlayPress={() => onGenerateAudioGuide?.(selectedAttraction)}
                onMenuPress={() => {
                  // Already in detail view, no action needed
                }}
              />
              
              {/* Additional info section if needed */}
              {attractionInfo && (
                <ScrollView style={styles.infoScrollView} showsVerticalScrollIndicator={false}>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoTitle}>About this place</Text>
                    <Text style={styles.infoText}>{attractionInfo}</Text>
                  </View>
                </ScrollView>
              )}
            </View>
          </Animated.View>
        );
      
      case 'settings':
        return (
          <Animated.View style={[styles.content, { opacity: contentOpacity.current || 1 }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {settingsContent || (
                <View style={styles.placeholderContent}>
                  <Text style={styles.placeholderText}>Settings Content</Text>
                </View>
              )}
            </ScrollView>
          </Animated.View>
        );
      
      case 'profile':
        return (
          <Animated.View style={[styles.content, { opacity: contentOpacity.current || 1 }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {profileContent || (
                <View style={styles.placeholderContent}>
                  <Text style={styles.placeholderText}>Profile Content</Text>
                </View>
              )}
            </ScrollView>
          </Animated.View>
        );
      
      default:
        return null;
    }
  };
  
  // Get title based on content type
  const getTitle = () => {
    switch (contentType) {
      case 'attractions':
        return 'Attractions nearby';
      case 'attraction-detail':
        return ''; // No title for detail view, just close button
      case 'settings':
        return 'Map Settings';
      case 'profile':
        return 'Profile';
      default:
        return '';
    }
  };
  
  // Don't render if no attractions and type is attractions
  if (contentType === 'attractions' && attractions.length === 0 && !isVisible) {
    return null;
  }
  
  return (
    <>
      {/* Standard Bottom Sheet - No backdrop per Material Design 3 specs */}
      {/* Standard sheets co-exist with main UI and allow interaction with both */}
      <Animated.View
        style={[
          styles.sheet,
          {
            transform: [{ translateY: translateY.current }],
            bottom: bottomOffset,
          },
        ]}
        accessible={false}
        accessibilityRole="none"
        importantForAccessibility="yes"
      >
        {/* Drag Handle */}
        <View 
          style={styles.handleContainer} 
          {...panResponder.panHandlers}
          accessible={true}
          accessibilityRole="adjustable"
          accessibilityLabel="Bottom sheet handle"
          accessibilityHint="Swipe up to expand, swipe down to minimize"
          accessibilityValue={{ text: `Sheet is ${sheetState}` }}
        >
          <View style={styles.handle} />
        </View>
        
        {/* Header - Sticky with title or close button */}
        <View style={styles.header}>
          {contentType === 'attraction-detail' ? (
            // For detail view, show back button on left
            <TouchableOpacity
              style={styles.headerBackButton}
              onPress={handleBack}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Back to list"
            >
              <MaterialIcons name="arrow-back" size={24} color="#1F2937" />
            </TouchableOpacity>
          ) : (
            // For list view, show title
            <Text style={styles.headerTitle}>{getTitle()}</Text>
          )}
          
          {/* Close button on the right */}
          <TouchableOpacity
            style={styles.headerCloseButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              animateToState('hidden');
              // Delay callback to ensure animation completes
              setTimeout(() => {
                onClose?.();
              }, 300);
            }}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Close bottom sheet"
          >
            <MaterialIcons name="close" size={24} color="#1F2937" />
          </TouchableOpacity>
        </View>
        
        {/* Content */}
        <View style={styles.contentContainer}>
          {renderContent()}
        </View>
      </Animated.View>
    </>
  );
};

// Custom comparison function for React.memo
// Only re-render when essential props change
const areEqual = (prevProps: MaterialBottomSheetProps, nextProps: MaterialBottomSheetProps) => {
  // Always re-render if visibility changes
  if (prevProps.isVisible !== nextProps.isVisible) return false;
  
  // Always re-render if content type changes
  if (prevProps.contentType !== nextProps.contentType) return false;
  
  // Always re-render if state changes
  if (prevProps.currentState !== nextProps.currentState) return false;
  
  // Always re-render if selected attraction changes
  if (prevProps.selectedAttraction?.id !== nextProps.selectedAttraction?.id) return false;
  
  // Always re-render if loading state changes
  if (prevProps.isLoading !== nextProps.isLoading) return false;
  
  // Always re-render if attraction info or audio changes
  if (prevProps.attractionInfo !== nextProps.attractionInfo) return false;
  if (prevProps.attractionAudio !== nextProps.attractionAudio) return false;
  
  // Don't re-render for attractions list changes unless the length changes significantly
  // This prevents re-renders when map moves slightly
  const prevLength = prevProps.attractions?.length ?? 0;
  const nextLength = nextProps.attractions?.length ?? 0;
  const attractionsChanged = Math.abs(prevLength - nextLength) > 5;
  if (attractionsChanged) return false;
  
  // Don't re-render for user location changes (these happen frequently)
  // The distance calculation will still work with stale location data
  
  // Props are equal enough, prevent re-render
  return true;
};

export const MaterialBottomSheet = React.memo(MaterialBottomSheetComponent, areEqual);

const styles = StyleSheet.create({
  // No backdrop styles needed for standard bottom sheet
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: MD3_ELEVATION * 5,
      },
    }),
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 4,
    minHeight: 24,
  },
  handle: {
    width: 48,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    minHeight: 48,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  headerBackButton: {
    padding: 8,
    marginRight: 8,
  },
  headerCloseButton: {
    padding: 8,
  },
  contentContainer: {
    flex: 1,
    position: 'relative',
  },
  content: {
    flex: 1,
  },
  
  // List styles
  listContainer: {
    paddingVertical: 0,
    paddingBottom: 150, // Increased bottom spacing to ensure last item is accessible in all sheet states
  },
  listSeparator: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 16,
  },
  emptyState: {
    padding: 48,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 15,
    color: '#9CA3AF',
    marginTop: 16,
  },
  
  // Detail view styles
  detailContainer: {
    flex: 1,
  },
  infoScrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  infoContent: {
    paddingVertical: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#4B5563',
  },
  
  // Placeholder styles
  placeholderContent: {
    padding: 40,
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
});