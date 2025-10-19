import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, AccessibilityInfo } from 'react-native';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { TelemetryService } from '../../services/TelemetryService';
import { 
  CreditsBuckets,
  createBuckets,
  getAvailable,
  getTotal,
  getPercentAvailable,
  consumeCredits,
  refundCredits,
  formatSummary,
} from '../../utils/credits';

export interface CreditPackCardProps {
  trialAvailable: number;
  trialUsed: number;
  purchasedAvailable: number;
  purchasedUsed: number;
  onBuyMoreCredits?: () => void;
  onViewHistory?: () => void;
  lowThreshold?: number; // defaults to 20
}

interface TooltipState {
  trial: boolean;
  purchased: boolean;
}

export const CreditPackCard: React.FC<CreditPackCardProps> = ({
  trialAvailable,
  trialUsed,
  purchasedAvailable,
  purchasedUsed,
  onBuyMoreCredits,
  onViewHistory,
  lowThreshold = 20,
}) => {
  const [buckets, setBuckets] = useState<CreditsBuckets>(() =>
    createBuckets(trialAvailable, trialUsed, purchasedAvailable, purchasedUsed)
  );

  useEffect(() => {
    setBuckets(createBuckets(trialAvailable, trialUsed, purchasedAvailable, purchasedUsed));
  }, [trialAvailable, trialUsed, purchasedAvailable, purchasedUsed]);

  const [tooltip, setTooltip] = useState<TooltipState>({ trial: false, purchased: false });

  const available = useMemo(() => getAvailable(buckets), [buckets]);
  const total = useMemo(() => getTotal(buckets), [buckets]);
  const percent = useMemo(() => getPercentAvailable(buckets), [buckets]);
  const summaryText = useMemo(() => formatSummary(buckets), [buckets]);

  useEffect(() => {
    // Analytics: card viewed
    TelemetryService.increment('credits_viewed');

    if (available < lowThreshold) {
      TelemetryService.increment('credits_low_warning_shown');
    }
  }, []);

  const handleBuy = () => {
    TelemetryService.increment('credits_pack_purchased');
    onBuyMoreCredits?.();
  };

  const handleConsume = (amount: number) => {
    const { buckets: next, fromTrial, fromPurchased } = consumeCredits(buckets, amount);
    if (fromTrial + fromPurchased > 0) {
      TelemetryService.increment('job_consumed_credits', fromTrial + fromPurchased);
    }
    setBuckets(next);
  };

  const handleRefund = (amount: number) => {
    const { buckets: next } = refundCredits(buckets, amount);
    TelemetryService.increment('refund_applied', amount);
    setBuckets(next);
  };

  const ctaText = available < lowThreshold
    ? 'Te quedan pocos créditos. Comprar más'
    : 'Comprar más créditos';

  const trialTooltipText = `${buckets.trial.available + buckets.trial.used} créditos de prueba. Se consumen primero`;
  const purchasedTooltipText = `${buckets.purchased.available + buckets.purchased.used} créditos comprados`;

  const showTrialLine = buckets.trial.available > 0;
  const showTrialConsumedLine = buckets.trial.available === 0 && buckets.trial.used > 0;

  // Accessibility announce low credits
  useEffect(() => {
    if (available === 0) {
      AccessibilityInfo.announceForAccessibility?.('No tienes créditos disponibles. Puedes comprar más.');
    } else if (available < lowThreshold) {
      AccessibilityInfo.announceForAccessibility?.('Te quedan pocos créditos. Puedes comprar más.');
    }
  }, [available, lowThreshold]);

  const used = total - available;
  const availableRatio = total > 0 ? available / total : 0;
  const usedRatio = total > 0 ? used / total : 0;

  return (
    <View style={styles.card} accessible accessibilityLabel={`Credit Pack. ${available} créditos disponibles de ${total}.`}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.title}>Credit Pack</Text>
        <View style={[styles.badge, available > 0 ? styles.badgeGreen : styles.badgeGray]}>
          <Text style={styles.badgeText}>{available} créditos disponibles</Text>
        </View>
      </View>

      {/* Summary rows */}
      <View style={styles.summary}>
        <View style={styles.row}>
          <Text style={styles.label}>Disponibles</Text>
          <Text style={styles.value}>{available}</Text>
        </View>
        <View style={styles.subrow}>
          <View style={styles.subItem}>
            <View style={styles.subItemLeft}>
              <Text style={styles.subLabel}>Trial</Text>
              <Pressable
                onPress={() => setTooltip(s => ({ ...s, trial: !s.trial }))}
                accessible
                accessibilityRole="button"
                accessibilityLabel="Información sobre créditos de prueba"
                style={styles.infoButton}
              >
                <Icon name="information-circle-outline" size={16} color="#6B7280" />
              </Pressable>
            </View>
            <Text style={styles.subValue}>{buckets.trial.available}</Text>
          </View>
          <View style={styles.subItem}>
            <View style={styles.subItemLeft}>
              <Text style={styles.subLabel}>Comprados</Text>
              <Pressable
                onPress={() => setTooltip(s => ({ ...s, purchased: !s.purchased }))}
                accessible
                accessibilityRole="button"
                accessibilityLabel="Información sobre créditos comprados"
                style={styles.infoButton}
              >
                <Icon name="information-circle-outline" size={16} color="#6B7280" />
              </Pressable>
            </View>
            <Text style={styles.subValue}>{buckets.purchased.available}</Text>
          </View>
        </View>

        {tooltip.trial && (
          <View style={styles.tooltip} accessibilityRole="text" accessible>
            <Text style={styles.tooltipText}>{trialTooltipText}</Text>
          </View>
        )}
        {tooltip.purchased && (
          <View style={styles.tooltip} accessibilityRole="text" accessible>
            <Text style={styles.tooltipText}>{purchasedTooltipText}</Text>
          </View>
        )}

        <View style={styles.row}>
          <Text style={styles.label}>Usados</Text>
          <Text style={styles.value}>{used}</Text>
        </View>
        <View style={[styles.row, styles.rowLast]}>
          <Text style={styles.label}>Total acumulado</Text>
          <Text style={styles.value}>{total}</Text>
        </View>
      </View>

      {/* Stacked bar */}
      <View style={styles.barContainer} accessibilityRole="progressbar" accessible accessibilityLabel={`Barra de créditos: ${summaryText}`}>
        <View style={[styles.barSegmentUsed, { flex: usedRatio }]} />
        <View style={[styles.barSegmentAvailable, { flex: availableRatio }]} />
      </View>
      <Text style={styles.barLabel}>{summaryText}</Text>

      {/* Context lines */}
      <View style={styles.contextLines}>
        {showTrialLine && (
          <Text style={styles.contextText}>Incluye {buckets.trial.available} créditos de prueba</Text>
        )}
        {showTrialConsumedLine && (
          <Text style={styles.contextText}>Ya usaste tus créditos de prueba. Ahora usas los comprados</Text>
        )}
        <Text style={styles.contextText}>Los créditos no expiran y puedes usarlos en cualquier momento</Text>
      </View>

      {/* CTA */}
      <View style={styles.ctaRow}>
        <Button
          title={ctaText}
          onPress={handleBuy}
          variant="primary"
          size="md"
        />
      </View>

      {/* History */}
      <View style={styles.history}>
        <Text style={styles.historyTitle}>Últimas actividades</Text>
        <View style={styles.historyRow}>
          <Text style={styles.historyText}>Restaurar foto</Text>
          <Text style={styles.historyDelta}>−3</Text>
          <Text style={styles.historyBalance}>Saldo {available}</Text>
        </View>
        <View style={styles.historyRow}>
          <Text style={styles.historyText}>Crear video 8s</Text>
          <Text style={styles.historyDelta}>−5</Text>
          <Text style={styles.historyBalance}>Saldo {available + 5}</Text>
        </View>
        <Pressable
          onPress={onViewHistory}
          accessible
          accessibilityRole="link"
          accessibilityLabel="Ver todo el historial"
        >
          <Text style={styles.historyLink}>Ver todo el historial</Text>
        </Pressable>
      </View>

      {/* Example controls for demo/testing only - not visible without testID */}
      <View style={styles.hiddenControls} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Pressable testID="consume-1" onPress={() => handleConsume(1)}>
          <Text>consume-1</Text>
        </Pressable>
        <Pressable testID="consume-5" onPress={() => handleConsume(5)}>
          <Text>consume-5</Text>
        </Pressable>
        <Pressable testID="refund-1" onPress={() => handleRefund(1)}>
          <Text>refund-1</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeGreen: {
    backgroundColor: '#DCFCE7',
  },
  badgeGray: {
    backgroundColor: '#E5E7EB',
  },
  badgeText: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '700',
  },
  summary: {
    marginTop: 4,
    marginBottom: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  label: {
    fontSize: 14,
    color: '#6B7280',
  },
  value: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  subrow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    gap: 12,
  },
  subItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  subItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginRight: 6,
  },
  subValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  infoButton: {
    padding: 2,
  },
  tooltip: {
    backgroundColor: '#111827',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginTop: 6,
  },
  tooltipText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  barContainer: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
  },
  barSegmentUsed: {
    backgroundColor: '#D1D5DB',
  },
  barSegmentAvailable: {
    backgroundColor: '#84cc16',
  },
  barLabel: {
    marginTop: 8,
    fontSize: 12,
    color: '#6B7280',
  },
  contextLines: {
    marginTop: 8,
    gap: 4,
  },
  contextText: {
    fontSize: 12,
    color: '#374151',
  },
  ctaRow: {
    marginTop: 12,
  },
  history: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  historyText: {
    fontSize: 13,
    color: '#1F2937',
    flex: 1,
  },
  historyDelta: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '700',
    width: 36,
    textAlign: 'right',
  },
  historyBalance: {
    fontSize: 12,
    color: '#6B7280',
    width: 96,
    textAlign: 'right',
  },
  historyLink: {
    marginTop: 8,
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '600',
  },
  hiddenControls: {
    height: 0,
    overflow: 'hidden',
  },
});

export default CreditPackCard;
