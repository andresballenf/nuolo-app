import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, StyleSheet, Alert, StatusBar, Text } from 'react-native';
import { Redirect } from 'expo-router';
import * as Location from 'expo-location';
import type MapView from 'react-native-maps';
import MapViewComponent, { type SearchAreaHandle } from '../components/map/MapView';
import { TestLocationControls } from '../components/map/TestLocationControls';
import { MaterialBottomSheet } from '../components/ui/MaterialBottomSheet';
import { ProfileContent } from '../components/ui/ProfileContent';
import { SettingsContent } from '../components/ui/SettingsContent';
import { FullScreenAudioMode } from '../components/audio/FullScreenAudioMode';
import { MiniAudioPlayer } from '../components/audio/MiniAudioPlayer';
import { TopNavigationBar } from '../components/ui/TopNavigationBar';
import { RevenueCatPaywallModal } from '../components/ui/RevenueCatPaywallModal';
import { useApp } from '../contexts/AppContext';
import { useOnboarding } from '../contexts/OnboardingContext';
import { useAudio } from '../contexts/AudioContext';
import type { AttractionForAudio, AudioGenerationPreferences } from '../contexts/AudioContext';
import { useMonetization } from '../contexts/MonetizationContext';
import { useContentAccess } from '../contexts/MonetizationContext';
import { useAuth } from '../contexts/AuthContext';
import { PointOfInterest } from '../services/GooglePlacesService';
import { AttractionInfoService, TranscriptSegment } from '../services/AttractionInfoService';
import { Button } from '../components/ui/Button';
import { useMapSettings } from '../contexts/MapSettingsContext';
import { ErrorBoundary as UIErrorBoundary } from '../components/ui/ErrorBoundary';
import { logger } from '../lib/logger';
import { useAudioGenerationTelemetry } from '../hooks/useAudioGenerationTelemetry';
import { useMapSheetState } from '../hooks/useMapSheetState';
import { getFeatureFlag } from '../config/featureFlags';
import { buildTranscriptSegments } from '../utils/transcriptSegments';

export default function MapScreen() {
  // All context hooks first
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { setSelectedAttraction, setIsBottomSheetOpen, gpsStatus, userPreferences, setGpsStatus } = useApp();
  const { resetOnboarding } = useOnboarding();
  const audioContext = useAudio();
  const { showPaywall, setShowPaywall, paywallContext, recordAttractionUsage } = useMonetization();
  const { generateAudioGuideWithValidation } = useContentAccess();
  const telemetry = useAudioGenerationTelemetry();

  // All state hooks before any conditional returns
  // Test location state
  const [isTestModeEnabled, setIsTestModeEnabled] = useState(false);
  const [testLocation, setTestLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [testLatitude, setTestLatitude] = useState('');
  const [testLongitude, setTestLongitude] = useState('');

  // Attractions and bottom sheet state
  const {
    attractions,
    isBottomSheetVisible,
    sheetContentType,
    sheetState,
    setIsBottomSheetVisible,
    setSheetContentType,
    setSheetState,
    handlePointsOfInterestUpdate,
  } = useMapSheetState();
  const [selectedAttraction, setSelectedAttractionLocal] = useState<PointOfInterest | null>(null);
  const [selectedAttractionIndex, setSelectedAttractionIndex] = useState(0);
  const [attractionInfo, setAttractionInfo] = useState<string | null>(null);
  const [attractionAudio, setAttractionAudio] = useState<string | null>(null);
  const [isGeneratingInfo, setIsGeneratingInfo] = useState(false);
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[] | undefined>(undefined);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Map controls state - centralized via MapSettingsContext
  const { settings: mapSettings, setSettings: setMapSettings } = useMapSettings();
  const mapType = mapSettings.mapType;
  const mapTilt = mapSettings.tilt;
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [triggerGPS, setTriggerGPS] = useState(0);
  const [isEnablingGPS, setIsEnablingGPS] = useState(false);

  // Search state
  const [showSearchButton, setShowSearchButton] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const mapSearchRef = useRef<SearchAreaHandle | null>(null);
  const mapRef = useRef<MapView | null>(null);

  // All callbacks and effects before conditional returns

  // Update user location only when GPS or test location actually changes
  // This prevents unnecessary re-renders from frequent attraction updates
  useEffect(() => {
    if (gpsStatus.latitude && gpsStatus.longitude) {
      setUserLocation({ lat: gpsStatus.latitude, lng: gpsStatus.longitude });
    } else if (testLocation) {
      setUserLocation({ lat: testLocation.latitude, lng: testLocation.longitude });
    }
  }, [gpsStatus.latitude, gpsStatus.longitude, testLocation]);

  // If backend didn't return timings, generate client-side timings once duration is known
  useEffect(() => {
    if (audioContext.duration > 0 && attractionInfo) {
      if (!transcriptSegments || transcriptSegments.length === 0) {
        const built = buildTranscriptSegments(attractionInfo, audioContext.duration);
        setTranscriptSegments(built);
      }
    }
  }, [audioContext.duration, attractionInfo, transcriptSegments]);

  // Memoized callbacks to prevent re-renders
  const handleSearchStateChange = useCallback((showButton: boolean, searching: boolean) => {
    // Only update if values actually changed to prevent unnecessary re-renders
    setShowSearchButton(prev => prev !== showButton ? showButton : prev);
    setIsSearching(prev => prev !== searching ? searching : prev);
  }, []);

  const handleBottomSheetClose = useCallback(() => {
    setIsBottomSheetVisible(false);
  }, []);

  const handleMapRecenter = useCallback((lat: number, lng: number) => {
    // Recenter map on attraction with 3D view
    if (mapRef.current) {
      mapRef.current.animateCamera({
        center: {
          latitude: lat,
          longitude: lng,
        },
        pitch: mapTilt, // Maintain current tilt for 3D
        heading: 0,
        altitude: 600,
        zoom: 17,  // Optimal for 3D buildings
      }, { duration: 500 });
    }
  }, [mapTilt]);

  const handleAttractionSelect = useCallback((attraction: PointOfInterest) => {
    const index = attractions.findIndex(a => a.id === attraction.id);
    setSelectedAttractionLocal(attraction);
    setSelectedAttractionIndex(index >= 0 ? index : 0);
    setAttractionInfo(null);
    setAttractionAudio(null);
    setTranscriptSegments(undefined);

    // Recenter map on selected attraction with 3D view
    if (mapRef.current) {
      mapRef.current.animateCamera({
        center: {
          latitude: attraction.coordinate.latitude,
          longitude: attraction.coordinate.longitude,
        },
        pitch: mapTilt, // Maintain current tilt for 3D
        heading: 0,
        altitude: 600, // Closer view for selected attraction
        zoom: 17,  // Optimal for 3D buildings
      }, { duration: 500 });
    }

    // Switch to detail view
    setSheetContentType('attraction-detail');
    setSheetState('detail');

    // Update global context
    setSelectedAttraction({
      id: attraction.id,
      name: attraction.name,
      position: {
        lat: attraction.coordinate.latitude,
        lng: attraction.coordinate.longitude,
      },
      description: attraction.description,
      rating: attraction.rating,
    });
  }, [attractions, setSelectedAttraction, mapTilt]);

  const handleBackToList = useCallback(() => {
    setSheetContentType('attractions');
    setSheetState('half');
  }, []);

  const handleOpenSettings = useCallback(() => {
    setSheetContentType('settings');
    setIsBottomSheetVisible(true);
    setSheetState('expanded');
  }, []);

  const handleOpenProfile = useCallback(() => {
    setSheetContentType('profile');
    setIsBottomSheetVisible(true);
    setSheetState('expanded');
  }, []);

  // Memoized content components to prevent re-renders
  const settingsContentMemo = useMemo(() => (
    <SettingsContent
      onClose={() => setIsBottomSheetVisible(false)}
    />
  ), []);

  const profileContentMemo = useMemo(() => (
    <ProfileContent
      onResetOnboarding={resetOnboarding}
      onClose={() => setIsBottomSheetVisible(false)}
    />
  ), [resetOnboarding]);

  // Conditional returns AFTER all hooks
  if (authLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/auth" />;
  }

  // Popular locations for quick testing
  const popularLocations = [
    { name: "Paris", lat: 48.8566, lng: 2.3522 },
    { name: "New York", lat: 40.7128, lng: -74.0060 },
    { name: "Tokyo", lat: 35.6762, lng: 139.6503 },
    { name: "Rome", lat: 41.9028, lng: 12.4964 },
    { name: "Cairo", lat: 30.0444, lng: 31.2357 },
    { name: "Cincinnati", lat: 39.1088, lng: -84.5175 }
  ];

  const handleMarkerPress = (poi: PointOfInterest) => {
    const index = attractions.findIndex(a => a.id === poi.id);
    setSelectedAttractionLocal(poi);
    setSelectedAttractionIndex(index >= 0 ? index : 0);
    setAttractionInfo(null);
    setAttractionAudio(null);
    setTranscriptSegments(undefined);
    
    // Switch to attraction detail view
    setSheetContentType('attraction-detail');
    setIsBottomSheetVisible(true);
    setSheetState('detail');
    
    // Recenter map on selected attraction with 3D view
    if (mapRef.current) {
      mapRef.current.animateCamera({
        center: {
          latitude: poi.coordinate.latitude,
          longitude: poi.coordinate.longitude,
        },
        pitch: mapTilt, // Maintain current tilt for 3D
        heading: 0,
        altitude: 600, // Closer view for selected attraction
        zoom: 17,  // Optimal for 3D buildings
      }, { duration: 500 });
    }
    
    // Also update the global context for compatibility
    setSelectedAttraction({
      id: poi.id,
      name: poi.name,
      position: {
        lat: poi.coordinate.latitude,
        lng: poi.coordinate.longitude,
      },
      description: poi.description,
      rating: poi.rating,
    });
    setIsBottomSheetOpen(true);
  };

  const handleTestModeToggle = (enabled: boolean) => {
    setIsTestModeEnabled(enabled);
    if (!enabled) {
      setTestLocation(null);
      setTestLatitude('');
      setTestLongitude('');
    }
  };

  const handleApplyTestLocation = () => {
    const lat = parseFloat(testLatitude);
    const lng = parseFloat(testLongitude);
    
    setTestLocation({ latitude: lat, longitude: lng });
    Alert.alert(
      'Test Location Set',
      `Location set to ${lat.toFixed(4)}, ${lng.toFixed(4)}`
    );
  };

  const handleApplyPopularLocation = (location: { name: string; lat: number; lng: number }) => {
    setTestLocation({ latitude: location.lat, longitude: location.lng });
    setTestLatitude(location.lat.toString());
    setTestLongitude(location.lng.toString());
    Alert.alert(
      `Location Set to ${location.name}`,
      `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
    );
  };


  const handleGenerateInfo = async (attraction: PointOfInterest) => {
    setIsGeneratingInfo(true);
    setAttractionInfo(null);

    try {
      const currentLocation = testLocation 
        ? { lat: testLocation.latitude, lng: testLocation.longitude }
        : (gpsStatus.latitude !== null && gpsStatus.longitude !== null
            ? { lat: gpsStatus.latitude, lng: gpsStatus.longitude }
            : null);

      if (!currentLocation) {
        throw new Error('Location is required to generate attraction information');
      }

      if (!AttractionInfoService.validateUserLocation(currentLocation)) {
        throw new Error('Invalid location coordinates');
      }

      logger.info('Generating attraction info', { attractionName: attraction.name });

      const attractionInfo = await AttractionInfoService.generateTextInfo(
        attraction.name,
        attraction.description || 'Unknown location',
        currentLocation,
        {
          theme: userPreferences.theme,
          audioLength: userPreferences.audioLength,
          voiceStyle: userPreferences.voiceStyle,
          language: userPreferences.language,
          aiProvider: userPreferences.aiProvider,
        },
        isTestModeEnabled,
        { poiLocation: { lat: attraction.coordinate.latitude, lng: attraction.coordinate.longitude } }
      );
      
      setAttractionInfo(attractionInfo);
      logger.info('Successfully generated attraction info', { attractionName: attraction.name });
      
    } catch (error) {
      logger.error('Error generating attraction info', error, { attractionName: attraction.name });
      
      const errorMessage = AttractionInfoService.getErrorMessage(error);
      
      Alert.alert(
        'Error',
        errorMessage,
        [
          { text: 'OK' },
          { 
            text: 'Retry', 
            onPress: () => handleGenerateInfo(attraction) 
          }
        ]
      );
    } finally {
      setIsGeneratingInfo(false);
    }
  };

  // NEW: Chunked audio generation with streaming support
  const handlePlayAudio = async (attraction: PointOfInterest) => {
    let shouldRecordUsage = false;

    try {
      // Contextual GPS prompt if location is not available
      if (!gpsStatus.active && !testLocation && !isTestModeEnabled) {
        Alert.alert(
          'Enable Location',
          'Enable GPS to get personalized audio guides based on your location, or use test mode to explore.',
          [
            {
              text: 'Use Test Mode',
              onPress: () => setIsTestModeEnabled(true),
            },
            {
              text: 'Enable GPS',
              onPress: async () => {
                await handleEnableGPS();
                // Retry audio generation after GPS is enabled
                if (gpsStatus.active) {
                  handlePlayAudio(attraction);
                }
              },
            },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
        return;
      }

      // Check monetization entitlements first
      const validationResult = await generateAudioGuideWithValidation(attraction.id, attraction.name);

      if (!validationResult.canGenerate) {
        // Show paywall if user can't generate
        if (validationResult.shouldShowPaywall) {
          setShowPaywall(true, validationResult.paywallContext);
        }
        return;
      }

      // Store whether we need to record usage after successful generation
      shouldRecordUsage = validationResult.shouldRecordUsage;

      // Clear any existing generation state first (allows switching attractions)
      audioContext.clearGenerationState();
      
      // Start loading state immediately for instant UI feedback
      audioContext.startGeneratingAudio(attraction.id, attraction.name);

      const currentLocation = testLocation 
        ? { lat: testLocation.latitude, lng: testLocation.longitude }
        : (gpsStatus.latitude !== null && gpsStatus.longitude !== null
            ? { lat: gpsStatus.latitude, lng: gpsStatus.longitude }
            : null);

      if (!currentLocation) {
        audioContext.setGenerationError('Location is required for audio generation');
        Alert.alert('Error', 'Location is required for audio generation');
        return;
      }

      if (!AttractionInfoService.validateUserLocation(currentLocation)) {
        audioContext.setGenerationError('Invalid location coordinates');
        Alert.alert('Error', 'Invalid location coordinates');
        return;
      }

      logger.info('Starting chunked audio generation', { attractionName: attraction.name });
      logger.debug('Audio generation preferences', userPreferences);
      
      // First generate the text content
      const text = await AttractionInfoService.generateTextInfo(
        attraction.name,
        attraction.description || 'Unknown location',
        currentLocation,
        {
          theme: userPreferences.theme,
          audioLength: userPreferences.audioLength,
          voiceStyle: userPreferences.voiceStyle,
          language: userPreferences.language,
          aiProvider: userPreferences.aiProvider,
        },
        isTestModeEnabled,
        { poiLocation: { lat: attraction.coordinate.latitude, lng: attraction.coordinate.longitude } }
      );

      logger.info('Narration text generated', { characterCount: text.length });
      
      // Update UI with text immediately
      setAttractionInfo(text);
      
      // Feature flags for generation pipeline
      const useAppChunkedAudio = getFeatureFlag('audio_chunked_pipeline');
      let audioGenerated = false;
      const useChunkedStreaming = getFeatureFlag('audio_streaming_pipeline');
      
      if (useChunkedStreaming) {
        try {
          // Try the new chunked streaming method
          await AttractionInfoService.streamGenerateTextAndAudio(
        attraction.name,
        attraction.description || 'Unknown location',
        currentLocation,
        {
          theme: userPreferences.theme,
          audioLength: userPreferences.audioLength,
          voiceStyle: userPreferences.voiceStyle,
          language: userPreferences.language,
          aiProvider: userPreferences.aiProvider,
        },
        {
          onText: (receivedText) => {
            // Text already generated above, but update if needed
            if (receivedText && receivedText.length > 0) {
              setAttractionInfo(receivedText);
            }
          },
          onMetadata: (metadata) => {
            logger.debug('Audio metadata received', metadata);
            // Metadata is logged but state update happens in AudioContext
          },
          onChunk: async (chunk) => {
            logger.debug('Received audio chunk', {
              chunkIndex: chunk.chunkIndex + 1,
              totalChunks: chunk.totalChunks,
            });
            
            // The AudioContext's streamGenerateAndPlay will handle chunk playback
            // Just log for debugging
            if (chunk.chunkIndex === 0) {
              logger.info('First audio chunk received; playback should start soon');
              audioContext.clearGenerationState();
            }
          },
          onComplete: () => {
            logger.info('All audio chunks received successfully');
            audioContext.clearGenerationState();
          },
          onError: (error) => {
            logger.error('Streaming error during audio generation', error);
            audioContext.setGenerationError(error);
            Alert.alert('Audio Error', error);
          }
        },
        isTestModeEnabled
      );
      
          audioGenerated = true;
          logger.info('Chunked audio streaming initiated');
        } catch (streamError) {
          logger.warn('Chunked streaming failed; trying fallback method', streamError);
        }
      }
      
      // Use app-orchestrated chunked audio generation (NEW - unlimited text length!)
      if (!audioGenerated && useAppChunkedAudio) {
        try {
          logger.info('Using app-orchestrated chunked audio generation');
          
          // Use the new chunked generation method from AudioContext
          const attractionForAudio: AttractionForAudio = {
            id: attraction.id,
            name: attraction.name,
            address: attraction.description || 'Unknown location',
            userLocation: currentLocation,
            photos: attraction.photos, // Pass the photos array for image display
          };

          const audioPreferences: AudioGenerationPreferences = {
            theme: userPreferences.theme,
            audioLength: userPreferences.audioLength,
            voiceStyle: userPreferences.voiceStyle,
            language: userPreferences.language,
          };

          await audioContext.generateChunkedAudio(
            attractionForAudio,
            text,
            audioPreferences
          );
          
          audioGenerated = true;
          logger.info('App-orchestrated chunked audio generation initiated');
          
          // Record usage for free tier users after successful generation
          if (shouldRecordUsage) {
            try {
              await recordAttractionUsage(attraction.id);
              logger.info('Recorded attraction usage after successful chunked audio generation', {
                attractionId: attraction.id,
              });
            } catch (usageError) {
              logger.error('Failed to record attraction usage after chunked audio generation', usageError, {
                attractionId: attraction.id,
              });
              // Don't fail the audio generation for usage recording errors
            }
          }
          
        } catch (chunkError) {
          logger.error('App-orchestrated chunked audio failed', chunkError);

          const errorMessage = chunkError instanceof Error ? chunkError.message : String(chunkError);
          
          // Show helpful error messages
          if (errorMessage.includes('not deployed')) {
            Alert.alert(
              'Setup Required',
              'The chunked audio feature requires deploying a Supabase function. Using standard audio generation instead.',
              [{ text: 'OK' }]
            );
          } else if (errorMessage.includes('quota exceeded')) {
            Alert.alert(
              'OpenAI Quota Exceeded',
              'The OpenAI API has reached its usage limit. Please add credits to your OpenAI account at platform.openai.com',
              [
                { text: 'OK' },
                { text: 'Open OpenAI', onPress: () => {
                  // Could open URL if needed
                  logger.info('Prompted user to visit OpenAI billing page');
                }}
              ]
            );
            // Don't fall through - quota issue affects all methods
            audioContext.setGenerationError('OpenAI quota exceeded');
            return;
          } else if (errorMessage.includes('API key')) {
            Alert.alert(
              'API Key Issue',
              errorMessage,
              [{ text: 'OK' }]
            );
            // Don't fall through - API key issue affects all methods
            audioContext.setGenerationError(errorMessage);
            return;
          }
          // Will fall through to old method as backup for other errors
        }
      }
      
      // Fallback to old single-chunk method (limited to 4096 chars)
      if (!audioGenerated) {
        try {
          logger.info('Using fallback single-chunk audio generation');

          if (text.length > 3900) {
            throw new Error('Chunked audio is required for this narration length. Please retry once the chunk generator is available.');
          }

          const audioData = await AttractionInfoService.generateAudio(
            attraction.name,
            attraction.description || 'Unknown location',
            currentLocation,
            {
              theme: userPreferences.theme,
              audioLength: userPreferences.audioLength,
              voiceStyle: userPreferences.voiceStyle,
              language: userPreferences.language,
              aiProvider: userPreferences.aiProvider,
            },
            text,
            isTestModeEnabled,
            { poiLocation: { lat: attraction.coordinate.latitude, lng: attraction.coordinate.longitude } }
          );
          
          // Create audio track with the old method
          const audioTrack = {
            id: attraction.id,
            title: attraction.name,
            subtitle: attraction.description || 'Audio Guide',
            description: text,
            location: attraction.description,
            category: userPreferences.theme,
            audioData: audioData,
            duration: 0,
            imageUrl: attraction.photos && attraction.photos.length > 0 ? attraction.photos[0] : undefined,
          };
          
          audioContext.addTrack(audioTrack);
          await audioContext.setCurrentTrack(audioTrack);
          await audioContext.play();
          
          audioGenerated = true;
          logger.info('Audio generation completed using standard method');
          
          // Record usage for free tier users after successful generation
          if (shouldRecordUsage) {
            try {
              await recordAttractionUsage(attraction.id);
              logger.info('Recorded attraction usage after fallback audio generation', {
                attractionId: attraction.id,
              });
            } catch (usageError) {
              logger.error('Failed to record attraction usage after fallback audio generation', usageError, {
                attractionId: attraction.id,
              });
              // Don't fail the audio generation for usage recording errors
            }
          }
        } catch (audioError) {
          logger.error('Audio generation failed', audioError);
          throw audioError;
        }
      }

    } catch (error) {
      logger.error('Error in chunked audio generation', error);
      
      const errorMessage = AttractionInfoService.getErrorMessage(error);
      
      // Clear generation state on error to allow retry
      audioContext.setGenerationError(errorMessage);
      
      Alert.alert(
        'Audio Generation Failed',
        errorMessage,
        [
          { text: 'OK' },
          { 
            text: 'Retry', 
            onPress: () => handlePlayAudio(attraction) 
          }
        ]
      );
    }
  };

  // Update map camera when tilt changes - REMOVED to prevent drift
  // The tilt being related to drift speed indicates the camera animation is the issue
  // Let the user control tilt manually through map gestures instead

  // Legacy function kept for compatibility (will be removed in Phase 4)
  const handleRequestAudio = async () => {
    if (!selectedAttraction) {
      Alert.alert('Error', 'No attraction selected for audio generation');
      return;
    }

    await handlePlayAudio(selectedAttraction);
  };

  const handleCloseBottomSheet = () => {
    setIsBottomSheetVisible(false);
    setSelectedAttractionLocal(null);
    setAttractionInfo(null);
    setAttractionAudio(null);
    setIsBottomSheetOpen(false);
    setSelectedAttraction(null);
  };

  const handleEnableGPS = async () => {
    try {
      setIsEnablingGPS(true);
      logger.info('GPS enable requested by user');

      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      logger.info('Location permission request result', { status });

      if (status !== 'granted') {
        Alert.alert(
          'Location Permission',
          'Enable location to discover nearby attractions automatically. You can continue using test mode or search to explore locations.',
          [{ text: 'OK' }]
        );
        return;
      }

      logger.info('Location permission granted; acquiring current location');

      // Get current location with timeout and fallback
      let location;
      try {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
          mayShowUserSettingsDialog: true,
          });

      } catch (highAccuracyError) {
        logger.warn('High accuracy location failed; trying balanced accuracy', highAccuracyError);
        // Fallback to balanced accuracy if high accuracy fails
        try {
          location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
            mayShowUserSettingsDialog: true,
          });
        } catch (balancedError) {
          logger.warn('Balanced accuracy location failed; trying lowest accuracy', balancedError);
          // Last resort: try lowest accuracy
          location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Lowest,
            mayShowUserSettingsDialog: true,
          });
        }
      }

      logger.info('Current location acquired for GPS enable flow', {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      // Update GPS status with actual location data
      setGpsStatus({
        active: true,
        locked: true,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        lastUpdated: new Date(),
      });

      logger.info('GPS enabled successfully with location data');
    } catch (error) {
      logger.error('Error enabling GPS', error);

      // Reset GPS status if there was an error
      setGpsStatus({ active: false, locked: false });

      Alert.alert(
        'GPS Error',
        'Unable to get your current location. You can continue using test mode or search to explore locations.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsEnablingGPS(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    // The refresh will be handled by the MapView component
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  // Gracefully handle no GPS - show map with manual controls instead of blocking
  // Users can enable GPS via TopNavigationBar button or test mode controls

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Full-screen Map */}
      <View style={styles.mapContainer}>
        <MapViewComponent
          onPointsOfInterestUpdate={handlePointsOfInterestUpdate}
          onMarkerPress={handleMarkerPress}
          testLocation={testLocation}
          mapType={mapType}
          initialTilt={mapTilt}
          initialZoom={17}
          triggerGPS={triggerGPS}
          onSearchStateChange={handleSearchStateChange}
          onSearchAreaRequest={mapSearchRef}
          mapRef={mapRef}
        />
      </View>
      
      {/* Test Location Controls - Bottom Left (Dev Only) */}
      <TestLocationControls
        isTestModeEnabled={isTestModeEnabled}
        onTestModeToggle={handleTestModeToggle}
        testLatitude={testLatitude}
        testLongitude={testLongitude}
        onTestLatitudeChange={setTestLatitude}
        onTestLongitudeChange={setTestLongitude}
        onApplyTestLocation={handleApplyTestLocation}
        onApplyPopularLocation={handleApplyPopularLocation}
        mapType={mapType}
        onMapTypeChange={(type) => setMapSettings({ mapType: type })}
        mapTilt={mapTilt}
        onMapTiltChange={(tilt) => setMapSettings({ tilt })}
        popularLocations={popularLocations}
      />

      {/* Top Navigation Bar */}
      <TopNavigationBar
        isSearching={isSearching}
        onSearchThisArea={() => {
          // Call the search function from MapView
          mapSearchRef.current?.searchThisArea();
        }}
        onSearchByQuery={(query: string) => {
          mapSearchRef.current?.searchByQuery(query);
        }}
        mapType={mapType}
        mapTilt={mapTilt}
        onMapTypeChange={(type) => setMapSettings({ mapType: type })}
        onMapTiltChange={(tilt) => setMapSettings({ tilt })}
        onProfilePress={handleOpenProfile}
        onSettingsPress={handleOpenSettings}
        onEnableGPS={handleEnableGPS}
        isEnablingGPS={isEnablingGPS}
      />

      {/* Material Design 3 Bottom Sheet */}
      <MaterialBottomSheet
        contentType={sheetContentType}
        attractions={attractions}
        selectedAttraction={selectedAttraction}
        isVisible={isBottomSheetVisible}
        currentState={sheetState}
        onStateChange={setSheetState}
        onAttractionSelect={handleAttractionSelect}
        onBackPress={handleBackToList}
        onClose={handleBottomSheetClose}
        onGenerateAudioGuide={handlePlayAudio}
        onPlayAudioGuide={selectedAttraction ? () => handlePlayAudio(selectedAttraction) : undefined}
        onMapRecenter={handleMapRecenter}
        attractionInfo={attractionInfo}
        attractionAudio={attractionAudio}
        isLoading={audioContext.isGeneratingAudio || isGeneratingInfo}
        userLocation={userLocation}
        settingsContent={settingsContentMemo}
        profileContent={profileContentMemo}
      />

      {/* Mini Audio Player - Overlay at bottom of screen */}
      <MiniAudioPlayer
        isVisible={
          audioContext.showFloatingPlayer && 
          (audioContext.currentTrack !== null || audioContext.isGeneratingAudio)
        }
        isLoading={audioContext.isGeneratingAudio}
        loadingMessage={audioContext.generationMessage || "Loading audio guide..."}
        statusLabel={telemetry.label}
        track={audioContext.currentTrack}
        isPlaying={audioContext.isPlaying}
        progress={audioContext.duration > 0 ? audioContext.position / audioContext.duration : 0}
        onPlayPause={audioContext.togglePlayPause}
        onSkipBack30={() => audioContext.seek(Math.max(0, audioContext.position - 30000))}
        onExpand={audioContext.enterFullScreen}
        canCancel={audioContext.isGeneratingAudio}
        onCancel={audioContext.cancelStreaming}
        canRetry={!!audioContext.generationError}
        onRetry={selectedAttraction ? () => handlePlayAudio(selectedAttraction) : undefined}
      />

      {/* Full Screen Audio Mode - Enhanced with professional controls */}
      <FullScreenAudioMode
        isVisible={audioContext.isFullScreen}
        isPlaying={audioContext.isPlaying}
        currentTrack={audioContext.currentTrack}
        volume={audioContext.volume}
        isMuted={audioContext.isMuted}
        playbackRate={audioContext.playbackRate}
        onClose={audioContext.exitFullScreen}
        onPlay={audioContext.play}
        onPause={audioContext.pause}
        onNext={audioContext.hasNext ? audioContext.playNext : undefined}
        onPrevious={audioContext.hasPrevious ? audioContext.playPrevious : undefined}
        onSeek={audioContext.seek}
        onVolumeChange={audioContext.setVolume}
        onMuteToggle={audioContext.toggleMute}
        onPlaybackRateChange={audioContext.setPlaybackRate}
        position={audioContext.position}
        duration={audioContext.duration}
        transcriptSegments={transcriptSegments}
        // Progressive generation props
        isGenerating={audioContext.isGeneratingAudio}
        isBuffering={audioContext.isBuffering}
        isUsingChunks={audioContext.isUsingChunks}
        generationMessage={audioContext.generationMessage}
        generationError={audioContext.generationError}
        generationProgress={audioContext.generationProgress}
        telemetryStatusLabel={telemetry.label}
        onCancel={audioContext.cancelStreaming}
        onRetry={selectedAttraction ? () => handlePlayAudio(selectedAttraction) : undefined}
      />

      {/* RevenueCat Native Paywall Modal */}
      <UIErrorBoundary
        onError={(error) => {
          logger.error('Paywall render-time error', {
            error,
            visible: showPaywall,
            paywallContext,
          });
        }}
      >
        <RevenueCatPaywallModal
          visible={showPaywall}
          onClose={() => setShowPaywall(false)}
          trigger={paywallContext?.trigger}
          attractionId={paywallContext?.attractionId}
          attractionName={paywallContext?.attractionName}
        />
      </UIErrorBoundary>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  mapContainer: {
    flex: 1,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
