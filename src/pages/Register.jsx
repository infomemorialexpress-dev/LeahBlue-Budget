import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accessKey, setAccessKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isAccessKeyError, setIsAccessKeyError] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsAccessKeyError(false);
    setIsSubmitting(true);

    try {
      await register(email, password, accessKey);
      navigate('/onboarding');
    } catch (err) {
      setIsAccessKeyError(err.status === 403);
      setError(err.message || 'Unable to register. Please verify your access key.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="auth-container">
      <div className="card">
        <header className="card-header">
          <span className="brand-eyebrow">MoneyFlow 360</span>
          <h1 className="card-title">Create your account</h1>
          <p className="card-headline">Every paycheck. Every bill. One clear picture.</p>
          <p className="card-subtitle">
            Enter your Stan Store Access Key to unlock your budget planner.
          </p>
        </header>

        {error && (
          <div className="alert-error" style={{ marginBottom: '1rem' }}>
            <div>{error}</div>
            {isAccessKeyError && (
              <a className="alert-link" href="#">
                Purchase access on Stan Store
              </a>
            )}
          </div>
        )}

        <form className="form-stack" onSubmit={handleSubmit}>
          <div className="field-group">
            <label className="field-label" htmlFor="register-email">
              Email
            </label>
            <input
              id="register-email"
              className="field-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="register-password">
              Password
            </label>
            <input
              id="register-password"
              className="field-input"
              type="password"
              placeholder="Create a password (min 6 characters)"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="register-access-key">
              Stan Store Access Key
            </label>
            <input
              id="register-access-key"
              className="field-input"
              type="text"
              placeholder="Enter your Stan Store Access Key"
              value={accessKey}
              onChange={(e) => setAccessKey(e.target.value)}
              required
            />
          </div>

          <button className="btn-primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <footer className="card-footer">
          Already have an account? <Link to="/">Back to Login</Link>
        </footer>
      </div>
    </section>
  );
}

export default Register;
