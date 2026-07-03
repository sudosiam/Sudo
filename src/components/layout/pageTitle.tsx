import * as React from 'react';
import { NAV_ITEMS } from './nav';

export interface PageTitleState {
  title: React.ReactNode | null;
  subtitle: React.ReactNode | null;
  backTo: string | null;
}

export const emptyPageTitle: PageTitleState = { title: null, subtitle: null, backTo: null };

/** Parent list route for a subpage, or an explicit `back` path from PageHeader. */
export function subpageBackPath(pathname: string, back?: boolean | string): string | null {
  if (typeof back === 'string') return back;
  if (back === false) return null;
  const parent = NAV_ITEMS.find((item) =>
    item.to === '/'
      ? pathname === '/'
      : pathname === item.to || pathname.startsWith(`${item.to}/`),
  );
  if (!parent || pathname === parent.to) return null;
  return parent.to;
}

const PageTitleContext = React.createContext<{
  pageTitle: PageTitleState;
  setPageTitle: (next: PageTitleState) => void;
} | null>(null);

export function isSubpage(pathname: string): boolean {
  if (pathname === '/') return false;
  const parent = NAV_ITEMS.find((item) =>
    item.to === '/'
      ? pathname === '/'
      : pathname === item.to || pathname.startsWith(`${item.to}/`),
  );
  if (!parent) return true;
  return pathname !== parent.to;
}

export function PageTitleProvider({ children }: { children: React.ReactNode }) {
  const [pageTitle, setPageTitle] = React.useState<PageTitleState>(emptyPageTitle);
  const value = React.useMemo(() => ({ pageTitle, setPageTitle }), [pageTitle]);
  return <PageTitleContext.Provider value={value}>{children}</PageTitleContext.Provider>;
}

export function usePageTitleContext() {
  const ctx = React.useContext(PageTitleContext);
  if (!ctx) throw new Error('usePageTitleContext must be used within PageTitleProvider');
  return ctx;
}
