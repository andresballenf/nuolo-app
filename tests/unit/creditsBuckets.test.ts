import {
  createBuckets,
  consumeCredits,
  getAvailable,
  getTotal,
  getTotalUsed,
  refundCredits,
} from '../../utils/credits';

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${expected}, got ${String(actual)}`);
  }
}

const base = createBuckets(2, 0, 195, 8);

{
  const { buckets, fromTrial, fromPurchased } = consumeCredits(base, 5);
  assertEqual(fromTrial, 2, 'consumeCredits should spend trial balance first');
  assertEqual(fromPurchased, 3, 'consumeCredits should spend purchased balance second');
  assertEqual(buckets.trial.available, 0, 'trial available should be exhausted');
  assertEqual(buckets.purchased.available, 192, 'purchased available should decrease by 3');
  assertEqual(getTotalUsed(buckets), 13, 'total used should be increased by consumed amount');
}

{
  const { buckets } = consumeCredits(base, 210);
  assertEqual(getAvailable(buckets), 0, 'consumeCredits should cap at available credits');
  assertEqual(getTotal(buckets), 205, 'total credits should remain invariant');
}

{
  const consumed = consumeCredits(base, 5);
  const refunded = refundCredits(consumed.buckets, 3);
  assertEqual(refunded.buckets.purchased.available, 195, 'refund should restore purchased credits first');
  assertEqual(refunded.buckets.purchased.used, 8, 'refund should reduce purchased used first');
  assertEqual(refunded.buckets.trial.available, 0, 'trial available should remain unchanged after purchased refund');
}

console.log('creditsBuckets.test: OK');
