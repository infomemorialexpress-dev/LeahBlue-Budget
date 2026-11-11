import { useEffect, useState } from 'react';
import { getWeeklyCheckIn } from '../services/api.js';
import { formatCurrency, formatOrdinalDay, formatUtcDate } from '../utils/formatters.js';

function WeeklyCheckInModal({ isOpen, onClose, onUnauthorized }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return undefined;

    let active = true;
    setLoading(true);
    setError('');

    getWeeklyCheckIn()
      .then((result) => {
        if (active) {
          setData(result);
        }
      })
      .catch((err) => {
        if (!active) return;
        if (err.status === 401 && typeof onUnauthorized === 'function') {
          onUnauthorized();
          return;
        }
        setError(err.message || 'Could not load your weekly check-in.');
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      active = false;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, onUnauthorized]);

  if (!isOpen) return null;

  const savings = data?.savingsProgress || {
    totalSaved: 0,
    totalTarget: 0,
    percentage: 0,
    goalsCount: 0,
  };
  const bills = Array.isArray(data?.billsDueNext7Days) ? data.billsDueNext7Days : [];
  const remainingBudget = Number(data?.remainingBudget || 0);

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="weekly-checkin-title"
      >
        <header className="modal-header">
          <div>
            <span className="brand-eyebrow">Weekly Check-In</span>
            <h2 id="weekly-checkin-title" className="card-title">
              Your Calm Week at a Glance
            </h2>
            {data?.weekStart && data?.weekEnd && (
              <p className="card-subtitle">
                {formatUtcDate(data.weekStart)} – {formatUtcDate(data.weekEnd)}
              </p>
            )}
          </div>

          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close weekly check-in"
          >
            Close
          </button>
        </header>

        {error && <div className="alert-error">{error}</div>}

        {loading ? (
          <div className="empty-state">Gathering this week&apos;s numbers...</div>
        ) : data ? (
          <>
            <div className="checkin-grid">
              <div className="mini-stat-box">
                <span className="mini-stat-label">Income received this week</span>
                <strong className="mini-stat-value">
                  {formatCurrency(data.incomeReceivedThisWeek)}
                </strong>
              </div>

              <div className="mini-stat-box">
                <span className="mini-stat-label">Spending to date (this week)</span>
                <strong className="mini-stat-value">
                  {formatCurrency(data.spendingThisWeek)}
                </strong>
              </div>

              <div className="mini-stat-box">
                <span className="mini-stat-label">Remaining monthly budget</span>
                <strong
                  className={`mini-stat-value ${remainingBudget >= 0 ? 'is-positive' : 'is-negative'}`}
                >
                  {formatCurrency(remainingBudget)}
                </strong>
              </div>
            </div>

            <div className="checkin-section">
              <div className="category-row">
                <h3 className="panel-title" style={{ fontSize: '1.05rem', marginBottom: 0 }}>
                  Bills due soon (next 7 days)
                </h3>
                <span className="category-amount">
                  {formatCurrency(data.billsDueNext7DaysTotal)}
                </span>
              </div>

              {bills.length === 0 ? (
                <p className="panel-subtitle">
                  No unpaid bills due in the next 7 days. Enjoy the breathing room!
                </p>
              ) : (
                <ul className="checkin-bills-list">
                  {bills.map((bill) => (
                    <li key={bill._id} className="checkin-bill-row">
                      <span>
                        <strong>{bill.name}</strong> · Due {formatOrdinalDay(bill.dueDate)} (
                        {formatUtcDate(bill.nextDueDate)})
                      </span>
                      <strong>{formatCurrency(bill.amount)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="checkin-section">
              <div className="category-row">
                <h3 className="panel-title" style={{ fontSize: '1.05rem', marginBottom: 0 }}>
                  Savings progress
                </h3>
                <span className="goal-percent-pill">
                  {Math.round(Number(savings.percentage || 0))}%
                </span>
              </div>

              {savings.goalsCount === 0 ? (
                <p className="panel-subtitle">
                  No savings goals yet. Visit Goals whenever you&apos;re ready to start one.
                </p>
              ) : (
                <>
                  <div className="progress-track" aria-hidden="true">
                    <div
                      className={`progress-fill ${savings.percentage >= 100 ? 'is-complete' : ''}`}
                      style={{ width: `${Math.min(100, Number(savings.percentage || 0))}%` }}
                    />
                  </div>
                  <p className="panel-subtitle">
                    <strong>{formatCurrency(savings.totalSaved)}</strong> saved of{' '}
                    <strong>{formatCurrency(savings.totalTarget)}</strong> across{' '}
                    {savings.goalsCount} {savings.goalsCount === 1 ? 'goal' : 'goals'}.
                  </p>
                </>
              )}
            </div>
          </>
        ) : null}

        <button type="button" className="btn-primary" onClick={onClose}>
          Done for this week
        </button>
      </div>
    </div>
  );
}

export default WeeklyCheckInModal;

