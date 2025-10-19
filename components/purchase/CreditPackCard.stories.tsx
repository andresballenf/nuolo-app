import React from 'react';
import { View } from 'react-native';
import { CreditPackCard } from './CreditPackCard';

// Note: This repo doesn't include Storybook runtime.
// These are plain React components to document states.

export const DefaultWithTrial: React.FC = () => (
  <View style={{ padding: 16 }}>
    <CreditPackCard trialAvailable={2} trialUsed={0} purchasedAvailable={195} purchasedUsed={8} />
  </View>
);

export const TrialDepleted: React.FC = () => (
  <View style={{ padding: 16 }}>
    <CreditPackCard trialAvailable={0} trialUsed={2} purchasedAvailable={195} purchasedUsed={8} />
  </View>
);

export const LowBalance19: React.FC = () => (
  <View style={{ padding: 16 }}>
    <CreditPackCard trialAvailable={0} trialUsed={2} purchasedAvailable={19} purchasedUsed={186} />
  </View>
);

export const Threshold20: React.FC = () => (
  <View style={{ padding: 16 }}>
    <CreditPackCard trialAvailable={0} trialUsed={2} purchasedAvailable={20} purchasedUsed={185} />
  </View>
);

export const ZeroBalance: React.FC = () => (
  <View style={{ padding: 16 }}>
    <CreditPackCard trialAvailable={0} trialUsed={2} purchasedAvailable={0} purchasedUsed={203} />
  </View>
);
