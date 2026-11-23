import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import HowItWorks from '../components/HowItWorks.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
  DEFAULT_CATEGORY_BUDGETS,
  createIncome,
  deleteIncome,
  getCategoryBudgets,
  getIncome,
  saveCategoryBudgets,
  updateIncome,
} from '../services/api.js';
import { formatCurrency, formatOrdinalDay, formatUtcDate } from '../utils/formatters.js';

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
  firstPayDay: '1',
  secondPayDay: '15',
};

function Budget() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const userKey = user?.id || user?.email || 'default';

  const [incomes, setIncomes] = useState([]);
  const [incomeForm, setIncomeForm] = useState(INITIAL_INCOME_FORM);
  const [editingIncomeId, setEditingIncomeId] = useState('');

  const [categoryBudgets, setCategoryBudgets] = useState(DEFAULT_CATEGORY_BUDGETS);
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
        if (checkCancelled()) return [];
        const incomeList = Array.isArray(data) ? data : [];
        setIncomes(incomeList);
        return incomeList;
      } catch (err) {
        if (checkCancelled()) return [];
        handleAuthOrError(err, 'Unable to load your income sources.');
        return [];
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

    async function init() {
      const loadedIncomes = await loadIncomes(() => cancelled);
      const loadedBudgets = await getCategoryBudgets(userKey);
      if (!cancelled && Array.isArray(loadedBudgets)) {
        setCategoryBudgets(loadedBudgets);
      }

      if (cancelled) return;

      const isEditAction =
        location.state?.action === 'edit-income' ||
        location.hash === '#edit-income' ||
        location.hash === '#income';

      if (isEditAction) {
        const list = Array.isArray(loadedIncomes) ? loadedIncomes : [];
        if (list.length > 0) {
          const firstIncome = list[0];
          setEditingIncomeId(firstIncome._id);
          setIncomeForm({
            sourceName: firstIncome.sourceName || '',
            amount: String(firstIncome.amount ?? ''),
            paySchedule: firstIncome.paySchedule || 'biweekly',
            nextPayDate: firstIncome.nextPayDate
              ? String(firstIncome.nextPayDate).slice(0, 10)
              : getTodayDateString(),
            firstPayDay: String(firstIncome.firstPayDay ?? '1'),
            secondPayDay: String(firstIncome.secondPayDay ?? '15'),
          });
        }

        setTimeout(() => {
          const el = document.getElementById('income-sources-section');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            const amountInput = document.getElementById('income-amount');
            if (amountInput) {
              amountInput.focus();
              amountInput.select?.();
            }
          }
        }, 120);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [loadIncomes, userKey, location.key, location.pathname, location.state, location.hash]);

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
    };

    if (incomeForm.paySchedule === 'twice-monthly') {
      const d1 = Number(incomeForm.firstPayDay || 1);
      const d2 = Number(incomeForm.secondPayDay || 15);
      if (!Number.isInteger(d1) || d1 < 1 || d1 > 31 || !Number.isInteger(d2) || d2 < 1 || d2 > 31) {
        setError('Both pay days must be whole numbers between 1 and 31.');
        return;
      }
      payload.firstPayDay = d1;
      payload.secondPayDay = d2;
    } else if (incomeForm.paySchedule === 'irregular') {
      payload.nextPayDate = incomeForm.nextPayDate || getTodayDateString();
    } else {
      if (!incomeForm.nextPayDate) {
        setError('Please select your next pay date.');
        return;
      }
      payload.nextPayDate = incomeForm.nextPayDate;
    }

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
      firstPayDay: String(income.firstPayDay ?? '1'),
      secondPayDay: String(income.secondPayDay ?? '15'),
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
    setCategoryBudgets((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      return list.map((item, idx) =>
        idx === index
          ? {
              ...item,
              targetAmount: nextValue === '' ? '' : Math.max(0, Number(nextValue)),
            }
          : item,
      );
    });
  };

  const handleSaveCategoryBudgets = async (event) => {
    event.preventDefault();
    setError('');
    const list = Array.isArray(categoryBudgets) ? categoryBudgets : [];
    const sanitized = list.map((item) => ({
      category: item.category,
      targetAmount: Math.round(Math.max(0, Number(item.targetAmount || 0)) * 100) / 100,
    }));
    setCategoryBudgets(sanitized);
    try {
      const saved = await saveCategoryBudgets(userKey, sanitized);
      if (Array.isArray(saved) && saved.length > 0) {
        setCategoryBudgets(saved);
      }
      setSuccessMessage('Category budgets saved.');
    } catch {
      setSuccessMessage('Category budgets saved locally.');
    }
  };

  const handleAddCategory = async (event) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    const trimmedName = newCategoryName.trim();
    if (!trimmedName) {
      setError('Please enter a category name.');
      return;
    }

    const list = Array.isArray(categoryBudgets) ? categoryBudgets : [];
    const exists = list.some(
      (item) => (item?.category || '').toLowerCase() === trimmedName.toLowerCase(),
    );
    if (exists) {
      setError(`"${trimmedName}" is already in your category budgets.`);
      return;
    }

    const parsedTarget = Math.round(Math.max(0, Number(newCategoryTarget || 0)) * 100) / 100;
    const updated = [...list, { category: trimmedName, targetAmount: parsedTarget }];
    setCategoryBudgets(updated);
    setNewCategoryName('');
    setNewCategoryTarget('');
    try {
      const saved = await saveCategoryBudgets(userKey, updated);
      if (Array.isArray(saved) && saved.length > 0) {
        setCategoryBudgets(saved);
      }
      setSuccessMessage(`Added "${trimmedName}" to category budgets.`);
    } catch {
      setSuccessMessage(`Added "${trimmedName}" to category budgets (saved locally).`);
    }
  };

  const handleRemoveCategory = async (categoryName) => {
    const list = Array.isArray(categoryBudgets) ? categoryBudgets : [];
    const updated = list.filter((item) => item.category !== categoryName);
    setCategoryBudgets(updated);
    try {
      const saved = await saveCategoryBudgets(userKey, updated);
      if (Array.isArray(saved)) {
        setCategoryBudgets(saved);
      }
      setSuccessMessage(`Removed "${categoryName}" from category budgets.`);
    } catch {
      setSuccessMessage(`Removed "${categoryName}" from category budgets.`);
    }
  };

  const { estimatedMonthlyIncome, plannedCategoryTotal, projectedRemainder } = useMemo(() => {
    const safeIncomes = Array.isArray(incomes) ? incomes : [];
    const safeBudgets = Array.isArray(categoryBudgets) ? categoryBudgets : [];

    const incomeCents = safeIncomes.reduce(
      (sum, item) => sum + toMonthlyIncomeCents(item?.amount, item?.paySchedule),
      0,
    );
    const budgetCents = safeBudgets.reduce(
      (sum, item) => sum + roundCents(item?.targetAmount),
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

  const safeCategoryBudgets = Array.isArray(categoryBudgets) ? categoryBudgets : [];

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
          <span className="metric-hint">Total allocated across {safeCategoryBudgets.length} categories</span>
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

            {incomeForm.paySchedule === 'twice-monthly' ? (
              <div className="schedule-grid">
                <div className="field-group">
                  <label className="field-label" htmlFor="income-first-pay-day">
                    First Pay Day (1–31)
                  </label>
                  <input
                    id="income-first-pay-day"
                    className="field-input"
                    type="number"
                    min="1"
                    max="31"
                    step="1"
                    placeholder="1"
                    value={incomeForm.firstPayDay}
                    onChange={(e) =>
                      setIncomeForm((prev) => ({ ...prev, firstPayDay: e.target.value }))
                    }
                    required
                  />
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="income-second-pay-day">
                    Second Pay Day (1–31)
                  </label>
                  <input
                    id="income-second-pay-day"
                    className="field-input"
                    type="number"
                    min="1"
                    max="31"
                    step="1"
                    placeholder="15"
                    value={incomeForm.secondPayDay}
                    onChange={(e) =>
                      setIncomeForm((prev) => ({ ...prev, secondPayDay: e.target.value }))
                    }
                    required
                  />
                </div>
              </div>
            ) : incomeForm.paySchedule === 'irregular' ? (
              <div className="field-group">
                <label className="field-label" htmlFor="income-date-received">
                  Date Received (Optional)
                </label>
                <input
                  id="income-date-received"
                  className="field-input"
                  type="date"
                  value={incomeForm.nextPayDate}
                  onChange={(e) =>
                    setIncomeForm((prev) => ({ ...prev, nextPayDate: e.target.value }))
                  }
                />
              </div>
            ) : (
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
            )}

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
                          {income.paySchedule === 'twice-monthly' && (income.firstPayDay || income.secondPayDay) ? (
                            <span>
                              Pay days: {formatOrdinalDay(income.firstPayDay || 1)} &amp; {formatOrdinalDay(income.secondPayDay || 15)} (Next: {formatUtcDate(income.nextPayDate)})
                            </span>
                          ) : income.paySchedule === 'irregular' ? (
                            <span>{income.nextPayDate ? `Received: ${formatUtcDate(income.nextPayDate)}` : 'Irregular'}</span>
                          ) : (
                            income.nextPayDate && (
                              <span>Next pay: {formatUtcDate(income.nextPayDate)}</span>
                            )
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
            {safeCategoryBudgets.length === 0 ? (
              <div className="empty-state">
                <strong className="empty-state-title">No category budgets yet</strong>
                <p className="empty-state-desc">
                  Add a category below to set your monthly spending targets.
                </p>
              </div>
            ) : (
              <div className="budget-category-list">
                {safeCategoryBudgets.map((item, index) => (
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

