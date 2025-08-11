import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';

interface FloatingNavigationProps {
  onEnableGPS?: () => void;
  onRefresh: () => void;
  onOpenSettings?: () => void;
  isRefreshing: boolean;
  gpsActive: boolean;
  locationTestMode: boolean;
}

export const FloatingNavigation: React.FC<FloatingNavigationProps> = ({
  onEnableGPS,
  onRefresh,
  onOpenSettings,
  isRefreshing,
  gpsActive,
  locationTestMode
}) => {
  return (
    <View style={styles.container}>
      {/* Settings Button */}
      {onOpenSettings && (
        <TouchableOpacity
          style={styles.button}
          onPress={onOpenSettings}
          activeOpacity={0.7}
        >
          <Text style={styles.buttonText}>⚙️</Text>
        </TouchableOpacity>
      )}

      {/* Enable GPS Button - Only show if GPS is not active and not in test mode */}
      {!gpsActive && !locationTestMode && onEnableGPS && (
        <TouchableOpacity
          style={[styles.button, styles.gpsButton]}
          onPress={onEnableGPS}
          activeOpacity={0.7}
        >
          <Text style={styles.buttonText}>📍</Text>
        </TouchableOpacity>
      )}
      
      {/* Refresh Button */}
      <TouchableOpacity
        style={[
          styles.button,
          (!gpsActive && !locationTestMode) && styles.disabledButton
        ]}
        onPress={onRefresh}
        disabled={isRefreshing || (!gpsActive && !locationTestMode)}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.buttonText,
          isRefreshing && styles.spinningText
        ]}>
          {isRefreshing ? '↻' : '🔄'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  gpsButton: {
    backgroundColor: 'rgba(132, 204, 22, 0.95)',
  },
  disabledButton: {
    backgroundColor: 'rgba(229, 231, 235, 0.95)',
  },
  buttonText: {
    fontSize: 16,
    textAlign: 'center',
  },
  spinningText: {
    // Animation could be added here with react-native-reanimated
  },
});