import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Unable to sign in. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="auth-container">
      <div className="card">
        <header className="card-header">
          <span className="brand-eyebrow">LeahBlue Budget</span>
          <h1 className="card-title">Welcome back</h1>
          <p className="card-subtitle">Sign in to access your budget workspace.</p>
        </header>

        {error && (
          <div className="alert-error" style={{ marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        <form className="form-stack" onSubmit={handleSubmit}>
          <div className="field-group">
            <label className="field-label" htmlFor="login-email">
              Email
            </label>
            <input
              id="login-email"
              className="field-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
              className="field-input"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button className="btn-primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing In...' : 'Log In'}
          </button>
        </form>

        <footer className="card-footer">
          Need an account? <Link to="/register">Register with your access key</Link>
        </footer>
      </div>
    </section>
  );
}

export default Login;
