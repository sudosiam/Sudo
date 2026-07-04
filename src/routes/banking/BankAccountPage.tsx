import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDb } from '../../hooks/useQuery';
import { Pencil, Trash2, ArrowDownLeft, ArrowUpRight, ArrowDownToLine, ArrowUpFromLine, Undo2 } from 'lucide-react';
import { useQuery, useDateClause } from '../../hooks/useQuery';
import { PageHeader } from '../../components/layout/PageHeader';
import { ListRow, ListCard } from '../../components/ListRow';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, ConfirmDialog } from '../../components/ui/dialog';
import { EmptyState, PageSpinner } from '../../components/ui/misc';
import { renameBankAccount, deleteBankAccount, depositToAccount, withdrawFromAccount, setBankAccountIncludeInLiquid, reverseBankingEntry, isReversibleBankSource } from '../../domain/banking';
import { sourceLink, sourceLabel } from '../../domain/links';
import { formatPaise, parseRupees } from '../../lib/money';
import { todayISO, formatISODateShort } from '../../lib/dates';
import { haptic } from '../../lib/haptics';

interface TxRow {
  id: string;
  date: string;
  amount: number;
  memo: string | null;
  source_type: string | null;
  source_id: string | null;
  party_name: string | null;
}

export default function BankAccountPage() {
  const { id } = useParams<{ id: string }>();
  const db = useDb();
  const navigate = useNavigate();
  const [renameOpen, setRenameOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [reverseTarget, setReverseTarget] = React.useState<{ sourceType: string; sourceId: string; memo: string } | null>(null);
  const [depositOpen, setDepositOpen] = React.useState(false);
  const [withdrawOpen, setWithdrawOpen] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [amountText, setAmountText] = React.useState('');
  const [date, setDate] = React.useState(todayISO());
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const { clause, params } = useDateClause('jl.date');

  const { data: accounts, isLoading } = useQuery<{ id: string; name: string; subtype: string; balance: number; include_in_liquid: number }>({
    queryKey: ['bank-account', id],
    query: `SELECT a.id, a.name, a.subtype, COALESCE(a.include_in_liquid, 1) AS include_in_liquid,
                   COALESCE((SELECT SUM(jl.amount) FROM journal_lines jl WHERE jl.account_id = a.id), 0) AS balance
            FROM accounts a WHERE a.id = ?`,
    parameters: [id],
  });
  const account = accounts?.[0];

  const { data: txns } = useQuery<TxRow>({
    queryKey: ['bank-txns', id, clause, ...params],
    query: `SELECT jl.id, jl.date, jl.amount, je.memo, je.source_type, je.source_id, p.name AS party_name
            FROM journal_lines jl
            JOIN journal_entries je ON je.id = jl.entry_id
            LEFT JOIN parties p ON p.id = jl.party_id
            WHERE jl.account_id = ? AND ${clause}
            ORDER BY jl.date DESC, je.created_at DESC
            LIMIT 500`,
    parameters: [id, ...params],
  });

  if (isLoading) return <PageSpinner />;
  if (!account) return <EmptyState title="Account not found" />;

  const resetForm = () => {
    setAmountText('');
    setNote('');
    setDate(todayISO());
  };

  const doDeposit = async () => {
    const amount = parseRupees(amountText);
    if (amount <= 0) return;
    setBusy(true);
    try {
      await depositToAccount(db, account.id, amount, date, note);
      haptic('success');
      setDepositOpen(false);
      resetForm();
    } finally {
      setBusy(false);
    }
  };

  const doWithdraw = async () => {
    const amount = parseRupees(amountText);
    if (amount <= 0) return;
    setBusy(true);
    try {
      await withdrawFromAccount(db, account.id, amount, date, note);
      haptic('success');
      setWithdrawOpen(false);
      resetForm();
    } finally {
      setBusy(false);
    }
  };

  const isSystemCash = account.subtype === 'cash';
  const subtypeLabel = account.subtype === 'cash' ? 'Cash in hand' : 'Bank account';

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={account.name}
        subtitle={subtypeLabel}
        back="/banking"
        actions={
          <>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => {
                resetForm();
                setDepositOpen(true);
              }}
              aria-label="Deposit"
              title="Deposit"
            >
              <ArrowDownToLine />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => {
                resetForm();
                setWithdrawOpen(true);
              }}
              aria-label="Withdraw"
              title="Withdraw"
            >
              <ArrowUpFromLine />
            </Button>
            {!isSystemCash && (
              <>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => {
                    setNewName(account.name);
                    setRenameOpen(true);
                  }}
                  aria-label="Rename"
                >
                  <Pencil />
                </Button>
                <Button variant="outline" size="icon-sm" onClick={() => setDeleteOpen(true)} aria-label="Delete">
                  <Trash2 className="text-destructive" />
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="app-surface mb-4 p-4">
        <p className="text-xs text-muted-foreground">Current balance</p>
        <p className={`mt-1 text-2xl font-bold tabular-nums ${account.balance < 0 ? 'text-destructive' : ''}`}>
          {formatPaise(account.balance)}
        </p>
        {account.subtype === 'bank' && (
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={account.include_in_liquid !== 0}
              onChange={async (e) => {
                await setBankAccountIncludeInLiquid(db, account.id, e.target.checked);
                haptic('success');
              }}
              className="size-4 rounded border-input"
            />
            Include in total liquid
          </label>
        )}
      </div>

      <h2 className="page-section-title">Transactions</h2>
      {!txns?.length ? (
        <EmptyState title="No transactions in this period" message="Change the month filter above to see more." />
      ) : (
        <ListCard>
          {txns.map((t) => {
            const link = sourceLink(t.source_type, t.source_id);
            const inflow = t.amount >= 0;
            const canReverse = isReversibleBankSource(t.source_type) && !!t.source_id;
            return (
              <ListRow
                key={t.id}
                to={link ?? undefined}
                avatar={
                  <div
                    className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                      inflow ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                    }`}
                  >
                    {inflow ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
                  </div>
                }
                title={t.memo || sourceLabel(t.source_type)}
                subtitle={
                  <>
                    {formatISODateShort(t.date)}
                    {t.party_name ? ` · ${t.party_name}` : ''}
                    {' · '}
                    {sourceLabel(t.source_type)}
                  </>
                }
                right={
                  <span className={inflow ? 'text-success' : 'text-destructive'}>
                    {inflow ? '+' : '−'}{formatPaise(Math.abs(t.amount))}
                  </span>
                }
                trailing={
                  canReverse ? (
                    <button
                      type="button"
                      className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive"
                      aria-label="Reverse transaction"
                      title="Reverse"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        haptic();
                        setReverseTarget({
                          sourceType: t.source_type!,
                          sourceId: t.source_id!,
                          memo: t.memo || sourceLabel(t.source_type),
                        });
                      }}
                    >
                      <Undo2 className="size-3.5" />
                    </button>
                  ) : undefined
                }
              />
            );
          })}
        </ListCard>
      )}

      <Dialog open={renameOpen} onClose={() => setRenameOpen(false)} title="Rename account" fullPage>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Account name</Label>
            <Input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                await renameBankAccount(db, account.id, newName.trim());
                haptic('success');
                setRenameOpen(false);
              }}
              disabled={!newName.trim()}
            >
              Save
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={depositOpen} onClose={() => setDepositOpen(false)} title={`Deposit to ${account.name}`} fullPage>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Amount (₹) *</Label>
              <Input autoFocus inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Note</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note…" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setDepositOpen(false)}>Cancel</Button>
            <Button onClick={doDeposit} disabled={busy || parseRupees(amountText) <= 0}>Record deposit</Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={withdrawOpen} onClose={() => setWithdrawOpen(false)} title={`Withdraw from ${account.name}`} fullPage>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Amount (₹) *</Label>
              <Input autoFocus inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Note</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note…" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setWithdrawOpen(false)}>Cancel</Button>
            <Button onClick={doWithdraw} disabled={busy || parseRupees(amountText) <= 0}>Record withdrawal</Button>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={async () => {
          const result = await deleteBankAccount(db, account.id);
          haptic('success');
          if (result === 'archived') {
            alert('Account has transactions, so it was archived instead of deleted.');
          }
          navigate('/banking');
        }}
        title={`Delete ${account.name}?`}
        message="Accounts with transaction history are archived instead so your books stay correct."
      />

      <ConfirmDialog
        open={!!reverseTarget}
        onClose={() => setReverseTarget(null)}
        onConfirm={async () => {
          if (!reverseTarget) return;
          await reverseBankingEntry(db, reverseTarget.sourceType, reverseTarget.sourceId);
          haptic('success');
          setReverseTarget(null);
        }}
        title="Reverse this transaction?"
        message={`Remove "${reverseTarget?.memo}" from the ledger? This cannot be undone.`}
      />
    </div>
  );
}
