import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const modal = source('src/components/ui/Modal.tsx');
const bottomSheet = source('src/components/ui/BottomSheet.tsx');
const appLayout = source('src/components/layout/AppLayout.tsx');
const expenses = source('src/pages/Expenses.tsx');

test('mobile overlays use the dynamic viewport and own their scroll region', () => {
  for (const overlay of [modal, bottomSheet]) {
    assert.match(overlay, /100dvh/);
    assert.match(overlay, /min-h-0/);
    assert.match(overlay, /touch-pan-y overflow-y-auto overscroll-contain/);
    assert.match(overlay, /WebkitOverflowScrolling: 'touch'/);
  }
});

test('modal and bottom sheet render above the fixed mobile navigation', () => {
  assert.match(modal, /z-\[80\]/);
  assert.match(bottomSheet, /z-\[90\]/);
});

test('the application shell follows mobile browser viewport changes', () => {
  assert.match(appLayout, /h-\[100dvh\]/);
  assert.match(appLayout, /min-h-0/);
});

test('long expense forms collapse multi-column rows on phones', () => {
  assert.equal((expenses.match(/grid grid-cols-1 gap-4 sm:grid-cols-2/g) || []).length >= 2, true);
  assert.equal((expenses.match(/grid grid-cols-1 gap-4 sm:grid-cols-3/g) || []).length, 2);
});
