import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { PlayerPage } from './PlayerPage';

const member = {
  id: 'A000360',
  first_name: 'Lamar',
  last_name: 'Alexander',
  party: 'R',
  state: 'TN',
  chamber: 'senate',
  photo_url: 'https://theunitedstates.io/images/congress/225x275/A000360.jpg',
  website: 'https://alexander.senate.gov',
  letter_grade: 'B',
  composite_score: 82,
  attendance_score: 91,
  party_independence_score: 73,
  data_sufficient: true,
  grade_calculated_at: '2026-04-25T00:00:00Z',
};

function renderPage(props) {
  return render(
    <MemoryRouter>
      <PlayerPage {...props} />
    </MemoryRouter>
  );
}

describe('PlayerPage', () => {
  it('renders member full name', () => {
    renderPage({ member });
    expect(screen.getByText('Lamar Alexander')).toBeInTheDocument();
  });

  it('renders the letter grade prominently', () => {
    renderPage({ member });
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('renders the composite score', () => {
    renderPage({ member });
    expect(screen.getByText('82.0')).toBeInTheDocument();
  });

  it('renders both dimension scores', () => {
    renderPage({ member });
    expect(screen.getByText('Attendance')).toBeInTheDocument();
    expect(screen.getByText('Party Independence')).toBeInTheDocument();
  });

  it('renders loading state when no member provided', () => {
    renderPage({ member: null });
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('links to the member website', () => {
    renderPage({ member });
    const link = screen.getByRole('link', { name: /official website/i });
    expect(link).toHaveAttribute('href', 'https://alexander.senate.gov');
  });
});
