import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboard } from '../hooks/useDashboard';
import { useWorkspace } from '../context/WorkspaceContext';
import { getMonthLabel } from '../utils/formatters';
import {
  AttentionSection,
  BusinessSnapshot,
  DashboardFatalError,
  DashboardHeader,
  DashboardLoading,
  FinancialSnapshot,
  PerformanceSection,
  RecentActivity,
  WorkingCapital,
} from '../components/dashboard/DashboardCommandCenter';

export function Dashboard() {
  const navigate = useNavigate();
  const { workspace } = useWorkspace();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const goalStorageKey = `collectionGoal:${workspace.id}`;
  const [goal, setGoal] = useState(() => Number(localStorage.getItem(goalStorageKey)) || 25_000);
  const { dashboard, loading, refetch } = useDashboard(year, month);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Collection targets are intentionally entity-specific.
    setGoal(Number(localStorage.getItem(goalStorageKey)) || 25_000);
  }, [goalStorageKey]);

  function editGoal() {
    const value = window.prompt('Set monthly collection goal (₹)', String(goal));
    if (value == null) return;
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      setGoal(parsed);
      localStorage.setItem(goalStorageKey, String(parsed));
    }
  }

  function previousMonth() {
    if (month === 0) { setMonth(11); setYear((value) => value - 1); }
    else setMonth((value) => value - 1);
  }

  function nextMonth() {
    if (year > today.getFullYear() || (year === today.getFullYear() && month >= today.getMonth())) return;
    if (month === 11) { setMonth(0); setYear((value) => value + 1); }
    else setMonth((value) => value + 1);
  }

  const periodLabel = getMonthLabel(year, month);
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
  const cashCollected = dashboard?.financialSnapshot.cashCollected.value;
  const goalPercent = cashCollected == null ? 0 : Math.min(100, Math.round((cashCollected / goal) * 100));

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-5 md:px-7 md:py-7 lg:px-9">
      <DashboardHeader
        entity={workspace.name}
        periodLabel={periodLabel}
        context={dashboard?.dashboardContext ?? null}
        currentMonth={isCurrentMonth}
        onPrevious={previousMonth}
        onNext={nextMonth}
        onCreate={() => navigate('/invoices/new')}
      />

      {loading && !dashboard ? <DashboardLoading /> : dashboard?.dashboardContext.state === 'error' ? <DashboardFatalError onRetry={() => void refetch()} /> : dashboard ? (
        <main className="space-y-5">
          <FinancialSnapshot data={dashboard} />
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="order-2 xl:order-1"><BusinessSnapshot data={dashboard} /></div>
            <div className="order-1 xl:order-2"><AttentionSection items={dashboard.attention} /></div>
          </div>
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(360px,.82fr)_minmax(0,1.35fr)]">
            <WorkingCapital data={dashboard} />
            <PerformanceSection data={dashboard} goal={goal} goalPercent={goalPercent} onEditGoal={editGoal} />
          </div>
          <RecentActivity items={dashboard.recentActivity} />
        </main>
      ) : <DashboardFatalError onRetry={() => void refetch()} />}
    </div>
  );
}
