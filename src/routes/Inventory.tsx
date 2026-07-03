import * as React from 'react';
import { Plus, Search, Boxes } from 'lucide-react';
import { useQuery } from '../hooks/useQuery';
import { useFabDialog } from '../hooks/useFabDialog';
import { PageHeader } from '../components/layout/PageHeader';
import { PageKpi, PageKpis } from '../components/layout/PageKpis';
import { ListRow, ListCard } from '../components/ListRow';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { EmptyState, PageSpinner, Segmented } from '../components/ui/misc';
import { ItemDialog } from '../components/forms/ItemDialog';
import { formatPaiseRounded } from '../lib/money';

interface ItemRow {
  id: string;
  name: string;
  category_id: string | null;
  category_name: string | null;
  unit: string | null;
  selling_price: number | null;
  qty: number;
  avg_cost: number;
}

export default function Inventory() {
  const [search, setSearch] = React.useState('');
  const [category, setCategory] = React.useState('');
  const { open: dialogOpen, openDialog: openItemDialog, closeDialog: closeItemDialog, requested: newRequested } = useFabDialog();

  React.useEffect(() => {
    if (newRequested) openItemDialog();
  }, [newRequested, openItemDialog]);

  const { data: categories } = useQuery<{ id: string; name: string }>({
    queryKey: ['item-categories'],
    query: `SELECT id, name FROM item_categories ORDER BY name COLLATE NOCASE`,
  });

  const { data: totals } = useQuery<{ stock_value: number; item_count: number }>({
    queryKey: ['inventory-totals'],
    query: `SELECT COALESCE(SUM(ROUND(qty * avg_cost)), 0) AS stock_value, COUNT(*) AS item_count FROM items`,
  });

  const { data: items, isLoading } = useQuery<ItemRow>({
    queryKey: ['inventory-items', search, category],
    query: `SELECT i.id, i.name, i.category_id, c.name AS category_name, i.unit, i.selling_price, i.qty, i.avg_cost
            FROM items i LEFT JOIN item_categories c ON c.id = i.category_id
            WHERE i.name LIKE ? ${category ? 'AND i.category_id = ?' : ''}
            ORDER BY i.name COLLATE NOCASE`,
    parameters: category ? [`%${search}%`, category] : [`%${search}%`],
  });

  const categoryOptions = React.useMemo(
    () => [
      { value: '', label: 'All' },
      ...(categories ?? []).map((c) => ({ value: c.id, label: c.name })),
    ],
    [categories],
  );

  return (
    <div>
      <PageHeader
        title="Inventory"
        actions={
          totals?.[0] ? (
            <PageKpis>
              <PageKpi tone="muted">{totals[0].item_count} items</PageKpi>
              <PageKpi>stock {formatPaiseRounded(totals[0].stock_value)}</PageKpi>
            </PageKpis>
          ) : undefined
        }
      />

      <div className="mb-3 space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search items…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {(categoryOptions.length > 1 || category) && (
          <Segmented
            scrollable
            options={categoryOptions}
            value={category}
            onChange={setCategory}
            className="w-full"
          />
        )}
      </div>

      {isLoading ? (
        <PageSpinner />
      ) : !items?.length ? (
        <EmptyState
          icon={<Boxes />}
          title="No items yet"
          message="Add items to track stock, weighted average cost and profit per sale."
          action={
            <Button size="sm" onClick={openItemDialog}>
              <Plus /> Add item
            </Button>
          }
        />
      ) : (
        <ListCard>
          {items.map((item) => (
            <ListRow
              key={item.id}
              to={`/inventory/${item.id}`}
              avatar={
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Boxes className="size-4" />
                </div>
              }
              title={item.name}
              subtitle={item.category_name ?? 'Uncategorised'}
              right={formatPaiseRounded(Math.round(item.qty * item.avg_cost))}
              rightSub={
                <span className={item.qty <= 0 ? 'text-destructive' : undefined}>
                  {item.qty}{item.unit ? ` ${item.unit}` : ''} in stock
                </span>
              }
            />
          ))}
        </ListCard>
      )}

      <ItemDialog open={dialogOpen} onClose={closeItemDialog} />
    </div>
  );
}
