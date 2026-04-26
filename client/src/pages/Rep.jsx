import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { PlayerPage } from '../components/PlayerPage/PlayerPage';

export default function Rep() {
  const { id } = useParams();
  const [member, setMember]     = useState(null);
  const [activity, setActivity] = useState(null);
  const [error, setError]       = useState(null);

  useEffect(() => {
    setMember(null);
    setActivity(null);
    setError(null);

    fetch(`/api/members/${id}`)
      .then(res => { if (!res.ok) throw new Error(res.status); return res.json(); })
      .then(setMember)
      .catch(err => setError(err.message));

    // Non-fatal enrichment — loads in parallel with member data
    fetch(`/api/activity/${id}`)
      .then(res => res.ok ? res.json() : null)
      .then(setActivity)
      .catch(() => setActivity(null));
  }, [id]);

  return (
    <div className="min-h-screen">
      {error ? (
        <div className="px-4 pt-4">
          <p style={{ color: 'var(--alert)' }}>Member not found.</p>
        </div>
      ) : (
        <PlayerPage member={member} activity={activity} />
      )}
    </div>
  );
}
