import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  MaieuticImportSelections,
  MaieuticCompletionCheck,
  MaieuticAutofillCandidates,
  MaieuticSynthesisOutput,
} from '../../types/maieutic';

const MAIEUTIC_QUESTION_MUTATION = gql`
  mutation MaieuticQuestion(
    $userInput: String!
    $conversationHistory: JSONString
    $currentStep: String
    $challengeLevel: String
    $synthesisMode: Boolean
    $formContext: JSONString
  ) {
    maieuticQuestion(
      userInput: $userInput
      conversationHistory: $conversationHistory
      currentStep: $currentStep
      challengeLevel: $challengeLevel
      synthesisMode: $synthesisMode
      formContext: $formContext
    ) {
      aiResponse
      providerUsed
      fieldSuggestions
      autofillCandidates
    }
  }
`;

interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
}

type ChallengeLevel = 'light' | 'standard' | 'expert';

interface MaieuticAIResponse {
  teaching_note?: string;
  reasoning?: string;
  socratic_question?: string;
  answer_template?: string;
  completion_check?: Partial<MaieuticCompletionCheck>;
  field_suggestions?: Record<string, string>;
  autofill_candidates?: MaieuticAutofillCandidates;
  robustness_recommendation?: {
    level: number;
    source_type: string;
    confidence: string;
  };
  error?: string;
}

interface MaieuticQuestionResponse {
  maieuticQuestion: {
    aiResponse: MaieuticAIResponse | string;
    providerUsed: string;
    fieldSuggestions?: string;
    autofillCandidates?: string;
  };
}

interface MaieuticEngineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (output: MaieuticOutput, selections: MaieuticImportSelections) => void | Promise<void>;
  submitLabel?: string;
}

const STEPS: MaieuticStep[] = ['Hypothesis', 'Interrogation', 'Robustness', 'Playbook', 'Review'];

const stepMap: Record<MaieuticStep, string> = {
  Hypothesis: 'hypothesis',
  Interrogation: 'interrogation',
  Robustness: 'robustness',
  Playbook: 'playbook',
  Review: 'review',
};

const stepKickoffPrompts: Record<MaieuticStep, string> = {
  Hypothesis:
    'Kick off Hypothesis with one Socratic question that narrows intent, behavior, mechanism, and environment scope.',
  Interrogation:
    'Kick off Interrogation with one Socratic question that forces field-level evidence and benign lookalike differentiation.',
  Robustness:
    'Kick off Robustness with one Socratic question that challenges detection invariance under attacker evasion.',
  Playbook:
    'Kick off Playbook with one Socratic question that separates human triage decisions from automatable actions.',
  Review:
    'Kick off Review with one Socratic question that validates test evidence, coverage delta, and operational readiness.',
};

const defaultCompletion = (nextBestAction: string): MaieuticCompletionCheck => ({
  step_ready: false,
  quality_score: 0,
  missing_items: [],
  next_best_action: nextBestAction,
});

const initialCompletionState = (): Record<MaieuticStep, MaieuticCompletionCheck> => ({
  Hypothesis: defaultCompletion('Define intent and capability first.'),
  Interrogation: defaultCompletion('Add at least one high-quality Q&A entry.'),
  Robustness: defaultCompletion('Quantify data quality, false positives, coverage, and justification.'),
  Playbook: defaultCompletion('Design manual and/or SOAR response path.'),
  Review: defaultCompletion('Complete all prior stages, then validate deployment readiness.'),
});

const initialAutoKickoffState = (): Record<MaieuticStep, boolean> => ({
  Hypothesis: false,
  Interrogation: false,
  Robustness: false,
  Playbook: false,
  Review: false,
});

const initialAutofillCandidates: MaieuticAutofillCandidates = {
  target_fields: [],
  proposed_text: {},
};

const safeParseJson = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const normalizeChallengeLevel = (level: string): ChallengeLevel => {
  if (level === 'light' || level === 'expert') return level;
  return 'standard';
};

export const MaieuticEngineModal: React.FC<MaieuticEngineModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  submitLabel,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const currentStep = STEPS[currentStepIndex];

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

  const [robustnessRecommendation, setRobustnessRecommendation] = useState<{
    level: number;
    source_type: string;
    confidence: string;
  } | undefined>(undefined);

  const [fieldSuggestions, setFieldSuggestions] = useState<Record<string, string>>({});

  const [selections, setSelections] = useState<MaieuticImportSelections>({
    importHypothesis: true,
    importQALog: true,
    importRobustness: true,
    importPlaybook: true,
    importDetectionRule: true,
    importSynthesis: true,
  });

  const [qaQuestion, setQaQuestion] = useState('');
  const [qaAnswer, setQaAnswer] = useState('');

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [challengeLevel, setChallengeLevel] = useState<ChallengeLevel>('standard');

  const [teachingNote, setTeachingNote] = useState('');
  const [reasoning, setReasoning] = useState('');
  const [answerTemplate, setAnswerTemplate] = useState('');
  const [completionChecks, setCompletionChecks] = useState<Record<MaieuticStep, MaieuticCompletionCheck>>(
    initialCompletionState,
  );
  const [lastAutofillCandidates, setLastAutofillCandidates] = useState<MaieuticAutofillCandidates>(
    initialAutofillCandidates,
  );
  const [autoKickoffDone, setAutoKickoffDone] = useState<Record<MaieuticStep, boolean>>(
    initialAutoKickoffState,
  );
  const [synthesis, setSynthesis] = useState<MaieuticSynthesisOutput>({});
  const [synthesisLoading, setSynthesisLoading] = useState(false);

  const [askAI] = useMutation<MaieuticQuestionResponse>(MAIEUTIC_QUESTION_MUTATION);

  const buildLocalCompletion = useCallback(
    (step: MaieuticStep): MaieuticCompletionCheck => {
      switch (step) {
        case 'Hypothesis': {
          const missing: string[] = [];
          if (!hypothesis.intent.trim()) missing.push('intent');
          if (!hypothesis.capability.trim()) missing.push('capability');
          const score = Math.round(((2 - missing.length) / 2) * 100);
          return {
            step_ready: missing.length === 0 && score >= 75,
            quality_score: score,
            missing_items: missing,
            next_best_action: missing.length > 0 ? `Complete: ${missing[0]}` : 'Hypothesis is structurally complete.',
          };
        }
        case 'Interrogation': {
          const hasOne = qaLog.length > 0;
          return {
            step_ready: hasOne,
            quality_score: hasOne ? 80 : 0,
            missing_items: hasOne ? [] : ['qa_log'],
            next_best_action: hasOne ? 'Interrogation has enough baseline evidence.' : 'Add at least one rigorous Q&A entry.',
          };
        }
        case 'Robustness': {
          const checks = [
            robustness.dataQuality.trim() !== '',
            robustness.falsePositiveRate.trim() !== '',
            robustness.coverage.trim() !== '',
            robustness.justification.trim() !== '',
          ];
          const missing = ['data_quality', 'false_positive_rate', 'coverage_gaps', 'justification'].filter(
            (_, idx) => !checks[idx],
          );
          const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
          return {
            step_ready: missing.length === 0 && score >= 75,
            quality_score: score,
            missing_items: missing,
            next_best_action: missing.length > 0 ? `Complete: ${missing[0]}` : 'Robustness inputs are present.',
          };
        }
        case 'Playbook': {
          const hasPlaybook = playbookDesign.manualSteps.trim() !== '' || playbookDesign.soarPlaybook.trim() !== '';
          return {
            step_ready: hasPlaybook,
            quality_score: hasPlaybook ? 80 : 0,
            missing_items: hasPlaybook ? [] : ['playbook_content'],
            next_best_action: hasPlaybook
              ? 'Playbook has baseline response coverage.'
              : 'Add manual or SOAR response content.',
          };
        }
        case 'Review': {
          const priorStepsReady =
            hypothesis.intent.trim() !== '' &&
            hypothesis.capability.trim() !== '' &&
            qaLog.length > 0 &&
            robustness.dataQuality.trim() !== '' &&
            robustness.falsePositiveRate.trim() !== '' &&
            robustness.coverage.trim() !== '' &&
            robustness.justification.trim() !== '' &&
            (playbookDesign.manualSteps.trim() !== '' || playbookDesign.soarPlaybook.trim() !== '');
          const missing: string[] = [];
          if (!priorStepsReady) missing.push('complete_prior_stages');
          return {
            step_ready: priorStepsReady,
            quality_score: priorStepsReady ? 85 : 40,
            missing_items: missing,
            next_best_action: priorStepsReady
              ? 'Review is ready. Validate final evidence and submit.'
              : 'Complete all previous stages first.',
          };
        }
        default:
          return defaultCompletion('Continue refining the current step.');
      }
    },
    [hypothesis, qaLog, robustness, playbookDesign],
  );

  const mergeCompletion = useCallback(
    (step: MaieuticStep, raw?: Partial<MaieuticCompletionCheck>): MaieuticCompletionCheck => {
      const fallback = buildLocalCompletion(step);
      if (!raw || typeof raw !== 'object') return fallback;
      const rawMissing = raw.missing_items;
      const missingItems = Array.isArray(rawMissing)
        ? rawMissing.map((item) => String(item).trim()).filter(Boolean)
        : fallback.missing_items;
      const rawScore = Number(raw.quality_score);
      const quality = Number.isFinite(rawScore) ? Math.max(0, Math.min(100, Math.round(rawScore))) : fallback.quality_score;
      const stepReady = missingItems.length > 0 ? false : Boolean(raw.step_ready);
      return {
        step_ready: stepReady,
        quality_score: stepReady && quality < 75 ? 75 : quality,
        missing_items: missingItems,
        next_best_action:
          typeof raw.next_best_action === 'string' && raw.next_best_action.trim()
            ? raw.next_best_action.trim()
            : fallback.next_best_action,
      };
    },
    [buildLocalCompletion],
  );

  const currentCompletion = useMemo(
    () => mergeCompletion(currentStep, completionChecks[currentStep]),
    [currentStep, completionChecks, mergeCompletion],
  );

  const buildFormContext = useCallback(() => {
    return {
      hypothesis: {
        intent: hypothesis.intent,
        capability: hypothesis.capability,
      },
      interrogation: qaLog,
      robustness: {
        dataQuality: robustness.dataQuality,
        falsePositiveRate: robustness.falsePositiveRate,
        coverage: robustness.coverage,
        justification: robustness.justification,
      },
      playbook: {
        manualSteps: playbookDesign.manualSteps,
        soarPlaybook: playbookDesign.soarPlaybook,
      },
      detectionRule: {
        format: detectionRule.format,
        rule: detectionRule.rule,
      },
      synthesis,
    };
  }, [hypothesis, qaLog, robustness, playbookDesign, detectionRule, synthesis]);

  const hasRequiredFields = useCallback(
    (step: MaieuticStep): boolean => {
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
          return true;
        default:
          return false;
      }
    },
    [hypothesis, qaLog, robustness, playbookDesign],
  );

  const isStepReady = useCallback(
    (step: MaieuticStep): boolean => {
      if (step === 'Review') {
        return ['Hypothesis', 'Interrogation', 'Robustness', 'Playbook'].every((s) =>
          hasRequiredFields(s as MaieuticStep) && mergeCompletion(s as MaieuticStep, completionChecks[s as MaieuticStep]).step_ready,
        );
      }
      return hasRequiredFields(step) && mergeCompletion(step, completionChecks[step]).step_ready;
    },
    [hasRequiredFields, mergeCompletion, completionChecks],
  );

  const maxUnlockedStepIndex = useMemo(() => {
    let unlocked = 0;
    for (let i = 0; i < STEPS.length - 1; i += 1) {
      if (isStepReady(STEPS[i])) {
        unlocked = i + 1;
      } else {
        break;
      }
    }
    return unlocked;
  }, [isStepReady]);

  const canProceedFromCurrentStep = useMemo(() => {
    if (currentStep === 'Review') {
      return isStepReady('Review');
    }
    return isStepReady(currentStep);
  }, [currentStep, isStepReady]);

  const setCompletionForStep = useCallback(
    (step: MaieuticStep, raw?: Partial<MaieuticCompletionCheck>) => {
      setCompletionChecks((prev) => ({
        ...prev,
        [step]: mergeCompletion(step, raw),
      }));
    },
    [mergeCompletion],
  );

  const buildHistoryPairs = useCallback((messages: ChatMessage[]) => {
    const pairs: Array<{ user: string; ai: string }> = [];
    let pendingUser = '';
    messages.forEach((msg) => {
      if (msg.role === 'user') {
        if (pendingUser) {
          pairs.push({ user: pendingUser, ai: '' });
        }
        pendingUser = msg.content;
      } else if (pendingUser) {
        pairs.push({ user: pendingUser, ai: msg.content });
        pendingUser = '';
      } else {
        pairs.push({ user: '', ai: msg.content });
      }
    });
    if (pendingUser) {
      pairs.push({ user: pendingUser, ai: '' });
    }
    return pairs;
  }, []);

  const toStringArray = useCallback((value: unknown): string[] | undefined => {
    if (Array.isArray(value)) {
      const values = value.map((item) => String(item).trim()).filter(Boolean);
      return values.length > 0 ? values : undefined;
    }
    if (typeof value === 'string' && value.trim()) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          const values = parsed.map((item) => String(item).trim()).filter(Boolean);
          return values.length > 0 ? values : undefined;
        }
      } catch {
        return [value.trim()];
      }
      return [value.trim()];
    }
    return undefined;
  }, []);

  const toObject = useCallback((value: unknown): Record<string, unknown> | undefined => {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
    if (typeof value === 'string' && value.trim()) {
      try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        return undefined;
      }
    }
    return undefined;
  }, []);

  const applySynthesisDraft = useCallback(
    (proposedText: Record<string, unknown>) => {
      setSynthesis((prev) => {
        const next: MaieuticSynthesisOutput = { ...prev };
        for (const [field, rawValue] of Object.entries(proposedText)) {
          switch (field) {
            case 'triage_guidance':
            case 'test_scenario':
            case 'test_expected_output':
            case 'alert_trigger':
            case 'default_severity': {
              if (typeof rawValue === 'string' && rawValue.trim()) {
                (next as Record<string, unknown>)[field] = rawValue.trim();
              }
              break;
            }
            case 'enrichment_steps': {
              const values = toStringArray(rawValue);
              if (values) next.enrichment_steps = values;
              break;
            }
            case 'containment_steps': {
              const values = toStringArray(rawValue);
              if (values) next.containment_steps = values;
              break;
            }
            case 'notification_steps': {
              const values = toStringArray(rawValue);
              if (values) next.notification_steps = values;
              break;
            }
            case 'downstream_correlation_requirements': {
              const obj = toObject(rawValue);
              if (obj) next.downstream_correlation_requirements = obj;
              break;
            }
            default:
              break;
          }
        }
        return next;
      });
    },
    [toObject, toStringArray],
  );

  const applyAutofillCandidate = useCallback(
    (field: string, value: unknown) => {
      const text = typeof value === 'string' ? value.trim() : '';

      switch (field) {
        case 'intent':
          if (text) setHypothesis((prev) => ({ ...prev, intent: text }));
          return;
        case 'capability':
          if (text) setHypothesis((prev) => ({ ...prev, capability: text }));
          return;
        case 'data_quality':
        case 'dataQuality':
          if (text) setRobustness((prev) => ({ ...prev, dataQuality: text }));
          return;
        case 'false_positive_rate':
        case 'falsePositiveRate':
          if (text) setRobustness((prev) => ({ ...prev, falsePositiveRate: text }));
          return;
        case 'coverage_gaps':
        case 'coverage':
          if (text) setRobustness((prev) => ({ ...prev, coverage: text }));
          return;
        case 'justification':
          if (text) setRobustness((prev) => ({ ...prev, justification: text }));
          return;
        case 'manual_steps':
        case 'manualSteps':
          if (text) setPlaybookDesign((prev) => ({ ...prev, manualSteps: text }));
          return;
        case 'soar_playbook':
        case 'soarPlaybook':
          if (text) setPlaybookDesign((prev) => ({ ...prev, soarPlaybook: text }));
          return;
        case 'detection_rule':
        case 'rule':
          if (text) setDetectionRule((prev) => ({ ...prev, rule: text }));
          return;
        case 'data_source':
          if (text) {
            if (!qaQuestion.trim()) {
              setQaQuestion('Which data source best captures this behavior?');
            }
            setQaAnswer((prev) => (prev ? `${prev}\n${text}` : text));
          }
          return;
        case 'mechanism':
          if (text) {
            if (!qaQuestion.trim()) {
              setQaQuestion('What mechanism distinguishes malicious from benign activity?');
            }
            setQaAnswer((prev) => (prev ? `${prev}\n${text}` : text));
          }
          return;
        default:
          applySynthesisDraft({ [field]: value });
      }
    },
    [qaQuestion, applySynthesisDraft],
  );

  const parseAutofillCandidates = useCallback((raw: unknown): MaieuticAutofillCandidates => {
    const parsed = safeParseJson(raw);
    if (!parsed || typeof parsed !== 'object') return initialAutofillCandidates;

    const obj = parsed as Record<string, unknown>;
    const rawTargets = obj.target_fields ?? obj.targetFields;
    const targetFields = Array.isArray(rawTargets)
      ? rawTargets.map((item) => String(item).trim()).filter(Boolean)
      : [];

    const rawProposed = obj.proposed_text ?? obj.proposedText;
    const proposedText =
      rawProposed && typeof rawProposed === 'object' && !Array.isArray(rawProposed)
        ? (rawProposed as Record<string, unknown>)
        : {};

    return {
      target_fields: targetFields,
      proposed_text: proposedText,
    };
  }, []);

  const requestFieldHelp = useCallback((fieldName: string) => {
    const helpPrompts: Record<string, string> = {
      intent: 'I need help with the detection intent field. What should I focus on?',
      capability: 'I need help defining technical capability. What exactly should I specify?',
      dataQuality: 'I need help assessing data quality and telemetry reliability.',
      falsePositiveRate: 'I need help estimating false positive rate and tuning expectations.',
      coverage: 'I need help identifying coverage gaps and blind spots.',
      justification: 'I need help writing a strong robustness justification.',
      manualSteps: 'I need help designing manual triage and investigation steps.',
      soarPlaybook: 'I need help designing the automated SOAR workflow.',
    };
    setChatInput(helpPrompts[fieldName] || `Help me with the ${fieldName} field.`);
  }, []);

  const handleAskAI = useCallback(
    async (options?: {
      prefillMessage?: string;
      autoKickoff?: boolean;
      synthesisMode?: boolean;
      persistUserMessage?: boolean;
    }) => {
      if (aiLoading) return;

      const messageFromInput = options?.prefillMessage ?? chatInput.trim();
      const userMessage = (messageFromInput || '').trim();
      if (!userMessage) return;

      const persistUserMessage = options?.persistUserMessage ?? true;
      const step = currentStep;

      if (!options?.prefillMessage) {
        setChatInput('');
      }

      const newMessages = persistUserMessage
        ? [...chatMessages, { role: 'user' as const, content: userMessage }]
        : [...chatMessages];
      setChatMessages(newMessages);
      setAiLoading(true);

      try {
        const history = buildHistoryPairs(newMessages);
        const result = await askAI({
          variables: {
            userInput: userMessage,
            conversationHistory: JSON.stringify(history),
            currentStep: stepMap[step],
            challengeLevel,
            synthesisMode: Boolean(options?.synthesisMode),
            formContext: JSON.stringify(buildFormContext()),
          },
        });

        const rawAiResponse = result.data?.maieuticQuestion?.aiResponse;
        const parsedAiResponse = safeParseJson(rawAiResponse) as MaieuticAIResponse | string;
        const aiResponse: MaieuticAIResponse =
          parsedAiResponse && typeof parsedAiResponse === 'object'
            ? (parsedAiResponse as MaieuticAIResponse)
            : { socratic_question: String(parsedAiResponse || '') };

        const rawFieldSuggestions = result.data?.maieuticQuestion?.fieldSuggestions;
        const parsedFieldSuggestions = safeParseJson(rawFieldSuggestions);
        if (parsedFieldSuggestions && typeof parsedFieldSuggestions === 'object' && !Array.isArray(parsedFieldSuggestions)) {
          const normalized = Object.fromEntries(
            Object.entries(parsedFieldSuggestions as Record<string, unknown>)
              .filter(([, val]) => typeof val === 'string' && val.trim())
              .map(([k, val]) => [k, (val as string).trim()]),
          );
          setFieldSuggestions((prev) => ({ ...prev, ...normalized }));
        }

        const responseFieldSuggestions = aiResponse.field_suggestions;
        if (responseFieldSuggestions && typeof responseFieldSuggestions === 'object') {
          const normalized = Object.fromEntries(
            Object.entries(responseFieldSuggestions)
              .filter(([, val]) => typeof val === 'string' && val.trim())
              .map(([k, val]) => [k, val.trim()]),
          );
          setFieldSuggestions((prev) => ({ ...prev, ...normalized }));
        }

        const externalAutofill = parseAutofillCandidates(result.data?.maieuticQuestion?.autofillCandidates);
        const responseAutofill = parseAutofillCandidates(aiResponse.autofill_candidates);
        const mergedAutofill: MaieuticAutofillCandidates = {
          target_fields: [
            ...new Set([...(externalAutofill.target_fields || []), ...(responseAutofill.target_fields || [])]),
          ],
          proposed_text: {
            ...(externalAutofill.proposed_text || {}),
            ...(responseAutofill.proposed_text || {}),
          },
        };
        setLastAutofillCandidates(mergedAutofill);

        if (options?.synthesisMode && mergedAutofill.proposed_text) {
          applySynthesisDraft(mergedAutofill.proposed_text);
        }

        const rec = aiResponse.robustness_recommendation;
        if (rec && step === 'Robustness') {
          const normalizedRec = {
            level: Math.max(1, Math.min(5, Number(rec.level) || 3)),
            source_type: String(rec.source_type || 'APPLICATION')
              .toUpperCase()
              .replace('-', '_')
              .replace(' ', '_'),
            confidence: String(rec.confidence || 'medium').toLowerCase(),
          };
          setRobustnessRecommendation(normalizedRec);
        }

        setTeachingNote((aiResponse.teaching_note || '').trim());
        setReasoning((aiResponse.reasoning || '').trim());
        setAnswerTemplate((aiResponse.answer_template || '').trim());
        setCompletionForStep(step, aiResponse.completion_check);

        const aiQuestion =
          aiResponse.socratic_question || aiResponse.error || 'What specific behavior should we clarify next?';
        setChatMessages([...newMessages, { role: 'ai' as const, content: aiQuestion }]);

        if (options?.autoKickoff) {
          setAutoKickoffDone((prev) => ({ ...prev, [step]: true }));
        }
      } catch (error: any) {
        const errorMessage = error?.message || error?.graphQLErrors?.[0]?.message || 'Unknown error occurred';
        setChatMessages([
          ...newMessages,
          {
            role: 'ai' as const,
            content: `I encountered an error: ${errorMessage}. Please continue manually or try again.`,
          },
        ]);
      } finally {
        setAiLoading(false);
      }
    },
    [
      aiLoading,
      chatInput,
      currentStep,
      chatMessages,
      buildHistoryPairs,
      askAI,
      challengeLevel,
      buildFormContext,
      parseAutofillCandidates,
      applySynthesisDraft,
      setCompletionForStep,
    ],
  );

  const handleSynthesizeReview = useCallback(async () => {
    if (currentStep !== 'Review') return;
    setSynthesisLoading(true);
    try {
      await handleAskAI({
        prefillMessage:
          'Synthesize missing Workbench sections from all prior Maieutic answers. Return autofill candidates for triage guidance, test scenario, test expected output, alert trigger, severity, enrichment, containment, notifications, and downstream correlation requirements.',
        synthesisMode: true,
        persistUserMessage: true,
      });
    } finally {
      setSynthesisLoading(false);
    }
  }, [currentStep, handleAskAI]);

  useEffect(() => {
    if (!isOpen || aiLoading) return;
    if (autoKickoffDone[currentStep]) return;

    setAutoKickoffDone((prev) => ({ ...prev, [currentStep]: true }));
    void handleAskAI({
      prefillMessage: stepKickoffPrompts[currentStep],
      autoKickoff: true,
      persistUserMessage: false,
    });
  }, [isOpen, aiLoading, currentStep, autoKickoffDone, handleAskAI]);

  const handleNext = () => {
    if (!canProceedFromCurrentStep) return;
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
    if (!isStepReady('Review')) return;

    const output: MaieuticOutput = {
      hypothesis,
      qaLog,
      robustness,
      playbookDesign,
      detectionRule,
      robustnessRecommendation,
      conversationHistory: chatMessages,
      synthesis,
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
      importSynthesis: true,
    });
    setQaQuestion('');
    setQaAnswer('');
    setChatMessages([]);
    setChatInput('');
    setChallengeLevel('standard');
    setTeachingNote('');
    setReasoning('');
    setAnswerTemplate('');
    setCompletionChecks(initialCompletionState());
    setLastAutofillCandidates(initialAutofillCandidates);
    setAutoKickoffDone(initialAutoKickoffState());
    setSynthesis({});
    setSynthesisLoading(false);
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

  const dismissFieldSuggestion = (field: string) => {
    setFieldSuggestions((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const challengeNow = () => {
    setChallengeLevel('expert');
    void handleAskAI({
      prefillMessage: 'Challenge my current assumptions at expert depth and identify the largest detection design gap.',
      persistUserMessage: true,
    });
  };

  const renderFieldSuggestion = (fieldKey: string) => {
    const text = fieldSuggestions[fieldKey];
    if (!text) return null;
    return (
      <div className="mt-2 p-3 bg-blue-50 border-l-4 border-blue-500 text-sm">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <strong className="text-blue-800">AI Hint:</strong>
            <p className="text-gray-700 mt-1">{text}</p>
          </div>
          <div className="flex gap-1 ml-2">
            <button
              onClick={() => applyAutofillCandidate(fieldKey, text)}
              className="text-xs px-2 py-1 rounded bg-blue-100 hover:bg-blue-200 text-blue-800"
              title="Apply suggestion"
              type="button"
            >
              Apply
            </button>
            <button
              onClick={() => dismissFieldSuggestion(fieldKey)}
              className="text-gray-400 hover:text-gray-600"
              title="Dismiss hint"
              type="button"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderAIChat = () => {
    const progressWidth = `${Math.max(0, Math.min(100, currentCompletion.quality_score))}%`;

    return (
      <div className="maieutic-chat-shell mt-4 border rounded-lg p-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h4 className="font-medium mb-0 flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
              <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
            </svg>
            AI Socratic Assistant 2.0
          </h4>
          <div className="flex items-center gap-2 text-xs">
            <label htmlFor="challenge-level" className="font-medium text-gray-700">
              Challenge
            </label>
            <select
              id="challenge-level"
              className="border rounded px-2 py-1"
              value={challengeLevel}
              onChange={(e) => setChallengeLevel(normalizeChallengeLevel(e.target.value))}
              disabled={aiLoading}
            >
              <option value="light">Light</option>
              <option value="standard">Standard</option>
              <option value="expert">Expert</option>
            </select>
          </div>
        </div>

        <div className="maieutic-chat-info mb-2 mt-2 text-xs p-2 rounded">
          <strong>AI can see:</strong> all current form values. It asks one focused Socratic question and scores stage readiness.
        </div>

        <div className="mb-3 p-3 border border-gray-200 rounded bg-gray-50">
          <div className="flex items-center justify-between mb-2 text-xs">
            <span className="font-semibold text-gray-700">Step Readiness</span>
            <span
              className={`font-semibold ${currentCompletion.step_ready ? 'text-green-700' : 'text-amber-700'}`}
            >
              {currentCompletion.quality_score}% {currentCompletion.step_ready ? 'Ready' : 'Needs work'}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded h-2 mb-2">
            <div
              className={`h-2 rounded ${currentCompletion.step_ready ? 'bg-green-500' : 'bg-amber-500'}`}
              style={{ width: progressWidth }}
            />
          </div>
          {currentCompletion.missing_items.length > 0 && (
            <p className="text-xs text-gray-700 mb-1">
              Missing: {currentCompletion.missing_items.join(', ')}
            </p>
          )}
          <p className="text-xs text-gray-600">Next action: {currentCompletion.next_best_action}</p>
        </div>

        {(teachingNote || reasoning || answerTemplate) && (
          <div className="mb-3 p-3 border border-indigo-200 rounded bg-indigo-50 text-sm">
            {teachingNote && (
              <p className="text-indigo-900">
                <strong>Teaching note:</strong> {teachingNote}
              </p>
            )}
            {reasoning && (
              <p className="text-indigo-800 mt-1">
                <strong>Why this matters:</strong> {reasoning}
              </p>
            )}
            {answerTemplate && (
              <p className="text-indigo-800 mt-1">
                <strong>Answer template:</strong> {answerTemplate}
              </p>
            )}
          </div>
        )}

        {Object.keys(lastAutofillCandidates.proposed_text || {}).length > 0 && (
          <div className="mb-3 p-3 border border-blue-200 rounded bg-blue-50">
            <p className="text-xs font-semibold text-blue-900 mb-2">AI Draft Candidates</p>
            <div className="space-y-2">
              {Object.entries(lastAutofillCandidates.proposed_text).map(([field, value]) => (
                <div key={field} className="flex items-start justify-between gap-2">
                  <div className="text-xs text-blue-900 flex-1 min-w-0">
                    <p className="font-semibold">{field}</p>
                    <p className="text-blue-800 break-words">{typeof value === 'string' ? value : JSON.stringify(value)}</p>
                  </div>
                  <Button
                    variant="secondary"
                    className="text-xs"
                    onClick={() => applyAutofillCandidate(field, value)}
                    type="button"
                  >
                    Apply
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {chatMessages.length > 0 && (
          <div className="mb-3 max-h-40 overflow-y-auto space-y-2">
            {chatMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`p-2 rounded text-sm ${
                  msg.role === 'user' ? 'maieutic-chat-msg-user ml-4' : 'maieutic-chat-msg-ai mr-4'
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
            placeholder="Answer the Socratic question, ask for critique, or request a hint..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void handleAskAI()}
            disabled={aiLoading}
          />
          <Button
            onClick={() => void handleAskAI()}
            variant="primary"
            disabled={aiLoading || !chatInput.trim()}
            className="text-xs"
          >
            {aiLoading ? 'Thinking...' : 'Ask AI'}
          </Button>
          <Button onClick={challengeNow} variant="secondary" className="text-xs" disabled={aiLoading}>
            Challenge
          </Button>
        </div>
        <p className="text-xs mt-1" style={{ color: 'var(--hef-text-secondary)' }}>
          Tip: Ask "Is my current step ready?" to get strict completion feedback.
        </p>
      </div>
    );
  };

  const renderSynthesisPreview = () => {
    const keys = Object.keys(synthesis || {});
    if (keys.length === 0) {
      return (
        <p className="text-sm text-gray-500">
          No synthesized content yet. Use "Synthesize Missing Sections" to generate missing Workbench sections.
        </p>
      );
    }

    return (
      <div className="space-y-2 text-sm">
        {Object.entries(synthesis).map(([key, value]) => (
          <div key={key} className="p-2 rounded border border-gray-200 bg-gray-50">
            <p className="font-semibold text-gray-700">{key}</p>
            <p className="text-gray-700 break-words">{typeof value === 'string' ? value : JSON.stringify(value)}</p>
          </div>
        ))}
      </div>
    );
  };

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
                  Get AI hint
                </button>
              </label>
              <textarea
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="What adversary behavior or capability are you trying to detect?"
                value={hypothesis.intent}
                onChange={(e) => setHypothesis({ ...hypothesis, intent: e.target.value })}
              />
              {renderFieldSuggestion('intent')}
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
                  Get AI hint
                </button>
              </label>
              <textarea
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="What technical capability or technique is being targeted?"
                value={hypothesis.capability}
                onChange={(e) => setHypothesis({ ...hypothesis, capability: e.target.value })}
              />
              {renderFieldSuggestion('capability')}
            </div>
            {renderAIChat()}
          </div>
        );

      case 'Interrogation':
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Document hypothesis interrogation through Q&A. At least one entry is required.
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
                        type="button"
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
                  Get AI hint
                </button>
              </label>
              <textarea
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                placeholder="Assess reliability and completeness of data sources..."
                value={robustness.dataQuality}
                onChange={(e) => setRobustness({ ...robustness, dataQuality: e.target.value })}
              />
              {renderFieldSuggestion('data_quality')}
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
                  Get AI hint
                </button>
              </label>
              <textarea
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                placeholder="Expected false positive rate and justification..."
                value={robustness.falsePositiveRate}
                onChange={(e) => setRobustness({ ...robustness, falsePositiveRate: e.target.value })}
              />
              {renderFieldSuggestion('false_positive_rate')}
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
                  Get AI hint
                </button>
              </label>
              <textarea
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                placeholder="Coverage gaps and known blind spots..."
                value={robustness.coverage}
                onChange={(e) => setRobustness({ ...robustness, coverage: e.target.value })}
              />
              {renderFieldSuggestion('coverage_gaps')}
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
                  Get AI hint
                </button>
              </label>
              <textarea
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Overall robustness reasoning..."
                value={robustness.justification}
                onChange={(e) => setRobustness({ ...robustness, justification: e.target.value })}
              />
              {renderFieldSuggestion('justification')}
              {robustnessRecommendation && (
                <div className="mt-2 p-2 rounded bg-green-50 border border-green-200 text-sm text-green-800">
                  AI robustness recommendation: Level {robustnessRecommendation.level}/5, source type{' '}
                  {robustnessRecommendation.source_type}, confidence {robustnessRecommendation.confidence}.
                </div>
              )}
            </div>
            {renderAIChat()}
          </div>
        );

      case 'Playbook':
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">At least one playbook section (Manual or SOAR) must have content.</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Manual Investigation Steps
                <button
                  type="button"
                  onClick={() => requestFieldHelp('manualSteps')}
                  className="ml-2 text-blue-600 hover:text-blue-800 text-xs"
                  title="Ask AI for guidance on this field"
                >
                  Get AI hint
                </button>
              </label>
              <textarea
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={5}
                placeholder="Manual investigation and response steps..."
                value={playbookDesign.manualSteps}
                onChange={(e) => setPlaybookDesign({ ...playbookDesign, manualSteps: e.target.value })}
              />
              {renderFieldSuggestion('manual_steps')}
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
                  Get AI hint
                </button>
              </label>
              <textarea
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={5}
                placeholder="Automated SOAR playbook content..."
                value={playbookDesign.soarPlaybook}
                onChange={(e) => setPlaybookDesign({ ...playbookDesign, soarPlaybook: e.target.value })}
              />
              {renderFieldSuggestion('soar_playbook')}
            </div>

            <div className="pt-4 border-t border-gray-200">
              <h4 className="font-medium text-gray-700 mb-3">Detection Rule</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rule Format</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Detection Rule</label>
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
              Choose which parts to import into the Workbench. All sections are selected by default.
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
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selections.importSynthesis}
                  onChange={(e) => setSelections({ ...selections, importSynthesis: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Import AI Synthesis (SOAR/testing/triage extras)</span>
              </label>
            </div>

            <div className="p-3 border border-sky-200 rounded bg-sky-50">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-sky-900">Maieutic 2.0 Synthesis</p>
                <Button
                  variant="secondary"
                  className="text-xs"
                  disabled={synthesisLoading || aiLoading}
                  onClick={handleSynthesizeReview}
                >
                  {synthesisLoading ? 'Synthesizing...' : 'Synthesize Missing Sections'}
                </Button>
              </div>
              {renderSynthesisPreview()}
            </div>

            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> This will stage selected data for review. You can apply it to Workbench fields after
                closing this modal. Changes are not auto-saved.
              </p>
            </div>
            {renderAIChat()}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Maieutic Engine 2.0" size="4xl">
      <div className="maieutic-modal space-y-4">
        <div className="flex items-center justify-between border-b border-gray-200 pb-3">
          <div className="flex items-center gap-2">
            {STEPS.map((step, idx) => {
              const isCurrent = idx === currentStepIndex;
              const isDone = idx < currentStepIndex && isStepReady(STEPS[idx]);
              const isFutureLocked = idx > maxUnlockedStepIndex;

              return (
                <React.Fragment key={step}>
                  <button
                    onClick={() => {
                      if (idx <= maxUnlockedStepIndex) {
                        setCurrentStepIndex(idx);
                      }
                    }}
                    className={`px-3 py-1 text-sm rounded ${
                      isCurrent
                        ? 'bg-blue-600 text-white'
                        : isDone
                        ? 'bg-green-100 text-green-700'
                        : isFutureLocked
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                    disabled={isFutureLocked}
                    title={
                      isFutureLocked
                        ? 'Complete previous stage with AI readiness to unlock this step.'
                        : `Open ${step}`
                    }
                    type="button"
                  >
                    {step}
                  </button>
                  {idx < STEPS.length - 1 && <span className="text-gray-400">→</span>}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        <div className="min-h-[400px] max-h-[60vh] overflow-y-auto">{renderStepContent()}</div>

        <div className="flex justify-between items-center pt-4 border-t border-gray-200">
          <div>
            {currentStepIndex > 0 && (
              <Button onClick={handleBack} variant="secondary">
                Back
              </Button>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            {currentStep !== 'Review' ? (
              <Button
                onClick={handleNext}
                variant="primary"
                disabled={!canProceedFromCurrentStep}
                title={
                  canProceedFromCurrentStep
                    ? 'Proceed to next step'
                    : 'Complete required fields and pass AI readiness for this step'
                }
              >
                Next
              </Button>
            ) : (
              <Button onClick={handleSubmit} variant="primary" disabled={!isStepReady('Review')}>
                {submitLabel || 'Submit to Workbench'}
              </Button>
            )}
            {!canProceedFromCurrentStep && (
              <p className="text-xs text-amber-700">Complete required fields and satisfy AI readiness to continue.</p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
