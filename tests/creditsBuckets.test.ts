// Lightweight unit tests for CreditsBuckets FIFO consumption logic
// Run manually by executing `ts-node` or as documentation; no test runner is configured.

import { createBuckets, consumeCredits, getAvailable, getTotal, getTotalUsed, refundCredits } from '../utils/credits';

function assertEqual(actual: any, expected: any, msg: string) {
  if (actual !== expected) {
    throw new Error(`${msg}. Expected ${expected}, got ${actual}`);
  }
}

// Base state from ticket context:
// 197 available, 8 used, total 205. Trial 2 available, purchased 195 available.
// Assume used belongs to purchased.
const base = createBuckets(2, 0, 195, 8);

// Case 1: request 1
{
  const { buckets, fromTrial, fromPurchased } = consumeCredits(base, 1);
  assertEqual(fromTrial, 1, 'Case 1: fromTrial');
  assertEqual(fromPurchased, 0, 'Case 1: fromPurchased');
  assertEqual(buckets.trial.available, 1, 'Case 1: trial.available');
  assertEqual(buckets.trial.used, 1, 'Case 1: trial.used');
  assertEqual(buckets.purchased.available, 195, 'Case 1: purchased.available');
  assertEqual(buckets.purchased.used, 8, 'Case 1: purchased.used');
  assertEqual(getTotalUsed(buckets), 9, 'Case 1: totalUsed');
}

// Case 2: request 2
{
  const { buckets, fromTrial, fromPurchased } = consumeCredits(base, 2);
  assertEqual(fromTrial, 2, 'Case 2: fromTrial');
  assertEqual(fromPurchased, 0, 'Case 2: fromPurchased');
  assertEqual(buckets.trial.available, 0, 'Case 2: trial.available');
  assertEqual(buckets.trial.used, 2, 'Case 2: trial.used');
  assertEqual(getTotalUsed(buckets), 10, 'Case 2: totalUsed');
}

// Case 3: request 5
{
  const { buckets, fromTrial, fromPurchased } = consumeCredits(base, 5);
  assertEqual(fromTrial, 2, 'Case 3: fromTrial');
  assertEqual(fromPurchased, 3, 'Case 3: fromPurchased');
  assertEqual(buckets.trial.available, 0, 'Case 3: trial.available');
  assertEqual(buckets.trial.used, 2, 'Case 3: trial.used');
  assertEqual(buckets.purchased.available, 192, 'Case 3: purchased.available');
  assertEqual(buckets.purchased.used, 11, 'Case 3: purchased.used');
  assertEqual(getTotalUsed(buckets), 13, 'Case 3: totalUsed');
}

// Case 4: request 210 (more than available -> consume max available)
{
  const { buckets, fromTrial, fromPurchased } = consumeCredits(base, 210);
  assertEqual(fromTrial, 2, 'Case 4: fromTrial');
  assertEqual(fromPurchased, 195, 'Case 4: fromPurchased');
  assertEqual(getAvailable(buckets), 0, 'Case 4: available should be 0 after consuming all');
  assertEqual(getTotal(buckets), 205, 'Case 4: total remains 205');
  assertEqual(getTotalUsed(buckets), 205, 'Case 4: totalUsed becomes 205');
}

// Refund test: refund 3 after consuming 5
{
  const consumed = consumeCredits(base, 5);
  const refunded = refundCredits(consumed.buckets, 3);
  // Expect purchased refund first: 3 goes back to purchased
  if (refunded.buckets.purchased.available !== 195) throw new Error('Refund: purchased.available should return to 195');
  if (refunded.buckets.purchased.used !== 8) throw new Error('Refund: purchased.used should return to 8');
  if (refunded.buckets.trial.available !== 0) throw new Error('Refund: trial.available should remain 0');
  if (refunded.buckets.trial.used !== 2) throw new Error('Refund: trial.used should remain 2 (no refund to trial yet)');
}

console.log('creditsBuckets.test: OK');
