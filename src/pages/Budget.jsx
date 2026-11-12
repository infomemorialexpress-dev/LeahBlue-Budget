import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import HowItWorks from '../components/HowItWorks.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
  createIncome,
  deleteIncome,
  getCategoryBudgets,
  getIncome,
  saveCategoryBudgets,
  updateIncome,
} from '../services/api.js';
import { formatCurrency, formatUtcDate } from '../utils/formatters.js';

const CADENCE_OPTIONS = [
  {
    value: 'weekly',
    label: 'Weekly: Every week (52 paychecks/year)',
    shortLabel: 'Weekly',
    monthlyMultiplier: 52 / 12,
  },
  {
    value: 'biweekly',
    label: 'Biweekly: Every 2 weeks (26 paychecks/year)',
    shortLabel: 'Biweekly',
    monthlyMultiplier: 26 / 12,
  },
  {
    value: 'twice-monthly',
    label: 'Twice Monthly: Twice a month (24 paychecks/year)',
    shortLabel: 'Twice Monthly',
    monthlyMultiplier: 2,
  },
  {
    value: 'monthly',
    label: 'Monthly: Once a month (12 paychecks/year)',
    shortLabel: 'Monthly',
    monthlyMultiplier: 1,
  },
  {
    value: 'irregular',
    label: 'Irregular / Variable Income: My pay dates or income amounts change',
    shortLabel: 'Irregular / Variable Income',
    monthlyMultiplier: 1,
  },
];

function getTodayDateString() {
  return new Date().toISOString().split('T')[0];
}

function roundCents(value) {
  return Math.round(Number(value || 0) * 100);
}

function toMonthlyIncomeCents(amount, paySchedule) {
  const option = CADENCE_OPTIONS.find((item) => item.value === paySchedule);
  const multiplier = option ? option.monthlyMultiplier : 1;
  return Math.round(roundCents(amount) * multiplier);
}

const INITIAL_INCOME_FORM = {
  sourceName: '',
  amount: '',
  paySchedule: 'biweekly',
  nextPayDate: getTodayDateString(),
};

function Budget() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const userKey = user?.id || user?.email || 'default';

  const [incomes, setIncomes] = useState([]);
  const [incomeForm, setIncomeForm] = useState(INITIAL_INCOME_FORM);
  const [editingIncomeId, setEditingIncomeId] = useState('');

  const [categoryBudgets, setCategoryBudgets] = useState(() => getCategoryBudgets(userKey));
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryTarget, setNewCategoryTarget] = useState('');

  const [loading, setLoading] = useState(true);
  const [isSavingIncome, setIsSavingIncome] = useState(false);
  const [busyIncomeId, setBusyIncomeId] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleAuthOrError = useCallback(
    (err, fallbackMessage) => {
      if (err.status === 401) {
        logout();
        navigate('/', { replace: true });
        return;
      }
      setError(err.message || fallbackMessage);
    },
    [logout, navigate],
  );

  const loadIncomes = useCallback(
    async (isCancelled) => {
      const checkCancelled = typeof isCancelled === 'function' ? isCancelled : () => false;
      setError('');
      try {
        const data = await getIncome();
        if (checkCancelled()) return;
        setIncomes(Array.isArray(data) ? data : []);
      } catch (err) {
        if (checkCancelled()) return;
        handleAuthOrError(err, 'Unable to load your income sources.');
      } finally {
        if (!checkCancelled()) {
          setLoading(false);
        }
      }
    },
    [handleAuthOrError],
  );

  useEffect(() => {
    let cancelled = false;
    loadIncomes(() => cancelled);
    setCategoryBudgets(getCategoryBudgets(userKey));
    return () => {
      cancelled = true;
    };
  }, [loadIncomes, userKey, location.key, location.pathname]);

  useEffect(() => {
    if (location.hash === '#income' || location.hash === '#income-sources-section') {
      const timer = setTimeout(() => {
        const el = document.getElementById('income-sources-section');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          const firstInput = el.querySelector('input');
          if (firstInput) firstInput.focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [location.hash, location.key]);

  const resetIncomeForm = () => {
    setIncomeForm({
      ...INITIAL_INCOME_FORM,
      nextPayDate: getTodayDateString(),
    });
    setEditingIncomeId('');
  };

  const handleIncomeSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    const numericAmount = Number(incomeForm.amount);
    if (!incomeForm.sourceName.trim()) {
      setError('Please enter an income description.');
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Please enter an income amount greater than $0.');
      return;
    }

    const payload = {
      sourceName: incomeForm.sourceName.trim(),
      amount: Math.round(numericAmount * 100) / 100,
      paySchedule: incomeForm.paySchedule,
      nextPayDate: incomeForm.nextPayDate || getTodayDateString(),
    };

    setIsSavingIncome(true);
    try {
      if (editingIncomeId) {
        await updateIncome(editingIncomeId, payload);
        setSuccessMessage('Income source updated.');
      } else {
        await createIncome(payload);
        setSuccessMessage('Income source added.');
      }
      resetIncomeForm();
      await loadIncomes();
    } catch (err) {
      handleAuthOrError(err, 'Could not save income source.');
    } finally {
      setIsSavingIncome(false);
    }
  };

  const handleEditIncome = (income) => {
    setError('');
    setSuccessMessage('');
    setEditingIncomeId(income._id);
    setIncomeForm({
      sourceName: income.sourceName || '',
      amount: String(income.amount ?? ''),
      paySchedule: income.paySchedule || 'biweekly',
      nextPayDate: income.nextPayDate
        ? String(income.nextPayDate).slice(0, 10)
        : getTodayDateString(),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteIncome = async (incomeId) => {
    setError('');
    setSuccessMessage('');
    setBusyIncomeId(incomeId);
    try {
      await deleteIncome(incomeId);
      if (editingIncomeId === incomeId) {
        resetIncomeForm();
      }
      setSuccessMessage('Income source removed.');
      await loadIncomes();
    } catch (err) {
      handleAuthOrError(err, 'Could not delete income source.');
    } finally {
      setBusyIncomeId('');
    }
  };

  const handleCategoryAmountChange = (index, nextValue) => {
    setCategoryBudgets((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? {
              ...item,
              targetAmount: nextValue === '' ? '' : Math.max(0, Number(nextValue)),
            }
          : item,
      ),
    );
  };

  const handleSaveCategoryBudgets = (event) => {
    event.preventDefault();
    setError('');
    const sanitized = categoryBudgets.map((item) => ({
      category: item.category,
      targetAmount: Math.round(Math.max(0, Number(item.targetAmount || 0)) * 100) / 100,
    }));
    setCategoryBudgets(sanitized);
    saveCategoryBudgets(userKey, sanitized);
    setSuccessMessage('Category budgets saved.');
  };

  const handleAddCategory = (event) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    const trimmedName = newCategoryName.trim();
    if (!trimmedName) {
      setError('Please enter a category name.');
      return;
    }

    const exists = categoryBudgets.some(
      (item) => item.category.toLowerCase() === trimmedName.toLowerCase(),
    );
    if (exists) {
      setError(`"${trimmedName}" is already in your category budgets.`);
      return;
    }

    const parsedTarget = Math.round(Math.max(0, Number(newCategoryTarget || 0)) * 100) / 100;
    const updated = [...categoryBudgets, { category: trimmedName, targetAmount: parsedTarget }];
    setCategoryBudgets(updated);
    saveCategoryBudgets(userKey, updated);
    setNewCategoryName('');
    setNewCategoryTarget('');
    setSuccessMessage(`Added "${trimmedName}" to category budgets.`);
  };

  const handleRemoveCategory = (categoryName) => {
    const updated = categoryBudgets.filter((item) => item.category !== categoryName);
    setCategoryBudgets(updated);
    saveCategoryBudgets(userKey, updated);
    setSuccessMessage(`Removed "${categoryName}" from category budgets.`);
  };

  const { estimatedMonthlyIncome, plannedCategoryTotal, projectedRemainder } = useMemo(() => {
    const incomeCents = incomes.reduce(
      (sum, item) => sum + toMonthlyIncomeCents(item.amount, item.paySchedule),
      0,
    );
    const budgetCents = categoryBudgets.reduce(
      (sum, item) => sum + roundCents(item.targetAmount),
      0,
    );
    return {
      estimatedMonthlyIncome: incomeCents / 100,
      plannedCategoryTotal: budgetCents / 100,
      projectedRemainder: (incomeCents - budgetCents) / 100,
    };
  }, [incomes, categoryBudgets]);

  const remainderClass =
    projectedRemainder >= 0 ? 'metric-value is-positive' : 'metric-value is-negative';

  return (
    <section className="dashboard-shell">
      <header className="dashboard-topbar">
        <div>
          <span className="brand-eyebrow">Budget Planner</span>
          <h1 className="card-title">Monthly Plan &amp; Paycheck Allocation</h1>
          <p className="card-subtitle">
            Balance your recurring income streams against calm monthly category targets.
          </p>
        </div>

        <div className="topbar-actions">
          <span className="badge-success">{incomes.length} Income Stream(s)</span>
        </div>
      </header>

      {error && <div className="alert-error">{error}</div>}
      {successMessage && <div className="alert-success">{successMessage}</div>}

      <div className="summary-grid" aria-label="Budget planner projection">
        <article className="metric-card">
          <span className="metric-label">Estimated Monthly Income</span>
          <strong className="metric-value">
            {loading ? '—' : formatCurrency(estimatedMonthlyIncome)}
          </strong>
          <span className="metric-hint">Calculated from your active income cadences</span>
        </article>

        <article className="metric-card">
          <span className="metric-label">Planned Category Budgets</span>
          <strong className="metric-value">{formatCurrency(plannedCategoryTotal)}</strong>
          <span className="metric-hint">Total allocated across {categoryBudgets.length} categories</span>
        </article>

        <article className="metric-card is-highlight">
          <span className="metric-label">Projected Remainder</span>
          <strong className={loading ? 'metric-value' : remainderClass}>
            {loading ? '—' : formatCurrency(projectedRemainder)}
          </strong>
          <span className="metric-hint">
            {projectedRemainder >= 0
              ? 'Available for bills, savings, or buffer'
              : 'Planned budgets exceed estimated monthly income'}
          </span>
        </article>
      </div>

      <div className="dashboard-content-grid">
        <section
          className="panel-card"
          id="income-sources-section"
          aria-labelledby="income-sources-heading"
        >
          <header className="panel-header">
            <h2 id="income-sources-heading" className="panel-title">
              Income Sources
            </h2>
            <p className="panel-subtitle">
              Add, edit, or remove paychecks and side income streams.
            </p>
          </header>

          <HowItWorks defaultOpen={false} />

          <form className="form-stack" onSubmit={handleIncomeSubmit}>
            <div className="field-group">
              <label className="field-label" htmlFor="income-description">
                Description
              </label>
              <input
                id="income-description"
                className="field-input"
                type="text"
                placeholder="e.g., Primary Paycheck, Freelance"
                value={incomeForm.sourceName}
                onChange={(e) =>
                  setIncomeForm((prev) => ({ ...prev, sourceName: e.target.value }))
                }
                required
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="income-amount">
                Amount ($)
              </label>
              <input
                id="income-amount"
                className="field-input"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="2000.00"
                value={incomeForm.amount}
                onChange={(e) =>
                  setIncomeForm((prev) => ({ ...prev, amount: e.target.value }))
                }
                required
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="income-cadence">
                Pay Frequency
              </label>
              <select
                id="income-cadence"
                className="field-input"
                value={incomeForm.paySchedule}
                onChange={(e) =>
                  setIncomeForm((prev) => ({ ...prev, paySchedule: e.target.value }))
                }
              >
                {CADENCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="field-help">
                Biweekly means every 2 weeks. Twice monthly means 2 times each month, usually on set dates.
              </p>
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="income-next-pay">
                Next Pay Date
              </label>
              <input
                id="income-next-pay"
                className="field-input"
                type="date"
                value={incomeForm.nextPayDate}
                onChange={(e) =>
                  setIncomeForm((prev) => ({ ...prev, nextPayDate: e.target.value }))
                }
                required
              />
            </div>

            <div className="action-row">
              {editingIncomeId && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={resetIncomeForm}
                  disabled={isSavingIncome}
                >
                  Cancel
                </button>
              )}
              <button className="btn-primary" type="submit" disabled={isSavingIncome}>
                {isSavingIncome
                  ? 'Saving...'
                  : editingIncomeId
                    ? 'Save Income Changes'
                    : 'Add Income Source'}
              </button>
            </div>
          </form>

          <div style={{ marginTop: '1.5rem' }}>
            {loading ? (
              <div className="empty-state">Loading your income sources...</div>
            ) : incomes.length === 0 ? (
              <div className="empty-state">
                <strong className="empty-state-title">No income sources yet</strong>
                <p className="empty-state-desc">
                  Fill out the form above and click &ldquo;Add Income Source&rdquo; to calculate
                  your monthly projection.
                </p>
              </div>
            ) : (
              <ul className="transaction-list">
                {incomes.map((income) => {
                  const cadenceOption = CADENCE_OPTIONS.find((opt) => opt.value === income.paySchedule);
                  const cadenceLabel = cadenceOption?.shortLabel || cadenceOption?.label || income.paySchedule;
                  const isBusy = busyIncomeId === income._id;

                  return (
                    <li key={income._id} className="transaction-item">
                      <div className="transaction-main">
                        <div className="transaction-title">{income.sourceName}</div>
                        <div className="transaction-meta">
                          <span className="category-tag">{cadenceLabel}</span>
                          {income.nextPayDate && (
                            <span>Next pay: {formatUtcDate(income.nextPayDate)}</span>
                          )}
                        </div>
                      </div>

                      <div className="transaction-right" style={{ flexWrap: 'wrap' }}>
                        <span className="transaction-amount">{formatCurrency(income.amount)}</span>
                        <div className="bill-actions">
                          <button
                            type="button"
                            className="btn-secondary btn-compact"
                            onClick={() => handleEditIncome(income)}
                            disabled={isBusy}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn-delete"
                            onClick={() => handleDeleteIncome(income._id)}
                            disabled={isBusy}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section className="panel-card" aria-labelledby="category-budgets-heading">
          <header className="panel-header">
            <h2 id="category-budgets-heading" className="panel-title">
              Category Budgets
            </h2>
            <p className="panel-subtitle">
              Set a planned monthly target amount for each spending category.
            </p>
          </header>

          <form className="form-stack" onSubmit={handleSaveCategoryBudgets}>
            {categoryBudgets.length === 0 ? (
              <div className="empty-state">
                <strong className="empty-state-title">No category budgets yet</strong>
                <p className="empty-state-desc">
                  Add a category below to set your monthly spending targets.
                </p>
              </div>
            ) : (
              <div className="budget-category-list">
                {categoryBudgets.map((item, index) => (
                  <div key={item.category} className="budget-category-card">
                    <div className="budget-category-info">
                      <label
                        className="budget-category-name"
                        htmlFor={`category-budget-${index}`}
                      >
                        {item.category}
                      </label>
                    </div>

                    <div className="budget-category-controls">
                      <span aria-hidden="true" style={{ color: 'var(--text-secondary)' }}>
                        $
                      </span>
                      <input
                        id={`category-budget-${index}`}
                        className="field-input budget-amount-input"
                        type="number"
                        min="0"
                        step="1"
                        value={item.targetAmount}
                        onChange={(e) => handleCategoryAmountChange(index, e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn-delete"
                        onClick={() => handleRemoveCategory(item.category)}
                        aria-label={`Remove ${item.category}`}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button className="btn-primary" type="submit">
              Save Category Budgets
            </button>
          </form>

          <form
            className="form-stack"
            onSubmit={handleAddCategory}
            style={{
              marginTop: '1.5rem',
              paddingTop: '1.25rem',
              borderTop: '1px solid var(--border-warm)',
            }}
          >
            <h3 className="panel-title" style={{ fontSize: '1.025rem' }}>
              Add a custom category
            </h3>
            <div className="schedule-grid">
              <div className="field-group">
                <label className="field-label" htmlFor="new-category-name">
                  Category Name
                </label>
                <input
                  id="new-category-name"
                  className="field-input"
                  type="text"
                  placeholder="e.g., Pet Care, School"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                />
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="new-category-target">
                  Monthly Target ($)
                </label>
                <input
                  id="new-category-target"
                  className="field-input"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="75"
                  value={newCategoryTarget}
                  onChange={(e) => setNewCategoryTarget(e.target.value)}
                />
              </div>
            </div>
            <button type="submit" className="btn-secondary">
              Add Category
            </button>
          </form>
        </section>
      </div>
    </section>
  );
}

export default Budget;

