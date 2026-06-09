import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

// Basic smoke test using MemoryRouter (no global mocks)
test('renders login page heading when not authenticated', () => {
  render(
    <MemoryRouter initialEntries={['/']}> 
      <App />
    </MemoryRouter>
  );
  expect(screen.getByRole('heading', { name: /login to hefaistos/i })).toBeInTheDocument();
});
