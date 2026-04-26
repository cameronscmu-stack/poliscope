import { createContext, useContext, useState } from 'react';

const FilterContext = createContext(null);

export function FilterProvider({ children }) {
  const [chamber, setChamber] = useState('senate');
  const [party, setParty] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIds, setHighlightedIds] = useState(new Set());
  // Global modal — any component can open a senator profile
  const [selectedMemberId, setSelectedMemberId] = useState(null);

  return (
    <FilterContext.Provider value={{
      chamber, setChamber,
      party, setParty,
      stateFilter, setStateFilter,
      gradeFilter, setGradeFilter,
      searchQuery, setSearchQuery,
      highlightedIds, setHighlightedIds,
      selectedMemberId, setSelectedMemberId,
    }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilter() {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error('useFilter must be used within FilterProvider');
  return ctx;
}
