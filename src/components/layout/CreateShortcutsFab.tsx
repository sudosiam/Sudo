import { Link, useLocation } from 'react-router-dom';
import {
  ShoppingCart,
  PackageOpen,
  Users,
  ReceiptText,
  PiggyBank,
  Boxes,
  Building2,
  ArrowLeftRight,
  Landmark,
  type LucideIcon,
} from 'lucide-react';
import { buttonVariants } from '../ui/button';
import { haptic } from '../../lib/haptics';
import { cn } from '../../lib/utils';

interface PageFabAction {
  label: string;
  to: string;
  icon: LucideIcon;
}

const PAGE_FAB_ACTIONS: Record<string, PageFabAction> = {
  '/sales': { label: 'New sale', to: '/sales/new', icon: ShoppingCart },
  '/purchases': { label: 'New purchase', to: '/purchases/new', icon: PackageOpen },
  '/parties': { label: 'New party', to: '/parties?new=1', icon: Users },
  '/inventory': { label: 'New item', to: '/inventory?new=1', icon: Boxes },
  '/banking': { label: 'Add account', to: '/banking?new=1', icon: Landmark },
  '/expenses': { label: 'New expense', to: '/expenses?new=1', icon: ReceiptText },
  '/income': { label: 'New income', to: '/income?new=1', icon: PiggyBank },
  '/assets': { label: 'New asset', to: '/assets?new=1', icon: Building2 },
  '/payments': { label: 'New payment', to: '/payments?new=1', icon: ArrowLeftRight },
};

export function CreateShortcutsFab() {
  const location = useLocation();
  const action = PAGE_FAB_ACTIONS[location.pathname];

  if (!action) return null;

  const Icon = action.icon;

  return (
    <div className="fab-enter fixed bottom-5 right-4 z-40 sm:bottom-6 sm:right-6">
      <Link
        to={action.to}
        className={cn(buttonVariants({ size: 'icon' }), 'size-12 rounded-full shadow-xl')}
        onClick={() => haptic()}
        aria-label={action.label}
        title={action.label}
      >
        <Icon className="size-5" />
      </Link>
    </div>
  );
}
