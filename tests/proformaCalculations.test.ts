import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateProformaItemAmount,
  calculateProformaTotals,
  validateProformaDiscount,
} from '../src/domain/proformaCalculations.js'

const base = {
  subtotal: 32_999,
  discountType: 'percent' as const,
  discountValue: 0,
  includeGst: true,
  gstRate: 18,
  isIgst: false,
}

test('zero discount preserves the existing subtotal then GST calculation', () => {
  assert.deepEqual(calculateProformaTotals(base), {
    subtotal: 32_999,
    discountAmount: 0,
    taxableValue: 32_999,
    cgstAmount: 2_969.91,
    sgstAmount: 2_969.91,
    igstAmount: 0,
    totalGst: 5_939.82,
    totalAmount: 38_938.82,
  })
})

test('10 percent discount is applied before intra-state GST', () => {
  assert.deepEqual(calculateProformaTotals({ ...base, discountValue: 10 }), {
    subtotal: 32_999,
    discountAmount: 3_299.90,
    taxableValue: 29_699.10,
    cgstAmount: 2_672.92,
    sgstAmount: 2_672.92,
    igstAmount: 0,
    totalGst: 5_345.84,
    totalAmount: 35_044.94,
  })
})

test('fixed discount is applied before inter-state GST', () => {
  assert.deepEqual(calculateProformaTotals({ ...base, discountType: 'flat', discountValue: 5_000, isIgst: true }), {
    subtotal: 32_999,
    discountAmount: 5_000,
    taxableValue: 27_999,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: 5_039.82,
    totalGst: 5_039.82,
    totalAmount: 33_038.82,
  })
})

test('100 percent discount produces a valid zero total', () => {
  const totals = calculateProformaTotals({ ...base, discountValue: 100 })
  assert.equal(totals.discountAmount, 32_999)
  assert.equal(totals.taxableValue, 0)
  assert.equal(totals.totalAmount, 0)
})

test('invalid discounts are rejected instead of clamped silently', () => {
  assert.match(validateProformaDiscount(1_000, 'percent', -1) || '', /negative|invalid/)
  assert.match(validateProformaDiscount(1_000, 'percent', 101) || '', /100%/)
  assert.match(validateProformaDiscount(1_000, 'flat', 1_001) || '', /subtotal/)
  assert.throws(() => calculateProformaTotals({ ...base, discountValue: 101 }), /100%/)
})

test('no GST keeps total equal to discounted taxable value', () => {
  const totals = calculateProformaTotals({ ...base, discountValue: 10, includeGst: false })
  assert.equal(totals.totalGst, 0)
  assert.equal(totals.totalAmount, 29_699.10)
})

test('line item amounts use minor-unit rounding', () => {
  assert.equal(calculateProformaItemAmount(3, 10.005), 30.02)
})
