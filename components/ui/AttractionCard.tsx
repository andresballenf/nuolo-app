import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Animated,
} from 'react-native';
import { PointOfInterest } from '../../services/GooglePlacesService';
import { Button } from './Button';

interface AttractionCardProps {
  attraction: PointOfInterest | null;
  onGenerateInfo: (attraction: PointOfInterest) => void;
  attractionInfo?: string | null;
  attractionAudio?: string | null;
  isLoading?: boolean;
  onRequestAudio?: () => void;
  currentIndex: number;
  totalAttractions: number;
  onNext?: () => void;
  onPrevious?: () => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
  isExpanded?: boolean;
  audioState?: {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    onPlay: () => void;
    onPause: () => void;
  };
}

export const AttractionCard: React.FC<AttractionCardProps> = ({
  attraction,
  onGenerateInfo,
  attractionInfo,
  attractionAudio,
  isLoading,
  onRequestAudio,
  currentIndex,
  totalAttractions,
  onNext,
  onPrevious,
  hasNext,
  hasPrevious,
  isExpanded = false,
  audioState,
}) => {
  const [showFullInfo, setShowFullInfo] = useState(false);
  const fadeAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    // Fade animation when attraction changes
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0.3,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  }, [attraction?.id]);

  if (!attraction) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📍</Text>
        <Text style={styles.emptyTitle}>No Attraction Selected</Text>
        <Text style={styles.emptyText}>
          Tap a marker on the map to explore
        </Text>
      </View>
    );
  }

  const truncateInfo = (text: string, maxLength: number = 150) => {
    if (!isExpanded || text.length <= maxLength || showFullInfo) return text;
    return text.substring(0, maxLength) + '...';
  };

  const renderHeader = () => (
    <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
      {/* Attraction Image/Icon */}
      <View style={styles.imageContainer}>
        {attraction.photos && attraction.photos.length > 0 ? (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.imagePlaceholderText}>🏛️</Text>
          </View>
        ) : (
          <View style={[styles.imagePlaceholder, styles.imagePlaceholderDefault]}>
            <Text style={styles.imagePlaceholderText}>📍</Text>
          </View>
        )}
      </View>

      {/* Title and Info */}
      <View style={styles.headerInfo}>
        <Text style={styles.title} numberOfLines={2}>
          {attraction.name}
        </Text>
        
        <View style={styles.metaContainer}>
          {attraction.rating && (
            <View style={styles.ratingContainer}>
              <Text style={styles.ratingIcon}>⭐</Text>
              <Text style={styles.ratingText}>{attraction.rating.toFixed(1)}</Text>
            </View>
          )}
          {attraction.description && (
            <Text style={styles.description} numberOfLines={1}>
              {attraction.description}
            </Text>
          )}
        </View>

        {/* Navigation */}
        {totalAttractions > 1 && (
          <View style={styles.navigationContainer}>
            <TouchableOpacity
              onPress={onPrevious}
              disabled={!hasPrevious}
              style={[styles.navButton, !hasPrevious && styles.navButtonDisabled]}
            >
              <Text style={styles.navButtonText}>‹</Text>
            </TouchableOpacity>
            
            <Text style={styles.navText}>
              {currentIndex + 1} / {totalAttractions}
            </Text>
            
            <TouchableOpacity
              onPress={onNext}
              disabled={!hasNext}
              style={[styles.navButton, !hasNext && styles.navButtonDisabled]}
            >
              <Text style={styles.navButtonText}>›</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Animated.View>
  );

  const renderContent = () => {
    if (!attractionInfo) {
      return (
        <View style={styles.ctaContainer}>
          <Text style={styles.ctaTitle}>Ready to Explore</Text>
          <Text style={styles.ctaText}>
            Generate an AI-powered audio guide for this attraction
          </Text>
          <Button
            title={isLoading ? "Generating..." : "Generate Audio Guide"}
            onPress={() => onGenerateInfo(attraction)}
            disabled={isLoading}
            variant="primary"
            size="lg"
            style={styles.ctaButton}
            loading={isLoading}
          />
        </View>
      );
    }

    return (
      <View style={styles.contentContainer}>
        {/* Info Text */}
        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            {truncateInfo(attractionInfo)}
          </Text>
          {attractionInfo.length > 150 && !isExpanded && (
            <TouchableOpacity
              onPress={() => setShowFullInfo(!showFullInfo)}
              style={styles.readMoreButton}
            >
              <Text style={styles.readMoreText}>
                {showFullInfo ? 'Show less' : 'Read more'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Audio Controls */}
        {attractionAudio || audioState ? (
          <View style={styles.audioContainer}>
            <View style={styles.audioPlayer}>
              <TouchableOpacity
                onPress={audioState?.isPlaying ? audioState.onPause : audioState?.onPlay}
                style={styles.playButton}
              >
                <Text style={styles.playIcon}>
                  {audioState?.isPlaying ? '⏸' : '▶️'}
                </Text>
              </TouchableOpacity>
              
              <View style={styles.audioInfo}>
                <View style={styles.audioHeader}>
                  <Text style={styles.audioIcon}>🔊</Text>
                  <Text style={styles.audioTitle}>Audio Guide</Text>
                </View>
                {audioState && audioState.duration > 0 && (
                  <View style={styles.progressBar}>
                    <View 
                      style={[
                        styles.progressFill,
                        { 
                          width: `${(audioState.currentTime / audioState.duration) * 100}%` 
                        }
                      ]} 
                    />
                  </View>
                )}
              </View>
            </View>
          </View>
        ) : (
          <Button
            title="🔊 Generate Audio Narration"
            onPress={onRequestAudio}
            variant="outline"
            size="md"
            style={styles.audioButton}
            disabled={isLoading}
          />
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {renderHeader()}
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#84cc16" />
          <Text style={styles.loadingText}>Generating content...</Text>
        </View>
      ) : (
        renderContent()
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    marginBottom: 20,
    paddingTop: 10,
  },
  imageContainer: {
    marginRight: 16,
  },
  imagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderDefault: {
    backgroundColor: '#FEE2E2',
  },
  imagePlaceholderText: {
    fontSize: 32,
  },
  headerInfo: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 6,
    lineHeight: 26,
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingIcon: {
    fontSize: 14,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  description: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
  },
  navigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  navButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  navButtonText: {
    fontSize: 18,
    color: '#374151',
    fontWeight: '600',
  },
  navText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  ctaContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  ctaTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  ctaText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  ctaButton: {
    minWidth: 200,
  },
  contentContainer: {
    gap: 16,
  },
  infoContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoText: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 24,
  },
  readMoreButton: {
    marginTop: 8,
  },
  readMoreText: {
    fontSize: 14,
    color: '#84cc16',
    fontWeight: '600',
  },
  audioContainer: {
    backgroundColor: '#84cc16',
    borderRadius: 16,
    padding: 16,
  },
  audioPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    fontSize: 20,
  },
  audioInfo: {
    flex: 1,
  },
  audioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  audioIcon: {
    fontSize: 16,
  },
  audioTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
  audioButton: {
    width: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
  },
});