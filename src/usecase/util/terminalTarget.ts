export type TerminalTarget = string;

export interface TerminalTargetOption {
  id: TerminalTarget;
  label: string;
  isDefault?: boolean;
}

const isWindows = navigator.userAgent.includes('Windows');

export const TERMINAL_TARGET_KEY = 'terminalTarget';

export const listTerminalTargets = (): TerminalTargetOption[] =>
  isWindows
    ? [
        { id: 'auto', label: 'Automatic', isDefault: true },
        { id: 'powershell', label: 'PowerShell' }
      ]
    : [
        { id: 'auto', label: 'Automatic', isDefault: true },
        { id: 'shell', label: 'Login shell' }
      ];
