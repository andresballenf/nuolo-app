import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions, ViewStyle } from 'react-native';
import { Marker } from 'react-native-maps';
import { PointOfInterest } from '../../services/GooglePlacesService';
import { UmbrellaOpenIcon } from '../icons/UmbrellaOpenIcon';
import { UmbrellaClosedIcon } from '../icons/UmbrellaClosedIcon';
import { MarkerLabel } from './MarkerLabel';
import { calculateLabelPosition } from '../../utils/markerOverlap';

interface CustomMarkerProps {
  poi: PointOfInterest;
  isSelected: boolean;
  onPress: (poi: PointOfInterest) => void;
  mapType: 'standard' | 'satellite' | 'hybrid';
  showLabel: boolean;
  labelVisible: boolean;
  labelSide?: 'left' | 'right';
  markerScreenPosition?: { x: number; y: number };
}

export const CustomMarker: React.FC<CustomMarkerProps> = ({
  poi,
  isSelected,
  onPress,
  mapType,
  showLabel,
  labelVisible,
  labelSide = 'right',
  markerScreenPosition,
}) => {
  const screenWidth = Dimensions.get('window').width;
  
  const labelPosition = useMemo(() => {
    // Use computed side from placement if provided; otherwise default right
    if (!markerScreenPosition) return labelSide;
    return labelSide;
  }, [markerScreenPosition, screenWidth, labelSide]);

  const markerColor = '#84cc16';
  const markerSize = isSelected ? 44 : 40;
  const labelOffsetPx = markerSize / 2 + 7; // add 2px to avoid visual overlap with icon halo/stroke
  const containerHalfWidth = 100; // markerContainer width is 200
  const labelContainerStyle = useMemo<ViewStyle>(() => {
    if (labelPosition === 'left') {
      return {
        position: 'absolute',
        right: containerHalfWidth + labelOffsetPx,
        alignItems: 'flex-end',
      } as ViewStyle;
    }
    return {
      position: 'absolute',
      left: containerHalfWidth + labelOffsetPx,
      alignItems: 'flex-start',
    } as ViewStyle;
  }, [labelPosition, labelOffsetPx]);

  return (
    <Marker
      coordinate={poi.coordinate}
      onPress={() => onPress(poi)}
      tracksViewChanges={true}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <View style={[
        styles.markerContainer,
        isSelected && styles.markerContainerSelected
      ]}>
        <View style={[
          styles.iconWrapper,
          {
            width: markerSize,
            height: markerSize,
            borderRadius: markerSize / 2,
          }
        ]}>
          {isSelected ? (
            <UmbrellaOpenIcon size={markerSize * 0.8} color={markerColor} />
          ) : (
            <UmbrellaClosedIcon size={markerSize * 0.8} color={markerColor} />
          )}
        </View>
        
        <MarkerLabel
          text={poi.name}
          position={labelPosition}
          visible={showLabel && labelVisible}
          offsetPx={labelOffsetPx}
          containerStyle={labelContainerStyle}
        />
      </View>
    </Marker>
  );
};

const styles = StyleSheet.create({
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 200,
    height: 60,
  },
  markerContainerSelected: {
    zIndex: 1000,
  },
  iconWrapper: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
});