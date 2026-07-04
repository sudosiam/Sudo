import { Outlet, useLocation } from 'react-router-dom';

/** Fades/slides page content in on route change for smoother navigation. */
export function PageTransition() {
  const location = useLocation();

  return (
    <div key={location.pathname} className="page-enter">
      <Outlet />
    </div>
  );
}
