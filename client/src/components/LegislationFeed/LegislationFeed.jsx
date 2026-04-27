import { useState, useEffect } from 'react';

const STAGES = ['all', 'committee', 'reported', 'floor', 'passed', 'signed'];

const STAGE_LABEL = {
  all: 'All',
  introduced: 'Introduced',
  committee: 'Committee',
  reported: 'Reported',
  floor: 'Floor',
  passed: 'Passed',
  signed: 'Signed',
  vetoed: 'Vetoed',
};

const STAGE_COLOR = {
  introduced: { bg: 'rgba(100,120,160,0.12)', text: 'var(--navy)', border: 'rgba(100,120,160,0.25)' },
  committee:  { bg: 'rgba(180,120,20,0.12)',  text: '#7a5200',      border: 'rgba(180,120,20,0.3)' },
  reported:   { bg: 'rgba(60,100,200,0.12)',  text: '#1a3a8a',      border: 'rgba(60,100,200,0.25)' },
  floor:      { bg: 'rgba(150,50,200,0.12)',  text: '#5a0a8a',      border: 'rgba(150,50,200,0.25)' },
  passed:     { bg: 'rgba(20,140,80,0.12)',   text: '#0a5a30',      border: 'rgba(20,140,80,0.25)' },
  signed:     { bg: 'rgba(230,93,4,0.12)',    text: '#a33600',      border: 'rgba(230,93,4,0.3)' },
  vetoed:     { bg: 'rgba(200,20,20,0.12)',   text: '#8a0a0a',      border: 'rgba(200,20,20,0.25)' },
};

const PARTY_COLOR = { R: 'var(--party-r)', D: 'var(--party-d)', I: 'var(--party-i)' };

function StagePill({ stage }) {
  const c = STAGE_COLOR[stage] ?? STAGE_COLOR.introduced;
  return (
    <span style={{
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      padding: '2px 8px',
      borderRadius: 20,
      background: c.bg,
      color: c.text,
      border: `1px solid ${c.border}`,
      whiteSpace: 'nowrap',
    }}>
      {STAGE_LABEL[stage] ?? stage}
    </span>
  );
}

function BillCard({ bill }) {
  const sponsor = bill.sponsors?.[0];
  const actionDate = bill.latest_action_date
    ? new Date(bill.latest_action_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      transition: 'box-shadow 0.18s ease, transform 0.18s ease',
      cursor: 'default',
    }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,30,80,0.1)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.transform = 'none';
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.05em',
          color: 'rgba(10,30,80,0.45)',
          textTransform: 'uppercase',
          fontFamily: 'monospace',
        }}>
          {bill.bill_type}.{bill.bill_number}
        </span>
        <StagePill stage={bill.action_stage} />
        {bill.policy_area && (
          <span style={{
            fontSize: 11,
            color: 'rgba(10,30,80,0.45)',
            background: 'rgba(10,30,80,0.05)',
            border: '1px solid rgba(10,30,80,0.1)',
            borderRadius: 20,
            padding: '2px 8px',
          }}>
            {bill.policy_area}
          </span>
        )}
        {actionDate && (
          <span style={{ fontSize: 11, color: 'rgba(10,30,80,0.4)', marginLeft: 'auto' }}>
            {actionDate}
          </span>
        )}
      </div>

      {/* Title */}
      <p style={{
        margin: 0,
        fontSize: '0.9rem',
        fontWeight: 600,
        color: 'var(--navy)',
        lineHeight: 1.4,
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {bill.title}
      </p>

      {/* Summary */}
      {bill.summary && (
        <p style={{
          margin: 0,
          fontSize: '0.8125rem',
          color: 'rgba(10,30,80,0.6)',
          lineHeight: 1.5,
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {bill.summary}
        </p>
      )}

      {/* Footer: latest action + sponsor */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 2 }}>
        {bill.latest_action_text && (
          <p style={{
            margin: 0,
            fontSize: '0.75rem',
            color: 'rgba(10,30,80,0.45)',
            lineHeight: 1.4,
            flex: 1,
            display: '-webkit-box',
            WebkitLineClamp: 1,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {bill.latest_action_text}
          </p>
        )}
        {sponsor && (
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            color: PARTY_COLOR[sponsor.party] ?? 'var(--navy)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}>
            {sponsor.name?.split(' ').slice(-1)[0]} ({sponsor.party}-{sponsor.state})
          </span>
        )}
      </div>
    </div>
  );
}

export function LegislationFeed() {
  const [bills, setBills] = useState([]);
  const [areas, setAreas] = useState([]);
  const [stage, setStage] = useState('all');
  const [chamber, setChamber] = useState('all');
  const [area, setArea] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const LIMIT = 20;

  useEffect(() => {
    setOffset(0);
    setBills([]);
    setHasMore(true);
  }, [stage, chamber, area]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ stage, chamber, area, limit: LIMIT, offset });
    fetch(`/api/legislation?${params}`)
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(data => {
        setBills(prev => offset === 0 ? data.bills : [...prev, ...data.bills]);
        if (offset === 0) setAreas(data.areas ?? []);
        setHasMore(data.bills.length === LIMIT);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [stage, chamber, area, offset]);

  const pillBase = {
    padding: '4px 14px',
    borderRadius: 20,
    fontSize: '0.8125rem',
    cursor: 'pointer',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--navy)',
    fontWeight: 500,
  };

  return (
    <section style={{ padding: '0 16px 48px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
        <h2 style={{
          margin: 0,
          fontSize: '1rem',
          fontWeight: 800,
          letterSpacing: '-0.01em',
          color: 'var(--navy)',
          textTransform: 'uppercase',
        }}>
          Bills in Congress
        </h2>
        <span style={{ fontSize: 12, opacity: 0.4, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>
          119th Congress
        </span>
      </div>

      {/* Filter row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {/* Stage tabs */}
        {STAGES.map(s => (
          <button
            key={s}
            type="button"
            onClick={() => setStage(s)}
            style={{
              ...pillBase,
              fontWeight: stage === s ? 700 : 500,
              background: stage === s ? 'var(--navy)' : 'var(--surface)',
              color: stage === s ? '#fff' : 'var(--navy)',
            }}
          >
            {STAGE_LABEL[s] ?? s}
          </button>
        ))}

        <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />

        {/* Chamber */}
        {['all', 'house', 'senate'].map(c => (
          <button
            key={c}
            type="button"
            onClick={() => setChamber(c)}
            style={{
              ...pillBase,
              fontWeight: chamber === c ? 700 : 500,
              background: chamber === c ? 'rgba(10,30,80,0.08)' : 'var(--surface)',
              color: 'var(--navy)',
              border: chamber === c ? '1px solid rgba(10,30,80,0.2)' : '1px solid var(--border)',
            }}
          >
            {c === 'all' ? 'Both' : c.charAt(0).toUpperCase() + c.slice(1)}
          </button>
        ))}

        {/* Policy area dropdown */}
        {areas.length > 0 && (
          <select
            value={area}
            onChange={e => setArea(e.target.value)}
            style={{
              padding: '4px 8px',
              borderRadius: 20,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--navy)',
              fontSize: '0.8125rem',
              cursor: 'pointer',
              outline: 'none',
              marginLeft: 'auto',
            }}
          >
            <option value="all">All topics</option>
            {areas.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
      </div>

      {/* Bill grid */}
      {error ? (
        <p style={{ color: 'var(--alert)', fontSize: 14 }}>Could not load legislation.</p>
      ) : (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: 12,
          }}>
            {bills.map(bill => <BillCard key={bill.id} bill={bill} />)}
          </div>

          {loading && (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <p style={{ opacity: 0.4, fontSize: 13 }}>Loading bills...</p>
            </div>
          )}

          {!loading && bills.length === 0 && (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <p style={{ opacity: 0.4, fontSize: 14 }}>No bills found for these filters.</p>
            </div>
          )}

          {!loading && hasMore && bills.length > 0 && (
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <button
                type="button"
                onClick={() => setOffset(o => o + LIMIT)}
                style={{
                  padding: '10px 28px',
                  borderRadius: 24,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--navy)',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  letterSpacing: '0.02em',
                }}
              >
                Load more
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
