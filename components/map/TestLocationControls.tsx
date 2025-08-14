import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface PopularLocation {
  name: string;
  lat: number;
  lng: number;
}

interface TestLocationControlsProps {
  isTestModeEnabled: boolean;
  onTestModeToggle: (enabled: boolean) => void;
  testLatitude: string;
  testLongitude: string;
  onTestLatitudeChange: (value: string) => void;
  onTestLongitudeChange: (value: string) => void;
  onApplyTestLocation: () => void;
  onApplyPopularLocation: (location: PopularLocation) => void;
  mapType?: 'satellite' | 'hybrid';
  onMapTypeChange?: (type: 'satellite' | 'hybrid') => void;
  mapTilt?: number;
  onMapTiltChange?: (tilt: number) => void;
  popularLocations?: PopularLocation[];
}

// Popular locations for quick testing (same as web app)
const POPULAR_LOCATIONS: PopularLocation[] = [
  { name: 'Paris', lat: 48.8566, lng: 2.3522 },
  { name: 'New York', lat: 40.7128, lng: -74.0060 },
  { name: 'Tokyo', lat: 35.6762, lng: 139.6503 },
  { name: 'Rome', lat: 41.9028, lng: 12.4964 },
  { name: 'Cairo', lat: 30.0444, lng: 31.2357 },
  { name: 'Cincinnati', lat: 39.1088, lng: -84.5175 },
];

export const TestLocationControls: React.FC<TestLocationControlsProps> = ({
  isTestModeEnabled,
  onTestModeToggle,
  testLatitude,
  testLongitude,
  onTestLatitudeChange,
  onTestLongitudeChange,
  onApplyTestLocation,
  onApplyPopularLocation,
  mapType = 'satellite',
  onMapTypeChange,
  mapTilt = 45,
  onMapTiltChange,
  popularLocations = POPULAR_LOCATIONS,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const validateAndApplyCoordinates = () => {
    const lat = parseFloat(testLatitude);
    const lng = parseFloat(testLongitude);

    if (isNaN(lat) || isNaN(lng)) {
      Alert.alert(
        'Invalid Coordinates',
        'Please enter valid latitude and longitude values'
      );
      return;
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      Alert.alert(
        'Invalid Range',
        'Latitude must be between -90 and 90, longitude between -180 and 180'
      );
      return;
    }

    onApplyTestLocation();
  };

  const handlePopularLocationPress = (location: PopularLocation) => {
    onTestLatitudeChange(location.lat.toString());
    onTestLongitudeChange(location.lng.toString());
    onApplyPopularLocation(location);
  };

  return (
    <View style={styles.devContainer}>
      {!isExpanded && (
        <TouchableOpacity
          style={styles.devPill}
          onPress={() => setIsExpanded(!isExpanded)}
          activeOpacity={0.7}
        >
          <Text style={styles.devPillText}>DEV</Text>
        </TouchableOpacity>
      )}
      
      {isExpanded && (
        <Card style={styles.container}>
          <TouchableOpacity
            style={styles.header}
            onPress={() => setIsExpanded(!isExpanded)}
            activeOpacity={0.7}
          >
            <Text style={styles.headerTitle}>🧪 Test Location</Text>
            <Text style={styles.expandIcon}>✕</Text>
          </TouchableOpacity>

          <View style={styles.content}>
          {/* Test Mode Toggle */}
          <View style={styles.toggleContainer}>
            <Text style={styles.toggleLabel}>Test Mode</Text>
            <TouchableOpacity
              style={[
                styles.toggle,
                isTestModeEnabled && styles.toggleActive
              ]}
              onPress={() => onTestModeToggle(!isTestModeEnabled)}
            >
              <View style={[
                styles.toggleThumb,
                isTestModeEnabled && styles.toggleThumbActive
              ]} />
            </TouchableOpacity>
          </View>

          {isTestModeEnabled && (
            <>
              {/* Coordinate Input */}
              <View style={styles.coordinateContainer}>
                <Text style={styles.sectionTitle}>Custom Coordinates</Text>
                
                <View style={styles.inputRow}>
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Latitude</Text>
                    <TextInput
                      style={styles.input}
                      value={testLatitude}
                      onChangeText={onTestLatitudeChange}
                      placeholder="e.g., 48.8566"
                      keyboardType="numeric"
                    />
                  </View>
                  
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Longitude</Text>
                    <TextInput
                      style={styles.input}
                      value={testLongitude}
                      onChangeText={onTestLongitudeChange}
                      placeholder="e.g., 2.3522"
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <Button
                  title="Apply Coordinates"
                  onPress={validateAndApplyCoordinates}
                  variant="primary"
                  size="sm"
                  style={styles.applyButton}
                />
              </View>

              {/* Popular Locations */}
              <View style={styles.popularContainer}>
                <Text style={styles.sectionTitle}>Popular Locations</Text>
                <Text style={styles.locationHint}>
                  🏗️ NYC, Paris, Tokyo have excellent 3D building coverage
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.popularScroll}
                >
                  {popularLocations.map((location) => (
                    <TouchableOpacity
                      key={location.name}
                      style={styles.popularLocation}
                      onPress={() => handlePopularLocationPress(location)}
                    >
                      <Text style={styles.popularLocationName}>
                        {location.name}
                      </Text>
                      <Text style={styles.popularLocationCoords}>
                        {location.lat.toFixed(2)}, {location.lng.toFixed(2)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </>
          )}

          {/* Map Controls - Always visible */}
          <View style={styles.mapControlsContainer}>
            <Text style={styles.sectionTitle}>Map Controls</Text>
            
            {/* Map Type Selection */}
            {onMapTypeChange && (
              <View style={styles.controlGroup}>
                <Text style={styles.controlLabel}>Map Type</Text>
                <View style={styles.mapTypeContainer}>
                  {(['satellite', 'hybrid'] as const).map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.mapTypeButton,
                        mapType === type && styles.mapTypeButtonActive
                      ]}
                      onPress={() => onMapTypeChange(type)}
                    >
                      <Text style={[
                        styles.mapTypeButtonText,
                        mapType === type && styles.mapTypeButtonTextActive
                      ]}>
                        {type === 'satellite' ? '🛰️' : '🔀'}
                      </Text>
                      <Text style={[
                        styles.mapTypeButtonLabel,
                        mapType === type && styles.mapTypeButtonLabelActive
                      ]}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Tilt Control */}
            {onMapTiltChange && (
              <View style={styles.controlGroup}>
                <Text style={styles.controlLabel}>3D Tilt: {mapTilt}°</Text>
                <View style={styles.tiltContainer}>
                  {[0, 30, 45, 60].map((tilt) => (
                    <TouchableOpacity
                      key={tilt}
                      style={[
                        styles.tiltButton,
                        mapTilt === tilt && styles.tiltButtonActive
                      ]}
                      onPress={() => onMapTiltChange(tilt)}
                    >
                      <Text style={[
                        styles.tiltButtonText,
                        mapTilt === tilt && styles.tiltButtonTextActive
                      ]}>
                        {tilt}°
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.tiltHint}>
                  {mapTilt === 0 && '2D view - no 3D buildings'}
                  {mapTilt === 30 && 'Slight 3D - minimal buildings'}
                  {mapTilt === 45 && '3D view - buildings visible'}
                  {mapTilt === 60 && 'Full 3D - best for buildings'}
                </Text>
              </View>
            )}
          </View>
          </View>
        </Card>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  devContainer: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    zIndex: 999,
  },
  devPill: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  devPillText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
    opacity: 0.7,
  },
  container: {
    margin: 0,
    minWidth: 280,
    maxWidth: 320,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  expandIcon: {
    fontSize: 12,
    color: '#6b7280',
  },
  content: {
    paddingTop: 16,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: '#84cc16',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbActive: {
    transform: [{ translateX: 20 }],
  },
  coordinateContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  inputContainer: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: '#ffffff',
  },
  applyButton: {
    alignSelf: 'flex-start',
  },
  popularContainer: {
    marginBottom: 16,
  },
  locationHint: {
    fontSize: 11,
    color: '#65a30d',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  popularScroll: {
    marginHorizontal: -4,
  },
  popularLocation: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 4,
    minWidth: 80,
    alignItems: 'center',
  },
  popularLocationName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 2,
  },
  popularLocationCoords: {
    fontSize: 10,
    color: '#6b7280',
  },
  mapControlsContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  controlGroup: {
    marginBottom: 16,
  },
  controlLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 8,
  },
  mapTypeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  mapTypeButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  mapTypeButtonActive: {
    backgroundColor: '#84cc16',
    borderColor: '#84cc16',
  },
  mapTypeButtonText: {
    fontSize: 14,
    marginBottom: 2,
  },
  mapTypeButtonTextActive: {
    color: '#ffffff',
  },
  mapTypeButtonLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#6b7280',
  },
  mapTypeButtonLabelActive: {
    color: '#ffffff',
  },
  tiltContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  tiltButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    paddingVertical: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  tiltButtonActive: {
    backgroundColor: '#84cc16',
    borderColor: '#84cc16',
  },
  tiltButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
  },
  tiltButtonTextActive: {
    color: '#ffffff',
  },
  tiltHint: {
    fontSize: 11,
    color: '#9ca3af',
    fontStyle: 'italic',
    marginTop: 6,
  },
});