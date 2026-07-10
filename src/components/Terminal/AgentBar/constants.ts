export interface AgentSlashCommand {
  name: string;
  desc: string;
  aliases?: string[];
  takesArg?: boolean;
}

export interface AgentModel {
  name: string;
  desc: string;
  aliases?: string[];
}

export const HISTORY_KEY = 'agent:prompthistory';
export const BPM_START = '\x1b[200~';
export const BPM_END = '\x1b[201~';

export const draftKey = (tileId: string): string => `agent:draft:${tileId}`;

export const MODEL_QUICK_SWITCHES = [
  { id: 'claude-fable-5', title: 'Fable 5' },
  { id: 'claude-sonnet-5', title: 'Sonnet 5' },
  { id: 'claude-opus-4-6', title: 'Opus 4.6' },
  { id: 'claude-opus-4-7', title: 'Opus 4.7' },
  { id: 'claude-opus-4-8', title: 'Opus 4.8' },
  { id: 'claude-fable-5[1m]', title: 'Fable 5 · 1M' },
  { id: 'claude-sonnet-5[1m]', title: 'Sonnet 5 · 1M' },
  { id: 'claude-opus-4-6[1m]', title: 'Opus 4.6 · 1M' },
  { id: 'claude-opus-4-7[1m]', title: 'Opus 4.7 · 1M' },
  { id: 'claude-opus-4-8[1m]', title: 'Opus 4.8 · 1M' }
] as const;

export const EFFORT_LEVELS = [
  { id: 'low', desc: 'Fastest, shallow reasoning', color: '#4ade80' },
  { id: 'medium', desc: 'Balanced', color: '#a3e635' },
  { id: 'high', desc: 'Default', color: '#38bdf8' },
  { id: 'xhigh', desc: 'Deeper reasoning', color: '#fb923c' },
  { id: 'max', desc: 'Smartest, slowest', color: '#f87171' },
  { id: 'ultracode', desc: 'xhigh + workflows', color: '#a855f7' }
] as const;

export const CLAUDE_MODELS: AgentModel[] = [
  { name: 'default', desc: 'Recommended default model' },
  { name: 'opus', desc: 'Latest Claude Opus' },
  { name: 'sonnet', desc: 'Latest Claude Sonnet' },
  { name: 'haiku', desc: 'Latest Claude Haiku' },
  { name: 'opusplan', desc: 'Opus for planning, Sonnet for execution' },
  { name: 'claude-opus-4-8', desc: 'Opus 4.8 - latest' },
  { name: 'claude-opus-4-7', desc: 'Opus 4.7' },
  { name: 'claude-opus-4-6', desc: 'Opus 4.6' },
  { name: 'claude-sonnet-5', desc: 'Sonnet 5' },
  { name: 'claude-sonnet-4-6', desc: 'Sonnet 4.6' },
  { name: 'claude-haiku-4-5', desc: 'Haiku 4.5 - fastest' },
  { name: 'claude-fable-5', desc: 'Fable 5' }
];

export const CLAUDE_SLASH_COMMANDS: AgentSlashCommand[] = [
  { name: '/clear', desc: 'New conversation', aliases: ['/reset', '/new'] },
  { name: '/compact', desc: 'Compact conversation with optional focus', takesArg: true },
  { name: '/resume', desc: 'Resume a session or open picker' },
  { name: '/branch', desc: 'Fork current conversation', takesArg: true },
  { name: '/rename', desc: 'Rename current session', takesArg: true },
  { name: '/exit', desc: 'Exit the CLI' },
  { name: '/model', desc: 'Select/change AI model' },
  { name: '/effort', desc: 'Set reasoning effort level', takesArg: true },
  { name: '/config', desc: 'Open Settings interface' },
  { name: '/fast', desc: 'Toggle fast mode' },
  { name: '/theme', desc: 'Change color theme' },
  { name: '/plan', desc: 'Enter plan mode' },
  { name: '/diff', desc: 'View uncommitted changes' },
  { name: '/rewind', desc: 'Rewind conversation/code to prior point' },
  { name: '/review', desc: 'Review a pull request', takesArg: true },
  { name: '/context', desc: 'Visualize context usage' },
  { name: '/cost', desc: 'Show token usage stats' },
  { name: '/usage', desc: 'Show plan limits/rate limits' },
  { name: '/help', desc: 'Show help' },
  { name: '/doctor', desc: 'Diagnose installation' },
  { name: '/init', desc: 'Initialize CLAUDE.md' },
  { name: '/memory', desc: 'Edit memory files' },
  { name: '/permissions', desc: 'Manage tool permissions' },
  { name: '/skills', desc: 'List available skills' },
  { name: '/mcp', desc: 'Manage MCP server connections' },
  { name: '/hooks', desc: 'View hook configurations' },
  { name: '/simplify', desc: 'Code review for quality/efficiency' },
  { name: '/loop', desc: 'Run a prompt repeatedly', takesArg: true },
  { name: '/schedule', desc: 'Create/manage scheduled tasks', takesArg: true },
  { name: '/security-review', desc: 'Security review of pending changes' }
];
