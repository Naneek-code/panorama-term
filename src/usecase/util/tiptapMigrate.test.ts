import { expect, test } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register();

const { isLegacyHtml, htmlToMarkdown } = await import('~/usecase/util/tiptapMigrate');

test('detects legacy tiptap html, ignores markdown', () => {
  expect(isLegacyHtml('<p>hi</p>')).toBe(true);
  expect(isLegacyHtml('<h1>title</h1>')).toBe(true);
  expect(isLegacyHtml('# already markdown')).toBe(false);
  expect(isLegacyHtml('<https://autolink>')).toBe(false);
  expect(isLegacyHtml('')).toBe(false);
  expect(isLegacyHtml(undefined)).toBe(false);
});

test('converts headings and inline marks', () => {
  expect(htmlToMarkdown('<h1>Title</h1><h2>Sub</h2>')).toBe('# Title\n\n## Sub');
  expect(htmlToMarkdown('<p>a <strong>b</strong> <em>c</em> <s>d</s> <code>e</code></p>')).toBe('a **b** *c* ~~d~~ `e`');
});

test('converts lists including tasks and nesting', () => {
  expect(htmlToMarkdown('<ul><li>one</li><li>two</li></ul>')).toBe('- one\n- two');
  expect(htmlToMarkdown('<ol><li>one</li><li>two</li></ol>')).toBe('1. one\n2. two');
  expect(
    htmlToMarkdown('<ul data-type="taskList"><li data-checked="true"><label><input type="checkbox"></label><div>done</div></li><li data-checked="false"><label><input type="checkbox"></label><div>todo</div></li></ul>')
  ).toBe('- [x] done\n- [ ] todo');
  expect(htmlToMarkdown('<ul><li>a<ul><li>b</li></ul></li></ul>')).toBe('- a\n  - b');
});
