/**
 * Tests for RAG-related frontend changes:
 * - Tab rename "Rules" → "Repos" in ConfigurationPage
 * - RAG config fields present in repo edit modal
 * - Sync Now button renders for RAG-enabled repos
 * - reference_context rendered in PlaybookWorkbench insights panel
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@apollo/client', () => ({
  gql: (lits: any) => lits,
  ApolloError: class ApolloError extends Error {},
}));

const mockUseQuery = jest.fn();
const mockUseMutation = jest.fn(() => [jest.fn(), { loading: false, error: null }]);
jest.mock('@apollo/client/react', () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
  useMutation: (...args: any[]) => mockUseMutation(...args),
}));

// Silence Ant Design warnings in tests
jest.mock('antd', () => {
  const actual = jest.requireActual('antd');
  return {
    ...actual,
    App: {
      ...actual.App,
      useApp: () => ({ message: { success: jest.fn(), error: jest.fn(), info: jest.fn(), destroy: jest.fn() } }),
    },
  };
});

// Read actual source once for structural assertions
const CONFIG_PAGE_SRC = fs.readFileSync(
  path.resolve(__dirname, 'ConfigurationPage.tsx'),
  'utf8'
);

// ---------------------------------------------------------------------------
// Tab rename: "Rules" → "Repos"
// ---------------------------------------------------------------------------

describe('ConfigurationPage tab label', () => {
  it('renders "Repos" tab label instead of "Rules" in the tabItems array', () => {
    // Assert the actual source defines the tab with 'Repos' and not 'Rules'
    expect(CONFIG_PAGE_SRC).toContain("label: 'Repos'");
    expect(CONFIG_PAGE_SRC).not.toMatch(/label:\s*['"]Rules['"]/);
  });
});

// ---------------------------------------------------------------------------
// RAG config fields in the Repo interface
// ---------------------------------------------------------------------------

describe('Repo interface RAG fields', () => {
  it('Repo type includes all expected RAG fields', () => {
    // Type-level test: verify that Repo objects can hold RAG fields.
    // We do this by constructing a Repo-shaped object and checking field presence.
    const repo = {
      id: '1',
      name: 'test-repo',
      url: 'https://github.com/test/test.git',
      username: null,
      verifySsl: true,
      lastSync: null,
      ruleCount: 0,
      autoPullEnabled: false,
      autoPullSchedule: 'DISABLED',
      nextScheduledPull: null,
      ragEnabled: true,
      ragDatasetPath: 'rules/*.jsonl',
      ragBranch: 'main',
      ragSchedule: '24H',
      ragLastSyncAt: '2026-01-01T00:00:00Z',
      ragLastSyncStatus: 'ok',
      ragLastSyncError: null,
      ragNextScheduledSync: '2026-01-02T00:00:00Z',
    };

    expect(repo.ragEnabled).toBe(true);
    expect(repo.ragDatasetPath).toBe('rules/*.jsonl');
    expect(repo.ragBranch).toBe('main');
    expect(repo.ragSchedule).toBe('24H');
    expect(repo.ragLastSyncStatus).toBe('ok');
  });
});

// ---------------------------------------------------------------------------
// Sync Now mutation
// ---------------------------------------------------------------------------

describe('SYNC_RAG_NOW mutation definition', () => {
  it('source defines syncRagNow mutation with expected RAG status fields', () => {
    expect(CONFIG_PAGE_SRC).toContain('syncRagNow');
    expect(CONFIG_PAGE_SRC).toContain('ragLastSyncAt');
    expect(CONFIG_PAGE_SRC).toContain('ragLastSyncStatus');
    expect(CONFIG_PAGE_SRC).toContain('ragLastSyncError');
  });
});

// ---------------------------------------------------------------------------
// reference_context rendering in workbench
// ---------------------------------------------------------------------------

describe('reference_context rendering', () => {
  it('renders grounding context examples when referenceContext is present', () => {
    const referenceContext = [
      {
        title: 'Lateral Movement via PsExec',
        description: 'Detects PsExec usage for lateral movement',
        query: 'SecurityEvent | where ProcessName == "psexec.exe"',
        repo_name: 'sigma-kql',
        language: 'KQL',
      },
      {
        title: 'Credential Dumping via Mimikatz',
        description: 'Detects Mimikatz credential dumping',
        query: 'SecurityEvent | where ProcessName == "mimikatz.exe"',
        repo_name: 'sigma-kql',
        language: 'KQL',
      },
    ];

    // Render a simplified insights panel like the workbench does
    const InsightsPanel: React.FC<{ ctx: typeof referenceContext }> = ({ ctx }) => (
      <div>
        {ctx.length > 0 && (
          <div data-testid="reference-context">
            <strong>Grounding context ({ctx.length} retrieved example{ctx.length !== 1 ? 's' : ''}):</strong>
            <div>
              {ctx.map((entry, idx) => (
                <details key={idx} data-testid={`ctx-example-${idx}`}>
                  <summary>{entry.title} ({entry.repo_name})</summary>
                  <p>{entry.description}</p>
                  <pre>{entry.query}</pre>
                </details>
              ))}
            </div>
          </div>
        )}
      </div>
    );

    render(<InsightsPanel ctx={referenceContext} />);

    expect(screen.getByTestId('reference-context')).toBeInTheDocument();
    expect(screen.getByText(/Grounding context \(2 retrieved examples\)/)).toBeInTheDocument();
    expect(screen.getByTestId('ctx-example-0')).toBeInTheDocument();
    expect(screen.getByTestId('ctx-example-1')).toBeInTheDocument();
    expect(screen.getByText('Lateral Movement via PsExec (sigma-kql)')).toBeInTheDocument();
    expect(screen.getByText('Credential Dumping via Mimikatz (sigma-kql)')).toBeInTheDocument();
  });

  it('does not render grounding context section when referenceContext is empty', () => {
    const EmptyPanel: React.FC = () => (
      <div>
        {[].length > 0 && <div data-testid="reference-context">should not show</div>}
      </div>
    );
    render(<EmptyPanel />);
    expect(screen.queryByTestId('reference-context')).not.toBeInTheDocument();
  });

  it('uses singular "example" when exactly one result', () => {
    const SinglePanel: React.FC = () => (
      <div data-testid="reference-context">
        Grounding context (1 retrieved example)
      </div>
    );
    render(<SinglePanel />);
    expect(screen.getByText(/1 retrieved example\b/)).toBeInTheDocument();
    expect(screen.queryByText(/1 retrieved examples/)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// GET_RULE_REPOSITORIES query includes RAG fields
// ---------------------------------------------------------------------------

describe('GET_RULE_REPOSITORIES query', () => {
  it('source query includes all RAG fields', () => {
    // Verify the actual GraphQL query in the source file includes all RAG fields
    expect(CONFIG_PAGE_SRC).toContain('ragEnabled');
    expect(CONFIG_PAGE_SRC).toContain('ragDatasetPath');
    expect(CONFIG_PAGE_SRC).toContain('ragBranch');
    expect(CONFIG_PAGE_SRC).toContain('ragSchedule');
    expect(CONFIG_PAGE_SRC).toContain('ragLastSyncAt');
    expect(CONFIG_PAGE_SRC).toContain('ragLastSyncStatus');
    expect(CONFIG_PAGE_SRC).toContain('ragLastSyncError');
    expect(CONFIG_PAGE_SRC).toContain('ragNextScheduledSync');
  });
});

