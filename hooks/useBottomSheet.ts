import { useState, useCallback, useRef } from 'react';
import { Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { AccessibilityInfo } from 'react-native';

export type SheetState = 'hidden' | 'collapsed' | 'half' | 'expanded';
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
  COLLAPSED: 0.4,  // 40% - Default view
  HALF: 0.6,       // 60% - Medium expansion
  EXPANDED: 0.8,   // 80% - Full expansion
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
      case 'collapsed':
        return SCREEN_HEIGHT * (1 - SHEET_HEIGHTS.COLLAPSED);
      case 'half':
        return SCREEN_HEIGHT * (1 - SHEET_HEIGHTS.HALF);
      case 'expanded':
        return SCREEN_HEIGHT * (1 - SHEET_HEIGHTS.EXPANDED);
      default:
        return SCREEN_HEIGHT;
    }
  }, []);

  // Provide haptic feedback based on state
  const provideHapticFeedback = useCallback((newState: SheetState, oldState: SheetState) => {
    if (newState === oldState) return;
    
    if (newState === 'hidden') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  // Announce state changes for accessibility
  const announceStateChange = useCallback((state: SheetState) => {
    const announcements: Record<SheetState, string> = {
      hidden: 'Bottom sheet closed',
      collapsed: 'Bottom sheet opened',
      half: 'Bottom sheet expanded to half screen',
      expanded: 'Bottom sheet fully expanded',
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
    if (type === 'attraction-detail' && state !== 'collapsed') {
      animateToState('collapsed');
    } else if (type === 'attractions' && state === 'hidden') {
      animateToState('collapsed');
    } else if ((type === 'settings' || type === 'profile') && state === 'hidden') {
      animateToState('collapsed');
    }
  }, [state, animateToState, onContentTypeChange]);

  // Show/hide helpers
  const show = useCallback(() => {
    if (state === 'hidden') {
      animateToState('collapsed');
    }
  }, [state, animateToState]);

  const hide = useCallback(() => {
    animateToState('hidden');
  }, [animateToState]);

  // Toggle state helper
  const toggleState = useCallback(() => {
    if (state === 'hidden') {
      animateToState('collapsed');
    } else if (state === 'collapsed') {
      animateToState('half');
    } else if (state === 'half') {
      animateToState('expanded');
    } else {
      animateToState('hidden');
    }
  }, [state, animateToState]);

  // Navigation helpers
  const goToAttractionsList = useCallback(() => {
    setContentType('attractions');
    animateToState('collapsed');
  }, [setContentType, animateToState]);

  const goToAttractionDetail = useCallback(() => {
    setContentType('attraction-detail');
    animateToState('collapsed');
  }, [setContentType, animateToState]);

  const goToSettings = useCallback(() => {
    setContentType('settings');
    animateToState('collapsed');
  }, [setContentType, animateToState]);

  const goToProfile = useCallback(() => {
    setContentType('profile');
    animateToState('collapsed');
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