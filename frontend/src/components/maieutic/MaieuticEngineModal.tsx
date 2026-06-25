import React, { useState } from 'react';
import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { 
  MaieuticOutput, 
  MaieuticStep, 
  MaieuticHypothesis,
  MaieuticQAEntry,
  MaieuticRobustness,
  MaieuticPlaybookDesign,
  MaieuticDetectionRule,
  MaieuticImportSelections
} from '../../types/maieutic';

// GraphQL mutation for AI Socratic questioning
const MAIEUTIC_QUESTION_MUTATION = gql`
  mutation MaieuticQuestion(
    $userInput: String!,
    $conversationHistory: JSONString,
    $currentStep: String,
    $formContext: JSONString
  ) {
    maieuticQuestion(
      userInput: $userInput,
      conversationHistory: $conversationHistory,
      currentStep: $currentStep,
      formContext: $formContext
    ) {
      aiResponse
      providerUsed
      fieldSuggestions
    }
  }
`;

interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
}

interface MaieuticQuestionResponse {
  maieuticQuestion: {
    aiResponse: {
      socratic_question?: string;
      error?: string;
      robustness_recommendation?: {
        level: number;
        source_type: string;
        confidence: string;
      };
    };
    providerUsed: string;
    fieldSuggestions?: string;
  };
}

interface MaieuticEngineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (output: MaieuticOutput, selections: MaieuticImportSelections) => void | Promise<void>;
  submitLabel?: string;
}

const STEPS: MaieuticStep[] = ['Hypothesis', 'Interrogation', 'Robustness', 'Playbook', 'Review'];

export const MaieuticEngineModal: React.FC<MaieuticEngineModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  submitLabel,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const currentStep = STEPS[currentStepIndex];

  // Form state
  const [hypothesis, setHypothesis] = useState<MaieuticHypothesis>({ intent: '', capability: '' });
  const [qaLog, setQaLog] = useState<MaieuticQAEntry[]>([]);
  const [robustness, setRobustness] = useState<MaieuticRobustness>({
    dataQuality: '',
    falsePositiveRate: '',
    coverage: '',
    justification: '',
  });
  const [playbookDesign, setPlaybookDesign] = useState<MaieuticPlaybookDesign>({
    manualSteps: '',
    soarPlaybook: '',
  });
  const [detectionRule, setDetectionRule] = useState<MaieuticDetectionRule>({
    format: 'KQL',
    rule: '',
  });
  
  // AI-generated robustness recommendation
  const [robustnessRecommendation, setRobustnessRecommendation] = useState<{
    level: number;
    source_type: string;
    confidence: string;
  } | undefined>(undefined);

  // AI-generated field suggestions
  const [fieldSuggestions, setFieldSuggestions] = useState<{
    intent?: string;
    capability?: string;
    data_source?: string;
    mechanism?: string;
    false_positive_rate?: string;
    coverage_gaps?: string;
    manual_steps?: string;
    soar_playbook?: string;
  }>({});

  // Import selections - all ON by default
  const [selections, setSelections] = useState<MaieuticImportSelections>({
    importHypothesis: true,
    importQALog: true,
    importRobustness: true,
    importPlaybook: true,
    importDetectionRule: true,
  });

  // QA entry input state
  const [qaQuestion, setQaQuestion] = useState('');
  const [qaAnswer, setQaAnswer] = useState('');

  // AI Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  
  // GraphQL mutation
  const [askAI] = useMutation<MaieuticQuestionResponse>(MAIEUTIC_QUESTION_MUTATION);

  // Validation logic
  const canProceedFromStep = (step: MaieuticStep): boolean => {
    switch (step) {
      case 'Hypothesis':
        return hypothesis.intent.trim() !== '' && hypothesis.capability.trim() !== '';
      case 'Interrogation':
        return qaLog.length > 0;
      case 'Robustness':
        return (
          robustness.dataQuality.trim() !== '' &&
          robustness.falsePositiveRate.trim() !== '' &&
          robustness.coverage.trim() !== '' &&
          robustness.justification.trim() !== ''
        );
      case 'Playbook':
        return playbookDesign.manualSteps.trim() !== '' || playbookDesign.soarPlaybook.trim() !== '';
      case 'Review':
        return true; // Always can proceed from review (submit)
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (!canProceedFromStep(currentStep)) {
      return;
    }
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleSubmit = async () => {
    const output: MaieuticOutput = {
      hypothesis,
      qaLog,
      robustness,
      playbookDesign,
      detectionRule,
      robustnessRecommendation,
      conversationHistory: chatMessages,
    };
    await onSubmit(output, selections);
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setCurrentStepIndex(0);
    setHypothesis({ intent: '', capability: '' });
    setQaLog([]);
    setRobustness({ dataQuality: '', falsePositiveRate: '', coverage: '', justification: '' });
    setPlaybookDesign({ manualSteps: '', soarPlaybook: '' });
    setDetectionRule({ format: 'KQL', rule: '' });
    setRobustnessRecommendation(undefined);
    setFieldSuggestions({});
    setSelections({
      importHypothesis: true,
      importQALog: true,
      importRobustness: true,
      importPlaybook: true,
      importDetectionRule: true,
    });
    setQaQuestion('');
    setQaAnswer('');
    setChatMessages([]);
    setChatInput('');
  };

  const handleAskAI = async () => {
    if (!chatInput.trim() || aiLoading) return;
    
    const userMessage = chatInput.trim();
    setChatInput('');
    
    // Add user message to chat
    const newMessages = [...chatMessages, { role: 'user' as const, content: userMessage }];
    setChatMessages(newMessages);
    setAiLoading(true);
    
    try {
      // Prepare conversation history for context
      const history = chatMessages.map(msg => ({
        user: msg.role === 'user' ? msg.content : '',
        ai: msg.role === 'ai' ? msg.content : ''
      }));
      
      const stepMap: Record<MaieuticStep, string> = {
        'Hypothesis': 'hypothesis',
        'Interrogation': 'interrogation',
        'Robustness': 'robustness',
        'Playbook': 'playbook',
        'Review': 'review'
      };

      // Build complete form context so AI can see what user has already entered
      const formContext = {
        hypothesis: {
          intent: hypothesis.intent,
          capability: hypothesis.capability
        },
        interrogation: qaLog,
        robustness: {
          dataQuality: robustness.dataQuality,
          falsePositiveRate: robustness.falsePositiveRate,
          coverage: robustness.coverage,
          justification: robustness.justification
        },
        playbook: {
          manualSteps: playbookDesign.manualSteps,
          soarPlaybook: playbookDesign.soarPlaybook
        },
        detectionRule: {
          format: detectionRule.format,
          rule: detectionRule.rule
        }
      };
      
      const result = await askAI({
        variables: {
          userInput: userMessage,
          conversationHistory: JSON.stringify(history),
          currentStep: stepMap[currentStep],
          formContext: JSON.stringify(formContext)
        }
      });
      
      let aiResponse = result.data?.maieuticQuestion?.aiResponse;
      const rawSuggestions = result.data?.maieuticQuestion?.fieldSuggestions;
      
      // Handle Graphene JSONString serialization quirks (sometimes returns string)
      if (typeof aiResponse === 'string') {
        try {
          aiResponse = JSON.parse(aiResponse);
        } catch (e) {
          console.error('Failed to parse AI response JSON:', e);
        }
      }
      
      if (aiResponse) {
        // Extract the Socratic question from the JSON response
        const question = aiResponse.socratic_question || aiResponse.error || 'Could you elaborate on that?';
        setChatMessages([...newMessages, { role: 'ai' as const, content: question }]);
        
        // Optionally apply robustness recommendation if available
        if (aiResponse.robustness_recommendation && currentStep === 'Robustness') {
          const rec = aiResponse.robustness_recommendation;
          setRobustnessRecommendation(rec); // Store for later submission
          if (rec.level && !robustness.justification) {
            setRobustness({
              ...robustness,
              justification: `AI suggests robustness level ${rec.level}/5 (${rec.source_type}) with ${rec.confidence} confidence.`
            });
          }
        }

        // Store field suggestions from the response
        if (rawSuggestions) {
          try {
            const parsed = typeof rawSuggestions === 'string' ? JSON.parse(rawSuggestions) : rawSuggestions;
            if (parsed && typeof parsed === 'object') {
              setFieldSuggestions(parsed);
            }
          } catch (e) {
            console.error('Failed to parse field suggestions:', e);
          }
        }
      }
    } catch (error: any) {
      console.error('AI questioning error:', error);
      const errorMessage = error?.message || error?.graphQLErrors?.[0]?.message || 'Unknown error occurred';
      setChatMessages([...newMessages, { 
        role: 'ai' as const, 
        content: `I apologize, but I encountered an error: ${errorMessage}. Please try again or continue manually.` 
      }]);
    } finally {
      setAiLoading(false);
    }
  };

  const addQAEntry = () => {
    const trimmedQuestion = qaQuestion.trim();
    const trimmedAnswer = qaAnswer.trim();
    if (trimmedQuestion && trimmedAnswer) {
      setQaLog([...qaLog, { question: trimmedQuestion, answer: trimmedAnswer }]);
      setQaQuestion('');
      setQaAnswer('');
    }
  };

  const removeQAEntry = (index: number) => {
    setQaLog(qaLog.filter((_, i) => i !== index));
  };

  const requestFieldHelp = (fieldName: string) => {
    const helpPrompts: Record<string, string> = {
      intent: "I need help with the detection intent field. What should I focus on?",
      capability: "I need help defining the technical capability. What should I specify?",
      dataQuality: "I need help assessing data quality. What should I consider?",
      falsePositiveRate: "I need help estimating false positive rate. What factors matter?",
      coverage: "I need help identifying coverage gaps and blind spots. What should I analyze?",
      justification: "I need help writing the robustness justification. What should I include?",
      manualSteps: "I need help designing the manual triage steps. What should analysts do first?",
      soarPlaybook: "I need help designing the automated SOAR playbook. What can be automated?"
    };
    setChatInput(helpPrompts[fieldName] || `Help me with the ${fieldName} field`);
  };

  // Render AI Chat Assistant Widget
  const renderAIChat = () => (
    <div className="maieutic-chat-shell mt-4 border rounded-lg p-3">
      <h4 className="font-medium mb-2 flex items-center gap-2">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z"/>
          <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z"/>
        </svg>
        AI Socratic Assistant
      </h4>
      <div className="maieutic-chat-info mb-2 text-xs p-2 rounded">
        ℹ️ <strong>AI can see:</strong> All text you've entered in form fields. It will reference your inputs when asking questions.
      </div>
      {chatMessages.length > 0 && (
        <div className="mb-3 max-h-40 overflow-y-auto space-y-2">
          {chatMessages.map((msg, idx) => (
            <div
              key={idx}
              className={`p-2 rounded text-sm ${
                msg.role === 'user'
                  ? 'maieutic-chat-msg-user ml-4'
                  : 'maieutic-chat-msg-ai mr-4'
              }`}
            >
              <span className="font-semibold">{msg.role === 'user' ? 'You' : 'AI'}:</span> {msg.content}
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          className="maieutic-chat-input flex-1 border rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Ask AI about your detection, request field help, or get challenged..."
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleAskAI()}
          disabled={aiLoading}
        />
        <Button
          onClick={handleAskAI}
          variant="primary"
          disabled={aiLoading || !chatInput.trim()}
          className="text-xs"
        >
          {aiLoading ? 'Thinking...' : 'Ask AI'}
        </Button>
      </div>
      <p className="text-xs mt-1" style={{ color: 'var(--hef-text-secondary)' }}>
        💡 Tip: Ask "Is my [field name] specific enough?" or "What am I missing in [step]?"
      </p>
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 'Hypothesis':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Detection Intent <span className="text-red-500">*</span>
                <button
                  type="button"
                  onClick={() => requestFieldHelp('intent')}
                  className="ml-2 text-blue-600 hover:text-blue-800 text-xs"
                  title="Ask AI for guidance on this field"
                >
                  💡 Get AI hint
                </button>
              </label>
              <textarea
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="What adversary behavior or capability are you trying to detect?"
                value={hypothesis.intent}
                onChange={(e) => setHypothesis({ ...hypothesis, intent: e.target.value })}
              />
              {fieldSuggestions.intent && (
                <div className="mt-2 p-3 bg-blue-50 border-l-4 border-blue-500 text-sm">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <strong className="text-blue-800">💡 AI Hint:</strong>
                      <p className="text-gray-700 mt-1">{fieldSuggestions.intent}</p>
                    </div>
                    <button
                      onClick={() => setFieldSuggestions({ ...fieldSuggestions, intent: undefined })}
                      className="text-gray-400 hover:text-gray-600 ml-2"
                      title="Dismiss hint"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Technical Capability <span className="text-red-500">*</span>
                <button
                  type="button"
                  onClick={() => requestFieldHelp('capability')}
                  className="ml-2 text-blue-600 hover:text-blue-800 text-xs"
                  title="Ask AI for guidance on this field"
                >
                  💡 Get AI hint
                </button>
              </label>
              <textarea
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="What technical capability or technique is being targeted?"
                value={hypothesis.capability}
                onChange={(e) => setHypothesis({ ...hypothesis, capability: e.target.value })}
              />
              {fieldSuggestions.capability && (
                <div className="mt-2 p-3 bg-blue-50 border-l-4 border-blue-500 text-sm">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <strong className="text-blue-800">💡 AI Hint:</strong>
                      <p className="text-gray-700 mt-1">{fieldSuggestions.capability}</p>
                    </div>
                    <button
                      onClick={() => setFieldSuggestions({ ...fieldSuggestions, capability: undefined })}
                      className="text-gray-400 hover:text-gray-600 ml-2"
                      title="Dismiss hint"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
            </div>
            {renderAIChat()}
          </div>
        );

      case 'Interrogation':
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Document your hypothesis interrogation through Q&A. At least one entry is required.
            </p>
            <div className="space-y-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Question</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter a question about the hypothesis..."
                  value={qaQuestion}
                  onChange={(e) => setQaQuestion(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Answer</label>
                <textarea
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Enter the answer..."
                  value={qaAnswer}
                  onChange={(e) => setQaAnswer(e.target.value)}
                />
              </div>
              <Button 
                onClick={addQAEntry} 
                variant="secondary" 
                className="w-full"
                disabled={!qaQuestion.trim() || !qaAnswer.trim()}
              >
                Add Q&A Entry
              </Button>
            </div>

            {qaLog.length > 0 && (
              <div className="mt-4 space-y-2">
                <h4 className="font-medium text-gray-700">Q&A Log ({qaLog.length})</h4>
                {qaLog.map((entry, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 rounded border border-gray-200">
                    <div className="flex justify-between items-start mb-1">
                      <strong className="text-sm">Q{idx + 1}:</strong>
                      <button
                        onClick={() => removeQAEntry(idx)}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        Remove
                      </button>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{entry.question}</p>
                    <strong className="text-sm">A{idx + 1}:</strong>
                    <p className="text-sm text-gray-700">{entry.answer}</p>
                  </div>
                ))}
              </div>
            )}
            {renderAIChat()}
          </div>
        );

      case 'Robustness':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data Quality Assessment <span className="text-red-500">*</span>
                <button
                  type="button"
                  onClick={() => requestFieldHelp('dataQuality')}
                  className="ml-2 text-blue-600 hover:text-blue-800 text-xs"
                  title="Ask AI for guidance on this field"
                >
                  💡 Get AI hint
                </button>
              </label>
              <textarea
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                placeholder="Assess reliability and completeness of data sources..."
                value={robustness.dataQuality}
                onChange={(e) => setRobustness({ ...robustness, dataQuality: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                False Positive Rate <span className="text-red-500">*</span>
                <button
                  type="button"
                  onClick={() => requestFieldHelp('falsePositiveRate')}
                  className="ml-2 text-blue-600 hover:text-blue-800 text-xs"
                  title="Ask AI for guidance on this field"
                >
                  💡 Get AI hint
                </button>
              </label>
              <textarea
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                placeholder="Expected false positive rate and justification..."
                value={robustness.falsePositiveRate}
                onChange={(e) => setRobustness({ ...robustness, falsePositiveRate: e.target.value })}
              />
              {fieldSuggestions.false_positive_rate && (
                <div className="mt-2 p-3 bg-blue-50 border-l-4 border-blue-500 text-sm">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <strong className="text-blue-800">💡 AI Hint:</strong>
                      <p className="text-gray-700 mt-1">{fieldSuggestions.false_positive_rate}</p>
                    </div>
                    <button
                      onClick={() => setFieldSuggestions({ ...fieldSuggestions, false_positive_rate: undefined })}
                      className="text-gray-400 hover:text-gray-600 ml-2"
                      title="Dismiss hint"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Coverage & Blind Spots <span className="text-red-500">*</span>
                <button
                  type="button"
                  onClick={() => requestFieldHelp('coverage')}
                  className="ml-2 text-blue-600 hover:text-blue-800 text-xs"
                  title="Ask AI for guidance on this field"
                >
                  💡 Get AI hint
                </button>
              </label>
              <textarea
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                placeholder="Coverage gaps and known blind spots..."
                value={robustness.coverage}
                onChange={(e) => setRobustness({ ...robustness, coverage: e.target.value })}
              />
              {fieldSuggestions.coverage_gaps && (
                <div className="mt-2 p-3 bg-blue-50 border-l-4 border-blue-500 text-sm">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <strong className="text-blue-800">💡 AI Hint:</strong>
                      <p className="text-gray-700 mt-1">{fieldSuggestions.coverage_gaps}</p>
                    </div>
                    <button
                      onClick={() => setFieldSuggestions({ ...fieldSuggestions, coverage_gaps: undefined })}
                      className="text-gray-400 hover:text-gray-600 ml-2"
                      title="Dismiss hint"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Overall Justification <span className="text-red-500">*</span>
                <button
                  type="button"
                  onClick={() => requestFieldHelp('justification')}
                  className="ml-2 text-blue-600 hover:text-blue-800 text-xs"
                  title="Ask AI for guidance on this field"
                >
                  💡 Get AI hint
                </button>
              </label>
              <textarea
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Overall robustness reasoning..."
                value={robustness.justification}
                onChange={(e) => setRobustness({ ...robustness, justification: e.target.value })}
              />
            </div>
            {renderAIChat()}
          </div>
        );

      case 'Playbook':
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              At least one playbook section (Manual or SOAR) must have content.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Manual Investigation Steps
                <button
                  type="button"
                  onClick={() => requestFieldHelp('manualSteps')}
                  className="ml-2 text-blue-600 hover:text-blue-800 text-xs"
                  title="Ask AI for guidance on this field"
                >
                  💡 Get AI hint
                </button>
              </label>
              <textarea
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={5}
                placeholder="Manual investigation and response steps..."
                value={playbookDesign.manualSteps}
                onChange={(e) => setPlaybookDesign({ ...playbookDesign, manualSteps: e.target.value })}
              />
              {fieldSuggestions.manual_steps && (
                <div className="mt-2 p-3 bg-blue-50 border-l-4 border-blue-500 text-sm">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <strong className="text-blue-800">💡 AI Hint:</strong>
                      <p className="text-gray-700 mt-1">{fieldSuggestions.manual_steps}</p>
                    </div>
                    <button
                      onClick={() => setFieldSuggestions({ ...fieldSuggestions, manual_steps: undefined })}
                      className="text-gray-400 hover:text-gray-600 ml-2"
                      title="Dismiss hint"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SOAR Playbook
                <button
                  type="button"
                  onClick={() => requestFieldHelp('soarPlaybook')}
                  className="ml-2 text-blue-600 hover:text-blue-800 text-xs"
                  title="Ask AI for guidance on this field"
                >
                  💡 Get AI hint
                </button>
              </label>
              <textarea
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={5}
                placeholder="Automated SOAR playbook content..."
                value={playbookDesign.soarPlaybook}
                onChange={(e) => setPlaybookDesign({ ...playbookDesign, soarPlaybook: e.target.value })}
              />
              {fieldSuggestions.soar_playbook && (
                <div className="mt-2 p-3 bg-blue-50 border-l-4 border-blue-500 text-sm">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <strong className="text-blue-800">💡 AI Hint:</strong>
                      <p className="text-gray-700 mt-1">{fieldSuggestions.soar_playbook}</p>
                    </div>
                    <button
                      onClick={() => setFieldSuggestions({ ...fieldSuggestions, soar_playbook: undefined })}
                      className="text-gray-400 hover:text-gray-600 ml-2"
                      title="Dismiss hint"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Detection Rule section */}
            <div className="pt-4 border-t border-gray-200">
              <h4 className="font-medium text-gray-700 mb-3">Detection Rule</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rule Format
                  </label>
                  <select
                    className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={detectionRule.format}
                    onChange={(e) => setDetectionRule({ ...detectionRule, format: e.target.value })}
                  >
                    <option value="KQL">KQL</option>
                    <option value="SPL">SPL</option>
                    <option value="Pseudocode">Pseudocode</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Detection Rule
                  </label>
                  <textarea
                    className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    rows={8}
                    placeholder="Enter your detection rule here..."
                    value={detectionRule.rule}
                    onChange={(e) => setDetectionRule({ ...detectionRule, rule: e.target.value })}
                  />
                </div>
              </div>
            </div>
            {renderAIChat()}
          </div>
        );

      case 'Review':
        return (
          <div className="space-y-4">
            <h4 className="font-medium text-gray-800">Review & Import Selections</h4>
            <p className="text-sm text-gray-600">
              Choose which parts to import into the workbench. All sections are selected by default.
            </p>

            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selections.importHypothesis}
                  onChange={(e) => setSelections({ ...selections, importHypothesis: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Import Hypothesis</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selections.importQALog}
                  onChange={(e) => setSelections({ ...selections, importQALog: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Import Interrogation Log ({qaLog.length} entries)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selections.importRobustness}
                  onChange={(e) => setSelections({ ...selections, importRobustness: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Import Robustness Analysis</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selections.importPlaybook}
                  onChange={(e) => setSelections({ ...selections, importPlaybook: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Import Playbook Design</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selections.importDetectionRule}
                  onChange={(e) => setSelections({ ...selections, importDetectionRule: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Import Detection Rule ({detectionRule.format})</span>
              </label>
            </div>

            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> This will stage the selected data for review. You can apply it to the
                workbench form after closing this modal. No changes will be saved automatically.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Maieutic Engine" size="4xl">
      <div className="maieutic-modal space-y-4">
        {/* Step Navigation */}
        <div className="flex items-center justify-between border-b border-gray-200 pb-3">
          <div className="flex items-center gap-2">
            {STEPS.map((step, idx) => (
              <React.Fragment key={step}>
                <button
                  onClick={() => setCurrentStepIndex(idx)}
                  className={`px-3 py-1 text-sm rounded ${
                    idx === currentStepIndex
                      ? 'bg-blue-600 text-white'
                      : idx < currentStepIndex
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {step}
                </button>
                {idx < STEPS.length - 1 && <span className="text-gray-400">→</span>}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="min-h-[400px] max-h-[60vh] overflow-y-auto">{renderStepContent()}</div>

        {/* Navigation Buttons */}
        <div className="flex justify-between items-center pt-4 border-t border-gray-200">
          <div>
            {currentStepIndex > 0 && (
              <Button onClick={handleBack} variant="secondary">
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {currentStep !== 'Review' ? (
              <Button
                onClick={handleNext}
                variant="primary"
                disabled={!canProceedFromStep(currentStep)}
                title={!canProceedFromStep(currentStep) ? 'Complete required fields to proceed' : ''}
              >
                Next
              </Button>
            ) : (
              <Button onClick={handleSubmit} variant="primary">
                {submitLabel || 'Submit to Workbench'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
