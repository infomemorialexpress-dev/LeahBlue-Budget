import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { resetPassword } from '../services/api.js';

function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!token) {
      setError('Password reset token is missing from the link.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify and try again.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await resetPassword(token, password);
      setSuccessMessage(
        response.message || 'Password reset successfully. You can now log in with your new password.',
      );
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 3000);
    } catch (err) {
      setError(
        err.message || 'Unable to reset password. The link may have expired or is invalid.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="auth-container">
      <div className="card">
        <header className="card-header">
          <span className="brand-eyebrow">MoneyFlow 360</span>
          <h1 className="card-title">Choose New Password</h1>
          <p className="card-subtitle">
            Enter your new secure password below to regain access to your account.
          </p>
        </header>

        {error && (
          <div className="alert-error" style={{ marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        {successMessage ? (
          <div className="form-stack">
            <div className="alert-success" style={{ marginBottom: '1rem' }}>
              {successMessage}
            </div>
            <p className="field-help" style={{ textAlign: 'center', marginBottom: '1rem' }}>
              Redirecting you to the sign-in page in a few seconds...
            </p>
            <Link to="/" className="btn-primary" style={{ textAlign: 'center', textDecoration: 'none' }}>
              Proceed to Sign In
            </Link>
          </div>
        ) : (
          <form className="form-stack" onSubmit={handleSubmit}>
            <div className="field-group">
              <label className="field-label" htmlFor="reset-new-password">
                New Password
              </label>
              <input
                id="reset-new-password"
                className="field-input"
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="reset-confirm-password">
                Confirm New Password
              </label>
              <input
                id="reset-confirm-password"
                className="field-input"
                type="password"
                placeholder="Repeat new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>

            <button className="btn-primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Updating Password...' : 'Save New Password'}
            </button>
          </form>
        )}

        <footer className="card-footer" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          Remember your credentials? <Link to="/">Log in here</Link>
        </footer>
      </div>
    </section>
  );
}

export default ResetPassword;
