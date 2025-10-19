import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import { Alert, AppState, AppStateStatus } from 'react-native';
import { AttractionInfoService, TranscriptSegment } from '../services/AttractionInfoService';
import { AudioService } from '../services/AudioService';
import { AudioChunkManager, ChunkPlaybackState } from '../services/AudioChunkManager';
import { AudioStreamHandler } from '../services/AudioStreamHandler';
import { AudioGenerationService, GenerationProgress } from '../services/AudioGenerationService';
import { mark, measure } from '../utils/tracing';
import type { PointOfInterest } from '../services/GooglePlacesService';

export type AudioTheme = 'history' | 'nature' | 'architecture' | 'culture';
export type AudioLengthPreference = 'short' | 'medium' | 'deep-dive';
export type AudioLanguage = 'en' | 'es' | 'fr' | 'de' | 'zh' | 'ja' | 'it' | 'pt' | 'ru' | 'ko';
export type AudioVoiceStyle = 'casual' | 'formal' | 'energetic' | 'calm';
export type AudioAIProvider = 'openai' | 'gemini';

// Feature flag to control progressive chunked playback
const PROGRESSIVE_AUDIO = process.env.EXPO_PUBLIC_PROGRESSIVE_AUDIO !== 'false';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface AttractionForAudio {
  id: string;
  name: string;
  address?: string;
  description?: string;
  userLocation?: Coordinates;
  photos?: string[];
}

export interface AudioGenerationPreferences {
  theme: AudioTheme;
  audioLength: AudioLengthPreference;
  voiceStyle: AudioVoiceStyle;
  language: AudioLanguage;
  aiProvider?: AudioAIProvider;
}

export interface AudioTrack {
  id: string;
  title: string;
  subtitle?: string;
  duration?: number;
  currentTime?: number;
  description?: string;
  location?: string;
  category?: string;
  audioData?: string; // Base64 encoded audio
  imageUrl?: string; // URL to attraction image
}

export interface AudioState {
  // Player state
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  isLoading: boolean;
  playbackRate: number; // Playback speed (0.5x to 2.0x)
  
  // Current track
  currentTrack: AudioTrack | null;
  currentTrackId: string | null;
  
  // UI state
  isMinimized: boolean;
  isFullScreen: boolean;
  showFloatingPlayer: boolean;
  
  // Generation states
  isGeneratingAudio: boolean;
  generatingForId: string | null;
  generationMessage: string;
  generationError: string | null;
  
  // Timing telemetry for progressive UX
  scriptStartedAt: number | null; // when we first show generating state (script stage)
  generationStartedAt: number | null; // when we start TTS chunk generation
  firstAudioAt: number | null; // when first playable chunk is ready
  
  // Playlist
  tracks: AudioTrack[];
  currentIndex: number;
  
  // Progress
  position: number;
  duration: number;

  // Transcript (timed segments)
  transcriptSegments?: TranscriptSegment[];
  
  // Chunk playback state
  isUsingChunks: boolean;
  currentChunkIndex: number;
  totalChunks: number;
  isBuffering: boolean;
  
  // Buffer and tracing
  bufferHealth?: number;
  firstPlayableAt?: number | null;
  ttfpMs?: number | null;
  ttcMs?: number | null;
  
  // Chunk generation progress
  generationProgress?: GenerationProgress;
}

export interface AudioActions {
  // Playback controls
  play: () => Promise<void>;
  pause: () => Promise<void>;
  togglePlayPause: () => void;
  seek: (position: number) => Promise<void>;
  
  // Volume controls
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  
  // Playback rate controls
  setPlaybackRate: (rate: number) => void;
  
  // Track management
  addTrack: (track: AudioTrack) => void;
  setCurrentTrack: (track: AudioTrack) => void;
  removeTrack: (trackId: string) => void;
  clearTracks: () => void;
  
  // Navigation
  playNext: () => void;
  playPrevious: () => void;
  hasNext: boolean;
  hasPrevious: boolean;
  
  // UI controls
  minimize: () => void;
  enterFullScreen: () => void;
  exitFullScreen: () => void;
  closePlayer: () => void;
  
  // Audio generation
  generateAudio: (trackId: string) => Promise<void>;
  startGeneratingAudio: (attractionId: string, name: string) => void;
  clearGenerationState: () => void;
  setGenerationError: (error: string) => void;
  generateAndPlay: (attraction: AttractionForAudio) => Promise<void>;
  generateAudioGuide: (
    attraction: PointOfInterest,
    options?: {
      language?: string;
      audioLength?: 'short' | 'medium' | 'deep-dive';
      voiceStyle?: 'casual' | 'formal' | 'energetic' | 'calm';
    }
  ) => Promise<boolean>;

  // Chunk-based audio
  streamGenerateAndPlay: (
    attraction: AttractionForAudio,
    text: string,
    preferences: AudioGenerationPreferences
  ) => Promise<void>;
  generateChunkedAudio: (
    attraction: AttractionForAudio,
    text: string,
    preferences: AudioGenerationPreferences
  ) => Promise<void>;
  cancelStreaming: () => void;
}

type AudioContextType = AudioState & AudioActions;

const AudioContext = createContext<AudioContextType | undefined>(undefined);

const initialState: AudioState = {
  isPlaying: false,
  volume: 80,
  isMuted: false,
  isLoading: false,
  playbackRate: 1.0,
  currentTrack: null,
  currentTrackId: null,
  isMinimized: false,
  isFullScreen: false,
  showFloatingPlayer: true, // Always show mini player for consistent layout
  isGeneratingAudio: false,
  generatingForId: null,
  generationMessage: '',
  generationError: null,
  scriptStartedAt: null,
  generationStartedAt: null,
  firstAudioAt: null,
  tracks: [],
  currentIndex: -1,
  position: 0,
  duration: 0,
  transcriptSegments: undefined,
  isUsingChunks: false,
  currentChunkIndex: 0,
  totalChunks: 0,
  isBuffering: false,
  bufferHealth: 0,
  firstPlayableAt: null,
  ttfpMs: null,
  ttcMs: null,
};

export function AudioProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AudioState>(initialState);
  const soundRef = useRef<Audio.Sound | null>(null);
  const positionUpdateRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunkManagerRef = useRef<AudioChunkManager | null>(null);
  const streamHandlerRef = useRef<AudioStreamHandler | null>(null);
  const audioGenerationServiceRef = useRef<AudioGenerationService | null>(null);
  const configureAudioSession = useCallback(async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
        playThroughEarpieceAndroid: false,
      });
      console.log('Audio session configured successfully');
    } catch (error) {
      console.error('Failed to configure audio session:', error);
      
      // Try fallback configuration without interruption overrides
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: true,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: false,
          playThroughEarpieceAndroid: false,
        });
        console.log('Audio session configured with fallback settings');
      } catch (fallbackError) {
        console.error('Failed to configure audio session with fallback:', fallbackError);
        Alert.alert(
          'Audio Setup Error',
          'Failed to configure audio session. Audio features may not work properly.'
        );
      }
    }
  }, []);

  // Configure audio session
  useEffect(() => {
    configureAudioSession();

    // Cleanup on unmount
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
      if (positionUpdateRef.current) {
        clearInterval(positionUpdateRef.current);
      }
    };
  }, [configureAudioSession]);

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        configureAudioSession();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [configureAudioSession]);

  // Position tracking
  const startPositionTracking = useCallback(() => {
    if (positionUpdateRef.current) {
      clearInterval(positionUpdateRef.current);
    }

    positionUpdateRef.current = setInterval(async () => {
      if (soundRef.current && state.isPlaying) {
        try {
          const status = await soundRef.current.getStatusAsync();
          if (status.isLoaded) {
            setState(prev => ({
              ...prev,
              position: status.positionMillis || 0,
              duration: status.durationMillis || 0,
            }));
          }
        } catch (error) {
          console.error('Error getting audio status:', error);
        }
      }
    }, 100); // Update every 100ms for smooth karaoke-style highlighting
  }, [state.isPlaying]);

  const stopPositionTracking = useCallback(() => {
    if (positionUpdateRef.current) {
      clearInterval(positionUpdateRef.current);
      positionUpdateRef.current = null;
    }
  }, []);

  // Load audio from Base64
  const loadAudio = useCallback(async (audioData: string): Promise<void> => {
    try {
      console.log('Loading audio with data length:', audioData.length);
      setState(prev => ({ ...prev, isLoading: true }));

      // Unload previous audio
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      // IMPORTANT: Save base64 to file instead of using data URI
      // Data URIs have size limitations on mobile platforms which can truncate audio
      const audioService = AudioService.getInstance();
      const fileUri = await audioService.saveBase64ToFile(audioData, 'audio/mp3');
      console.log('Saved audio to file:', fileUri);
      
      const { sound } = await Audio.Sound.createAsync(
        { uri: fileUri },
        {
          shouldPlay: false,
          volume: state.volume / 100,
          isMuted: state.isMuted,
          rate: state.playbackRate,
          shouldCorrectPitch: true,
        }
      );

      soundRef.current = sound;
      console.log('Audio.Sound created successfully');

      // Initialize duration/position immediately after loading
      try {
        const initialStatus = await sound.getStatusAsync();
        console.log('Initial audio status:', initialStatus);
        if (initialStatus.isLoaded) {
          const durationMs = initialStatus.durationMillis || 0;
          const durationSec = durationMs / 1000;
          console.log(`Audio loaded with duration: ${durationSec} seconds (${durationMs} ms)`);
          
          // Check if duration is suspiciously short (like exactly 12 seconds)
          if (durationSec > 0 && durationSec <= 15) {
            console.warn(`WARNING: Audio duration is very short: ${durationSec} seconds`);
            console.warn('This might indicate a backend limitation or audio generation issue');
            console.warn('Check if audioLength preference is set to "short" or if there\'s a backend bug');
          }
          
          setState(prev => ({
            ...prev,
            isLoading: false,
            position: initialStatus.positionMillis || 0,
            duration: durationMs,
          }));
        } else {
          console.warn('Audio not loaded in initial status');
        }
      } catch (statusError) {
        console.warn('Unable to get initial audio status after load:', statusError);
      }

      // Set up audio completion handler
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          const currentDuration = status.durationMillis || 0;
          const currentPosition = status.positionMillis || 0;
          
          // Log duration changes to debug the 12-second issue
          if (currentDuration > 0 && currentDuration !== state.duration) {
            console.log(`Duration updated: ${currentDuration / 1000} seconds (was: ${state.duration / 1000})`);
          }
          
          setState(prev => ({
            ...prev,
            position: currentPosition,
            duration: currentDuration,
            isLoading: false,
          }));

          // Handle audio completion
          if (status.didJustFinish) {
            console.log('Audio playback finished');
            setState(prev => ({ ...prev, isPlaying: false }));
            stopPositionTracking();
            
            // Auto-play next track if available - check dynamically
            const currentHasNext = state.currentIndex < state.tracks.length - 1;
            if (currentHasNext) {
              const nextTrack = state.tracks[state.currentIndex + 1];
              setCurrentTrack(nextTrack);
            }
          }
        }
      });

      console.log('Audio loaded successfully');
    } catch (error) {
      console.error('Error loading audio:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      Alert.alert(
        'Audio Error',
        'Failed to load audio. Please try again.'
      );
    }
  }, [state.volume, state.isMuted, state.duration]);

  // Playback controls
  const play = useCallback(async () => {
    try {
      // Handle chunk-based playback
      if (state.isUsingChunks && chunkManagerRef.current) {
        chunkManagerRef.current.resume();
        setState(prev => ({ 
          ...prev, 
          isPlaying: true,
          // Clear generation state when audio starts playing
          isGeneratingAudio: false,
          generatingForId: null,
          generationMessage: '',
          generationError: null
        }));
        console.log('Chunk-based audio resumed');
      } else if (soundRef.current) {
        // Original logic for regular audio
        await soundRef.current.playAsync();
        setState(prev => ({ 
          ...prev, 
          isPlaying: true,
          // Clear generation state when audio starts playing
          isGeneratingAudio: false,
          generatingForId: null,
          generationMessage: '',
          generationError: null
        }));
        startPositionTracking();
        console.log('Audio playback started');
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      Alert.alert('Playback Error', 'Failed to play audio');
    }
  }, [state.isUsingChunks, startPositionTracking]);

  const pause = useCallback(async () => {
    try {
      // Handle chunk-based playback
      if (state.isUsingChunks && chunkManagerRef.current) {
        chunkManagerRef.current.pause();
        setState(prev => ({ ...prev, isPlaying: false }));
        console.log('Chunk-based audio paused');
      } else if (soundRef.current) {
        // Original logic for regular audio
        await soundRef.current.pauseAsync();
        setState(prev => ({ ...prev, isPlaying: false }));
        stopPositionTracking();
        console.log('Audio playback paused');
      }
    } catch (error) {
      console.error('Error pausing audio:', error);
    }
  }, [state.isUsingChunks, stopPositionTracking]);

  const togglePlayPause = useCallback(() => {
    // Handle chunk-based playback
    if (state.isUsingChunks && chunkManagerRef.current) {
      if (state.isPlaying) {
        chunkManagerRef.current.pause();
        setState(prev => ({ ...prev, isPlaying: false }));
      } else {
        chunkManagerRef.current.resume();
        setState(prev => ({ ...prev, isPlaying: true }));
      }
    } else {
      // Original playback logic
      if (state.isPlaying) {
        pause();
      } else {
        play();
      }
    }
  }, [state.isPlaying, state.isUsingChunks, play, pause]);

  const seek = useCallback(async (position: number) => {
    try {
      // Handle chunk-based seeking
      if (state.isUsingChunks && chunkManagerRef.current) {
        await chunkManagerRef.current.seek(position);
      } else if (soundRef.current) {
        await soundRef.current.setPositionAsync(position);
        setState(prev => ({ ...prev, position }));
      }
    } catch (error) {
      console.error('Error seeking audio:', error);
    }
  }, [state.isUsingChunks]);

  // Volume controls
  const setVolume = useCallback(async (volume: number) => {
    try {
      const normalizedVolume = Math.max(0, Math.min(100, volume));
      setState(prev => ({ ...prev, volume: normalizedVolume }));
      
      if (soundRef.current) {
        await soundRef.current.setVolumeAsync(normalizedVolume / 100);
      }
    } catch (error) {
      console.error('Error setting volume:', error);
    }
  }, []);

  const toggleMute = useCallback(async () => {
    try {
      const newMutedState = !state.isMuted;
      setState(prev => ({ ...prev, isMuted: newMutedState }));
      
      if (soundRef.current) {
        await soundRef.current.setIsMutedAsync(newMutedState);
      }
    } catch (error) {
      console.error('Error toggling mute:', error);
    }
  }, [state.isMuted]);

  // Playback rate controls
  const setPlaybackRate = useCallback(async (rate: number) => {
    try {
      const normalizedRate = Math.max(0.5, Math.min(2.0, rate));
      setState(prev => ({ ...prev, playbackRate: normalizedRate }));
      
      if (soundRef.current) {
        await soundRef.current.setRateAsync(normalizedRate, true); // shouldCorrectPitch: true
      }
      
      console.log(`Playback rate set to ${normalizedRate}x`);
    } catch (error) {
      console.error('Error setting playback rate:', error);
    }
  }, []);

  // Track management
  const addTrack = useCallback((track: AudioTrack) => {
    setState(prev => {
      const existingIndex = prev.tracks.findIndex(t => t.id === track.id);
      if (existingIndex >= 0) {
        // Update existing track
        const updatedTracks = [...prev.tracks];
        updatedTracks[existingIndex] = track;
        return { ...prev, tracks: updatedTracks };
      } else {
        // Add new track
        return { ...prev, tracks: [...prev.tracks, track] };
      }
    });
  }, []);

  const setCurrentTrack = useCallback(async (track: AudioTrack) => {
    setState(prev => {
      const trackIndex = prev.tracks.findIndex(t => t.id === track.id);
      return {
        ...prev,
        currentTrack: track,
        currentTrackId: track.id,
        currentIndex: trackIndex >= 0 ? trackIndex : prev.currentIndex,
        showFloatingPlayer: true,
        isMinimized: true, // Start in minimized state for bottom sheet integration
        // Clear generation state when setting current track
        isGeneratingAudio: false,
        generatingForId: null,
        generationMessage: '',
        generationError: null
      };
    });

    // Load audio if available
    if (track.audioData) {
      await loadAudio(track.audioData);
    }
  }, [loadAudio]);

  const removeTrack = useCallback((trackId: string) => {
    setState(prev => {
      const updatedTracks = prev.tracks.filter(t => t.id !== trackId);
      const wasCurrentTrack = prev.currentTrackId === trackId;
      
      return {
        ...prev,
        tracks: updatedTracks,
        ...(wasCurrentTrack && {
          currentTrack: null,
          currentTrackId: null,
          currentIndex: -1,
          showFloatingPlayer: false,
        }),
      };
    });
  }, []);

  const clearTracks = useCallback(() => {
    setState(prev => ({
      ...prev,
      tracks: [],
      currentTrack: null,
      currentTrackId: null,
      currentIndex: -1,
      showFloatingPlayer: false,
    }));
  }, []);

  // Navigation
  const hasNext = state.currentIndex < state.tracks.length - 1;
  const hasPrevious = state.currentIndex > 0;

  const playNext = useCallback(() => {
    setState(prev => {
      const hasNext = prev.currentIndex < prev.tracks.length - 1;
      if (hasNext) {
        const nextTrack = prev.tracks[prev.currentIndex + 1];
        setCurrentTrack(nextTrack);
      }
      return prev;
    });
  }, [setCurrentTrack]);

  const playPrevious = useCallback(() => {
    setState(prev => {
      const hasPrevious = prev.currentIndex > 0;
      if (hasPrevious) {
        const prevTrack = prev.tracks[prev.currentIndex - 1];
        setCurrentTrack(prevTrack);
      }
      return prev;
    });
  }, [setCurrentTrack]);

  // UI controls
  const minimize = useCallback(() => {
    setState(prev => ({
      ...prev,
      isMinimized: true,
      isFullScreen: false,
      showFloatingPlayer: true, // Ensure the player is shown in bottom sheet
    }));
  }, []);

  const enterFullScreen = useCallback(() => {
    setState(prev => ({
      ...prev,
      isFullScreen: true,
      isMinimized: false,
    }));
  }, []);

  const exitFullScreen = useCallback(() => {
    setState(prev => ({
      ...prev,
      isFullScreen: false,
      isMinimized: true,
    }));
  }, []);

  const closePlayer = useCallback(async () => {
    // Clean up chunks if using chunked playback
    if (chunkManagerRef.current) {
      await chunkManagerRef.current.stop();
      await chunkManagerRef.current.clear();
    }
    
    // Cancel any ongoing streaming
    if (streamHandlerRef.current) {
      streamHandlerRef.current.cancel();
    }
    
    await pause();
    setState(prev => ({
      ...prev,
      showFloatingPlayer: false,
      isMinimized: false,
      isFullScreen: false,
      currentTrack: null,
      currentTrackId: null,
      isUsingChunks: false,
      currentChunkIndex: 0,
      totalChunks: 0,
      isBuffering: false,
      // Reset telemetry when closing
      scriptStartedAt: null,
      generationStartedAt: null,
      firstAudioAt: null,
      generationProgress: undefined,
    }));
  }, [pause]);

  // Audio generation placeholder
  const generateAudio = useCallback(async (trackId: string) => {
    // This will be implemented when integrating with AttractionInfoService
    console.log('Generate audio for track:', trackId);
  }, []);

  // Clear generation states when audio is ready or when switching attractions
  const clearGenerationState = useCallback(() => {
    setState(prev => ({
      ...prev,
      isGeneratingAudio: false,
      generatingForId: null,
      generationMessage: '',
      generationError: null,
      scriptStartedAt: null,
      generationStartedAt: null,
      firstAudioAt: null,
      generationProgress: undefined,
    }));
  }, []);

  // New audio generation functions  
  const startGeneratingAudio = useCallback((attractionId: string, name: string) => {
    // Clear any existing generation state first (allows switching attractions)
    setState(prev => ({
      ...prev,
      isGeneratingAudio: true,
      generatingForId: attractionId,
      generationMessage: `Loading ${name}...`,
      generationError: null,
      showFloatingPlayer: true, // Show mini player immediately
      // Telemetry: mark start of script generation stage
      scriptStartedAt: Date.now(),
      generationStartedAt: null,
      firstAudioAt: null,
    }));
  }, []);

  const setGenerationError = useCallback((error: string) => {
    setState(prev => ({
      ...prev,
      isGeneratingAudio: false,
      generatingForId: null,
      generationError: error,
    }));
  }, []);

  const generateAndPlay = useCallback(async (attraction: AttractionForAudio) => {
    // This will be implemented in map.tsx
    // Placeholder for now
    console.log('Generate and play for attraction:', attraction.name);
  }, []);

  const generateAudioGuide = useCallback(async (
    attraction: PointOfInterest,
    options?: {
      language?: string;
      audioLength?: 'short' | 'medium' | 'deep-dive';
      voiceStyle?: 'casual' | 'formal' | 'energetic' | 'calm';
    }
  ): Promise<boolean> => {
    console.log('generateAudioGuide called with options:', options);

    try {
      await generateAndPlay(attraction);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate audio guide';
      console.error('Failed to generate audio guide:', error);
      setState(prev => ({
        ...prev,
        isGeneratingAudio: false,
        generationError: message,
      }));
      Alert.alert('Audio Error', message);
      return false;
    }
  }, [generateAndPlay]);

  // New chunk-based streaming audio generation
  const streamGenerateAndPlay = useCallback(async (
    attraction: AttractionForAudio,
    text: string,
    preferences: AudioGenerationPreferences
  ) => {
    try {
      console.log('Starting chunked audio generation for:', attraction.name);
      mark('audio_generate_start');

      if (!attraction.userLocation) {
        throw new Error('Attraction userLocation is required for streaming audio generation');
      }
      
      // Initialize chunk manager if needed
      if (!chunkManagerRef.current) {
        chunkManagerRef.current = new AudioChunkManager();
        
        // Set up callbacks
        chunkManagerRef.current.setOnStateChange((chunkState: ChunkPlaybackState) => {
          setState(prev => ({
            ...prev,
            isPlaying: chunkState.isPlaying,
            position: chunkState.totalPosition,
            duration: chunkState.totalDuration,
            currentChunkIndex: chunkState.currentChunkIndex,
            totalChunks: chunkState.totalChunks,
            isBuffering: chunkState.isLoading,
            isUsingChunks: true,
            bufferHealth: chunkManagerRef.current?.getBufferHealth() ?? 0,
          }));
        });
        
        chunkManagerRef.current.setOnAllChunksComplete(() => {
          console.log('All audio chunks completed');
          mark('audio_playback_complete');
          const ttc = measure('TTC', 'audio_generate_start', 'audio_playback_complete');
          setState(prev => ({ ...prev, isPlaying: false, ttcMs: ttc ?? prev.ttcMs }));
        });
      }
      
      // Initialize stream handler if needed
      if (!streamHandlerRef.current) {
        streamHandlerRef.current = new AudioStreamHandler();
      }
      
      // Clear previous audio
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      
      // Clear chunk manager
      await chunkManagerRef.current.clear();
      
      // Update state to show loading
      setState(prev => ({
        ...prev,
        isGeneratingAudio: true,
        generatingForId: attraction.id,
        generationMessage: `Loading ${attraction.name}...`,
        generationError: null,
        showFloatingPlayer: true,
        isBuffering: true,
        isUsingChunks: true,
        // Telemetry: mark start of TTS chunk generation stage for streaming path
        generationStartedAt: Date.now(),
        firstAudioAt: null
      }));
      
      let firstChunkReceived = false;
      
      // Start streaming
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;

      if (!supabaseUrl) {
        throw new Error('Supabase URL is not configured');
      }

      await streamHandlerRef.current.streamAudio(
        `${supabaseUrl}/functions/v1/attraction-info`,
        {
          attractionName: attraction.name,
          attractionAddress: attraction.address || '',
          userLocation: attraction.userLocation,
          preferences: preferences,
          generateAudio: true,
          existingText: text,
          supabaseAnonKey: supabaseAnonKey
        },
        {
          onText: (receivedText) => {
            console.log('Received text:', receivedText.substring(0, 100) + '...');
          },
          onMetadata: (metadata) => {
            console.log('Audio metadata:', metadata);
            setState(prev => ({
              ...prev,
              generationMessage: `Preparing audio (${metadata.totalChunks} parts)...`
            }));
          },
          onChunk: async (chunk) => {
            console.log(`Received chunk ${chunk.chunkIndex + 1}/${chunk.totalChunks}`);
            
            // Add chunk to manager
            await chunkManagerRef.current?.addChunk(chunk);
            
            // Start playing after first chunk
            if (!firstChunkReceived) {
              firstChunkReceived = true;
              // Mark first playable and compute TTFP
              mark('audio_first_play');
              const ttfp = measure('TTFP', 'audio_generate_start', 'audio_first_play');
              setState(prev => ({
                ...prev,
                isGeneratingAudio: false,
                generationMessage: '',
                isBuffering: false,
                // Telemetry: first playable audio time for streaming path
                firstAudioAt: prev.firstAudioAt ?? Date.now(),
                firstPlayableAt: Date.now(),
                ttfpMs: ttfp ?? prev.ttfpMs,
              }));
              
              // Start playback
              setTimeout(() => {
                chunkManagerRef.current?.play(0);
              }, 500); // Small delay to ensure chunk is ready
            }
          },
          onComplete: () => {
            console.log('Streaming complete');
            setState(prev => ({
              ...prev,
              isGeneratingAudio: false,
              generationMessage: '',
              isBuffering: false
            }));
          },
          onError: (error) => {
            console.error('Streaming error:', error);
            setState(prev => ({
              ...prev,
              isGeneratingAudio: false,
              generationError: error,
              isBuffering: false
            }));
            Alert.alert('Audio Error', error);
          }
        }
      );
      
    } catch (error: unknown) {
      console.error('Error in streamGenerateAndPlay:', error);
      const message = error instanceof Error ? error.message : 'Failed to generate audio';
      setState(prev => ({
        ...prev,
        isGeneratingAudio: false,
        generationError: message,
        isBuffering: false
      }));
      Alert.alert('Audio Error', message);
    }
  }, []);

  // New app-orchestrated chunked audio generation
  const generateChunkedAudio = useCallback(async (
    attraction: AttractionForAudio,
    text: string,
    preferences: AudioGenerationPreferences
  ) => {
    try {
      console.log('Starting app-orchestrated chunked audio generation for:', attraction.name);
      mark('audio_generate_start');

      if (!attraction.userLocation) {
        throw new Error('Attraction userLocation is required for chunked audio generation');
      }
      
      // Legacy single-audio path when progressive audio is disabled
      if (!PROGRESSIVE_AUDIO) {
        if (text.length > 3900) {
          throw new Error('Progressive audio is disabled and text exceeds single-chunk limit');
        }
        const audioData = await AttractionInfoService.generateAudio(
          attraction.name,
          attraction.address || 'Unknown location',
          attraction.userLocation,
          {
            theme: preferences.theme,
            audioLength: preferences.audioLength,
            voiceStyle: preferences.voiceStyle,
            language: preferences.language,
          },
          text
        );

        const track: AudioTrack = {
          id: attraction.id,
          title: attraction.name,
          subtitle: attraction.address || 'Audio Guide',
          description: text,
          location: attraction.address,
          category: preferences.theme,
          audioData,
          duration: 0,
          imageUrl: attraction.photos && attraction.photos.length > 0 ? attraction.photos[0] : undefined,
        };
        addTrack(track);
        await setCurrentTrack(track);
        await play();
        setState(prev => ({ ...prev, isGeneratingAudio: false, generationMessage: '' }));
        return;
      }
      
      // Initialize chunk manager if needed
      if (!chunkManagerRef.current) {
        chunkManagerRef.current = new AudioChunkManager();
        
        // Set up callbacks
        chunkManagerRef.current.setOnStateChange((chunkState: ChunkPlaybackState) => {
          setState(prev => ({
            ...prev,
            isPlaying: chunkState.isPlaying,
            position: chunkState.totalPosition,
            duration: chunkState.totalDuration,
            currentChunkIndex: chunkState.currentChunkIndex,
            totalChunks: chunkState.totalChunks,
            isBuffering: chunkState.isLoading,
            isUsingChunks: true,
            bufferHealth: chunkManagerRef.current?.getBufferHealth() ?? 0,
          }));
        });
        
        chunkManagerRef.current.setOnAllChunksComplete(() => {
          console.log('All audio chunks completed');
          mark('audio_playback_complete');
          const ttc = measure('TTC', 'audio_generate_start', 'audio_playback_complete');
          setState(prev => ({ ...prev, isPlaying: false, ttcMs: ttc ?? prev.ttcMs }));
        });
      }
      
      // Initialize audio generation service if needed
      if (!audioGenerationServiceRef.current) {
        audioGenerationServiceRef.current = new AudioGenerationService(chunkManagerRef.current);
      } else {
        audioGenerationServiceRef.current.setChunkManager(chunkManagerRef.current);
      }
      
      // Clear previous audio
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      
      // Clear chunk manager
      await chunkManagerRef.current.clear();
      
      // Debug logging for image URL
      const imageUrl = attraction.photos && attraction.photos.length > 0 ? attraction.photos[0] : undefined;
      console.log('generateChunkedAudio - attraction photos:', attraction.photos);
      console.log('generateChunkedAudio - setting imageUrl to:', imageUrl);
      
      // Update state to show loading
      setState(prev => ({
        ...prev,
        isGeneratingAudio: true,
        generatingForId: attraction.id,
        generationMessage: `Preparing ${attraction.name}...`,
        generationError: null,
        showFloatingPlayer: true,
        isBuffering: true,
        isUsingChunks: true,
        // Telemetry: mark start of TTS chunk generation stage
        generationStartedAt: Date.now(),
        firstAudioAt: null,
        // Create track immediately to keep player visible
        currentTrack: {
          id: attraction.id,
          title: attraction.name,
          subtitle: attraction.address || 'Audio Guide',
          description: text,
          location: attraction.address,
          category: preferences.theme,
          audioData: '', // Will be filled by chunks
          duration: 0,
          imageUrl: imageUrl
        },
        generationProgress: {
          totalChunks: 0,
          chunksGenerated: 0,
          chunksLoading: 0,
          chunksFailed: 0,
          isComplete: false
        }
      }));
      
      // Generate chunks with callbacks
      await audioGenerationServiceRef.current.generateChunkedAudio(
        text,
        preferences.voiceStyle,
        preferences.language,
        {
          onFirstChunkReady: async (chunk) => {
            console.log('First chunk ready, starting playback');
            // Mark first playable and compute TTFP
            mark('audio_first_play');
            const ttfp = measure('TTFP', 'audio_generate_start', 'audio_first_play');
            setState(prev => ({
              ...prev,
              isGeneratingAudio: false,
              generationMessage: '',
              isBuffering: false,
              // Telemetry: mark first playable audio time
              firstAudioAt: prev.firstAudioAt ?? Date.now(),
              // Ensure mini player stays visible
              showFloatingPlayer: true,
              // Keep the existing track which already has the imageUrl set correctly
              // Don't create a new one that might lose the imageUrl
              firstPlayableAt: Date.now(),
              ttfpMs: ttfp ?? prev.ttfpMs,
            }));
            
            // Start playing immediately
            setTimeout(() => {
              chunkManagerRef.current?.play(0);
            }, 100); // Minimal delay to ensure chunk is ready
          },
          onChunkGenerated: (chunk, progress) => {
            console.log(`Chunk ${chunk.chunkIndex + 1}/${chunk.totalChunks} generated`);
            setState(prev => ({
              ...prev,
              generationProgress: progress
            }));
          },
          onChunkFailed: (chunkIndex, error, progress) => {
            console.warn(`Chunk ${chunkIndex} failed: ${error}`);
            setState(prev => ({
              ...prev,
              generationProgress: progress
            }));
          },
          onProgress: (progress) => {
            setState(prev => ({
              ...prev,
              generationProgress: progress,
              generationMessage: progress.isComplete ? '' : 
                `Loading audio (${progress.chunksGenerated}/${progress.totalChunks} parts)...`
            }));
          },
          onComplete: (successful, total) => {
            console.log(`Generation complete: ${successful}/${total} chunks`);
            setState(prev => ({
              ...prev,
              isGeneratingAudio: false,
              generationMessage: '',
              isBuffering: false
            }));
            
            if (successful === 0) {
              Alert.alert('Audio Error', 'Failed to generate audio. Please try again.');
            } else if (successful < total) {
              Alert.alert('Partial Audio', `Generated ${successful} of ${total} audio parts. Some content may be missing.`);
            }
          }
        }
      );
      
    } catch (error: unknown) {
      console.error('Error in generateChunkedAudio:', error);
      const message = error instanceof Error ? error.message : 'Failed to generate audio';
      setState(prev => ({
        ...prev,
        isGeneratingAudio: false,
        generationError: message,
        isBuffering: false
      }));
      Alert.alert('Audio Error', message);
    }
  }, []);

  // Cancel streaming/generation
  const cancelStreaming = useCallback(() => {
    if (streamHandlerRef.current) {
      streamHandlerRef.current.cancel();
    }
    if (audioGenerationServiceRef.current) {
      audioGenerationServiceRef.current.cancel();
    }
    setState(prev => ({
      ...prev,
      isGeneratingAudio: false,
      generationMessage: '',
      isBuffering: false,
      generationProgress: undefined,
      // Reset telemetry on cancel
      scriptStartedAt: null,
      generationStartedAt: null,
      firstAudioAt: null,
    }));
  }, []);

  const contextValue: AudioContextType = {
    // State
    ...state,
    
    // Actions
    play,
    pause,
    togglePlayPause,
    seek,
    setVolume,
    toggleMute,
    setPlaybackRate,
    addTrack,
    setCurrentTrack,
    removeTrack,
    clearTracks,
    playNext,
    playPrevious,
    hasNext,
    hasPrevious,
    minimize,
    enterFullScreen,
    exitFullScreen,
    closePlayer,
    generateAudio,
    startGeneratingAudio,
    clearGenerationState,
    setGenerationError,
    generateAndPlay,
    generateAudioGuide,
    streamGenerateAndPlay,
    generateChunkedAudio,
    cancelStreaming,
  };

  return (
    <AudioContext.Provider value={contextValue}>
      {children}
    </AudioContext.Provider>
  );
}

export const useAudio = (): AudioContextType => {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};
