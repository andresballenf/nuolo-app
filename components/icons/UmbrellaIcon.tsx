import React from 'react';
import Svg, { Path, G } from 'react-native-svg';

interface UmbrellaIconProps {
  size?: number;
  color?: string;
}

export const UmbrellaIcon: React.FC<UmbrellaIconProps> = ({ 
  size = 40, 
  color = '#84cc16' 
}) => {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      <G>
        <Path
          d="M12 2C6.48 2 2 6.48 2 12h1c0-.55.45-1 1-1s1 .45 1 1h2c0-.55.45-1 1-1s1 .45 1 1h2c0-.55.45-1 1-1s1 .45 1 1h2c0-.55.45-1 1-1s1 .45 1 1h2c0-.55.45-1 1-1s1 .45 1 1h2c0-5.52-4.48-10-10-10z"
          fill={color}
        />
        <Path
          d="M11 12v7c0 .55-.45 1-1 1s-1-.45-1-1c0-.55-.45-1-1-1s-1 .45-1 1c0 1.65 1.35 3 3 3s3-1.35 3-3v-7h-2z"
          fill={color}
        />
      </G>
    </Svg>
  );
};