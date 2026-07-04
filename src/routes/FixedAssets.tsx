import * as React from 'react';
import { usePowerSync } from '@powersync/react';
import { Plus, Pencil, Building2, Trash2 } from 'lucide-react';
import { useQuery } from '../hooks/useQuery';
import { useFabDialog } from '../hooks/useFabDialog';
import { PageHeader } from '../components/layout/PageHeader';
import { PageKpi, PageKpis } from '../components/layout/PageKpis';
import { ListCard } from '../components/ListRow';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { Dialog, ConfirmDialog } from '../components/ui/dialog';
import { EmptyState, PageSpinner } from '../components/ui/misc';
import { createFixedAsset, updateFixedAsset, deleteFixedAsset } from '../domain/simple';
import { formatPaise, formatPaiseRounded, parseRupees } from '../lib/money';
import { todayISO, formatISODate } from '../lib/dates';
import { haptic } from '../lib/haptics';

interface Row {
  id: string;
  name: string;
  purchase_date: string | null;
  cost: number;
  note: string | null;
  account_id: string | null;
  account_name: string | null;
}

export default function FixedAssets() {
  const db = usePowerSync();
  const { open: addOpen, openDialog: openAddDialog, closeDialog: closeAddDialog } = useFabDialog();
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<Row | null>(null);
  const dialogOpen = addOpen || !!editing;
  const closeDialog = () => {
    closeAddDialog();
    setEditing(null);
  };

  const [name, setName] = React.useState('');
  const [costText, setCostText] = React.useState('');
  const [date, setDate] = React.useState(todayISO());
  const [accountId, setAccountId] = React.useState('');
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const { data: liquidAccounts } = useQuery<{ id: string; name: string }>({
    queryKey: ['liquid-accounts'],
    query: `SELECT id, name FROM accounts WHERE subtype IN ('cash','bank') AND archived = 0 ORDER BY code`,
  });
  React.useEffect(() => {
    if (!accountId && liquidAccounts?.length) setAccountId(liquidAccounts[0].id);
  }, [liquidAccounts, accountId]);

  React.useEffect(() => {
    if (editing) {
      setName(editing.name);
      setCostText(String(editing.cost / 100));
      setDate(editing.purchase_date ?? todayISO());
      setAccountId(editing.account_id ?? '');
      setNote(editing.note ?? '');
    } else if (!addOpen) {
      setName('');
      setCostText('');
      setDate(todayISO());
      setNote('');
    }
  }, [editing, addOpen]);

  const { data: rows, isLoading } = useQuery<Row>({
    queryKey: ['fixed-assets'],
    query: `SELECT fa.id, fa.name, fa.purchase_date, fa.cost, fa.note, fa.account_id, a.name AS account_name
            FROM fixed_assets fa LEFT JOIN accounts a ON a.id = fa.account_id
            ORDER BY fa.purchase_date DESC`,
  });

  const total = (rows ?? []).reduce((s, r) => s + r.cost, 0);

  const save = async () => {
    const cost = parseRupees(costText);
    if (!name.trim() || cost <= 0 || !accountId) return;
    setBusy(true);
    try {
      const input = { name: name.trim(), purchaseDate: date, cost, accountId, note };
      if (editing) await updateFixedAsset(db, editing.id, input);
      else await createFixedAsset(db, input);
      haptic('success');
      closeDialog();
      setEditing(null);
      setName('');
      setCostText('');
      setNote('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Fixed Assets"
        actions={
          <>
            <PageKpis>
              <PageKpi tone="muted">{rows?.length ?? 0} assets</PageKpi>
              <PageKpi>{formatPaiseRounded(total)}</PageKpi>
            </PageKpis>
            <Button size="sm" onClick={openAddDialog}>
              <Plus /> New asset
            </Button>
          </>
        }
      />

      {isLoading ? (
        <PageSpinner />
      ) : !rows?.length ? (
        <EmptyState
          icon={<Building2 />}
          title="No fixed assets yet"
          message="Machinery, vehicles, furniture — long-term assets of the business."
        />
      ) : (
        <ListCard>
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Building2 className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{r.name}</p>
                <p className="text-xs text-muted-foreground">
                  {r.purchase_date ? formatISODate(r.purchase_date) : ''}
                  {r.account_name ? ` · paid from ${r.account_name}` : ''}
                  {r.note ? ` · ${r.note}` : ''}
                </p>
              </div>
              <span className="text-sm font-semibold tabular-nums">{formatPaise(r.cost)}</span>
              <button
                className="rounded-lg p-1 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  haptic();
                  setEditing(r);
                }}
                aria-label="Edit"
              >
                <Pencil className="size-3.5" />
              </button>
              <button
                className="rounded-lg p-1 text-muted-foreground hover:text-destructive"
                onClick={() => { haptic(); setDeleting(r.id); }}
                aria-label="Delete"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </ListCard>
      )}

      <Dialog open={dialogOpen} onClose={closeDialog} title={editing ? 'Edit fixed asset' : 'New fixed asset'} fullPage>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Asset name *</Label>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Delivery van" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Cost (₹) *</Label>
              <Input inputMode="decimal" value={costText} onChange={(e) => setCostText(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Purchase date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Paid from</Label>
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {liquidAccounts?.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Note</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note…" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={save} disabled={busy || !name.trim() || parseRupees(costText) <= 0}>
              {editing ? 'Save changes' : 'Save asset'}
            </Button>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) {
            await deleteFixedAsset(db, deleting);
            haptic('success');
          }
        }}
        title="Delete this asset?"
        message="The ledger entry will be reversed."
      />
    </div>
  );
}
