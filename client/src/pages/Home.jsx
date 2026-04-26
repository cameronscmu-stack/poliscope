import { useFilter } from '../context/FilterContext';
import { useMembers } from '../hooks/useMembers';
import { FilterBar } from '../components/FilterBar/FilterBar';
import ChamberView from '../components/ChamberView/ChamberView';

const PARTY_DISPLAY = { R: 'republican', D: 'democrat', I: 'independent' };

export function filterMembers(members, { party, stateFilter, gradeFilter, searchQuery }) {
  return members.filter(m => {
    if (party !== 'all' && m.party !== party) return false;
    if (stateFilter !== 'all' && m.state !== stateFilter) return false;
    if (gradeFilter !== 'all' && m.letter_grade !== gradeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const fullName = `${m.first_name} ${m.last_name}`.toLowerCase();
      const partyName = PARTY_DISPLAY[m.party] ?? '';
      if (
        !fullName.includes(q) &&
        !m.state.toLowerCase().includes(q) &&
        !partyName.includes(q)
      ) return false;
    }
    return true;
  });
}

export default function Home() {
  const { chamber, party, stateFilter, gradeFilter, searchQuery } = useFilter();
  const { members, loading, error } = useMembers(chamber);

  const filtered = filterMembers(members, { party, stateFilter, gradeFilter, searchQuery });

  if (loading && members.length === 0) {
    return (
      <div className="min-h-screen">
        <FilterBar />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400 }}>
          <p style={{ opacity: 0.5, fontSize: 14 }}>Loading congressional data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <FilterBar />
      {error && (
        <p className="text-sm px-4 py-2" style={{ color: 'var(--alert)' }}>
          Could not load members: {error}
        </p>
      )}
      <div style={{ padding: '8px 16px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, opacity: 0.45, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--navy)' }}>
          {filtered.length === members.length
            ? `${members.length} members`
            : `${filtered.length} of ${members.length} members`}
        </span>
      </div>
      <ChamberView members={members} filtered={filtered} />
    </div>
  );
}
