import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChamberGrid } from '../components/ChamberGrid/ChamberGrid';
import { useMembers } from '../hooks/useMembers';

export default function Home() {
  const [chamber, setChamber] = useState('senate');
  const navigate = useNavigate();
  const { members, loading, error } = useMembers(chamber);

  return (
    <div className="min-h-screen px-4 py-6">
      {/* Masthead */}
      <header
        className="rounded-2xl p-5 mb-6 text-white"
        style={{ background: 'linear-gradient(135deg, #cc0000, #0a1f6e)' }}
      >
        <h1 className="text-3xl font-bold tracking-tight">POLISCOPE</h1>
        <p className="text-sm opacity-75 mt-1">
          Radical transparency for American democracy.
        </p>
      </header>

      {/* Chamber toggle */}
      <div className="flex gap-2 mb-6">
        {['senate', 'house'].map(c => (
          <button
            key={c}
            onClick={() => setChamber(c)}
            className="px-5 py-2 rounded-full text-sm font-bold transition-all"
            style={{
              backgroundColor: chamber === c ? 'var(--navy)' : 'var(--surface)',
              color: chamber === c ? 'white' : 'var(--navy)',
              border: '1px solid var(--border)',
            }}
          >
            {c === 'senate' ? 'Senate' : 'House'}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-sm mb-4" style={{ color: 'var(--alert)' }}>
          Could not load members: {error}
        </p>
      )}

      <ChamberGrid
        members={members}
        loading={loading}
        onSelectMember={(id) => navigate(`/rep/${id}`)}
      />
    </div>
  );
}
