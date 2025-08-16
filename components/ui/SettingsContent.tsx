import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useApp } from '../../contexts/AppContext';

interface SettingsContentProps {
  mapType: 'satellite' | 'hybrid';
  mapTilt: number;
  onMapTypeChange: (type: 'satellite' | 'hybrid') => void;
  onMapTiltChange: (tilt: number) => void;
  onClose?: () => void;
}

export const SettingsContent: React.FC<SettingsContentProps> = ({
  mapType,
  mapTilt,
  onMapTypeChange,
  onMapTiltChange,
  onClose,
}) => {
  const { userPreferences, setUserPreferences } = useApp();
  const mapTypes: Array<{ type: 'satellite' | 'hybrid'; label: string; icon: string }> = [
    { type: 'satellite', label: 'Satellite', icon: 'satellite' },
    { type: 'hybrid', label: 'Hybrid', icon: 'layers' },
  ];
  
  const tiltOptions = [
    { value: 0, label: 'No Tilt' },
    { value: 30, label: '30°' },
    { value: 45, label: '45°' },
    { value: 60, label: '60°' },
  ];
  
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Map Type Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Map Type</Text>
        <View style={styles.mapTypeGrid}>
          {mapTypes.map((item) => (
            <TouchableOpacity
              key={item.type}
              style={[
                styles.mapTypeItem,
                mapType === item.type && styles.mapTypeItemActive,
              ]}
              onPress={() => onMapTypeChange(item.type)}
            >
              <MaterialIcons 
                name={item.icon} 
                size={32} 
                color={mapType === item.type ? '#FFFFFF' : '#6B7280'} 
              />
              <Text style={[
                styles.mapTypeLabel,
                mapType === item.type && styles.mapTypeLabelActive,
              ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      
      {/* Map Tilt Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Map Tilt</Text>
        <Text style={styles.sectionDescription}>
          Adjust the 3D perspective angle of the map
        </Text>
        <View style={styles.tiltOptions}>
          {tiltOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.tiltOption,
                mapTilt === option.value && styles.tiltOptionActive,
              ]}
              onPress={() => onMapTiltChange(option.value)}
            >
              <View style={styles.tiltRadio}>
                {mapTilt === option.value && (
                  <View style={styles.tiltRadioInner} />
                )}
              </View>
              <Text style={[
                styles.tiltLabel,
                mapTilt === option.value && styles.tiltLabelActive,
              ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      
      {/* Audio Length Preference */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Audio Guide Length</Text>
        <Text style={styles.sectionDescription}>
          Choose how detailed you want your audio guides to be
        </Text>
        <View style={styles.audioLengthOptions}>
          <TouchableOpacity
            style={[
              styles.audioOption,
              userPreferences.audioLength === 'short' && styles.audioOptionActive,
            ]}
            onPress={() => setUserPreferences({ ...userPreferences, audioLength: 'short' })}
          >
            <MaterialIcons 
              name="timer" 
              size={20} 
              color={userPreferences.audioLength === 'short' ? '#84cc16' : '#6B7280'} 
            />
            <View style={styles.audioOptionContent}>
              <Text style={[
                styles.audioOptionTitle,
                userPreferences.audioLength === 'short' && styles.audioOptionTitleActive,
              ]}>
                Quick (~1 min)
              </Text>
              <Text style={styles.audioOptionDesc}>Brief highlights only</Text>
            </View>
            {userPreferences.audioLength === 'short' && (
              <MaterialIcons name="check-circle" size={20} color="#84cc16" />
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.audioOption,
              userPreferences.audioLength === 'medium' && styles.audioOptionActive,
            ]}
            onPress={() => setUserPreferences({ ...userPreferences, audioLength: 'medium' })}
          >
            <MaterialIcons 
              name="access-time" 
              size={20} 
              color={userPreferences.audioLength === 'medium' ? '#84cc16' : '#6B7280'} 
            />
            <View style={styles.audioOptionContent}>
              <Text style={[
                styles.audioOptionTitle,
                userPreferences.audioLength === 'medium' && styles.audioOptionTitleActive,
              ]}>
                Standard (~3 min)
              </Text>
              <Text style={styles.audioOptionDesc}>Key facts and stories</Text>
            </View>
            {userPreferences.audioLength === 'medium' && (
              <MaterialIcons name="check-circle" size={20} color="#84cc16" />
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.audioOption,
              userPreferences.audioLength === 'deep-dive' && styles.audioOptionActive,
            ]}
            onPress={() => setUserPreferences({ ...userPreferences, audioLength: 'deep-dive' })}
          >
            <MaterialIcons 
              name="explore" 
              size={20} 
              color={userPreferences.audioLength === 'deep-dive' ? '#84cc16' : '#6B7280'} 
            />
            <View style={styles.audioOptionContent}>
              <Text style={[
                styles.audioOptionTitle,
                userPreferences.audioLength === 'deep-dive' && styles.audioOptionTitleActive,
              ]}>
                Deep Dive (~5 min)
              </Text>
              <Text style={styles.audioOptionDesc}>Comprehensive exploration</Text>
            </View>
            {userPreferences.audioLength === 'deep-dive' && (
              <MaterialIcons name="check-circle" size={20} color="#84cc16" />
            )}
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Additional Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Map Features</Text>
        <View style={styles.featuresList}>
          <TouchableOpacity style={styles.featureItem}>
            <MaterialIcons name="traffic" size={20} color="#6B7280" />
            <Text style={styles.featureLabel}>Traffic</Text>
            <View style={styles.featureToggle}>
              <Text style={styles.featureStatus}>Off</Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.featureItem}>
            <MaterialIcons name="directions-transit" size={20} color="#6B7280" />
            <Text style={styles.featureLabel}>Transit</Text>
            <View style={styles.featureToggle}>
              <Text style={styles.featureStatus}>Off</Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.featureItem}>
            <MaterialIcons name="terrain" size={20} color="#6B7280" />
            <Text style={styles.featureLabel}>Terrain</Text>
            <View style={styles.featureToggle}>
              <Text style={styles.featureStatus}>Off</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Map Info */}
      <View style={styles.mapInfo}>
        <Text style={styles.mapInfoTitle}>Map Data</Text>
        <Text style={styles.mapInfoText}>© 2024 Google Maps</Text>
        <Text style={styles.mapInfoText}>Map data updated regularly</Text>
      </View>
      
      {/* Bottom spacing to ensure last content is accessible in all sheet states */}
      <View style={{ height: 150 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  mapTypeGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  mapTypeItem: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  mapTypeItemActive: {
    backgroundColor: '#84cc16',
  },
  mapTypeLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
    fontWeight: '500',
  },
  mapTypeLabelActive: {
    color: '#FFFFFF',
  },
  tiltOptions: {
    gap: 12,
  },
  tiltOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tiltOptionActive: {
    borderColor: '#84cc16',
    backgroundColor: '#F0FDF4',
  },
  tiltRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#9CA3AF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  tiltRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#84cc16',
  },
  tiltLabel: {
    fontSize: 14,
    color: '#374151',
  },
  tiltLabelActive: {
    fontWeight: '500',
  },
  audioLengthOptions: {
    gap: 12,
  },
  audioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  audioOptionActive: {
    borderColor: '#84cc16',
    backgroundColor: '#F0FDF4',
  },
  audioOptionContent: {
    flex: 1,
    marginLeft: 12,
  },
  audioOptionTitle: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
    marginBottom: 2,
  },
  audioOptionTitleActive: {
    color: '#84cc16',
  },
  audioOptionDesc: {
    fontSize: 12,
    color: '#6B7280',
  },
  featuresList: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  featureLabel: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    marginLeft: 12,
  },
  featureToggle: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  featureStatus: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  mapInfo: {
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  mapInfoTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  mapInfoText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
  },
});