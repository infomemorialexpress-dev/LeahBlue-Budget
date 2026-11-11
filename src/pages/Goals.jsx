import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { createGoal, deleteGoal, getGoals, updateGoal } from '../services/api.js';
import { formatCurrency, formatUtcDate } from '../utils/formatters.js';

function Goals() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [goals, setGoals] = useState([]);
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');

  const [activeFundGoalId, setActiveFundGoalId] = useState('');
  const [fundAmount, setFundAmount] = useState('');

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyGoalId, setBusyGoalId] = useState('');
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

  const loadGoals = useCallback(async () => {
    setError('');
    try {
      const data = await getGoals();
      setGoals(Array.isArray(data) ? data : []);
    } catch (err) {
      handleAuthOrError(err, 'Unable to load your savings goals.');
    } finally {
      setLoading(false);
    }
  }, [handleAuthOrError]);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  const handleCreateGoal = async (event) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    const numericTarget = Number(targetAmount);
    if (!name.trim() || !Number.isFinite(numericTarget) || numericTarget <= 0) {
      setError('Please enter a goal name and a target amount greater than $0.');
      return;
    }

    setIsSubmitting(true);
    try {
      await createGoal({
        name: name.trim(),
        targetAmount: numericTarget,
        ...(targetDate ? { targetDate } : {}),
      });
      setName('');
      setTargetAmount('');
      setTargetDate('');
      setSuccessMessage('Savings goal created.');
      await loadGoals();
    } catch (err) {
      handleAuthOrError(err, 'Could not create savings goal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenAddFunds = (goalId) => {
    setError('');
    setSuccessMessage('');
    setActiveFundGoalId(goalId);
    setFundAmount('');
  };

  const handleAddFundsSubmit = async (event, goalId) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    const contribution = Number(fundAmount);
    if (!Number.isFinite(contribution) || contribution <= 0) {
      setError('Please enter a contribution amount greater than $0.');
      return;
    }

    setBusyGoalId(goalId);
    try {
      await updateGoal(goalId, { contribution });
      setActiveFundGoalId('');
      setFundAmount('');
      setSuccessMessage('Funds added to your savings goal.');
      await loadGoals();
    } catch (err) {
      handleAuthOrError(err, 'Could not update savings goal.');
    } finally {
      setBusyGoalId('');
    }
  };

  const handleDeleteGoal = async (goalId) => {
    setError('');
    setSuccessMessage('');
    setBusyGoalId(goalId);
    try {
      await deleteGoal(goalId);
      if (activeFundGoalId === goalId) {
        setActiveFundGoalId('');
      }
      await loadGoals();
    } catch (err) {
      handleAuthOrError(err, 'Could not delete savings goal.');
    } finally {
      setBusyGoalId('');
    }
  };

  const totalSaved = goals.reduce((sum, g) => sum + Number(g.savedAmount || 0), 0);

  return (
    <section className="dashboard-shell">
      <header className="dashboard-topbar">
        <div>
          <span className="brand-eyebrow">Savings Goals</span>
          <h1 className="card-title">Family Savings &amp; Sinking Funds</h1>
          <p className="card-subtitle">
            Build cushions for emergencies, holidays, and family milestones step by step.
          </p>
        </div>

        <div className="topbar-actions">
          <span className="badge-success">Total Saved: {formatCurrency(totalSaved)}</span>
        </div>
      </header>

      {error && <div className="alert-error">{error}</div>}
      {successMessage && <div className="alert-success">{successMessage}</div>}

      <div className="dashboard-content-grid">
        <section className="panel-card" aria-labelledby="create-goal-heading">
          <header className="panel-header">
            <h2 id="create-goal-heading" className="panel-title">
              Create a savings goal
            </h2>
            <p className="panel-subtitle">
              Give your goal a clear target so every small deposit feels rewarding.
            </p>
          </header>

          <form className="form-stack" onSubmit={handleCreateGoal}>
            <div className="field-group">
              <label className="field-label" htmlFor="goal-name">
                Goal Name
              </label>
              <input
                id="goal-name"
                className="field-input"
                type="text"
                placeholder="e.g., Emergency Fund, Back to School"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="schedule-grid">
              <div className="field-group">
                <label className="field-label" htmlFor="goal-target-amount">
                  Target Amount ($)
                </label>
                <input
                  id="goal-target-amount"
                  className="field-input"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="1000.00"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  required
                />
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="goal-target-date">
                  Target Date (optional)
                </label>
                <input
                  id="goal-target-date"
                  className="field-input"
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                />
              </div>
            </div>

            <button className="btn-primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating Goal...' : 'Create Savings Goal'}
            </button>
          </form>
        </section>

        <section className="panel-card" aria-labelledby="active-goals-heading">
          <header className="panel-header">
            <h2 id="active-goals-heading" className="panel-title">
              Your Goals ({goals.length})
            </h2>
            <p className="panel-subtitle">Track dollars saved and percentage toward each goal.</p>
          </header>

          {loading ? (
            <div className="empty-state">Loading your savings goals...</div>
          ) : goals.length === 0 ? (
            <div className="empty-state">
              <strong className="empty-state-title">You have no savings goals yet</strong>
              <p className="empty-state-desc">
                Enter a goal name and target amount, then click &ldquo;Create Savings Goal&rdquo;
                to get started.
              </p>
            </div>
          ) : (
            <div className="goals-grid">
              {goals.map((goal) => {
                const saved = Number(goal.savedAmount || 0);
                const target = Number(goal.targetAmount || 0);
                const rawPercent = target > 0 ? Math.round((saved / target) * 100) : 0;
                const percent = Math.min(100, Math.max(0, rawPercent));
                const remaining = Math.max(0, target - saved);
                const isComplete = target > 0 && saved >= target;
                const isBusy = busyGoalId === goal._id;
                const isFunding = activeFundGoalId === goal._id;

                return (
                  <article key={goal._id} className="goal-card">
                    <div className="goal-header">
                      <div>
                        <h3 className="goal-title">{goal.name}</h3>
                        {goal.targetDate && (
                          <div className="goal-meta">
                            Target date: {formatUtcDate(goal.targetDate)}
                          </div>
                        )}
                      </div>

                      <span className={`goal-percent-pill ${isComplete ? 'is-complete' : ''}`}>
                        {isComplete ? '100% · Reached' : `${percent}%`}
                      </span>
                    </div>

                    <div className="progress-track" aria-hidden="true">
                      <div
                        className={`progress-fill ${isComplete ? 'is-complete' : ''}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    <div className="goal-amounts">
                      <span>
                        <strong>{formatCurrency(saved)}</strong> saved of{' '}
                        <strong>{formatCurrency(target)}</strong>
                      </span>
                      <span>
                        {isComplete ? 'Goal funded!' : `${formatCurrency(remaining)} to go`}
                      </span>
                    </div>

                    {isFunding ? (
                      <form
                        className="fund-form"
                        onSubmit={(e) => handleAddFundsSubmit(e, goal._id)}
                      >
                        <input
                          className="field-input"
                          type="number"
                          min="0.01"
                          step="0.01"
                          placeholder="Amount to add ($)"
                          value={fundAmount}
                          onChange={(e) => setFundAmount(e.target.value)}
                          autoFocus
                          required
                        />
                        <button
                          type="submit"
                          className="btn-sage"
                          disabled={isBusy}
                        >
                          {isBusy ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary btn-compact"
                          onClick={() => setActiveFundGoalId('')}
                          disabled={isBusy}
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <div className="bill-actions">
                        <button
                          type="button"
                          className="btn-sage"
                          onClick={() => handleOpenAddFunds(goal._id)}
                          disabled={isBusy}
                        >
                          Add Funds
                        </button>
                        <button
                          type="button"
                          className="btn-delete"
                          onClick={() => handleDeleteGoal(goal._id)}
                          disabled={isBusy}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

export default Goals;

