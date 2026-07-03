import * as React from 'react';
import { useLocation } from 'react-router-dom';
import { NAV_ITEMS } from './nav';
import { cn } from '../../lib/utils';
import { subpageBackPath, emptyPageTitle, isSubpage, usePageTitleContext } from './pageTitle';

export function PageHeader({
  title,
  subtitle,
  back,
  actions,
  actionsClassName,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Back target for the app shell header on subpages. Defaults to the parent nav route. */
  back?: boolean | string;
  actions?: React.ReactNode;
  actionsClassName?: string;
  className?: string;
}) {
  const location = useLocation();
  const { setPageTitle } = usePageTitleContext();
  const subpage = isSubpage(location.pathname);

  const activeNavLabel = React.useMemo(() => {
    const active = NAV_ITEMS.find((item) =>
      item.to === '/'
        ? location.pathname === '/'
        : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`),
    );
    return active?.label;
  }, [location.pathname]);

  React.useEffect(() => {
    if (!subpage) return;
    setPageTitle({
      title: title ?? null,
      subtitle: subtitle ?? null,
      backTo: subpageBackPath(location.pathname, back),
    });
    return () => setPageTitle(emptyPageTitle);
  }, [subpage, title, subtitle, back, location.pathname, setPageTitle]);

  const hideDuplicateTitle =
    !subpage &&
    typeof title === 'string' &&
    !!activeNavLabel &&
    title.trim().toLowerCase() === activeNavLabel.trim().toLowerCase();

  const showTitle = !hideDuplicateTitle;

  if (subpage) {
    if (!actions) return null;
    return (
      <div className={cn('mb-4 flex justify-end gap-2 sm:mb-5', className, actionsClassName)}>
        {actions}
      </div>
    );
  }

  if (!showTitle && !subtitle && !actions) {
    return null;
  }

  if (!showTitle && !subtitle && actions) {
    return (
      <div
        className={cn(
          'mb-3 flex flex-wrap items-center justify-end gap-2 sm:mb-4',
          className,
          actionsClassName,
        )}
      >
        {actions}
      </div>
    );
  }

  return (
    <div className={cn('mb-4 flex flex-wrap items-start gap-2.5 sm:mb-5 sm:items-center sm:gap-3', className)}>
      <div className="min-w-0 flex-1">
        {showTitle && <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">{title}</h1>}
        {subtitle && (
          <p className={cn('truncate text-xs text-muted-foreground', showTitle ? 'mt-0.5' : undefined)}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div
          className={cn(
            'flex w-auto flex-wrap items-center justify-end gap-2 sm:flex-nowrap',
            actionsClassName,
          )}
        >
          {actions}
        </div>
      )}
    </div>
  );
}
