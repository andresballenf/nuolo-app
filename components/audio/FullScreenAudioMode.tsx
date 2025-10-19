import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  Dimensions,
  ScrollView,
  Image,
  findNodeHandle,
  UIManager,
} from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import type { AudioTrack } from '../../contexts/AudioContext';
import { useApp } from '../../contexts/AppContext';
import * as Haptics from 'expo-haptics';
import type { TranscriptSegment } from '../../services/AttractionInfoService';
import { PerfTracer } from '../../utils/perfTrace';

interface FullScreenAudioModeProps {
  isVisible: boolean;
  isPlaying: boolean;
  currentTrack?: AudioTrack | null;
  volume: number;
  isMuted: boolean;
  onClose: () => void;
  onPlay: () => void;
  onPause: () => Promise<void>;
  onNext?: () => void;
  onPrevious?: () => void;
  onSeek?: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  position?: number;
  duration?: number;
  playbackRate?: number;
  onPlaybackRateChange?: (rate: number) => void;
  transcriptSegments?: TranscriptSegment[]; // Not used anymore but kept for compatibility
}

const { width, height } = Dimensions.get('window');
const VIEWPORT_CENTER = height * 0.4; // Golden ratio position for active text

// Adaptive TTS timing - will be calculated based on actual audio duration
const DEFAULT_WORDS_PER_MINUTE = 150; // OpenAI TTS default speed
const WORDS_PER_PHRASE = 4; // Group words into phrases of 3-5 words
const INITIAL_SILENCE_MS = 500; // OpenAI TTS typically has ~500ms silence at start
const END_SILENCE_MS = 500; // Fixed end silence instead of percentage

// Punctuation pause durations (in milliseconds)
const PAUSE_PERIOD = 500; // Pause after sentence
const PAUSE_COMMA = 250; // Pause after comma
const PAUSE_SEMICOLON = 350; // Pause after semicolon
const PAUSE_QUESTION = 450; // Pause after question

type TouchableOpacityInstance = React.ComponentRef<typeof TouchableOpacity>;

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
  transcriptSegments,
}) => {
  const { userPreferences } = useApp();
  const scrollViewRef = useRef<React.ComponentRef<typeof ScrollView> | null>(null);
  const phraseRefs = useRef<Record<number, TouchableOpacityInstance | null>>({});
  const isUserScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScrolledPhraseRef = useRef(-1);

  // Split text into phrases with realistic TTS timing
  const phrases = useMemo(() => {
    if (!currentTrack?.description) return [];
    
    // Split text into words
    const allWords = currentTrack.description
      .split(/\s+/)
      .filter(Boolean)
      .map(word => word.trim())
      .filter(word => word.length > 0);
    
    if (allWords.length === 0) return [];
    
    // Group words into phrases
    const phraseList: { 
      text: string; 
      startMs: number; 
      endMs: number; 
      wordCount: number;
      hasPunctuation: string | null;
    }[] = [];
    let i = 0;
    
    while (i < allWords.length) {
      // Determine phrase length (3-5 words, but can be shorter at end of sentences)
      let phraseLength = WORDS_PER_PHRASE;
      let punctuation: string | null = null;
      
      // Look for natural break points (punctuation)
      for (let j = 1; j <= Math.min(WORDS_PER_PHRASE + 1, allWords.length - i); j++) {
        const word = allWords[i + j - 1];
        const punctMatch = word.match(/([.!?,;:])$/);
        if (punctMatch) {
          phraseLength = j;
          punctuation = punctMatch[1];
          break;
        }
      }
      
      // Don't exceed remaining words
      phraseLength = Math.min(phraseLength, allWords.length - i);
      
      // Extract phrase
      const phraseWords = allWords.slice(i, i + phraseLength);
      const phraseText = phraseWords.join(' ');
      
      phraseList.push({
        text: phraseText,
        startMs: 0, // Will be calculated below
        endMs: 0, // Will be calculated below
        wordCount: phraseWords.length,
        hasPunctuation: punctuation,
      });
      
      i += phraseLength;
    }
    
    // Calculate adaptive timing based on actual audio duration
    if (duration > 0) {
      // Calculate actual speech rate from audio duration
      const totalWords = allWords.length;
      const effectiveStartTime = INITIAL_SILENCE_MS;
      const effectiveDuration = Math.max(100, duration - INITIAL_SILENCE_MS - END_SILENCE_MS);
      
      // Calculate actual words per minute from the audio
      const actualWPM = (totalWords / (effectiveDuration / 60000));
      console.log(`Adaptive timing: ${totalWords} words in ${effectiveDuration}ms = ${actualWPM.toFixed(1)} WPM`);
      console.log(`Audio duration: ${duration}ms, Effective speech time: ${effectiveDuration}ms`);
      
      // Simple proportional distribution - no complex pause calculations
      // Just distribute time evenly based on word count per phrase
      const msPerWord = effectiveDuration / totalWords;
      
      // Assign timing to each phrase based on word count
      let currentTime = effectiveStartTime;
      
      phraseList.forEach((phrase, index) => {
        phrase.startMs = currentTime;
        
        // Simple proportional duration based on word count
        const phraseDuration = phrase.wordCount * msPerWord;
        
        // Add small pause for punctuation (but keep it minimal)
        let pauseDuration = 0;
        if (phrase.hasPunctuation === '.' || phrase.hasPunctuation === '!' || phrase.hasPunctuation === '?') {
          pauseDuration = 200; // Small pause for sentence endings
        } else if (phrase.hasPunctuation === ',' || phrase.hasPunctuation === ';' || phrase.hasPunctuation === ':') {
          pauseDuration = 100; // Tiny pause for other punctuation
        }
        
        phrase.endMs = currentTime + phraseDuration + pauseDuration;
        currentTime = phrase.endMs;
      });
      
      // Adjust last phrase to align with actual audio duration
      if (phraseList.length > 0) {
        const lastPhrase = phraseList[phraseList.length - 1];
        const maxEndTime = duration - END_SILENCE_MS;
        if (lastPhrase.endMs > maxEndTime) {
          // Scale all timings proportionally to fit
          const scaleFactor = (maxEndTime - effectiveStartTime) / (lastPhrase.endMs - effectiveStartTime);
          phraseList.forEach(phrase => {
            phrase.startMs = effectiveStartTime + (phrase.startMs - effectiveStartTime) * scaleFactor;
            phrase.endMs = effectiveStartTime + (phrase.endMs - effectiveStartTime) * scaleFactor;
          });
        }
      }
    } else {
      // Fallback: estimate based on default speech rate when no duration available
      const msPerWord = 60000 / DEFAULT_WORDS_PER_MINUTE;
      
      let currentTime = INITIAL_SILENCE_MS;
      phraseList.forEach(phrase => {
        phrase.startMs = currentTime;
        
        // Simple duration from word count
        const phraseDuration = phrase.wordCount * msPerWord;
        
        // Add minimal pauses for punctuation
        let pauseDuration = 0;
        if (phrase.hasPunctuation === '.' || phrase.hasPunctuation === '!' || phrase.hasPunctuation === '?') {
          pauseDuration = 200;
        } else if (phrase.hasPunctuation === ',' || phrase.hasPunctuation === ';' || phrase.hasPunctuation === ':') {
          pauseDuration = 100;
        }
        
        phrase.endMs = currentTime + phraseDuration + pauseDuration;
        currentTime = phrase.endMs;
      });
    }
    
    return phraseList;
  }, [currentTrack?.description, duration]);

  // Find the active phrase based on current position (with initial delay consideration)
  const activePhraseIndex = useMemo(() => {
    if (phrases.length === 0) return -1;
    
    // Don't highlight anything during initial silence
    if (position < INITIAL_SILENCE_MS) {
      console.log(`Position ${position}ms is still in initial silence (${INITIAL_SILENCE_MS}ms)`);
      return -1;
    }
    
    // Binary search for efficiency
    let left = 0;
    let right = phrases.length - 1;
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const phrase = phrases[mid];
      
      if (position >= phrase.startMs && position < phrase.endMs) {
        return mid;
      } else if (position < phrase.startMs) {
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }
    
    // If we're past all phrases but still in audio, highlight the last phrase
    if (position >= (phrases[phrases.length - 1]?.endMs || 0)) {
      return phrases.length - 1;
    }
    
    return -1;
  }, [position, phrases]);

  // Calculate progress within current phrase (for visual feedback)
  const phraseProgress = useMemo(() => {
    if (activePhraseIndex < 0 || !phrases[activePhraseIndex]) return 0;
    
    const phrase = phrases[activePhraseIndex];
    const phrasePosition = position - phrase.startMs;
    const phraseDuration = phrase.endMs - phrase.startMs;
    
    return Math.min(1, Math.max(0, phrasePosition / phraseDuration));
  }, [position, phrases, activePhraseIndex]);

  // Auto-scroll to keep active phrase in view
  useEffect(() => {
    if (isUserScrollingRef.current) return;
    if (activePhraseIndex < 0 || activePhraseIndex === lastScrolledPhraseRef.current) return;

    lastScrolledPhraseRef.current = activePhraseIndex;
    const phraseRef = phraseRefs.current[activePhraseIndex];
    const phraseNode = phraseRef ? findNodeHandle(phraseRef) : null;
    const scrollViewNode = scrollViewRef.current ? findNodeHandle(scrollViewRef.current) : null;

    if (phraseNode != null && scrollViewNode != null) {
      const handleSuccess = (_x: number, y: number, _width: number, measuredHeight: number) => {
        if (!scrollViewRef.current) return;
        const scrollToY = Math.max(0, y - VIEWPORT_CENTER + measuredHeight / 2);
        scrollViewRef.current.scrollTo({
          y: scrollToY,
          animated: true,
        });
      };

      const handleFailure = () => {
        lastScrolledPhraseRef.current = -1;
      };

      if (typeof UIManager.measureLayout === 'function') {
        UIManager.measureLayout(
          phraseNode,
          scrollViewNode,
          handleFailure,
          handleSuccess
        );
      } else if (phraseRef && typeof (phraseRef as any).measureLayout === 'function') {
        (phraseRef as any).measureLayout(scrollViewNode, handleSuccess, handleFailure);
      }
    }
  }, [activePhraseIndex]);

  // Handle user scroll interactions
  const handleScrollBeginDrag = useCallback(() => {
    isUserScrollingRef.current = true;
    
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
  }, []);

  const handleScrollEndDrag = useCallback(() => {
    // Resume auto-scroll after 3 seconds
    scrollTimeoutRef.current = setTimeout(() => {
      isUserScrollingRef.current = false;
      lastScrolledPhraseRef.current = -1; // Reset to allow scrolling to current phrase
    }, 3000);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const handleSkipBack = () => {
    if (onSeek) {
      const newPosition = Math.max(0, position - 30000);
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

  const progressPercentage = duration > 0 ? (position / duration) * 100 : 0;

  // Handle seeking when tapping on a phrase
  const handlePhrasePress = useCallback((phraseIndex: number) => {
    if (onSeek && phrases[phraseIndex]) {
      onSeek(phrases[phraseIndex].startMs);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [phrases, onSeek]);

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
        PerfTracer.mark('full_player_open');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.attractionImageContainer}>
            {currentTrack.imageUrl ? (
              <Image source={{ uri: currentTrack.imageUrl }} style={styles.attractionImage} />
            ) : (
              <View style={styles.attractionImagePlaceholder}>
                <MaterialIcons name="place" size={24} color="#84cc16" />
              </View>
            )}
          </View>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={2}>
              {currentTrack.title}
            </Text>
            <View style={styles.metadataRow}>
              <Text style={styles.audioLengthIndicator}>
                {userPreferences.audioLength === 'short' && '⚡ Quick'}
                {userPreferences.audioLength === 'medium' && '🎯 Standard'}
                {userPreferences.audioLength === 'deep-dive' && '🔍 Deep Dive'}
              </Text>
              <Text style={styles.languageIndicator}>
                {userPreferences.language === 'en' && '🇺🇸 EN'}
                {userPreferences.language === 'es' && '🇪🇸 ES'}
                {userPreferences.language === 'fr' && '🇫🇷 FR'}
                {userPreferences.language === 'de' && '🇩🇪 DE'}
                {userPreferences.language === 'it' && '🇮🇹 IT'}
                {userPreferences.language === 'pt' && '🇵🇹 PT'}
                {userPreferences.language === 'ru' && '🇷🇺 RU'}
                {userPreferences.language === 'ja' && '🇯🇵 JA'}
                {userPreferences.language === 'ko' && '🇰🇷 KO'}
                {userPreferences.language === 'zh' && '🇨🇳 ZH'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onClose();
            }}
          >
            <MaterialIcons name="close" size={24} color="#1f2937" />
          </TouchableOpacity>
        </View>

        {/* Content with smooth gradient mask */}
        <View style={styles.contentContainer}>
          {phrases.length > 0 ? (
            <MaskedView
              style={styles.maskedContainer}
              maskElement={
                <LinearGradient
                  colors={['transparent', 'black', 'black', 'black', 'transparent']}
                  locations={[0, 0.08, 0.5, 0.92, 1]}
                  style={StyleSheet.absoluteFillObject}
                />
              }
            >
              <ScrollView
                ref={scrollViewRef}
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                onScrollBeginDrag={handleScrollBeginDrag}
                onScrollEndDrag={handleScrollEndDrag}
                scrollEventThrottle={16}
              >
                <View style={styles.textContainer}>
                  {phrases.map((phrase, index) => {
                    const isActive = index === activePhraseIndex;
                    const isPast = index < activePhraseIndex;
                    const isFuture = index > activePhraseIndex;
                    
                    // Calculate proximity for smooth transitions
                    const isNearActive = Math.abs(index - activePhraseIndex) === 1;
                    
                    return (
                      <TouchableOpacity
                        key={index}
                        ref={(ref) => {
                          phraseRefs.current[index] = ref;
                        }}
                        onPress={() => handlePhrasePress(index)}
                        activeOpacity={0.7}
                        style={styles.phraseWrapper}
                      >
                        <View style={isActive && styles.phraseActiveContainer}>
                          {isActive && (
                            <View 
                              style={[
                                styles.phraseProgressBar,
                                { width: `${phraseProgress * 100}%` }
                              ]} 
                            />
                          )}
                          <Text
                            style={[
                              styles.phrase,
                              isActive && styles.phraseActive,
                              isPast && styles.phrasePast,
                              isFuture && styles.phraseFuture,
                              isNearActive && styles.phraseNear,
                            ]}
                          >
                            {phrase.text}{' '}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </MaskedView>
          ) : (
            <View style={styles.noTextContainer}>
              <MaterialIcons name="text-fields" size={48} color="rgba(0, 0, 0, 0.3)" />
              <Text style={styles.noTextText}>No transcript available</Text>
            </View>
          )}
        </View>

        {/* Controls */}
        <View style={styles.bottomControls}>
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

          <View style={styles.controlButtons}>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={handleSkipBack}
            >
              <MaterialIcons name="replay-30" size={28} color="#1f2937" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.playButton}
              onPress={() => {
                if (isPlaying) {
                  onPause().catch(error => console.error('Error pausing:', error));
                } else {
                  onPlay();
                }
              }}
            >
              <MaterialIcons 
                name={isPlaying ? "pause" : "play-arrow"} 
                size={36} 
                color="#ffffff" 
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => {
                if (onSeek) {
                  const newPosition = Math.min(duration, position + 15000);
                  onSeek(newPosition);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
              }}
            >
              <MaterialIcons name="fast-forward" size={28} color="#1f2937" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Auto-scroll indicator */}
        {isUserScrollingRef.current && (
          <View style={styles.scrollIndicator}>
            <Text style={styles.scrollIndicatorText}>Auto-scroll paused</Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
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
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  audioLengthIndicator: {
    fontSize: 12,
    color: '#6B7280',
  },
  languageIndicator: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
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
    backgroundColor: '#ffffff',
  },
  maskedContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: VIEWPORT_CENTER,
    paddingBottom: height - VIEWPORT_CENTER - 100,
    paddingHorizontal: 24,
  },
  textContainer: {
    alignItems: 'center',
  },
  phraseWrapper: {
    marginVertical: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  phraseActiveContainer: {
    position: 'relative',
    backgroundColor: 'rgba(132, 204, 22, 0.08)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  phraseProgressBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: 'rgba(132, 204, 22, 0.15)',
    borderRadius: 12,
  },
  phrase: {
    fontSize: 19,
    color: 'rgba(0, 0, 0, 0.35)',
    lineHeight: 30,
    fontWeight: '400',
    textAlign: 'center',
  },
  phraseActive: {
    color: '#000000',
    fontWeight: '700',
    fontSize: 24,
    lineHeight: 36,
    paddingHorizontal: 16,
    paddingVertical: 8,
    textShadowColor: 'rgba(132, 204, 22, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  phraseNear: {
    color: 'rgba(0, 0, 0, 0.5)',
    fontSize: 20,
  },
  phrasePast: {
    color: 'rgba(0, 0, 0, 0.5)',
    fontWeight: '500',
  },
  phraseFuture: {
    color: 'rgba(0, 0, 0, 0.25)',
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
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
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
  scrollIndicator: {
    position: 'absolute',
    top: 120,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  scrollIndicatorText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
});
