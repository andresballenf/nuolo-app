import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  Dimensions,
  Animated,
  Image,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
  const scrollViewRef = useRef<ScrollView>(null);

  // Create properly timed segments from the text for better synchronization
  const derivedSegments: TranscriptSegment[] = useMemo(() => {
    if (transcriptSegments && transcriptSegments.length > 0) return transcriptSegments;
    if (!currentTrack?.description || duration <= 0) return [];
    
    // Split text into sentences for better timing control
    const sentences = currentTrack.description
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(Boolean);
    
    if (sentences.length === 0) return [];
    
    // Calculate timing for each sentence based on character count
    const totalChars = sentences.reduce((sum, s) => sum + s.length, 0);
    let cursor = 0;
    
    return sentences.map(s => {
      const portion = s.length / Math.max(1, totalChars);
      const segDuration = portion * duration;
      
      // Split sentence into words with CORRECT sequential timing
      const words = s.split(/\s+/).filter(Boolean);
      const wordTotalChars = words.reduce((sum, w) => sum + w.length, 0) || 1;
      let wordCursor = cursor;
      
      const wordTimings = words.map((word, index) => {
        // Each word gets time proportional to its length
        const wordPortion = word.length / wordTotalChars;
        const wordDuration = wordPortion * segDuration;
        const wordStart = wordCursor;
        const wordEnd = index === words.length - 1 
          ? cursor + segDuration // Last word ends at segment end
          : wordCursor + wordDuration;
        
        const timing = {
          text: word,
          startMs: Math.round(wordStart),
          endMs: Math.round(wordEnd),
        };
        
        wordCursor = wordEnd; // Move cursor for next word
        return timing;
      });
      
      const seg: TranscriptSegment = {
        text: s,
        startMs: Math.round(cursor),
        endMs: Math.round(cursor + segDuration),
        words: wordTimings,
      };
      
      cursor += segDuration;
      return seg;
    });
  }, [transcriptSegments, currentTrack?.description, duration]);

  // Compute active transcript segment index based on current playback position
  const activeSegmentIndex = useMemo(() => {
    const segments = derivedSegments;
    if (!segments || segments.length === 0) return -1;
    
    // Binary search for better performance with many segments
    let left = 0;
    let right = segments.length - 1;
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const seg = segments[mid];
      
      if (position >= seg.startMs && position < seg.endMs) {
        return mid;
      } else if (position < seg.startMs) {
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }
    
    // Handle edge cases
    if (position >= (segments[segments.length - 1]?.endMs || 0)) return segments.length - 1;
    if (position <= 0) return 0;
    
    // Find nearest segment
    return Math.max(0, Math.min(segments.length - 1, left));
  }, [position, derivedSegments]);

  // Find the active word within the current segment
  const activeWordIndex = useMemo(() => {
    const segments = derivedSegments;
    if (activeSegmentIndex < 0 || !segments[activeSegmentIndex]?.words) return -1;
    
    const currentSegment = segments[activeSegmentIndex];
    const words = currentSegment.words || [];
    
    // Binary search for better performance
    let left = 0;
    let right = words.length - 1;
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const word = words[mid];
      
      if (position >= word.startMs && position < word.endMs) {
        return mid;
      } else if (position < word.startMs) {
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }
    
    // Return nearest word
    return Math.max(0, Math.min(words.length - 1, left));
  }, [position, activeSegmentIndex, derivedSegments]);

  // Refs for precise positioning and measurements
  const textContainerRefs = useRef<{ [key: number]: View | null }>({});
  const containerHeight = useRef<number>(0);
  const lastActiveIndex = useRef<number>(-1);
  
  // Perfect center-lock auto-scroll with precise positioning
  useEffect(() => {
    if (scrollViewRef.current && activeSegmentIndex >= 0 && activeSegmentIndex !== lastActiveIndex.current) {
      lastActiveIndex.current = activeSegmentIndex;
      
      // Use requestAnimationFrame for smooth, frame-synced scrolling
      requestAnimationFrame(() => {
        const activeTextRef = textContainerRefs.current[activeSegmentIndex];
        if (activeTextRef && containerHeight.current > 0) {
          // Measure the exact position of the active text element
          activeTextRef.measureInWindow((x, y, width, elementHeight) => {
            if (scrollViewRef.current) {
              // Calculate the exact center position
              const viewportCenter = containerHeight.current / 2;
              const elementCenter = elementHeight / 2;
              
              // Calculate scroll position to put element center at viewport center
              const targetScrollY = Math.max(0, y + elementCenter - viewportCenter);
              
              // Smooth scroll to exact center position
              scrollViewRef.current.scrollTo({
                y: targetScrollY,
                animated: true,
              });
            }
          });
        }
      });
    }
  }, [activeSegmentIndex]);

  const handleSkipBack = () => {
    if (onSeek) {
      const newPosition = Math.max(0, position - 30000); // Skip back 30 seconds
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
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }}
    >
      <SafeAreaView style={styles.container}>
        {/* Header with attraction image, title, and back button */}
        <View style={styles.header}>
          {/* Left: Attraction image */}
          <View style={styles.attractionImageContainer}>
            {currentTrack.imageUrl ? (
              <Image source={{ uri: currentTrack.imageUrl }} style={styles.attractionImage} />
            ) : (
              <View style={styles.attractionImagePlaceholder}>
                <MaterialIcons name="place" size={24} color="#84cc16" />
              </View>
            )}
          </View>

          {/* Center: Attraction name */}
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={2}>
              {currentTrack.title}
            </Text>
          </View>

          {/* Right: Back button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onClose();
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons name="close" size={24} color="#1f2937" />
          </TouchableOpacity>
        </View>

        {/* Main content area - scrollable text with perfect center-lock */}
        <View 
          style={styles.contentContainer}
          onLayout={(event) => {
            containerHeight.current = event.nativeEvent.layout.height;
          }}
        >
          {derivedSegments && derivedSegments.length > 0 ? (
            <View style={styles.textWrapper}>
              {/* Enhanced top gradient with stronger fade for better focus */}
              <LinearGradient
                colors={[
                  'rgba(255, 255, 255, 1)',
                  'rgba(255, 255, 255, 0.95)',
                  'rgba(255, 255, 255, 0.7)',
                  'rgba(255, 255, 255, 0.3)',
                  'transparent'
                ]}
                locations={[0, 0.2, 0.5, 0.8, 1]}
                style={styles.topGradient}
                pointerEvents="none"
              />
              
              <ScrollView
                ref={scrollViewRef}
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                scrollEnabled={true}
                decelerationRate="fast"
                bounces={false} // Disable bouncing for precise positioning
                scrollEventThrottle={16}
                onScrollBeginDrag={() => {
                  // User manual scroll - temporarily disable auto-scroll
                  lastActiveIndex.current = -2; // Set to impossible value to prevent auto-scroll
                }}
                onScrollEndDrag={() => {
                  // Re-enable auto-scroll after manual scroll ends
                  setTimeout(() => {
                    lastActiveIndex.current = -1;
                  }, 1000);
                }}
              >
                {derivedSegments.map((seg, index) => {
                  const isActive = index === activeSegmentIndex;
                  const isPast = index < activeSegmentIndex;
                  const isFuture = index > activeSegmentIndex;
                  
                  return (
                    <View 
                      key={`${seg.startMs}-${index}`} 
                      style={styles.textLineContainer}
                      ref={(ref) => {
                        textContainerRefs.current[index] = ref;
                      }}
                    >
                      {seg.words && seg.words.length > 0 ? (
                        // Render with word-level highlighting
                        <Text style={[styles.textLine, isActive && styles.textLineActive]}>
                          {seg.words.map((word, wordIndex) => {
                            const isWordActive = isActive && wordIndex === activeWordIndex;
                            return (
                              <Text 
                                key={`${seg.startMs}-${wordIndex}`} 
                                style={[
                                  styles.wordText,
                                  isWordActive && styles.wordTextActive,
                                  isPast && styles.wordTextPast,
                                  isFuture && styles.wordTextFuture
                                ]}
                              >
                                {word.text}
                                {wordIndex < (seg.words?.length || 0) - 1 ? ' ' : ''}
                              </Text>
                            );
                          })}
                        </Text>
                      ) : (
                        // Fallback to segment-level highlighting
                        <Text 
                          style={[
                            styles.textLine,
                            isActive && styles.textLineActive,
                            isPast && styles.textLinePast,
                            isFuture && styles.textLineFuture
                          ]}
                        >
                          {seg.text}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
              
              {/* Enhanced bottom gradient with stronger fade for better focus */}
              <LinearGradient
                colors={[
                  'transparent',
                  'rgba(255, 255, 255, 0.3)',
                  'rgba(255, 255, 255, 0.7)',
                  'rgba(255, 255, 255, 0.95)',
                  'rgba(255, 255, 255, 1)'
                ]}
                locations={[0, 0.2, 0.5, 0.8, 1]}
                style={styles.bottomGradient}
                pointerEvents="none"
              />
            </View>
          ) : (
            <View style={styles.noTextContainer}>
              <MaterialIcons name="text-fields" size={48} color="rgba(0, 0, 0, 0.3)" />
              <Text style={styles.noTextText}>No transcript available</Text>
            </View>
          )}
        </View>

        {/* Bottom controls section */}
        <View style={styles.bottomControls}>
          {/* Progress bar with time display */}
          <View style={styles.progressSection}>
            <View style={styles.timeDisplay}>
              <Text style={styles.timeText}>{formatTime(position)}</Text>
              <Text style={styles.timeText}>{formatTime(duration)}</Text>
            </View>
            
            <TouchableOpacity 
              style={styles.progressBar}
              onPress={(event) => {
                if (duration > 0) {
                  const { locationX } = event.nativeEvent;
                  const progressBarWidth = width - 40;
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
                <View 
                  style={[
                    styles.progressHandle, 
                    { 
                      left: `${Math.min(Math.max(progressPercentage, 0), 100)}%`,
                      transform: [{ translateX: -6 }]
                    }
                  ]} 
                />
              </View>
            </TouchableOpacity>
          </View>

          {/* Control buttons */}
          <View style={styles.controlButtons}>
            {/* Skip back 30 seconds */}
            <TouchableOpacity
              style={styles.controlButton}
              onPress={handleSkipBack}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            >
              <MaterialIcons name="replay-30" size={28} color="#1f2937" />
            </TouchableOpacity>

            {/* Play/Pause button */}
            <TouchableOpacity
              style={styles.playButton}
              onPress={isPlaying ? onPause : onPlay}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
              <MaterialIcons 
                name={isPlaying ? "pause" : "play-arrow"} 
                size={36} 
                color="#ffffff" 
              />
            </TouchableOpacity>

            {/* Skip forward 15 seconds */}
            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => {
                if (onSeek) {
                  const newPosition = Math.min(duration, position + 15000); // Skip forward 15 seconds
                  onSeek(newPosition);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
              }}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            >
              <MaterialIcons name="fast-forward" size={28} color="#1f2937" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Volume control overlay (when visible) */}
        {showVolumeControl && (
          <View style={styles.volumeOverlay}>
            <View style={styles.volumeContainer}>
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
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff', // White background like in the image
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
  },
  attractionImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    marginRight: 16,
  },
  attractionImage: {
    width: '100%',
    height: '100%',
  },
  attractionImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(132, 204, 22, 0.1)',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  headerTitle: {
    fontSize: 18,
    color: '#1f2937',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden', // Ensure gradients work properly
  },
  textWrapper: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    alignItems: 'center',
    paddingVertical: height * 0.5, // Half screen padding for perfect vertical centering
    minHeight: height, // Ensure content is at least screen height
  },
  textLineContainer: {
    marginBottom: 24,
    paddingHorizontal: 12,
    maxWidth: '92%',
    alignItems: 'center',
    minHeight: 32, // Ensure consistent spacing for measurements
  },
  textLine: {
    fontSize: 18,
    color: 'rgba(0, 0, 0, 0.4)',
    lineHeight: 28,
    textAlign: 'center',
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  textLineActive: {
    color: '#000000',
    backgroundColor: 'rgba(132, 204, 22, 0.08)',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontWeight: '600',
    fontSize: 24,
    lineHeight: 36,
    shadowColor: 'rgba(132, 204, 22, 0.2)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4,
    transform: [{ scale: 1.02 }], // Subtle scale for emphasis
  },
  textLinePast: {
    opacity: 0.35,
    fontSize: 16,
  },
  textLineFuture: {
    opacity: 0.25,
    fontSize: 16,
  },
  wordText: {
    fontSize: 18,
    color: 'rgba(0, 0, 0, 0.4)',
    lineHeight: 28,
    textAlign: 'center',
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  wordTextActive: {
    color: '#000000',
    backgroundColor: 'rgba(132, 204, 22, 0.35)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontWeight: '700',
    fontSize: 24,
    textShadowColor: 'rgba(132, 204, 22, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    transform: [{ scale: 1.05 }], // Moderate scale for word highlighting
  },
  wordTextPast: {
    opacity: 0.35,
    color: 'rgba(0, 0, 0, 0.3)',
    fontSize: 16,
  },
  wordTextFuture: {
    opacity: 0.25,
    color: 'rgba(0, 0, 0, 0.25)',
    fontSize: 16,
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.35, // Larger gradient area (35% of screen) for smoother transition
    zIndex: 10,
    pointerEvents: 'none',
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.35, // Larger gradient area (35% of screen) for smoother transition
    zIndex: 10,
    pointerEvents: 'none',
  },
  noTextContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noTextText: {
    fontSize: 16,
    color: 'rgba(0, 0, 0, 0.6)',
    marginTop: 16,
  },
  bottomControls: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#ffffff',
  },
  progressSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  timeDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  timeText: {
    fontSize: 14,
    color: 'rgba(0, 0, 0, 0.6)',
    fontWeight: '500',
  },
  progressBar: {
    width: '100%',
    height: 20,
    justifyContent: 'center',
  },
  progressBarBackground: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 3,
    position: 'relative',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#84cc16',
    borderRadius: 3,
  },
  progressHandle: {
    position: 'absolute',
    top: -3,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#84cc16',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  controlButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
  },
  controlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#84cc16',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#84cc16',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  volumeOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  volumeContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 20,
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
    color: '#1f2937',
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
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
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
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
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
});