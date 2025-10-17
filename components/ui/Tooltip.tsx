import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Modal,
  TouchableWithoutFeedback,
  LayoutChangeEvent,
  ViewStyle,
} from 'react-native';

interface TooltipProps {
  children: React.ReactElement<{ onLongPress?: () => void }>;
  text: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  backgroundColor?: string;
  textColor?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  children,
  text,
  position = 'bottom',
  backgroundColor = '#374151',
  textColor = '#FFFFFF',
}) => {
  const [visible, setVisible] = useState(false);
  const [childLayout, setChildLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const childRef = useRef<View>(null);

  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, fadeAnim]);

  const handleLongPress = () => {
    if (childRef.current) {
      childRef.current.measure((x, y, width, height, pageX, pageY) => {
        setChildLayout({ x: pageX, y: pageY, width, height });
        setVisible(true);

        // Auto-hide after 2 seconds
        setTimeout(() => {
          setVisible(false);
        }, 2000);
      });
    }
  };

  const getTooltipStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      position: 'absolute',
      backgroundColor,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    };

    switch (position) {
      case 'bottom':
        return {
          ...baseStyle,
          top: childLayout.y + childLayout.height + 8,
          left: childLayout.x + (childLayout.width / 2),
          transform: [{ translateX: -50 }],
        };
      case 'top':
        return {
          ...baseStyle,
          top: childLayout.y - 40,
          left: childLayout.x + (childLayout.width / 2),
          transform: [{ translateX: -50 }],
        };
      case 'left':
        return {
          ...baseStyle,
          top: childLayout.y + (childLayout.height / 2),
          right: childLayout.x + childLayout.width + 8,
          transform: [{ translateY: -50 }],
        };
      case 'right':
        return {
          ...baseStyle,
          top: childLayout.y + (childLayout.height / 2),
          left: childLayout.x + childLayout.width + 8,
          transform: [{ translateY: -50 }],
        };
      default:
        return baseStyle;
    }
  };

  return (
    <>
      <View ref={childRef} collapsable={false}>
        {React.cloneElement(children, {
          onLongPress: handleLongPress,
        })}
      </View>

      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={() => setVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setVisible(false)}>
          <View style={styles.overlay}>
            <Animated.View
              style={[
                getTooltipStyle(),
                {
                  opacity: fadeAnim,
                },
              ]}
            >
              <Text style={[styles.tooltipText, { color: textColor }]}>{text}</Text>
            </Animated.View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  tooltipText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
