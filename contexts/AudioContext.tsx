import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { Audio } from 'expo-av';
import { Alert } from 'react-native';
import { TranscriptSegment } from '../services/AttractionInfoService';

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
  
  // Playlist
  tracks: AudioTrack[];
  currentIndex: number;
  
  // Progress
  position: number;
  duration: number;

  // Transcript (timed segments)
  transcriptSegments?: TranscriptSegment[];
}

export interface AudioActions {
  // Playback controls
  play: () => Promise<void>;
  pause: () => void;
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
  generateAndPlay: (attraction: any) => Promise<void>;
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
  showFloatingPlayer: false,
  isGeneratingAudio: false,
  generatingForId: null,
  generationMessage: '',
  generationError: null,
  tracks: [],
  currentIndex: -1,
  position: 0,
  duration: 0,
  transcriptSegments: undefined,
};

export function AudioProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AudioState>(initialState);
  const soundRef = useRef<Audio.Sound | null>(null);
  const positionUpdateRef = useRef<NodeJS.Timeout | null>(null);

  // Configure audio session
  useEffect(() => {
    const configureAudioSession = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: true,
          interruptionModeIOS: 1, // MixWithOthers
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          interruptionModeAndroid: 2, // DoNotMix  
          playThroughEarpieceAndroid: false,
        });
        console.log('Audio session configured successfully');
      } catch (error) {
        console.error('Failed to configure audio session:', error);
        
        // Try fallback configuration
        try {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            staysActiveInBackground: true,
            playsInSilentModeIOS: true,
            shouldDuckAndroid: true,
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
    };

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
  }, []);

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
    }, 1000);
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
      setState(prev => ({ ...prev, isLoading: true }));

      // Unload previous audio
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      // Create audio URI from Base64
      const audioUri = `data:audio/mp3;base64,${audioData}`;
      
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        {
          shouldPlay: false,
          volume: state.volume / 100,
          isMuted: state.isMuted,
          rate: state.playbackRate,
          shouldCorrectPitch: true,
        }
      );

      soundRef.current = sound;

      // Initialize duration/position immediately after loading
      try {
        const initialStatus = await sound.getStatusAsync();
        if (initialStatus.isLoaded) {
          setState(prev => ({
            ...prev,
            isLoading: false,
            position: initialStatus.positionMillis || 0,
            duration: initialStatus.durationMillis || 0,
          }));
        }
      } catch (statusError) {
        console.warn('Unable to get initial audio status after load:', statusError);
      }

      // Set up audio completion handler
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          setState(prev => ({
            ...prev,
            position: status.positionMillis || 0,
            duration: status.durationMillis || 0,
            isLoading: false,
          }));

          // Handle audio completion
          if (status.didJustFinish) {
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
  }, [state.volume, state.isMuted]);

  // Playback controls
  const play = useCallback(async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.playAsync();
        setState(prev => ({ ...prev, isPlaying: true }));
        startPositionTracking();
        console.log('Audio playback started');
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      Alert.alert('Playback Error', 'Failed to play audio');
    }
  }, [startPositionTracking]);

  const pause = useCallback(async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.pauseAsync();
        setState(prev => ({ ...prev, isPlaying: false }));
        stopPositionTracking();
        console.log('Audio playback paused');
      }
    } catch (error) {
      console.error('Error pausing audio:', error);
    }
  }, [stopPositionTracking]);

  const togglePlayPause = useCallback(() => {
    if (state.isPlaying) {
      pause();
    } else {
      play();
    }
  }, [state.isPlaying, play, pause]);

  const seek = useCallback(async (position: number) => {
    try {
      if (soundRef.current) {
        await soundRef.current.setPositionAsync(position);
        setState(prev => ({ ...prev, position }));
      }
    } catch (error) {
      console.error('Error seeking audio:', error);
    }
  }, []);

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
    await pause();
    setState(prev => ({
      ...prev,
      showFloatingPlayer: false,
      isMinimized: false,
      isFullScreen: false,
      currentTrack: null,
      currentTrackId: null,
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

  const generateAndPlay = useCallback(async (attraction: any) => {
    // This will be implemented in map.tsx
    // Placeholder for now
    console.log('Generate and play for attraction:', attraction.name);
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