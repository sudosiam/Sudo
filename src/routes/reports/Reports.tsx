import { Link } from 'react-router-dom';
import {
  ListTree,
  Scale,
  Landmark,
  TrendingUp,
  ShoppingCart,
  PackageOpen,
  ReceiptText,
  Boxes,
  ChevronRight,
} from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageKpi, PageKpis } from '../../components/layout/PageKpis';
import { ListCard } from '../../components/ListRow';
import { haptic } from '../../lib/haptics';

const REPORTS = [
  { slug: 'chart-of-accounts', label: 'Chart of Accounts', desc: 'All accounts with balances', icon: ListTree },
  { slug: 'trial-balance', label: 'Trial Balance', desc: 'Debit / credit totals per account', icon: Scale },
  { slug: 'balance-sheet', label: 'Balance Sheet', desc: 'Assets, liabilities & equity', icon: Landmark },
  { slug: 'profit-loss', label: 'Profit & Loss', desc: 'Revenue, costs, expenses & net profit', icon: TrendingUp },
  { slug: 'sales', label: 'Sales Report', desc: 'Customer-wise & monthly totals', icon: ShoppingCart },
  { slug: 'purchases', label: 'Purchase Report', desc: 'Vendor-wise & monthly totals', icon: PackageOpen },
  { slug: 'expenses', label: 'Expense Report', desc: 'Category-wise breakdown', icon: ReceiptText },
  { slug: 'inventory', label: 'Inventory Report', desc: 'Stock, value & margins', icon: Boxes },
];

export default function Reports() {
  return (
    <div>
      <PageHeader
        title="Reports"
        actions={
          <PageKpis>
            <PageKpi tone="muted">{REPORTS.length} reports</PageKpi>
          </PageKpis>
        }
      />
      <ListCard>
        {REPORTS.map(({ slug, label, desc, icon: Icon }) => (
          <Link
            key={slug}
            to={`/reports/${slug}`}
            className="flex items-center gap-3 border-b px-3 py-3 last:border-b-0 hover:bg-accent/50"
            onClick={() => haptic()}
          >
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
            <ChevronRight className="size-4 text-muted-foreground/40" />
          </Link>
        ))}
      </ListCard>
    </div>
  );
}
