import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AddExpense from '../components/AddExpense.jsx';
import WeeklyCheckInModal from '../components/WeeklyCheckInModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { deleteExpense, getDashboardSummary, getExpenses } from '../services/api.js';
import { formatCurrency, formatOrdinalDay, formatUtcDate } from '../utils/formatters.js';

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
    currentMonthIncome: 0,
    currentMonthExpenses: 0,
    upcomingBillsTotal: 0,
    totalSavingsContributions: 0,
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

  const fetchDashboardData = useCallback(
    async (isCancelled) => {
      const checkCancelled = typeof isCancelled === 'function' ? isCancelled : () => false;
      setError('');
      try {
        const [summaryData, expenseList] = await Promise.all([
          getDashboardSummary(),
          getExpenses(),
        ]);

        if (checkCancelled()) return;

        setSummary({
          month: summaryData.month || '',
          currentMonthIncome: Number(summaryData.currentMonthIncome || 0),
          currentMonthExpenses: Number(summaryData.currentMonthExpenses || 0),
          upcomingBillsTotal: Number(summaryData.upcomingBillsTotal || 0),
          totalSavingsContributions: Number(summaryData.totalSavingsContributions || 0),
          remainingBudget: Number(summaryData.remainingBudget || 0),
          expensesByCategory: Array.isArray(summaryData.expensesByCategory)
            ? summaryData.expensesByCategory
            : [],
          nextPayDate: summaryData.nextPayDate || null,
          upcomingBills: Array.isArray(summaryData.upcomingBills)
            ? summaryData.upcomingBills
            : [],
        });
        setExpenses(Array.isArray(expenseList) ? expenseList : []);
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

  const remainingClass =
    summary.remainingBudget >= 0 ? 'metric-value is-positive' : 'metric-value is-negative';

  const remainingMiniClass =
    summary.remainingBudget >= 0 ? 'mini-stat-value is-positive' : 'mini-stat-value is-negative';

  const maxCategoryTotal = summary.expensesByCategory.reduce(
    (max, item) => Math.max(max, Number(item.total || 0)),
    0,
  );

  return (
    <section className="dashboard-shell">
      <header className="dashboard-topbar">
        <div>
          <span className="brand-eyebrow">MoneyFlow 360 • {formatMonthHeading(summary.month)}</span>
          <h1 className="card-title">Welcome to Your MoneyFlow 360</h1>
          <p className="dashboard-headline">You got paid. You paid the bills. Now where did the rest go?</p>
          <p className="card-subtitle">
            Every paycheck. Every bill. One clear picture.
            {user?.email ? ` • Signed in as ${user.email}` : ''}
          </p>
        </div>

        <div className="topbar-actions">
          <span className="badge-success">Access Active</span>
          <Link className="btn-secondary" to="/onboarding">
            Paycheck Setup
          </Link>
          <button
            type="button"
            className="btn-primary btn-topbar-primary"
            onClick={() => setIsCheckInOpen(true)}
          >
            Weekly Check-In
          </button>
        </div>
      </header>

      {error && <div className="alert-error">{error}</div>}

      <div className="summary-grid" aria-label="Monthly budget summary">
        <article className="metric-card">
          <div className="metric-card-header">
            <span className="metric-label">Income this month</span>
            <Link
              to="/budget"
              state={{ action: 'edit-income' }}
              className="btn-card-action"
              title="Edit paycheck amount, name, frequency, and next date in Budget Planner"
            >
              ✎ Edit Income
            </Link>
          </div>
          <strong className="metric-value">
            {loading ? '—' : formatCurrency(summary.currentMonthIncome)}
          </strong>
          <span className="metric-hint">Scheduled paychecks for this month</span>
        </article>

        <article className="metric-card">
          <span className="metric-label">Expenses this month</span>
          <strong className="metric-value">
            {loading ? '—' : formatCurrency(summary.currentMonthExpenses)}
          </strong>
          <span className="metric-hint">Logged spending this month</span>
        </article>

        <article className="metric-card is-highlight">
          <span className="metric-label">Remaining budget</span>
          <strong className={loading ? 'metric-value' : remainingClass}>
            {loading ? '—' : formatCurrency(summary.remainingBudget)}
          </strong>
          <span className="metric-hint">
            {summary.remainingBudget >= 0
              ? 'After expenses, upcoming bills & savings'
              : 'Over monthly paycheck plan'}
          </span>
        </article>
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
              <li key={bill._id} className="transaction-item">
                <div className="transaction-main">
                  <div className="transaction-title">{bill.name}</div>
                  <div className="transaction-meta">
                    <span className="category-tag">{bill.category}</span>
                    <span>
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
