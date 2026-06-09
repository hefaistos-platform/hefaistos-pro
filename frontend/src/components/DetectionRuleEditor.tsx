/**
 * DetectionRuleEditor.tsx
 * 
 * Monaco Editor for detection rules with autocomplete and SyntaxTide LSP support.
 * Replaces textarea in DetectionRuleEditorModal.
 */

import React, { useRef, useEffect, useState } from 'react';
import { Editor } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { LSPClient, LspConnectionStatus } from '../utils/lspClient';
import { registerCustomLanguages } from '../utils/monacoLanguages';

// GraphQL query string for autocomplete
const GET_AUTOCOMPLETE_OPTIONS = `
  mutation GetAutocompleteOptions(
    $format: String!
    $context: String!
    $position: Int!
    $dataSourceId: ID
  ) {
    getAutocompleteOptions(
      format: $format
      context: $context
      position: $position
      dataSourceId: $dataSourceId
    ) {
      result {
        suggestions {
          label
          kind
          insertText
          detail
          documentation
          sortText
          filterText
        }
        isComplete
      }
    }
  }
`;

interface DetectionRuleEditorProps {
  value: string;
  onChange: (value: string) => void;
  format: 'KQL' | 'WAZUH' | 'SPL' | 'AQL' | 'OTHER';
  height?: string;
  dataSourceId?: string;
  readOnly?: boolean;
  enableLSP?: boolean;
}

type LspStatus = 'connecting' | 'connected' | 'error' | 'disabled';

/** Map a format string to the LSP language identifier used by the proxy. */
const FORMAT_TO_LSP_LANGUAGE: Record<string, string> = {
  KQL: 'kql',
  SPL: 'spl',
  WAZUH: 'wazuh',
};

/**
 * Convert Monaco suggestion kind to CompletionItemKind enum
 */
function kindToMonacoKind(kind: string): number {
  const kindMap: { [key: string]: number } = {
    keyword: monaco.languages.CompletionItemKind.Keyword,
    field: monaco.languages.CompletionItemKind.Field,
    value: monaco.languages.CompletionItemKind.Constant,
    operator: monaco.languages.CompletionItemKind.Operator,
    function: monaco.languages.CompletionItemKind.Function,
    snippet: monaco.languages.CompletionItemKind.Snippet,
    text: monaco.languages.CompletionItemKind.Text,
  };
  return kindMap[kind] || monaco.languages.CompletionItemKind.Text;
}

/**
 * Extract prefix (word being typed) at cursor position
 */
function extractPrefix(text: string, position: number): string {
  if (position <= 0) return '';
  
  let start = position - 1;
  while (start >= 0) {
    const char = text[start];
    if (char.match(/\s/) || char.match(/[:{}[\](),"'=<>!|&-]/)) {
      break;
    }
    start--;
  }
  return text.substring(start + 1, position);
}

/** Get Monaco language ID for a given format. */
function getMonacoLanguage(format: string): string {
  switch (format) {
    case 'KQL': return 'kql';
    case 'WAZUH': return 'xml';
    case 'SPL': return 'spl';
    case 'AQL': return 'sql';
    default: return 'plaintext';
  }
}

/**
 * DetectionRuleEditor: Monaco Editor with KQL/SPL autocomplete and LSP integration
 */
export const DetectionRuleEditor: React.FC<DetectionRuleEditorProps> = ({
  value,
  onChange,
  format,
  height = '100%',
  dataSourceId,
  readOnly = false,
  enableLSP = true,
}) => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const lastRequestRef = useRef<number>(0);
  const lspClientRef = useRef<LSPClient | null>(null);
  const [lspStatus, setLspStatus] = useState<LspStatus>('disabled');

  // Register custom Monaco language definitions once on mount
  useEffect(() => {
    registerCustomLanguages();
  }, []);

  // LSP WebSocket connection via Django Channels proxy
  useEffect(() => {
    if (!enableLSP) {
      setLspStatus('disabled');
      return;
    }

    const lspLanguage = FORMAT_TO_LSP_LANGUAGE[format];
    if (!lspLanguage) {
      setLspStatus('disabled');
      return;
    }

    const client = new LSPClient(
      lspLanguage,
      // Diagnostics callback: update Monaco markers
      (diagnostics) => {
        const model = editorRef.current?.getModel();
        if (model) {
          monaco.editor.setModelMarkers(model, 'lsp', diagnostics);
        }
      },
      // Status change callback
      (status: LspConnectionStatus) => {
        if (status === 'connected') {
          setLspStatus('connected');
          // Notify LSP of the currently open document
          const model = editorRef.current?.getModel();
          if (model) {
            const uri = `inmemory://model/${lspLanguage}`;
            client.didOpen(uri, getMonacoLanguage(format), 1, model.getValue());
          }
        } else if (status === 'error') {
          setLspStatus('error');
        } else if (status === 'connecting') {
          setLspStatus('connecting');
        } else {
          setLspStatus('disabled');
        }
      },
    );

    lspClientRef.current = client;

    client.connect().catch((err) => {
      console.warn(`[LSP] Failed to connect for ${format}:`, err);
    });

    return () => {
      // Clear markers and disconnect when format changes or component unmounts
      const model = editorRef.current?.getModel();
      if (model) {
        monaco.editor.setModelMarkers(model, 'lsp', []);
      }
      client.disconnect();
      lspClientRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format, enableLSP]);

  // Register autocomplete provider globally (once per format)
  useEffect(() => {
    const languageId = getMonacoLanguage(format);
    
    // Configure trigger characters based on format:
    // KQL: '|' (pipe operator), '.' (member access), ',' (argument separator)
    // SPL: '|' (pipe operator), '.' (member access), ',' (argument separator)
    // WAZUH: '<' (XML opening tags)
    // NOTE: Space is intentionally excluded from trigger characters to avoid
    // interfering with normal typing (space key would behave unexpectedly).
    const triggerCharacters =
      format === 'KQL'
        ? ['|', '.', ',']
        : format === 'SPL'
        ? ['|', '.', ',']
        : ['<']; // WAZUH/XML

    const provider = monaco.languages.registerCompletionItemProvider(
      languageId,
      {
        triggerCharacters,
        provideCompletionItems: async (model, position) => {
          // Debounce autocomplete requests to avoid excessive API calls
          const now = Date.now();
          const timeSinceLastRequest = now - lastRequestRef.current;
          if (timeSinceLastRequest < 200) {
            return { suggestions: [] };
          }
          lastRequestRef.current = now;
          const text = model.getValue();
          const offset = model.getOffsetAt(position);
          const prefix = extractPrefix(text, offset);

          try {
            // Use the same API URL pattern as Apollo Client
            const baseApiUrl = (process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL.replace(/\/+$/, '')) || window.location.origin;
            const uri = `${baseApiUrl}/graphql`;
            
            // Get auth token from localStorage
            const token = localStorage.getItem('accessToken');
            
            const response = await fetch(uri, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({
                query: GET_AUTOCOMPLETE_OPTIONS,
                variables: {
                  format,
                  context: text,
                  position: offset,
                  dataSourceId: dataSourceId || null,
                },
              }),
            });

            const result = await response.json();
            
            if (result.errors) {
              console.error('[Autocomplete] GraphQL errors:', result.errors);
              return { suggestions: [] };
            }

            const suggestions = result.data?.getAutocompleteOptions?.result?.suggestions || [];
            
            if (suggestions.length > 0) {
              console.log(`[Autocomplete] Got ${suggestions.length} suggestions for format ${format}`);
            }

            return {
              suggestions: suggestions.map((s: any) => ({
                label: s.label,
                kind: kindToMonacoKind(s.kind),
                insertText: s.insertText,
                detail: s.detail,
                documentation: s.documentation ? { value: s.documentation } : undefined,
                sortText: s.sortText || s.label,
                filterText: s.filterText || s.label,
                range: {
                  startLineNumber: position.lineNumber,
                  startColumn: position.column - prefix.length,
                  endLineNumber: position.lineNumber,
                  endColumn: position.column,
                },
              })),
            };
          } catch (error) {
            console.error('[Autocomplete] Request failed:', error);
            if (error instanceof Error) {
              console.error('[Autocomplete] Error details:', error.message);
            }
            return { suggestions: [] };
          }
        },
      }
    );

    // Cleanup: dispose provider when component unmounts or format changes
    return () => {
      provider.dispose();
    };
  }, [format, dataSourceId]); // Re-register when format or dataSourceId changes

  return (
    <div className="relative w-full h-full">
      {/* LSP Status Indicator */}
      {enableLSP && lspStatus !== 'disabled' && (
        <div className="absolute top-2 right-2 z-10 pointer-events-none">
          {lspStatus === 'connecting' && (
            <span className="text-xs text-gray-400 bg-gray-800 bg-opacity-80 px-2 py-0.5 rounded">
              🔄 LSP connecting…
            </span>
          )}
          {lspStatus === 'connected' && (
            <span className="text-xs text-green-400 bg-gray-800 bg-opacity-80 px-2 py-0.5 rounded">
              ✓ LSP active
            </span>
          )}
          {lspStatus === 'error' && (
            <span className="text-xs text-red-400 bg-gray-800 bg-opacity-80 px-2 py-0.5 rounded">
              ✗ LSP unavailable
            </span>
          )}
        </div>
      )}

      <Editor
        height={height}
        language={getMonacoLanguage(format)}
        value={value}
        onChange={(val) => {
          const newValue = val || '';
          onChange(newValue);
          // Notify LSP of content change for real-time diagnostics
          const lspLanguage = FORMAT_TO_LSP_LANGUAGE[format];
          if (lspClientRef.current && lspLanguage) {
            const uri = `inmemory://model/${lspLanguage}`;
            lspClientRef.current.didChange(uri, Date.now(), newValue);
          }
        }}
        theme="vs-dark"
        options={{
          minimap: { enabled: true },
          fontSize: 14,
          fontFamily: 'Menlo, Monaco, Courier New, monospace',
          formatOnPaste: true,
          formatOnType: false,
          autoClosingBrackets: 'always',
          autoClosingQuotes: 'always',
          suggest: {
            showSnippets: true,
            showWords: true,
            showIcons: true,
            filterGraceful: true,
            showInlineDetails: true,
          },
          quickSuggestions: {
            other: true,
            comments: false,
            strings: false,
          },
          suggestOnTriggerCharacters: true,
          wordBasedSuggestions: 'off',
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          readOnly: readOnly,
        }}
        onMount={(editor) => {
          editorRef.current = editor;
          console.log('Editor mounted, language model:', editor.getModel()?.getLanguageId());
        }}
        loading={<div style={{ padding: '16px', color: '#888' }}>Loading editor...</div>}
      />
    </div>
  );
};

export default DetectionRuleEditor;
