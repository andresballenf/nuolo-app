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
// import * as Haptics from 'expo-haptics';

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
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const colorAnim = useRef(new Animated.Value(selected ? 1 : 0)).current;
  
  useEffect(() => {
    // Animate selection state - use non-native for colors
    Animated.timing(colorAnim, {
      toValue: selected ? 1 : 0,
      duration: 200,
      useNativeDriver: false, // Colors require non-native
    }).start();
  }, [selected]);
  
  const handlePress = () => {
    // if (Platform.OS === 'ios') {
    //   Haptics.selectionAsync();
    // }
    
    // Scale animation on press - use native driver
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
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
  
  const animatedBorderColor = colorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#E5E7EB', '#84cc16'],
  });
  
  const animatedBackgroundColor = colorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#FFFFFF', '#F0FDF4'],
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
        },
      ]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          {
            borderRadius: 12,
            borderWidth: 2,
            borderColor: animatedBorderColor,
            backgroundColor: animatedBackgroundColor,
          },
        ]}
      />
      <View style={styles.radioContent}>
        <View style={[styles.radioCircle, selected && styles.radioCircleSelected]}>
          {selected && <View style={styles.radioInner} />}
        </View>
        <Text style={[styles.radioLabel, selected && styles.radioLabelSelected]}>
          {option.label}
        </Text>
      </View>
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
    height: 56,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  radioContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  radioItemSelected: {
    backgroundColor: '#F0FDF4',
    borderColor: '#84cc16',
    shadowOpacity: 0.1,
    elevation: 2,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  radioCircleSelected: {
    borderColor: '#84cc16',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#84cc16',
  },
  radioLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
    flex: 1,
  },
  radioLabelSelected: {
    color: '#1F2937',
    fontWeight: '600',
  },
});