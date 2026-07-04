import * as React from 'react';
import { useDb } from '../hooks/useQuery';
import { useSearchParams } from 'react-router-dom';
import { Plus, ReceiptText, Repeat } from 'lucide-react';
import { useQuery, useDateClause } from '../hooks/useQuery';
import { useFabDialog } from '../hooks/useFabDialog';
import { PageHeader } from '../components/layout/PageHeader';
import { PageKpi, PageKpis } from '../components/layout/PageKpis';
import { ListRow, ListCard } from '../components/ListRow';
import { Button } from '../components/ui/button';
import { EmptyState, ListCardSkeleton } from '../components/ui/misc';
import { ExpenseDialog } from '../components/forms/ExpenseDialog';
import {
  RecurringExpenseDialog,
  type RecurringExpenseFormValues,
} from '../components/forms/RecurringExpenseDialog';
import { postRecurringExpense, isRecurringDue } from '../domain/recurringExpenses';
import { formatPaise, formatPaiseRounded } from '../lib/money';
import { currentMonthKey, formatISODateShort } from '../lib/dates';
import { haptic } from '../lib/haptics';

interface ExpenseRow {
  id: string;
  date: string;
  amount: number;
  note: string | null;
  category_name: string;
  account_name: string | null;
}

interface RecurringRow {
  id: string;
  label: string;
  amount: number;
  day_of_month: number;
  active: number;
  last_posted_month: string | null;
  note: string | null;
  category_name: string;
  account_name: string | null;
  category_id: string;
  account_id: string;
}

export default function Expenses() {
  const db = useDb();
  const [searchParams, setSearchParams] = useSearchParams();
  const { open: addOpen, openDialog: openAddDialog, closeDialog: closeAddDialog, requested: newRequested } = useFabDialog();
  const [recurringOpen, setRecurringOpen] = React.useState(false);
  const [editingRecurring, setEditingRecurring] = React.useState<RecurringExpenseFormValues | undefined>();
  const [postingId, setPostingId] = React.useState<string | null>(null);
  const { clause, params } = useDateClause('date');
  const monthKey = currentMonthKey();

  React.useEffect(() => {
    if (newRequested) openAddDialog();
  }, [newRequested, openAddDialog]);

  React.useEffect(() => {
    if (searchParams.get('recurring') === '1') {
      setRecurringOpen(true);
      setEditingRecurring(undefined);
      searchParams.delete('recurring');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const { data: rows, isLoading } = useQuery<ExpenseRow>({
    queryKey: ['expenses', clause, ...params],
    query: `SELECT e.id, e.date, e.amount, e.note, c.name AS category_name, a.name AS account_name
            FROM expenses e
            JOIN accounts c ON c.id = e.category_id
            LEFT JOIN accounts a ON a.id = e.account_id
            WHERE ${clause.replaceAll('date', 'e.date')}
            ORDER BY e.date DESC, e.created_at DESC`,
    parameters: params,
  });

  const { data: recurring } = useQuery<RecurringRow>({
    queryKey: ['recurring-expenses'],
    query: `SELECT r.id, r.label, r.amount, r.day_of_month, r.active, r.last_posted_month, r.note,
                   r.category_id, r.account_id,
                   c.name AS category_name, a.name AS account_name
            FROM recurring_expenses r
            JOIN accounts c ON c.id = r.category_id
            LEFT JOIN accounts a ON a.id = r.account_id
            ORDER BY r.active DESC, r.day_of_month ASC, r.label COLLATE NOCASE`,
  });

  const total = (rows ?? []).reduce((s, r) => s + r.amount, 0);
  const dueRecurring = (recurring ?? []).filter(
    (r) => r.active === 1 && isRecurringDue(r.last_posted_month, monthKey, true),
  );

  const openNewRecurring = () => {
    setEditingRecurring(undefined);
    setRecurringOpen(true);
  };

  const openEditRecurring = (r: RecurringRow) => {
    setEditingRecurring({
      id: r.id,
      label: r.label,
      category_id: r.category_id,
      amount: r.amount,
      account_id: r.account_id,
      day_of_month: r.day_of_month,
      active: r.active,
      note: r.note,
    });
    setRecurringOpen(true);
  };

  const recordRecurring = async (id: string) => {
    setPostingId(id);
    try {
      await postRecurringExpense(db, id);
      haptic('success');
    } finally {
      setPostingId(null);
    }
  };

  const closeRecurringDialog = () => {
    setRecurringOpen(false);
    setEditingRecurring(undefined);
  };

  const hasRecurring = (recurring?.length ?? 0) > 0;
  const showEmpty = !isLoading && !rows?.length && !hasRecurring;

  return (
    <div>
      <PageHeader
        title="Expenses"
        actions={
          <>
            <PageKpis>
              {dueRecurring.length > 0 && (
                <PageKpi tone="destructive">{dueRecurring.length} due</PageKpi>
              )}
              <PageKpi tone="muted">{rows?.length ?? 0} expenses</PageKpi>
              <PageKpi tone="destructive">{formatPaiseRounded(total)}</PageKpi>
            </PageKpis>
            <Button size="sm" onClick={openAddDialog}>
              <Plus className="size-4" /> New expense
            </Button>
          </>
        }
      />

      {dueRecurring.length > 0 && (
        <section className="mb-4">
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Due this month</h2>
          </div>
          <ListCard>
            {dueRecurring.map((r) => (
              <ListRow
                key={r.id}
                avatar={
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400">
                    <Repeat className="size-4" />
                  </div>
                }
                title={r.label}
                subtitle={`${r.category_name} · day ${r.day_of_month}`}
                right={<span className="text-destructive">−{formatPaise(r.amount)}</span>}
                trailing={
                  <Button
                    size="sm"
                    variant="secondary"
                    className="ml-1 h-8 shrink-0"
                    disabled={postingId === r.id}
                    onClick={() => recordRecurring(r.id)}
                  >
                    Record
                  </Button>
                }
              />
            ))}
          </ListCard>
        </section>
      )}

      <section className="mb-4">
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recurring</h2>
          {hasRecurring && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={openNewRecurring}>
              <Plus className="size-3.5" /> Add
            </Button>
          )}
        </div>
        {hasRecurring ? (
            <ListCard>
              {recurring!.map((r) => (
                <ListRow
                  key={r.id}
                  avatar={
                    <div className={`flex size-9 shrink-0 items-center justify-center rounded-full ${r.active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      <Repeat className="size-4" />
                    </div>
                  }
                  title={r.label}
                  subtitle={
                    <>
                      {r.category_name} · day {r.day_of_month}
                      {r.active ? '' : ' · paused'}
                      {r.last_posted_month ? ` · last ${r.last_posted_month}` : ''}
                    </>
                  }
                  right={<span className={r.active ? 'text-destructive' : 'text-muted-foreground'}>−{formatPaise(r.amount)}</span>}
                  trailing={
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-1 h-8 shrink-0 text-xs"
                      onClick={() => openEditRecurring(r)}
                    >
                      Edit
                    </Button>
                  }
                />
              ))}
            </ListCard>
          ) : (
            <button
              type="button"
              onClick={openNewRecurring}
              className="flex w-full items-center gap-3 rounded-xl border border-dashed px-3.5 py-3 text-left text-sm text-muted-foreground transition-colors hover:bg-accent/45 active:bg-accent/70"
            >
              <Repeat className="size-4 shrink-0" />
              <span>Set up rent, salaries, or other monthly expenses</span>
            </button>
          )}
        </section>

      {isLoading ? (
        <ListCardSkeleton />
      ) : showEmpty ? (
        <EmptyState
          icon={<ReceiptText />}
          title="No expenses this period"
          message="Record rent, salaries, utilities and any custom category."
          action={
            <Button size="sm" onClick={openAddDialog}>
              <Plus /> Add expense
            </Button>
          }
        />
      ) : rows?.length ? (
        <section>
          <div className="mb-2 px-1">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">This period</h2>
          </div>
          <ListCard>
            {rows.map((e) => (
              <ListRow
                key={e.id}
                to={`/expenses/${e.id}`}
                avatar={
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                    <ReceiptText className="size-4" />
                  </div>
                }
                title={e.note?.trim() || e.category_name}
                subtitle={
                  <>
                    {formatISODateShort(e.date)} · {e.category_name}
                    {e.account_name ? ` · ${e.account_name}` : ''}
                  </>
                }
                right={<span className="text-destructive">−{formatPaise(e.amount)}</span>}
              />
            ))}
          </ListCard>
        </section>
      ) : null}

      <ExpenseDialog open={addOpen} onClose={closeAddDialog} />
      <RecurringExpenseDialog open={recurringOpen} onClose={closeRecurringDialog} recurring={editingRecurring} />
    </div>
  );
}
