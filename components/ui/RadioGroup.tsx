import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  Animated,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';

interface RadioOption {
  value: string;
  label: string;
}

interface RadioGroupProps {
  options: RadioOption[];
  value?: string;
  onValueChange: (value: string) => void;
  style?: ViewStyle;
}

interface RadioItemProps {
  option: RadioOption;
  selected: boolean;
  onPress: () => void;
}

const RadioItem: React.FC<RadioItemProps> = ({ option, selected, onPress }) => {
  const scaleAnim = useRef(new Animated.Value(selected ? 1 : 0.95)).current;
  const borderColorAnim = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const backgroundColorAnim = useRef(new Animated.Value(selected ? 1 : 0)).current;
  
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: selected ? 1 : 0.95,
        tension: 150,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(borderColorAnim, {
        toValue: selected ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(backgroundColorAnim, {
        toValue: selected ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
  }, [selected]);
  
  const handlePress = () => {
    if (Platform.OS === 'ios') {
      Haptics.selectionAsync();
    }
    // Scale animation on press
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.92,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 150,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
    
    onPress();
  };
  
  const animatedBorderColor = borderColorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 255, 255, 0.5)', '#84cc16'],
  });
  
  const animatedBackgroundColor = backgroundColorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#ffffff', '#1f2937'],
  });
  
  return (
  <TouchableOpacity
    onPress={handlePress}
    activeOpacity={0.9}
    accessible={true}
    accessibilityRole="radio"
    accessibilityLabel={option.label}
    accessibilityState={{ selected }}
    accessibilityHint={selected ? "Selected" : "Tap to select"}
  >
    <Animated.View
      style={[
        styles.radioItem,
        {
          transform: [{ scale: scaleAnim }],
          borderColor: animatedBorderColor,
          backgroundColor: animatedBackgroundColor,
        },
      ]}
    >
    <View style={[styles.radioCircle, selected && styles.radioCircleSelected]}>
      {selected && <View style={styles.radioInner} />}
    </View>
    <Text style={[styles.radioLabel, selected && styles.radioLabelSelected]}>
      {option.label}
    </Text>
    </Animated.View>
  </TouchableOpacity>
  );
};

export const RadioGroup: React.FC<RadioGroupProps> = ({
  options,
  value,
  onValueChange,
  style,
}) => {
  return (
    <View 
      style={[styles.container, style]}
      accessible={false}
      accessibilityRole="radiogroup"
    >
      {options.map((option) => (
        <RadioItem
          key={option.value}
          option={option}
          selected={value === option.value}
          onPress={() => onValueChange(option.value)}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    gap: 12,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  radioItemSelected: {
    backgroundColor: '#1f2937',
    borderColor: '#84cc16',
    shadowOpacity: 0.2,
    elevation: 4,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#6b7280',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: '#84cc16',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#84cc16',
  },
  radioLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    flex: 1,
  },
  radioLabelSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },
});