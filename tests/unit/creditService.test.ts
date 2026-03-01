import { createBuckets, consumeCredits, getCreditSummary, refundCredits } from '../../services/CreditService';

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${expected}, got ${String(actual)}`);
  }
}

const base = createBuckets(2, 0, 195, 8);

{
  const after = consumeCredits(1, base);
  const summary = getCreditSummary(after);
  assertEqual(after.trial.available, 1, 'consumeCredits should decrement trial available');
  assertEqual(after.trial.used, 1, 'consumeCredits should increment trial used');
  assertEqual(summary.available, 196, 'summary available should match buckets');
  assertEqual(summary.total, 205, 'summary total should remain invariant');
}

{
  const after = consumeCredits(5, base);
  assertEqual(after.purchased.available, 192, 'consumeCredits should use purchased credits when trial is exhausted');
  assertEqual(after.purchased.used, 11, 'consumeCredits should track purchased usage');
}

{
  let threw = false;
  try {
    consumeCredits(1, createBuckets(0, 0, 0, 0));
  } catch {
    threw = true;
  }
  assertEqual(threw, true, 'consumeCredits should throw when credits are insufficient');
}

{
  const consumed = consumeCredits(5, base);
  const refunded = refundCredits(3, consumed);
  const summary = getCreditSummary(refunded);
  assertEqual(summary.available, 195, 'refundCredits should restore consumed purchased credits');
}

console.log('creditService.test: OK');
