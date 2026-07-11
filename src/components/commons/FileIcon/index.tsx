import { Icon, addCollection } from '@iconify/react';
import catppuccin from '@iconify-json/catppuccin/icons.json';

addCollection(catppuccin);

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp', 'avif']);

const iconForFile = (name: string): string => {
  const lower = name.toLowerCase();

  if (lower === '.gitignore' || lower === '.gitattributes') return 'git';
  if (lower === '.editorconfig') return 'editorconfig';
  if (lower === 'package.json' || lower === 'package-lock.json') return 'package-json';
  if (lower === 'bun.lock' || lower === 'bun.lockb') return 'bun';
  if (lower === 'readme' || lower === 'readme.md') return 'readme';
  if (lower === 'license' || lower === 'license.md' || lower === 'license.txt') return 'license';
  if (lower === 'dockerfile' || lower === 'containerfile') return 'docker';
  if (lower === 'docker-compose.yml' || lower === 'docker-compose.yaml') return 'docker-compose';
  if (lower === '.dockerignore') return 'docker-ignore';
  if (lower === 'tsconfig.json' || /^tsconfig\.[^.]+\.json$/.test(lower)) return 'typescript-config';
  if (lower.startsWith('vite.config.')) return 'vite';
  if (lower.startsWith('.eslintrc') || lower === 'eslint.config.js') return 'eslint';
  if (lower.startsWith('.prettierrc') || lower === 'prettier.config.js') return 'prettier';
  if (lower === 'cargo.toml' || lower === 'cargo.lock') return 'rust-config';
  if (lower === 'tauri.conf.json') return 'rust';

  const dot = lower.lastIndexOf('.');
  const ext = dot > 0 ? lower.slice(dot + 1) : '';

  switch (ext) {
    case 'ts':
      return 'typescript';
    case 'tsx':
      return 'typescript-react';
    case 'js':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'jsx':
      return 'javascript-react';
    case 'json':
      return 'json';
    case 'md':
      return 'markdown';
    case 'mdx':
      return 'markdown-mdx';
    case 'html':
    case 'htm':
      return 'html';
    case 'css':
      return 'css';
    case 'scss':
    case 'sass':
      return 'sass';
    case 'py':
      return 'python';
    case 'rs':
      return 'rust';
    case 'toml':
      return 'toml';
    case 'yml':
    case 'yaml':
      return 'yaml';
    case 'xml':
      return 'xml';
    case 'svg':
      return 'svg';
    case 'sh':
    case 'bash':
    case 'zsh':
      return 'bash';
    case 'ps1':
      return 'powershell';
    default:
      if (IMAGE_EXTS.has(ext)) return 'image';
      return 'file';
  }
};

interface FileIconProps {
  name?: string;
  dir?: boolean;
  open?: boolean;
  size?: number;
  className?: string;
}

const FileIcon = ({ name, dir, open, size = 14, className }: FileIconProps) => {
  const icon = dir ? (open ? 'folder-open' : 'folder') : iconForFile(name ?? '');
  return <Icon icon={`catppuccin:${icon}`} width={size} height={size} className={className} style={{ flex: 'none' }} />;
};

export default FileIcon;
