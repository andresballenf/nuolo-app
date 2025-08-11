import { useState, useCallback, useRef } from 'react';
import { Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { AccessibilityInfo } from 'react-native';

export type SheetState = 'hidden' | 'peek' | 'half' | 'expanded' | 'full';
export type SheetContentType = 'attractions' | 'settings' | 'profile' | 'attraction-detail';

interface UseBottomSheetOptions {
  defaultState?: SheetState;
  defaultContentType?: SheetContentType;
  onStateChange?: (state: SheetState) => void;
  onContentTypeChange?: (type: SheetContentType) => void;
}

interface UseBottomSheetReturn {
  // State
  state: SheetState;
  contentType: SheetContentType;
  isVisible: boolean;
  
  // Animated values
  translateY: Animated.Value;
  backdropOpacity: Animated.Value;
  
  // Actions
  setState: (state: SheetState) => void;
  setContentType: (type: SheetContentType) => void;
  show: () => void;
  hide: () => void;
  toggleState: () => void;
  
  // Navigation helpers
  goToAttractionsList: () => void;
  goToAttractionDetail: () => void;
  goToSettings: () => void;
  goToProfile: () => void;
}

const SCREEN_HEIGHT = require('react-native').Dimensions.get('window').height;

// Sheet height percentages
const SHEET_HEIGHTS = {
  HIDDEN: 0,
  PEEK: 0.1,      // 10% - Shows title only
  HALF: 0.4,      // 40% - List view
  EXPANDED: 0.7,  // 70% - Preview with content
  FULL: 0.9,      // 90% - Full content with text guide
};

export function useBottomSheet(options: UseBottomSheetOptions = {}): UseBottomSheetReturn {
  const {
    defaultState = 'hidden',
    defaultContentType = 'attractions',
    onStateChange,
    onContentTypeChange,
  } = options;

  // State management
  const [state, setStateInternal] = useState<SheetState>(defaultState);
  const [contentType, setContentTypeInternal] = useState<SheetContentType>(defaultContentType);
  
  // Animated values
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  
  // Calculate sheet height based on state
  const getSheetHeight = useCallback((state: SheetState): number => {
    switch (state) {
      case 'hidden':
        return SCREEN_HEIGHT;
      case 'peek':
        return SCREEN_HEIGHT * (1 - SHEET_HEIGHTS.PEEK);
      case 'half':
        return SCREEN_HEIGHT * (1 - SHEET_HEIGHTS.HALF);
      case 'expanded':
        return SCREEN_HEIGHT * (1 - SHEET_HEIGHTS.EXPANDED);
      case 'full':
        return SCREEN_HEIGHT * (1 - SHEET_HEIGHTS.FULL);
      default:
        return SCREEN_HEIGHT;
    }
  }, []);

  // Provide haptic feedback based on state
  const provideHapticFeedback = useCallback((newState: SheetState, oldState: SheetState) => {
    if (newState === oldState) return;
    
    if (newState === 'hidden') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (newState === 'full') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  // Announce state changes for accessibility
  const announceStateChange = useCallback((state: SheetState) => {
    const announcements: Record<SheetState, string> = {
      hidden: 'Bottom sheet closed',
      peek: 'Bottom sheet minimized',
      half: 'Bottom sheet opened to half screen',
      expanded: 'Bottom sheet expanded',
      full: 'Bottom sheet opened to full screen',
    };
    
    AccessibilityInfo.announceForAccessibility(announcements[state]);
  }, []);

  // Animate to specific state
  const animateToState = useCallback((newState: SheetState) => {
    const targetY = getSheetHeight(newState);
    
    // Provide feedback
    provideHapticFeedback(newState, state);
    announceStateChange(newState);
    
    // Animate
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: targetY,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }),
      Animated.timing(backdropOpacity, {
        toValue: newState === 'hidden' ? 0 : (SCREEN_HEIGHT - targetY) / SCREEN_HEIGHT * 0.3,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setStateInternal(newState);
      onStateChange?.(newState);
    });
  }, [state, getSheetHeight, translateY, backdropOpacity, provideHapticFeedback, announceStateChange, onStateChange]);

  // Public state setter
  const setState = useCallback((newState: SheetState) => {
    animateToState(newState);
  }, [animateToState]);

  // Content type setter
  const setContentType = useCallback((type: SheetContentType) => {
    setContentTypeInternal(type);
    onContentTypeChange?.(type);
    
    // Auto-adjust state based on content type
    if (type === 'attraction-detail' && state === 'peek') {
      animateToState('expanded');
    } else if (type === 'attractions' && state === 'expanded') {
      animateToState('half');
    } else if ((type === 'settings' || type === 'profile') && state !== 'half') {
      animateToState('half');
    }
  }, [state, animateToState, onContentTypeChange]);

  // Show/hide helpers
  const show = useCallback(() => {
    if (state === 'hidden') {
      animateToState('peek');
    }
  }, [state, animateToState]);

  const hide = useCallback(() => {
    animateToState('hidden');
  }, [animateToState]);

  // Toggle state helper
  const toggleState = useCallback(() => {
    if (state === 'hidden') {
      animateToState('peek');
    } else if (state === 'peek') {
      animateToState('half');
    } else if (state === 'half') {
      animateToState('expanded');
    } else if (state === 'expanded') {
      animateToState('full');
    } else {
      animateToState('hidden');
    }
  }, [state, animateToState]);

  // Navigation helpers
  const goToAttractionsList = useCallback(() => {
    setContentType('attractions');
    animateToState('half');
  }, [setContentType, animateToState]);

  const goToAttractionDetail = useCallback(() => {
    setContentType('attraction-detail');
    animateToState('expanded');
  }, [setContentType, animateToState]);

  const goToSettings = useCallback(() => {
    setContentType('settings');
    animateToState('half');
  }, [setContentType, animateToState]);

  const goToProfile = useCallback(() => {
    setContentType('profile');
    animateToState('half');
  }, [setContentType, animateToState]);

  return {
    // State
    state,
    contentType,
    isVisible: state !== 'hidden',
    
    // Animated values
    translateY,
    backdropOpacity,
    
    // Actions
    setState,
    setContentType,
    show,
    hide,
    toggleState,
    
    // Navigation helpers
    goToAttractionsList,
    goToAttractionDetail,
    goToSettings,
    goToProfile,
  };
}