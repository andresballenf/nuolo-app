export interface CreditBucket {
  available: number;
  used: number;
}

export interface CreditsBuckets {
  trial: CreditBucket;
  purchased: CreditBucket;
  totalUsed: number;
}

export interface ConsumeResult {
  buckets: CreditsBuckets;
  fromTrial: number;
  fromPurchased: number;
}

export interface RefundResult {
  buckets: CreditsBuckets;
  toPurchased: number;
  toTrial: number;
}

export function cloneBuckets(b: CreditsBuckets): CreditsBuckets {
  return {
    trial: { available: b.trial.available, used: b.trial.used },
    purchased: { available: b.purchased.available, used: b.purchased.used },
    totalUsed: b.totalUsed,
  };
}

export function getAvailable(b: CreditsBuckets): number {
  return Math.max(0, (b.trial.available || 0) + (b.purchased.available || 0));
}

export function getTotalUsed(b: CreditsBuckets): number {
  return Math.max(0, b.totalUsed || 0);
}

export function getTotal(b: CreditsBuckets): number {
  const available = getAvailable(b);
  const used = getTotalUsed(b);
  return Math.max(0, available + used);
}

export function getPercentAvailable(b: CreditsBuckets): number {
  const total = getTotal(b);
  if (total <= 0) return 0;
  return Math.round((getAvailable(b) / total) * 100);
}

// FIFO consumption: trial first, then purchased
export function consumeCredits(input: CreditsBuckets, requested: number): ConsumeResult {
  const requestedSafe = Math.max(0, Math.floor(requested || 0));
  if (requestedSafe === 0) return { buckets: cloneBuckets(input), fromTrial: 0, fromPurchased: 0 };

  const b = cloneBuckets(input);
  const fromTrial = Math.min(requestedSafe, Math.max(0, b.trial.available));
  b.trial.available -= fromTrial;
  b.trial.used += fromTrial;

  const remaining = requestedSafe - fromTrial;
  let fromPurchased = 0;
  if (remaining > 0) {
    fromPurchased = Math.min(remaining, Math.max(0, b.purchased.available));
    b.purchased.available -= fromPurchased;
    b.purchased.used += fromPurchased;
  }

  const actuallyConsumed = fromTrial + fromPurchased;
  b.totalUsed = Math.max(0, (b.totalUsed || 0) + actuallyConsumed);

  return { buckets: b, fromTrial, fromPurchased };
}

// Refund credits back in reverse consumption priority: purchased first, then trial
export function refundCredits(input: CreditsBuckets, amount: number): RefundResult {
  const amountSafe = Math.max(0, Math.floor(amount || 0));
  if (amountSafe === 0) return { buckets: cloneBuckets(input), toPurchased: 0, toTrial: 0 };

  const b = cloneBuckets(input);

  // Refund from purchased.used first
  const refundableFromPurchased = Math.max(0, b.purchased.used);
  const toPurchased = Math.min(amountSafe, refundableFromPurchased);
  b.purchased.used -= toPurchased;
  b.purchased.available += toPurchased;

  let remaining = amountSafe - toPurchased;

  // Then refund to trial if needed
  const refundableFromTrial = Math.max(0, b.trial.used);
  const toTrial = Math.min(remaining, refundableFromTrial);
  b.trial.used -= toTrial;
  b.trial.available += toTrial;

  const actuallyRefunded = toPurchased + toTrial;
  b.totalUsed = Math.max(0, (b.totalUsed || 0) - actuallyRefunded);

  return { buckets: b, toPurchased, toTrial };
}

export function createBuckets(
  trialAvailable: number,
  trialUsed: number,
  purchasedAvailable: number,
  purchasedUsed: number
): CreditsBuckets {
  const tA = Math.max(0, Math.floor(trialAvailable || 0));
  const tU = Math.max(0, Math.floor(trialUsed || 0));
  const pA = Math.max(0, Math.floor(purchasedAvailable || 0));
  const pU = Math.max(0, Math.floor(purchasedUsed || 0));
  const totalUsed = tU + pU;
  return {
    trial: { available: tA, used: tU },
    purchased: { available: pA, used: pU },
    totalUsed,
  };
}

export function formatSummary(b: CreditsBuckets): string {
  const available = getAvailable(b);
  const total = getTotal(b);
  const percent = getPercentAvailable(b);
  return `${available} de ${total} disponibles ${percent}%`;
}
