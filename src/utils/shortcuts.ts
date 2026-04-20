import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { ShortcutAction, ShortcutBinding, ShortcutSettings } from '../types/domain';

export const SHORTCUT_ACTION_LABELS: Record<ShortcutAction, string> = {
  newLoosePage: 'New Loose Page',
  newChapterPage: 'New Page in Current Chapter',
  toggleSidebar: 'Toggle Sidebar',
  goHome: 'Go Home',
  goBack: 'Go Back'
};

export const SHORTCUT_ACTIONS: ShortcutAction[] = [
  'newLoosePage',
  'newChapterPage',
  'toggleSidebar',
  'goHome',
  'goBack'
];

export const DEFAULT_SHORTCUTS: ShortcutSettings = {
  newLoosePage: { key: 'n', meta: true, alt: true },
  newChapterPage: { key: 'n', meta: true, shift: true },
  toggleSidebar: { key: '\\', meta: true },
  goHome: { key: 'h', meta: true, shift: true },
  goBack: { key: 'arrowleft', meta: true }
};

const MODIFIER_KEYS = new Set(['alt', 'control', 'ctrl', 'meta', 'shift', 'os']);
const FUNCTION_KEY_PATTERN = /^f\d{1,2}$/;

export function eventMatchesShortcut(event: KeyboardEvent, binding: ShortcutBinding | null): boolean {
  if (!binding || event.isComposing) {
    return false;
  }

  const normalizedBinding = normalizeShortcutBinding(binding);
  if (isShortcutBindingEmpty(normalizedBinding)) {
    return false;
  }

  return (
    normalizeKey(event.key) === normalizedBinding.key &&
    modifierStateMatches(event, normalizedBinding) &&
    Boolean(event.shiftKey) === Boolean(normalizedBinding.shift) &&
    Boolean(event.altKey) === Boolean(normalizedBinding.alt)
  );
}

export function normalizeShortcutBinding(binding: ShortcutBinding | null | undefined): ShortcutBinding {
  if (!binding || typeof binding.key !== 'string') {
    return { key: '' };
  }

  return {
    key: normalizeKey(binding.key),
    meta: Boolean(binding.meta) || undefined,
    ctrl: Boolean(binding.ctrl) || undefined,
    shift: Boolean(binding.shift) || undefined,
    alt: Boolean(binding.alt) || undefined
  };
}

export function normalizeShortcutSettings(settings: Partial<ShortcutSettings> | null | undefined): ShortcutSettings {
  return SHORTCUT_ACTIONS.reduce<ShortcutSettings>((nextSettings, action) => {
    const candidate = settings?.[action];
    nextSettings[action] = candidate === null ? null : normalizePersistedBinding(candidate, DEFAULT_SHORTCUTS[action]);
    return nextSettings;
  }, { ...DEFAULT_SHORTCUTS });
}

export function bindingFromKeyboardEvent(event: KeyboardEvent | ReactKeyboardEvent): ShortcutBinding {
  return normalizeShortcutBinding({
    key: event.key,
    meta: event.metaKey,
    ctrl: event.ctrlKey,
    shift: event.shiftKey,
    alt: event.altKey
  });
}

export function formatShortcut(binding: ShortcutBinding | null, platform = getShortcutPlatform()): string {
  if (!binding) {
    return 'Not assigned';
  }

  const normalizedBinding = normalizeShortcutBinding(binding);
  if (isShortcutBindingEmpty(normalizedBinding)) {
    return 'Not assigned';
  }

  const isMac = platform === 'mac';
  const parts: string[] = [];

  if (normalizedBinding.meta) {
    parts.push(isMac ? '⌘' : 'Ctrl');
  }

  if (normalizedBinding.ctrl) {
    parts.push(isMac ? 'Ctrl' : 'Ctrl');
  }

  if (normalizedBinding.alt) {
    parts.push(isMac ? '⌥' : 'Alt');
  }

  if (normalizedBinding.shift) {
    parts.push(isMac ? '⇧' : 'Shift');
  }

  parts.push(formatKey(normalizedBinding.key, isMac));

  return isMac ? parts.join('') : parts.join('+');
}

export function isShortcutBindingEmpty(binding: ShortcutBinding | null | undefined): boolean {
  if (!binding) {
    return true;
  }

  const normalizedKey = normalizeKey(binding.key);
  return normalizedKey.length === 0 || MODIFIER_KEYS.has(normalizedKey);
}

export function areShortcutBindingsEqual(
  left: ShortcutBinding | null | undefined,
  right: ShortcutBinding | null | undefined
): boolean {
  if (!left || !right) {
    return left === right;
  }

  const normalizedLeft = normalizeShortcutBinding(left);
  const normalizedRight = normalizeShortcutBinding(right);
  const comparableLeft = getComparableBinding(normalizedLeft);
  const comparableRight = getComparableBinding(normalizedRight);

  return (
    comparableLeft.key === comparableRight.key &&
    Boolean(comparableLeft.meta) === Boolean(comparableRight.meta) &&
    Boolean(comparableLeft.ctrl) === Boolean(comparableRight.ctrl) &&
    Boolean(comparableLeft.shift) === Boolean(comparableRight.shift) &&
    Boolean(comparableLeft.alt) === Boolean(comparableRight.alt)
  );
}

export function validateShortcutBinding(
  action: ShortcutAction,
  binding: ShortcutBinding,
  settings: ShortcutSettings
): string | null {
  const normalizedBinding = normalizeShortcutBinding(binding);

  if (isShortcutBindingEmpty(normalizedBinding)) {
    return 'Press a key together with a modifier.';
  }

  if (isPlainSingleCharacterShortcut(normalizedBinding)) {
    return 'Single-letter shortcuts need Ctrl, Cmd, Alt, or Shift.';
  }

  if (isReservedShortcut(normalizedBinding)) {
    return 'That shortcut is reserved by the browser or system.';
  }

  const duplicateAction = SHORTCUT_ACTIONS.find((candidateAction) => {
    if (candidateAction === action) {
      return false;
    }

    return areShortcutBindingsEqual(settings[candidateAction], normalizedBinding);
  });

  if (duplicateAction) {
    return `That shortcut is already assigned to ${SHORTCUT_ACTION_LABELS[duplicateAction]}.`;
  }

  return null;
}

export function isReservedShortcut(binding: ShortcutBinding): boolean {
  const normalizedBinding = normalizeShortcutBinding(binding);
  const hasPrimary = Boolean(normalizedBinding.meta || normalizedBinding.ctrl);
  const key = normalizedBinding.key;

  if (key === 'f5') {
    return true;
  }

  if (!hasPrimary) {
    return false;
  }

  if (key === 'tab') {
    return true;
  }

  if (key === 't' && Boolean(normalizedBinding.shift)) {
    return true;
  }

  return ['n', 't', 'w', 'r', 'l'].includes(key) && !normalizedBinding.shift && !normalizedBinding.alt;
}

function normalizePersistedBinding(
  binding: ShortcutBinding | null | undefined,
  fallback: ShortcutBinding | null
): ShortcutBinding | null {
  if (binding === null) {
    return null;
  }

  const normalizedBinding = normalizeShortcutBinding(binding);
  if (isShortcutBindingEmpty(normalizedBinding)) {
    return fallback ? normalizeShortcutBinding(fallback) : null;
  }

  return normalizedBinding;
}

function modifierStateMatches(event: KeyboardEvent, binding: ShortcutBinding): boolean {
  const platform = getShortcutPlatform();
  const expectsMeta = Boolean(binding.meta);
  const expectsCtrl = Boolean(binding.ctrl);

  if (platform !== 'mac' && expectsMeta) {
    return !event.metaKey && event.ctrlKey === true;
  }

  return event.metaKey === expectsMeta && event.ctrlKey === expectsCtrl;
}

function getComparableBinding(binding: ShortcutBinding): ShortcutBinding {
  if (getShortcutPlatform() === 'mac') {
    return binding;
  }

  return {
    ...binding,
    meta: undefined,
    ctrl: Boolean(binding.meta || binding.ctrl) || undefined
  };
}

function isPlainSingleCharacterShortcut(binding: ShortcutBinding): boolean {
  return (
    binding.key.length === 1 &&
    !binding.meta &&
    !binding.ctrl &&
    !binding.shift &&
    !binding.alt
  );
}

function normalizeKey(key: string): string {
  if (key === ' ') {
    return 'space';
  }

  const normalizedKey = key.trim().toLowerCase();

  if (normalizedKey === 'esc') {
    return 'escape';
  }

  if (normalizedKey === 'left') {
    return 'arrowleft';
  }

  return normalizedKey;
}

function formatKey(key: string, isMac: boolean): string {
  if (key.length === 1) {
    return key.toUpperCase();
  }

  if (key === 'arrowleft') {
    return isMac ? '←' : 'Left';
  }

  if (key === 'arrowright') {
    return isMac ? '→' : 'Right';
  }

  if (key === 'arrowup') {
    return isMac ? '↑' : 'Up';
  }

  if (key === 'arrowdown') {
    return isMac ? '↓' : 'Down';
  }

  if (key === 'space') {
    return 'Space';
  }

  if (FUNCTION_KEY_PATTERN.test(key)) {
    return key.toUpperCase();
  }

  return key
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getShortcutPlatform(): 'mac' | 'other' {
  if (typeof navigator === 'undefined') {
    return 'other';
  }

  return /mac|iphone|ipad|ipod/i.test(navigator.platform) ? 'mac' : 'other';
}
