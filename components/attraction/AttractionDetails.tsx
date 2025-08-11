import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Button } from '../ui/Button';
import { PointOfInterest } from '../../services/GooglePlacesService';

interface AttractionDetailsProps {
  attraction: PointOfInterest | null;
  onGenerateInfo?: (attraction: PointOfInterest) => void;
  onNext?: () => void;
  onPrevious?: () => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
  totalAttractions?: number;
  currentIndex?: number;
  attractionInfo?: string | null;
  isLoading?: boolean;
  onClose?: () => void;
  onRequestAudio?: () => void;
}

export const AttractionDetails: React.FC<AttractionDetailsProps> = ({
  attraction,
  onGenerateInfo,
  onNext,
  onPrevious,
  hasNext = false,
  hasPrevious = false,
  totalAttractions = 0,
  currentIndex = 0,
  attractionInfo,
  isLoading = false,
  onClose,
  onRequestAudio,
}) => {
  if (!attraction) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Select an attraction to view details</Text>
      </View>
    );
  }

  const renderNavigationHeader = () => (
    <View style={styles.navigationHeader}>
      <View style={styles.navigationInfo}>
        <Text style={styles.attractionCount}>
          {currentIndex + 1} of {totalAttractions}
        </Text>
        <Text style={styles.attractionName}>{attraction.name}</Text>
      </View>
      
      <View style={styles.navigationButtons}>
        <Button
          title="Previous"
          onPress={onPrevious}
          disabled={!hasPrevious}
          variant="outline"
          size="sm"
          style={styles.navButton}
        />
        <Button
          title="Next"
          onPress={onNext}
          disabled={!hasNext}
          variant="outline"
          size="sm"
          style={styles.navButton}
        />
      </View>
    </View>
  );

  const renderAttractionHeader = () => (
    <View style={styles.headerContainer}>
      {/* Hero Image Section */}
      <View style={styles.heroImageContainer}>
        <Text style={styles.heroImagePlaceholder}>🏠</Text>
      </View>
      
      {/* Attraction Info */}
      <View style={styles.headerInfo}>
        <Text style={styles.title}>{attraction.name}</Text>
        <Text style={styles.subtitle}>Tourist Attraction</Text>
        {attraction.rating && (
          <View style={styles.ratingContainer}>
            <Text style={styles.rating}>⭐ {attraction.rating.toFixed(1)}</Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderActionButtons = () => (
    <View style={styles.actionButtons}>
      {!attractionInfo ? (
        <Button
          title={isLoading ? "Generating..." : "Generate Audio Guide"}
          onPress={() => onGenerateInfo?.(attraction)}
          disabled={isLoading}
          variant="primary"
          size="lg"
          style={styles.generateButton}
        />
      ) : (
        <View style={styles.audioButtons}>
          <Button
            title="🎵 Play Audio"
            onPress={onRequestAudio}
            variant="primary"
            size="lg"
            style={styles.playButton}
          />
          <Button
            title="Regenerate"
            onPress={() => onGenerateInfo?.(attraction)}
            disabled={isLoading}
            variant="outline"
            size="md"
            style={styles.regenerateButton}
          />
        </View>
      )}
    </View>
  );

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#84cc16" />
          <Text style={styles.loadingText}>Generating personalized content...</Text>
        </View>
      );
    }

    if (attractionInfo) {
      return (
        <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.contentText}>{attractionInfo}</Text>
        </ScrollView>
      );
    }

    return (
      <View style={styles.placeholderContainer}>
        <Text style={styles.placeholderTitle}>Ready to explore?</Text>
        <Text style={styles.placeholderText}>
          Generate an AI-powered audio guide with personalized information about this attraction.
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Navigation header (only show if multiple attractions) */}
      {totalAttractions > 1 && renderNavigationHeader()}
      
      {/* Attraction header */}
      {renderAttractionHeader()}
      
      {/* Action buttons */}
      {renderActionButtons()}
      
      {/* Content area */}
      <View style={styles.contentContainer}>
        {renderContent()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  navigationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    marginBottom: 16,
  },
  navigationInfo: {
    flex: 1,
  },
  attractionCount: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  attractionName: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
    marginTop: 2,
  },
  navigationButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  navButton: {
    minWidth: 80,
  },
  headerContainer: {
    marginBottom: 20,
  },
  heroImageContainer: {
    height: 200,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroImagePlaceholder: {
    fontSize: 48,
    color: '#6B7280',
  },
  headerInfo: {
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 8,
  },
  ratingContainer: {
    alignSelf: 'flex-start',
  },
  rating: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '600',
  },
  actionButtons: {
    marginBottom: 20,
  },
  generateButton: {
    width: '100%',
  },
  audioButtons: {
    gap: 12,
  },
  playButton: {
    width: '100%',
  },
  regenerateButton: {
    width: '100%',
  },
  contentContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 16,
    textAlign: 'center',
  },
  contentScroll: {
    flex: 1,
  },
  contentText: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 26,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  placeholderTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    textAlign: 'center',
  },
  placeholderText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
});