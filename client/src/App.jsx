// client/src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Rep from './pages/Rep';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/rep/:id" element={<Rep />} />
      </Routes>
    </BrowserRouter>
  );
}
