import {
  LayoutDashboard,
  ShoppingCart,
  PackageOpen,
  Users,
  Scale,
  Boxes,
  Landmark,
  BookOpenText,
  ReceiptText,
  PiggyBank,
  Building2,
  ArrowLeftRight,
  BarChart3,
  TrendingUp,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/sales', label: 'Sales', icon: ShoppingCart },
  { to: '/purchases', label: 'Purchases', icon: PackageOpen },
  { to: '/parties', label: 'Parties', icon: Users },
  { to: '/dues', label: 'Payables / Receivables', icon: Scale },
  { to: '/inventory', label: 'Inventory', icon: Boxes },
  { to: '/banking', label: 'Banking', icon: Landmark },
  { to: '/ledger', label: 'General Ledger', icon: BookOpenText },
  { to: '/expenses', label: 'Expenses', icon: ReceiptText },
  { to: '/income', label: 'Other Income', icon: PiggyBank },
  { to: '/assets', label: 'Fixed Assets', icon: Building2 },
  { to: '/payments', label: 'Payments', icon: ArrowLeftRight },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/growth', label: 'Growth', icon: TrendingUp },
  { to: '/settings', label: 'Settings', icon: Settings },
];
