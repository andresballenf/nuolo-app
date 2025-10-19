// Unit tests for CreditService FIFO consumption logic
// Run manually with ts-node or as documentation; this repo has no test runner configured.

import { createBuckets, consumeCredits, getCreditSummary } from '../services/CreditService';

function assertEqual(actual: any, expected: any, msg: string) {
  if (actual !== expected) {
    throw new Error(`${msg}. Expected ${expected}, got ${actual}`);
  }
}

// Base state from ticket context:
// 197 available, 8 used, total 205. Trial 2 available, purchased 195 available.
// Assume used belongs to purchased.
const base = createBuckets(2, 0, 195, 8);

// Case 1: all from trial
{
  const before = createBuckets(base.trial.available, base.trial.used, base.purchased.available, base.purchased.used);
  const after = consumeCredits(1, before);
  const s = getCreditSummary(after);
  assertEqual(after.trial.available, 1, 'Case 1: trial.available');
  assertEqual(after.trial.used, 1, 'Case 1: trial.used');
  assertEqual(after.purchased.available, 195, 'Case 1: purchased.available');
  assertEqual(after.purchased.used, 8, 'Case 1: purchased.used');
  assertEqual(s.available, 196, 'Case 1: available');
  assertEqual(s.used, 9, 'Case 1: used');
  assertEqual(s.total, 205, 'Case 1: total');
}

// Case 2: split across trial and purchased
{
  const original = createBuckets(2, 0, 195, 8);
  const after = consumeCredits(5, original);
  assertEqual(after.trial.available, 0, 'Case 2: trial available should be 0');
  assertEqual(after.trial.used, 2, 'Case 2: trial used should be 2');
  assertEqual(after.purchased.available, 192, 'Case 2: purchased available should reduce by 3');
  assertEqual(after.purchased.used, 11, 'Case 2: purchased used should increase by 3');
  const s = getCreditSummary(after);
  assertEqual(s.total, 205, 'Case 2: total = 205');
  assertEqual(s.used, 13, 'Case 2: used = 13');
}

// Case 3: insufficient credits should throw
{
  let threw = false;
  try {
    const original = createBuckets(0, 0, 0, 0);
    consumeCredits(1, original);
  } catch (e) {
    threw = true;
  }
  assertEqual(threw, true, 'Case 3: should throw on insufficient credits');
}

// Case 4: idempotent on zero request
{
  const original = createBuckets(2, 0, 195, 8);
  const after = consumeCredits(0, original);
  // No change expected
  assertEqual(after.trial.available, original.trial.available, 'Case 4: trial.available unchanged');
  assertEqual(after.purchased.available, original.purchased.available, 'Case 4: purchased.available unchanged');
  const sBefore = getCreditSummary(original);
  const sAfter = getCreditSummary(after);
  assertEqual(sBefore.available, sAfter.available, 'Case 4: summary.available unchanged');
}

console.log('creditService.test: OK');
