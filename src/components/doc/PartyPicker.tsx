import * as React from 'react';
import { Search, Plus, X, Phone, MapPin } from 'lucide-react';
import { usePowerSync } from '@powersync/react';
import { useQuery } from '../../hooks/useQuery';
import { Input } from '../ui/input';
import { Avatar } from '../ui/misc';
import { PartyDialog } from '../forms/PartyDialog';
import { haptic } from '../../lib/haptics';

export interface PickedParty {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
}

/**
 * Type-ahead party search. Typing filters the list; if no match exists,
 * offers inline creation pre-filled with what was typed.
 */
export function PartyPicker({
  value,
  onChange,
  partyKind,
}: {
  value: PickedParty | null;
  onChange: (p: PickedParty | null) => void;
  partyKind: 'customer' | 'vendor';
}) {
  const db = usePowerSync();
  const [text, setText] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const boxRef = React.useRef<HTMLDivElement>(null);

  const { data: matches } = useQuery<PickedParty>({
    queryKey: ['party-picker', partyKind, text],
    query: `SELECT id, name, phone, address FROM parties
            WHERE type IN (?, 'both') AND (name LIKE ? OR COALESCE(phone,'') LIKE ?)
            ORDER BY name COLLATE NOCASE LIMIT 8`,
    parameters: [partyKind, `%${text}%`, `%${text}%`],
  });

  React.useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  if (value) {
    return (
      <div className="flex items-start gap-3 rounded-lg border bg-card p-3">
        <Avatar name={value.name} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{value.name}</p>
          <div className="mt-0.5 space-y-0.5 text-xs text-muted-foreground">
            {value.phone && (
              <p className="flex items-center gap-1.5"><Phone className="size-3" />{value.phone}</p>
            )}
            {value.address && (
              <p className="flex items-center gap-1.5"><MapPin className="size-3" />{value.address}</p>
            )}
          </div>
        </div>
        <button
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={() => {
            haptic();
            onChange(null);
            setText('');
          }}
          aria-label="Change party"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder={`Search ${partyKind}…`}
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
          {matches?.map((p) => (
            <button
              key={p.id}
              className="flex w-full items-center gap-2.5 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent"
              onClick={() => {
                haptic();
                onChange(p);
                setOpen(false);
              }}
            >
              <Avatar name={p.name} className="size-7 text-[10px]" />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              {p.phone && <span className="text-xs text-muted-foreground">{p.phone}</span>}
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
            {text.trim() ? `Create "${text.trim()}"` : `New ${partyKind}`}
          </button>
        </div>
      )}
      <PartyDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        defaultName={text.trim()}
        defaultType={partyKind}
        onSaved={async (id) => {
          const p = await db.get<PickedParty>(
            `SELECT id, name, phone, address FROM parties WHERE id = ?`,
            [id],
          );
          onChange(p);
        }}
      />
    </div>
  );
}
