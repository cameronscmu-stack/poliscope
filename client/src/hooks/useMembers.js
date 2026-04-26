// client/src/hooks/useMembers.js
import { useState, useEffect } from 'react';

const POLL_INTERVAL_MS = 60_000;

export function useMembers(chamber) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchMembers() {
      try {
        const url = chamber
          ? `/api/members?chamber=${chamber}`
          : '/api/members';
        const res = await fetch(url);
        if (!res.ok) throw new Error(`API error ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setMembers(data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      }
    }

    fetchMembers();
    const timer = setInterval(fetchMembers, POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [chamber]);

  return { members, loading, error };
}
