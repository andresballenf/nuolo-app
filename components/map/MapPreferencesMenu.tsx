import React, { useRef, useEffect } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
} from 'react-native';
// Note: Install @react-native-community/slider for the slider functionality
// For now, using a placeholder
const Slider = ({ style, value, onValueChange, minimumValue, maximumValue, minimumTrackTintColor, maximumTrackTintColor, thumbTintColor }: any) => {
  return (
    <View style={[style, { height: 40, justifyContent: 'center' }]}>
      <Text style={{ textAlign: 'center', color: '#9CA3AF' }}>Slider: {Math.round(value)}°</Text>
    </View>
  );
};
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

interface MapPreferencesMenuProps {
  isVisible: boolean;
  onClose: () => void;
  mapType: 'standard' | 'satellite' | 'hybrid';
  mapTilt: number;
  zoom?: number;
  onMapTypeChange: (type: 'standard' | 'satellite' | 'hybrid') => void;
  onMapTiltChange: (tilt: number) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const MapPreferencesMenu: React.FC<MapPreferencesMenuProps> = ({
  isVisible,
  onClose,
  mapType,
  mapTilt,
  zoom = 15,
  onMapTypeChange,
  onMapTiltChange,
}) => {
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible) {
      // Slide in from right
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Slide out to right
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_WIDTH,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible]);

  const mapTypes: Array<{ type: 'standard' | 'satellite' | 'hybrid'; label: string; icon: string }> = [
    { type: 'standard', label: 'Standard', icon: 'map' },
    { type: 'satellite', label: 'Satellite', icon: 'satellite' },
    { type: 'hybrid', label: 'Hybrid', icon: 'terrain' },
  ];

  return (
    <Modal
      transparent
      visible={isVisible}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Backdrop */}
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View 
            style={[
              styles.backdrop,
              {
                opacity: fadeAnim,
              },
            ]} 
          />
        </TouchableWithoutFeedback>

        {/* Menu */}
        <Animated.View 
          style={[
            styles.menu,
            {
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Map Preferences</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>

          {/* Map Type Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Map Type</Text>
            <View style={styles.mapTypeContainer}>
              {mapTypes.map((item) => (
                <TouchableOpacity
                  key={item.type}
                  style={[
                    styles.mapTypeButton,
                    mapType === item.type && styles.mapTypeButtonActive,
                  ]}
                  onPress={() => onMapTypeChange(item.type)}
                  activeOpacity={0.7}
                >
                  <MaterialIcons 
                    name={item.icon} 
                    size={24} 
                    color={mapType === item.type ? '#84cc16' : '#6B7280'} 
                  />
                  <Text 
                    style={[
                      styles.mapTypeLabel,
                      mapType === item.type && styles.mapTypeLabelActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Tilt Control */}
          <View style={styles.section}>
            <View style={styles.sliderHeader}>
              <Text style={styles.sectionTitle}>Tilt</Text>
              <Text style={styles.sliderValue}>{Math.round(mapTilt)}°</Text>
            </View>
            <Slider
              style={styles.slider}
              value={mapTilt}
              onValueChange={onMapTiltChange}
              minimumValue={0}
              maximumValue={60}
              minimumTrackTintColor="#84cc16"
              maximumTrackTintColor="#E5E7EB"
              thumbTintColor="#84cc16"
            />
            <View style={styles.sliderLabels}>
              <Text style={styles.sliderLabel}>0°</Text>
              <Text style={styles.sliderLabel}>60°</Text>
            </View>
          </View>

          {/* Zoom Display */}
          <View style={styles.section}>
            <View style={styles.zoomInfo}>
              <MaterialIcons name="zoom-in" size={24} color="#6B7280" />
              <Text style={styles.zoomText}>Zoom Level: {zoom}</Text>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  menu: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: Math.min(320, SCREEN_WIDTH * 0.85),
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {
      width: -2,
      height: 0,
    },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  closeButton: {
    padding: 4,
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  mapTypeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  mapTypeButton: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  mapTypeButtonActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#84cc16',
  },
  mapTypeLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    fontWeight: '500',
  },
  mapTypeLabelActive: {
    color: '#84cc16',
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sliderValue: {
    fontSize: 14,
    color: '#84cc16',
    fontWeight: '600',
  },
  slider: {
    height: 40,
    marginHorizontal: -10,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -8,
  },
  sliderLabel: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  zoomInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  zoomText: {
    fontSize: 14,
    color: '#6B7280',
  },
});