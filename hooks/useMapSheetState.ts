import { useCallback, useState } from 'react';
import type { PointOfInterest } from '../services/GooglePlacesService';
import type { SheetContentType, SheetState } from '../components/ui/MaterialBottomSheet';
import { logger } from '../lib/logger';

interface UseMapSheetStateReturn {
  attractions: PointOfInterest[];
  isBottomSheetVisible: boolean;
  sheetContentType: SheetContentType;
  sheetState: SheetState;
  setIsBottomSheetVisible: (visible: boolean) => void;
  setSheetContentType: (type: SheetContentType) => void;
  setSheetState: (state: SheetState) => void;
  handlePointsOfInterestUpdate: (pois: PointOfInterest[], isManualSearch?: boolean) => void;
}

export function useMapSheetState(): UseMapSheetStateReturn {
  const [attractions, setAttractions] = useState<PointOfInterest[]>([]);
  const [isBottomSheetVisible, setIsBottomSheetVisible] = useState(false);
  const [sheetContentType, setSheetContentType] = useState<SheetContentType>('attractions');
  const [sheetState, setSheetState] = useState<SheetState>('hidden');
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);

  const handlePointsOfInterestUpdate = useCallback((pois: PointOfInterest[], isManualSearch = false) => {
    setAttractions(pois);
    logger.info('Map points of interest updated', {
      count: pois.length,
      isManualSearch,
    });

    if (isManualSearch) {
      if (pois.length > 0) {
        setSheetContentType('attractions');
        setIsBottomSheetVisible(true);
        setSheetState('collapsed');
      } else {
        setIsBottomSheetVisible(false);
        setSheetState('hidden');
      }
      return;
    }

    if (!hasInitiallyLoaded && pois.length > 0) {
      setSheetContentType('attractions');
      setIsBottomSheetVisible(true);
      setSheetState('collapsed');
      setHasInitiallyLoaded(true);
    }
  }, [hasInitiallyLoaded]);

  return {
    attractions,
    isBottomSheetVisible,
    sheetContentType,
    sheetState,
    setIsBottomSheetVisible,
    setSheetContentType,
    setSheetState,
    handlePointsOfInterestUpdate,
  };
}
