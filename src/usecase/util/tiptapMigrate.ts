export const isLegacyHtml = (content?: string): boolean => !!content && /^\s*<(p|h[1-6]|ul|ol|pre|blockquote)\b/i.test(content);

const inline = (node: Node): string => {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const el = node as HTMLElement;
  const inner = Array.from(el.childNodes).map(inline).join('');

  switch (el.tagName) {
    case 'STRONG':
    case 'B':
      return `**${inner}**`;
    case 'EM':
    case 'I':
      return `*${inner}*`;
    case 'S':
    case 'DEL':
    case 'STRIKE':
      return `~~${inner}~~`;
    case 'CODE':
      return `\`${inner}\``;
    case 'BR':
      return '\n';
    default:
      return inner;
  }
};

const list = (el: HTMLElement, ordered: boolean, depth: number): string => {
  const task = el.getAttribute('data-type') === 'taskList';
  const lines: string[] = [];
  let index = 1;

  Array.from(el.children).forEach((child) => {
    if (child.tagName !== 'LI') return;

    const nested: string[] = [];
    const parts: string[] = [];

    Array.from(child.childNodes).forEach((sub) => {
      const e = sub as HTMLElement;
      if (sub.nodeType === Node.ELEMENT_NODE && (e.tagName === 'UL' || e.tagName === 'OL')) nested.push(list(e, e.tagName === 'OL', depth + 1));
      else parts.push(inline(sub));
    });

    const pad = '  '.repeat(depth);
    const marker = task ? `- [${child.getAttribute('data-checked') === 'true' ? 'x' : ' '}] ` : ordered ? `${index}. ` : '- ';
    lines.push(pad + marker + parts.join('').trim());
    if (nested.length) lines.push(nested.join('\n'));
    index += 1;
  });

  return lines.join('\n');
};

const block = (el: HTMLElement): string => {
  if (/^H[1-6]$/.test(el.tagName)) return `${'#'.repeat(Number(el.tagName[1]))} ${inline(el).trim()}`;

  switch (el.tagName) {
    case 'UL':
    case 'OL':
      return list(el, el.tagName === 'OL', 0);
    case 'PRE':
      return `\`\`\`\n${el.textContent ?? ''}\n\`\`\``;
    case 'BLOCKQUOTE':
      return `> ${inline(el).trim()}`;
    default:
      return inline(el).trim();
  }
};

export const htmlToMarkdown = (html: string): string => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return Array.from(doc.body.children)
    .map((el) => block(el as HTMLElement))
    .filter((s) => s.length > 0)
    .join('\n\n')
    .trim();
};
