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
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { PointOfInterest } from '../../services/GooglePlacesService';
import { Button } from './Button';
import { useAudio } from '../../contexts/AudioContext';

// Material Design 3 Constants
const MD3_CORNER_RADIUS = 28;
const MD3_HANDLE_WIDTH = 32;
const MD3_HANDLE_HEIGHT = 4;
const MD3_ELEVATION = 3;
const MD3_ANIMATION_DURATION = 300;
const VELOCITY_THRESHOLD = 0.3;
const SWIPE_THRESHOLD = 50;

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// Sheet height states
const SHEET_HEIGHTS = {
  HIDDEN: 0,
  PEEK: 0.1,      // 10% - Shows title only
  HALF: 0.4,      // 40% - List view
  EXPANDED: 0.7,  // 70% - Preview with content
  FULL: 0.9,      // 90% - Full content with text guide
};

// Content types
export type SheetContentType = 'attractions' | 'settings' | 'profile' | 'attraction-detail';

// Sheet states
export type SheetState = 'hidden' | 'peek' | 'half' | 'expanded' | 'full';

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
  onGenerateAudioGuide?: (attraction: PointOfInterest) => void;
  onPlayAudioGuide?: () => void;
  
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

export const MaterialBottomSheet: React.FC<MaterialBottomSheetProps> = ({
  contentType,
  attractions = [],
  selectedAttraction,
  isVisible,
  currentState = 'hidden',
  onStateChange,
  onAttractionSelect,
  onBackPress,
  onGenerateAudioGuide,
  onPlayAudioGuide,
  attractionInfo,
  attractionAudio,
  isLoading = false,
  userLocation,
  settingsContent,
  profileContent,
}) => {
  // State - use currentState prop as initial value
  const [sheetState, setSheetState] = useState<SheetState>(() => currentState);
  const isMounted = useRef(false);
  
  // Animation values - use lazy initialization to avoid function calls during render
  const translateY = useRef<Animated.Value | null>(null);
  const backdropOpacity = useRef<Animated.Value | null>(null);
  const contentOpacity = useRef<Animated.Value | null>(null);
  
  // Initialize animation values once
  if (!translateY.current) {
    const initialHeight = (() => {
      switch (currentState) {
        case 'hidden':
          return SCREEN_HEIGHT;
        case 'peek':
          return SCREEN_HEIGHT * (1 - SHEET_HEIGHTS.PEEK);
        case 'half':
          return SCREEN_HEIGHT * (1 - SHEET_HEIGHTS.HALF);
        case 'expanded':
          return SCREEN_HEIGHT * (1 - SHEET_HEIGHTS.EXPANDED);
        case 'full':
          return SCREEN_HEIGHT * (1 - SHEET_HEIGHTS.FULL);
        default:
          return SCREEN_HEIGHT;
      }
    })();
    
    translateY.current = new Animated.Value(initialHeight);
    backdropOpacity.current = new Animated.Value(currentState === 'hidden' ? 0 : 0.3);
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
  const { isPlaying, currentTrack, showFloatingPlayer } = audioContext;
  
  // Determine if audio player should be shown (only in attraction-detail now)
  const shouldShowAudioPlayer = useMemo(() => {
    // Only show in attraction-detail if there's a current track
    // For playing audio outside attraction-detail, use the screen-fixed player instead
    return contentType === 'attraction-detail' && currentTrack;
  }, [contentType, currentTrack]);
  
  // Calculate sheet heights (no audio offset needed with overlay approach)
  const getSheetHeight = useCallback((state: SheetState): number => {
    switch (state) {
      case 'hidden':
        return SCREEN_HEIGHT;
      case 'peek':
        return SCREEN_HEIGHT * (1 - SHEET_HEIGHTS.PEEK);
      case 'half':
        return SCREEN_HEIGHT * (1 - SHEET_HEIGHTS.HALF);
      case 'expanded':
        return SCREEN_HEIGHT * (1 - SHEET_HEIGHTS.EXPANDED);
      case 'full':
        return SCREEN_HEIGHT * (1 - SHEET_HEIGHTS.FULL);
      default:
        return SCREEN_HEIGHT;
    }
  }, []);
  
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
      peek: 'Bottom sheet minimized',
      half: 'Bottom sheet opened to half screen',
      expanded: 'Bottom sheet expanded',
      full: 'Bottom sheet opened to full screen',
    };
    
    AccessibilityInfo.announceForAccessibility(announcements[state]);
    
    // Provide haptic feedback for state transitions
    if (state !== sheetState) {
      if (state === 'hidden') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (state === 'full') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
    
    Animated.parallel([
      Animated.spring(translateY.current!, {
        toValue: targetY,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }),
      Animated.timing(backdropOpacity.current!, {
        toValue: state === 'hidden' ? 0 : (SCREEN_HEIGHT - targetY) / SCREEN_HEIGHT * 0.3,
        duration: MD3_ANIMATION_DURATION,
        useNativeDriver: false, // Opacity can't use native driver
      }),
    ]).start(() => {
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
        const minY = getSheetHeight('full');
        const maxY = SCREEN_HEIGHT;
        const constrainedY = Math.max(minY, Math.min(maxY, newY));
        
        translateY.current!.setValue(constrainedY);
        
        // Update backdrop opacity based on position
        const progress = (SCREEN_HEIGHT - constrainedY) / SCREEN_HEIGHT;
        backdropOpacity.current!.setValue(progress * 0.3);
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dy, vy } = gestureState;
        
        // Determine target state based on velocity and position
        let targetState: SheetState = sheetState;
        
        if (vy > VELOCITY_THRESHOLD || dy > SWIPE_THRESHOLD) {
          // Swiping down
          if (sheetState === 'full') targetState = 'expanded';
          else if (sheetState === 'expanded') targetState = 'half';
          else if (sheetState === 'half') targetState = 'peek';
          else if (sheetState === 'peek') targetState = 'hidden';
        } else if (vy < -VELOCITY_THRESHOLD || dy < -SWIPE_THRESHOLD) {
          // Swiping up
          if (sheetState === 'peek') targetState = 'half';
          else if (sheetState === 'half') targetState = 'expanded';
          else if (sheetState === 'expanded' && contentType === 'attraction-detail' && attractionInfo) {
            targetState = 'full';
          }
        } else {
          // Snap to nearest state
          const currentY = (translateY.current as any)._value;
          const states: SheetState[] = ['hidden', 'peek', 'half', 'expanded', 'full'];
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
        
        animateToState(targetState);
      },
    }),
    [sheetState, contentType, attractionInfo, getSheetHeight, animateToState]
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
        animateToState('expanded');
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
      Animated.parallel([
        Animated.spring(translateY.current!, {
          toValue: targetY,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(backdropOpacity.current!, {
          toValue: currentState === 'hidden' ? 0 : (SCREEN_HEIGHT - targetY) / SCREEN_HEIGHT * 0.3,
          duration: MD3_ANIMATION_DURATION,
          useNativeDriver: false,
        }),
      ]).start();
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
        animateToState('peek');
      } else if (contentType === 'settings' || contentType === 'profile') {
        animateToState('half');
      } else if (contentType === 'attraction-detail') {
        animateToState('expanded');
      }
    }
  }, [isVisible, contentType, attractions.length, sheetState, animateToState]); // Include proper dependencies
  
  // Render attraction list item - memoized for performance
  const renderAttractionItem = useCallback(({ item }: { item: PointOfInterest }) => {
    const distance = userLocation 
      ? calculateDistance(userLocation.lat, userLocation.lng, item.coordinate.latitude, item.coordinate.longitude)
      : null;
    
    return (
      <TouchableOpacity
        style={styles.attractionItem}
        onPress={() => handleAttractionSelect(item)}
        activeOpacity={0.7}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${item.rating ? `rated ${item.rating.toFixed(1)} stars,` : ''} ${distance || 'distance unknown'}`}
        accessibilityHint="Double tap to view details"
      >
        <View style={styles.attractionItemContent}>
          {/* Thumbnail */}
          <View style={styles.attractionThumbnail}>
            {item.photos && item.photos.length > 0 ? (
              <Image 
                source={{ uri: item.photos[0] }} 
                style={styles.attractionImage}
                defaultSource={require('../../assets/placeholder.png')}
              />
            ) : (
              <View style={styles.placeholderImage}>
                <Text style={styles.placeholderEmoji}>📍</Text>
              </View>
            )}
          </View>
          
          {/* Info */}
          <View style={styles.attractionItemInfo}>
            <Text style={styles.attractionItemName} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.attractionItemMeta}>
              {item.rating && (
                <View style={styles.ratingContainer}>
                  <MaterialIcons name="star" size={14} color="#FFA500" />
                  <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
                </View>
              )}
              {distance && (
                <Text style={styles.distanceText}>{distance}</Text>
              )}
            </View>
          </View>
          
          {/* Chevron */}
          <MaterialIcons name="chevron-right" size={24} color="#9CA3AF" />
        </View>
      </TouchableOpacity>
    );
  }, [userLocation, calculateDistance, handleAttractionSelect]);
  
  // Render content based on type
  const renderContent = () => {
    switch (contentType) {
      case 'attractions':
        return (
          <Animated.View style={[styles.content, { opacity: contentOpacity.current! }]}>
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
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              ListEmptyComponent={
                <View style={styles.emptyState}>
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
          <Animated.View style={[styles.content, { opacity: contentOpacity.current! }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Back button */}
              <TouchableOpacity 
                style={styles.backButton} 
                onPress={handleBack}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Back to attractions list"
              >
                <MaterialIcons name="arrow-back" size={24} color="#374151" />
                <Text style={styles.backButtonText}>Back to list</Text>
              </TouchableOpacity>
              
              {/* Attraction preview card */}
              <View style={styles.previewCard}>
                {/* Image */}
                <View style={styles.previewImageContainer}>
                  {selectedAttraction.photos && selectedAttraction.photos.length > 0 ? (
                    <Image 
                      source={{ uri: selectedAttraction.photos[0] }} 
                      style={styles.previewImage}
                      defaultSource={require('../../assets/placeholder.png')}
                    />
                  ) : (
                    <View style={styles.previewPlaceholder}>
                      <Text style={styles.previewPlaceholderEmoji}>🏛️</Text>
                    </View>
                  )}
                </View>
                
                {/* Info */}
                <View style={styles.previewInfo}>
                  <Text style={styles.previewName}>{selectedAttraction.name}</Text>
                  <View style={styles.previewMeta}>
                    {selectedAttraction.rating && (
                      <View style={styles.ratingContainer}>
                        <MaterialIcons name="star" size={18} color="#FFA500" />
                        <Text style={styles.previewRating}>{selectedAttraction.rating.toFixed(1)}</Text>
                      </View>
                    )}
                    {distance && (
                      <View style={styles.distanceContainer}>
                        <MaterialIcons name="place" size={18} color="#6B7280" />
                        <Text style={styles.previewDistance}>{distance}</Text>
                      </View>
                    )}
                  </View>
                  
                  {/* Attraction Play Button - Single tap to generate and play */}
                  <TouchableOpacity
                    style={[
                      styles.attractionPlayButton,
                      // Only show loading state if this specific attraction is being generated
                      (audioContext.isGeneratingAudio && audioContext.generatingForId === selectedAttraction.id) && styles.attractionPlayButtonLoading
                    ]}
                    onPress={() => {
                      // Streamlined single-process audio generation
                      onGenerateAudioGuide?.(selectedAttraction);
                    }}
                    // Don't disable button - allow switching between attractions
                    disabled={false}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={
                      (audioContext.isGeneratingAudio && audioContext.generatingForId === selectedAttraction.id) 
                        ? "Loading audio guide" 
                        : "Play audio guide"
                    }
                  >
                    {(audioContext.isGeneratingAudio && audioContext.generatingForId === selectedAttraction.id) ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <MaterialIcons name="play-arrow" size={28} color="#FFFFFF" />
                    )}
                  </TouchableOpacity>
                  
                  {/* Text content (shows in full state) */}
                  {sheetState === 'full' && attractionInfo && (
                    <View style={styles.textContent}>
                      <Text style={styles.textContentTitle}>Guide Transcript</Text>
                      <Text style={styles.textContentBody}>{attractionInfo}</Text>
                    </View>
                  )}
                </View>
              </View>
            </ScrollView>
          </Animated.View>
        );
      
      case 'settings':
        return (
          <Animated.View style={[styles.content, { opacity: contentOpacity.current! }]}>
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
          <Animated.View style={[styles.content, { opacity: contentOpacity.current! }]}>
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
        return `${attractions.length} Attractions nearby`;
      case 'attraction-detail':
        return selectedAttraction?.name || 'Attraction Details';
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
      {/* Semi-transparent backdrop with touch to dismiss */}
      {sheetState !== 'hidden' && sheetState !== 'peek' && (
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => {
            // Provide haptic feedback on backdrop touch
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            // Close to peek state on backdrop touch
            animateToState('peek');
          }}
          style={StyleSheet.absoluteFillObject}
        >
          <Animated.View
            style={[
              styles.backdrop,
              {
                opacity: backdropOpacity.current,
              },
            ]}
            pointerEvents="none"
          />
        </TouchableOpacity>
      )}
      
      {/* Bottom Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          {
            transform: [{ translateY: translateY.current }],
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
        
        {/* Header */}
        <TouchableOpacity
          style={styles.header}
          onPress={() => {
            if (sheetState === 'peek') animateToState('half');
            else if (sheetState === 'half') animateToState('peek');
          }}
          activeOpacity={0.9}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={getTitle()}
          accessibilityHint={sheetState === 'peek' ? 'Tap to expand' : 'Tap to minimize'}
        >
          <Text style={styles.headerTitle}>{getTitle()}</Text>
          <MaterialIcons 
            name={sheetState === 'peek' ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} 
            size={24} 
            color="#6B7280" 
          />
        </TouchableOpacity>
        
        {/* Content - with padding for overlay mini player */}
        <View style={[
          styles.contentContainer, 
          // Add bottom padding when mini player is visible to prevent content overlap
          // Use 98 to account for mini player height (64) + iOS safe area (34)
          (showFloatingPlayer && (currentTrack || audioContext.isGeneratingAudio)) && { 
            paddingBottom: Platform.select({ ios: 98, android: 70 })
          }
        ]}>
          {renderContent()}
        </View>
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: SCREEN_HEIGHT,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: MD3_CORNER_RADIUS,
    borderTopRightRadius: MD3_CORNER_RADIUS,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
      },
      android: {
        elevation: MD3_ELEVATION * 5,
      },
    }),
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 12, // Increased for better touch target (min 44px)
    minHeight: 44, // Ensure minimum touch target size
  },
  handle: {
    width: MD3_HANDLE_WIDTH,
    height: MD3_HANDLE_HEIGHT,
    backgroundColor: '#E5E7EB',
    borderRadius: MD3_HANDLE_HEIGHT / 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    position: 'relative',
  },
  content: {
    flex: 1,
  },
  
  // Attraction list styles
  listContainer: {
    paddingVertical: 8,
  },
  attractionItem: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 44, // Ensure minimum touch target size
  },
  attractionItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attractionThumbnail: {
    width: 56,
    height: 56,
    marginRight: 12,
  },
  attractionImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderEmoji: {
    fontSize: 24,
  },
  attractionItemInfo: {
    flex: 1,
  },
  attractionItemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 4,
  },
  attractionItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  distanceText: {
    fontSize: 14,
    color: '#6B7280',
  },
  separator: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 20,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  
  // Attraction detail styles
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#374151',
  },
  previewCard: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  previewImageContainer: {
    height: 200,
    marginBottom: 16,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  previewPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewPlaceholderEmoji: {
    fontSize: 48,
  },
  previewInfo: {
    gap: 12,
  },
  previewName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  previewMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  previewRating: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  previewDistance: {
    fontSize: 16,
    color: '#6B7280',
  },
  playButton: {
    marginTop: 8,
  },
  attractionPlayButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#84cc16', // Lime green
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  attractionPlayButtonLoading: {
    backgroundColor: 'rgba(132, 204, 22, 0.8)', // Slightly transparent when loading
  },
  textContent: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  textContentTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  textContentBody: {
    fontSize: 15,
    lineHeight: 24,
    color: '#374151',
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