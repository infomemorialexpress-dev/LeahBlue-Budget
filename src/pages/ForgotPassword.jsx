import { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../services/api.js';

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      const response = await forgotPassword(email);
      setSuccessMessage(
        response.message || 'If an account exists, a reset link has been sent to your email.',
      );
    } catch (err) {
      setError(err.message || 'Unable to process your request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="auth-container">
      <div className="card">
        <header className="card-header">
          <span className="brand-eyebrow">MoneyFlow 360</span>
          <h1 className="card-title">Reset Password</h1>
          <p className="card-subtitle">
            Enter your account email and we will send you a secure password reset link.
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
              Please check your inbox and spam/junk folder. The reset link is valid for 1 hour.
            </p>
            <Link to="/" className="btn-secondary" style={{ textAlign: 'center', textDecoration: 'none' }}>
              Return to Sign In
            </Link>
          </div>
        ) : (
          <form className="form-stack" onSubmit={handleSubmit}>
            <div className="field-group">
              <label className="field-label" htmlFor="forgot-email">
                Account Email
              </label>
              <input
                id="forgot-email"
                className="field-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <button className="btn-primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Sending Link...' : 'Send Reset Link'}
            </button>
          </form>
        )}

        <footer className="card-footer" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          Remember your password? <Link to="/">Log in here</Link>
        </footer>
      </div>
    </section>
  );
}

export default ForgotPassword;
