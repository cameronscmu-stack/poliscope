import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FilterProvider } from '../../context/FilterContext';
import { FilterBar } from './FilterBar';

function renderFilterBar() {
  return render(
    <FilterProvider>
      <FilterBar />
    </FilterProvider>
  );
}

describe('FilterBar', () => {
  it('renders Senate and House buttons', () => {
    renderFilterBar();
    expect(screen.getByRole('button', { name: 'Senate' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'House' })).toBeInTheDocument();
  });

  it('Senate button is active by default', () => {
    renderFilterBar();
    const senate = screen.getByRole('button', { name: 'Senate' });
    expect(senate.style.backgroundColor).toBe('var(--navy)');
  });

  it('clicking House switches chamber', () => {
    renderFilterBar();
    fireEvent.click(screen.getByRole('button', { name: 'House' }));
    const house = screen.getByRole('button', { name: 'House' });
    expect(house.style.backgroundColor).toBe('var(--navy)');
  });

  it('renders party filter buttons', () => {
    renderFilterBar();
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Republican' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Democrat' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Independent' })).toBeInTheDocument();
  });

  it('clicking Republican sets party filter', () => {
    renderFilterBar();
    fireEvent.click(screen.getByRole('button', { name: 'Republican' }));
    const btn = screen.getByRole('button', { name: 'Republican' });
    expect(btn.style.color).toBe('white');
  });

  it('renders state select with All states option', () => {
    renderFilterBar();
    expect(screen.getByRole('combobox', { name: 'Filter by state' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'All states' })).toBeInTheDocument();
  });

  it('renders grade select with All grades option', () => {
    renderFilterBar();
    expect(screen.getByRole('combobox', { name: 'Filter by grade' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'All grades' })).toBeInTheDocument();
  });

  it('changing state select updates stateFilter', () => {
    renderFilterBar();
    const select = screen.getByRole('combobox', { name: 'Filter by state' });
    fireEvent.change(select, { target: { value: 'CA' } });
    expect(select.value).toBe('CA');
  });

  it('changing grade select updates gradeFilter', () => {
    renderFilterBar();
    const select = screen.getByRole('combobox', { name: 'Filter by grade' });
    fireEvent.change(select, { target: { value: 'A' } });
    expect(select.value).toBe('A');
  });
});
