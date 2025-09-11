import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { PointOfInterest } from '../../services/GooglePlacesService';
import { useMonetization } from '../../contexts/MonetizationContext';

interface AttractionListItemProps {
  attraction: PointOfInterest;
  distance?: string | null;
  isLoading?: boolean;
  isPlaying?: boolean;
  showDetails?: boolean; // Show additional details like rating and distance
  onPress?: () => void;
  onPlayPress?: () => void;
  onMenuPress?: () => void;
}

export const AttractionListItem: React.FC<AttractionListItemProps> = ({
  attraction,
  distance,
  isLoading = false,
  isPlaying = false,
  showDetails = false,
  onPress,
  onPlayPress,
  onMenuPress,
}) => {
  const { subscription, entitlements } = useMonetization();
  
  // Determine if this is a free guide or requires payment
  const isPremium = subscription.isActive && subscription.type !== 'free';
  const hasFreeRemaining = entitlements.remainingFreeAttractions > 0;
  const isOwned = entitlements.ownedAttractions.includes(attraction.id);
  const canAccess = isPremium || hasFreeRemaining || isOwned;
  
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  const handlePlayPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPlayPress?.();
  };

  const handleMenuPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onMenuPress?.();
  };

  // Format address to show only the street or main part
  const formatAddress = (address?: string) => {
    if (!address) return 'Address not available';
    // Take first two parts of the address
    const parts = address.split(',');
    return parts.slice(0, 2).join(',').trim();
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.7}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`${attraction.name}, ${formatAddress(attraction.description)}, ${distance || 'distance unknown'}`}
      accessibilityHint="Double tap to view details"
    >
      {/* Left: Thumbnail Image */}
      <View style={styles.thumbnailContainer}>
        {attraction.photos && attraction.photos.length > 0 ? (
          <Image 
            source={{ uri: attraction.photos[0] }} 
            style={styles.thumbnail}
            defaultSource={require('../../assets/placeholder.png')}
          />
        ) : (
          <View style={styles.placeholderThumbnail}>
            <MaterialIcons name="place" size={28} color="#9CA3AF" />
          </View>
        )}
      </View>

      {/* Center: Name and Address */}
      <View style={styles.infoContainer}>
        <Text style={styles.name} numberOfLines={1}>
          {attraction.name}
        </Text>
        <Text style={styles.address} numberOfLines={1}>
          {formatAddress(attraction.description)}
        </Text>
        
        {/* Additional details when in detail view */}
        {showDetails && (
          <View style={styles.detailsRow}>
            {attraction.rating && (
              <View style={styles.ratingContainer}>
                <MaterialIcons name="star" size={14} color="#FFA500" />
                <Text style={styles.ratingText}>{attraction.rating.toFixed(1)}</Text>
              </View>
            )}
            {distance && (
              <View style={styles.distanceContainer}>
                <MaterialIcons name="navigation" size={14} color="#6B7280" />
                <Text style={styles.distanceText}>{distance}</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Right: Play Button and Menu */}
      <View style={styles.actionsContainer}>
        <View style={styles.playButtonContainer}>
          <TouchableOpacity
            style={[styles.playButton, isPlaying && styles.playButtonPlaying]}
            onPress={handlePlayPress}
            disabled={isLoading}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={isLoading ? "Loading audio" : isPlaying ? "Pause audio" : "Play audio"}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#1F2937" />
            ) : (
              <MaterialIcons 
                name={isPlaying ? "pause" : "play-arrow"} 
                size={24} 
                color={isPlaying ? "#FFFFFF" : "#1F2937"} 
              />
            )}
          </TouchableOpacity>
          
          {/* Entitlement Badge */}
          {!isPremium && !isOwned && (
            <View style={styles.entitlementBadge}>
              {hasFreeRemaining ? (
                <Text style={styles.freeBadgeText}>Free</Text>
              ) : (
                <MaterialIcons name="lock" size={10} color="#EF4444" />
              )}
            </View>
          )}
        </View>
        
        <TouchableOpacity
          style={styles.menuButton}
          onPress={handleMenuPress}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="More options"
        >
          <MaterialIcons name="more-vert" size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    minHeight: 72,
  },
  thumbnailContainer: {
    marginRight: 12,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F3F4F6',
  },
  placeholderThumbnail: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  address: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 2,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 12,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  distanceText: {
    fontSize: 12,
    color: '#6B7280',
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  playButtonContainer: {
    position: 'relative',
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  playButtonPlaying: {
    backgroundColor: '#84cc16',
  },
  entitlementBadge: {
    position: 'absolute',
    top: -4,
    right: -2,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  freeBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#84cc16',
    letterSpacing: 0.5,
  },
  menuButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});