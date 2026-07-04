import { Suspense, lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { SystemProvider } from './system/SystemProvider';

const Dashboard = lazy(() => import('./routes/Dashboard'));

const routes: [string, LazyExoticComponent<ComponentType>][] = [
  ['/sales', lazy(() => import('./routes/sales/SalesList'))],
  ['/sales/new', lazy(() => import('./routes/sales/SaleForm'))],
  ['/sales/:id', lazy(() => import('./routes/sales/SaleDetail'))],
  ['/sales/:id/edit', lazy(() => import('./routes/sales/SaleForm'))],
  ['/purchases', lazy(() => import('./routes/purchases/PurchasesList'))],
  ['/purchases/new', lazy(() => import('./routes/purchases/PurchaseForm'))],
  ['/purchases/:id', lazy(() => import('./routes/purchases/PurchaseDetail'))],
  ['/purchases/:id/edit', lazy(() => import('./routes/purchases/PurchaseForm'))],
  ['/parties', lazy(() => import('./routes/parties/PartiesList'))],
  ['/parties/:id', lazy(() => import('./routes/parties/PartyDetail'))],
  ['/dues', lazy(() => import('./routes/Dues'))],
  ['/inventory', lazy(() => import('./routes/Inventory'))],
  ['/inventory/:id', lazy(() => import('./routes/inventory/ItemDetail'))],
  ['/banking', lazy(() => import('./routes/banking/Banking'))],
  ['/banking/:id', lazy(() => import('./routes/banking/BankAccountPage'))],
  ['/ledger', lazy(() => import('./routes/GeneralLedger'))],
  ['/expenses', lazy(() => import('./routes/Expenses'))],
  ['/expenses/:id', lazy(() => import('./routes/expenses/ExpenseDetail'))],
  ['/income', lazy(() => import('./routes/OtherIncome'))],
  ['/assets', lazy(() => import('./routes/FixedAssets'))],
  ['/payments', lazy(() => import('./routes/payments/Payments'))],
  ['/payments/:id', lazy(() => import('./routes/payments/PaymentDetail'))],
  ['/reports', lazy(() => import('./routes/reports/Reports'))],
  ['/reports/:report', lazy(() => import('./routes/reports/ReportPage'))],
  ['/growth', lazy(() => import('./routes/Growth'))],
  ['/settings', lazy(() => import('./routes/Settings'))],
];

export default function App() {
  return (
    <SystemProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route
              index
              element={
                <Suspense fallback={null}>
                  <Dashboard />
                </Suspense>
              }
            />
            {routes.map(([path, Component]) => (
              <Route
                key={path}
                path={path}
                element={
                  <Suspense fallback={null}>
                    <Component />
                  </Suspense>
                }
              />
            ))}
          </Route>
        </Routes>
      </BrowserRouter>
    </SystemProvider>
  );
}
