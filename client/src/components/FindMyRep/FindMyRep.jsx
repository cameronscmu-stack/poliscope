import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFilter } from '../../context/FilterContext';

const PARTY_COLOR = { D: '#1a4aaa', R: '#cc0000', I: '#666' };
const PARTY_LABEL = { D: 'Democrat', R: 'Republican', I: 'Independent' };

export function FindMyRep({ onClose }) {
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { setStateFilter, setChamber, setHighlightedIds } = useFilter();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!address.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/find-rep?address=${encodeURIComponent(address)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Lookup failed');
      setResult(data);

      // Highlight the found members in the chamber view
      const ids = new Set([
        ...data.senators.map(s => s.id),
        ...(data.representative ? [data.representative.id] : []),
      ]);
      setHighlightedIds(ids);
      setStateFilter(data.state);
      setChamber('senate');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleViewInChamber() {
    onClose();
  }

  function handleMemberClick(id) {
    onClose();
    navigate(`/rep/${id}`);
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 80,
        background: 'rgba(10,20,40,0.65)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: '28px 28px 24px',
          width: '100%',
          maxWidth: 480,
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy)', margin: 0 }}>
              Find My Representatives
            </h2>
            <p style={{ fontSize: 12, opacity: 0.5, margin: '4px 0 0', color: 'var(--navy)' }}>
              Enter your address to find your senators and house rep
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, opacity: 0.4, color: 'var(--navy)', lineHeight: 1 }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Search form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <input
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="e.g. 123 Main St, Springfield, IL 62701"
            autoFocus
            style={{
              flex: 1,
              padding: '9px 12px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'rgba(255,255,255,0.7)',
              color: 'var(--navy)',
              fontSize: 13,
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={loading || !address.trim()}
            style={{
              padding: '9px 16px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--navy)',
              color: '#fff',
              fontWeight: 700,
              fontSize: 13,
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading || !address.trim() ? 0.5 : 1,
            }}
          >
            {loading ? '…' : 'Look up'}
          </button>
        </form>

        {/* Error */}
        {error && (
          <p style={{ fontSize: 13, color: '#cc2222', marginBottom: 16 }}>{error}</p>
        )}

        {/* Results */}
        {result && (
          <div>
            <p style={{ fontSize: 11, opacity: 0.45, marginBottom: 14, color: 'var(--navy)', letterSpacing: 1, textTransform: 'uppercase' }}>
              Results for {result.state}{result.district ? ` · District ${result.district}` : ''} — {result.matchedAddress}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {result.senators.map(s => (
                <MemberRow key={s.id} member={s} label="U.S. Senator" onClick={() => handleMemberClick(s.id)} />
              ))}
              {result.representative && (
                <MemberRow member={result.representative} label={`House Rep · District ${result.district}`} onClick={() => handleMemberClick(result.representative.id)} />
              )}
              {!result.representative && result.district !== null && (
                <p style={{ fontSize: 12, opacity: 0.45, color: 'var(--navy)' }}>House rep for District {result.district} not found in database.</p>
              )}
            </div>

            <button
              onClick={handleViewInChamber}
              style={{
                marginTop: 18,
                width: '100%',
                padding: '10px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--navy)',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Highlight in chamber view →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function MemberRow({ member, label, onClick }) {
  const color = PARTY_COLOR[member.party] ?? '#666';
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        borderRadius: 10,
        border: '1px solid var(--border)',
        background: 'rgba(255,255,255,0.5)',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
      }}
    >
      <img
        src={member.photo_url}
        alt=""
        style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${color}`, flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {member.first_name} {member.last_name}
        </div>
        <div style={{ fontSize: 11, opacity: 0.55, color: 'var(--navy)', marginTop: 1 }}>
          {label} · {PARTY_LABEL[member.party] ?? member.party}
        </div>
      </div>
      <span style={{ fontSize: 12, opacity: 0.35, color: 'var(--navy)' }}>→</span>
    </button>
  );
}
