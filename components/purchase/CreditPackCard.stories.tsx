import React from 'react';
import { View } from 'react-native';
import { CreditPackCard } from './CreditPackCard';

// Note: This repo doesn't include Storybook runtime.
// These are plain React components to document states.

export const EstadoNormalConTrial: React.FC = () => (
  <View style={{ padding: 16 }}>
    <CreditPackCard trialAvailable={2} trialUsed={0} purchasedAvailable={195} purchasedUsed={8} />
  </View>
);

export const TrialAgotado: React.FC = () => (
  <View style={{ padding: 16 }}>
    <CreditPackCard trialAvailable={0} trialUsed={2} purchasedAvailable={195} purchasedUsed={8} />
  </View>
);

export const SaldoBajo: React.FC = () => (
  <View style={{ padding: 16 }}>
    <CreditPackCard trialAvailable={0} trialUsed={2} purchasedAvailable={18} purchasedUsed={187} />
  </View>
);

export const SaldoCero: React.FC = () => (
  <View style={{ padding: 16 }}>
    <CreditPackCard trialAvailable={0} trialUsed={2} purchasedAvailable={0} purchasedUsed={203} />
  </View>
);
