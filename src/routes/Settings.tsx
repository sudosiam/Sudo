import * as React from 'react';
import { usePowerSync, useStatus } from '@powersync/react';
import {
  Download,
  Upload,
  LogOut,
  Vibrate,
  Sun,
  Moon,
  MonitorSmartphone,
  CloudOff,
  Cloud,
  FolderOpen,
  Trash2,
  AlertTriangle,
  FlaskConical,
  ListOrdered,
  RefreshCw,
} from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog } from '../components/ui/dialog';
import { getSetting, setSetting, SETTING_DEFAULTS } from '../domain/settings';
import {
  exportAndDownload,
  importBackup,
  factoryReset,
  FACTORY_RESET_PHRASE,
  preResetBackupFilename,
} from '../domain/backup';
import {
  clearBackupFolder,
  getStoredFolderName,
  isFolderBackupSupported,
  pickBackupFolder,
} from '../lib/backupFolder';
import { useTheme } from '../stores/ui';
import { hapticsEnabled, setHapticsEnabled, haptic } from '../lib/haptics';
import { useAuth } from '../system/SystemProvider';
import { cloudConfigured } from '../system/supabase';
import { forceReconnectSync } from '../system/syncLifecycle';
import { cn } from '../lib/utils';
import { formatSyncSchemaError } from '../lib/syncErrors';
import { clearUploadQueue, formatQueueSize } from '../lib/syncQueue';
import { useUploadQueue } from '../hooks/useUploadQueue';
import { APP_VERSION } from '../lib/version';
import {
  generateMockData,
  MOCK_DATA_PRESETS,
  type MockDataProgress,
  type MockDataScale,
} from '../domain/mockData';

function SettingGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="page-section-title mb-2 px-1">{title}</h2>
      <div className="app-surface overflow-hidden">{children}</div>
    </div>
  );
}

function Switch({ checked }: { checked: boolean }) {
  return (
    <span
      className={cn(
        'relative h-5 w-9 shrink-0 rounded-full transition-colors',
        checked ? 'bg-primary' : 'bg-muted',
      )}
      aria-hidden
    >
      <span
        className={cn(
          'absolute top-0.5 size-4 rounded-full bg-white shadow transition-all',
          checked ? 'left-[1.125rem]' : 'left-0.5',
        )}
      />
    </span>
  );
}

function ToggleRow({
  label,
  detail,
  icon: Icon,
  checked,
  onChange,
}: {
  label: string;
  detail?: string;
  icon: React.ComponentType<{ className?: string }>;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 border-b px-3.5 py-3 text-left transition-colors last:border-b-0 hover:bg-accent/45 touch-manipulation"
      onClick={() => {
        haptic();
        onChange(!checked);
      }}
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        {detail && <span className="mt-0.5 block text-xs text-muted-foreground">{detail}</span>}
      </span>
      <Switch checked={checked} />
    </button>
  );
}

function ActionRow({
  label,
  detail,
  icon: Icon,
  onClick,
  disabled,
  destructive,
  trailing,
}: {
  label: string;
  detail?: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        'flex w-full items-center gap-3 border-b px-3.5 py-3 text-left transition-colors last:border-b-0 hover:bg-accent/45 disabled:opacity-50 touch-manipulation',
        destructive && 'text-destructive',
      )}
      onClick={() => {
        haptic();
        onClick();
      }}
    >
      <Icon className={cn('size-4 shrink-0', destructive ? 'text-destructive/70' : 'text-muted-foreground')} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        {detail && (
          <span className={cn('mt-0.5 block text-xs', destructive ? 'text-destructive/70' : 'text-muted-foreground')}>
            {detail}
          </span>
        )}
      </span>
      {trailing}
    </button>
  );
}

function InlineLink({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
      onClick={() => {
        haptic();
        onClick();
      }}
    >
      {children}
    </button>
  );
}

function StatusBanner({ type, text }: { type: 'ok' | 'err'; text: string }) {
  return (
    <p
      className={cn(
        'border-b px-3.5 py-2.5 text-xs',
        type === 'ok'
          ? 'border-success/20 bg-success/5 text-success'
          : 'border-destructive/20 bg-destructive/5 text-destructive',
      )}
    >
      {text}
    </p>
  );
}

const BUSINESS_FIELDS = [
  { key: 'business_name' as const, label: 'Business name', hint: 'Shown on PDF statements' },
  { key: 'invoice_prefix' as const, label: 'Invoice prefix', hint: 'e.g. INV-001' },
  { key: 'purchase_prefix' as const, label: 'Bill prefix', hint: 'e.g. PUR-001' },
];

export default function Settings() {
  const db = usePowerSync();
  const status = useStatus();
  const { session, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const importRef = React.useRef<HTMLInputElement>(null);
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [haptics, setHaptics] = React.useState(hapticsEnabled());
  const [savedFlash, setSavedFlash] = React.useState<string | null>(null);
  const [folderName, setFolderName] = React.useState<string | null>(() => getStoredFolderName());
  const [busy, setBusy] = React.useState<string | null>(null);
  const [dataMessage, setDataMessage] = React.useState<{ type: 'ok' | 'err'; text: string } | null>(
    null,
  );
  const [importConfirmOpen, setImportConfirmOpen] = React.useState(false);
  const [pendingImport, setPendingImport] = React.useState<unknown>(null);
  const [resetOpen, setResetOpen] = React.useState(false);
  const [resetPhrase, setResetPhrase] = React.useState('');
  const [mockOpen, setMockOpen] = React.useState(false);
  const [mockScale, setMockScale] = React.useState<MockDataScale>('large');
  const [mockResetFirst, setMockResetFirst] = React.useState(true);
  const [mockProgress, setMockProgress] = React.useState<MockDataProgress | null>(null);
  const [clearQueueOpen, setClearQueueOpen] = React.useState(false);
  const { stats: queueStats, items: queueItems, refresh: refreshQueue } = useUploadQueue(db, {
    enabled: cloudConfigured,
  });

  React.useEffect(() => {
    (async () => {
      const out: Record<string, string> = {};
      for (const key of Object.keys(SETTING_DEFAULTS)) {
        out[key] = await getSetting(db, key);
      }
      setValues(out);
    })();
  }, [db]);

  const flashDataMessage = (type: 'ok' | 'err', text: string) => {
    setDataMessage({ type, text });
    setTimeout(() => setDataMessage(null), 4000);
  };

  const saveField = async (key: string) => {
    await setSetting(db, key, values[key] ?? '');
    haptic('success');
    setSavedFlash(key);
    setTimeout(() => setSavedFlash(null), 1200);
  };

  const saveToggle = async (key: string, on: boolean) => {
    const v = on ? '1' : '0';
    setValues((prev) => ({ ...prev, [key]: v }));
    await setSetting(db, key, v);
    haptic('success');
  };

  const handleExport = async () => {
    setBusy('export');
    try {
      await exportAndDownload(db);
      haptic('success');
      flashDataMessage('ok', 'Backup downloaded.');
    } catch (e) {
      flashDataMessage('err', e instanceof Error ? e.message : 'Export failed.');
    } finally {
      setBusy(null);
    }
  };

  const handleImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        setPendingImport(parsed);
        setImportConfirmOpen(true);
      } catch {
        flashDataMessage('err', 'Invalid backup file.');
      }
    };
    reader.readAsText(file);
  };

  const confirmImport = async () => {
    if (!pendingImport) return;
    setBusy('import');
    try {
      await importBackup(db, pendingImport);
      haptic('success');
      setImportConfirmOpen(false);
      setPendingImport(null);
      window.location.reload();
    } catch (e) {
      flashDataMessage('err', e instanceof Error ? e.message : 'Import failed.');
    } finally {
      setBusy(null);
    }
  };

  const handleAutoBackupToggle = async (on: boolean) => {
    if (on) {
      if (!isFolderBackupSupported()) {
        flashDataMessage('err', 'Folder backup requires Chrome or Edge.');
        return;
      }
      setBusy('folder');
      try {
        const name = await pickBackupFolder();
        if (!name) return;
        setFolderName(name);
        await saveToggle('auto_backup_enabled', true);
        flashDataMessage('ok', `Daily backups enabled for "${name}".`);
      } catch (e) {
        flashDataMessage('err', e instanceof Error ? e.message : 'Could not access folder.');
      } finally {
        setBusy(null);
      }
    } else {
      await saveToggle('auto_backup_enabled', false);
    }
  };

  const handleChangeFolder = async () => {
    setBusy('folder');
    try {
      const name = await pickBackupFolder();
      if (name) {
        setFolderName(name);
        flashDataMessage('ok', `Folder set to "${name}".`);
      }
    } catch (e) {
      flashDataMessage('err', e instanceof Error ? e.message : 'Could not access folder.');
    } finally {
      setBusy(null);
    }
  };

  const handleClearFolder = async () => {
    await clearBackupFolder();
    setFolderName(null);
    await saveToggle('auto_backup_enabled', false);
    flashDataMessage('ok', 'Auto-backup disabled.');
  };

  const mockTotalRecords = (scale: MockDataScale) => {
    const p = MOCK_DATA_PRESETS[scale];
    return p.parties + p.items + p.sales + p.purchases + p.expenses + p.payments;
  };

  const confirmClearQueue = async () => {
    setBusy('clear-queue');
    try {
      const cleared = await clearUploadQueue(db);
      haptic('success');
      setClearQueueOpen(false);
      await refreshQueue();
      flashDataMessage(
        'ok',
        cleared > 0 ? `Cleared ${cleared} pending upload${cleared === 1 ? '' : 's'}.` : 'Upload queue was already empty.',
      );
    } catch (e) {
      flashDataMessage('err', e instanceof Error ? e.message : 'Could not clear upload queue.');
    } finally {
      setBusy(null);
    }
  };

  const confirmMockLoad = async () => {
    if (!import.meta.env.DEV) return;
    setBusy('mock');
    setMockProgress({ phase: 'Starting…', done: 0, total: 1 });
    try {
      const result = await generateMockData(db, mockScale, {
        resetFirst: mockResetFirst,
        onProgress: setMockProgress,
      });
      haptic('success');
      setMockOpen(false);
      flashDataMessage(
        'ok',
        `Loaded ${mockTotalRecords(mockScale)} records in ${(result.elapsedMs / 1000).toFixed(1)}s.`,
      );
      window.location.reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Mock data load failed.';
      flashDataMessage('err', formatSyncSchemaError(msg));
    } finally {
      setBusy(null);
      setMockProgress(null);
    }
  };

  const handleReconnectSync = async () => {
    setBusy('reconnect');
    try {
      await forceReconnectSync();
      haptic('success');
      flashDataMessage('ok', 'Reconnecting to PowerSync…');
    } catch (e) {
      flashDataMessage('err', formatSyncSchemaError(e instanceof Error ? e.message : 'Reconnect failed.'));
    } finally {
      setBusy(null);
    }
  };

  const confirmFactoryReset = async () => {
    setBusy('reset');
    try {
      await exportAndDownload(db, preResetBackupFilename());
      await factoryReset(db);
      haptic('success');
      setResetOpen(false);
      setResetPhrase('');
      window.location.reload();
    } catch (e) {
      flashDataMessage('err', e instanceof Error ? e.message : 'Reset failed.');
    } finally {
      setBusy(null);
    }
  };

  const themeOptions = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: MonitorSmartphone },
  ] as const;

  const autoBackupOn = values.auto_backup_enabled === '1';
  const lastBackup = values.auto_backup_last_date;
  const folderSupported = isFolderBackupSupported();

  const autoBackupDetail = !folderSupported
    ? 'Not available in this browser'
    : autoBackupOn && folderName
      ? folderName
      : 'Save a JSON backup to a folder once per day';

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-4">
      <PageHeader title="Settings" />

      <SettingGroup title="Business">
        <div className="divide-y">
          {BUSINESS_FIELDS.map(({ key, label, hint }) => (
            <div key={key} className="space-y-2 px-3.5 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor={key} className="text-sm font-medium">
                  {label}
                </Label>
                <span className="text-[11px] text-muted-foreground">{hint}</span>
              </div>
              <div className="flex gap-2">
                <Input
                  id={key}
                  value={values[key] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                />
                <Button variant="outline" size="sm" className="h-9 shrink-0 px-3" onClick={() => saveField(key)}>
                  {savedFlash === key ? 'Saved' : 'Save'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </SettingGroup>

      <SettingGroup title="Appearance">
        <div className="grid grid-cols-3 gap-px border-b bg-border p-px">
          {themeOptions.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              className={cn(
                'flex flex-col items-center gap-1.5 bg-card py-3 text-xs font-semibold transition-colors',
                theme === value ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
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
        <ToggleRow
          icon={Vibrate}
          label="Haptic feedback"
          checked={haptics}
          onChange={(next) => {
            setHapticsEnabled(next);
            setHaptics(next);
            if (next) haptic('success');
          }}
        />
      </SettingGroup>

      <SettingGroup title="Cloud sync">
        {!cloudConfigured ? (
          <div className="flex items-start gap-3 px-3.5 py-3.5 text-sm">
            <CloudOff className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-medium">Offline only</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                Data stays on this device. See <code className="text-[11px]">SETUP.md</code> to connect
                Supabase + PowerSync.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b px-3.5 py-3.5 text-sm">
              <Cloud className={cn('size-4 shrink-0', status.connected ? 'text-success' : 'text-muted-foreground')} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {status.connecting ? 'Connecting…' : status.connected ? 'Connected' : 'Disconnected'}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {session?.user?.email}
                  {status.lastSyncedAt ? ` · ${status.lastSyncedAt.toLocaleTimeString()}` : ''}
                </p>
                {(status.dataFlowStatus.downloadError || status.dataFlowStatus.uploadError) && (
                  <p className="mt-1 whitespace-pre-wrap text-xs text-destructive">
                    {formatSyncSchemaError(
                      status.dataFlowStatus.downloadError?.message ??
                        status.dataFlowStatus.uploadError?.message ??
                        '',
                    )}
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 shrink-0 text-xs"
                disabled={busy === 'reconnect'}
                onClick={() => void handleReconnectSync()}
                title="Reconnect to PowerSync"
              >
                <RefreshCw className={cn('size-3.5', busy === 'reconnect' && 'animate-spin')} />
              </Button>
            </div>

            <div className="border-b px-3.5 py-3 text-sm">
              <div className="flex items-start gap-3">
                <ListOrdered className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">Upload queue</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {queueStats.count === 0
                      ? 'Nothing waiting to upload'
                      : `${queueStats.count} pending · ${formatQueueSize(queueStats.size)}`}
                  </p>
                  {queueItems.length > 0 && (
                    <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto rounded-lg border bg-muted/30 px-2.5 py-2 font-mono text-[10px] text-muted-foreground">
                      {queueItems.map((item, i) => (
                        <li key={`${item.table}-${item.id}-${i}`} className="truncate">
                          <span className="text-foreground/80">{item.op}</span> {item.table}{' '}
                          <span className="opacity-70">{item.id}</span>
                        </li>
                      ))}
                      {queueStats.count > queueItems.length && (
                        <li className="pt-0.5 text-[10px] italic opacity-70">
                          +{queueStats.count - queueItems.length} more…
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              </div>
              {queueStats.count > 0 && (
                <div className="mt-3 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    disabled={busy === 'clear-queue'}
                    onClick={() => setClearQueueOpen(true)}
                  >
                    Clear queue
                  </Button>
                </div>
              )}
            </div>

            <ActionRow icon={LogOut} label="Sign out" onClick={() => void signOut()} />
          </>
        )}
      </SettingGroup>

      <SettingGroup title="Backup & restore">
        {dataMessage && <StatusBanner type={dataMessage.type} text={dataMessage.text} />}

        <ActionRow
          icon={Download}
          label="Export backup"
          detail="Download all data as JSON"
          onClick={() => void handleExport()}
          disabled={busy === 'export'}
          trailing={
            busy === 'export' ? (
              <span className="text-xs text-muted-foreground">…</span>
            ) : (
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                JSON
              </span>
            )
          }
        />
        <ActionRow
          icon={Upload}
          label="Import backup"
          detail="Replace all local data from a file"
          onClick={() => importRef.current?.click()}
          disabled={busy === 'import'}
        />
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImportFile(file);
            e.target.value = '';
          }}
        />

        <ToggleRow
          icon={FolderOpen}
          label="Daily auto-backup"
          detail={autoBackupDetail}
          checked={autoBackupOn}
          onChange={(on) => void handleAutoBackupToggle(on)}
        />

        {autoBackupOn && folderName && (
          <div className="flex items-center justify-between gap-3 border-b px-3.5 py-2.5 last:border-b-0">
            <p className="text-xs text-muted-foreground">
              {lastBackup ? `Last backup ${lastBackup}` : 'No backup yet today'}
            </p>
            <div className="flex items-center gap-2">
              <InlineLink onClick={() => void handleChangeFolder()} disabled={busy === 'folder'}>
                Change
              </InlineLink>
              <span className="text-muted-foreground/40">·</span>
              <InlineLink onClick={() => void handleClearFolder()}>Remove</InlineLink>
            </div>
          </div>
        )}
      </SettingGroup>

      {import.meta.env.DEV && (
        <SettingGroup title="Load test data">
          <ActionRow
            icon={FlaskConical}
            label="Generate mock data"
            detail="Parties, inventory, sales, purchases, expenses & payments"
            onClick={() => setMockOpen(true)}
            disabled={busy === 'mock'}
          />
        </SettingGroup>
      )}

      <SettingGroup title="Danger zone">
        <ActionRow
          icon={Trash2}
          label="Factory reset"
          detail="Downloads a backup, then wipes all data"
          onClick={() => {
            setResetPhrase('');
            setResetOpen(true);
          }}
          destructive
        />
      </SettingGroup>

      <Dialog
        open={importConfirmOpen}
        onClose={() => {
          setImportConfirmOpen(false);
          setPendingImport(null);
        }}
        title="Import backup?"
        description="All current data will be replaced. This cannot be undone."
      >
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setImportConfirmOpen(false);
              setPendingImport(null);
            }}
          >
            Cancel
          </Button>
          <Button onClick={() => void confirmImport()} disabled={busy === 'import'}>
            {busy === 'import' ? 'Importing…' : 'Import'}
          </Button>
        </div>
      </Dialog>

      {import.meta.env.DEV && (
        <Dialog
          open={mockOpen}
          onClose={() => {
            if (busy !== 'mock') {
              setMockOpen(false);
              setMockProgress(null);
            }
          }}
          title="Generate mock data"
          description="Creates realistic transactions for UI and performance testing."
        >
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Dataset size</Label>
              <div className="grid grid-cols-3 gap-2">
                {(['small', 'medium', 'large'] as const).map((scale) => {
                  const p = MOCK_DATA_PRESETS[scale];
                  const total = mockTotalRecords(scale);
                  return (
                    <button
                      key={scale}
                      type="button"
                      disabled={busy === 'mock'}
                      className={cn(
                        'rounded-xl border px-2 py-2.5 text-left text-xs transition-colors',
                        mockScale === scale
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border hover:bg-accent/45',
                      )}
                      onClick={() => {
                        haptic();
                        setMockScale(scale);
                      }}
                    >
                      <span className="block font-semibold capitalize">{scale}</span>
                      <span className="mt-0.5 block text-[10px] opacity-80">
                        ~{total} rows · {p.sales} sales
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={mockResetFirst}
                disabled={busy === 'mock'}
                onChange={(e) => setMockResetFirst(e.target.checked)}
              />
              <span>
                <span className="font-medium">Clear existing data first</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Factory reset, then seed accounts before generating mock records.
                </span>
              </span>
            </label>

            {mockProgress && (
              <p className="rounded-xl border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                {mockProgress.phase}
                {mockProgress.total > 1 && ` (${mockProgress.done}/${mockProgress.total})`}
              </p>
            )}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" disabled={busy === 'mock'} onClick={() => setMockOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy === 'mock'} onClick={() => void confirmMockLoad()}>
              {busy === 'mock' ? 'Generating…' : 'Generate'}
            </Button>
          </div>
        </Dialog>
      )}

      <Dialog
        open={clearQueueOpen}
        onClose={() => {
          if (busy !== 'clear-queue') setClearQueueOpen(false);
        }}
        title="Clear upload queue"
        description="Discard pending cloud uploads on this device."
      >
        <div className="flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p className="text-muted-foreground">
            {queueStats.count} change{queueStats.count === 1 ? '' : 's'} will not be uploaded to the cloud.
            Your local data stays as-is; other devices will not receive these changes.
          </p>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" disabled={busy === 'clear-queue'} onClick={() => setClearQueueOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={busy === 'clear-queue'} onClick={() => void confirmClearQueue()}>
            {busy === 'clear-queue' ? 'Clearing…' : 'Clear queue'}
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={resetOpen}
        onClose={() => {
          setResetOpen(false);
          setResetPhrase('');
        }}
        title="Factory reset"
        description="A backup downloads first, then everything is deleted."
      >
        <div className="flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p className="text-muted-foreground">
            Type{' '}
            <span className="font-mono text-xs font-semibold text-foreground">{FACTORY_RESET_PHRASE}</span>{' '}
            to confirm.
          </p>
        </div>
        <div className="mt-3 space-y-1.5">
          <Label htmlFor="reset-phrase">Confirmation</Label>
          <Input
            id="reset-phrase"
            value={resetPhrase}
            onChange={(e) => setResetPhrase(e.target.value)}
            placeholder={FACTORY_RESET_PHRASE}
            autoComplete="off"
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setResetOpen(false);
              setResetPhrase('');
            }}
          >
            Cancel
          </Button>
          <Button
            className="bg-destructive hover:bg-destructive/90"
            disabled={resetPhrase !== FACTORY_RESET_PHRASE || busy === 'reset'}
            onClick={() => void confirmFactoryReset()}
          >
            {busy === 'reset' ? 'Resetting…' : 'Reset'}
          </Button>
        </div>
      </Dialog>

      <p className="text-center text-[11px] text-muted-foreground">
        Sudo v{APP_VERSION}
      </p>
    </div>
  );
}
