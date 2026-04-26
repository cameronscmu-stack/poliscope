// client/src/context/FilterContext.test.jsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FilterProvider, useFilter } from './FilterContext';

function TestConsumer() {
  const { chamber, setChamber, party, setParty, stateFilter, setStateFilter,
          gradeFilter, setGradeFilter, searchQuery, setSearchQuery } = useFilter();
  return (
    <div>
      <span data-testid="chamber">{chamber}</span>
      <span data-testid="party">{party}</span>
      <span data-testid="state">{stateFilter}</span>
      <span data-testid="grade">{gradeFilter}</span>
      <span data-testid="search">{searchQuery}</span>
      <button onClick={() => setChamber('house')}>set house</button>
      <button onClick={() => setParty('R')}>set R</button>
      <button onClick={() => setStateFilter('CA')}>set CA</button>
      <button onClick={() => setGradeFilter('A')}>set A</button>
      <button onClick={() => setSearchQuery('pelosi')}>set search</button>
    </div>
  );
}

describe('FilterContext', () => {
  it('provides default values', () => {
    render(<FilterProvider><TestConsumer /></FilterProvider>);
    expect(screen.getByTestId('chamber').textContent).toBe('senate');
    expect(screen.getByTestId('party').textContent).toBe('all');
    expect(screen.getByTestId('state').textContent).toBe('all');
    expect(screen.getByTestId('grade').textContent).toBe('all');
    expect(screen.getByTestId('search').textContent).toBe('');
  });

  it('setChamber updates chamber', () => {
    render(<FilterProvider><TestConsumer /></FilterProvider>);
    fireEvent.click(screen.getByText('set house'));
    expect(screen.getByTestId('chamber').textContent).toBe('house');
  });

  it('setParty updates party', () => {
    render(<FilterProvider><TestConsumer /></FilterProvider>);
    fireEvent.click(screen.getByText('set R'));
    expect(screen.getByTestId('party').textContent).toBe('R');
  });

  it('setStateFilter updates stateFilter', () => {
    render(<FilterProvider><TestConsumer /></FilterProvider>);
    fireEvent.click(screen.getByText('set CA'));
    expect(screen.getByTestId('state').textContent).toBe('CA');
  });

  it('setGradeFilter updates gradeFilter', () => {
    render(<FilterProvider><TestConsumer /></FilterProvider>);
    fireEvent.click(screen.getByText('set A'));
    expect(screen.getByTestId('grade').textContent).toBe('A');
  });

  it('setSearchQuery updates searchQuery', () => {
    render(<FilterProvider><TestConsumer /></FilterProvider>);
    fireEvent.click(screen.getByText('set search'));
    expect(screen.getByTestId('search').textContent).toBe('pelosi');
  });

  it('throws when used outside FilterProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow('useFilter must be used within FilterProvider');
    spy.mockRestore();
  });
});
