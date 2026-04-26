import { useFilter } from '../../context/FilterContext';

const STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' }, { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' }, { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' }, { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' }, { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' }, { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' }, { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' }, { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' }, { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' },
  { code: 'DC', name: 'District of Columbia' },
  { code: 'AS', name: 'American Samoa' }, { code: 'GU', name: 'Guam' },
  { code: 'MP', name: 'Northern Mariana Islands' },
  { code: 'PR', name: 'Puerto Rico' }, { code: 'VI', name: 'Virgin Islands' },
];

const PARTY_OPTIONS = [
  { value: 'all', label: 'All', color: null },
  { value: 'R', label: 'Republican', color: 'var(--party-r)' },
  { value: 'D', label: 'Democrat', color: 'var(--party-d)' },
  { value: 'I', label: 'Independent', color: 'var(--party-i)' },
];

const pillBase = {
  padding: '4px 14px',
  borderRadius: '20px',
  fontSize: '0.8125rem',
  cursor: 'pointer',
  border: '1px solid var(--border)',
};

const selectStyle = {
  padding: '4px 8px',
  borderRadius: '20px',
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--navy)',
  fontSize: '0.8125rem',
  cursor: 'pointer',
  outline: 'none',
};

export function FilterBar() {
  const {
    chamber, setChamber,
    party, setParty,
    stateFilter, setStateFilter,
    gradeFilter, setGradeFilter,
  } = useFilter();

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.7)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
        padding: '8px 16px',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
        }}
      >
        {/* Chamber toggle */}
        {['senate', 'house'].map(c => (
          <button
            key={c}
            type="button"
            onClick={() => setChamber(c)}
            style={{
              ...pillBase,
              fontWeight: 700,
              backgroundColor: chamber === c ? 'var(--navy)' : 'var(--surface)',
              color: chamber === c ? 'white' : 'var(--navy)',
            }}
          >
            {c === 'senate' ? 'Senate' : 'House'}
          </button>
        ))}

        {/* Divider */}
        <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 4px' }} aria-hidden="true" />

        {/* Party filter */}
        {PARTY_OPTIONS.map(opt => {
          const active = party === opt.value;
          const activeColor = opt.color ?? 'var(--navy)';
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setParty(opt.value)}
              style={{
                ...pillBase,
                backgroundColor: active ? activeColor : 'var(--surface)',
                color: active ? 'white' : 'var(--navy)',
                border: active ? `1px solid ${opt.color ?? 'var(--navy)'}` : '1px solid var(--border)',
              }}
            >
              {opt.label}
            </button>
          );
        })}

        {/* State + Grade dropdowns */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <select
            value={stateFilter}
            onChange={e => setStateFilter(e.target.value)}
            aria-label="Filter by state"
            style={selectStyle}
          >
            <option value="all">All states</option>
            {STATES.map(s => (
              <option key={s.code} value={s.code}>{s.name}</option>
            ))}
          </select>

          <select
            value={gradeFilter}
            onChange={e => setGradeFilter(e.target.value)}
            aria-label="Filter by grade"
            style={selectStyle}
          >
            <option value="all">All grades</option>
            {['A', 'B', 'C', 'D', 'F'].map(g => (
              <option key={g} value={g}>Grade {g}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
