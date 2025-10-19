import React from 'react';
import { View, ScrollView } from 'react-native';
import CreditPackCard from './CreditPackCard';

const activities = [
  { id: '1', label: 'Restaurar foto', delta: -3, balance: 197 },
  { id: '2', label: 'Crear video 8s', delta: -5, balance: 200 },
];

export function EstadoNormal() {
  return (
    <ScrollView style={{ padding: 16, backgroundColor: '#f3f4f6' }}>
      <CreditPackCard
        trialAvailable={2}
        trialUsed={0}
        purchasedAvailable={195}
        purchasedUsed={8}
        activities={activities}
      />
    </ScrollView>
  );
}

export function TrialAgotado() {
  return (
    <View style={{ padding: 16, backgroundColor: '#f3f4f6' }}>
      <CreditPackCard
        trialAvailable={0}
        trialUsed={2}
        purchasedAvailable={195}
        purchasedUsed={8}
        activities={activities}
      />
    </View>
  );
}

export function SaldoBajo() {
  return (
    <View style={{ padding: 16, backgroundColor: '#f3f4f6' }}>
      <CreditPackCard
        trialAvailable={0}
        trialUsed={0}
        purchasedAvailable={12}
        purchasedUsed={0}
        activities={activities}
      />
    </View>
  );
}

export function SaldoCero() {
  return (
    <View style={{ padding: 16, backgroundColor: '#f3f4f6' }}>
      <CreditPackCard
        trialAvailable={0}
        trialUsed={0}
        purchasedAvailable={0}
        purchasedUsed={0}
        activities={activities}
      />
    </View>
  );
}
