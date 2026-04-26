import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, FileText } from 'lucide-react';
import { useDashboard } from '../hooks/useDashboard';
import { DashboardCards } from '../components/dashboard/DashboardCards';
import { RevenueChart } from '../components/dashboard/RevenueChart';
import { TopBar } from '../components/layout/TopBar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardTitle } from '../components/ui/Card';
import { formatCurrency, formatDate, getMonthLabel } from '../utils/formatters';

export function Dashboard() {
  const navigate = useNavigate();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const { stats, monthlyData, recentInvoices, loading } = useDashboard(year, month);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    const now = new Date();
    if (year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth())) return;
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  const statusVariant: Record<string, 'green' | 'red' | 'yellow'> = {
    paid: 'green', pending: 'yellow', partial: 'red',
  };

  return (
    <div>
      <TopBar
        title="Dashboard"
        subtitle="Infinity Enterprises"
        actions={
          <Button size="sm" onClick={() => navigate('/invoices/new')}>
            <Plus size={16} /> New Invoice
          </Button>
        }
      />

      <div className="px-4 md:px-6 py-6 space-y-6">
        {/* Month Selector */}
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 border border-gray-200">
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-semibold text-gray-700 min-w-[140px] text-center">
            {getMonthLabel(year, month)}
          </span>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 border border-gray-200">
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Stats Cards */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-28 bg-gray-200 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : stats ? (
          <DashboardCards stats={stats} />
        ) : null}

        {/* Chart */}
        {!loading && monthlyData.length > 0 && <RevenueChart data={monthlyData} />}

        {/* Recent Invoices */}
        <Card padding={false}>
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <CardTitle>Recent Invoices</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/invoices')}>
              View All
            </Button>
          </div>
          <div className="divide-y divide-gray-100">
            {recentInvoices.length === 0 ? (
              <div className="px-6 py-10 text-center text-gray-400 text-sm">
                <FileText size={32} className="mx-auto mb-2 opacity-40" />
                No invoices yet
              </div>
            ) : (
              recentInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/invoices/${inv.id}`)}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{inv.invoice_number}</p>
                    <p className="text-xs text-gray-500 truncate">{inv.client?.name}</p>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">{formatCurrency(inv.total_amount)}</p>
                      <p className="text-xs text-gray-400">{formatDate(inv.invoice_date)}</p>
                    </div>
                    <Badge variant={statusVariant[inv.payment_status]}>
                      {inv.payment_status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
