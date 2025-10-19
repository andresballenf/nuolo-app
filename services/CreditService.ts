export interface CreditBuckets {
  trial: { available: number; used: number };
  purchased: { available: number; used: number };
  totalUsed: number; // equals trial.used + purchased.used
}

export interface CreditSummary {
  available: number;
  used: number;
  total: number;
  purchasedAvailable: number;
  percentAvailable: number;
}

// Internal helpers reused from existing utilities to keep behavior consistent
import {
  createBuckets as _createBuckets,
  getAvailable as _getAvailable,
  getTotal as _getTotal,
  getPercentAvailable as _getPercentAvailable,
  consumeCredits as _consumeCredits,
  refundCredits as _refundCredits,
  type CreditsBuckets as _CreditsBuckets,
} from '../utils/credits';

// Type guard/adapter between local type and utils type (they are structurally identical)
function toUtilsType(b: CreditBuckets): _CreditsBuckets {
  return b as unknown as _CreditsBuckets;
}
function fromUtilsType(b: _CreditsBuckets): CreditBuckets {
  return b as unknown as CreditBuckets;
}

export function createBuckets(
  trialAvailable: number,
  trialUsed: number,
  purchasedAvailable: number,
  purchasedUsed: number
): CreditBuckets {
  return fromUtilsType(_createBuckets(trialAvailable, trialUsed, purchasedAvailable, purchasedUsed));
}

export function getCreditSummary(b: CreditBuckets): CreditSummary {
  const available = _getAvailable(toUtilsType(b));
  const total = _getTotal(toUtilsType(b));
  const used = Math.max(0, total - available);
  const purchasedAvailable = Math.max(0, b.purchased?.available || 0);
  const percentAvailable = _getPercentAvailable(toUtilsType(b));
  return { available, used, total, purchasedAvailable, percentAvailable };
}

export function consumeCredits(requested: number, b: CreditBuckets): CreditBuckets {
  const req = Math.max(0, Math.floor(requested || 0));
  const available = _getAvailable(toUtilsType(b));
  if (req === 0) return { ...b };
  if (req > available) {
    throw new Error('Insufficient credits');
  }
  const { buckets: next } = _consumeCredits(toUtilsType(b), req);
  return fromUtilsType(next);
}

export function refundCredits(amount: number, b: CreditBuckets): CreditBuckets {
  const amt = Math.max(0, Math.floor(amount || 0));
  if (amt === 0) return { ...b };
  const { buckets: next } = _refundCredits(toUtilsType(b), amt);
  return fromUtilsType(next);
}
