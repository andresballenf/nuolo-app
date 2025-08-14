import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { AudioTrack } from '../../contexts/AudioContext';

interface MiniAudioPlayerProps {
  isVisible: boolean;
  isLoading: boolean;
  loadingMessage?: string;
  track?: AudioTrack | null;
  isPlaying: boolean;
  progress: number; // 0-1
  onPlayPause: () => void;
  onSkipBack30: () => void;
  onExpand: () => void;
}

export const MiniAudioPlayer: React.FC<MiniAudioPlayerProps> = ({
  isVisible,
  isLoading,
  loadingMessage = 'Loading audio guide...',
  track,
  isPlaying,
  progress,
  onPlayPause,
  onSkipBack30,
  onExpand,
}) => {
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  // Only show loading when actually generating audio, not when audio is playing
  const shouldShowLoading = isLoading && !track;

  useEffect(() => {
    if (isVisible) {
      // Slide up animation
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Slide down animation
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 100,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible]);

  const handlePlayPause = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPlayPause();
  };

  const handleSkipBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSkipBack30();
  };

  const handleExpand = () => {
    // Enhanced haptic feedback for expansion
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Subtle scale animation before expanding
    Animated.sequence([
      Animated.timing(opacity, {
        toValue: 0.8,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onExpand();
    });
  };

  if (!isVisible) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      {/* Progress bar at top */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBackground} />
        <View 
          style={[
            styles.progressFill,
            { width: `${Math.min(progress * 100, 100)}%` }
          ]} 
        />
      </View>

      {/* Enhanced blur background for iOS */}
      {Platform.OS === 'ios' && (
        <BlurView 
          intensity={30} 
          style={StyleSheet.absoluteFillObject} 
          tint="dark"
        />
      )}

      {/* Main content */}
      <View style={styles.content}>
        <TouchableOpacity
          style={styles.expandArea}
          onPress={handleExpand}
          activeOpacity={0.8}
        >
          {/* Track info or loading state */}
          <View style={styles.trackInfo}>
            {shouldShowLoading ? (
              <>
                <Text style={styles.loadingTitle}>Generating Audio</Text>
                <Text style={styles.loadingSubtitle}>{loadingMessage}</Text>
              </>
            ) : track ? (
              <>
                {/* Show attraction image if available */}
                <View style={styles.trackImageContainer}>
                  {track.imageUrl ? (
                    <Image source={{ uri: track.imageUrl }} style={styles.trackImage} />
                  ) : (
                    <View style={styles.trackImagePlaceholder}>
                      <MaterialIcons name="place" size={20} color="#FFFFFF" />
                    </View>
                  )}
                </View>
                <View style={styles.trackTextInfo}>
                  <Text style={styles.trackTitle} numberOfLines={1}>
                    {track.title}
                  </Text>
                  <Text style={styles.trackSubtitle} numberOfLines={1}>
                    {track.subtitle || 'Audio Guide'}
                  </Text>
                </View>
              </>
            ) : null}
          </View>
        </TouchableOpacity>

        {/* Controls */}
        <View style={styles.controls}>
          {/* Skip back 30 seconds button */}
          <TouchableOpacity
            style={[styles.controlButton, shouldShowLoading && styles.controlButtonDisabled]}
            onPress={handleSkipBack}
            disabled={shouldShowLoading}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Skip back 30 seconds"
          >
            <View style={styles.skipBackContainer}>
              <MaterialIcons name="replay-30" size={28} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          {/* Play/Pause button */}
          <TouchableOpacity
            style={[styles.playButton, shouldShowLoading && styles.playButtonLoading]}
            onPress={handlePlayPause}
            disabled={shouldShowLoading}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? "Pause" : "Play"}
          >
            {shouldShowLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <MaterialIcons 
                name={isPlaying ? "pause" : "play-arrow"} 
                size={32} 
                color="#FFFFFF" 
              />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0, // Flush with screen bottom
    left: 0,
    right: 0,
    height: 64 + Platform.select({ ios: 34, android: 0 }), // Add safe area to height instead of positioning
    backgroundColor: Platform.select({
      ios: 'rgba(132, 204, 22, 0.85)', // More transparent for better blur effect
      android: 'rgba(132, 204, 22, 0.96)', // Slightly more opaque for Android
    }),
    zIndex: 2000,
    overflow: 'hidden', // Ensures blur effect clips properly
    ...Platform.select({
      ios: {
        shadowColor: '#84cc16',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        borderTopWidth: 0.5,
        borderTopColor: 'rgba(255, 255, 255, 0.2)',
      },
      android: {
        elevation: 20,
        shadowColor: '#84cc16',
      },
    }),
  },
  progressContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  progressBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  progressFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: 3,
    backgroundColor: '#FFFFFF',
    minWidth: 2,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 2,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: Platform.select({ ios: 34, android: 0 }), // Add safe area padding for content
  },
  expandArea: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  trackInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  trackImageContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  trackImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  trackImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
  },
  trackTextInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  trackTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  trackSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  loadingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  loadingSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  controlButtonDisabled: {
    opacity: 0.4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  skipBackContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  playButtonLoading: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
});