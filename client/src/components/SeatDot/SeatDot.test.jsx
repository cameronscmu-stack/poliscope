import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SeatDot } from './SeatDot';

const member = {
  id: 'A000360',
  first_name: 'Lamar',
  last_name: 'Alexander',
  party: 'R',
  state: 'TN',
  letter_grade: 'C',
};

describe('SeatDot', () => {
  it('renders a button with accessible label', () => {
    render(<SeatDot member={member} onClick={vi.fn()} />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-label', 'Lamar Alexander, R, TN');
  });

  it('calls onClick with member id when clicked', () => {
    const handleClick = vi.fn();
    render(<SeatDot member={member} onClick={handleClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledWith('A000360');
  });

  it('applies red background for Republican', () => {
    render(<SeatDot member={member} onClick={vi.fn()} />);
    const btn = screen.getByRole('button');
    expect(btn.style.backgroundColor).toBe('rgb(204, 34, 34)');
  });
});
