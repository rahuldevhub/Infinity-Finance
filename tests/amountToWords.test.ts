import test from 'node:test';
import assert from 'node:assert/strict';
import { amountToWords } from '../src/utils/amountToWords.js';

const examples: Array<[number, string]> = [
  [1, 'Rupees One Only'],
  [10, 'Rupees Ten Only'],
  [100, 'Rupees One Hundred Only'],
  [1_000, 'Rupees One Thousand Only'],
  [10_514, 'Rupees Ten Thousand Five Hundred and Fourteen Only'],
  [25_000, 'Rupees Twenty Five Thousand Only'],
  [100_000, 'Rupees One Lakh Only'],
  [125_500, 'Rupees One Lakh Twenty Five Thousand Five Hundred Only'],
  [1_000_000, 'Rupees Ten Lakh Only'],
  [10_000_000, 'Rupees One Crore Only'],
];

test('formats supported Indian currency magnitudes with correct hundred grammar', () => {
  for (const [amount, expected] of examples) assert.equal(amountToWords(amount), expected);
});

test('formats paise without losing the rupee wording', () => {
  assert.equal(amountToWords(10_514.5), 'Rupees Ten Thousand Five Hundred and Fourteen and Fifty Paise Only');
});
