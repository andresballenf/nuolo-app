import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  SafeAreaView,
  Dimensions,
  Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { AudioTrack } from '../../contexts/AudioContext';
import { TranscriptSegment } from '../../services/AttractionInfoService';
import * as Haptics from 'expo-haptics';

interface FullScreenAudioModeProps {
  isVisible: boolean;
  isPlaying: boolean;
  currentTrack?: AudioTrack | null;
  volume: number;
  isMuted: boolean;
  onClose: () => void;
  onPlay: () => void;
  onPause: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onSeek?: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  position?: number;
  duration?: number;
  playbackRate?: number;
  onPlaybackRateChange?: (rate: number) => void;
  transcriptSegments?: TranscriptSegment[];
}

const { width, height } = Dimensions.get('window');

export const FullScreenAudioMode: React.FC<FullScreenAudioModeProps> = ({
  isVisible,
  isPlaying,
  currentTrack,
  volume,
  isMuted,
  onClose,
  onPlay,
  onPause,
  onNext,
  onPrevious,
  onSeek,
  onVolumeChange,
  onMuteToggle,
  position = 0,
  duration = 0,
  playbackRate = 1.0,
  onPlaybackRateChange,
  transcriptSegments = [],
}) => {
  const [showVolumeControl, setShowVolumeControl] = useState(false);
  const [showSpeedControl, setShowSpeedControl] = useState(false);
  const [isDraggingScrubber, setIsDraggingScrubber] = useState(false);
  const [scrubberPosition, setScrubberPosition] = useState(0);
  const transcriptScrollRef = useRef<ScrollView | null>(null);
  const [showTranscript, setShowTranscript] = useState(true);

  // Fallback: derive simple segments from description if backend didn't return timings
  const derivedSegments: TranscriptSegment[] = useMemo(() => {
    if (transcriptSegments && transcriptSegments.length > 0) return transcriptSegments;
    if (!currentTrack?.description || duration <= 0) return [];
    const sentences = currentTrack.description
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(Boolean);
    if (sentences.length === 0) return [];
    const totalChars = sentences.reduce((sum, s) => sum + s.length, 0);
    let cursor = 0;
    return sentences.map(s => {
      const portion = s.length / Math.max(1, totalChars);
      const segDuration = portion * duration;
      const seg: TranscriptSegment = {
        text: s,
        startMs: Math.round(cursor),
        endMs: Math.round(cursor + segDuration),
      };
      cursor += segDuration;
      return seg;
    });
  }, [transcriptSegments, currentTrack?.description, duration]);

  // Compute active transcript segment index based on current playback position
  const activeSegmentIndex = useMemo(() => {
    const segments = derivedSegments;
    if (!segments || segments.length === 0) return -1;
    const idx = segments.findIndex(seg => position >= seg.startMs && position < seg.endMs);
    if (idx >= 0) return idx;
    if (position >= (segments[segments.length - 1]?.endMs || 0)) return segments.length - 1;
    return 0;
  }, [position, derivedSegments]);

  // Auto-scroll transcript on active segment change
  useEffect(() => {
    if (!transcriptScrollRef.current) return;
    if (activeSegmentIndex < 0) return;
    // Estimate row height and scroll accordingly; RN doesn't support measuring offscreen easily
    // Use a rowHeight guess with padding
    const rowHeight = 52;
    const y = Math.max(0, activeSegmentIndex * rowHeight - rowHeight * 2);
    transcriptScrollRef.current.scrollTo({ y, animated: true });
  }, [activeSegmentIndex]);

  // Playback speed options
  const speedOptions = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  const handleSpeedChange = (speed: number) => {
    onPlaybackRateChange?.(speed);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSkipBack = () => {
    if (onSeek) {
      const newPosition = Math.max(0, position - 30000); // Skip back 30 seconds
      onSeek(newPosition);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleSkipForward = () => {
    if (onSeek) {
      const newPosition = Math.min(duration, position + 30000); // Skip forward 30 seconds
      onSeek(newPosition);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const formatTime = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSeek = (value: number) => {
    if (onSeek && duration > 0) {
      const seekTime = (value / 100) * duration;
      onSeek(seekTime);
    }
  };

  const progressPercentage = duration > 0 ? (position / duration) * 100 : 0;

  if (!currentTrack) {
    return null;
  }

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onShow={() => {
        // Haptic feedback when opening full screen
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }}
    >
      <SafeAreaView style={styles.container}>
        {/* Header with close button */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onClose();
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons name="keyboard-arrow-down" size={28} color="#ffffff" />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <Text style={styles.headerSubtitle}>Now Playing</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {currentTrack.title}
            </Text>
          </View>

          <View style={styles.headerButtonsRow}>
            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowTranscript(prev => !prev);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons name={showTranscript ? 'subtitles' : 'subtitles-off'} size={22} color="#ffffff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowVolumeControl(!showVolumeControl);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons name="more-vert" size={22} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Main content */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Album art placeholder */}
          <View style={styles.albumArtContainer}>
            <View style={styles.albumArt}>
              <MaterialIcons name="headset" size={100} color="#84cc16" />
            </View>
          </View>

          {/* Track info */}
          <View style={styles.trackInfo}>
            <Text style={styles.trackTitle}>{currentTrack.title}</Text>
            {currentTrack.subtitle && (
              <Text style={styles.trackSubtitle}>{currentTrack.subtitle}</Text>
            )}
            {currentTrack.location && (
              <Text style={styles.trackLocation}>{currentTrack.location}</Text>
            )}
          </View>

          {/* Progress section with interactive scrubber */}
          <View style={styles.progressSection}>
            <TouchableOpacity 
              style={styles.progressBar}
              onPress={(event) => {
                if (duration > 0) {
                  const { locationX } = event.nativeEvent;
                  const progressBarWidth = width - 40; // Account for padding
                  const percentage = locationX / progressBarWidth;
                  const seekTime = percentage * duration;
                  onSeek?.(Math.max(0, Math.min(duration, seekTime)));
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
              }}
              activeOpacity={1}
            >
              <View style={styles.progressBarBackground}>
                <View 
                  style={[
                    styles.progressBarFill,
                    { width: `${progressPercentage}%` }
                  ]} 
                />
                {/* Interactive scrubber handle */}
                <View 
                  style={[
                    styles.scrubberHandle, 
                    { 
                      left: `${Math.min(Math.max(progressPercentage, 0), 100)}%`,
                      transform: [{ translateX: -8 }]
                    }
                  ]} 
                />
              </View>
            </TouchableOpacity>
            
            <View style={styles.timeRow}>
              <Text style={styles.timeText}>{formatTime(position)}</Text>
              <Text style={styles.timeText}>{formatTime(duration)}</Text>
            </View>
          </View>

          {/* Professional Control buttons (Audible-style) */}
          <View style={styles.controlsSection}>
            {/* Skip controls row */}
            <View style={styles.skipControls}>
              <TouchableOpacity
                style={styles.skipButton}
                onPress={handleSkipBack}
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              >
                <MaterialIcons name="replay-30" size={36} color="#ffffff" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.playButton}
                onPress={isPlaying ? onPause : onPlay}
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              >
                <MaterialIcons 
                  name={isPlaying ? "pause" : "play-arrow"} 
                  size={48} 
                  color="#1f2937" 
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.skipButton}
                onPress={handleSkipForward}
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              >
                <MaterialIcons name="forward-30" size={36} color="#ffffff" />
              </TouchableOpacity>
            </View>

            {/* Playback speed control */}
            <View style={styles.speedControlSection}>
              <TouchableOpacity
                style={styles.speedButton}
                onPress={() => setShowSpeedControl(!showSpeedControl)}
              >
                <Text style={styles.speedButtonText}>{playbackRate}×</Text>
                <MaterialIcons 
                  name={showSpeedControl ? "keyboard-arrow-up" : "keyboard-arrow-down"} 
                  size={20} 
                  color="#ffffff" 
                />
              </TouchableOpacity>
              
              {showSpeedControl && (
                <View style={styles.speedOptions}>
                  {speedOptions.map((speed) => (
                    <TouchableOpacity
                      key={speed}
                      style={[
                        styles.speedOption,
                        speed === playbackRate && styles.speedOptionActive
                      ]}
                      onPress={() => {
                        handleSpeedChange(speed);
                        setShowSpeedControl(false);
                      }}
                    >
                      <Text style={[
                        styles.speedOptionText,
                        speed === playbackRate && styles.speedOptionTextActive
                      ]}>
                        {speed}×
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Previous/Next track controls (if available) */}
            {(onPrevious || onNext) && (
              <View style={styles.trackNavControls}>
                {onPrevious && (
                  <TouchableOpacity
                    style={styles.trackNavButton}
                    onPress={onPrevious}
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                  >
                    <MaterialIcons name="skip-previous" size={32} color="rgba(255, 255, 255, 0.7)" />
                    <Text style={styles.trackNavText}>Previous</Text>
                  </TouchableOpacity>
                )}

                {onNext && (
                  <TouchableOpacity
                    style={styles.trackNavButton}
                    onPress={onNext}
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                  >
                    <MaterialIcons name="skip-next" size={32} color="rgba(255, 255, 255, 0.7)" />
                    <Text style={styles.trackNavText}>Next</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* Volume control (when visible) */}
          {showVolumeControl && (
            <View style={styles.volumeSection}>
              <View style={styles.volumeHeader}>
                <MaterialIcons name={isMuted ? "volume-off" : "volume-up"} size={20} color="#ffffff" />
                <Text style={styles.volumeLabel}>
                  {isMuted ? 'Muted' : `${volume}%`}
                </Text>
              </View>
              
              <View style={styles.volumeBar}>
                <View style={styles.volumeBarBackground}>
                  <View 
                    style={[
                      styles.volumeBarFill,
                      { width: `${volume}%` }
                    ]} 
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.muteButton,
                  isMuted && styles.muteButtonActive
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onMuteToggle();
                }}
              >
                <MaterialIcons 
                  name={isMuted ? "volume-off" : "volume-up"} 
                  size={16} 
                  color={isMuted ? "#ffffff" : "#1f2937"} 
                />
                <Text style={[
                  styles.muteButtonText,
                  isMuted && styles.muteButtonTextActive
                ]}>
                  {isMuted ? 'Unmute' : 'Mute'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Transcript with karaoke-style highlighting */}
          {showTranscript && derivedSegments && derivedSegments.length > 0 ? (
            <View style={styles.transcriptSection}>
              <Text style={styles.transcriptTitle}>Guide Transcript</Text>
              <ScrollView ref={transcriptScrollRef} style={styles.transcriptScroll} showsVerticalScrollIndicator={false}>
                {derivedSegments.map((seg, index) => {
                  const isActive = index === activeSegmentIndex;
                  // If word-level timings exist, render per-word highlighting
                  if (seg.words && seg.words.length > 0) {
                    const activeWordIndex = seg.words.findIndex(w => position >= w.startMs && position < w.endMs);
                    return (
                      <Text key={`${seg.startMs}-${index}`} style={[styles.transcriptLine, isActive && styles.transcriptLineActive]}>
                        {seg.words.map((w, wi) => {
                          const isWordActive = wi === activeWordIndex && isActive;
                          return (
                            <Text key={`${seg.startMs}-${wi}`} style={isWordActive ? styles.transcriptWordActive : undefined}>
                              {w.text}
                              {/* Add space after each word if not present */}
                              {w.text.match(/\s$/) ? '' : ' '}
                            </Text>
                          );
                        })}
                      </Text>
                    );
                  }
                  // Fallback: segment-level highlighting
                  return (
                    <Text key={`${seg.startMs}-${index}`} style={[styles.transcriptLine, isActive && styles.transcriptLineActive]}>
                      {seg.text}
                    </Text>
                  );
                })}
              </ScrollView>
            </View>
          ) : (
            currentTrack.description && (
              <View style={styles.descriptionSection}>
                <Text style={styles.descriptionTitle}>About this audio guide</Text>
                <Text style={styles.descriptionText}>{currentTrack.description}</Text>
              </View>
            )
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1f2937',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  headerButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  albumArtContainer: {
    alignItems: 'center',
    marginVertical: 40,
  },
  albumArt: {
    width: width * 0.7,
    height: width * 0.7,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackInfo: {
    alignItems: 'center',
    marginBottom: 40,
  },
  trackTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  trackSubtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 4,
  },
  trackLocation: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
  },
  progressSection: {
    marginBottom: 40,
  },
  progressBar: {
    width: '100%',
    height: 20, // Increased for better touch target
    marginVertical: 16,
    justifyContent: 'center',
  },
  progressBarBackground: {
    width: '100%',
    height: 6, // Slightly thicker for premium feel
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 3,
    position: 'relative',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#84cc16',
    borderRadius: 3,
  },
  scrubberHandle: {
    position: 'absolute',
    top: -5, // Center on the progress bar
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#84cc16',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  timeText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
  },
  controlsSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  skipControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 50,
    marginBottom: 32,
  },
  skipButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#84cc16',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#84cc16',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  speedControlSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  speedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    gap: 8,
  },
  speedButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  speedOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 16,
    gap: 12,
  },
  speedOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    minWidth: 60,
    alignItems: 'center',
  },
  speedOptionActive: {
    backgroundColor: '#84cc16',
  },
  speedOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  speedOptionTextActive: {
    color: '#1f2937',
  },
  trackNavControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  trackNavButton: {
    alignItems: 'center',
    padding: 16,
    gap: 8,
  },
  trackNavText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
  },
  volumeSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 40,
  },
  volumeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 8,
  },
  volumeLabel: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
  },
  volumeBar: {
    width: '100%',
    height: 4,
    marginBottom: 16,
  },
  volumeBarBackground: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
  },
  volumeBarFill: {
    height: '100%',
    backgroundColor: '#84cc16',
    borderRadius: 2,
  },
  muteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    gap: 8,
  },
  muteButtonActive: {
    backgroundColor: '#ef4444',
  },
  muteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  muteButtonTextActive: {
    color: '#ffffff',
  },
  descriptionSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 40,
  },
  transcriptSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 40,
  },
  transcriptTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  transcriptScroll: {
    maxHeight: 260,
  },
  transcriptLine: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 24,
    paddingVertical: 6,
  },
  transcriptLineActive: {
    color: '#ffffff',
    backgroundColor: 'rgba(132, 204, 22, 0.15)',
    borderRadius: 8,
    paddingHorizontal: 6,
  },
  transcriptWordActive: {
    color: '#ffffff',
    backgroundColor: 'rgba(132, 204, 22, 0.35)',
    borderRadius: 4,
  },
  descriptionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 24,
  },
});