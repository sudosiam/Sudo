import * as React from 'react';
import { useDb } from '../../hooks/useQuery';
import { Plus } from 'lucide-react';
import { useQuery } from '../../hooks/useQuery';
import { Dialog } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Segmented } from '../ui/misc';
import { createItem, updateItem, createItemCategory, type ItemInput } from '../../domain/parties';
import { parseRupees, paiseToInput } from '../../lib/money';
import { haptic } from '../../lib/haptics';

export function ItemDialog({
  open,
  onClose,
  onSaved,
  item,
  defaultName,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: (id: string) => void;
  item?: {
    id: string;
    name: string;
    category_id: string | null;
    unit: string | null;
    selling_price: number | null;
    qty?: number;
    avg_cost?: number;
  };
  defaultName?: string;
}) {
  const db = useDb();
  const [name, setName] = React.useState('');
  const [categoryId, setCategoryId] = React.useState('');
  const [unit, setUnit] = React.useState('');
  const [price, setPrice] = React.useState('');
  const [openingQty, setOpeningQty] = React.useState('');
  const [openingCost, setOpeningCost] = React.useState('');
  const [newCat, setNewCat] = React.useState('');
  const [addingCat, setAddingCat] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const { data: categories } = useQuery<{ id: string; name: string }>({
    queryKey: ['item-categories'],
    query: `SELECT id, name FROM item_categories ORDER BY name COLLATE NOCASE`,
  });

  const { data: txnRows } = useQuery<{ n: number }>({
    queryKey: ['item-txn-count', item?.id],
    query: item?.id
      ? `SELECT (SELECT COUNT(*) FROM sale_items WHERE item_id = ?) +
                (SELECT COUNT(*) FROM purchase_items WHERE item_id = ?) AS n`
      : `SELECT 0 AS n WHERE 0`,
    parameters: item?.id ? [item.id, item.id] : [],
  });

  const showOpening = !item || (txnRows?.[0]?.n ?? 0) === 0;

  React.useEffect(() => {
    if (!open) return;
    setName(item?.name ?? defaultName ?? '');
    setCategoryId(item?.category_id ?? '');
    setUnit(item?.unit ?? '');
    setPrice(item?.selling_price != null ? paiseToInput(item.selling_price) : '');
    setOpeningQty(showOpening ? String(item?.qty ?? 0) : '');
    setOpeningCost(
      showOpening && (item?.avg_cost ?? 0) > 0 ? paiseToInput(item!.avg_cost!) : '',
    );
    setAddingCat(false);
    setNewCat('');
  }, [open, item, defaultName, showOpening]);

  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const parsedOpeningQty = showOpening ? Math.max(0, Number(openingQty) || 0) : undefined;
      const parsedOpeningCost =
        showOpening && openingCost.trim() !== '' ? parseRupees(openingCost) : showOpening ? 0 : undefined;
      const input: ItemInput = {
        name,
        categoryId: categoryId || null,
        unit,
        sellingPrice: price.trim() === '' ? null : parseRupees(price),
        openingQty: parsedOpeningQty,
        openingUnitCost: parsedOpeningCost,
      };
      let id: string;
      if (item) {
        await updateItem(db, item.id, input);
        id = item.id;
      } else {
        id = await createItem(db, input);
      }
      haptic('success');
      onSaved?.(id);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const addCategory = async () => {
    if (!newCat.trim()) return;
    const id = await createItemCategory(db, newCat);
    setCategoryId(id);
    setAddingCat(false);
    setNewCat('');
    haptic('success');
  };

  return (
    <Dialog open={open} onClose={onClose} title={item ? 'Edit item' : 'New item'} fullPage>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Name *</Label>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Item name" />
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
                onKeyDown={(e) => e.key === 'Enter' && addCategory()}
              />
              <Button size="sm" onClick={addCategory}>Add</Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Segmented
                scrollable
                options={[
                  { value: '', label: 'None' },
                  ...(categories ?? []).map((c) => ({ value: c.id, label: c.name })),
                ]}
                value={categoryId}
                onChange={setCategoryId}
                className="w-full"
              />
              <Button variant="outline" size="sm" onClick={() => setAddingCat(true)}>
                <Plus /> New category
              </Button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Unit</Label>
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="pcs, kg, box…" />
          </div>
          <div className="space-y-1.5">
            <Label>Selling price (₹)</Label>
            <Input
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Leave blank if varies"
            />
          </div>
        </div>
        {showOpening && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Opening stock (qty)</Label>
              <Input
                inputMode="decimal"
                value={openingQty}
                onChange={(e) => setOpeningQty(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Opening unit cost (₹)</Label>
              <Input
                inputMode="decimal"
                value={openingCost}
                onChange={(e) => setOpeningCost(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy || !name.trim()}>
            {item ? 'Save changes' : 'Add item'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
