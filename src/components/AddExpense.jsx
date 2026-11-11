import { useState } from 'react';
import { createExpense } from '../services/api.js';

const EXPENSE_CATEGORIES = [
  'Groceries',
  'Gas',
  'Kids',
  'Household',
  'Dining Out',
  'Other',
];

function getTodayDateString() {
  return new Date().toISOString().split('T')[0];
}

function AddExpense({ onExpenseAdded }) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [date, setDate] = useState(getTodayDateString);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    const numericAmount = Number(amount);
    if (!description.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Please enter a description and an amount greater than $0.');
      return;
    }

    setIsSubmitting(true);
    try {
      await createExpense({
        description: description.trim(),
        amount: numericAmount,
        category,
        date,
        ...(note.trim() ? { note: note.trim() } : {}),
      });

      setDescription('');
      setAmount('');
      setCategory(EXPENSE_CATEGORIES[0]);
      setDate(getTodayDateString());
      setNote('');
      setSuccessMessage('Expense saved.');

      if (typeof onExpenseAdded === 'function') {
        await onExpenseAdded();
      }
    } catch (err) {
      setError(err.message || 'Could not add expense. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="panel-card" aria-labelledby="add-expense-heading">
      <header className="panel-header">
        <h2 id="add-expense-heading" className="panel-title">
          Add an expense
        </h2>
        <p className="panel-subtitle">Quickly log what you spent so your balance stays current.</p>
      </header>

      {error && (
        <div className="alert-error" style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {successMessage && (
        <div className="alert-success" style={{ marginBottom: '1rem' }}>
          {successMessage}
        </div>
      )}

      <form className="form-stack" onSubmit={handleSubmit}>
        <div className="field-group">
          <label className="field-label" htmlFor="expense-description">
            Description
          </label>
          <input
            id="expense-description"
            className="field-input"
            type="text"
            placeholder="e.g., Trader Joe's groceries"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>

        <div className="schedule-grid">
          <div className="field-group">
            <label className="field-label" htmlFor="expense-amount">
              Amount ($)
            </label>
            <input
              id="expense-amount"
              className="field-input"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="45.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="expense-category">
              Category
            </label>
            <select
              id="expense-category"
              className="field-input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {EXPENSE_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field-group">
          <label className="field-label" htmlFor="expense-date">
            Date
          </label>
          <input
            id="expense-date"
            className="field-input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        <div className="field-group">
          <label className="field-label" htmlFor="expense-note">
            Note (optional)
          </label>
          <input
            id="expense-note"
            className="field-input"
            type="text"
            placeholder="School snacks, tank refill, etc."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <button className="btn-primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving Expense...' : 'Add Expense'}
        </button>
      </form>
    </section>
  );
}

export default AddExpense;

