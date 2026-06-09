import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MaieuticEngineModal } from './MaieuticEngineModal';
import { MaieuticOutput, MaieuticImportSelections } from '../../types/maieutic';

describe('MaieuticEngineModal', () => {
  const mockOnClose = jest.fn();
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnSubmit.mockClear();
  });

  test('renders when isOpen is true', () => {
    render(
      <MaieuticEngineModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByText('Maieutic Engine')).toBeInTheDocument();
  });

  test('does not render when isOpen is false', () => {
    render(
      <MaieuticEngineModal
        isOpen={false}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.queryByText('Maieutic Engine')).not.toBeInTheDocument();
  });

  test('starts on Hypothesis step', () => {
    render(
      <MaieuticEngineModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByText('Detection Intent')).toBeInTheDocument();
    expect(screen.getByText('Technical Capability')).toBeInTheDocument();
  });

  test('Next button is disabled when required fields are empty on Hypothesis step', () => {
    render(
      <MaieuticEngineModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    const nextButton = screen.getByRole('button', { name: /Next/i });
    expect(nextButton).toBeDisabled();
  });

  test('Next button is enabled when required fields are filled on Hypothesis step', () => {
    render(
      <MaieuticEngineModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    const intentTextarea = screen.getByPlaceholderText(/What adversary behavior/i);
    const capabilityTextarea = screen.getByPlaceholderText(/What technical capability/i);

    fireEvent.change(intentTextarea, { target: { value: 'Test intent' } });
    fireEvent.change(capabilityTextarea, { target: { value: 'Test capability' } });

    const nextButton = screen.getByRole('button', { name: /Next/i });
    expect(nextButton).not.toBeDisabled();
  });

  test('can navigate to Interrogation step after filling Hypothesis', () => {
    render(
      <MaieuticEngineModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    // Fill Hypothesis
    const intentTextarea = screen.getByPlaceholderText(/What adversary behavior/i);
    const capabilityTextarea = screen.getByPlaceholderText(/What technical capability/i);
    fireEvent.change(intentTextarea, { target: { value: 'Test intent' } });
    fireEvent.change(capabilityTextarea, { target: { value: 'Test capability' } });

    // Click Next
    const nextButton = screen.getByRole('button', { name: /Next/i });
    fireEvent.click(nextButton);

    // Should now be on Interrogation step
    expect(screen.getByText(/Document your hypothesis interrogation/i)).toBeInTheDocument();
  });

  test('requires at least one QA entry on Interrogation step', () => {
    render(
      <MaieuticEngineModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    // Navigate to Interrogation
    const interrogationButton = screen.getByRole('button', { name: 'Interrogation' });
    fireEvent.click(interrogationButton);

    // Next should be disabled with no QA entries
    const nextButton = screen.getByRole('button', { name: /Next/i });
    expect(nextButton).toBeDisabled();
  });

  test('can add and remove QA entries', () => {
    render(
      <MaieuticEngineModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    // Navigate to Interrogation
    const interrogationButton = screen.getByRole('button', { name: 'Interrogation' });
    fireEvent.click(interrogationButton);

    // Add a QA entry
    const questionInput = screen.getByPlaceholderText(/Enter a question/i);
    const answerTextarea = screen.getByPlaceholderText(/Enter the answer/i);
    fireEvent.change(questionInput, { target: { value: 'Test question?' } });
    fireEvent.change(answerTextarea, { target: { value: 'Test answer' } });

    const addButton = screen.getByRole('button', { name: /Add Q&A Entry/i });
    fireEvent.click(addButton);

    // Verify entry was added
    expect(screen.getByText('Q1:')).toBeInTheDocument();
    expect(screen.getByText('Test question?')).toBeInTheDocument();
    expect(screen.getByText('Test answer')).toBeInTheDocument();

    // Remove the entry
    const removeButton = screen.getByRole('button', { name: /Remove/i });
    fireEvent.click(removeButton);

    // Verify entry was removed
    expect(screen.queryByText('Test question?')).not.toBeInTheDocument();
  });

  test('all import selections default to ON on Review step', () => {
    render(
      <MaieuticEngineModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    // Navigate to Review
    const reviewButton = screen.getByRole('button', { name: 'Review' });
    fireEvent.click(reviewButton);

    // Check all checkboxes are checked
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach((checkbox) => {
      expect(checkbox).toBeChecked();
    });
  });

  test('calls onSubmit with correct data and closes modal on submit', () => {
    render(
      <MaieuticEngineModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    // Fill in minimum required data and navigate to Review
    const intentTextarea = screen.getByPlaceholderText(/What adversary behavior/i);
    fireEvent.change(intentTextarea, { target: { value: 'Test intent' } });
    
    const capabilityTextarea = screen.getByPlaceholderText(/What technical capability/i);
    fireEvent.change(capabilityTextarea, { target: { value: 'Test capability' } });

    // Move to Interrogation
    let nextButton = screen.getByRole('button', { name: /Next/i });
    fireEvent.click(nextButton);

    // Add QA entry
    const questionInput = screen.getByPlaceholderText(/Enter a question/i);
    const answerTextarea = screen.getByPlaceholderText(/Enter the answer/i);
    fireEvent.change(questionInput, { target: { value: 'Q1' } });
    fireEvent.change(answerTextarea, { target: { value: 'A1' } });
    fireEvent.click(screen.getByRole('button', { name: /Add Q&A Entry/i }));

    // Move to Robustness
    nextButton = screen.getByRole('button', { name: /Next/i });
    fireEvent.click(nextButton);

    // Fill robustness fields
    const textareas = screen.getAllByRole('textbox');
    textareas.forEach((textarea, idx) => {
      fireEvent.change(textarea, { target: { value: `Robustness ${idx}` } });
    });

    // Move to Playbook
    nextButton = screen.getByRole('button', { name: /Next/i });
    fireEvent.click(nextButton);

    // Fill at least one playbook field
    const manualSteps = screen.getByPlaceholderText(/Manual investigation/i);
    fireEvent.change(manualSteps, { target: { value: 'Manual steps' } });

    // Move to Review
    nextButton = screen.getByRole('button', { name: /Next/i });
    fireEvent.click(nextButton);

    // Submit
    const submitButton = screen.getByRole('button', { name: /Submit to Workbench/i });
    fireEvent.click(submitButton);

    // Verify onSubmit was called
    expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    expect(mockOnSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        hypothesis: expect.objectContaining({
          intent: 'Test intent',
          capability: 'Test capability',
        }),
      }),
      expect.objectContaining({
        importHypothesis: true,
        importQALog: true,
        importRobustness: true,
        importPlaybook: true,
        importDetectionRule: true,
      })
    );

    // Verify onClose was called
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
