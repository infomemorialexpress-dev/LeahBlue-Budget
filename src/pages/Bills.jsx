import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  createBill,
  deleteBill,
  getBills,
  markBillPaid,
  updateBill,
} from '../services/api.js';
import { formatCurrency, formatOrdinalDay } from '../utils/formatters.js';

const FREQUENCY_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'one-time', label: 'One-time' },
  { value: 'yearly', label: 'Yearly' },
];

const BILL_CATEGORIES = [
  'Housing',
  'Utilities',
  'Internet & Phone',
  'Auto & Insurance',
  'Childcare',
  'Subscriptions',
  'Other',
];

const INITIAL_FORM = {
  name: '',
  amount: '',
  dueDate: '1',
  frequency: 'monthly',
  category: BILL_CATEGORIES[0],
};

function Bills() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  const [bills, setBills] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [editingId, setEditingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyBillId, setBusyBillId] = useState('');
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

  const loadBills = useCallback(
    async (isCancelled) => {
      const checkCancelled = typeof isCancelled === 'function' ? isCancelled : () => false;
      setError('');
      try {
        const data = await getBills();
        if (checkCancelled()) return;
        setBills(Array.isArray(data) ? data : []);
      } catch (err) {
        if (checkCancelled()) return;
        handleAuthOrError(err, 'Unable to load your bills.');
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
    loadBills(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [loadBills, location.key, location.pathname]);

  const sortedBills = useMemo(
    () =>
      [...bills].sort(
        (a, b) => Number(a.dueDate) - Number(b.dueDate) || a.name.localeCompare(b.name),
      ),
    [bills],
  );

  const resetForm = () => {
    setForm(INITIAL_FORM);
    setEditingId('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    const numericAmount = Number(form.amount);
    const numericDueDate = Number(form.dueDate);

    if (!form.name.trim()) {
      setError('Please enter a bill name.');
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Please enter an amount greater than $0.');
      return;
    }
    if (!Number.isInteger(numericDueDate) || numericDueDate < 1 || numericDueDate > 31) {
      setError('Due day must be a whole number between 1 and 31.');
      return;
    }

    const payload = {
      name: form.name.trim(),
      amount: numericAmount,
      dueDate: numericDueDate,
      frequency: form.frequency,
      category: form.category,
    };

    setIsSubmitting(true);
    try {
      if (editingId) {
        await updateBill(editingId, payload);
        setSuccessMessage('Bill updated.');
      } else {
        await createBill(payload);
        setSuccessMessage('Bill added.');
      }
      resetForm();
      await loadBills();
    } catch (err) {
      handleAuthOrError(err, 'Could not save bill.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (bill) => {
    setError('');
    setSuccessMessage('');
    setEditingId(bill._id);
    setForm({
      name: bill.name,
      amount: String(bill.amount),
      dueDate: String(bill.dueDate),
      frequency: bill.frequency,
      category: BILL_CATEGORIES.includes(bill.category) ? bill.category : 'Other',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTogglePaid = async (bill) => {
    setError('');
    setSuccessMessage('');
    setBusyBillId(bill._id);
    try {
      await markBillPaid(bill._id, !bill.isPaid);
      await loadBills();
    } catch (err) {
      handleAuthOrError(err, 'Could not update bill payment status.');
    } finally {
      setBusyBillId('');
    }
  };

  const handleDelete = async (billId) => {
    setError('');
    setSuccessMessage('');
    setBusyBillId(billId);
    try {
      await deleteBill(billId);
      if (editingId === billId) {
        resetForm();
      }
      await loadBills();
    } catch (err) {
      handleAuthOrError(err, 'Could not delete bill.');
    } finally {
      setBusyBillId('');
    }
  };

  const unpaidTotal = sortedBills
    .filter((bill) => !bill.isPaid)
    .reduce((sum, bill) => sum + Number(bill.amount || 0), 0);

  return (
    <section className="dashboard-shell">
      <header className="dashboard-topbar">
        <div>
          <span className="brand-eyebrow">Bill Tracker</span>
          <h1 className="card-title">Monthly Bills &amp; Due Dates</h1>
          <p className="card-subtitle">
            Keep every recurring bill in one calm checklist sorted by due day.
          </p>
        </div>

        <div className="topbar-actions">
          <span className="badge-success">Unpaid Total: {formatCurrency(unpaidTotal)}</span>
        </div>
      </header>

      {error && <div className="alert-error">{error}</div>}
      {successMessage && <div className="alert-success">{successMessage}</div>}

      <div className="dashboard-content-grid">
        <section className="panel-card" aria-labelledby="bill-form-heading">
          <header className="panel-header">
            <h2 id="bill-form-heading" className="panel-title">
              {editingId ? 'Edit bill' : 'Add a new bill'}
            </h2>
            <p className="panel-subtitle">
              {editingId
                ? 'Update the details below and save your changes.'
                : 'Enter the due day (1–31) so we can highlight bills before your next paycheck.'}
            </p>
          </header>

          <form className="form-stack" onSubmit={handleSubmit}>
            <div className="field-group">
              <label className="field-label" htmlFor="bill-name">
                Bill Name
              </label>
              <input
                id="bill-name"
                className="field-input"
                type="text"
                placeholder="e.g., Rent, Electric, Preschool"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>

            <div className="schedule-grid">
              <div className="field-group">
                <label className="field-label" htmlFor="bill-amount">
                  Amount ($)
                </label>
                <input
                  id="bill-amount"
                  className="field-input"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="145.00"
                  value={form.amount}
                  onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                  required
                />
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="bill-due-day">
                  Due Day (1–31)
                </label>
                <input
                  id="bill-due-day"
                  className="field-input"
                  type="number"
                  min="1"
                  max="31"
                  step="1"
                  value={form.dueDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="schedule-grid">
              <div className="field-group">
                <label className="field-label" htmlFor="bill-frequency">
                  Frequency
                </label>
                <select
                  id="bill-frequency"
                  className="field-input"
                  value={form.frequency}
                  onChange={(e) => setForm((prev) => ({ ...prev, frequency: e.target.value }))}
                >
                  {FREQUENCY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="bill-category">
                  Category
                </label>
                <select
                  id="bill-category"
                  className="field-input"
                  value={form.category}
                  onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                >
                  {BILL_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="action-row">
              {editingId && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={resetForm}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
              )}
              <button className="btn-primary" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : editingId ? 'Save Changes' : 'Add Bill'}
              </button>
            </div>
          </form>
        </section>

        <section className="panel-card" aria-labelledby="bills-list-heading">
          <header className="panel-header">
            <h2 id="bills-list-heading" className="panel-title">
              Your Bills ({sortedBills.length})
            </h2>
            <p className="panel-subtitle">Sorted chronologically by day of the month.</p>
          </header>

          {loading ? (
            <div className="empty-state">Loading your bills...</div>
          ) : sortedBills.length === 0 ? (
            <div className="empty-state">
              <strong className="empty-state-title">You have no bills yet</strong>
              <p className="empty-state-desc">
                Fill out the form on this page and click &ldquo;Add Bill&rdquo; to get started.
              </p>
            </div>
          ) : (
            <ul className="transaction-list">
              {sortedBills.map((bill) => {
                const isBusy = busyBillId === bill._id;
                const frequencyLabel =
                  FREQUENCY_OPTIONS.find((opt) => opt.value === bill.frequency)?.label ||
                  bill.frequency;

                return (
                  <li
                    key={bill._id}
                    className={`transaction-item bill-item ${bill.isPaid ? 'is-paid' : ''}`}
                  >
                    <div className="transaction-main">
                      <div className="transaction-title">{bill.name}</div>
                      <div className="transaction-meta">
                        <span className="category-tag">{bill.category}</span>
                        <span>Due {formatOrdinalDay(bill.dueDate)}</span>
                        <span>· {frequencyLabel}</span>
                        {bill.isPaid ? (
                          <span className="badge-success">Paid</span>
                        ) : (
                          <span className="badge-unpaid">Unpaid</span>
                        )}
                      </div>
                    </div>

                    <div className="transaction-right" style={{ flexWrap: 'wrap' }}>
                      <span className="transaction-amount">{formatCurrency(bill.amount)}</span>
                      <div className="bill-actions">
                        <button
                          type="button"
                          className={bill.isPaid ? 'btn-secondary btn-compact' : 'btn-sage'}
                          onClick={() => handleTogglePaid(bill)}
                          disabled={isBusy}
                        >
                          {bill.isPaid ? 'Mark Unpaid' : 'Mark as Paid'}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary btn-compact"
                          onClick={() => handleStartEdit(bill)}
                          disabled={isBusy}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-delete"
                          onClick={() => handleDelete(bill._id)}
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
        </section>
      </div>
    </section>
  );
}

export default Bills;

