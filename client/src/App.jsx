import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { FilterProvider } from './context/FilterContext';
import { useFilter } from './context/FilterContext';
import { TopNav } from './components/TopNav/TopNav';
import { SenatorModal } from './components/SenatorModal/SenatorModal';
import Home from './pages/Home';

function AppInner() {
  const { selectedMemberId, setSelectedMemberId } = useFilter();
  return (
    <>
      <TopNav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="*" element={<Home />} />
      </Routes>
      {selectedMemberId && (
        <SenatorModal
          memberId={selectedMemberId}
          onClose={() => setSelectedMemberId(null)}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <FilterProvider>
        <AppInner />
      </FilterProvider>
    </BrowserRouter>
  );
}
