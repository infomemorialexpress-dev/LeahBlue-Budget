import { Link, NavLink, useNavigate } from 'react-router-dom';
import logoImg from '../assets/Money Flow 360 Logo.png';
import { useAuth } from '../context/AuthContext.jsx';

const NAV_ITEMS = [
  { label: 'Home', to: '/dashboard' },
  { label: 'Plan Paycheck', to: '/plan-paycheck' },
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
          <img
            src={logoImg}
            alt="MoneyFlow 360 By Leah Blue"
            className="navbar-brand-img"
          />
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

