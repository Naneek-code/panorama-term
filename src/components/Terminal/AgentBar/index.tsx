import React from 'react';
import { Sparkles, ChevronDown } from 'lucide-react';

import Suggest from './Suggest';
import Magnifier from './Magnifier';
import { writeTempImage } from '~/adapter/clipboard/clipboard.client';
import { readFooter, modeKey, prettyMode, prettyModel, looksLikeClaude, detectExitBanner, parseStatusLines, detectSuggestTrigger } from './parse';
import { BPM_END, draftKey, BPM_START, HISTORY_KEY, CLAUDE_MODELS, CLAUDE_SLASH_COMMANDS, MODEL_QUICK_SWITCHES } from './constants';
import { cloneDraft, EMPTY_DRAFT, partsToDraft, draftToParts, isDraftEmpty, renderEditor, getCaretOffset, serializeEditor, placeCaretAtEnd, consolidateParts, draftToSendParts, insertPartsAtCaret, isCaretOnLastLine, isCaretOnFirstLine } from './editor';

import type { ClaudeState } from '~/domain/interfaces/pty.interface';
import type { ContentPart, ParsedStatus, SuggestTrigger, AgentBarProps, PromptSuggestion, AgentSuggestHandle } from './types';

import styles from './styles.module.scss';

const MODE_CLASS: Record<string, string> = {
  plan: styles.modePlan,
  auto: styles.modeAuto,
  bypass: styles.modeBypass,
  accept: styles.modeAccept,
  default: ''
};

const loadHistory = (): ContentPart[][] => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((e) => Array.isArray(e)) : [];
  } catch {
    return [];
  }
};

const historyKey = (draft: { text: string }): string => draft.text.trim();

const pause = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const progressColor = (p: number): string =>
  p >= 75 ? '#ef4444' : p >= 60 ? '#f97316' : p >= 30 ? '#eab308' : '#22c55e';

const matchQuickSwitchId = (raw: string | undefined): string => {
  if (!raw) return '';
  const m = raw.toLowerCase();
  return MODEL_QUICK_SWITCHES.find((s) => s.id === m)?.id ?? '';
};

const clipboardImages = (e: React.ClipboardEvent): Blob[] => {
  const out: Blob[] = [];
  const items = e.clipboardData?.items;
  if (!items) return out;
  for (const item of Array.from(items)) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) out.push(file);
    }
  }
  return out;
};

const AgentLogo = () => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ flex: 'none', lineHeight: 1 }}>
    <path
      fill="#D97757"
      fillRule="nonzero"
      d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z"
    />
  </svg>
);

const AgentBar = ({ tileId, active, send, getLines, getStructured, focusTerminal }: AgentBarProps) => {
  const [claudeActive, setClaudeActive] = React.useState(false);
  const [draft, setDraft] = React.useState(EMPTY_DRAFT);
  const [history, setHistory] = React.useState<ContentPart[][]>(() => loadHistory());
  const [suggest, setSuggest] = React.useState<SuggestTrigger>(null);
  const [status, setStatus] = React.useState<ParsedStatus>({});
  const [scraped, setScraped] = React.useState<{ model: string; contextInfo?: string } | null>(null);
  const [structured, setStructured] = React.useState<ClaudeState | null>(null);
  const [questionMode, setQuestionMode] = React.useState(false);
  const [manualHide, setManualHide] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [modelMenu, setModelMenu] = React.useState(false);
  const [preview, setPreview] = React.useState<string | null>(null);

  const editorRef = React.useRef<HTMLDivElement>(null);
  const modelRef = React.useRef<HTMLDivElement>(null);
  const suggestRef = React.useRef<AgentSuggestHandle>(null);
  const historyRef = React.useRef<ContentPart[][]>(history);
  const histIdxRef = React.useRef<number | null>(null);
  const histDraftRef = React.useRef(cloneDraft(EMPTY_DRAFT));
  const lastSentRef = React.useRef(cloneDraft(EMPTY_DRAFT));
  const draftRef = React.useRef(cloneDraft(EMPTY_DRAFT));
  const imgSeqRef = React.useRef(0);
  const submitSeqRef = React.useRef(0);
  const seenRef = React.useRef(false);
  const lastSeenRef = React.useRef(0);
  historyRef.current = history;
  draftRef.current = draft;

  const isEmpty = isDraftEmpty(draft);
  const hidden = questionMode || manualHide;

  const syncFromEditor = () => {
    const el = editorRef.current;
    if (!el) return;
    const next = serializeEditor(el);
    setDraft(next);
    draftRef.current = next;
  };

  const renderAndFocus = (next: { text: string; images: string[] }, focus = true) => {
    const el = editorRef.current;
    if (!el) return;
    renderEditor(el, next);
    if (focus) {
      el.focus();
      placeCaretAtEnd(el);
    }
    draftRef.current = next;
  };

  React.useEffect(() => {
    const SCAN_MS = 350;
    const GONE_MS = 2500;
    let qMode = false;
    let qTarget: boolean | null = null;
    let qTimer: ReturnType<typeof setTimeout> | undefined;

    const scan = () => {
      const lines = getLines();
      const present = looksLikeClaude(lines.slice(-25).join('\n'));
      const now = Date.now();
      if (present) {
        lastSeenRef.current = now;
        if (!seenRef.current) {
          seenRef.current = true;
          setClaudeActive(true);
        }
      } else if (seenRef.current && now - lastSeenRef.current > GONE_MS) {
        seenRef.current = false;
        setClaudeActive(false);
      }
      if (!seenRef.current) return;

      const footer = readFooter(lines);
      setStatus(parseStatusLines(footer.status));
      if (footer.model) setScraped(footer.model);
      setStructured(getStructured());

      const qm = footer.questionMode;
      if (qm === qMode) {
        if (qTimer) {
          clearTimeout(qTimer);
          qTimer = undefined;
          qTarget = null;
        }
      } else if (qTarget !== qm) {
        if (qTimer) clearTimeout(qTimer);
        qTarget = qm;
        qTimer = setTimeout(() => {
          qMode = qm;
          qTimer = undefined;
          qTarget = null;
          setQuestionMode(qm);
        }, 150);
      }
    };

    scan();
    const id = window.setInterval(scan, SCAN_MS);
    return () => {
      clearInterval(id);
      if (qTimer) clearTimeout(qTimer);
    };
  }, [getLines, getStructured]);

  React.useEffect(() => {
    if (claudeActive) {
      let restored = cloneDraft(EMPTY_DRAFT);
      try {
        const raw = localStorage.getItem(draftKey(tileId));
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed && typeof parsed.text === 'string') {
          restored = { text: parsed.text, images: Array.isArray(parsed.images) ? parsed.images : [] };
        }
      } catch {
        restored = cloneDraft(EMPTY_DRAFT);
      }
      setDraft(restored);
      setSuggest(null);
      histIdxRef.current = null;
      histDraftRef.current = cloneDraft(EMPTY_DRAFT);
      renderAndFocus(restored, restored.text.length > 0 || restored.images.length > 0);
    } else {
      setStatus({});
      setScraped(null);
      setStructured(null);
      setQuestionMode(false);
      setSubmitting(false);
      setManualHide(false);
    }
  }, [claudeActive, tileId]);

  React.useEffect(() => {
    if (!claudeActive) return;
    const t = setTimeout(() => {
      try {
        if (isDraftEmpty(draft)) localStorage.removeItem(draftKey(tileId));
        else localStorage.setItem(draftKey(tileId), JSON.stringify({ text: draft.text, images: draft.images }));
      } catch {
        void 0;
      }
    }, 500);
    return () => clearTimeout(t);
  }, [draft, claudeActive, tileId]);

  React.useEffect(() => {
    if (!claudeActive || !active) return;
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.shiftKey || e.metaKey || e.altKey) return;
      if (e.key !== 'g' && e.key !== 'G') return;
      e.preventDefault();
      e.stopPropagation();
      setManualHide((prev) => !prev);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [claudeActive, active]);

  React.useEffect(() => {
    if (!claudeActive || !active || hidden) return;
    const onTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
      if (!document.hasFocus() || document.activeElement === editorRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      const el = editorRef.current;
      if (el) {
        el.focus();
        placeCaretAtEnd(el);
      }
    };
    window.addEventListener('keydown', onTab, true);
    return () => window.removeEventListener('keydown', onTab, true);
  }, [claudeActive, active, hidden]);

  React.useEffect(() => {
    if (!modelMenu) return;
    const onDown = (e: MouseEvent) => {
      if (!modelRef.current?.contains(e.target as Node)) setModelMenu(false);
    };
    window.addEventListener('mousedown', onDown, true);
    return () => window.removeEventListener('mousedown', onDown, true);
  }, [modelMenu]);

  const persistHistory = (next: { text: string; images: string[] }) => {
    const key = historyKey(next);
    if (!key && next.images.length === 0) return;
    const parts = draftToParts(next);
    const current = loadHistory();
    const updated = [...current.filter((e) => historyKey(partsToDraft(e)) !== key), parts].slice(-50);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    } catch {
      void 0;
    }
    setHistory(updated);
  };

  const sendDraft = async (submission: { text: string; images: string[] }) => {
    const seq = ++submitSeqRef.current;
    const parts = consolidateParts(draftToSendParts(submission));
    if (parts.length === 0) return;
    if (detectExitBanner(getLines())) {
      send('\x15');
      await pause(80);
    } else {
      send('\x03');
      await pause(80);
    }
    if (submitSeqRef.current !== seq) return;
    for (const part of parts) {
      if (part.type === 'text') {
        if (part.content.length > 0) send(BPM_START + part.content + BPM_END);
      } else {
        send(`${BPM_START}${part.path} ${BPM_END}`);
      }
      await pause(part.type === 'text' ? 10 : 50);
      if (submitSeqRef.current !== seq) return;
    }
    const lineCount = Math.max(1, submission.text.split('\n').length);
    await pause(Math.min(400, 50 + lineCount * 2));
    if (submitSeqRef.current !== seq) return;
    send('\r');
  };

  const handleSend = async () => {
    const live = draftRef.current;
    if (isDraftEmpty(live) || submitting) return;
    const submission = cloneDraft(live);
    persistHistory(submission);
    lastSentRef.current = cloneDraft(submission);
    histIdxRef.current = null;
    histDraftRef.current = cloneDraft(EMPTY_DRAFT);
    setSuggest(null);
    setDraft(cloneDraft(EMPTY_DRAFT));
    draftRef.current = cloneDraft(EMPTY_DRAFT);
    if (editorRef.current) editorRef.current.textContent = '';
    setSubmitting(true);
    try {
      await sendDraft(submission);
    } finally {
      setSubmitting(false);
    }
  };

  const handleInput = () => {
    const el = editorRef.current;
    if (!el) return;
    const next = serializeEditor(el);
    setDraft(next);
    draftRef.current = next;
    histIdxRef.current = null;
    if (!next.text.startsWith('/')) {
      setSuggest(null);
      return;
    }
    const caret = getCaretOffset(el) ?? next.text.length;
    setSuggest(detectSuggestTrigger(next.text, caret));
  };

  const handleEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const removeBtn = target.closest('[data-imgremove]');
    if (removeBtn) {
      e.preventDefault();
      e.stopPropagation();
      const chip = removeBtn.closest('[data-imgpath]');
      if (chip) {
        chip.remove();
        syncFromEditor();
        const el = editorRef.current;
        if (el) {
          el.focus();
          placeCaretAtEnd(el);
        }
      }
      return;
    }
    const chip = target.closest('[data-imgpath]') as HTMLElement | null;
    if (chip?.dataset.imgpath) {
      e.stopPropagation();
      setPreview(chip.dataset.imgpath);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const blobs = clipboardImages(e);
    const fallback = e.clipboardData?.getData('text/plain') ?? '';
    e.preventDefault();

    const saved = (() => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return null;
      const r = sel.getRangeAt(0);
      const el = editorRef.current;
      if (!el || !el.contains(r.startContainer)) return null;
      return r.cloneRange();
    })();

    const paths: string[] = [];
    for (const blob of blobs) {
      try {
        imgSeqRef.current += 1;
        paths.push(await writeTempImage(blob, `${Date.now()}_${imgSeqRef.current}`));
      } catch {
        void 0;
      }
    }
    const text = blobs.length === 0 ? fallback : '';

    const el = editorRef.current;
    if (!el) return;
    el.focus();
    if (saved && el.contains(saved.startContainer)) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(saved);
    } else {
      placeCaretAtEnd(el);
    }

    const existing = draftRef.current.images.length;
    if (text || paths.length > 0) insertPartsAtCaret(el, text, paths, existing + 1);
    syncFromEditor();
    histIdxRef.current = null;

    const cur = draftRef.current;
    if (cur.text.startsWith('/')) setSuggest(detectSuggestTrigger(cur.text, getCaretOffset(el) ?? cur.text.length));
    else setSuggest(null);
  };

  const fetchSlash = React.useCallback((query: string): PromptSuggestion[] => {
    const q = query.toLowerCase();
    return CLAUDE_SLASH_COMMANDS.filter(
      (c) =>
        c.name.includes(q) ||
        c.desc.toLowerCase().includes(q) ||
        c.aliases?.some((a) => a.toLowerCase().includes(q))
    ).map((c) => ({
      id: c.name,
      display: c.name,
      subtext: c.aliases?.length ? `${c.desc} (${c.aliases.join(', ')})` : c.desc,
      icon: 'cmd',
      takesArg: c.takesArg
    }));
  }, []);

  const fetchModels = React.useCallback((query: string): PromptSuggestion[] => {
    const q = query.toLowerCase();
    return CLAUDE_MODELS.filter(
      (m) => m.name.toLowerCase().includes(q) || m.desc.toLowerCase().includes(q)
    ).map((m) => ({ id: m.name, display: m.name, subtext: m.desc, icon: 'model' }));
  }, []);

  const onSlashSelect = (item: PromptSuggestion, submit?: boolean) => {
    const name = item.display;
    const noSubmit = name === '/model' || item.takesArg === true;
    const doSubmit = submit && !noSubmit;
    const next = { text: name + (doSubmit ? '' : ' '), images: [] };
    setDraft(next);
    renderAndFocus(next);
    setSuggest(name === '/model' ? { kind: 'model', query: '' } : null);
    if (doSubmit) void handleSend();
  };

  const onModelSelect = (item: PromptSuggestion, submit?: boolean) => {
    const next = { text: `/model ${item.display}`, images: [] };
    setDraft(next);
    renderAndFocus(next);
    setSuggest(null);
    if (submit) void handleSend();
  };

  const onModelHighlight = (item: PromptSuggestion) => {
    const next = { text: `/model ${item.display}`, images: [] };
    setDraft(next);
    renderAndFocus(next, false);
  };

  const stepHistory = (dir: -1 | 1): boolean => {
    const el = editorRef.current;
    if (!el) return false;
    const hist = historyRef.current;
    if (dir === -1) {
      if (hist.length === 0 || !isCaretOnFirstLine(el)) return false;
      if (histIdxRef.current == null) {
        histDraftRef.current = cloneDraft(draftRef.current);
        histIdxRef.current = hist.length - 1;
      } else if (histIdxRef.current > 0) {
        histIdxRef.current--;
      }
      const next = partsToDraft(hist[histIdxRef.current] ?? []);
      setDraft(next);
      renderAndFocus(next);
      setSuggest(null);
      return true;
    }
    if (histIdxRef.current == null || !isCaretOnLastLine(el)) return false;
    if (histIdxRef.current < hist.length - 1) {
      histIdxRef.current++;
      const next = partsToDraft(hist[histIdxRef.current] ?? []);
      setDraft(next);
      renderAndFocus(next);
    } else {
      histIdxRef.current = null;
      const restored = cloneDraft(histDraftRef.current);
      setDraft(restored);
      renderAndFocus(restored);
    }
    setSuggest(null);
    return true;
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      send('\x1b[Z');
      return;
    }
    if (suggest && suggestRef.current?.handleKeyDown(e)) return;
    if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      focusTerminal();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      send('\x03');
      if (isDraftEmpty(draftRef.current) && !isDraftEmpty(lastSentRef.current)) {
        const restored = cloneDraft(lastSentRef.current);
        setDraft(restored);
        histIdxRef.current = null;
        setSuggest(null);
        renderAndFocus(restored);
      }
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.nativeEvent.keyCode !== 229) {
      e.preventDefault();
      void handleSend();
      return;
    }
    if (e.key === 'ArrowUp' && !e.shiftKey && !e.metaKey && !e.ctrlKey && !suggest) {
      if (stepHistory(-1)) e.preventDefault();
      return;
    }
    if (e.key === 'ArrowDown' && !e.shiftKey && !e.metaKey && !e.ctrlKey && !suggest) {
      if (stepHistory(1)) e.preventDefault();
    }
  };

  const is1M = React.useMemo(() => {
    if (scraped && /1m/i.test(scraped.contextInfo ?? '')) return true;
    return Boolean(structured && /\[1m\]/i.test(`${structured.model ?? ''} ${structured.defaultModel ?? ''}`));
  }, [scraped, structured]);

  const currentModelId = React.useMemo(() => {
    if (scraped) {
      const t = scraped.model.toLowerCase();
      const oneM = /1m/i.test(scraped.contextInfo ?? '');
      if (t.includes('sonnet')) {
        const sm = t.match(/sonnet\s*(\d+)(?:[.\s-](\d+))?/);
        if (!sm) return '';
        const id = sm[2] ? `claude-sonnet-${sm[1]}-${sm[2]}` : `claude-sonnet-${sm[1]}`;
        return `${id}${oneM ? '[1m]' : ''}`;
      }
      const m = t.match(/opus\s*(\d)[.\s-]?(\d)/);
      if (m) return `claude-opus-${m[1]}-${m[2]}${oneM ? '[1m]' : ''}`;
      return '';
    }
    const base = matchQuickSwitchId(structured?.model);
    return base && is1M && !base.includes('[1m]') ? `${base}[1m]` : base;
  }, [scraped, structured, is1M]);

  const parsed = React.useMemo<ParsedStatus>(() => {
    const base: ParsedStatus = { ...status };
    if (scraped) {
      base.model = scraped.model;
      base.contextInfo = scraped.contextInfo;
    } else if (structured?.model) {
      const pm = prettyModel(structured.model);
      if (pm.model) base.model = pm.model;
      if (!base.contextInfo && pm.contextInfo) base.contextInfo = pm.contextInfo;
    }
    if (!base.mode && structured) base.mode = prettyMode(structured.permissionMode ?? structured.mode);
    if (base.progress == null && structured?.contextTokens != null) {
      const win = is1M ? 1_000_000 : 200_000;
      base.progress = Math.min(100, Math.round((structured.contextTokens / win) * 100));
      if (!base.contextInfo) base.contextInfo = is1M ? '1M' : '200k';
    }
    return base;
  }, [status, scraped, structured, is1M]);

  const hasStatus = Boolean(parsed.model || parsed.mode || parsed.focused || parsed.progress != null);

  const toggleModelMenu = () => setModelMenu((o) => !o);
  const restore = () => setManualHide(false);

  const focusEditor = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-imgpath]') || target.closest(`.${styles.actions}`) || target.closest(`.${styles.editor}`)) return;
    const el = editorRef.current;
    if (el) {
      el.focus();
      placeCaretAtEnd(el);
    }
  };

  const pickModel = (id: string) => () => {
    void sendDraft({ text: `/model ${id}`, images: [] });
    setModelMenu(false);
  };

  if (!claudeActive) return null;

  return (
    <>
      {manualHide && !questionMode && (
        <button className={styles.restore} title="Restore prompt (Ctrl+G)" onClick={restore}>
          <AgentLogo />
        </button>
      )}
      <div className={styles.bar} style={hidden ? { display: 'none' } : undefined} onClick={focusEditor}>
        <div className={styles.row}>
          <div className={styles.logo} aria-hidden="true">
            <AgentLogo />
          </div>
          <div
            ref={editorRef}
            role="textbox"
            contentEditable
            spellCheck={false}
            aria-multiline="true"
            aria-label="Prompt input"
            className={styles.editor}
            suppressContentEditableWarning
            data-placeholder="Tell Claude what to do... (/ commands, up-arrow history)"
            data-empty={isEmpty ? 'true' : undefined}
            onInput={handleInput}
            onPaste={handlePaste}
            onClick={handleEditorClick}
            onKeyDown={onKeyDown}
          />
          <div className={styles.actions} ref={modelRef}>
            <button type="button" className={styles.model} title="Switch model" onClick={toggleModelMenu}>
              {MODEL_QUICK_SWITCHES.find((m) => m.id === currentModelId)?.title ?? 'Model'}
              <ChevronDown size={11} />
            </button>
            {modelMenu && (
              <div className={styles.menu}>
                {MODEL_QUICK_SWITCHES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={pickModel(m.id)}
                    className={m.id === currentModelId ? `${styles.menuItem} ${styles.menuActive}` : styles.menuItem}
                  >
                    {m.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className={styles.hints}>
          {submitting
            ? 'Submitting prompt...'
            : suggest
              ? 'Enter select & send - Tab complete - Esc close'
              : 'Enter send - Shift+Enter newline - Tab terminal'}
        </div>
        {hasStatus && (
          <div className={styles.footer} aria-hidden="true">
            {parsed.mode && (
              <span className={`${styles.chip} ${styles.chipMode} ${MODE_CLASS[modeKey(parsed.mode)]}`}>
                <Sparkles size={10} />
                <span className={styles.chipLabel}>{parsed.mode}</span>
              </span>
            )}
            {parsed.model && (
              <span className={styles.chip}>
                <span className={styles.chipLabel}>{parsed.model}</span>
                {parsed.contextInfo && <span className={styles.chipSub}>{parsed.contextInfo}</span>}
              </span>
            )}
            {parsed.focused && (
              <span className={`${styles.chip} ${styles.chipFocus}`}>
                <span className={styles.dot} />
                <span className={styles.chipLabel}>focus</span>
              </span>
            )}
            {parsed.progress != null && (
              <span className={styles.progress}>
                <span className={styles.track}>
                  <span
                    className={styles.fill}
                    style={{ width: `${Math.min(100, Math.max(0, parsed.progress))}%`, background: progressColor(parsed.progress) }}
                  />
                </span>
                <span className={styles.progressLabel}>{parsed.progress}%</span>
              </span>
            )}
          </div>
        )}
        {suggest && (
          <Suggest
            ref={suggestRef}
            query={suggest.query}
            fetchFn={suggest.kind === 'model' ? fetchModels : fetchSlash}
            onSelect={suggest.kind === 'model' ? onModelSelect : onSlashSelect}
            onHighlight={suggest.kind === 'model' ? onModelHighlight : undefined}
            onClose={() => setSuggest(null)}
          />
        )}
      </div>
      {preview && <Magnifier path={preview} onClose={() => setPreview(null)} />}
    </>
  );
};

export default AgentBar;
