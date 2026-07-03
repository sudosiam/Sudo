import * as React from 'react';
import { usePowerSync } from '@powersync/react';
import { Landmark, Wallet, ArrowLeftRight, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { useQuery } from '../../hooks/useQuery';
import { useFabDialog } from '../../hooks/useFabDialog';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageKpi, PageKpis } from '../../components/layout/PageKpis';
import { ListRow, ListCard } from '../../components/ListRow';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { Dialog } from '../../components/ui/dialog';
import { PageSpinner } from '../../components/ui/misc';
import { createBankAccount, transferBetweenAccounts, depositToAccount, withdrawFromAccount } from '../../domain/banking';
import { formatPaise, formatPaiseRounded, parseRupees } from '../../lib/money';
import { todayISO } from '../../lib/dates';
import { haptic } from '../../lib/haptics';

interface AccountRow {
  id: string;
  name: string;
  subtype: string;
  balance: number;
  include_in_liquid: number;
}

export default function Banking() {
  const db = usePowerSync();
  const { open: addOpen, openDialog: openAddAccountDialog, closeDialog: closeAddAccountDialog, requested: newRequested } = useFabDialog();
  const [showAllAccounts, setShowAllAccounts] = React.useState(false);
  const [transferOpen, setTransferOpen] = React.useState(false);
  const [depositOpen, setDepositOpen] = React.useState(false);
  const [withdrawOpen, setWithdrawOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [openingText, setOpeningText] = React.useState('');
  const [accountId, setAccountId] = React.useState('');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [amountText, setAmountText] = React.useState('');
  const [date, setDate] = React.useState(todayISO());
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (newRequested) openAddAccountDialog();
  }, [newRequested, openAddAccountDialog]);

  const { data: accounts, isLoading } = useQuery<AccountRow>({
    queryKey: ['banking-accounts'],
    query: `SELECT a.id, a.name, a.subtype, COALESCE(a.include_in_liquid, 1) AS include_in_liquid,
                   COALESCE((SELECT SUM(jl.amount) FROM journal_lines jl WHERE jl.account_id = a.id), 0) AS balance
            FROM accounts a
            WHERE a.subtype IN ('cash','bank') AND a.archived = 0
            ORDER BY a.code`,
  });

  const liquidAccounts = (accounts ?? []).filter((a) => a.include_in_liquid !== 0);
  const hiddenCount = (accounts?.length ?? 0) - liquidAccounts.length;
  const visibleAccounts = showAllAccounts ? accounts : liquidAccounts;
  const totalLiquid = liquidAccounts.reduce((s, a) => s + a.balance, 0);

  const addAccount = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await createBankAccount(db, name.trim(), parseRupees(openingText), todayISO());
      haptic('success');
      closeAddAccountDialog();
      setName('');
      setOpeningText('');
    } finally {
      setBusy(false);
    }
  };

  const doTransfer = async () => {
    const amount = parseRupees(amountText);
    if (!from || !to || from === to || amount <= 0) return;
    setBusy(true);
    try {
      await transferBetweenAccounts(db, from, to, amount, date, note);
      haptic('success');
      setTransferOpen(false);
      resetCashForm();
    } finally {
      setBusy(false);
    }
  };

  const resetCashForm = () => {
    setAmountText('');
    setNote('');
    setDate(todayISO());
    setAccountId('');
    setFrom('');
    setTo('');
  };

  const doDeposit = async () => {
    const amount = parseRupees(amountText);
    if (!accountId || amount <= 0) return;
    setBusy(true);
    try {
      await depositToAccount(db, accountId, amount, date, note);
      haptic('success');
      setDepositOpen(false);
      resetCashForm();
    } finally {
      setBusy(false);
    }
  };

  const doWithdraw = async () => {
    const amount = parseRupees(amountText);
    if (!accountId || amount <= 0) return;
    setBusy(true);
    try {
      await withdrawFromAccount(db, accountId, amount, date, note);
      haptic('success');
      setWithdrawOpen(false);
      resetCashForm();
    } finally {
      setBusy(false);
    }
  };

  const cashFormFields = (
    <>
      <div className="space-y-1.5">
        <Label>Account</Label>
        <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">Select…</option>
          {accounts?.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </Select>
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
        <Label>Note</Label>
        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note…" />
      </div>
    </>
  );

  return (
    <div>
      <PageHeader
        title="Banking"
        actions={
          <PageKpis>
            <PageKpi tone="muted">{visibleAccounts?.length ?? 0} accounts</PageKpi>
            <PageKpi>{formatPaiseRounded(totalLiquid)} liquid</PageKpi>
          </PageKpis>
        }
      />

      <div className="mb-3 grid grid-cols-3 gap-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => {
            resetCashForm();
            setDepositOpen(true);
          }}
        >
          <ArrowDownToLine /> Deposit
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => {
            resetCashForm();
            setWithdrawOpen(true);
          }}
        >
          <ArrowUpFromLine /> Withdraw
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => {
            resetCashForm();
            setTransferOpen(true);
          }}
        >
          <ArrowLeftRight /> Transfer
        </Button>
      </div>

      {hiddenCount > 0 && (
        <div className="mb-2 flex justify-end px-1">
          <Button
            variant={showAllAccounts ? 'secondary' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setShowAllAccounts((v) => !v)}
          >
            {showAllAccounts ? 'Liquid only' : `All accounts (${hiddenCount} hidden)`}
          </Button>
        </div>
      )}

      {isLoading ? (
        <PageSpinner />
      ) : (
        <ListCard>
          {visibleAccounts?.map((a) => (
            <ListRow
              key={a.id}
              to={`/banking/${a.id}`}
              avatar={
                <div className={`flex size-9 shrink-0 items-center justify-center rounded-full ${a.include_in_liquid ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  {a.subtype === 'cash' ? <Wallet className="size-4" /> : <Landmark className="size-4" />}
                </div>
              }
              title={a.name}
              subtitle={
                a.subtype === 'cash'
                  ? 'Cash in hand'
                  : a.include_in_liquid
                    ? 'Bank account'
                    : 'Bank account · excluded from liquid'
              }
              right={
                <span className={a.balance < 0 ? 'text-destructive' : undefined}>
                  {formatPaise(a.balance)}
                </span>
              }
            />
          ))}
        </ListCard>
      )}

      <Dialog open={addOpen} onClose={closeAddAccountDialog} title="Add bank account" fullPage>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Account name *</Label>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. HDFC Current" />
          </div>
          <div className="space-y-1.5">
            <Label>Opening balance (₹)</Label>
            <Input inputMode="decimal" value={openingText} onChange={(e) => setOpeningText(e.target.value)} placeholder="0" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={closeAddAccountDialog}>Cancel</Button>
            <Button onClick={addAccount} disabled={busy || !name.trim()}>Add account</Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={transferOpen} onClose={() => setTransferOpen(false)} title="Transfer between accounts" fullPage>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>From</Label>
              <Select value={from} onChange={(e) => setFrom(e.target.value)}>
                <option value="">Select…</option>
                {accounts?.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>To</Label>
              <Select value={to} onChange={(e) => setTo(e.target.value)}>
                <option value="">Select…</option>
                {accounts?.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </Select>
            </div>
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
            <Label>Note</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note…" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setTransferOpen(false)}>Cancel</Button>
            <Button onClick={doTransfer} disabled={busy || !from || !to || from === to || parseRupees(amountText) <= 0}>
              Transfer
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={depositOpen} onClose={() => setDepositOpen(false)} title="Deposit" fullPage>
        <div className="space-y-3">
          {cashFormFields}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setDepositOpen(false)}>Cancel</Button>
            <Button onClick={doDeposit} disabled={busy || !accountId || parseRupees(amountText) <= 0}>
              Record deposit
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={withdrawOpen} onClose={() => setWithdrawOpen(false)} title="Withdraw" fullPage>
        <div className="space-y-3">
          {cashFormFields}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setWithdrawOpen(false)}>Cancel</Button>
            <Button onClick={doWithdraw} disabled={busy || !accountId || parseRupees(amountText) <= 0}>
              Record withdrawal
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
