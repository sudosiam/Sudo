import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDb } from '../../hooks/useQuery';
import { Trash2, Plus } from 'lucide-react';
import { useQuery } from '../../hooks/useQuery';
import { PageHeader } from '../layout/PageHeader';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select } from '../ui/select';
import { PartyPicker, type PickedParty } from './PartyPicker';
import { ItemPicker, type PickedItem } from './ItemPicker';
import { formatPaise, parseRupees, paiseToInput, mulQty, pctOf } from '../../lib/money';
import { todayISO } from '../../lib/dates';
import { saveDraft, loadDraft, clearDraft } from '../../domain/drafts';
import { peekNextDocNumber } from '../../domain/docnum';
import { getSetting } from '../../domain/settings';
import type { SaleInput, DocLineInput } from '../../domain/types';
import { haptic } from '../../lib/haptics';

interface LineDraft extends DocLineInput {
  key: string;
  priceText: string;
  qtyText: string;
  avgCost: number;
  unit: string | null;
}

interface SplitDraft {
  key: string;
  accountId: string;
  amountText: string;
  method: string;
}

interface DraftShape {
  party: PickedParty | null;
  date: string;
  docNo: string;
  lines: Omit<LineDraft, 'key'>[];
  discountPctText: string;
  discountAmtText: string;
  note: string;
}

export interface DocFormProps {
  mode: 'sale' | 'purchase';
  /** when set, the form edits an existing document */
  editId?: string;
  onSubmit: (input: SaleInput) => Promise<void>;
  loadExisting?: (id: string) => Promise<DraftShape | null>;
}

let keyCounter = 0;
const nextKey = () => `k${++keyCounter}`;

export function DocForm({ mode, editId, onSubmit, loadExisting }: DocFormProps) {
  const db = useDb();
  const navigate = useNavigate();
  const isSale = mode === 'sale';

  const [party, setParty] = React.useState<PickedParty | null>(null);
  const [date, setDate] = React.useState(todayISO());
  const [docNoText, setDocNoText] = React.useState('');
  const [lines, setLines] = React.useState<LineDraft[]>([]);
  const [discountPctText, setDiscountPctText] = React.useState('');
  const [discountAmtText, setDiscountAmtText] = React.useState('');
  const [note, setNote] = React.useState('');
  const [splits, setSplits] = React.useState<SplitDraft[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const [restoredDraft, setRestoredDraft] = React.useState(false);

  const { data: liquidAccounts } = useQuery<{ id: string; name: string; subtype: string }>({
    queryKey: ['liquid-accounts'],
    query: `SELECT id, name, subtype FROM accounts WHERE subtype IN ('cash','bank') AND archived = 0 ORDER BY code`,
  });

  // Load existing doc (edit) or restore auto-saved draft (new)
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (editId && loadExisting) {
        const existing = await loadExisting(editId);
        if (existing && !cancelled) {
          setParty(existing.party);
          setDate(existing.date);
          setDocNoText(existing.docNo);
          setLines(existing.lines.map((l) => ({ ...l, key: nextKey() })));
          setDiscountPctText(existing.discountPctText);
          setDiscountAmtText(existing.discountAmtText);
          setNote(existing.note);
        }
      } else if (!editId) {
        const prefix = await getSetting(
          db,
          isSale ? 'invoice_prefix' : 'purchase_prefix',
        );
        const { docNo } = await peekNextDocNumber(
          db,
          isSale ? 'sales' : 'purchases',
          prefix || (isSale ? 'INV' : 'PUR'),
        );
        const draft = await loadDraft<DraftShape>(db, mode);
        if (!cancelled) {
          if (draft && (draft.party || draft.lines.length || draft.note || draft.docNo)) {
            setParty(draft.party);
            setDate(draft.date || todayISO());
            setDocNoText(draft.docNo || docNo);
            setLines(draft.lines.map((l) => ({ ...l, key: nextKey() })));
            setDiscountPctText(draft.discountPctText);
            setDiscountAmtText(draft.discountAmtText);
            setNote(draft.note);
            setRestoredDraft(true);
          } else {
            setDocNoText(docNo);
          }
        }
      }
      if (!cancelled) setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [db, editId, loadExisting, mode, isSale]);

  // Debounced draft autosave (new mode only)
  React.useEffect(() => {
    if (!loaded || editId) return;
    const t = setTimeout(() => {
      const draft: DraftShape = {
        party,
        date,
        docNo: docNoText,
        lines: lines.map(({ key: _key, ...rest }) => rest),
        discountPctText,
        discountAmtText,
        note,
      };
      void saveDraft(db, mode, draft);
    }, 600);
    return () => clearTimeout(t);
  }, [db, editId, loaded, mode, party, date, docNoText, lines, discountPctText, discountAmtText, note]);

  const subtotal = lines.reduce((s, l) => s + mulQty(l.qty, l.unitPrice), 0);
  const discountAmount = Math.min(subtotal, parseRupees(discountAmtText));
  const total = Math.max(0, subtotal - discountAmount);
  const paidNow = splits.reduce((s, p) => s + parseRupees(p.amountText), 0);

  const onPickItem = (item: PickedItem) => {
    const prefill = isSale ? item.selling_price : item.avg_cost > 0 ? item.avg_cost : null;
    setLines((prev) => [
      ...prev,
      {
        key: nextKey(),
        itemId: item.id,
        name: item.name,
        qty: 1,
        qtyText: '1',
        unitPrice: prefill ?? 0,
        priceText: prefill != null ? paiseToInput(prefill) : '',
        avgCost: item.avg_cost,
        unit: item.unit,
      },
    ]);
  };

  const updateLine = (key: string, patch: Partial<LineDraft>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const setPct = (text: string) => {
    setDiscountPctText(text);
    const pct = Number(text);
    if (Number.isFinite(pct) && pct >= 0) {
      setDiscountAmtText(paiseToInput(pctOf(subtotal, Math.min(pct, 100))));
    }
  };

  const setAmt = (text: string) => {
    setDiscountAmtText(text);
    const amt = parseRupees(text);
    setDiscountPctText(subtotal > 0 ? String(Math.round((amt / subtotal) * 10000) / 100) : '');
  };

  const addSplit = () => {
    const defaultAccount = liquidAccounts?.[0];
    setSplits((prev) => [
      ...prev,
      {
        key: nextKey(),
        accountId: defaultAccount?.id ?? '',
        amountText: prev.length === 0 ? paiseToInput(total) : '',
        method: defaultAccount?.subtype === 'cash' ? 'cash' : 'bank',
      },
    ]);
  };

  const canSave =
    party &&
    lines.length > 0 &&
    lines.every((l) => l.qty > 0) &&
    !busy &&
    (!!editId || !!docNoText.trim());

  const submit = async () => {
    if (!canSave || !party) return;
    setBusy(true);
    try {
      const input: SaleInput = {
        partyId: party.id,
        date,
        lines: lines.map((l) => ({ itemId: l.itemId, name: l.name, qty: l.qty, unitPrice: l.unitPrice })),
        discountPct: Number(discountPctText) || 0,
        discountAmount,
        note,
        docNo: docNoText.trim() || undefined,
        payments: splits
          .map((s) => ({ accountId: s.accountId, amount: parseRupees(s.amountText), method: s.method }))
          .filter((s) => s.amount > 0 && s.accountId),
      };
      await onSubmit(input);
      if (!editId) await clearDraft(db, mode);
      haptic('success');
      navigate(isSale ? '/sales' : '/purchases');
    } catch (e) {
      haptic('error');
      console.error(e);
      alert(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  };

  const discard = async () => {
    await clearDraft(db, mode);
    haptic('warning');
    setParty(null);
    setLines([]);
    setDiscountAmtText('');
    setDiscountPctText('');
    setNote('');
    setSplits([]);
    setRestoredDraft(false);
    const prefix = await getSetting(db, isSale ? 'invoice_prefix' : 'purchase_prefix');
    const { docNo } = await peekNextDocNumber(
      db,
      isSale ? 'sales' : 'purchases',
      prefix || (isSale ? 'INV' : 'PUR'),
    );
    setDocNoText(docNo);
  };

  const docLabel = isSale ? 'Invoice number' : 'Bill number';
  const headerTitle = docNoText || (editId ? (isSale ? 'Edit sale' : 'Edit purchase') : isSale ? 'New sale' : 'New purchase');
  const headerSubtitle = editId ? (isSale ? 'Edit sale' : 'Edit purchase') : isSale ? 'New sale' : 'New purchase';

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={headerTitle}
        subtitle={headerSubtitle}
        back={isSale ? '/sales' : '/purchases'}
        actions={
          !editId && restoredDraft ? (
            <Button variant="ghost" size="sm" onClick={discard} className="text-muted-foreground">
              Discard draft
            </Button>
          ) : undefined
        }
      />
      {!editId && restoredDraft && (
        <p className="mb-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
          Restored your unsaved draft — it auto-saves as you type.
        </p>
      )}

      <div className="space-y-4 sm:space-y-5">
        {/* Party */}
        <section className="space-y-1.5">
          <Label>{isSale ? 'Customer' : 'Vendor'} *</Label>
          <PartyPicker value={party} onChange={setParty} partyKind={isSale ? 'customer' : 'vendor'} />
        </section>

        {/* Date + document number */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <section className="space-y-1.5">
            <Label>{docLabel}</Label>
            <Input
              value={docNoText}
              onChange={(e) => setDocNoText(e.target.value)}
              placeholder={isSale ? 'INV-001' : 'PUR-001'}
              readOnly={!!editId}
              className={editId ? 'bg-muted/50' : undefined}
            />
          </section>
          <section className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </section>
        </div>

        {/* Items */}
        <section className="space-y-2">
          <Label>Items *</Label>
          {lines.map((line) => (
            <div key={line.key} className="app-surface-muted p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="min-w-0 flex-1 truncate text-sm font-medium">{line.name}</p>
                <button
                  className="rounded-lg p-1 text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    haptic();
                    setLines((prev) => prev.filter((l) => l.key !== line.key));
                  }}
                  aria-label="Remove line"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-[10px]">Qty{line.unit ? ` (${line.unit})` : ''}</Label>
                  <Input
                    inputMode="decimal"
                    value={line.qtyText}
                    onChange={(e) => {
                      const qty = Number(e.target.value);
                      updateLine(line.key, {
                        qtyText: e.target.value,
                        qty: Number.isFinite(qty) && qty > 0 ? qty : 0,
                      });
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">
                    {isSale ? 'Price (₹)' : 'Cost (₹)'}
                  </Label>
                  <Input
                    inputMode="decimal"
                    value={line.priceText}
                    placeholder={isSale && line.avgCost > 0 ? `cost ${paiseToInput(line.avgCost)}` : '0'}
                    onChange={(e) =>
                      updateLine(line.key, {
                        priceText: e.target.value,
                        unitPrice: parseRupees(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="space-y-1 text-right">
                  <Label className="text-[10px]">Total</Label>
                  <p className="flex h-9 items-center justify-end text-sm font-semibold tabular-nums">
                    {formatPaise(mulQty(line.qty, line.unitPrice))}
                  </p>
                </div>
              </div>
              {isSale && line.avgCost > 0 && line.unitPrice > 0 && (
                <p className="mt-1.5 text-right text-[11px] text-muted-foreground">
                  margin {formatPaise(mulQty(line.qty, line.unitPrice - line.avgCost))}
                </p>
              )}
            </div>
          ))}
          <ItemPicker onPick={onPickItem} mode={mode} />
        </section>

        {/* Totals */}
        <section className="app-surface-muted p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium tabular-nums">{formatPaise(subtotal)}</span>
          </div>
          <div className="mt-2 flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
            <span className="text-sm text-muted-foreground">Discount</span>
            <div className="flex w-full items-center gap-1.5 sm:w-auto">
              <div className="relative w-1/2 sm:w-20">
                <Input
                  inputMode="decimal"
                  className="h-8 pr-6 text-right text-xs"
                  value={discountPctText}
                  onChange={(e) => setPct(e.target.value)}
                  placeholder="0"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
              </div>
              <div className="relative w-1/2 sm:w-28">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
                <Input
                  inputMode="decimal"
                  className="h-8 pl-6 text-right text-xs"
                  value={discountAmtText}
                  onChange={(e) => setAmt(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between border-t pt-3">
            <span className="text-sm font-semibold">Total</span>
            <span className="text-lg font-bold tabular-nums">{formatPaise(total)}</span>
          </div>
        </section>

        {/* Payment now (create mode only) */}
        {!editId && (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{isSale ? 'Receive payment now' : 'Pay now'}</Label>
              <Button variant="outline" size="sm" onClick={addSplit}>
                <Plus /> {splits.length ? 'Split' : 'Add payment'}
              </Button>
            </div>
            {splits.map((split) => (
              <div key={split.key} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-center">
                <Select
                  className="w-full"
                  value={split.accountId}
                  onChange={(e) => {
                    const acc = liquidAccounts?.find((a) => a.id === e.target.value);
                    setSplits((prev) =>
                      prev.map((s) =>
                        s.key === split.key
                          ? { ...s, accountId: e.target.value, method: acc?.subtype === 'cash' ? 'cash' : 'bank' }
                          : s,
                      ),
                    );
                  }}
                >
                  <option value="">Select account…</option>
                  {liquidAccounts?.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </Select>
                <div className="relative w-full sm:w-32">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
                  <Input
                    inputMode="decimal"
                    className="pl-6 text-right"
                    value={split.amountText}
                    onChange={(e) =>
                      setSplits((prev) =>
                        prev.map((s) => (s.key === split.key ? { ...s, amountText: e.target.value } : s)),
                      )
                    }
                  />
                </div>
                <button
                  className="justify-self-end rounded-lg p-1.5 text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    haptic();
                    setSplits((prev) => prev.filter((s) => s.key !== split.key));
                  }}
                  aria-label="Remove split"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
            {splits.length > 0 && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Paying {formatPaise(paidNow)} of {formatPaise(total)}
                </span>
                <span className={paidNow > total ? 'font-medium text-destructive' : ''}>
                  {paidNow > total
                    ? 'More than total!'
                    : paidNow === total
                      ? 'Fully paid'
                      : `${formatPaise(total - paidNow)} on credit`}
                </span>
              </div>
            )}
          </section>
        )}

        {/* Note */}
        <section className="space-y-1.5">
          <Label>Note</Label>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note…" />
        </section>

        <div className="sticky bottom-4 z-10 flex gap-2 pb-[env(safe-area-inset-bottom)]">
          <Button className="h-11 flex-1 text-base shadow-md" onClick={submit} disabled={!canSave || paidNow > total}>
            {busy ? 'Saving…' : editId ? 'Save changes' : isSale ? 'Save sale' : 'Save purchase'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export type { DraftShape };
