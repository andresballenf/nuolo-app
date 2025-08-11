import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface UmbrellaClosedIconProps {
  size?: number;
  color?: string;
}

export const UmbrellaClosedIcon: React.FC<UmbrellaClosedIconProps> = ({
  size = 40,
  color = '#84cc16',
}) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Closed canopy (tapered) */}
      <Path d="M12 3L8 15h8L12 3z" fill={color} />
      {/* Wrap/tie */}
      <Path d="M11 15h2" stroke={color} strokeWidth={2} strokeLinecap="round" />
      {/* Shaft */}
      <Path d="M12 15v5" stroke={color} strokeWidth={2} strokeLinecap="round" />
      {/* Handle */}
      <Path
        d="M12 20c0 1.1.9 2 2 2 .55 0 1-.45 1-1s-.45-1-1-1"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
};


