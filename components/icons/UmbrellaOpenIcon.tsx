import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface UmbrellaOpenIconProps {
  size?: number;
  color?: string;
}

export const UmbrellaOpenIcon: React.FC<UmbrellaOpenIconProps> = ({
  size = 40,
  color = '#84cc16',
}) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Canopy */}
      <Path
        d="M12 3C7 3 3 7.03 3 12h18c0-4.97-4-9-9-9z"
        fill={color}
      />
      {/* Scallops */}
      <Path
        d="M3 12c1 0 1.5-1 3-1s2 1 3 1 1.5-1 3-1 2 1 3 1 1.5-1 3-1 2 1 3 1"
        stroke={color}
        strokeWidth={1.2}
        fill="none"
      />
      {/* Shaft */}
      <Path d="M12 12v6" stroke={color} strokeWidth={2} strokeLinecap="round" />
      {/* Handle */}
      <Path
        d="M12 18c0 1.66 1.34 3 3 3 .83 0 1.5-.67 1.5-1.5 0-.55-.45-1-1-1s-1 .45-1 1"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
};


