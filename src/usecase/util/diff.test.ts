import { expect, test } from 'bun:test';

import { computeDiff, computeIntraLine, coalesceRanges } from '~/usecase/util/diff';

test('coalesceRanges merges same-kind across whitespace and trims edges', () => {
  const raw = 'one two three four';
  const merged = coalesceRanges(raw, [
    { startCol: 0, endCol: 3, kind: 'modify' },
    { startCol: 4, endCol: 7, kind: 'modify' },
    { startCol: 14, endCol: 18, kind: 'delete' }
  ]);
  expect(merged).toEqual([
    { startCol: 0, endCol: 7, kind: 'modify' },
    { startCol: 14, endCol: 18, kind: 'delete' }
  ]);
});

test('coalesceRanges keeps different kinds separate', () => {
  const raw = 'one two';
  const merged = coalesceRanges(raw, [
    { startCol: 0, endCol: 3, kind: 'modify' },
    { startCol: 4, endCol: 7, kind: 'insert' }
  ]);
  expect(merged).toHaveLength(2);
});

test('coalesceRanges drops whitespace-only ranges', () => {
  expect(coalesceRanges('a    b', [{ startCol: 1, endCol: 5, kind: 'modify' }])).toEqual([]);
});

test('word highlights cover phrases, punctuation stays granular', () => {
  const oldText = 'const light = source;\n';
  const newText = 'const light = target,\n';
  const chunks = computeDiff(oldText, newText);
  const intra = computeIntraLine(oldText, newText, chunks, 'words');
  expect(intra.newByLine.get(1)).toEqual([{ startCol: 14, endCol: 21, kind: 'modify' }]);
  expect(intra.oldByLine.get(1)).toEqual([{ startCol: 14, endCol: 21, kind: 'modify' }]);
});

test('unchanged words between changes stay unhighlighted', () => {
  const oldText = 'aaa keep bbb\n';
  const newText = 'xxx keep yyy\n';
  const chunks = computeDiff(oldText, newText);
  const intra = computeIntraLine(oldText, newText, chunks, 'words');
  expect(intra.newByLine.get(1)).toEqual([
    { startCol: 0, endCol: 3, kind: 'modify' },
    { startCol: 9, endCol: 12, kind: 'modify' }
  ]);
});

test('whitespace never anchors word matching', () => {
  const oldText = 'foo bar\n';
  const newText = 'foo   baz\n';
  const chunks = computeDiff(oldText, newText);
  const intra = computeIntraLine(oldText, newText, chunks, 'words');
  expect(intra.oldByLine.get(1)).toEqual([{ startCol: 4, endCol: 7, kind: 'modify' }]);
  expect(intra.newByLine.get(1)).toEqual([{ startCol: 6, endCol: 9, kind: 'modify' }]);
});

test('changed word highlights whole, never splits mid-word', () => {
  const oldText = 'const MAX_CREATURES = 64\n';
  const newText = 'const MAX_FLOORS = 16\n';
  const chunks = computeDiff(oldText, newText);
  const intra = computeIntraLine(oldText, newText, chunks, 'words');
  expect(intra.oldByLine.get(1)).toEqual([{ startCol: 6, endCol: 24, kind: 'modify' }]);
  expect(intra.newByLine.get(1)).toEqual([{ startCol: 6, endCol: 21, kind: 'modify' }]);
});

test('removed-only fragment gets delete kind, added-only gets insert', () => {
  const oldText = 'return true // rect\n';
  const newText = 'return true\n';
  const chunks = computeDiff(oldText, newText);
  const intra = computeIntraLine(oldText, newText, chunks, 'words');
  expect(intra.oldByLine.get(1)).toEqual([{ startCol: 12, endCol: 19, kind: 'delete' }]);
  expect(intra.newByLine.get(1)).toBeUndefined();

  const back = computeIntraLine(newText, oldText, computeDiff(newText, oldText), 'words');
  expect(back.newByLine.get(1)).toEqual([{ startCol: 12, endCol: 19, kind: 'insert' }]);
  expect(back.oldByLine.get(1)).toBeUndefined();
});

test('indent-only change yields no word highlight', () => {
  const oldText = '  x = 1\n';
  const newText = '      x = 1\n';
  const chunks = computeDiff(oldText, newText);
  const intra = computeIntraLine(oldText, newText, chunks, 'words');
  expect(intra.oldByLine.get(1)).toBeUndefined();
  expect(intra.newByLine.get(1)).toBeUndefined();
});
