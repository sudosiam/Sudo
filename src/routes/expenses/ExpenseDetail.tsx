import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePowerSync } from '@powersync/react';
import { Pencil, Trash2, ReceiptText } from 'lucide-react';
import { useQuery } from '../../hooks/useQuery';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/button';
import { EmptyState, PageSpinner } from '../../components/ui/misc';
import { ConfirmDialog } from '../../components/ui/dialog';
import { ExpenseDialog } from '../../components/forms/ExpenseDialog';
import { formatPaise, formatPaiseRounded } from '../../lib/money';
import { formatISODate } from '../../lib/dates';
import { deleteExpense } from '../../domain/simple';
import { haptic } from '../../lib/haptics';

interface ExpenseRow {
  id: string;
  category_id: string;
  date: string;
  amount: number;
  account_id: string;
  note: string | null;
  category_name: string;
  account_name: string | null;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}

export default function ExpenseDetail() {
  const { id } = useParams<{ id: string }>();
  const db = usePowerSync();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const { data: rows, isLoading } = useQuery<ExpenseRow>({
    queryKey: ['expense', id],
    query: `SELECT e.id, e.category_id, e.date, e.amount, e.account_id, e.note,
                   c.name AS category_name, a.name AS account_name
            FROM expenses e
            JOIN accounts c ON c.id = e.category_id
            LEFT JOIN accounts a ON a.id = e.account_id
            WHERE e.id = ?`,
    parameters: [id],
  });

  const expense = rows?.[0];

  if (isLoading) return <PageSpinner />;
  if (!expense) return <EmptyState title="Expense not found" />;

  const title = expense.note?.trim() || expense.category_name;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={title}
        subtitle={formatISODate(expense.date)}
        back="/expenses"
        actions={
          <>
            <Button variant="outline" size="icon-sm" onClick={() => setEditOpen(true)} aria-label="Edit">
              <Pencil />
            </Button>
            <Button variant="outline" size="icon-sm" onClick={() => setDeleteOpen(true)} aria-label="Delete">
              <Trash2 className="text-destructive" />
            </Button>
          </>
        }
      />

      <div className="app-surface mb-4 flex items-center gap-3 p-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ReceiptText className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Amount</p>
          <p className="text-2xl font-bold tabular-nums text-destructive">−{formatPaiseRounded(expense.amount)}</p>
        </div>
      </div>

      <div className="app-surface overflow-hidden">
        <DetailRow label="Category" value={expense.category_name} />
        <DetailRow label="Paid from" value={expense.account_name ?? '—'} />
        {expense.note?.trim() && <DetailRow label="Note" value={expense.note} />}
        <DetailRow label="Exact amount" value={formatPaise(expense.amount)} />
      </div>

      <ExpenseDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        expense={{
          id: expense.id,
          category_id: expense.category_id,
          date: expense.date,
          amount: expense.amount,
          account_id: expense.account_id,
          note: expense.note,
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={async () => {
          await deleteExpense(db, expense.id);
          haptic('success');
          navigate('/expenses');
        }}
        title="Delete this expense?"
        message="The ledger entry will be reversed."
      />
    </div>
  );
}
