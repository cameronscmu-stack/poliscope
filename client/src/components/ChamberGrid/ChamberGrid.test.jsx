import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ChamberGrid } from './ChamberGrid';

const members = [
  { id: 'A000001', first_name: 'Alice', last_name: 'Smith', party: 'D', state: 'CA', letter_grade: 'A' },
  { id: 'B000001', first_name: 'Bob', last_name: 'Jones', party: 'R', state: 'TX', letter_grade: 'C' },
];

function renderGrid(props) {
  return render(
    <MemoryRouter>
      <ChamberGrid {...props} />
    </MemoryRouter>
  );
}

describe('ChamberGrid', () => {
  it('renders a seat button for each member', () => {
    renderGrid({ members, onSelectMember: vi.fn() });
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('shows loading state when members array is empty and loading is true', () => {
    renderGrid({ members: [], loading: true, onSelectMember: vi.fn() });
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows member count in the heading', () => {
    renderGrid({ members, onSelectMember: vi.fn() });
    expect(screen.getByText('2 members')).toBeInTheDocument();
  });
});
