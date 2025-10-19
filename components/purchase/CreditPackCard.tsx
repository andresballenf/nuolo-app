import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, AccessibilityInfo } from 'react-native';
import { Button } from '../ui/Button';
import { TelemetryService } from '../../services/TelemetryService';
import {
  type CreditBuckets,
  createBuckets,
  getCreditSummary,
  consumeCredits as consumeCreditsService,
  refundCredits as refundCreditsService,
} from '../../services/CreditService';
import { useMonetization } from '../../contexts/MonetizationContext';

export interface CreditPackCardProps {
  trialAvailable: number;
  trialUsed: number;
  purchasedAvailable: number;
  purchasedUsed: number;
  onBuyMoreCredits?: () => void;
  onViewHistory?: () => void;
  lowThreshold?: number; // defaults to 20
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
  const [buckets, setBuckets] = useState<CreditBuckets>(() =>
    createBuckets(trialAvailable, trialUsed, purchasedAvailable, purchasedUsed)
  );
  const { setShowPaywall } = useMonetization();

  useEffect(() => {
    setBuckets(createBuckets(trialAvailable, trialUsed, purchasedAvailable, purchasedUsed));
  }, [trialAvailable, trialUsed, purchasedAvailable, purchasedUsed]);

  const summary = useMemo(() => getCreditSummary(buckets), [buckets]);

  useEffect(() => {
    // Analytics: card viewed
    TelemetryService.increment('credits_viewed');

    if (summary.available < lowThreshold) {
      TelemetryService.increment('credits_low_warning_shown');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBuy = () => {
    TelemetryService.increment('credits_pack_cta');
    if (onBuyMoreCredits) {
      onBuyMoreCredits();
    } else {
      setShowPaywall(true, { trigger: 'manual' });
    }
  };

  const handleConsume = (amount: number) => {
    try {
      const next = consumeCreditsService(amount, buckets);
      TelemetryService.increment('job_consumed_credits', amount);
      setBuckets(next);
    } catch (e) {
      // insufficient credits - ignore
    }
  };

  const handleRefund = (amount: number) => {
    const next = refundCreditsService(amount, buckets);
    TelemetryService.increment('refund_applied', amount);
    setBuckets(next);
  };

  const ctaText = summary.available < lowThreshold
    ? 'Low balance: Buy more credits'
    : 'Buy More Credits';

  // Accessibility announce low credits
  useEffect(() => {
    if (summary.available === 0) {
      AccessibilityInfo.announceForAccessibility?.('You have 0 credits available. You can buy more credits.');
    } else if (summary.available < lowThreshold) {
      AccessibilityInfo.announceForAccessibility?.('Your balance is low. Consider buying more credits.');
    }
  }, [summary.available, lowThreshold]);

  const availableRatio = summary.total > 0 ? summary.available / summary.total : 0;
  const used = summary.used;
  const usedRatio = summary.total > 0 ? used / summary.total : 0;

  return (
    <View style={styles.card} accessible accessibilityLabel={`Credit Pack. ${summary.available} credits available out of ${summary.total}.`}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.title}>Credit Pack</Text>
        <View style={[styles.badge, summary.available > 0 ? styles.badgeGreen : styles.badgeGray]}>
          <Text style={styles.badgeText}>💎 {summary.available} credits available</Text>
        </View>
      </View>

      {/* Current Balance Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current Balance</Text>
        {/* Progress */}
        <View style={styles.barContainer} accessibilityRole="progressbar" accessible accessibilityLabel={`${summary.percentAvailable}% available`}>
          <View style={[styles.barSegmentUsed, { flex: usedRatio }]} />
          <View style={[styles.barSegmentAvailable, { flex: availableRatio }]} />
        </View>
        <Text style={styles.barLabel}>{summary.percentAvailable}% available</Text>
        <Text style={styles.contextText}>Includes 2 free trial credits (consumed first)</Text>
      </View>

      {/* Details Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Details</Text>
        <View style={styles.detailsRow}>
          <Text style={styles.detailsText}>💎 {buckets.trial.available} trial</Text>
          <Text style={styles.detailsText}>💎 {summary.purchasedAvailable} purchased</Text>
        </View>
        <View style={styles.detailsRow}>
          <Text style={styles.detailsText}>Used: {summary.used}</Text>
          <Text style={styles.detailsText}>Total: {summary.total}</Text>
        </View>
        <Text style={[styles.contextText, { marginTop: 6 }]}>Your credits are always available and never expire.</Text>
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

      {/* Optional: History link placeholder (kept for compatibility) */}
      {onViewHistory && (
        <View style={styles.history}>
          <Pressable onPress={onViewHistory} accessible accessibilityRole="link" accessibilityLabel="View history">
            <Text style={styles.historyLink}>View full history</Text>
          </Pressable>
        </View>
      )}

      {/* Hidden controls for testing */}
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
  section: {
    marginTop: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
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
  contextText: {
    fontSize: 12,
    color: '#374151',
    marginTop: 4,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  detailsText: {
    fontSize: 13,
    color: '#1F2937',
  },
  ctaRow: {
    marginTop: 12,
  },
  history: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
  },
  historyLink: {
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
