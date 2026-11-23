import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AddExpense from '../components/AddExpense.jsx';
import WeeklyCheckInModal from '../components/WeeklyCheckInModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
  deleteExpense,
  getBills,
  getDashboardSummary,
  getExpenses,
  getIncome,
  getPaycheckPlans,
} from '../services/api.js';
import {
  formatCurrency,
  formatOrdinalDay,
  formatPaydayWithWeekday,
  formatUtcDate,
} from '../utils/formatters.js';

function formatMonthHeading(monthLabel) {
  if (!monthLabel) return 'This Month';
  const [yearStr, monthStr] = monthLabel.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!year || !month) return monthLabel;

  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const [summary, setSummary] = useState({
    month: '',
    incomeReceivedThisMonth: 0,
    projectedMonthlyIncome: 0,
    currentMonthIncome: 0,
    currentMonthExpenses: 0,
    upcomingBillsTotal: 0,
    billsToPrepareFor: 0,
    totalSavingsContributions: 0,
    savingsThisMonth: 0,
    availableUntilPayday: 0,
    remainingBudget: 0,
    expensesByCategory: [],
    nextPayDate: null,
    upcomingBills: [],
  });
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState('');
  const [isCheckInOpen, setIsCheckInOpen] = useState(false);
  const [error, setError] = useState('');
  const [checklistStatus, setChecklistStatus] = useState({
    hasIncome: false,
    hasBills: false,
    hasPlan: false,
  });
  const [isChecklistDismissed, setIsChecklistDismissed] = useState(
    () => localStorage.getItem('mf360_checklist_dismissed') === 'true',
  );

  const fetchDashboardData = useCallback(
    async (isCancelled) => {
      const checkCancelled = typeof isCancelled === 'function' ? isCancelled : () => false;
      setError('');
      try {
        const [summaryData, expenseList, incomeList, billList, planList] = await Promise.all([
          getDashboardSummary(),
          getExpenses(),
          getIncome().catch(() => []),
          getBills().catch(() => []),
          getPaycheckPlans().catch(() => []),
        ]);

        if (checkCancelled()) return;

        setSummary({
          month: summaryData.month || '',
          incomeReceivedThisMonth: Number(summaryData.incomeReceivedThisMonth || 0),
          projectedMonthlyIncome: Number(summaryData.projectedMonthlyIncome || 0),
          currentMonthIncome: Number(summaryData.currentMonthIncome || 0),
          currentMonthExpenses: Number(summaryData.currentMonthExpenses || 0),
          upcomingBillsTotal: Number(summaryData.upcomingBillsTotal || 0),
          billsToPrepareFor: Number(
            summaryData.billsToPrepareFor ?? summaryData.upcomingBillsTotal ?? 0,
          ),
          totalSavingsContributions: Number(summaryData.totalSavingsContributions || 0),
          savingsThisMonth: Number(
            summaryData.savingsThisMonth ?? summaryData.totalSavingsContributions ?? 0,
          ),
          availableUntilPayday: Number(
            summaryData.availableUntilPayday ?? summaryData.remainingBudget ?? 0,
          ),
          remainingBudget: Number(
            summaryData.availableUntilPayday ?? summaryData.remainingBudget ?? 0,
          ),
          expensesByCategory: Array.isArray(summaryData.expensesByCategory)
            ? summaryData.expensesByCategory
            : [],
          nextPayDate: summaryData.nextPayDate || null,
          upcomingBills: Array.isArray(summaryData.upcomingBills)
            ? summaryData.upcomingBills
            : [],
        });
        setExpenses(Array.isArray(expenseList) ? expenseList : []);
        setChecklistStatus({
          hasIncome: Array.isArray(incomeList) && incomeList.length > 0,
          hasBills: Array.isArray(billList) && billList.length > 0,
          hasPlan: Array.isArray(planList) && planList.length > 0,
        });
      } catch (err) {
        if (checkCancelled()) return;
        if (err.status === 401) {
          logout();
          navigate('/', { replace: true });
          return;
        }
        setError(err.message || 'Unable to load your budget summary.');
      } finally {
        if (!checkCancelled()) {
          setLoading(false);
        }
      }
    },
    [logout, navigate],
  );

  useEffect(() => {
    let cancelled = false;
    fetchDashboardData(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [fetchDashboardData, location.key, location.pathname]);

  const handleDeleteExpense = async (expenseId) => {
    setError('');
    setDeletingId(expenseId);
    try {
      await deleteExpense(expenseId);
      await fetchDashboardData();
    } catch (err) {
      if (err.status === 401) {
        logout();
        navigate('/', { replace: true });
        return;
      }
      setError(err.message || 'Unable to delete expense.');
    } finally {
      setDeletingId('');
    }
  };

  const safeToSpend =
    summary.availableUntilPayday !== undefined
      ? summary.availableUntilPayday
      : summary.remainingBudget;

  const remainingClass =
    safeToSpend >= 0 ? 'metric-value is-positive' : 'metric-value is-negative';

  const remainingMiniClass =
    safeToSpend >= 0 ? 'mini-stat-value is-positive' : 'mini-stat-value is-negative';

  const maxCategoryTotal = summary.expensesByCategory.reduce(
    (max, item) => Math.max(max, Number(item.total || 0)),
    0,
  );

  const isAllStepsCompleted =
    checklistStatus.hasIncome && checklistStatus.hasBills && checklistStatus.hasPlan;
  const showChecklist = !isAllStepsCompleted && !isChecklistDismissed && !loading;

  const handleDismissChecklist = () => {
    setIsChecklistDismissed(true);
    localStorage.setItem('mf360_checklist_dismissed', 'true');
  };

  return (
    <section className="dashboard-shell">
      <header className="dashboard-topbar">
        <div>
          <span className="brand-eyebrow">MoneyFlow 360 • {formatMonthHeading(summary.month)}</span>
          <h1 className="card-title">Welcome to Your MoneyFlow 360</h1>
          <p className="dashboard-headline">Know what's coming in, what's going out, and what's safe to spend.</p>
          <p className="card-subtitle">
            Every paycheck accounted for. Every dollar with a purpose.
            {user?.email ? ` • Signed in as ${user.email}` : ''}
          </p>
        </div>

        <div className="topbar-actions">
          <Link className="btn-primary btn-topbar-primary" to="/plan-paycheck">
            🎯 Plan My Paycheck
          </Link>
          <Link className="btn-secondary" to="/onboarding">
            Paycheck Setup
          </Link>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setIsCheckInOpen(true)}
          >
            Weekly Check-In
          </button>
        </div>
      </header>

      {error && <div className="alert-error">{error}</div>}

      {/* Guided Empty State / Getting Started Checklist */}
      {showChecklist && (
        <section className="getting-started-card" aria-label="Getting Started Checklist">
          <div className="getting-started-header">
            <div>
              <span className="brand-eyebrow">Getting Started Checklist</span>
              <h2 className="panel-title" style={{ fontSize: '1.25rem' }}>
                Welcome to MoneyFlow 360
              </h2>
              <p className="card-subtitle" style={{ fontSize: '0.875rem' }}>
                Complete these 3 simple steps to take total control of your money and know your Safe-to-Spend number.
              </p>
            </div>
            <button
              type="button"
              className="btn-dismiss-checklist"
              onClick={handleDismissChecklist}
              title="Dismiss checklist"
              aria-label="Dismiss checklist"
            >
              ×
            </button>
          </div>

          <div className="getting-started-steps">
            {/* Step 1 */}
            <Link
              to="/budget"
              className={`getting-started-step ${checklistStatus.hasIncome ? 'is-complete' : 'is-pending'}`}
            >
              <span className="step-check-circle">
                {checklistStatus.hasIncome ? '✓' : '1'}
              </span>
              <div className="step-info">
                <strong className="step-title">Add your first paycheck</strong>
                <span className="step-desc">
                  {checklistStatus.hasIncome
                    ? 'Completed — Paycheck schedule saved'
                    : 'Enter your paycheck amount, frequency, and pay dates'}
                </span>
              </div>
              <span className="step-action-arrow">
                {checklistStatus.hasIncome ? 'Edit →' : 'Start →'}
              </span>
            </Link>

            {/* Step 2 */}
            <Link
              to="/bills"
              className={`getting-started-step ${checklistStatus.hasBills ? 'is-complete' : 'is-pending'}`}
            >
              <span className="step-check-circle">
                {checklistStatus.hasBills ? '✓' : '2'}
              </span>
              <div className="step-info">
                <strong className="step-title">Add your upcoming bills</strong>
                <span className="step-desc">
                  {checklistStatus.hasBills
                    ? 'Completed — Recurring bills tracked'
                    : 'Add rent, utilities, subscriptions, and due dates'}
                </span>
              </div>
              <span className="step-action-arrow">
                {checklistStatus.hasBills ? 'Manage →' : 'Start →'}
              </span>
            </Link>

            {/* Step 3 */}
            <Link
              to="/plan-paycheck"
              className={`getting-started-step ${checklistStatus.hasPlan ? 'is-complete' : 'is-pending'}`}
            >
              <span className="step-check-circle">
                {checklistStatus.hasPlan ? '✓' : '3'}
              </span>
              <div className="step-info">
                <strong className="step-title">Plan your first paycheck</strong>
                <span className="step-desc">
                  {checklistStatus.hasPlan
                    ? 'Completed — Paycheck allocation saved'
                    : 'Reserve upcoming bills, everyday categories, and know your buffer'}
                </span>
              </div>
              <span className="step-action-arrow">
                {checklistStatus.hasPlan ? 'Review →' : 'Plan →'}
              </span>
            </Link>
          </div>
        </section>
      )}

      <div className="summary-grid" aria-label="Monthly budget summary">
        {/* Card 1: Available until payday */}
        <article className="metric-card is-highlight">
          <div className="metric-card-header">
            <span className="metric-label">Available until payday</span>
          </div>
          <strong className={loading ? 'metric-value' : remainingClass}>
            {loading ? '—' : formatCurrency(safeToSpend)}
          </strong>
          <span className="metric-hint">After reserved bills and savings</span>
        </article>

        {/* Card 2: Next paycheck */}
        <article className="metric-card">
          <div className="metric-card-header">
            <span className="metric-label">Next paycheck</span>
            <Link
              to="/budget"
              state={{ action: 'edit-income' }}
              className="btn-card-action"
              title="Edit paycheck schedule and dates in Budget Planner"
            >
              ✎ Edit Income
            </Link>
          </div>
          <strong className="metric-value" style={{ fontSize: '1.35rem' }}>
            {loading ? '—' : formatPaydayWithWeekday(summary.nextPayDate)}
          </strong>
          <span className="metric-hint">
            {summary.incomeReceivedThisMonth > 0
              ? `Received so far: ${formatCurrency(summary.incomeReceivedThisMonth)}`
              : 'Upcoming scheduled payday'}
          </span>
        </article>

        {/* Card 3: Bills to prepare for */}
        <article className="metric-card">
          <div className="metric-card-header">
            <span className="metric-label">Bills to prepare for</span>
            <Link to="/bills" className="btn-card-action" title="View and manage bills">
              View Bills
            </Link>
          </div>
          <strong className="metric-value">
            {loading ? '—' : formatCurrency(summary.billsToPrepareFor ?? summary.upcomingBillsTotal)}
          </strong>
          <span className="metric-hint">Due on or before next payday</span>
        </article>

        {/* Card 4: Savings this month */}
        <article className="metric-card">
          <div className="metric-card-header">
            <span className="metric-label">Savings this month</span>
            <Link to="/goals" className="btn-card-action" title="View savings goals">
              View Goals
            </Link>
          </div>
          <strong className="metric-value">
            {loading ? '—' : formatCurrency(summary.savingsThisMonth ?? summary.totalSavingsContributions)}
          </strong>
          <span className="metric-hint">Allocated for savings goals</span>
        </article>
      </div>

      {/* Plan My Paycheck Guided Callout */}
      <div className="plan-paycheck-banner">
        <div>
          <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>
            🎯 Ready to give your next paycheck a plan?
          </strong>
          <p className="card-subtitle" style={{ fontSize: '0.875rem', marginTop: '0.15rem' }}>
            Walk through our 4-step guided allocator: reserve upcoming bills, budget everyday categories, and know your guilt-free spending limit.
          </p>
        </div>
        <Link className="btn-primary" to="/plan-paycheck" style={{ whiteSpace: 'nowrap' }}>
          Plan My Paycheck →
        </Link>
      </div>

      <section className="upcoming-bills-card" aria-labelledby="upcoming-bills-heading">
        <header className="upcoming-bills-header">
          <div>
            <h2 id="upcoming-bills-heading" className="panel-title">
              Bills due before next paycheck
            </h2>
            <p className="panel-subtitle">
              {summary.nextPayDate
                ? `Unpaid bills due before your next paycheck on ${formatUtcDate(summary.nextPayDate)}.`
                : 'Add your paycheck schedule in Paycheck Setup to track bills due before payday.'}
            </p>
          </div>

          <Link className="btn-secondary btn-compact" to="/bills">
            Manage Bills
          </Link>
        </header>

        <div className="upcoming-totals-row">
          <div className="mini-stat-box">
            <span className="mini-stat-label">Upcoming unpaid bills total</span>
            <strong className="mini-stat-value">
              {loading ? '—' : formatCurrency(summary.upcomingBillsTotal)}
            </strong>
          </div>

          <div className="mini-stat-box">
            <span className="mini-stat-label">Savings goals allocated</span>
            <strong className="mini-stat-value">
              {loading ? '—' : formatCurrency(summary.totalSavingsContributions)}
            </strong>
          </div>

          <div className="mini-stat-box">
            <span className="mini-stat-label">Remaining budget after bills &amp; savings</span>
            <strong className={loading ? 'mini-stat-value' : remainingMiniClass}>
              {loading ? '—' : formatCurrency(summary.remainingBudget)}
            </strong>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">Checking upcoming bills...</div>
        ) : summary.upcomingBills.length === 0 ? (
          <div className="empty-state">
            <strong className="empty-state-title">
              {summary.nextPayDate
                ? 'No upcoming bills before payday'
                : 'No paycheck schedule saved yet'}
            </strong>
            <p className="empty-state-desc">
              {summary.nextPayDate
                ? 'You are all caught up for this pay period. Click "Manage Bills" if you want to add another bill.'
                : 'Click "Paycheck Setup" above to enter your pay schedule and see bills due before your next paycheck.'}
            </p>
          </div>
        ) : (
          <ul className="transaction-list">
            {summary.upcomingBills.map((bill) => (
              <li
                key={bill._id}
                className={`transaction-item ${bill.isOverdue ? 'is-overdue' : ''}`}
              >
                <div className="transaction-main">
                  <div className="transaction-title">
                    {bill.name}
                    {bill.isOverdue && (
                      <span className="badge-overdue" style={{ marginLeft: '0.5rem' }}>
                        Overdue
                      </span>
                    )}
                  </div>
                  <div className="transaction-meta">
                    <span className="category-tag">{bill.category}</span>
                    <span className={bill.isOverdue ? 'text-overdue' : ''}>
                      Due {formatOrdinalDay(bill.dueDate)} ({formatUtcDate(bill.nextDueDate)})
                    </span>
                  </div>
                </div>

                <div className="transaction-right">
                  <span className="transaction-amount">{formatCurrency(bill.amount)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="dashboard-content-grid">
        <section className="panel-card" aria-labelledby="spending-categories-heading">
          <header className="panel-header">
            <h2 id="spending-categories-heading" className="panel-title">
              Spending by category
            </h2>
            <p className="panel-subtitle">
              Where your money is going this month, ranked from highest to lowest.
            </p>
          </header>

          {loading ? (
            <div className="empty-state">Loading your monthly categories...</div>
          ) : summary.expensesByCategory.length === 0 ? (
            <div className="empty-state">
              <strong className="empty-state-title">No spending recorded this month</strong>
              <p className="empty-state-desc">
                Fill out the &ldquo;Add an expense&rdquo; form to log your first purchase and see
                where your money goes.
              </p>
            </div>
          ) : (
            <ol className="category-list">
              {summary.expensesByCategory.map((item, index) => {
                const barWidth =
                  maxCategoryTotal > 0
                    ? Math.max(6, Math.round((Number(item.total) / maxCategoryTotal) * 100))
                    : 0;
                const sharePercent =
                  summary.currentMonthExpenses > 0
                    ? Math.round((Number(item.total) / summary.currentMonthExpenses) * 100)
                    : 0;

                return (
                  <li key={item.category} className="category-item">
                    <div className="category-row">
                      <div className="category-name-group">
                        <span className="category-rank">{index + 1}</span>
                        <div>
                          <div className="category-name">{item.category}</div>
                          <div className="category-count">
                            {item.count} {item.count === 1 ? 'expense' : 'expenses'} · {sharePercent}%
                          </div>
                        </div>
                      </div>
                      <span className="category-amount">{formatCurrency(item.total)}</span>
                    </div>

                    <div className="progress-track" aria-hidden="true">
                      <div className="progress-fill" style={{ width: `${barWidth}%` }} />
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <AddExpense onExpenseAdded={fetchDashboardData} />
      </div>

      <section className="panel-card" aria-labelledby="recent-transactions-heading">
        <header className="panel-header">
          <h2 id="recent-transactions-heading" className="panel-title">
            Recent Transactions
          </h2>
          <p className="panel-subtitle">
            Review your logged expenses and remove any entry you no longer need.
          </p>
        </header>

        {loading ? (
          <div className="empty-state">Loading your recent transactions...</div>
        ) : expenses.length === 0 ? (
          <div className="empty-state">
            <strong className="empty-state-title">No transactions yet</strong>
            <p className="empty-state-desc">
              Use the &ldquo;Add an expense&rdquo; form above and click &ldquo;Add Expense&rdquo;
              to start tracking your spending.
            </p>
          </div>
        ) : (
          <ul className="transaction-list">
            {expenses.map((expense) => (
              <li key={expense._id} className="transaction-item">
                <div className="transaction-main">
                  <div className="transaction-title">{expense.description}</div>
                  <div className="transaction-meta">
                    <span className="category-tag">{expense.category}</span>
                    <span>{formatUtcDate(expense.date)}</span>
                  </div>
                  {expense.note && <div className="transaction-note">{expense.note}</div>}
                </div>

                <div className="transaction-right">
                  <span className="transaction-amount">{formatCurrency(expense.amount)}</span>
                  <button
                    type="button"
                    className="btn-delete"
                    onClick={() => handleDeleteExpense(expense._id)}
                    disabled={deletingId === expense._id}
                  >
                    {deletingId === expense._id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <WeeklyCheckInModal
        isOpen={isCheckInOpen}
        onClose={() => setIsCheckInOpen(false)}
        onUnauthorized={() => {
          logout();
          navigate('/', { replace: true });
        }}
      />
    </section>
  );
}

export default Dashboard;
