import * as React from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Menu, ChevronLeft, Moon, Sun, MonitorSmartphone, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useStatus } from '@powersync/react';
import { NAV_ITEMS } from './nav';
import { MonthFilter, pathnameUsesMonthFilter } from './MonthFilter';
import { CreateShortcutsFab } from './CreateShortcutsFab';
import { PageTitleProvider, isSubpage, subpageBackPath, usePageTitleContext } from './pageTitle';
import { useTheme } from '../../stores/ui';
import { cn } from '../../lib/utils';
import { haptic } from '../../lib/haptics';

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : MonitorSmartphone;
  return (
    <button
      className="rounded-xl border border-transparent p-2 text-muted-foreground transition-all hover:border-border hover:bg-accent/70 hover:text-foreground"
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
  const status = useStatus();
  const online = status.connected;
  const syncing = status.dataFlowStatus.downloading || status.dataFlowStatus.uploading;
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[11px] font-medium',
        online
          ? 'border-success/30 bg-success/10 text-success'
          : 'border-border bg-card/65 text-muted-foreground',
      )}
      title={online ? 'Synced with cloud' : 'Offline — changes saved locally'}
    >
      {syncing ? (
        <RefreshCw className="size-3.5 animate-spin" />
      ) : online ? (
        <Wifi className="size-3.5" />
      ) : (
        <WifiOff className="size-3.5" />
      )}
      <span className="hidden sm:inline">{syncing ? 'Syncing' : online ? 'Synced' : 'Offline'}</span>
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
          'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
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
      className="rounded-xl border border-transparent p-2 text-muted-foreground transition-all hover:border-border hover:bg-accent/80 hover:text-foreground lg:hidden"
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
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
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
            'absolute inset-0 bg-black/45 backdrop-blur-[1px] transition-opacity',
            drawerOpen ? 'opacity-100' : 'opacity-0',
          )}
          onClick={() => setDrawerOpen(false)}
        />
        <aside
          className={cn(
            'absolute inset-y-0 left-0 w-[85vw] max-w-[19rem] border-r bg-background px-3 py-3 shadow-2xl transition-transform',
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
          <header className="sticky top-0 z-40 border-b bg-background/75 backdrop-blur-xl">
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
          <main className="mx-auto w-full max-w-[1200px] flex-1 px-3 pb-20 pt-4 sm:px-5 sm:pt-5 lg:pb-10">
            <Outlet />
          </main>
          <CreateShortcutsFab />
        </div>
      </PageTitleProvider>
    </div>
  );
}
