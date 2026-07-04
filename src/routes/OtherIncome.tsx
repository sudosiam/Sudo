import * as React from 'react';
import { useDb } from '../hooks/useQuery';
import { Plus, PiggyBank, Trash2 } from 'lucide-react';
import { useQuery, useDateClause } from '../hooks/useQuery';
import { useFabDialog } from '../hooks/useFabDialog';
import { PageHeader } from '../components/layout/PageHeader';
import { PageKpi, PageKpis } from '../components/layout/PageKpis';
import { ListCard } from '../components/ListRow';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { Dialog, ConfirmDialog } from '../components/ui/dialog';
import { EmptyState, ListCardSkeleton } from '../components/ui/misc';
import { LoadMoreButton } from '../components/ui/load-more';
import { createOtherIncome, deleteOtherIncome } from '../domain/simple';
import { formatPaise, formatPaiseRounded, parseRupees } from '../lib/money';
import { todayISO, formatISODateShort } from '../lib/dates';
import { haptic } from '../lib/haptics';

interface Row {
  id: string;
  source: string;
  date: string;
  amount: number;
  note: string | null;
  account_name: string | null;
}

const PAGE = 100;

export default function OtherIncome() {
  const db = useDb();
  const { open: addOpen, openDialog: openAddDialog, closeDialog: closeAddDialog } = useFabDialog();
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const { clause, params } = useDateClause('oi.date');

  const [source, setSource] = React.useState('');
  const [amountText, setAmountText] = React.useState('');
  const [date, setDate] = React.useState(todayISO());
  const [accountId, setAccountId] = React.useState('');
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [limit, setLimit] = React.useState(PAGE);

  const { data: liquidAccounts } = useQuery<{ id: string; name: string }>({
    queryKey: ['liquid-accounts'],
    query: `SELECT id, name FROM accounts WHERE subtype IN ('cash','bank') AND archived = 0 ORDER BY code`,
  });
  React.useEffect(() => {
    if (!accountId && liquidAccounts?.length) setAccountId(liquidAccounts[0].id);
  }, [liquidAccounts, accountId]);

  const { data: rows, isLoading } = useQuery<Row>({
    queryKey: ['other-income', clause, limit, ...params],
    query: `SELECT oi.id, oi.source, oi.date, oi.amount, oi.note, a.name AS account_name
            FROM other_incomes oi LEFT JOIN accounts a ON a.id = oi.account_id
            WHERE ${clause}
            ORDER BY oi.date DESC, oi.created_at DESC
            LIMIT ?`,
    parameters: [...params, String(limit)],
  });

  const total = (rows ?? []).reduce((s, r) => s + r.amount, 0);

  const save = async () => {
    const amount = parseRupees(amountText);
    if (!source.trim() || amount <= 0 || !accountId) return;
    setBusy(true);
    try {
      await createOtherIncome(db, { source: source.trim(), date, amount, accountId, note });
      haptic('success');
      closeAddDialog();
      setSource('');
      setAmountText('');
      setNote('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Other Income"
        actions={
          <>
            <PageKpis>
              <PageKpi tone="muted">{rows?.length ?? 0} entries</PageKpi>
              <PageKpi tone="success">{formatPaiseRounded(total)}</PageKpi>
            </PageKpis>
            <Button size="sm" onClick={openAddDialog}>
              <Plus /> New income
            </Button>
          </>
        }
      />

      {isLoading ? (
        <ListCardSkeleton />
      ) : !rows?.length ? (
        <EmptyState
          icon={<PiggyBank />}
          title="No other income this period"
          message="Interest, commissions, scrap sales — anything not from regular sales."
          action={
            <Button size="sm" onClick={openAddDialog}>
              <Plus /> New income
            </Button>
          }
        />
      ) : (
        <ListCard>
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{r.source}</p>
                <p className="text-xs text-muted-foreground">
                  {formatISODateShort(r.date)}{r.account_name ? ` · ${r.account_name}` : ''}
                  {r.note ? ` · ${r.note}` : ''}
                </p>
              </div>
              <span className="text-sm font-semibold text-success tabular-nums">+{formatPaise(r.amount)}</span>
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

      {rows && rows.length >= limit && (
        <LoadMoreButton onClick={() => setLimit((l) => l + PAGE)} />
      )}

      <Dialog open={addOpen} onClose={closeAddDialog} title="New other income" fullPage>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Source *</Label>
            <Input autoFocus value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. Bank interest" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Amount (₹) *</Label>
              <Input inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Received into</Label>
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
            <Button variant="outline" onClick={closeAddDialog}>Cancel</Button>
            <Button onClick={save} disabled={busy || !source.trim() || parseRupees(amountText) <= 0}>
              Save income
            </Button>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) {
            await deleteOtherIncome(db, deleting);
            haptic('success');
          }
        }}
        title="Delete this income entry?"
        message="The ledger entry will be reversed."
      />
    </div>
  );
}
