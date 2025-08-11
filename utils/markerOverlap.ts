import { PointOfInterest } from '../services/GooglePlacesService';

export interface MarkerPosition {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isSelected: boolean;
}

export interface LabelVisibility {
  [key: string]: boolean;
}

const LABEL_WIDTH = 150;
const LABEL_HEIGHT = 20;

export function calculateLabelPosition(
  markerX: number,
  screenWidth: number
): 'left' | 'right' {
  // Default preference is to place label on the right
  return 'right';
}

export interface LabelPlacementEntry {
  visible: boolean;
  position: 'left' | 'right';
}

export interface LabelPlacement {
  [key: string]: LabelPlacementEntry;
}

export function computeLabelPlacement(
  markers: MarkerPosition[],
  screenWidth: number
): LabelPlacement {
  const placement: LabelPlacement = {};

  // Greedy placement: try right (preferred), then left; hide if still overlaps
  // Sort for deterministic behavior
  const sorted = [...markers].sort((a, b) => {
    // No priority for selected; stable order by y then x
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });

  const placedRects: Array<{ x: number; y: number; w: number; h: number }> = [];

  for (const marker of sorted) {
    // marker.x represents the center; to get label distance from marker edge: (marker.width / 2) + 5
    const offset = marker.width / 2 + 5;
    const candidateRight = {
      x: marker.x + offset,
      y: marker.y - LABEL_HEIGHT / 2,
      w: LABEL_WIDTH,
      h: LABEL_HEIGHT,
    };
    const candidateLeft = {
      x: marker.x - offset - LABEL_WIDTH,
      y: marker.y - LABEL_HEIGHT / 2,
      w: LABEL_WIDTH,
      h: LABEL_HEIGHT,
    };

    let useRight = true;
    let visible = true;

    // Check right overlap
    if (placedRects.some(r => isOverlapping(r.x, r.y, r.w, r.h, candidateRight.x, candidateRight.y, candidateRight.w, candidateRight.h))) {
      useRight = false;
      // Check left overlap
      if (placedRects.some(r => isOverlapping(r.x, r.y, r.w, r.h, candidateLeft.x, candidateLeft.y, candidateLeft.w, candidateLeft.h))) {
        visible = false;
      }
    }

    const chosen = useRight ? candidateRight : candidateLeft;
    placement[marker.id] = {
      visible,
      position: useRight ? 'right' : 'left',
    };
    if (visible) placedRects.push(chosen);
  }

  return placement;
}

function isOverlapping(
  x1: number,
  y1: number,
  w1: number,
  h1: number,
  x2: number,
  y2: number,
  w2: number,
  h2: number
): boolean {
  return !(
    x1 + w1 < x2 ||
    x2 + w2 < x1 ||
    y1 + h1 < y2 ||
    y2 + h2 < y1
  );
}

export function calculateZoomLevel(latitudeDelta: number): number {
  return Math.round(Math.log(360 / latitudeDelta) / Math.LN2);
}

export function shouldShowLabels(zoomLevel: number): boolean {
  return zoomLevel >= 14;
}