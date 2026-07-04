import * as React from 'react';
import { useDb } from '../../hooks/useQuery';
import { Plus } from 'lucide-react';
import { useQuery } from '../../hooks/useQuery';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { Dialog, ConfirmDialog } from '../ui/dialog';
import {
  createRecurringExpense,
  updateRecurringExpense,
  deleteRecurringExpense,
} from '../../domain/recurringExpenses';
import { createExpenseCategory } from '../../domain/parties';
import { parseRupees } from '../../lib/money';
import { haptic } from '../../lib/haptics';

export interface RecurringExpenseFormValues {
  id?: string;
  label: string;
  category_id: string;
  amount: number;
  account_id: string;
  day_of_month: number;
  active: number;
  note: string | null;
}

const DAY_OPTIONS = Array.from({ length: 28 }, (_, i) => i + 1);

export function RecurringExpenseDialog({
  open,
  onClose,
  recurring,
}: {
  open: boolean;
  onClose: () => void;
  recurring?: RecurringExpenseFormValues;
}) {
  const db = useDb();
  const editing = !!recurring?.id;

  const [label, setLabel] = React.useState('');
  const [categoryId, setCategoryId] = React.useState('');
  const [amountText, setAmountText] = React.useState('');
  const [accountId, setAccountId] = React.useState('');
  const [dayOfMonth, setDayOfMonth] = React.useState('1');
  const [active, setActive] = React.useState(true);
  const [note, setNote] = React.useState('');
  const [newCat, setNewCat] = React.useState('');
  const [addingCat, setAddingCat] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const { data: categories } = useQuery<{ id: string; name: string }>({
    queryKey: ['expense-categories'],
    query: `SELECT id, name FROM accounts WHERE subtype = 'opex' AND archived = 0 ORDER BY name COLLATE NOCASE`,
  });

  const { data: liquidAccounts } = useQuery<{ id: string; name: string }>({
    queryKey: ['liquid-accounts'],
    query: `SELECT id, name FROM accounts WHERE subtype IN ('cash','bank') AND archived = 0 ORDER BY code`,
  });

  React.useEffect(() => {
    if (!open) return;
    if (recurring) {
      setLabel(recurring.label);
      setCategoryId(recurring.category_id);
      setAmountText(String(recurring.amount / 100));
      setAccountId(recurring.account_id);
      setDayOfMonth(String(recurring.day_of_month));
      setActive(recurring.active === 1);
      setNote(recurring.note ?? '');
    } else {
      setLabel('');
      setCategoryId('');
      setAmountText('');
      setAccountId('');
      setDayOfMonth('1');
      setActive(true);
      setNote('');
    }
    setAddingCat(false);
    setNewCat('');
  }, [open, recurring]);

  React.useEffect(() => {
    if (!open || recurring || !liquidAccounts?.length || accountId) return;
    setAccountId(liquidAccounts[0].id);
  }, [open, recurring, liquidAccounts, accountId]);

  React.useEffect(() => {
    if (!open || recurring || !categories?.length || categoryId) return;
    setCategoryId(categories[0].id);
  }, [open, recurring, categories, categoryId]);

  const save = async () => {
    const amount = parseRupees(amountText);
    if (!label.trim() || !categoryId || !accountId || amount <= 0) return;
    setBusy(true);
    try {
      const input = {
        label: label.trim(),
        categoryId,
        amount,
        accountId,
        dayOfMonth: Number(dayOfMonth),
        note,
        active,
      };
      if (editing && recurring?.id) {
        await updateRecurringExpense(db, recurring.id, input);
      } else {
        await createRecurringExpense(db, input);
      }
      haptic('success');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
    <Dialog open={open} onClose={onClose} title={editing ? 'Edit recurring expense' : 'New recurring expense'} fullPage>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Name *</Label>
          <Input
            autoFocus={!editing}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Office rent"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Category</Label>
          {addingCat ? (
            <div className="flex gap-2">
              <Input
                autoFocus
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                placeholder="New category name"
              />
              <Button
                size="sm"
                onClick={async () => {
                  if (!newCat.trim()) return;
                  const id = await createExpenseCategory(db, newCat);
                  setCategoryId(id);
                  setAddingCat(false);
                  setNewCat('');
                  haptic('success');
                }}
              >
                Add
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Select className="flex-1" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
              <Button variant="outline" size="icon" onClick={() => setAddingCat(true)} aria-label="New category">
                <Plus />
              </Button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Amount (₹) *</Label>
            <Input
              inputMode="decimal"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Day of month</Label>
            <Select value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)}>
              {DAY_OPTIONS.map((d) => (
                <option key={d} value={d}>{d}{d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th'} of each month</option>
              ))}
            </Select>
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
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional details" />
        </div>
        {editing && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="size-4 rounded border-input"
            />
            Active
          </label>
        )}
        <div className="flex justify-between gap-2 pt-1">
          {editing ? (
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              Delete template
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={busy || !label.trim() || parseRupees(amountText) <= 0}>
              {editing ? 'Save changes' : 'Save recurring'}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={async () => {
          if (!recurring?.id) return;
          await deleteRecurringExpense(db, recurring.id);
          haptic('success');
          setDeleteOpen(false);
          onClose();
        }}
        title="Delete recurring template?"
        message="The template is removed. Expenses already recorded from it stay in your books."
      />
    </>
  );
}
