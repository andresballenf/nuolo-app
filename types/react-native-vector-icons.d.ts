import type { ComponentType } from 'react';
import type { TextProps } from 'react-native';

export interface MaterialIconProps extends TextProps {
  name: string;
  size?: number;
  color?: string;
}

declare const MaterialIcons: ComponentType<MaterialIconProps>;

export default MaterialIcons;
