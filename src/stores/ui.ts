import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { currentMonthKey, type MonthKey } from '../lib/dates';

/**
 * Global month filter shared by lists, KPIs and reports.
 * mode 'month' filters to the selected month; 'all' shows everything.
 */
interface MonthFilterState {
  mode: 'month' | 'all';
  month: MonthKey;
  setMonth: (m: MonthKey) => void;
  setMode: (mode: 'month' | 'all') => void;
  reset: () => void;
}

export const useMonthFilter = create<MonthFilterState>()((set) => ({
  mode: 'month',
  month: currentMonthKey(),
  setMonth: (month) => set({ month, mode: 'month' }),
  setMode: (mode) => set({ mode }),
  reset: () => set({ mode: 'month', month: currentMonthKey() }),
}));

/** Returns SQL date-range condition parts for the active filter */
export function monthFilterRange(state: { mode: 'month' | 'all'; month: MonthKey }): {
  start: string;
  end: string;
} | null {
  if (state.mode === 'all') return null;
  const [y, m] = state.month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return { start: `${state.month}-01`, end: `${state.month}-${String(last).padStart(2, '0')}` };
}

type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

function applyTheme(theme: Theme) {
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#16181f' : '#fafafa');
}

export const useTheme = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'system' as Theme,
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
    }),
    {
      name: 'sudo-theme',
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme);
      },
    },
  ),
);

// Apply on first load (before rehydrate finishes there may be a flash; index.html script handles it)
if (typeof window !== 'undefined') {
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => applyTheme(useTheme.getState().theme));
}
