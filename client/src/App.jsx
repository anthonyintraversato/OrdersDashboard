import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Orders from './pages/Orders';

const navItems = [
  { to: '/', label: 'Orders' },
  { to: '/pipeline', label: 'Pipeline' },
  { to: '/metrics', label: 'Metrics' },
];

function Placeholder({ title }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <p className="text-earth-500 text-lg">{title} — coming in a future sprint.</p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-earth-100">
        {/* Nav */}
        <nav className="bg-earth-950 border-b border-earth-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14">
              <span className="text-earth-400 font-semibold tracking-wide text-sm uppercase">
                Order Ops
              </span>
              <div className="flex gap-1">
                {navItems.map(({ to, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    className={({ isActive }) =>
                      `px-4 py-2 rounded text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-earth-800 text-earth-100'
                          : 'text-earth-500 hover:text-earth-300 hover:bg-earth-900'
                      }`
                    }
                  >
                    {label}
                  </NavLink>
                ))}
              </div>
            </div>
          </div>
        </nav>

        {/* Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Routes>
            <Route path="/" element={<Orders />} />
            <Route path="/pipeline" element={<Placeholder title="Pipeline" />} />
            <Route path="/metrics" element={<Placeholder title="Metrics" />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
