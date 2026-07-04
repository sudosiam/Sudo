import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDb } from '../../hooks/useQuery';
import { Pencil, Trash2, Boxes } from 'lucide-react';
import { useQuery } from '../../hooks/useQuery';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/button';
import { EmptyState, PageSpinner } from '../../components/ui/misc';
import { ConfirmDialog } from '../../components/ui/dialog';
import { ItemDialog } from '../../components/forms/ItemDialog';
import { formatPaise, formatPaiseRounded } from '../../lib/money';
import { deleteItem } from '../../domain/parties';
import { haptic } from '../../lib/haptics';

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

function DetailRow({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'destructive' | 'success' }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={
          tone === 'destructive'
            ? 'text-sm font-semibold tabular-nums text-destructive'
            : tone === 'success'
              ? 'text-sm font-semibold tabular-nums text-success'
              : 'text-sm font-semibold tabular-nums'
        }
      >
        {value}
      </span>
    </div>
  );
}

export default function ItemDetail() {
  const { id } = useParams<{ id: string }>();
  const db = useDb();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteBlocked, setDeleteBlocked] = React.useState(false);

  const { data: rows, isLoading } = useQuery<ItemRow>({
    queryKey: ['inventory-item', id],
    query: `SELECT i.id, i.name, i.category_id, c.name AS category_name, i.unit, i.selling_price, i.qty, i.avg_cost
            FROM items i LEFT JOIN item_categories c ON c.id = i.category_id
            WHERE i.id = ?`,
    parameters: [id],
  });

  const item = rows?.[0];
  const stockValue = item ? Math.round(item.qty * item.avg_cost) : 0;
  const margin =
    item?.selling_price != null && item.selling_price > 0 ? item.selling_price - item.avg_cost : null;

  if (isLoading) return <PageSpinner />;
  if (!item) return <EmptyState title="Item not found" />;

  const handleDelete = async () => {
    const ok = await deleteItem(db, item.id);
    if (ok) {
      haptic('success');
      navigate('/inventory');
    } else {
      haptic('error');
      setDeleteBlocked(true);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={item.name}
        subtitle={
          <>
            {item.category_name ?? 'Uncategorised'}
            {item.unit ? ` · ${item.unit}` : ''}
          </>
        }
        back="/inventory"
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
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Boxes className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Stock value</p>
          <p className="text-2xl font-bold tabular-nums">{formatPaiseRounded(stockValue)}</p>
        </div>
      </div>

      <div className="app-surface overflow-hidden">
        <DetailRow
          label="In stock"
          value={`${item.qty}${item.unit ? ` ${item.unit}` : ''}`}
          tone={item.qty <= 0 ? 'destructive' : undefined}
        />
        <DetailRow label="Average cost" value={formatPaise(item.avg_cost)} />
        <DetailRow
          label="Selling price"
          value={item.selling_price != null ? formatPaise(item.selling_price) : '—'}
        />
        {margin != null && (
          <DetailRow
            label="Margin per unit"
            value={formatPaise(margin)}
            tone={margin >= 0 ? 'success' : 'destructive'}
          />
        )}
      </div>

      <ItemDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        item={{
          id: item.id,
          name: item.name,
          category_id: item.category_id,
          unit: item.unit,
          selling_price: item.selling_price,
          qty: item.qty,
          avg_cost: item.avg_cost,
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title={`Delete "${item.name}"?`}
        message="Only possible when the item has no sales or purchases."
      />
      <ConfirmDialog
        open={deleteBlocked}
        onClose={() => setDeleteBlocked(false)}
        onConfirm={() => setDeleteBlocked(false)}
        title="Cannot delete"
        message="This item is used in sales or purchases."
        confirmLabel="OK"
        destructive={false}
      />
    </div>
  );
}
