import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const NAV_ITEMS = [
  { label: 'Home', to: '/dashboard' },
  { label: 'Budget', to: '/budget' },
  { label: 'Bills', to: '/bills' },
  { label: 'Goals', to: '/goals' },
];

function Navbar() {
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  return (
    <header className="site-navbar">
      <div className="navbar-inner">
        <Link className="navbar-brand" to={isAuthenticated ? '/dashboard' : '/'}>
          <span className="navbar-dot" aria-hidden="true" />
          <span className="navbar-brand-group">
            <span className="navbar-brand-name">MoneyFlow 360</span>
            <span className="navbar-brand-signature">By Leah Blue</span>
          </span>
        </Link>

        {isAuthenticated && (
          <>
            <nav className="navbar-links" aria-label="Main navigation">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="navbar-actions">
              <button
                type="button"
                className="btn-secondary nav-action-btn"
                onClick={handleLogout}
              >
                Sign Out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}

export default Navbar;

