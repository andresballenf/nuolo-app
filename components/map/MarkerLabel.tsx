import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';

interface MarkerLabelProps {
  text: string;
  position: 'left' | 'right';
  visible: boolean;
  offsetPx?: number;
  containerStyle?: StyleProp<ViewStyle>;
}

export const MarkerLabel: React.FC<MarkerLabelProps> = ({ 
  text, 
  position,
  visible,
  offsetPx = 45,
  containerStyle,
}) => {
  if (!visible) return null;

  return (
    <View style={[styles.labelContainer, containerStyle]}>
      {/* Subtle multi-shadow outline to mimic Google Maps label stroke */}
      <Text style={[styles.labelText, styles.stroke, styles.strokeTL]} numberOfLines={3}>{text}</Text>
      <Text style={[styles.labelText, styles.stroke, styles.strokeTR]} numberOfLines={3}>{text}</Text>
      <Text style={[styles.labelText, styles.stroke, styles.strokeBL]} numberOfLines={3}>{text}</Text>
      <Text style={[styles.labelText, styles.stroke, styles.strokeBR]} numberOfLines={3}>{text}</Text>
      <Text style={styles.labelText} numberOfLines={3}>{text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  labelContainer: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -10 }],
    maxWidth: 150,
    zIndex: 1,
  },
  labelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#84cc16',
    includeFontPadding: false,
    textAlignVertical: 'center',
    textAlign: 'center',
  },
  stroke: {
    position: 'absolute',
    color: '#84cc16',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowRadius: 0.5,
  },
  strokeTL: {
    textShadowOffset: { width: -0.75, height: -0.75 },
  },
  strokeTR: {
    textShadowOffset: { width: 0.75, height: -0.75 },
  },
  strokeBL: {
    textShadowOffset: { width: -0.75, height: 0.75 },
  },
  strokeBR: {
    textShadowOffset: { width: 0.75, height: 0.75 },
  },
});