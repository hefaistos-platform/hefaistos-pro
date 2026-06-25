import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
// Minimal Apollo hook mock: only useMutation needed, returns tuple expected by component
jest.mock('@apollo/client', () => ({
  gql: (lits: any) => lits,
}));
jest.mock('@apollo/client/react', () => ({
  useMutation: () => [jest.fn(), { loading: false, error: null }],
}));
import { AuthProvider } from '../context/AuthContext';
import { LoginPage } from './LoginPage';

test('renders login page with form fields', () => {
  render(
    <MemoryRouter>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>
  );

  expect(screen.getByText(/hefaistos/i)).toBeInTheDocument();

  // Check if the input fields are present
  expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/password/i)).toBeInTheDocument();

  // Check if the login button is present
  expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();

  const registerLink = screen.getByRole('link', { name: /register/i });
  expect(registerLink).toBeInTheDocument();
  expect(registerLink).toHaveAttribute('href', '/register');
});
