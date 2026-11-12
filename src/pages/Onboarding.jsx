import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createExpense, createIncome } from '../services/api.js';

const PAY_SCHEDULE_OPTIONS = [
  { value: 'weekly', label: 'Weekly', desc: 'Every week (52 paychecks/year)' },
  { value: 'biweekly', label: 'Biweekly', desc: 'Every 2 weeks (26 paychecks/year)' },
  { value: 'twice-monthly', label: 'Twice Monthly', desc: 'Twice a month (24 paychecks/year)' },
  { value: 'monthly', label: 'Monthly', desc: 'Once a month (12 paychecks/year)' },
  {
    value: 'irregular',
    label: 'Irregular / Variable Income',
    desc: 'My pay dates or income amounts change',
  },
];

function getTodayDateString() {
  return new Date().toISOString().split('T')[0];
}

function Onboarding() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [paySchedule, setPaySchedule] = useState('biweekly');
  const [nextPayDate, setNextPayDate] = useState('');
  const [sourceName, setSourceName] = useState('Primary Paycheck');
  const [amount, setAmount] = useState('');

  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('Bills');
  const [expenseDate, setExpenseDate] = useState(getTodayDateString);
  const [expenseNote, setExpenseNote] = useState('');
  const [addedExpensesCount, setAddedExpensesCount] = useState(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  const handleStepOneSubmit = (event) => {
    event.preventDefault();
    setError('');

    if (!paySchedule || !nextPayDate) {
      setError('Please select a pay frequency and your next paycheck date.');
      return;
    }

    setStep(2);
  };

  const handleStepTwoSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Please enter a valid take-home pay amount greater than 0.');
      return;
    }

    setIsSubmitting(true);
    try {
      await createIncome({
        sourceName: sourceName.trim() || 'Primary Paycheck',
        amount: numericAmount,
        paySchedule,
        nextPayDate,
      });
      setStep(3);
    } catch (err) {
      setError(err.message || 'Could not save your income details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddExpenseSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setFeedback('');

    const numericExpense = Number(expenseAmount);
    if (!expenseDesc.trim() || !Number.isFinite(numericExpense) || numericExpense <= 0) {
      setError('Please enter an expense description and a valid amount.');
      return;
    }

    setIsSubmitting(true);
    try {
      await createExpense({
        description: expenseDesc.trim(),
        amount: numericExpense,
        category: expenseCategory.trim() || 'General',
        date: expenseDate || getTodayDateString(),
        ...(expenseNote.trim() ? { note: expenseNote.trim() } : {}),
      });
      setAddedExpensesCount((count) => count + 1);
      setExpenseDesc('');
      setExpenseAmount('');
      setExpenseNote('');
      setFeedback('Expense added! Add another or go to your dashboard.');
    } catch (err) {
      setError(err.message || 'Could not save your expense.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedScheduleLabel =
    PAY_SCHEDULE_OPTIONS.find((item) => item.value === paySchedule)?.label || paySchedule;

  return (
    <section className="auth-container">
      <div className="card onboarding-card">
        <header className="card-header">
          <span className="brand-eyebrow">Paycheck Setup</span>
          <h1 className="card-title">Set up your pay cycle</h1>
          <p className="card-subtitle">
            Tell us how you get paid so we can organize your budget around each paycheck.
          </p>
        </header>

        <div className="stepper" aria-label="Onboarding steps">
          <div className={`step-pill ${step === 1 ? 'is-active' : step > 1 ? 'is-done' : ''}`}>
            1. Schedule
          </div>
          <div className={`step-pill ${step === 2 ? 'is-active' : step > 2 ? 'is-done' : ''}`}>
            2. Take-Home
          </div>
          <div className={`step-pill ${step === 3 ? 'is-active' : ''}`}>3. Finish</div>
        </div>

        {error && (
          <div className="alert-error" style={{ marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        {feedback && (
          <div className="alert-success" style={{ marginBottom: '1rem' }}>
            {feedback}
          </div>
        )}

        {step === 1 && (
          <form className="form-stack" onSubmit={handleStepOneSubmit}>
            <div className="field-group">
              <span className="field-label">Pay frequency</span>
              <div className="schedule-grid">
                {PAY_SCHEDULE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`schedule-option ${paySchedule === option.value ? 'is-selected' : ''}`}
                    onClick={() => setPaySchedule(option.value)}
                  >
                    <span className="schedule-title">{option.label}</span>
                    <span className="schedule-desc">{option.desc}</span>
                  </button>
                ))}
              </div>
              <p className="field-help">
                Biweekly means every 2 weeks. Twice monthly means 2 times each month, usually on set dates.
              </p>
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="onboarding-next-pay-date">
                Date of your next paycheck
              </label>
              <input
                id="onboarding-next-pay-date"
                className="field-input"
                type="date"
                value={nextPayDate}
                onChange={(e) => setNextPayDate(e.target.value)}
                required
              />
            </div>

            <button className="btn-primary" type="submit">
              Continue to Take-Home Pay
            </button>
          </form>
        )}

        {step === 2 && (
          <form className="form-stack" onSubmit={handleStepTwoSubmit}>
            <div className="field-group">
              <label className="field-label" htmlFor="onboarding-source-name">
                Paycheck label
              </label>
              <input
                id="onboarding-source-name"
                className="field-input"
                type="text"
                placeholder="Primary Paycheck"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                required
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="onboarding-amount">
                Take-home pay amount ($)
              </label>
              <input
                id="onboarding-amount"
                className="field-input"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="2500.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>

            <div className="action-row">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setError('');
                  setStep(1);
                }}
                disabled={isSubmitting}
              >
                Back
              </button>
              <button className="btn-primary" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Income & Continue'}
              </button>
            </div>
          </form>
        )}

        {step === 3 && (
          <div className="form-stack">
            <div>
              <span className="badge-success">Paycheck Saved</span>
            </div>

            <div className="summary-box">
              <div>
                <strong>Source:</strong> {sourceName.trim() || 'Primary Paycheck'}
              </div>
              <div>
                <strong>Take-Home Pay:</strong> ${Number(amount).toFixed(2)} ({selectedScheduleLabel})
              </div>
              <div>
                <strong>Next Paycheck:</strong> {nextPayDate}
              </div>
              {addedExpensesCount > 0 && (
                <div>
                  <strong>First Expenses Added:</strong> {addedExpensesCount}
                </div>
              )}
            </div>

            {showExpenseForm && (
              <form className="form-stack" onSubmit={handleAddExpenseSubmit}>
                <div className="field-group">
                  <label className="field-label" htmlFor="onboarding-expense-desc">
                    Expense description
                  </label>
                  <input
                    id="onboarding-expense-desc"
                    className="field-input"
                    type="text"
                    placeholder="Rent, Electric Bill, Groceries..."
                    value={expenseDesc}
                    onChange={(e) => setExpenseDesc(e.target.value)}
                    required
                  />
                </div>

                <div className="schedule-grid">
                  <div className="field-group">
                    <label className="field-label" htmlFor="onboarding-expense-amount">
                      Amount ($)
                    </label>
                    <input
                      id="onboarding-expense-amount"
                      className="field-input"
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="120.00"
                      value={expenseAmount}
                      onChange={(e) => setExpenseAmount(e.target.value)}
                      required
                    />
                  </div>

                  <div className="field-group">
                    <label className="field-label" htmlFor="onboarding-expense-category">
                      Category
                    </label>
                    <input
                      id="onboarding-expense-category"
                      className="field-input"
                      type="text"
                      placeholder="Bills"
                      value={expenseCategory}
                      onChange={(e) => setExpenseCategory(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="schedule-grid">
                  <div className="field-group">
                    <label className="field-label" htmlFor="onboarding-expense-date">
                      Date
                    </label>
                    <input
                      id="onboarding-expense-date"
                      className="field-input"
                      type="date"
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                      required
                    />
                  </div>

                  <div className="field-group">
                    <label className="field-label" htmlFor="onboarding-expense-note">
                      Note (optional)
                    </label>
                    <input
                      id="onboarding-expense-note"
                      className="field-input"
                      type="text"
                      placeholder="Optional note"
                      value={expenseNote}
                      onChange={(e) => setExpenseNote(e.target.value)}
                    />
                  </div>
                </div>

                <button className="btn-secondary" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving Expense...' : 'Save Expense'}
                </button>
              </form>
            )}

            <div className="action-row">
              {!showExpenseForm && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setError('');
                    setShowExpenseForm(true);
                  }}
                >
                  Add first expenses
                </button>
              )}
              <button
                type="button"
                className="btn-primary"
                onClick={() => navigate('/dashboard')}
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default Onboarding;

