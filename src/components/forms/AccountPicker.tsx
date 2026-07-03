import * as React from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';
import { Input } from '../ui/input';
import { Dialog } from '../ui/dialog';
import { ListCard } from '../ListRow';
import { cn } from '../../lib/utils';
import { haptic } from '../../lib/haptics';

export interface AccountOption {
  id: string;
  code: string | null;
  name: string;
  type: string;
}

const TYPE_LABELS: Record<string, string> = {
  asset: 'Assets',
  liability: 'Liabilities',
  equity: 'Equity',
  income: 'Income',
  expense: 'Expenses',
};

const TYPE_ORDER = ['asset', 'liability', 'equity', 'income', 'expense'];

/** Click to open a searchable account list (General Ledger filter, etc.). */
export function AccountPicker({
  value,
  onChange,
  accounts,
  className,
}: {
  value: string;
  onChange: (id: string) => void;
  accounts: AccountOption[];
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  const selected = accounts.find((a) => a.id === value);
  const label = value === 'all' ? 'All accounts' : selected?.name ?? 'Select account';

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.code?.toLowerCase().includes(q) ?? false) ||
        (TYPE_LABELS[a.type]?.toLowerCase().includes(q) ?? false),
    );
  }, [accounts, search]);

  const grouped = React.useMemo(() => {
    return TYPE_ORDER.map((type) => ({
      type,
      label: TYPE_LABELS[type] ?? type,
      items: filtered.filter((a) => a.type === type),
    })).filter((g) => g.items.length > 0);
  }, [filtered]);

  const close = () => {
    setOpen(false);
    setSearch('');
  };

  const pick = (id: string) => {
    haptic();
    onChange(id);
    close();
  };

  const rowCls = (active: boolean) =>
    cn(
      'flex w-full items-center gap-2.5 border-b px-3.5 py-3 text-left text-sm last:border-b-0',
      'transition-colors hover:bg-accent/45 active:bg-accent/70',
      active && 'bg-accent/30',
    );

  return (
    <>
      <button
        type="button"
        onClick={() => {
          haptic();
          setOpen(true);
        }}
        className={cn(
          'flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-input bg-card/85 px-3 text-sm shadow-sm',
          'focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20',
          className,
        )}
      >
        <span className="truncate">{label}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </button>

      <Dialog open={open} onClose={close} title="Select account" fullPage>
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              className="pl-8"
              placeholder="Search accounts…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <ListCard>
            <button type="button" className={rowCls(value === 'all')} onClick={() => pick('all')}>
              <span className="min-w-0 flex-1 font-semibold">All accounts</span>
              {value === 'all' && <Check className="size-4 shrink-0 text-primary" />}
            </button>

            {grouped.map((g) => (
              <React.Fragment key={g.type}>
                <p className="border-b bg-muted/40 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  {g.label}
                </p>
                {g.items.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className={rowCls(value === a.id)}
                    onClick={() => pick(a.id)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{a.name}</p>
                      {a.code && <p className="truncate text-xs text-muted-foreground">{a.code}</p>}
                    </div>
                    {value === a.id && <Check className="size-4 shrink-0 text-primary" />}
                  </button>
                ))}
              </React.Fragment>
            ))}

            {!grouped.length && search.trim() && (
              <p className="px-3.5 py-6 text-center text-sm text-muted-foreground">No accounts match your search.</p>
            )}
          </ListCard>
        </div>
      </Dialog>
    </>
  );
}
