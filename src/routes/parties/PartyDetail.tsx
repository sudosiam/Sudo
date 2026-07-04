import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePowerSync } from '@powersync/react';
import { Pencil, Trash2, Phone, MapPin, StickyNote, FileDown } from 'lucide-react';
import { useQuery } from '../../hooks/useQuery';
import { PageHeader } from '../../components/layout/PageHeader';
import { ListRow, ListCard } from '../../components/ListRow';
import { Button } from '../../components/ui/button';
import { Avatar, EmptyState, PageSpinner, Segmented } from '../../components/ui/misc';
import { PayStatusBadge } from '../../components/ui/badge';
import { ConfirmDialog } from '../../components/ui/dialog';
import { PartyDialog } from '../../components/forms/PartyDialog';
import { formatPaise } from '../../lib/money';
import { formatISODateShort } from '../../lib/dates';
import { ACC } from '../../domain/accounts';
import { deleteParty } from '../../domain/parties';
import { getSetting } from '../../domain/settings';
import { haptic } from '../../lib/haptics';

type Tab = 'sales' | 'purchases' | 'payments' | 'ledger';

interface PartyRow {
  id: string;
  name: string;
  type: string;
  phone: string | null;
  address: string | null;
  note: string | null;
}

interface LedgerRow {
  date: string;
  memo: string;
  amount: number;
  created_at: string;
}

export default function PartyDetail() {
  const { id } = useParams<{ id: string }>();
  const db = usePowerSync();
  const navigate = useNavigate();
  const [tab, setTab] = React.useState<Tab>('sales');
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteBlocked, setDeleteBlocked] = React.useState(false);

  const { data: parties, isLoading } = useQuery<PartyRow>({
    queryKey: ['party', id],
    query: `SELECT id, name, type, phone, address, note FROM parties WHERE id = ?`,
    parameters: [id],
  });
  const party = parties?.[0];

  const { data: dueRows } = useQuery<{ ar: number; ap: number }>({
    queryKey: ['party-due', id],
    query: `SELECT
        COALESCE(SUM(CASE WHEN account_id = '${ACC.AR}' THEN amount END), 0) AS ar,
        COALESCE(SUM(CASE WHEN account_id = '${ACC.AP}' THEN amount END), 0) AS ap
      FROM journal_lines WHERE party_id = ?`,
    parameters: [id],
  });
  const receivable = dueRows?.[0]?.ar ?? 0;
  const payable = -(dueRows?.[0]?.ap ?? 0);

  const { data: sales } = useQuery<{ id: string; invoice_no: string; date: string; total: number; status: string }>({
    queryKey: ['party-sales', id],
    query: `SELECT id, invoice_no, date, total, status FROM sales WHERE party_id = ? ORDER BY date DESC, created_at DESC LIMIT 100`,
    parameters: [id],
  });
  const { data: purchases } = useQuery<{ id: string; bill_no: string; date: string; total: number; status: string }>({
    queryKey: ['party-purchases', id],
    query: `SELECT id, bill_no, date, total, status FROM purchases WHERE party_id = ? ORDER BY date DESC, created_at DESC LIMIT 100`,
    parameters: [id],
  });
  const { data: payments } = useQuery<{ id: string; direction: string; date: string; amount: number; method: string | null }>({
    queryKey: ['party-payments', id],
    query: `SELECT id, direction, date, amount, method FROM payments WHERE party_id = ? ORDER BY date DESC, created_at DESC LIMIT 100`,
    parameters: [id],
  });
  const { data: ledger } = useQuery<LedgerRow>({
    queryKey: ['party-ledger', id],
    query: `SELECT jl.date AS date, je.memo AS memo, jl.amount AS amount, je.created_at AS created_at
            FROM journal_lines jl JOIN journal_entries je ON je.id = jl.entry_id
            WHERE jl.party_id = ? AND jl.account_id IN ('${ACC.AR}', '${ACC.AP}')
            ORDER BY jl.date, je.created_at`,
    parameters: [id],
  });

  const ledgerWithBalance = React.useMemo(() => {
    let bal = 0;
    return (ledger ?? []).map((r) => {
      bal += r.amount;
      return { ...r, balance: bal };
    });
  }, [ledger]);

  if (isLoading) return <PageSpinner />;
  if (!party) return <EmptyState title="Party not found" />;

  const handleDelete = async () => {
    const ok = await deleteParty(db, party.id);
    if (ok) {
      haptic('success');
      navigate('/parties');
    } else {
      haptic('error');
      setDeleteBlocked(true);
    }
  };

  const downloadPdf = async () => {
    haptic();
    const businessName = await getSetting(db, 'business_name');
    const { exportPartyLedgerPDF } = await import('../../lib/pdf');
    exportPartyLedgerPDF({
      businessName,
      partyName: party.name,
      phone: party.phone,
      rows: ledgerWithBalance.map((r) => ({
        date: r.date,
        memo: r.memo || '',
        debit: r.amount > 0 ? r.amount : 0,
        credit: r.amount < 0 ? -r.amount : 0,
        balance: r.balance,
      })),
      closing: ledgerWithBalance.at(-1)?.balance ?? 0,
    });
  };

  return (
    <div>
      <PageHeader
        title={party.name}
        subtitle={<span className="capitalize">{party.type}</span>}
        back="/parties"
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

      {/* Contact card */}
      <div className="app-surface mb-3 flex items-start gap-3 p-4">
        <Avatar name={party.name} className="size-12 text-sm" />
        <div className="min-w-0 flex-1 space-y-1 text-sm">
          {party.phone && (
            <a href={`tel:${party.phone}`} className="flex items-center gap-2 text-primary">
              <Phone className="size-3.5" /> {party.phone}
            </a>
          )}
          {party.address && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" /> {party.address}
            </p>
          )}
          {party.note && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <StickyNote className="size-3.5 shrink-0" /> {party.note}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          {receivable !== 0 && (
            <p className="text-sm font-semibold text-success tabular-nums">{formatPaise(receivable)}</p>
          )}
          {receivable !== 0 && <p className="text-[11px] text-muted-foreground">to receive</p>}
          {payable !== 0 && (
            <p className="text-sm font-semibold text-destructive tabular-nums">{formatPaise(payable)}</p>
          )}
          {payable !== 0 && <p className="text-[11px] text-muted-foreground">to pay</p>}
        </div>
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          options={[
            { value: 'sales', label: 'Sales' },
            { value: 'purchases', label: 'Purchases' },
            { value: 'payments', label: 'Payments' },
            { value: 'ledger', label: 'Ledger' },
          ]}
          value={tab}
          onChange={setTab}
          className="w-full sm:w-auto"
        />
        {tab === 'ledger' && (
          <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={downloadPdf}>
            <FileDown /> PDF
          </Button>
        )}
      </div>

      {tab === 'sales' &&
        (!sales?.length ? (
          <EmptyState title="No sales with this party" />
        ) : (
          <ListCard>
            {sales.map((s) => (
              <ListRow
                key={s.id}
                to={`/sales/${s.id}`}
                title={s.invoice_no}
                subtitle={formatISODateShort(s.date)}
                right={formatPaise(s.total)}
                rightSub={<PayStatusBadge status={s.status} />}
              />
            ))}
          </ListCard>
        ))}

      {tab === 'purchases' &&
        (!purchases?.length ? (
          <EmptyState title="No purchases from this party" />
        ) : (
          <ListCard>
            {purchases.map((p) => (
              <ListRow
                key={p.id}
                to={`/purchases/${p.id}`}
                title={p.bill_no}
                subtitle={formatISODateShort(p.date)}
                right={formatPaise(p.total)}
                rightSub={<PayStatusBadge status={p.status} />}
              />
            ))}
          </ListCard>
        ))}

      {tab === 'payments' &&
        (!payments?.length ? (
          <EmptyState title="No payments with this party" />
        ) : (
          <ListCard>
            {payments.map((p) => (
              <ListRow
                key={p.id}
                to={`/payments/${p.id}`}
                title={p.direction === 'in' ? 'Payment received' : 'Payment made'}
                subtitle={`${formatISODateShort(p.date)}${p.method ? ` · ${p.method}` : ''}`}
                right={
                  <span className={p.direction === 'in' ? 'text-success' : 'text-destructive'}>
                    {p.direction === 'in' ? '+' : '−'}{formatPaise(p.amount)}
                  </span>
                }
              />
            ))}
          </ListCard>
        ))}

      {tab === 'ledger' &&
        (!ledgerWithBalance.length ? (
          <EmptyState title="No ledger entries" />
        ) : (
          <ListCard>
            <div className="app-table-wrap">
              <table className="app-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Particulars</th>
                    <th className="app-table-right">Debit</th>
                    <th className="app-table-right">Credit</th>
                    <th className="app-table-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerWithBalance.map((r, i) => (
                    <tr key={i}>
                      <td className="text-xs text-muted-foreground">
                        {formatISODateShort(r.date)}
                      </td>
                      <td>{r.memo}</td>
                      <td className="app-table-right">{r.amount > 0 ? formatPaise(r.amount) : ''}</td>
                      <td className="app-table-right">{r.amount < 0 ? formatPaise(-r.amount) : ''}</td>
                      <td className="app-table-right font-semibold">
                        {formatPaise(Math.abs(r.balance))}
                        <span className="ml-1 text-[10px] text-muted-foreground">
                          {r.balance >= 0 ? 'Dr' : 'Cr'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ListCard>
        ))}

      <PartyDialog open={editOpen} onClose={() => setEditOpen(false)} party={party} />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete this party?"
        message="Only possible when the party has no sales, purchases, payments, or ledger activity."
      />
      <ConfirmDialog
        open={deleteBlocked}
        onClose={() => setDeleteBlocked(false)}
        onConfirm={() => setDeleteBlocked(false)}
        title="Cannot delete"
        message="This party has linked transactions. Delete those first, or keep the party."
        confirmLabel="OK"
        destructive={false}
      />
    </div>
  );
}
