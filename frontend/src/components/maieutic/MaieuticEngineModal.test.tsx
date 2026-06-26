import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MaieuticEngineModal } from './MaieuticEngineModal';

const mockAskAI = jest.fn();

jest.mock('@apollo/client/react', () => ({
  useMutation: () => [mockAskAI, { loading: false, error: null }],
}));

const aiResponsePayload = {
  socratic_question: 'What is the most specific behavior you can name?',
  teaching_note: 'Specificity improves detection quality.',
  reasoning: 'Narrowing scope reduces ambiguity.',
  answer_template: 'Intent: ... | Mechanism: ...',
  completion_check: {
    step_ready: true,
    quality_score: 90,
    missing_items: [],
    next_best_action: 'Proceed to the next step.',
  },
  field_suggestions: {},
  autofill_candidates: {
    target_fields: [],
    proposed_text: {},
  },
};

const makeMutationResult = () => ({
  data: {
    maieuticQuestion: {
      aiResponse: aiResponsePayload,
      providerUsed: 'GPT-5.5',
      fieldSuggestions: JSON.stringify({}),
      autofillCandidates: JSON.stringify({ target_fields: [], proposed_text: {} }),
    },
  },
});

describe('MaieuticEngineModal 2.0', () => {
  const mockOnClose = jest.fn();
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnSubmit.mockClear();
    mockAskAI.mockReset();
    mockAskAI.mockResolvedValue(makeMutationResult());
  });

  test('renders when open and shows 2.0 title', async () => {
    render(<MaieuticEngineModal isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />);
    expect(screen.getByText('Maieutic Engine 2.0')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockAskAI).toHaveBeenCalled(); // auto kickoff
    });
  });

  test('does not render when closed', () => {
    render(<MaieuticEngineModal isOpen={false} onClose={mockOnClose} onSubmit={mockOnSubmit} />);
    expect(screen.queryByText('Maieutic Engine 2.0')).not.toBeInTheDocument();
  });

  test('keeps Next disabled until required hypothesis fields are filled', async () => {
    render(<MaieuticEngineModal isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />);

    const nextButton = screen.getByRole('button', { name: /Next/i });
    expect(nextButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/What adversary behavior/i), {
      target: { value: 'Detect credential access behavior' },
    });
    fireEvent.change(screen.getByPlaceholderText(/What technical capability/i), {
      target: { value: 'LSASS handle and memory read sequence' },
    });

    await waitFor(() => {
      expect(nextButton).not.toBeDisabled();
    });
  });

  test('can progress through all stages and submit', async () => {
    render(<MaieuticEngineModal isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />);

    fireEvent.change(screen.getByPlaceholderText(/What adversary behavior/i), {
      target: { value: 'Detect credential dumping behavior' },
    });
    fireEvent.change(screen.getByPlaceholderText(/What technical capability/i), {
      target: { value: 'LSASS memory access and dump artifacts' },
    });

    const next = () => screen.getByRole('button', { name: /Next/i });

    await waitFor(() => expect(next()).not.toBeDisabled());
    fireEvent.click(next());

    fireEvent.change(screen.getByPlaceholderText(/Enter a question about the hypothesis/i), {
      target: { value: 'What data source captures this?' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Enter the answer/i), {
      target: { value: 'Sysmon event telemetry and EDR process traces' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Add Q&A Entry/i }));

    await waitFor(() => expect(next()).not.toBeDisabled());
    fireEvent.click(next());

    fireEvent.change(screen.getByPlaceholderText(/Assess reliability and completeness/i), {
      target: { value: 'High-quality telemetry from Sysmon and EDR.' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Expected false positive rate/i), {
      target: { value: 'Low with baseline tuning for admin tools.' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Coverage gaps and known blind spots/i), {
      target: { value: 'Gap: unmanaged endpoints without logging.' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Overall robustness reasoning/i), {
      target: { value: 'Behavior-based logic with clear fallback conditions.' },
    });

    await waitFor(() => expect(next()).not.toBeDisabled());
    fireEvent.click(next());

    fireEvent.change(screen.getByPlaceholderText(/Manual investigation and response steps/i), {
      target: { value: 'Validate lineage, isolate host, reset impacted credentials.' },
    });

    await waitFor(() => expect(next()).not.toBeDisabled());
    fireEvent.click(next());

    const submitButton = screen.getByRole('button', { name: /Submit to Workbench/i });
    await waitFor(() => expect(submitButton).not.toBeDisabled());
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });

    const [, selections] = mockOnSubmit.mock.calls[0];
    expect(selections.importSynthesis).toBe(true);
  });

  test('does not offer Sigma as a detection rule format', async () => {
    render(<MaieuticEngineModal isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />);

    fireEvent.change(screen.getByPlaceholderText(/What adversary behavior/i), {
      target: { value: 'Detect suspicious credential access behavior' },
    });
    fireEvent.change(screen.getByPlaceholderText(/What technical capability/i), {
      target: { value: 'LSASS read and credential extraction sequence' },
    });

    const next = () => screen.getByRole('button', { name: /Next/i });
    await waitFor(() => expect(next()).not.toBeDisabled());
    fireEvent.click(next());

    fireEvent.change(screen.getByPlaceholderText(/Enter a question about the hypothesis/i), {
      target: { value: 'Which data source exposes process access intent?' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Enter the answer/i), {
      target: { value: 'Sysmon process access and EDR telemetry.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Add Q&A Entry/i }));

    await waitFor(() => expect(next()).not.toBeDisabled());
    fireEvent.click(next());

    fireEvent.change(screen.getByPlaceholderText(/Assess reliability and completeness/i), {
      target: { value: 'High confidence in endpoint telemetry quality.' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Expected false positive rate/i), {
      target: { value: 'Low after baseline tuning.' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Coverage gaps and known blind spots/i), {
      target: { value: 'Blind spot on unmanaged hosts.' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Overall robustness reasoning/i), {
      target: { value: 'Strong behavior anchoring with evasion awareness.' },
    });

    await waitFor(() => expect(next()).not.toBeDisabled());
    fireEvent.click(next());

    expect(screen.queryByRole('option', { name: 'Sigma' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'KQL' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'SPL' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Pseudocode' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Other' })).toBeInTheDocument();
  });
});
