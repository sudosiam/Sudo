import * as React from 'react';
import { useParams } from 'react-router-dom';
import { usePowerSync } from '@powersync/react';
import { DocForm, type DraftShape } from '../../components/doc/DocForm';
import { createPurchase, updatePurchase } from '../../domain/purchases';
import { paiseToInput } from '../../lib/money';
import type { PurchaseInput } from '../../domain/types';

function resolveEditId(id: string | undefined): string | undefined {
  return id && id !== 'new' ? id : undefined;
}

export default function PurchaseForm() {
  const { id } = useParams<{ id: string }>();
  const editId = resolveEditId(id);
  const db = usePowerSync();

  const onSubmit = React.useCallback(
    async (input: PurchaseInput) => {
      if (editId) await updatePurchase(db, editId, input);
      else await createPurchase(db, input);
    },
    [db, editId],
  );

  const loadExisting = React.useCallback(
    async (purchaseId: string): Promise<DraftShape | null> => {
      const purchase = await db.getOptional<{
        party_id: string;
        date: string;
        bill_no: string;
        discount_pct: number;
        discount_amount: number;
        note: string | null;
      }>(`SELECT party_id, date, bill_no, discount_pct, discount_amount, note FROM purchases WHERE id = ?`, [purchaseId]);
      if (!purchase) return null;
      const party = await db.getOptional<{ id: string; name: string; phone: string | null; address: string | null }>(
        `SELECT id, name, phone, address FROM parties WHERE id = ?`,
        [purchase.party_id],
      );
      const items = await db.getAll<{ item_id: string; name: string; qty: number; unit_price: number }>(
        `SELECT item_id, name, qty, unit_price FROM purchase_items WHERE purchase_id = ?`,
        [purchaseId],
      );
      return {
        party,
        date: purchase.date,
        docNo: purchase.bill_no,
        lines: items.map((i) => ({
          itemId: i.item_id,
          name: i.name,
          qty: i.qty,
          qtyText: String(i.qty),
          unitPrice: i.unit_price,
          priceText: paiseToInput(i.unit_price),
          avgCost: 0,
          unit: null,
        })),
        discountPctText: purchase.discount_pct ? String(purchase.discount_pct) : '',
        discountAmtText: purchase.discount_amount ? paiseToInput(purchase.discount_amount) : '',
        note: purchase.note ?? '',
      };
    },
    [db],
  );

  return <DocForm mode="purchase" editId={editId} onSubmit={onSubmit} loadExisting={loadExisting} />;
}
