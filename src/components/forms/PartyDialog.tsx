import * as React from 'react';
import { usePowerSync } from '@powersync/react';
import { Dialog } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select } from '../ui/select';
import { createParty, updateParty, type PartyInput } from '../../domain/parties';
import { haptic } from '../../lib/haptics';

export interface PartyDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved?: (id: string) => void;
  /** existing party to edit */
  party?: { id: string; name: string; type: string; phone: string | null; address: string | null; note: string | null };
  /** defaults for create mode */
  defaultType?: 'customer' | 'vendor';
  defaultName?: string;
}

export function PartyDialog({ open, onClose, onSaved, party, defaultType, defaultName }: PartyDialogProps) {
  const db = usePowerSync();
  const [form, setForm] = React.useState<PartyInput>({
    name: '',
    type: 'customer',
    phone: '',
    address: '',
    note: '',
  });
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setForm({
      name: party?.name ?? defaultName ?? '',
      type: (party?.type as PartyInput['type']) ?? defaultType ?? 'customer',
      phone: party?.phone ?? '',
      address: party?.address ?? '',
      note: party?.note ?? '',
    });
  }, [open, party, defaultType, defaultName]);

  const save = async () => {
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      let id: string;
      if (party) {
        await updateParty(db, party.id, form);
        id = party.id;
      } else {
        id = await createParty(db, form);
      }
      haptic('success');
      onSaved?.(id);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={party ? 'Edit party' : 'New party'} fullPage>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Name *</Label>
          <Input
            autoFocus
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Party name"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as PartyInput['type'] })}>
              <option value="customer">Customer</option>
              <option value="vendor">Vendor</option>
              <option value="both">Both</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="98765 43210"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Address</Label>
          <Input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="City, area…"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Note</Label>
          <Textarea
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="Anything to remember…"
            rows={2}
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy || !form.name.trim()}>
            {party ? 'Save changes' : 'Add party'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
