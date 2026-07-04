import { expect, test } from 'bun:test';

import { keyToBytes } from '~/usecase/util/terminalKeys';

const ev = (key: string, mods: Partial<{ ctrl: boolean; alt: boolean; shift: boolean; meta: boolean }> = {}) => ({
  key,
  ctrlKey: !!mods.ctrl,
  altKey: !!mods.alt,
  shiftKey: !!mods.shift,
  metaKey: !!mods.meta
});

test('plain arrows send CSI', () => {
  expect(keyToBytes(ev('ArrowLeft'))).toBe('\x1b[D');
  expect(keyToBytes(ev('ArrowRight'))).toBe('\x1b[C');
});

test('ctrl+arrows send word-motion CSI with modifier 5', () => {
  expect(keyToBytes(ev('ArrowLeft', { ctrl: true }))).toBe('\x1b[1;5D');
  expect(keyToBytes(ev('ArrowRight', { ctrl: true }))).toBe('\x1b[1;5C');
});

test('shift+arrow uses modifier 2, alt uses 3', () => {
  expect(keyToBytes(ev('ArrowUp', { shift: true }))).toBe('\x1b[1;2A');
  expect(keyToBytes(ev('ArrowDown', { alt: true }))).toBe('\x1b[1;3B');
});

test('ctrl/alt backspace deletes word backward', () => {
  expect(keyToBytes(ev('Backspace'))).toBe('\x7f');
  expect(keyToBytes(ev('Backspace', { ctrl: true }))).toBe('\x1b\x7f');
  expect(keyToBytes(ev('Backspace', { alt: true }))).toBe('\x1b\x7f');
});

test('ctrl+delete deletes word forward, plain delete is CSI 3~', () => {
  expect(keyToBytes(ev('Delete'))).toBe('\x1b[3~');
  expect(keyToBytes(ev('Delete', { ctrl: true }))).toBe('\x1bd');
});

test('ctrl+home/end carry modifier', () => {
  expect(keyToBytes(ev('Home', { ctrl: true }))).toBe('\x1b[1;5H');
  expect(keyToBytes(ev('End'))).toBe('\x1b[F');
});

test('shift+tab is backtab', () => {
  expect(keyToBytes(ev('Tab'))).toBe('\t');
  expect(keyToBytes(ev('Tab', { shift: true }))).toBe('\x1b[Z');
});

test('control letters and meta passthrough', () => {
  expect(keyToBytes(ev('c', { ctrl: true }))).toBe('\x03');
  expect(keyToBytes(ev('a'))).toBe('a');
  expect(keyToBytes(ev('f', { alt: true }))).toBe('\x1bf');
  expect(keyToBytes(ev('v', { meta: true }))).toBeNull();
});
