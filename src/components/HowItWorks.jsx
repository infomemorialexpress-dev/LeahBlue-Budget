import { useState } from 'react';

const STEPS = [
  {
    step: 'Step 1',
    title: 'Add Your Income',
    desc: '(Enter your paycheck amount and how often you get paid...)',
  },
  {
    step: 'Step 2',
    title: 'Add Your Bills & Expenses',
    desc: '(Enter your recurring bills, subscriptions, and everyday expenses...)',
  },
  {
    step: 'Step 3',
    title: 'Plan Your Paycheck',
    desc: '(See suggested allocations for upcoming bills, groceries, gas, savings...)',
  },
  {
    step: 'Step 4',
    title: "Know What's Safe to Spend",
    desc: '(See how much money you have available until your next payday...)',
  },
  {
    step: 'Step 5',
    title: 'Track Your Progress',
    desc: '(Monitor spending, stay on top of upcoming payments...)',
  },
];

function HowItWorks({ defaultOpen = true }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <aside className="how-it-works-card" aria-label="How MoneyFlow 360 Works">
      <header className="how-it-works-header">
        <div className="how-it-works-title-group">
          <span className="brand-eyebrow">How It Works</span>
          <h2 className="how-it-works-title">Welcome to MoneyFlow 360</h2>
        </div>
        <button
          type="button"
          className="how-it-works-toggle-btn"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          aria-controls="how-it-works-body"
        >
          {isOpen ? 'Collapse Guide ▲' : 'How It Works ▼'}
        </button>
      </header>

      {isOpen && (
        <div id="how-it-works-body" className="how-it-works-body">
          <p className="how-it-works-subtitle">
            Budgeting made simple for busy moms. Know where your money goes, stay ahead of your
            bills, and feel more confident about every paycheck.
          </p>

          <ol className="how-it-works-steps">
            {STEPS.map((item) => (
              <li key={item.step} className="how-it-works-step">
                <span className="how-it-works-step-badge">{item.step}</span>
                <div className="how-it-works-step-content">
                  <strong className="how-it-works-step-title">{item.title}</strong>{' '}
                  <span className="how-it-works-step-desc">{item.desc}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </aside>
  );
}

export default HowItWorks;
