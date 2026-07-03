import * as React from 'react';
import { usePowerSync } from '@powersync/react';
import { useQuery } from '../../hooks/useQuery';
import { Dialog } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select } from '../ui/select';
import { Segmented } from '../ui/misc';
import { PartyPicker, type PickedParty } from '../doc/PartyPicker';
import { createPayment } from '../../domain/payments';
import { formatPaise, parseRupees, paiseToInput } from '../../lib/money';
import { todayISO, formatISODateShort } from '../../lib/dates';
import { haptic } from '../../lib/haptics';

interface OutstandingDoc {
  id: string;
  doc_no: string;
  date: string;
  due: number;
}

export function PaymentDialog({
  open,
  onClose,
  defaultDirection = 'in',
}: {
  open: boolean;
  onClose: () => void;
  defaultDirection?: 'in' | 'out';
}) {
  const db = usePowerSync();
  const [direction, setDirection] = React.useState<'in' | 'out'>(defaultDirection);
  const [party, setParty] = React.useState<PickedParty | null>(null);
  const [date, setDate] = React.useState(todayISO());
  const [amountText, setAmountText] = React.useState('');
  const [accountId, setAccountId] = React.useState('');
  const [method, setMethod] = React.useState('cash');
  const [note, setNote] = React.useState('');
  const [allocs, setAllocs] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setDirection(defaultDirection);
    setParty(null);
    setDate(todayISO());
    setAmountText('');
    setNote('');
    setAllocs({});
  }, [open, defaultDirection]);

  const { data: liquidAccounts } = useQuery<{ id: string; name: string; subtype: string }>({
    queryKey: ['liquid-accounts'],
    query: `SELECT id, name, subtype FROM accounts WHERE subtype IN ('cash','bank') AND archived = 0 ORDER BY code`,
  });

  React.useEffect(() => {
    if (!accountId && liquidAccounts?.length) setAccountId(liquidAccounts[0].id);
  }, [liquidAccounts, accountId]);

  const docTable = direction === 'in' ? 'sales' : 'purchases';
  const docNoCol = direction === 'in' ? 'invoice_no' : 'bill_no';
  const { data: outstanding } = useQuery<OutstandingDoc>({
    queryKey: ['outstanding', direction, party?.id],
    query: `SELECT id, ${docNoCol} AS doc_no, date, (total - paid_amount) AS due
            FROM ${docTable}
            WHERE party_id = ? AND status != 'paid' AND (total - paid_amount) > 0
            ORDER BY date`,
    parameters: [party?.id ?? '___none___'],
  });

  const amount = parseRupees(amountText);
  const allocated = Object.values(allocs).reduce((s, t) => s + parseRupees(t), 0);

  const autoAllocate = () => {
    haptic();
    let remaining = amount;
    const next: Record<string, string> = {};
    for (const doc of outstanding ?? []) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, doc.due);
      next[doc.id] = paiseToInput(take);
      remaining -= take;
    }
    setAllocs(next);
  };

  const save = async () => {
    if (!party || amount <= 0 || !accountId || allocated > amount) return;
    setBusy(true);
    try {
      await createPayment(db, {
        direction,
        partyId: party.id,
        date,
        amount,
        accountId,
        method,
        note,
        allocations: (outstanding ?? [])
          .filter((d) => parseRupees(allocs[d.id] ?? '') > 0)
          .map((d) => ({
            saleId: direction === 'in' ? d.id : undefined,
            purchaseId: direction === 'out' ? d.id : undefined,
            amount: Math.min(parseRupees(allocs[d.id]), d.due),
          })),
      });
      haptic('success');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="New payment" fullPage>
      <div className="space-y-3">
        <Segmented
          className="w-full [&>button]:flex-1"
          options={[
            { value: 'in', label: 'Payment in (received)' },
            { value: 'out', label: 'Payment out (paid)' },
          ]}
          value={direction}
          onChange={(v) => {
            setDirection(v);
            setAllocs({});
          }}
        />

        <div className="space-y-1.5">
          <Label>{direction === 'in' ? 'Customer' : 'Vendor'} *</Label>
          <PartyPicker value={party} onChange={(p) => { setParty(p); setAllocs({}); }} partyKind={direction === 'in' ? 'customer' : 'vendor'} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Amount (₹) *</Label>
            <Input inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>{direction === 'in' ? 'Into account' : 'From account'}</Label>
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {liquidAccounts?.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Method</Label>
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="bank">Bank transfer</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
              <option value="other">Other</option>
            </Select>
          </div>
        </div>

        {party && (outstanding?.length ?? 0) > 0 && (
          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <Label>Settle against {direction === 'in' ? 'invoices' : 'bills'}</Label>
              <Button variant="outline" size="sm" onClick={autoAllocate} disabled={amount <= 0}>
                Auto-allocate
              </Button>
            </div>
            {outstanding!.map((doc) => (
              <div key={doc.id} className="flex items-center gap-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{doc.doc_no}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatISODateShort(doc.date)} · due {formatPaise(doc.due)}
                  </p>
                </div>
                <div className="relative w-28">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
                  <Input
                    inputMode="decimal"
                    className="h-8 pl-6 text-right text-xs"
                    value={allocs[doc.id] ?? ''}
                    onChange={(e) => setAllocs((prev) => ({ ...prev, [doc.id]: e.target.value }))}
                    placeholder="0"
                  />
                </div>
              </div>
            ))}
            <p className={`text-right text-[11px] ${allocated > amount ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
              Allocated {formatPaise(allocated)} of {formatPaise(amount)}
              {allocated > amount ? ' — more than payment!' : ''}
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Note</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note…" />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy || !party || amount <= 0 || !accountId || allocated > amount}>
            Save payment
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
