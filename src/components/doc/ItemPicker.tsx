import * as React from 'react';
import { Search, Plus } from 'lucide-react';
import { useQuery } from '../../hooks/useQuery';
import { Input } from '../ui/input';
import { ItemDialog } from '../forms/ItemDialog';
import { formatPaise } from '../../lib/money';
import { haptic } from '../../lib/haptics';

export interface PickedItem {
  id: string;
  name: string;
  unit: string | null;
  selling_price: number | null;
  avg_cost: number;
  qty: number;
}

/** Type-ahead item search with inline creation. Calls onPick and clears itself. */
export function ItemPicker({
  onPick,
  mode,
}: {
  onPick: (item: PickedItem) => void;
  mode: 'sale' | 'purchase';
}) {
  const [text, setText] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const boxRef = React.useRef<HTMLDivElement>(null);

  const { data: matches } = useQuery<PickedItem>({
    queryKey: ['item-picker', text],
    query: `SELECT id, name, unit, selling_price, avg_cost, qty FROM items
            WHERE name LIKE ? ORDER BY name COLLATE NOCASE LIMIT 8`,
    parameters: [`%${text}%`],
  });

  React.useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const pick = (item: PickedItem) => {
    haptic();
    onPick(item);
    setText('');
    setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Add item…"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border bg-popover shadow-md">
          {matches?.map((item) => (
            <button
              key={item.id}
              className="flex w-full items-center gap-2 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent"
              onClick={() => pick(item)}
            >
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {mode === 'sale'
                  ? `stock ${item.qty} · cost ${formatPaise(item.avg_cost)}`
                  : `stock ${item.qty}`}
              </span>
            </button>
          ))}
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-primary hover:bg-accent"
            onClick={() => {
              haptic();
              setCreateOpen(true);
              setOpen(false);
            }}
          >
            <Plus className="size-4" />
            {text.trim() ? `Create "${text.trim()}"` : 'New item'}
          </button>
        </div>
      )}
      <ItemDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        defaultName={text.trim()}
        onSaved={() => {
          setOpen(true);
        }}
      />
    </div>
  );
}
