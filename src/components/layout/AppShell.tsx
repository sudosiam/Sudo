import * as React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Menu, ChevronLeft, Moon, Sun, MonitorSmartphone, Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react';
import { usePowerSync, useStatus } from '@powersync/react';
import { useAutoBackup } from '../../hooks/useAutoBackup';
import { NAV_ITEMS } from './nav';
import { MonthFilter, pathnameUsesMonthFilter } from './MonthFilter';
import { CreateShortcutsFab } from './CreateShortcutsFab';
import { PageTitleProvider, isSubpage, subpageBackPath, usePageTitleContext } from './pageTitle';
import { PageTransition } from './PageTransition';
import { useTheme } from '../../stores/ui';
import { cn } from '../../lib/utils';
import { haptic } from '../../lib/haptics';
import { cloudConfigured } from '../../system/supabase';
import { formatSyncSchemaError } from '../../lib/syncErrors';
import { useUploadQueue } from '../../hooks/useUploadQueue';

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : MonitorSmartphone;
  return (
    <button
      className="rounded-xl border border-transparent p-2 text-muted-foreground transition-[color,background-color,border-color,transform] duration-150 ease-out hover:border-border hover:bg-accent/70 hover:text-foreground"
      onClick={() => {
        haptic();
        setTheme(next);
      }}
      title={`Theme: ${theme} (tap to change)`}
    >
      <Icon className="size-4" />
    </button>
  );
}

function SyncIndicator() {
  const db = usePowerSync();
  const status = useStatus();
  const { stats } = useUploadQueue(db, {
    enabled: cloudConfigured && status.connected,
    pollMs: 2000,
    previewLimit: 0,
  });

  const online = status.connected;
  const uploadError = status.dataFlowStatus.uploadError;
  const downloadError = status.dataFlowStatus.downloadError;
  const syncError = uploadError ?? downloadError;
  const active = status.dataFlowStatus.downloading || status.dataFlowStatus.uploading;
  const pending = stats.count;

  if (!cloudConfigured) return null;

  const syncing = active || (pending > 0 && !syncError);
  const errorText = syncError ? formatSyncSchemaError(syncError.message) : null;

  let label = 'Offline';
  if (online) {
    if (syncError) label = 'Sync error';
    else if (syncing) label = pending > 0 ? `Syncing (${pending})` : 'Syncing';
    else label = 'Synced';
  }

  return (
    <div
      className={cn(
        'flex max-w-[11rem] items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[11px] font-medium',
        syncError
          ? 'border-destructive/30 bg-destructive/10 text-destructive'
          : online
            ? 'border-success/30 bg-success/10 text-success'
            : 'border-border bg-card/65 text-muted-foreground',
      )}
      title={errorText ?? (online ? 'Cloud sync status' : 'Offline — changes saved locally')}
    >
      {syncError ? (
        <AlertCircle className="size-3.5 shrink-0" />
      ) : syncing ? (
        <RefreshCw className="size-3.5 shrink-0 animate-spin" />
      ) : online ? (
        <Wifi className="size-3.5 shrink-0" />
      ) : (
        <WifiOff className="size-3.5 shrink-0" />
      )}
      <span className="hidden truncate sm:inline">{label}</span>
    </div>
  );
}

function SidebarLink({ to, label, icon: Icon, onNavigate }: (typeof NAV_ITEMS)[number] & { onNavigate?: () => void }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={() => {
        haptic();
        onNavigate?.();
      }}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-[color,background-color,transform] duration-150 ease-out',
          isActive
            ? 'bg-primary/12 text-primary shadow-sm'
            : 'text-muted-foreground hover:bg-accent/75 hover:text-foreground',
        )
      }
    >
      <Icon className="size-4 shrink-0 transition-transform group-hover:scale-105" />
      {label}
    </NavLink>
  );
}

function AppHeaderTitle() {
  const location = useLocation();
  const { pageTitle } = usePageTitleContext();
  const subpage = isSubpage(location.pathname);

  const activeNavLabel = React.useMemo(() => {
    const active = NAV_ITEMS.find((item) =>
      item.to === '/'
        ? location.pathname === '/'
        : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`),
    );
    return active?.label ?? 'Sudo';
  }, [location.pathname]);

  const mainLabel = subpage && pageTitle.title != null ? pageTitle.title : activeNavLabel;

  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Sudo</p>
      <p className="truncate text-sm font-semibold tracking-tight sm:text-base">{mainLabel}</p>
      {subpage && pageTitle.subtitle != null && (
        <p className="truncate text-[11px] text-muted-foreground">{pageTitle.subtitle}</p>
      )}
    </div>
  );
}

function AppHeaderLeading({ onOpenMenu }: { onOpenMenu: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { pageTitle } = usePageTitleContext();
  const subpage = isSubpage(location.pathname);
  const backTo = pageTitle.backTo ?? (subpage ? subpageBackPath(location.pathname) : null);
  const showBack = subpage && !!backTo;

  return (
    <button
      className="rounded-xl border border-transparent p-2 text-muted-foreground transition-[color,background-color,border-color] duration-150 ease-out hover:border-border hover:bg-accent/80 hover:text-foreground lg:hidden"
      onClick={() => {
        haptic();
        if (showBack) navigate(backTo);
        else onOpenMenu();
      }}
      aria-label={showBack ? 'Go back' : 'Open menu'}
      type="button"
    >
      {showBack ? <ChevronLeft className="size-5" /> : <Menu className="size-5" />}
    </button>
  );
}

export function AppShell() {
  const db = usePowerSync();
  useAutoBackup(db);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const location = useLocation();
  const showMonthFilter = pathnameUsesMonthFilter(location.pathname);

  React.useEffect(() => setDrawerOpen(false), [location.pathname]);

  const sidebar = (
    <nav className="flex h-full flex-col gap-0.5 p-3">
      <div className="mb-3 flex items-center gap-2 rounded-xl px-3 py-2.5">
        <img src="/icon-192.png" alt="" className="size-9 rounded-xl ring-1 ring-border" />
        <div>
          <p className="text-sm font-semibold leading-tight tracking-tight">Sudo</p>
          <p className="text-[11px] leading-tight text-muted-foreground">Business Finance</p>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto scroll-touch">
        {NAV_ITEMS.map((item) => (
          <SidebarLink key={item.to} {...item} onNavigate={() => setDrawerOpen(false)} />
        ))}
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 border-r bg-background/50 px-3 py-3 lg:block">
        <div className="app-surface h-full overflow-hidden">{sidebar}</div>
      </aside>

      {/* Mobile drawer */}
      <div
        className={cn(
          'fixed inset-0 z-50 lg:hidden',
          drawerOpen ? 'pointer-events-auto' : 'pointer-events-none',
        )}
      >
        <div
          className={cn(
            'absolute inset-0 bg-black/50 transition-opacity duration-300 ease-out lg:bg-black/45 lg:backdrop-blur-[1px]',
            drawerOpen ? 'opacity-100' : 'opacity-0',
          )}
          onClick={() => setDrawerOpen(false)}
        />
        <aside
          className={cn(
            'gpu-layer absolute inset-y-0 left-0 w-[85vw] max-w-[19rem] border-r bg-background px-3 py-3 shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform',
            drawerOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="app-surface h-full overflow-hidden">
            {sidebar}
          </div>
        </aside>
      </div>

      <PageTitleProvider>
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Header */}
          <header className="sticky top-0 z-40 border-b bg-background/92 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 lg:bg-background/75 lg:backdrop-blur-xl">
            <div className="mx-auto flex w-full max-w-[1200px] items-center gap-2 px-3 py-2 sm:px-5">
              <div className="flex min-w-0 items-center gap-2">
                <AppHeaderLeading onOpenMenu={() => setDrawerOpen(true)} />
                <AppHeaderTitle />
              </div>
              <div className="ml-auto flex items-center justify-end gap-1.5">
                {showMonthFilter && <MonthFilter />}
                <SyncIndicator />
                <ThemeToggle />
              </div>
            </div>
          </header>

          {/* Page content */}
          <main className="mx-auto w-full max-w-[1200px] flex-1 scroll-touch px-3 pb-20 pt-4 sm:px-5 sm:pt-5 lg:pb-10">
            <PageTransition />
          </main>
          <CreateShortcutsFab />
        </div>
      </PageTitleProvider>
    </div>
  );
}
