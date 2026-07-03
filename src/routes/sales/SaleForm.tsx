import * as React from 'react';
import { useParams } from 'react-router-dom';
import { usePowerSync } from '@powersync/react';
import { DocForm, type DraftShape } from '../../components/doc/DocForm';
import { createSale, updateSale } from '../../domain/sales';
import { paiseToInput } from '../../lib/money';
import type { SaleInput } from '../../domain/types';

function resolveEditId(id: string | undefined): string | undefined {
  return id && id !== 'new' ? id : undefined;
}

export default function SaleForm() {
  const { id } = useParams<{ id: string }>();
  const editId = resolveEditId(id);
  const db = usePowerSync();

  const onSubmit = React.useCallback(
    async (input: SaleInput) => {
      if (editId) await updateSale(db, editId, input);
      else await createSale(db, input);
    },
    [db, editId],
  );

  const loadExisting = React.useCallback(
    async (saleId: string): Promise<DraftShape | null> => {
      const sale = await db.getOptional<{
        party_id: string;
        date: string;
        invoice_no: string;
        discount_pct: number;
        discount_amount: number;
        note: string | null;
      }>(`SELECT party_id, date, invoice_no, discount_pct, discount_amount, note FROM sales WHERE id = ?`, [saleId]);
      if (!sale) return null;
      const party = await db.getOptional<{ id: string; name: string; phone: string | null; address: string | null }>(
        `SELECT id, name, phone, address FROM parties WHERE id = ?`,
        [sale.party_id],
      );
      const items = await db.getAll<{
        item_id: string;
        name: string;
        qty: number;
        unit_price: number;
        unit_cost: number;
      }>(`SELECT item_id, name, qty, unit_price, unit_cost FROM sale_items WHERE sale_id = ?`, [saleId]);
      return {
        party,
        date: sale.date,
        docNo: sale.invoice_no,
        lines: items.map((i) => ({
          itemId: i.item_id,
          name: i.name,
          qty: i.qty,
          qtyText: String(i.qty),
          unitPrice: i.unit_price,
          priceText: paiseToInput(i.unit_price),
          avgCost: i.unit_cost,
          unit: null,
        })),
        discountPctText: sale.discount_pct ? String(sale.discount_pct) : '',
        discountAmtText: sale.discount_amount ? paiseToInput(sale.discount_amount) : '',
        note: sale.note ?? '',
      };
    },
    [db],
  );

  return <DocForm mode="sale" editId={editId} onSubmit={onSubmit} loadExisting={loadExisting} />;
}
