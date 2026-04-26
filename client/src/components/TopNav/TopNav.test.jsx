import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { FilterProvider } from '../../context/FilterContext';
import { TopNav } from './TopNav';

function renderTopNav(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <FilterProvider>
        <TopNav />
      </FilterProvider>
    </MemoryRouter>
  );
}

describe('TopNav', () => {
  it('renders POLISCOPE wordmark', () => {
    renderTopNav();
    expect(screen.getByText('POLISCOPE')).toBeInTheDocument();
  });

  it('renders search input on home route', () => {
    renderTopNav('/');
    expect(screen.getByPlaceholderText('Search members…')).toBeInTheDocument();
  });

  it('does not render search input on rep route', () => {
    renderTopNav('/rep/A000001');
    expect(screen.queryByPlaceholderText('Search members…')).not.toBeInTheDocument();
  });

  it('renders back button on rep route', () => {
    renderTopNav('/rep/A000001');
    expect(screen.getByText('← Back')).toBeInTheDocument();
  });

  it('renders Congress nav link', () => {
    renderTopNav();
    expect(screen.getByRole('link', { name: 'Congress' })).toBeInTheDocument();
  });

  it('typing in search updates context searchQuery', () => {
    renderTopNav('/');
    const input = screen.getByPlaceholderText('Search members…');
    fireEvent.change(input, { target: { value: 'warren' } });
    expect(input.value).toBe('warren');
  });
});
