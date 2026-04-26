import { useState, useEffect, useCallback } from 'react';
import { PlayerPage } from '../PlayerPage/PlayerPage';

export function SenatorModal({ memberId, onClose }) {
  const [member, setMember]     = useState(null);
  const [activity, setActivity] = useState(null);
  const [error, setError]       = useState(null);

  useEffect(() => {
    setMember(null);
    setActivity(null);
    setError(null);

    fetch(`/api/members/${memberId}`)
      .then(res => { if (!res.ok) throw new Error(res.status); return res.json(); })
      .then(setMember)
      .catch(err => setError(err.message));

    fetch(`/api/activity/${memberId}`)
      .then(res => res.ok ? res.json() : null)
      .then(setActivity)
      .catch(() => setActivity(null));
  }, [memberId]);

  const handleBackdrop = useCallback(e => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      onClick={handleBackdrop}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        background: 'rgba(10,20,40,0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        overflowY: 'auto',
        padding: '40px 16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 560,
          background: 'var(--surface)',
          borderRadius: 16,
          border: '1px solid var(--border)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            zIndex: 10,
            background: 'rgba(0,0,0,0.08)',
            border: 'none',
            borderRadius: '50%',
            width: 32,
            height: 32,
            cursor: 'pointer',
            fontSize: 18,
            color: 'var(--navy)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
          }}
        >
          ×
        </button>

        {error ? (
          <div style={{ padding: 32 }}>
            <p style={{ color: 'var(--alert)', fontSize: 14 }}>Could not load member profile.</p>
          </div>
        ) : (
          <PlayerPage member={member} activity={activity} />
        )}
      </div>
    </div>
  );
}
