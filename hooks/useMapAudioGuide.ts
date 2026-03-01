import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { Alert } from 'react-native';
import * as Location from 'expo-location';
import type { AttractionForAudio, AudioGenerationPreferences, AudioTrack } from '../contexts/AudioContext';
import type { UserPreferences } from '../contexts/AppContext';
import { getFeatureFlag } from '../config/featureFlags';
import { logger } from '../lib/logger';
import type { PointOfInterest } from '../services/GooglePlacesService';
import { AttractionInfoService } from '../services/AttractionInfoService';
import { TelemetryService } from '../services/TelemetryService';

interface GpsStatusLike {
  active: boolean;
  latitude: number | null;
  longitude: number | null;
}

interface SetGpsStatusPayload {
  active?: boolean;
  locked?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  lastUpdated?: Date | null;
}

interface PaywallContextLike {
  trigger: 'free_limit' | 'premium_attraction' | 'manual';
  attractionId?: string;
  attractionName?: string;
}

interface AudioValidationResult {
  canGenerate: boolean;
  shouldShowPaywall: boolean;
  shouldRecordUsage: boolean;
  paywallContext?: {
    trigger: 'free_limit' | 'premium_attraction';
    attractionId: string;
    attractionName?: string;
  };
}

interface AudioContextAdapter {
  clearGenerationState: () => void;
  startGeneratingAudio: (attractionId: string, name: string) => void;
  setGenerationError: (error: string) => void;
  generateChunkedAudio: (
    attraction: AttractionForAudio,
    text: string,
    preferences: AudioGenerationPreferences
  ) => Promise<void>;
  addTrack: (track: AudioTrack) => void;
  setCurrentTrack: (track: AudioTrack) => void | Promise<void>;
  play: () => Promise<void>;
}

interface UseMapAudioGuideOptions {
  gpsStatus: GpsStatusLike;
  setGpsStatus: (status: SetGpsStatusPayload) => void;
  testLocation: { latitude: number; longitude: number } | null;
  isTestModeEnabled: boolean;
  setIsTestModeEnabled: (enabled: boolean) => void;
  userPreferences: UserPreferences;
  generateAudioGuideWithValidation: (
    attractionId: string,
    attractionName?: string
  ) => Promise<AudioValidationResult>;
  setShowPaywall: (show: boolean, context?: PaywallContextLike) => void;
  recordAttractionUsage: (attractionId: string) => Promise<void>;
  audioContext: AudioContextAdapter;
  setAttractionInfo: Dispatch<SetStateAction<string | null>>;
}

const resolveCurrentLocation = (
  testLocation: { latitude: number; longitude: number } | null,
  gpsStatus: GpsStatusLike
): { lat: number; lng: number } | null => {
  if (testLocation) {
    return {
      lat: testLocation.latitude,
      lng: testLocation.longitude,
    };
  }

  if (gpsStatus.latitude !== null && gpsStatus.longitude !== null) {
    return {
      lat: gpsStatus.latitude,
      lng: gpsStatus.longitude,
    };
  }

  return null;
};

export function useMapAudioGuide({
  gpsStatus,
  setGpsStatus,
  testLocation,
  isTestModeEnabled,
  setIsTestModeEnabled,
  userPreferences,
  generateAudioGuideWithValidation,
  setShowPaywall,
  recordAttractionUsage,
  audioContext,
  setAttractionInfo,
}: UseMapAudioGuideOptions) {
  const [isEnablingGPS, setIsEnablingGPS] = useState(false);
  const [isGeneratingInfo, setIsGeneratingInfo] = useState(false);

  const handleGenerateInfo = useCallback(async function generateInfo(attraction: PointOfInterest): Promise<void> {
    setIsGeneratingInfo(true);
    setAttractionInfo(null);

    try {
      const currentLocation = resolveCurrentLocation(testLocation, gpsStatus);
      if (!currentLocation) {
        throw new Error('Location is required to generate attraction information');
      }

      if (!AttractionInfoService.validateUserLocation(currentLocation)) {
        throw new Error('Invalid location coordinates');
      }

      logger.info('Generating attraction info', { attractionName: attraction.name });

      const generatedInfo = await AttractionInfoService.generateTextInfo(
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

      setAttractionInfo(generatedInfo);
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
            onPress: () => {
              void generateInfo(attraction);
            },
          },
        ]
      );
    } finally {
      setIsGeneratingInfo(false);
    }
  }, [gpsStatus, testLocation, setAttractionInfo, userPreferences, isTestModeEnabled]);

  const handleEnableGPS = useCallback(async (): Promise<boolean> => {
    try {
      setIsEnablingGPS(true);
      logger.info('GPS enable requested by user');

      const { status } = await Location.requestForegroundPermissionsAsync();
      logger.info('Location permission request result', { status });

      if (status !== 'granted') {
        Alert.alert(
          'Location Permission',
          'Enable location to discover nearby attractions automatically. You can continue using test mode or search to explore locations.',
          [{ text: 'OK' }]
        );
        return false;
      }

      logger.info('Location permission granted; acquiring current location');

      let location;
      try {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
          mayShowUserSettingsDialog: true,
        });
      } catch (highAccuracyError) {
        logger.warn('High accuracy location failed; trying balanced accuracy', highAccuracyError);
        try {
          location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
            mayShowUserSettingsDialog: true,
          });
        } catch (balancedError) {
          logger.warn('Balanced accuracy location failed; trying lowest accuracy', balancedError);
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

      setGpsStatus({
        active: true,
        locked: true,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        lastUpdated: new Date(),
      });

      logger.info('GPS enabled successfully with location data');
      return true;
    } catch (error) {
      logger.error('Error enabling GPS', error);
      setGpsStatus({ active: false, locked: false });

      Alert.alert(
        'GPS Error',
        'Unable to get your current location. You can continue using test mode or search to explore locations.',
        [{ text: 'OK' }]
      );
      return false;
    } finally {
      setIsEnablingGPS(false);
    }
  }, [setGpsStatus]);

  const handlePlayAudio = useCallback(async function playAudio(attraction: PointOfInterest): Promise<void> {
    let shouldRecordUsage = false;
    let didRecordAudioSuccess = false;

    const markAudioSuccess = () => {
      if (didRecordAudioSuccess) {
        return;
      }
      didRecordAudioSuccess = true;
      TelemetryService.increment('audio_generation_success');
    };

    try {
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
                const enabled = await handleEnableGPS();
                if (enabled) {
                  void playAudio(attraction);
                }
              },
            },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
        return;
      }

      const validationResult = await generateAudioGuideWithValidation(attraction.id, attraction.name);
      if (!validationResult.canGenerate) {
        if (validationResult.shouldShowPaywall) {
          setShowPaywall(true, validationResult.paywallContext);
        }
        return;
      }

      shouldRecordUsage = validationResult.shouldRecordUsage;
      TelemetryService.increment('audio_generation_attempt');

      audioContext.clearGenerationState();
      audioContext.startGeneratingAudio(attraction.id, attraction.name);

      const currentLocation = resolveCurrentLocation(testLocation, gpsStatus);
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
      setAttractionInfo(text);

      const useAppChunkedAudio = getFeatureFlag('audio_chunked_pipeline');
      const useChunkedStreaming = getFeatureFlag('audio_streaming_pipeline');
      let audioGenerated = false;

      if (useChunkedStreaming) {
        try {
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
                if (receivedText && receivedText.length > 0) {
                  setAttractionInfo(receivedText);
                }
              },
              onMetadata: (metadata) => {
                logger.debug('Audio metadata received', metadata);
              },
              onChunk: async (chunk) => {
                logger.debug('Received audio chunk', {
                  chunkIndex: chunk.chunkIndex + 1,
                  totalChunks: chunk.totalChunks,
                });
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
              },
            },
            isTestModeEnabled
          );

          audioGenerated = true;
          markAudioSuccess();
          logger.info('Chunked audio streaming initiated');
        } catch (streamError) {
          logger.warn('Chunked streaming failed; trying fallback method', streamError);
        }
      }

      if (!audioGenerated && useAppChunkedAudio) {
        try {
          logger.info('Using app-orchestrated chunked audio generation');

          const attractionForAudio: AttractionForAudio = {
            id: attraction.id,
            name: attraction.name,
            address: attraction.description || 'Unknown location',
            userLocation: currentLocation,
            photos: attraction.photos,
          };

          const audioPreferences: AudioGenerationPreferences = {
            theme: userPreferences.theme,
            audioLength: userPreferences.audioLength,
            voiceStyle: userPreferences.voiceStyle,
            language: userPreferences.language,
          };

          await audioContext.generateChunkedAudio(attractionForAudio, text, audioPreferences);

          audioGenerated = true;
          markAudioSuccess();
          logger.info('App-orchestrated chunked audio generation initiated');

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
            }
          }
        } catch (chunkError) {
          logger.error('App-orchestrated chunked audio failed', chunkError);

          const errorMessage = chunkError instanceof Error ? chunkError.message : String(chunkError);
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
                {
                  text: 'Open OpenAI',
                  onPress: () => {
                    logger.info('Prompted user to visit OpenAI billing page');
                  },
                },
              ]
            );
            audioContext.setGenerationError('OpenAI quota exceeded');
            return;
          } else if (errorMessage.includes('API key')) {
            Alert.alert('API Key Issue', errorMessage, [{ text: 'OK' }]);
            audioContext.setGenerationError(errorMessage);
            return;
          }
        }
      }

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

          const audioTrack: AudioTrack = {
            id: attraction.id,
            title: attraction.name,
            subtitle: attraction.description || 'Audio Guide',
            description: text,
            location: attraction.description,
            category: userPreferences.theme,
            audioData,
            duration: 0,
            imageUrl: attraction.photos && attraction.photos.length > 0 ? attraction.photos[0] : undefined,
          };

          audioContext.addTrack(audioTrack);
          await Promise.resolve(audioContext.setCurrentTrack(audioTrack));
          await audioContext.play();

          audioGenerated = true;
          markAudioSuccess();
          logger.info('Audio generation completed using standard method');

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
            }
          }
        } catch (audioError) {
          logger.error('Audio generation failed', audioError);
          throw audioError;
        }
      }
    } catch (error) {
      TelemetryService.increment('audio_generation_error');
      logger.error('Error in chunked audio generation', error);
      const errorMessage = AttractionInfoService.getErrorMessage(error);
      audioContext.setGenerationError(errorMessage);

      Alert.alert(
        'Audio Generation Failed',
        errorMessage,
        [
          { text: 'OK' },
          {
            text: 'Retry',
            onPress: () => {
              void playAudio(attraction);
            },
          },
        ]
      );
    }
  }, [
    gpsStatus,
    testLocation,
    isTestModeEnabled,
    setIsTestModeEnabled,
    handleEnableGPS,
    generateAudioGuideWithValidation,
    setShowPaywall,
    audioContext,
    userPreferences,
    setAttractionInfo,
    recordAttractionUsage,
  ]);

  return {
    isGeneratingInfo,
    isEnablingGPS,
    handleGenerateInfo,
    handleEnableGPS,
    handlePlayAudio,
  };
}
