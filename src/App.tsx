import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { AppLayout } from './components/layout/AppLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Invoices } from './pages/Invoices';
import { CreateInvoice } from './pages/CreateInvoice';
import { Expenses } from './pages/Expenses';
import { GSTSummary } from './pages/GSTSummary';
import { GSTFiling } from './pages/GSTFiling';
import { Clients } from './pages/Clients';
import { Settings } from './pages/Settings';
import { CashFlow } from './pages/CashFlow';
import { Quotations } from './pages/Quotations';
import { CreateQuotation } from './pages/CreateQuotation';
import { ProformaInvoices } from './pages/ProformaInvoices';
import { CreateProforma } from './pages/CreateProforma';
import { PaymentReceipts } from './pages/PaymentReceipts';
import { CreateReceipt } from './pages/CreateReceipt';

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg animate-pulse">
          <span className="text-white font-bold text-sm">IG</span>
        </div>
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { user, profile, signOut, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  const userName = profile?.full_name || user?.email || 'User';

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        element={
          user ? (
            <AppLayout onSignOut={signOut} userName={userName} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/invoices/new" element={<CreateInvoice />} />
        <Route path="/invoices/:id/edit" element={<CreateInvoice />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/gst-summary" element={<GSTSummary />} />
        <Route path="/gst-filing" element={<GSTFiling />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/cash-flow" element={<CashFlow />} />
        <Route path="/quotations" element={<Quotations />} />
        <Route path="/quotations/new" element={<CreateQuotation />} />
        <Route path="/quotations/:id/edit" element={<CreateQuotation />} />
        <Route path="/proforma" element={<ProformaInvoices />} />
        <Route path="/proforma/new" element={<CreateProforma />} />
        <Route path="/proforma/:id/edit" element={<CreateProforma />} />
        <Route path="/receipts" element={<PaymentReceipts />} />
        <Route path="/receipts/new" element={<CreateReceipt />} />
        <Route path="/receipts/:id/edit" element={<CreateReceipt />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
