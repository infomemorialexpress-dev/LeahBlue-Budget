import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  createPaycheckPlan,
  deletePaycheckPlan,
  getPaycheckPlans,
  getPaycheckPlanSuggestion,
} from '../services/api.js';
import { formatCurrency, formatUtcDate } from '../utils/formatters.js';

function PaycheckPlanner() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingPlanId, setDeletingPlanId] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Form State
  const [incomeId, setIncomeId] = useState('');
  const [paycheckAmount, setPaycheckAmount] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [paySchedule, setPaySchedule] = useState('biweekly');
  const [reservedBills, setReservedBills] = useState([]);
  const [categoryAllocations, setCategoryAllocations] = useState([]);
  const [savingsAllocation, setSavingsAllocation] = useState('0');
  const [personalSpending, setPersonalSpending] = useState('0');

  // History State
  const [savedPlans, setSavedPlans] = useState([]);
  const [newCategoryName, setNewCategoryName] = useState('');

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

  const loadData = useCallback(async () => {
    setError('');
    try {
      const [suggestion, plans] = await Promise.all([
        getPaycheckPlanSuggestion(),
        getPaycheckPlans(),
      ]);

      if (suggestion) {
        setIncomeId(suggestion.income?._id || '');
        setPaycheckAmount(String(suggestion.paycheckAmount ?? 0));
        setPayDate(
          suggestion.payDate
            ? String(suggestion.payDate).slice(0, 10)
            : new Date().toISOString().split('T')[0],
        );
        setPaySchedule(suggestion.paySchedule || 'biweekly');
        setReservedBills(
          Array.isArray(suggestion.reservedBills)
            ? suggestion.reservedBills.map((b) => ({ ...b, selected: true }))
            : [],
        );
        setCategoryAllocations(
          Array.isArray(suggestion.categoryAllocations)
            ? suggestion.categoryAllocations.map((c) => ({
                name: c.name,
                amount: String(c.amount ?? 0),
              }))
            : [],
        );
        setSavingsAllocation(String(suggestion.savingsAllocation ?? 0));
        setPersonalSpending(String(suggestion.personalSpending ?? 0));
      }

      setSavedPlans(Array.isArray(plans) ? plans : []);
    } catch (err) {
      handleAuthOrError(err, 'Unable to load paycheck planning data.');
    } finally {
      setLoading(false);
    }
  }, [handleAuthOrError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Calculations
  const numericPaycheck = Number(paycheckAmount) || 0;

  const reservedBillsTotal = useMemo(() => {
    return reservedBills
      .filter((b) => b.selected)
      .reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
  }, [reservedBills]);

  const categoriesTotal = useMemo(() => {
    return categoryAllocations.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  }, [categoryAllocations]);

  const numericSavings = Number(savingsAllocation) || 0;
  const numericPersonalSpending = Number(personalSpending) || 0;

  const totalCommitted = useMemo(() => {
    return Math.round((reservedBillsTotal + categoriesTotal + numericSavings + numericPersonalSpending) * 100) / 100;
  }, [reservedBillsTotal, categoriesTotal, numericSavings, numericPersonalSpending]);

  const remainingUnallocated = useMemo(() => {
    return Math.round((numericPaycheck - totalCommitted) * 100) / 100;
  }, [numericPaycheck, totalCommitted]);

  // Handlers
  const handleToggleBill = (billId) => {
    setReservedBills((prev) =>
      prev.map((b) => (b._id === billId ? { ...b, selected: !b.selected } : b)),
    );
  };

  const handleCategoryChange = (index, value) => {
    setCategoryAllocations((prev) =>
      prev.map((cat, i) =>
        i === index ? { ...cat, amount: value === '' ? '' : Math.max(0, Number(value)) } : cat,
      ),
    );
  };

  const handleQuickAdjustCategory = (index, delta) => {
    setCategoryAllocations((prev) =>
      prev.map((cat, i) => {
        if (i !== index) return cat;
        const current = Number(cat.amount) || 0;
        const next = Math.max(0, Math.round((current + delta) * 100) / 100);
        return { ...cat, amount: String(next) };
      }),
    );
  };

  const handleAddCustomCategory = (e) => {
    e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    setCategoryAllocations((prev) => [...prev, { name: trimmed, amount: '50' }]);
    setNewCategoryName('');
  };

  const handleRemoveCategory = (index) => {
    setCategoryAllocations((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAutoBalance = () => {
    if (remainingUnallocated > 0) {
      setPersonalSpending((prev) => String(Math.round(((Number(prev) || 0) + remainingUnallocated) * 100) / 100));
    }
  };

  const handleSubmitPlan = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (numericPaycheck <= 0) {
      setError('Please enter a valid paycheck amount greater than $0.');
      return;
    }

    if (remainingUnallocated < 0) {
      setError('Total allocations exceed your paycheck. Please reduce allocations so you are not over-budget.');
      return;
    }

    const payload = {
      incomeId: incomeId || undefined,
      payDate: new Date(payDate),
      paycheckAmount: numericPaycheck,
      reservedBillsTotal,
      categoryAllocations: categoryAllocations.map((c) => ({
        name: c.name,
        amount: Number(c.amount) || 0,
      })),
      savingsAllocation: numericSavings,
      personalSpending: numericPersonalSpending,
      remainingUnallocated,
    };

    setIsSaving(true);
    try {
      await createPaycheckPlan(payload);
      setSuccessMessage('✓ Paycheck Plan saved successfully! Every dollar has a purpose.');
      const plans = await getPaycheckPlans();
      setSavedPlans(Array.isArray(plans) ? plans : []);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      handleAuthOrError(err, 'Could not save paycheck plan.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePlan = async (planId) => {
    setError('');
    setSuccessMessage('');
    setDeletingPlanId(planId);
    try {
      await deletePaycheckPlan(planId);
      setSuccessMessage('Paycheck plan removed.');
      setSavedPlans((prev) => prev.filter((p) => p._id !== planId));
    } catch (err) {
      handleAuthOrError(err, 'Could not delete paycheck plan.');
    } finally {
      setDeletingPlanId('');
    }
  };

  const isOverAllocated = remainingUnallocated < 0;
  const isPerfect = remainingUnallocated === 0;

  return (
    <section className="dashboard-shell">
      <header className="dashboard-topbar">
        <div>
          <span className="brand-eyebrow">Guided Budgeting</span>
          <h1 className="card-title">Plan My Paycheck</h1>
          <p className="dashboard-headline">
            Give every dollar a job before it arrives so you know exactly what is safe to spend.
          </p>
          <p className="card-subtitle">
            Pay schedule: <strong style={{ textTransform: 'capitalize' }}>{paySchedule}</strong> • Next Pay Date:{' '}
            <strong>{formatUtcDate(payDate)}</strong>
          </p>
        </div>

        <div className="topbar-actions">
          <Link className="btn-secondary" to="/dashboard">
            Back to Dashboard
          </Link>
        </div>
      </header>

      {error && <div className="alert-error">{error}</div>}
      {successMessage && <div className="alert-success">{successMessage}</div>}

      {/* Real-time Allocation Banner */}
      <div className={`planner-summary-banner ${isOverAllocated ? 'is-over' : isPerfect ? 'is-balanced' : 'is-buffer'}`}>
        <div className="planner-summary-main">
          <span className="planner-summary-label">
            {isOverAllocated
              ? '⚠️ Over-allocated'
              : isPerfect
                ? '✓ Every dollar accounted for'
                : 'Safe Buffer / Left to Allocate'}
          </span>
          <strong className="planner-summary-value">
            {formatCurrency(remainingUnallocated)}
          </strong>
          <span className="planner-summary-hint">
            {isOverAllocated
              ? 'Allocations exceed your paycheck amount. Please reduce spending or savings.'
              : isPerfect
                ? 'Zero-based perfection: $0 unassigned.'
                : 'Unassigned buffer for unexpected needs or extra personal spending.'}
          </span>
        </div>

        {remainingUnallocated > 0 && (
          <button type="button" className="btn-secondary btn-compact" onClick={handleAutoBalance}>
            Add Buffer to Personal Spending
          </button>
        )}
      </div>

      <div className="planner-layout-grid">
        <form className="form-stack" onSubmit={handleSubmitPlan}>
          {/* STEP 1: Confirm Paycheck */}
          <section className="panel-card">
            <header className="panel-header">
              <span className="step-pill is-active" style={{ width: 'fit-content', marginBottom: '0.5rem' }}>
                Step 1 of 4
              </span>
              <h2 className="panel-title">Confirm Your Paycheck</h2>
              <p className="panel-subtitle">
                Verify the paycheck amount and arrival date you are planning for.
              </p>
            </header>

            <div className="schedule-grid">
              <div className="field-group">
                <label className="field-label" htmlFor="plan-paycheck-amount">
                  Paycheck Amount ($)
                </label>
                <input
                  id="plan-paycheck-amount"
                  className="field-input"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={paycheckAmount}
                  onChange={(e) => setPaycheckAmount(e.target.value)}
                  required
                />
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="plan-paycheck-date">
                  Paycheck Date
                </label>
                <input
                  id="plan-paycheck-date"
                  className="field-input"
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  required
                />
              </div>
            </div>
          </section>

          {/* STEP 2: Reserve Upcoming Bills */}
          <section className="panel-card">
            <header className="panel-header">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span className="step-pill is-active" style={{ width: 'fit-content', marginBottom: '0.5rem' }}>
                    Step 2 of 4
                  </span>
                  <h2 className="panel-title">Reserve Upcoming Bills ({reservedBills.length})</h2>
                  <p className="panel-subtitle">
                    Bills due before your next payday are pre-selected to protect essential payments.
                  </p>
                </div>
                <strong className="metric-value" style={{ fontSize: '1.25rem' }}>
                  {formatCurrency(reservedBillsTotal)}
                </strong>
              </div>
            </header>

            {loading ? (
              <div className="empty-state">Finding upcoming bills...</div>
            ) : reservedBills.length === 0 ? (
              <div className="empty-state">
                <p>No unpaid bills due before your next payday! $0 needed for bills from this check.</p>
              </div>
            ) : (
              <ul className="transaction-list">
                {reservedBills.map((bill) => (
                  <li
                    key={bill._id}
                    className={`transaction-item bill-item ${bill.selected ? 'is-reserved' : 'is-unreserved'}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleToggleBill(bill._id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <input
                        type="checkbox"
                        checked={bill.selected}
                        onChange={() => {}}
                        aria-label={`Reserve ${bill.name}`}
                        style={{ width: '1.1rem', height: '1.1rem', cursor: 'pointer' }}
                      />
                      <div>
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
                          <span>Due day {bill.dueDate}</span>
                        </div>
                      </div>
                    </div>
                    <strong className="transaction-amount">{formatCurrency(bill.amount)}</strong>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* STEP 3: Everyday Categories */}
          <section className="panel-card">
            <header className="panel-header">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span className="step-pill is-active" style={{ width: 'fit-content', marginBottom: '0.5rem' }}>
                    Step 3 of 4
                  </span>
                  <h2 className="panel-title">Everyday Spending Categories</h2>
                  <p className="panel-subtitle">
                    Allocated per paycheck based on your planned monthly category budgets.
                  </p>
                </div>
                <strong className="metric-value" style={{ fontSize: '1.25rem' }}>
                  {formatCurrency(categoriesTotal)}
                </strong>
              </div>
            </header>

            <div className="budget-category-list">
              {categoryAllocations.map((cat, idx) => (
                <div key={idx} className="budget-category-card">
                  <div className="budget-category-info">
                    <label className="budget-category-name">{cat.name}</label>
                    <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                      Planned for this paycheck
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className="btn-quick-adjust"
                      onClick={() => handleQuickAdjustCategory(idx, -10)}
                      title="Decrease by $10"
                    >
                      -$10
                    </button>
                    <div className="currency-field">
                      <span className="currency-symbol">$</span>
                      <input
                        className="field-input budget-amount-input"
                        type="number"
                        min="0"
                        step="1"
                        value={cat.amount}
                        onChange={(e) => handleCategoryChange(idx, e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn-quick-adjust"
                      onClick={() => handleQuickAdjustCategory(idx, 10)}
                      title="Increase by $10"
                    >
                      +$10
                    </button>
                    <button
                      type="button"
                      className="btn-remove-category"
                      onClick={() => handleRemoveCategory(idx)}
                      title="Remove category"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
              <input
                className="field-input"
                type="text"
                placeholder="Add custom category (e.g. Pet Care, Dining)"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
              <button type="button" className="btn-secondary" onClick={handleAddCustomCategory}>
                + Add
              </button>
            </div>
          </section>

          {/* STEP 4: Savings & Personal Spending */}
          <section className="panel-card">
            <header className="panel-header">
              <span className="step-pill is-active" style={{ width: 'fit-content', marginBottom: '0.5rem' }}>
                Step 4 of 4
              </span>
              <h2 className="panel-title">Savings &amp; Personal Spending</h2>
              <p className="panel-subtitle">
                Set aside money for your future and decide what is completely safe for guilt-free spending.
              </p>
            </header>

            <div className="schedule-grid">
              <div className="field-group">
                <label className="field-label" htmlFor="plan-savings-alloc">
                  Savings Goals Allocation ($)
                </label>
                <div className="currency-field">
                  <span className="currency-symbol">$</span>
                  <input
                    id="plan-savings-alloc"
                    className="field-input"
                    type="number"
                    min="0"
                    step="5"
                    value={savingsAllocation}
                    onChange={(e) => setSavingsAllocation(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.35rem' }}>
                  <button
                    type="button"
                    className="btn-quick-adjust"
                    onClick={() => setSavingsAllocation((prev) => String(Math.max(0, (Number(prev) || 0) + 25)))}
                  >
                    +$25
                  </button>
                  <button
                    type="button"
                    className="btn-quick-adjust"
                    onClick={() => setSavingsAllocation((prev) => String(Math.max(0, (Number(prev) || 0) + 50)))}
                  >
                    +$50
                  </button>
                </div>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="plan-personal-spending">
                  Personal Spending / Guilt-Free Fun ($)
                </label>
                <div className="currency-field">
                  <span className="currency-symbol">$</span>
                  <input
                    id="plan-personal-spending"
                    className="field-input"
                    type="number"
                    min="0"
                    step="5"
                    value={personalSpending}
                    onChange={(e) => setPersonalSpending(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.35rem' }}>
                  <button
                    type="button"
                    className="btn-quick-adjust"
                    onClick={() => setPersonalSpending((prev) => String(Math.max(0, (Number(prev) || 0) + 25)))}
                  >
                    +$25
                  </button>
                  <button
                    type="button"
                    className="btn-quick-adjust"
                    onClick={() => setPersonalSpending((prev) => String(Math.max(0, (Number(prev) || 0) + 50)))}
                  >
                    +$50
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Action Row */}
          <div className="action-row" style={{ marginTop: '0.5rem' }}>
            <button
              type="submit"
              className="btn-primary"
              style={{ width: '100%', padding: '0.9rem', fontSize: '1.05rem' }}
              disabled={isSaving || isOverAllocated}
            >
              {isSaving
                ? 'Saving Plan...'
                : isOverAllocated
                  ? '⚠️ Adjust Plan (Over-allocated)'
                  : '✓ Save & Finalize Paycheck Plan'}
            </button>
          </div>
        </form>

        {/* Previous Saved Plans Sidebar / Review */}
        <aside className="panel-card" style={{ height: 'fit-content' }}>
          <header className="panel-header">
            <h2 className="panel-title">Saved Paycheck Plans ({savedPlans.length})</h2>
            <p className="panel-subtitle">Review previous allocations and track your plan consistency.</p>
          </header>

          {savedPlans.length === 0 ? (
            <div className="empty-state">
              <p>No saved plans yet. Finalize the plan on the left to save your first paycheck allocation!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {savedPlans.map((plan) => (
                <article key={plan._id} className="surface-panel" style={{ padding: '0.9rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <strong>{formatUtcDate(plan.payDate)}</strong>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <span className="badge-success">{formatCurrency(plan.paycheckAmount)}</span>
                      <button
                        type="button"
                        className="btn-delete"
                        style={{ fontSize: '0.725rem', padding: '0.15rem 0.4rem', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--accent-coral)' }}
                        onClick={() => handleDeletePlan(plan._id)}
                        disabled={deletingPlanId === plan._id}
                        aria-label="Delete this plan"
                        title="Delete plan"
                      >
                        {deletingPlanId === plan._id ? '...' : '✕'}
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <div>Reserved Bills: {formatCurrency(plan.reservedBillsTotal)}</div>
                    <div>Categories: {formatCurrency(plan.categoryAllocations?.reduce((s, c) => s + (c.amount || 0), 0) || 0)}</div>
                    <div>Savings: {formatCurrency(plan.savingsAllocation)}</div>
                    <div>Personal Fun: {formatCurrency(plan.personalSpending)}</div>
                    {plan.remainingUnallocated !== 0 && (
                      <div>Buffer: {formatCurrency(plan.remainingUnallocated)}</div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

export default PaycheckPlanner;
