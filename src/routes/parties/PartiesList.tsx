import * as React from 'react';
import { Plus, Search, Users } from 'lucide-react';
import { useQuery } from '../../hooks/useQuery';
import { useFabDialog } from '../../hooks/useFabDialog';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageKpi, PageKpis } from '../../components/layout/PageKpis';
import { ListRow, ListCard } from '../../components/ListRow';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { EmptyState, PageSpinner, Segmented } from '../../components/ui/misc';
import { PartyDialog } from '../../components/forms/PartyDialog';
import { formatPaise } from '../../lib/money';
import { ACC } from '../../domain/accounts';

type Filter = 'all' | 'customer' | 'vendor';

interface Row {
  id: string;
  name: string;
  type: string;
  phone: string | null;
  due: number; // +ve = they owe us (AR), -ve = we owe them
}

export default function PartiesList() {
  const [filter, setFilter] = React.useState<Filter>('all');
  const [search, setSearch] = React.useState('');
  const { open: dialogOpen, openDialog: openPartyDialog, closeDialog: closePartyDialog } = useFabDialog();

  const typeClause =
    filter === 'all' ? '1=1' : filter === 'customer' ? "p.type IN ('customer','both')" : "p.type IN ('vendor','both')";

  const { data: rows, isLoading } = useQuery<Row>({
    queryKey: ['parties-list', filter, search],
    query: `
      SELECT p.id, p.name, p.type, p.phone,
             COALESCE((SELECT SUM(CASE WHEN jl.account_id = '${ACC.AR}' THEN jl.amount
                                       WHEN jl.account_id = '${ACC.AP}' THEN jl.amount END)
                       FROM journal_lines jl WHERE jl.party_id = p.id), 0) AS due
      FROM parties p
      WHERE ${typeClause} AND (p.name LIKE ? OR COALESCE(p.phone,'') LIKE ?)
      ORDER BY p.name COLLATE NOCASE`,
    parameters: [`%${search}%`, `%${search}%`],
  });

  return (
    <div>
      <PageHeader
        title="Parties"
        actions={
          <>
            {!!rows?.length && (
              <PageKpis>
                <PageKpi tone="muted">{rows.length} parties</PageKpi>
              </PageKpis>
            )}
            <Button size="sm" onClick={openPartyDialog}>
              <Plus /> New
            </Button>
          </>
        }
      />

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search name or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Segmented
          options={[
            { value: 'all', label: 'All' },
            { value: 'customer', label: 'Customers' },
            { value: 'vendor', label: 'Vendors' },
          ]}
          value={filter}
          onChange={setFilter}
          className="w-full sm:w-auto"
        />
      </div>

      {isLoading ? (
        <PageSpinner />
      ) : !rows?.length ? (
        <EmptyState
          icon={<Users />}
          title="No parties yet"
          message="Add your customers and vendors to start tracking sales, purchases and dues."
          action={
            <Button size="sm" onClick={openPartyDialog}>
              <Plus /> Add party
            </Button>
          }
        />
      ) : (
        <ListCard>
          {rows.map((p) => (
            <ListRow
              key={p.id}
              to={`/parties/${p.id}`}
              avatarName={p.name}
              title={p.name}
              subtitle={
                <>
                  <span className="capitalize">{p.type}</span>
                  {p.phone ? ` · ${p.phone}` : ''}
                </>
              }
              right={
                p.due !== 0 ? (
                  <span className={p.due > 0 ? 'text-success' : 'text-destructive'}>
                    {formatPaise(Math.abs(p.due))}
                  </span>
                ) : undefined
              }
              rightSub={p.due > 0 ? 'to receive' : p.due < 0 ? 'to pay' : undefined}
            />
          ))}
        </ListCard>
      )}

      <PartyDialog open={dialogOpen} onClose={closePartyDialog} />
    </div>
  );
}
