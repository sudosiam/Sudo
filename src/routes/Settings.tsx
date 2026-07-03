import * as React from 'react';
import { usePowerSync, useStatus } from '@powersync/react';
import { Download, LogOut, Vibrate, Sun, Moon, MonitorSmartphone, CloudOff, Cloud } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { getSetting, setSetting, SETTING_DEFAULTS } from '../domain/settings';
import { useTheme } from '../stores/ui';
import { hapticsEnabled, setHapticsEnabled, haptic } from '../lib/haptics';
import { useAuth } from '../system/SystemProvider';
import { cloudConfigured } from '../system/supabase';
import { cn } from '../lib/utils';
import { APP_VERSION } from '../lib/version';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="app-surface p-4">
      <h2 className="page-section-title">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export default function Settings() {
  const db = usePowerSync();
  const status = useStatus();
  const { session, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [haptics, setHaptics] = React.useState(hapticsEnabled());
  const [savedFlash, setSavedFlash] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      const out: Record<string, string> = {};
      for (const key of Object.keys(SETTING_DEFAULTS)) {
        out[key] = await getSetting(db, key);
      }
      setValues(out);
    })();
  }, [db]);

  const saveField = async (key: string) => {
    await setSetting(db, key, values[key] ?? '');
    haptic('success');
    setSavedFlash(key);
    setTimeout(() => setSavedFlash(null), 1200);
  };

  const exportData = async () => {
    haptic();
    const tables = [
      'parties', 'item_categories', 'items', 'accounts', 'journal_entries', 'journal_lines',
      'sales', 'sale_items', 'purchases', 'purchase_items', 'payments', 'payment_allocations',
      'expenses', 'recurring_expenses', 'other_incomes', 'fixed_assets', 'app_settings',
    ];
    const dump: Record<string, unknown[]> = {};
    for (const t of tables) {
      dump[t] = await db.getAll(`SELECT * FROM ${t}`);
    }
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sudo-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    haptic('success');
  };

  const themeOptions = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: MonitorSmartphone },
  ] as const;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Settings" />

      <Section title="Business">
        {(['business_name', 'invoice_prefix', 'purchase_prefix'] as const).map((key) => (
          <div key={key} className="space-y-1.5">
            <Label>
              {key === 'business_name' ? 'Business name (used on PDF statements)' : key === 'invoice_prefix' ? 'Sale invoice prefix' : 'Purchase bill prefix'}
            </Label>
            <div className="flex gap-2">
              <Input
                value={values[key] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
              />
              <Button variant="outline" size="sm" className="h-9" onClick={() => saveField(key)}>
                {savedFlash === key ? 'Saved ✓' : 'Save'}
              </Button>
            </div>
          </div>
        ))}
      </Section>

      <Section title="Appearance">
        <div className="grid grid-cols-3 gap-2">
          {themeOptions.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-semibold transition-colors',
                theme === value ? 'border-primary bg-primary/5 text-primary' : 'hover:bg-accent',
              )}
              onClick={() => {
                haptic();
                setTheme(value);
              }}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>
        <button
          className="flex w-full items-center justify-between rounded-lg border p-3 text-sm hover:bg-accent"
          onClick={() => {
            const next = !haptics;
            setHapticsEnabled(next);
            setHaptics(next);
            if (next) haptic('success');
          }}
        >
          <span className="flex items-center gap-2">
            <Vibrate className="size-4 text-muted-foreground" /> Haptic feedback
          </span>
          <span
            className={cn(
              'relative h-5 w-9 rounded-full transition-colors',
              haptics ? 'bg-primary' : 'bg-muted',
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 size-4 rounded-full bg-white shadow transition-all',
                haptics ? 'left-4.5' : 'left-0.5',
              )}
            />
          </span>
        </button>
      </Section>

      <Section title="Cloud sync">
        {!cloudConfigured ? (
          <div className="flex items-start gap-3 rounded-lg border border-dashed p-3 text-sm">
            <CloudOff className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-medium">Not connected</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Your data is stored locally on this device. Follow <code>SETUP.md</code> in the project
                folder to connect Supabase + PowerSync for login and real-time multi-device sync.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 rounded-lg border p-3 text-sm">
              <Cloud className={cn('size-4', status.connected ? 'text-success' : 'text-muted-foreground')} />
              <div className="flex-1">
                <p className="font-medium">
                  {status.connecting
                    ? 'Connecting…'
                    : status.connected
                      ? 'Connected (WebSocket live)'
                      : 'Not connected to PowerSync'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {session?.user?.email}
                  {status.hasSynced === false && status.connected ? ' · waiting for first sync' : ''}
                  {status.lastSyncedAt ? ` · last synced ${status.lastSyncedAt.toLocaleTimeString()}` : ''}
                </p>
                {(status.dataFlowStatus.downloadError || status.dataFlowStatus.uploadError) && (
                  <p className="mt-1 text-xs text-destructive">
                    {status.dataFlowStatus.downloadError?.message ??
                      status.dataFlowStatus.uploadError?.message}
                  </p>
                )}
              </div>
            </div>
            <Button variant="outline" onClick={() => { haptic(); void signOut(); }}>
              <LogOut /> Sign out
            </Button>
          </>
        )}
      </Section>

      <Section title="Data">
        <Button variant="outline" onClick={exportData}>
          <Download /> Export all data (JSON)
        </Button>
        <p className="text-xs text-muted-foreground">
          Full local backup of every table. Amounts are integer paise.
        </p>
      </Section>

      <p className="pb-4 text-center text-[11px] text-muted-foreground">
        Sudo · offline-first business finance · v{APP_VERSION}
      </p>
    </div>
  );
}
