import { View, StyleSheet, Alert, StatusBar } from 'react-native';
import * as Location from 'expo-location';
import MapViewComponent from '../components/map/MapView';
import { TestLocationControls } from '../components/map/TestLocationControls';
import { MaterialBottomSheet, SheetContentType, SheetState } from '../components/ui/MaterialBottomSheet';
import { ProfileContent } from '../components/ui/ProfileContent';
import { SettingsContent } from '../components/ui/SettingsContent';
import { FullScreenAudioMode } from '../components/audio/FullScreenAudioMode';
import { MiniAudioPlayer } from '../components/audio/MiniAudioPlayer';
import { TopNavigationBar } from '../components/ui/TopNavigationBar';
import { useApp } from '../contexts/AppContext';
import { useOnboarding } from '../contexts/OnboardingContext';
import { useAudio } from '../contexts/AudioContext';
import { Button } from '../components/ui/Button';
import { PointOfInterest } from '../services/GooglePlacesService';
import { AttractionInfoService, TranscriptSegment } from '../services/AttractionInfoService';
import { useState, useCallback, useRef, useEffect } from 'react';
import { Text } from 'react-native';

export default function MapScreen() {
  const { setSelectedAttraction, setIsBottomSheetOpen, gpsStatus, userPreferences, setGpsStatus } = useApp();
  const { resetOnboarding } = useOnboarding();
  const audioContext = useAudio();

  // Test location state
  const [isTestModeEnabled, setIsTestModeEnabled] = useState(false);
  const [testLocation, setTestLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [testLatitude, setTestLatitude] = useState('');
  const [testLongitude, setTestLongitude] = useState('');

  // Attractions and bottom sheet state
  const [attractions, setAttractions] = useState<PointOfInterest[]>([]);
  const [selectedAttraction, setSelectedAttractionLocal] = useState<PointOfInterest | null>(null);
  const [selectedAttractionIndex, setSelectedAttractionIndex] = useState(0);
  const [isBottomSheetVisible, setIsBottomSheetVisible] = useState(false);
  const [attractionInfo, setAttractionInfo] = useState<string | null>(null);
  const [attractionAudio, setAttractionAudio] = useState<string | null>(null);
  const [isGeneratingInfo, setIsGeneratingInfo] = useState(false);
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[] | undefined>(undefined);
  
  // Build proportional sentence/word timings for karaoke highlighting
  function buildTranscriptSegments(text: string, durationMs: number): TranscriptSegment[] {
    const sentences = text
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(Boolean);

    if (!sentences.length || durationMs <= 0) return [];

    const totalChars = sentences.reduce((sum, s) => sum + s.length, 0) || 1;
    let cursor = 0;

    return sentences.map(s => {
      const portion = s.length / totalChars;
      const segDuration = portion * durationMs;
      const startMs = Math.round(cursor);
      const endMs = Math.round(cursor + segDuration);

      const wordsRaw = s.split(/\s+/).filter(Boolean);
      const wordsTotalChars = wordsRaw.reduce((sum, w) => sum + w.length, 0) || 1;
      let wordCursor = startMs;
      const words = wordsRaw.map((w, i) => {
        const wordPortion = w.length / wordsTotalChars;
        const wDur = wordPortion * (endMs - startMs);
        const wStart = Math.round(wordCursor);
        const wEnd = i === wordsRaw.length - 1 ? endMs : Math.round(wordCursor + wDur);
        wordCursor += wDur;
        return { text: w, startMs: wStart, endMs: wEnd };
      });

      cursor += segDuration;
      return { text: s, startMs, endMs, words };
    });
  }
  
  // Material Bottom Sheet state
  const [sheetContentType, setSheetContentType] = useState<SheetContentType>('attractions');
  const [sheetState, setSheetState] = useState<SheetState>('hidden');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Map controls state
  const [mapType, setMapType] = useState<'standard' | 'satellite' | 'hybrid'>('standard');
  const [mapTilt, setMapTilt] = useState(45);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [triggerGPS, setTriggerGPS] = useState(0);
  const [isEnablingGPS, setIsEnablingGPS] = useState(false);
  
  // Search state
  const [showSearchButton, setShowSearchButton] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const mapSearchRef = useRef<any>(null);

  // Popular locations for quick testing
  const popularLocations = [
    { name: "Paris", lat: 48.8566, lng: 2.3522 },
    { name: "New York", lat: 40.7128, lng: -74.0060 },
    { name: "Tokyo", lat: 35.6762, lng: 139.6503 },
    { name: "Rome", lat: 41.9028, lng: 12.4964 },
    { name: "Cairo", lat: 30.0444, lng: 31.2357 },
    { name: "Cincinnati", lat: 39.1088, lng: -84.5175 }
  ];

  const handlePointsOfInterestUpdate = useCallback((pois: PointOfInterest[]) => {
    setAttractions(pois);
    console.log(`Found ${pois.length} attractions nearby`);
    // Show bottom sheet in peek mode when attractions are found
    if (pois.length > 0) {
      setSheetContentType('attractions');
      setIsBottomSheetVisible(true);
      setSheetState('peek');
    } else {
      setIsBottomSheetVisible(false);
      setSheetState('hidden');
    }
    
    // Update user location for distance calculation
    if (gpsStatus.latitude && gpsStatus.longitude) {
      setUserLocation({ lat: gpsStatus.latitude, lng: gpsStatus.longitude });
    } else if (testLocation) {
      setUserLocation({ lat: testLocation.latitude, lng: testLocation.longitude });
    }
  }, [gpsStatus, testLocation]);

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
    setSheetState('expanded');
    
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

  const handleAttractionSelect = useCallback((attraction: PointOfInterest) => {
    const index = attractions.findIndex(a => a.id === attraction.id);
    setSelectedAttractionLocal(attraction);
    setSelectedAttractionIndex(index >= 0 ? index : 0);
    setAttractionInfo(null);
    setAttractionAudio(null);
    setTranscriptSegments(undefined);
    
    // Switch to detail view
    setSheetContentType('attraction-detail');
    setSheetState('expanded');
    
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
  }, [attractions, setSelectedAttraction]);
  
  const handleBackToList = useCallback(() => {
    setSheetContentType('attractions');
    setSheetState('half');
  }, []);
  
  const handleOpenSettings = useCallback(() => {
    setSheetContentType('settings');
    setIsBottomSheetVisible(true);
    setSheetState('half');
  }, []);
  
  const handleOpenProfile = useCallback(() => {
    setSheetContentType('profile');
    setIsBottomSheetVisible(true);
    setSheetState('half');
  }, []);

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

      console.log(`Generating info for: ${attraction.name}`);
      
      const attractionInfo = await AttractionInfoService.generateTextInfo(
        attraction.name,
        attraction.description || 'Unknown location',
        currentLocation,
        {
          theme: userPreferences.theme,
          audioLength: userPreferences.audioLength,
          voiceStyle: userPreferences.voiceStyle,
        },
        isTestModeEnabled
      );
      
      setAttractionInfo(attractionInfo);
      console.log('Successfully generated attraction info');
      
    } catch (error) {
      console.error('Error generating attraction info:', error);
      
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

  // Streamlined single-process audio generation (replaces two-step process)
  const handlePlayAudio = async (attraction: PointOfInterest) => {
    try {
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

      console.log(`Generating text and audio for: ${attraction.name}`);

      // Single API call for both text and audio
      const { text, audio, transcriptSegments: segments } = await AttractionInfoService.generateTextAndAudio(
        attraction.name,
        attraction.description || 'Unknown location',
        currentLocation,
        {
          theme: userPreferences.theme,
          audioLength: userPreferences.audioLength,
          voiceStyle: userPreferences.voiceStyle,
        },
        isTestModeEnabled
      );

      // Create audio track with both text and audio data
      const audioTrack = {
        id: attraction.id,
        title: attraction.name,
        subtitle: attraction.description || 'Audio Guide',
        description: text,
        location: attraction.description,
        category: userPreferences.theme,
        audioData: audio,
        duration: 0,
      };

      // Add track and set current track (this will clear generation states automatically)
      audioContext.addTrack(audioTrack);
      await audioContext.setCurrentTrack(audioTrack);
      
      // Auto-play when generation completes
      await audioContext.play();
      
      // Update local state for compatibility
      setAttractionInfo(text);
      setAttractionAudio(audio);
      setTranscriptSegments(segments);

      console.log('Streamlined audio generation completed and started playing');

    } catch (error) {
      console.error('Error in streamlined audio generation:', error);
      
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

  // If backend didn't return timings, generate client-side timings once duration is known
  useEffect(() => {
    if (audioContext.duration > 0 && attractionInfo) {
      if (!transcriptSegments || transcriptSegments.length === 0) {
        const built = buildTranscriptSegments(attractionInfo, audioContext.duration);
        setTranscriptSegments(built);
      }
    }
  }, [audioContext.duration, attractionInfo]);

  // Legacy function kept for compatibility (will be removed in Phase 4)
  const handleRequestAudio = async () => {
    if (!selectedAttraction || !attractionInfo) {
      Alert.alert('Error', 'No attraction or content available for audio generation');
      return;
    }

    try {
      const currentLocation = testLocation 
        ? { lat: testLocation.latitude, lng: testLocation.longitude }
        : (gpsStatus.latitude !== null && gpsStatus.longitude !== null
            ? { lat: gpsStatus.latitude, lng: gpsStatus.longitude }
            : null);

      if (!currentLocation) {
        Alert.alert('Error', 'Location is required for audio generation');
        return;
      }

      console.log('Generating audio for:', selectedAttraction.name);

      const audioData = await AttractionInfoService.generateAudio(
        selectedAttraction.name,
        selectedAttraction.description || 'Unknown location',
        currentLocation,
        {
          theme: userPreferences.theme,
          audioLength: userPreferences.audioLength,
          voiceStyle: userPreferences.voiceStyle,
        },
        attractionInfo,
        isTestModeEnabled
      );

      const audioTrack = {
        id: selectedAttraction.id,
        title: selectedAttraction.name,
        subtitle: selectedAttraction.description || 'Audio Guide',
        description: attractionInfo,
        location: selectedAttraction.description,
        category: userPreferences.theme,
        audioData: audioData,
        duration: 0,
      };

      audioContext.addTrack(audioTrack);
      await audioContext.setCurrentTrack(audioTrack);
      audioContext.minimize();
      setAttractionAudio(audioData);

      console.log('Audio track created and added to player');

    } catch (error) {
      console.error('Error generating audio:', error);
      
      const errorMessage = AttractionInfoService.getErrorMessage(error);
      
      Alert.alert(
        'Audio Generation Failed',
        errorMessage,
        [
          { text: 'OK' },
          { 
            text: 'Retry', 
            onPress: handleRequestAudio 
          }
        ]
      );
    }
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
      console.log('GPS enable button clicked - starting permission request');
      
      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      console.log('Permission status:', status);
      
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'Please enable location permissions in your device settings to discover nearby attractions.',
          [{ text: 'OK' }]
        );
        return;
      }

      console.log('Permission granted, getting current location...');
      
      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      console.log('Got location:', location.coords);

      // Update GPS status with actual location data
      setGpsStatus({
        active: true,
        locked: true,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        lastUpdated: new Date(),
      });

      console.log('GPS enabled successfully with location data');
    } catch (error) {
      console.error('Error enabling GPS:', error);
      
      // Reset GPS status if there was an error
      setGpsStatus({ active: false, locked: false });
      
      Alert.alert(
        'GPS Error',
        'Unable to get your current location. Please check your location settings and try again.',
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

  if (!gpsStatus.active && !testLocation && !isTestModeEnabled) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#84cc16" />
        <View style={styles.noGpsContainer}>
          <View style={styles.noGpsContent}>
            <Text style={styles.noGpsIcon}>📍</Text>
            <Text style={styles.noGpsTitle}>Location Access Required</Text>
            <Text style={styles.noGpsText}>
              Enable GPS to discover nearby attractions and generate personalized audio guides, or use test mode to explore sample locations.
            </Text>
            <View style={styles.buttonContainer}>
              <Button
                title={isEnablingGPS ? "Enabling GPS..." : "Enable GPS"}
                onPress={handleEnableGPS}
                variant="primary"
                size="lg"
                style={styles.gpsButton}
                disabled={isEnablingGPS}
                loading={isEnablingGPS}
              />
              <Button
                title="Use Test Mode"
                onPress={() => setIsTestModeEnabled(true)}
                variant="outline"
                size="lg"
                style={styles.testButton}
              />
            </View>
          </View>
        </View>
      </View>
    );
  }

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
          initialZoom={20}
          triggerGPS={triggerGPS}
          onSearchStateChange={(showButton, searching) => {
            setShowSearchButton(showButton);
            setIsSearching(searching);
          }}
          onSearchAreaRequest={mapSearchRef}
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
        onMapTypeChange={setMapType}
        mapTilt={mapTilt}
        onMapTiltChange={setMapTilt}
        popularLocations={popularLocations}
      />

      {/* Top Navigation Bar */}
      <TopNavigationBar
        isSearching={isSearching}
        onSearchThisArea={() => {
          // Call the search function from MapView
          mapSearchRef.current?.searchThisArea?.();
        }}
        mapType={mapType}
        mapTilt={mapTilt}
        onMapTypeChange={setMapType}
        onMapTiltChange={setMapTilt}
        onProfilePress={handleOpenProfile}
        onSettingsPress={handleOpenSettings}
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
        onGenerateAudioGuide={selectedAttraction ? () => handlePlayAudio(selectedAttraction) : undefined}
        onPlayAudioGuide={selectedAttraction ? () => handlePlayAudio(selectedAttraction) : undefined}
        attractionInfo={attractionInfo}
        attractionAudio={attractionAudio}
        isLoading={audioContext.isGeneratingAudio || isGeneratingInfo}
        userLocation={userLocation}
        settingsContent={
          <SettingsContent
            mapType={mapType}
            mapTilt={mapTilt}
            onMapTypeChange={setMapType}
            onMapTiltChange={setMapTilt}
            onClose={() => setIsBottomSheetVisible(false)}
          />
        }
        profileContent={
          <ProfileContent
            onResetOnboarding={resetOnboarding}
            onClose={() => setIsBottomSheetVisible(false)}
          />
        }
      />

      {/* Mini Audio Player - Overlay at bottom of screen */}
      <MiniAudioPlayer
        isVisible={
          audioContext.showFloatingPlayer && 
          (audioContext.currentTrack !== null || audioContext.isGeneratingAudio)
        }
        isLoading={audioContext.isGeneratingAudio || audioContext.isLoading}
        loadingMessage={audioContext.generationMessage || "Loading audio guide..."}
        track={audioContext.currentTrack}
        isPlaying={audioContext.isPlaying}
        progress={audioContext.duration > 0 ? audioContext.position / audioContext.duration : 0}
        onPlayPause={audioContext.togglePlayPause}
        onSkipBack30={() => audioContext.seek(Math.max(0, audioContext.position - 30000))}
        onExpand={audioContext.enterFullScreen}
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
      />
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
  noGpsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 20,
  },
  noGpsContent: {
    alignItems: 'center',
    maxWidth: 300,
  },
  noGpsIcon: {
    fontSize: 48,
    marginBottom: 20,
  },
  noGpsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 12,
  },
  noGpsText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  buttonContainer: {
    flexDirection: 'column',
    gap: 12,
    width: '100%',
  },
  gpsButton: {
    width: '100%',
  },
  testButton: {
    width: '100%',
  },
});