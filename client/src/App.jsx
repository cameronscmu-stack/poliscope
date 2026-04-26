// client/src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { FilterProvider } from './context/FilterContext';
import { TopNav } from './components/TopNav/TopNav';
import Home from './pages/Home';
import Rep from './pages/Rep';

export default function App() {
  return (
    <BrowserRouter>
      <FilterProvider>
        <TopNav />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/rep/:id" element={<Rep />} />
        </Routes>
      </FilterProvider>
    </BrowserRouter>
  );
}
