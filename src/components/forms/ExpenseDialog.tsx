import * as React from 'react';
import { useDb } from '../../hooks/useQuery';
import { Plus } from 'lucide-react';
import { useQuery } from '../../hooks/useQuery';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { Dialog } from '../ui/dialog';
import { createExpense, updateExpense } from '../../domain/simple';
import { createExpenseCategory } from '../../domain/parties';
import { parseRupees } from '../../lib/money';
import { todayISO } from '../../lib/dates';
import { haptic } from '../../lib/haptics';

export interface ExpenseFormValues {
  id?: string;
  category_id: string;
  date: string;
  amount: number;
  account_id: string;
  note: string | null;
}

export function ExpenseDialog({
  open,
  onClose,
  expense,
}: {
  open: boolean;
  onClose: () => void;
  expense?: ExpenseFormValues;
}) {
  const db = useDb();
  const editing = !!expense?.id;

  const [categoryId, setCategoryId] = React.useState('');
  const [amountText, setAmountText] = React.useState('');
  const [date, setDate] = React.useState(todayISO());
  const [accountId, setAccountId] = React.useState('');
  const [note, setNote] = React.useState('');
  const [newCat, setNewCat] = React.useState('');
  const [addingCat, setAddingCat] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

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
    if (expense) {
      setCategoryId(expense.category_id);
      setAmountText(String(expense.amount / 100));
      setDate(expense.date);
      setAccountId(expense.account_id);
      setNote(expense.note ?? '');
    } else {
      setCategoryId('');
      setAmountText('');
      setDate(todayISO());
      setAccountId('');
      setNote('');
    }
    setAddingCat(false);
    setNewCat('');
  }, [open, expense]);

  React.useEffect(() => {
    if (!open || expense || !liquidAccounts?.length || accountId) return;
    setAccountId(liquidAccounts[0].id);
  }, [open, expense, liquidAccounts, accountId]);

  React.useEffect(() => {
    if (!open || expense || !categories?.length || categoryId) return;
    setCategoryId(categories[0].id);
  }, [open, expense, categories, categoryId]);

  const save = async () => {
    const amount = parseRupees(amountText);
    if (!categoryId || !accountId || amount <= 0) return;
    setBusy(true);
    try {
      const input = { categoryId, date, amount, accountId, note };
      if (editing && expense?.id) {
        await updateExpense(db, expense.id, input);
      } else {
        await createExpense(db, input);
      }
      haptic('success');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={editing ? 'Edit expense' : 'New expense'} fullPage>
      <div className="space-y-3">
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
              autoFocus={!editing}
              inputMode="decimal"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Date</Label>
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
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was this for?" />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy || parseRupees(amountText) <= 0}>
            {editing ? 'Save changes' : 'Save expense'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
