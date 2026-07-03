/** Lightweight haptic feedback wrapper. No-ops silently where unsupported. */

type HapticKind = 'tap' | 'success' | 'warning' | 'error';

const PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 8,
  success: [10, 40, 18],
  warning: [16, 60, 16],
  error: [40, 60, 40],
};

export function hapticsEnabled(): boolean {
  try {
    return localStorage.getItem('sudo-haptics') !== '0';
  } catch {
    return true;
  }
}

export function setHapticsEnabled(enabled: boolean) {
  try {
    localStorage.setItem('sudo-haptics', enabled ? '1' : '0');
  } catch {
    // ignore
  }
}

export function haptic(kind: HapticKind = 'tap') {
  try {
    if (hapticsEnabled() && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(PATTERNS[kind]);
    }
  } catch {
    // ignore
  }
}
