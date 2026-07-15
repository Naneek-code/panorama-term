import { expect, test } from 'bun:test';

import { toggleTaskAt } from '~/usecase/util/markdownLivePreview';

test('toggleTaskAt flips checkbox both ways', () => {
  expect(toggleTaskAt('[ ]')).toBe('[x]');
  expect(toggleTaskAt('[x]')).toBe('[ ]');
  expect(toggleTaskAt('[X]')).toBe('[ ]');
});
