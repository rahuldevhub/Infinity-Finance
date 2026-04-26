import { TrendingUp, TrendingDown, Clock, IndianRupee, Calculator, AlertCircle } from 'lucide-react';
import type { DashboardStats } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { Card } from '../ui/Card';

interface DashboardCardsProps {
  stats: DashboardStats;
}

export function DashboardCards({ stats }: DashboardCardsProps) {
  const cards = [
    {
      title: 'Total Revenue',
      value: formatCurrency(stats.totalRevenue),
      icon: TrendingUp,
      color: 'teal',
      subtitle: 'All invoice types',
    },
    {
      title: 'Total Sales',
      value: formatCurrency(stats.totalSales),
      icon: TrendingUp,
      color: 'blue',
      subtitle: 'GST taxable value',
    },
    {
      title: 'GST Collected',
      value: formatCurrency(stats.totalGSTCollected),
      icon: IndianRupee,
      color: 'green',
      subtitle: 'From GST Invoices only',
    },
    {
      title: 'Total Expenses',
      value: formatCurrency(stats.totalExpenses),
      icon: TrendingDown,
      color: 'orange',
      subtitle: 'Including GST',
    },
    {
      title: 'ITC Available',
      value: formatCurrency(stats.itcAvailable),
      icon: Calculator,
      color: 'purple',
      subtitle: 'Input tax credit',
    },
    {
      title: 'Net GST Payable',
      value: formatCurrency(stats.netGSTPayable),
      icon: AlertCircle,
      color: stats.netGSTPayable > 0 ? 'red' : 'green',
      subtitle: 'Output − ITC',
    },
    {
      title: 'Pending Invoices',
      value: formatCurrency(stats.pendingInvoicesValue),
      icon: Clock,
      color: 'yellow',
      subtitle: `${stats.pendingInvoicesCount} invoice${stats.pendingInvoicesCount !== 1 ? 's' : ''} · ${stats.pendingProformasCount} proforma${stats.pendingProformasCount !== 1 ? 's' : ''} pending`,
    },
  ];

  const colorMap: Record<string, { bg: string; text: string; iconBg: string }> = {
    teal: { bg: 'bg-teal-50', text: 'text-teal-700', iconBg: 'bg-teal-100' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', iconBg: 'bg-blue-100' },
    green: { bg: 'bg-green-50', text: 'text-green-700', iconBg: 'bg-green-100' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-700', iconBg: 'bg-orange-100' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-700', iconBg: 'bg-purple-100' },
    red: { bg: 'bg-red-50', text: 'text-red-700', iconBg: 'bg-red-100' },
    yellow: { bg: 'bg-yellow-50', text: 'text-yellow-700', iconBg: 'bg-yellow-100' },
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((card) => {
        const colors = colorMap[card.color];
        return (
          <Card key={card.title} className="relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-500 mb-1">{card.title}</p>
                <p className="text-lg font-bold text-gray-900 truncate">{card.value}</p>
                <p className="text-xs text-gray-400 mt-1">{card.subtitle}</p>
              </div>
              <div className={`${colors.iconBg} p-2.5 rounded-lg ml-3 flex-shrink-0`}>
                <card.icon size={18} className={colors.text} />
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
