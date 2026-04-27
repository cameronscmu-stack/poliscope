import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useFilter } from '../../context/FilterContext';
import { FindMyRep } from '../FindMyRep/FindMyRep';

export function TopNav() {
  const [focusedSearch, setFocusedSearch] = useState(false);
  const [showFindMyRep, setShowFindMyRep] = useState(false);
  const { searchQuery, setSearchQuery } = useFilter();
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === '/';

  return (
    <>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'var(--surface)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--border)',
          boxShadow: '0 2px 12px var(--shadow)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            padding: '12px 16px',
            maxWidth: '1200px',
            margin: '0 auto',
          }}
        >
          <Link
            to="/"
            style={{
              textDecoration: 'none',
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              lineHeight: 1,
            }}
          >
            <span
              style={{
                fontFamily: "'Bricolage Grotesque', sans-serif",
                fontWeight: 800,
                fontSize: '1.625rem',
                letterSpacing: '-0.04em',
                color: 'var(--navy)',
                lineHeight: 1,
              }}
            >
              POLISCOPE
            </span>
            <span
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontStyle: 'italic',
                fontWeight: 300,
                fontSize: '0.6rem',
                letterSpacing: '0.06em',
                color: 'var(--navy)',
                opacity: 0.4,
                marginTop: 2,
              }}
            >
              Follow Congress. Follow the money.
            </span>
          </Link>

          <div style={{ flex: 1 }}>
            {isHome ? (
              <input
                type="search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => setFocusedSearch(true)}
                onBlur={() => setFocusedSearch(false)}
                placeholder="Search members…"
                aria-label="Search members"
                style={{
                  width: '100%',
                  maxWidth: '360px',
                  padding: '7px 12px',
                  borderRadius: '8px',
                  border: focusedSearch ? '1.5px solid var(--accent)' : '1px solid rgba(10,31,110,0.15)',
                  transition: 'border-color 0.15s ease',
                  background: 'rgba(255,255,255,0.6)',
                  color: 'var(--navy)',
                  fontSize: '0.875rem',
                  outline: 'none',
                }}
              />
            ) : (
              <button
                onClick={() => navigate(-1)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--sky-accent)',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  padding: 0,
                }}
              >
                ← Back
              </button>
            )}
          </div>

          <nav style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
            {isHome && (
              <button
                onClick={() => setShowFindMyRep(true)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  border: '1px solid rgba(10,31,110,0.15)',
                  background: 'transparent',
                  color: 'var(--navy)',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  opacity: 0.65,
                  transition: 'opacity 0.15s ease, border-color 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '0.65'; e.currentTarget.style.borderColor = 'rgba(10,31,110,0.15)'; e.currentTarget.style.color = 'var(--navy)'; }}
              >
                📍 Find My Reps
              </button>
            )}
            <NavLink to="/" label="Congress" />
          </nav>
        </div>
      </header>

      {showFindMyRep && <FindMyRep onClose={() => setShowFindMyRep(false)} />}
    </>
  );
}

function NavLink({ to, label }) {
  const location = useLocation();
  const active = location.pathname === to;
  return (
    <Link
      to={to}
      style={{
        fontSize: '0.875rem',
        fontWeight: 600,
        color: active ? 'var(--accent)' : 'var(--navy)',
        textDecoration: 'none',
        borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
        paddingBottom: '2px',
        opacity: active ? 1 : 0.5,
        fontWeight: 700,
        letterSpacing: '0.02em',
        transition: 'opacity 0.15s ease, color 0.15s ease',
      }}
    >
      {label}
    </Link>
  );
}
