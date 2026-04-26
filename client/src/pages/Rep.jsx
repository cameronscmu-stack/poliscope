import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PlayerPage } from '../components/PlayerPage/PlayerPage';

export default function Rep() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [member, setMember] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`/api/members/${id}`)
      .then(res => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      })
      .then(setMember)
      .catch(err => setError(err.message));
  }, [id]);

  return (
    <div className="min-h-screen">
      <div className="px-4 pt-4">
        <button
          onClick={() => navigate(-1)}
          className="text-sm font-bold mb-2 flex items-center gap-1"
          style={{ color: 'var(--sky-accent)' }}
        >
          ← Back to Chamber
        </button>
      </div>

      {error ? (
        <div className="px-4">
          <p style={{ color: 'var(--alert)' }}>Member not found.</p>
        </div>
      ) : (
        <PlayerPage member={member} />
      )}
    </div>
  );
}
