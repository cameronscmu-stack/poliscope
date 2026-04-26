// client/src/pages/Home.jsx
import { useNavigate } from 'react-router-dom';
import { ChamberGrid } from '../components/ChamberGrid/ChamberGrid';
import { FilterBar } from '../components/FilterBar/FilterBar';
import { useFilter } from '../context/FilterContext';
import { useMembers } from '../hooks/useMembers';

const PARTY_DISPLAY = { R: 'republican', D: 'democrat', I: 'independent' };

function filterMembers(members, { party, stateFilter, gradeFilter, searchQuery }) {
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
  const navigate = useNavigate();
  const { chamber, party, stateFilter, gradeFilter, searchQuery } = useFilter();
  const { members, loading, error } = useMembers(chamber);

  const visible = filterMembers(members, { party, stateFilter, gradeFilter, searchQuery });

  return (
    <div className="min-h-screen">
      <FilterBar />
      {error && (
        <p className="text-sm px-4 py-2" style={{ color: 'var(--alert)' }}>
          Could not load members: {error}
        </p>
      )}
      <div className="px-4 py-6">
        <ChamberGrid
          members={visible}
          loading={loading}
          onSelectMember={id => navigate(`/rep/${id}`)}
        />
      </div>
    </div>
  );
}
