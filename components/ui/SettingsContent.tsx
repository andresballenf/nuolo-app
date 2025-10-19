import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Platform } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useApp } from '../../contexts/AppContext';
import { useMapSettings } from '../../contexts/MapSettingsContext';

interface SettingsContentProps {
  onClose?: () => void;
}

export const SettingsContent: React.FC<SettingsContentProps> = ({ onClose }) => {
  const { userPreferences, setUserPreferences } = useApp();
  const { settings, setSettings, isFeatureSupported } = useMapSettings();

  const allMapTypes: Array<{ type: 'satellite' | 'hybrid' | 'terrain'; label: string; icon: string }> = [
    { type: 'satellite', label: 'Satellite', icon: 'satellite' },
    { type: 'hybrid', label: 'Hybrid', icon: 'layers' },
    { type: 'terrain', label: 'Terrain (Android)', icon: 'terrain' },
  ];
  const mapTypes = Platform.OS === 'android' ? allMapTypes : allMapTypes.filter(t => t.type !== 'terrain');
  
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
                settings.mapType === item.type && styles.mapTypeItemActive,
              ]}
              onPress={() => setSettings({ mapType: item.type })}
            >
              <MaterialIcons 
                name={item.icon} 
                size={32} 
                color={settings.mapType === item.type ? '#FFFFFF' : '#6B7280'} 
              />
              <Text style={[
                styles.mapTypeLabel,
                settings.mapType === item.type && styles.mapTypeLabelActive,
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
                settings.tilt === option.value && styles.tiltOptionActive,
              ]}
              onPress={() => setSettings({ tilt: option.value })}
            >
              <View style={styles.tiltRadio}>
                {settings.tilt === option.value && (
                  <View style={styles.tiltRadioInner} />
                )}
              </View>
              <Text style={[
                styles.tiltLabel,
                settings.tilt === option.value && styles.tiltLabelActive,
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
          {/* Traffic */}
          <TouchableOpacity style={styles.featureItem} onPress={() => isFeatureSupported('showsTraffic') && setSettings({ showsTraffic: !settings.showsTraffic })}>
            <MaterialIcons name="traffic" size={20} color="#6B7280" />
            <Text style={styles.featureLabel}>Traffic</Text>
            <View style={[styles.featureToggle, settings.showsTraffic && styles.audioOptionActive]}>
              <Text style={[styles.featureStatus, settings.showsTraffic && styles.audioOptionTitleActive]}>
                {isFeatureSupported('showsTraffic') ? (settings.showsTraffic ? 'On' : 'Off') : 'Unsupported'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* 3D Buildings */}
          <TouchableOpacity style={styles.featureItem} onPress={() => isFeatureSupported('showsBuildings') && setSettings({ showsBuildings: !settings.showsBuildings })}>
            <MaterialIcons name="domain" size={20} color="#6B7280" />
            <Text style={styles.featureLabel}>3D Buildings</Text>
            <View style={[styles.featureToggle, settings.showsBuildings && styles.audioOptionActive]}>
              <Text style={[styles.featureStatus, settings.showsBuildings && styles.audioOptionTitleActive]}>
                {isFeatureSupported('showsBuildings') ? (settings.showsBuildings ? 'On' : 'Off') : 'Unsupported'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Compass */}
          <TouchableOpacity style={styles.featureItem} onPress={() => isFeatureSupported('showsCompass') && setSettings({ showsCompass: !settings.showsCompass })}>
            <MaterialIcons name="explore" size={20} color="#6B7280" />
            <Text style={styles.featureLabel}>Compass</Text>
            <View style={[styles.featureToggle, settings.showsCompass && styles.audioOptionActive]}>
              <Text style={[styles.featureStatus, settings.showsCompass && styles.audioOptionTitleActive]}>
                {isFeatureSupported('showsCompass') ? (settings.showsCompass ? 'On' : 'Off') : 'Unsupported'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Indoors */}
          <TouchableOpacity style={styles.featureItem} onPress={() => isFeatureSupported('showsIndoors') && setSettings({ showsIndoors: !settings.showsIndoors })}>
            <MaterialIcons name="apartment" size={20} color="#6B7280" />
            <Text style={styles.featureLabel}>Indoor Maps</Text>
            <View style={[styles.featureToggle, settings.showsIndoors && styles.audioOptionActive]}>
              <Text style={[styles.featureStatus, settings.showsIndoors && styles.audioOptionTitleActive]}>
                {isFeatureSupported('showsIndoors') ? (settings.showsIndoors ? 'On' : 'Off') : 'Unsupported'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Indoor Level Picker (Android) */}
          <TouchableOpacity style={styles.featureItem} onPress={() => isFeatureSupported('showsIndoorLevelPicker') && setSettings({ showsIndoorLevelPicker: !settings.showsIndoorLevelPicker })}>
            <MaterialIcons name="view-list" size={20} color="#6B7280" />
            <Text style={styles.featureLabel}>Indoor Level Picker</Text>
            <View style={[styles.featureToggle, settings.showsIndoorLevelPicker && styles.audioOptionActive]}>
              <Text style={[styles.featureStatus, settings.showsIndoorLevelPicker && styles.audioOptionTitleActive]}>
                {isFeatureSupported('showsIndoorLevelPicker') ? (settings.showsIndoorLevelPicker ? 'On' : 'Off') : 'Unsupported'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Points of Interest (iOS) */}
          <TouchableOpacity style={styles.featureItem} onPress={() => isFeatureSupported('showsPointsOfInterest') && setSettings({ showsPointsOfInterest: !settings.showsPointsOfInterest })}>
            <MaterialIcons name="place" size={20} color="#6B7280" />
            <Text style={styles.featureLabel}>Points of Interest</Text>
            <View style={[styles.featureToggle, settings.showsPointsOfInterest && styles.audioOptionActive]}>
              <Text style={[styles.featureStatus, settings.showsPointsOfInterest && styles.audioOptionTitleActive]}>
                {isFeatureSupported('showsPointsOfInterest') ? (settings.showsPointsOfInterest ? 'On' : 'Off') : 'Unsupported'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Gestures */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Gestures</Text>
        <View style={styles.featuresList}>
          <TouchableOpacity style={styles.featureItem} onPress={() => setSettings({ pitchEnabled: !settings.pitchEnabled })}>
            <MaterialIcons name="pan-tool" size={20} color="#6B7280" />
            <Text style={styles.featureLabel}>Pitch</Text>
            <View style={[styles.featureToggle, settings.pitchEnabled && styles.audioOptionActive]}>
              <Text style={[styles.featureStatus, settings.pitchEnabled && styles.audioOptionTitleActive]}>
                {settings.pitchEnabled ? 'On' : 'Off'}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.featureItem} onPress={() => setSettings({ rotateEnabled: !settings.rotateEnabled })}>
            <MaterialIcons name="rotate-90-degrees-ccw" size={20} color="#6B7280" />
            <Text style={styles.featureLabel}>Rotate</Text>
            <View style={[styles.featureToggle, settings.rotateEnabled && styles.audioOptionActive]}>
              <Text style={[styles.featureStatus, settings.rotateEnabled && styles.audioOptionTitleActive]}>
                {settings.rotateEnabled ? 'On' : 'Off'}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.featureItem} onPress={() => setSettings({ zoomEnabled: !settings.zoomEnabled })}>
            <MaterialIcons name="zoom-in" size={20} color="#6B7280" />
            <Text style={styles.featureLabel}>Zoom</Text>
            <View style={[styles.featureToggle, settings.zoomEnabled && styles.audioOptionActive]}>
              <Text style={[styles.featureStatus, settings.zoomEnabled && styles.audioOptionTitleActive]}>
                {settings.zoomEnabled ? 'On' : 'Off'}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.featureItem} onPress={() => setSettings({ scrollEnabled: !settings.scrollEnabled })}>
            <MaterialIcons name="open-with" size={20} color="#6B7280" />
            <Text style={styles.featureLabel}>Scroll</Text>
            <View style={[styles.featureToggle, settings.scrollEnabled && styles.audioOptionActive]}>
              <Text style={[styles.featureStatus, settings.scrollEnabled && styles.audioOptionTitleActive]}>
                {settings.scrollEnabled ? 'On' : 'Off'}
              </Text>
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