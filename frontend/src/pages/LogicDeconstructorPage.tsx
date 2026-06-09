import React, { useState } from 'react';
import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';

type DeconstructRuleResult = {
  deconstructRule: {
    report: string;
    providerUsed: string;
    warning?: string | null;
  };
};

const DECONSTRUCT_RULE_MUTATION = gql`
  mutation DeconstructRule($ruleText: String, $ruleUrl: String) {
    deconstructRule(ruleText: $ruleText, ruleUrl: $ruleUrl) {
      report
      providerUsed
      warning
    }
  }
`;

export const LogicDeconstructorPage: React.FC = () => {
  const [ruleText, setRuleText] = useState<string>("");
  const [ruleUrl, setRuleUrl] = useState<string>("");
  const [runDeconstruct, { data, loading, error }] = useMutation<DeconstructRuleResult>(DECONSTRUCT_RULE_MUTATION);
  const [modelSel, setModelSel] = useState<string>("");
  const [updateError, setUpdateError] = useState<string>("");

  type GetAiSettingsResult = {
    myAiSettings: {
      preferredModel: string | null;
      decrypted_openai: boolean;
      decrypted_gemini: boolean;
      decrypted_claude: boolean;
      hasOllama: boolean;
      useOrgAi: boolean;
      effectivePreferredModel: string | null;
    };
  };

  const GET_AI_SETTINGS = gql`
    query GetMyAISettings {
      myAiSettings {
        preferredModel
        decrypted_openai
        decrypted_gemini
        decrypted_claude
        hasOllama
        useOrgAi
        effectivePreferredModel
      }
    }
  `;
  const { data: aiData } = useQuery<GetAiSettingsResult>(GET_AI_SETTINGS, { fetchPolicy: 'cache-and-network' });
  const UPDATE_AI_SETTINGS = gql`
    mutation UpdateAISettings($preferredModel: String) {
      updateAiSettings(preferredModel: $preferredModel) {
        settings { preferredModel }
        warning
      }
    }
  `;
  const [updateAiSettings, { loading: updatingModel }] = useMutation(UPDATE_AI_SETTINGS, {
    refetchQueries: [{ query: GET_AI_SETTINGS }],
  });

  // Sync local selector with server once settings load
  React.useEffect(() => {
    const pm = aiData?.myAiSettings?.effectivePreferredModel || aiData?.myAiSettings?.preferredModel || '';
    setModelSel(pm);
  }, [aiData?.myAiSettings?.effectivePreferredModel, aiData?.myAiSettings?.preferredModel]);

  const handleRun = async () => {
    await runDeconstruct({ variables: { ruleText: ruleText || null, ruleUrl: ruleUrl || null } });
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Detection Logic Deconstructor</h1>
      <p className="text-sm text-gray-600">
        Paste a detection rule or provide a URL. Uses your preferred AI provider.
        <span className="ml-1 text-xs text-gray-500">(AI prompts may be subject to charge)</span>
      </p>

      {/* URL + Model selector row */}
      <div className="flex gap-4 items-end">
        <div className="flex-1 space-y-2">
          <label className="block text-sm font-medium">Rule URL (optional)</label>
          <input
            type="text"
            value={ruleUrl}
            onChange={(e) => setRuleUrl(e.target.value)}
            placeholder="https://..."
            className="w-full border rounded p-2"
          />
        </div>
        <div className="w-full md:w-1/3 space-y-2">
          <label className="block text-sm font-medium">AI Model</label>
          <div className="text-xs text-gray-600 mb-1">
            Your selected Model is {modelSel || 'Not set'}.{aiData?.myAiSettings?.useOrgAi && aiData?.myAiSettings?.hasOllama ? ' (Organizational AI)' : ''} If you like to change it, make your choice here.
          </div>
          <div className="flex items-center gap-2">
            <select
              className="border rounded p-2 text-sm w-full"
              value={modelSel}
              onChange={async (e) => {
                const model = e.target.value;
                setUpdateError("");
                setModelSel(model); // optimistic UI
                try {
                  await updateAiSettings({ variables: { preferredModel: model || undefined } });
                } catch (err: any) {
                  setUpdateError(err?.message || 'Failed to update preferred model');
                }
              }}
            >
              <option value="">Select model</option>
              <option value="GPT-5.5">GPT-5.5</option>
              <option value="GPT-5.4">GPT-5.4</option>
              <option value="GPT-5.4-MINI">GPT-5.4 Mini</option>
              <option value="GEMINI-3.1-PRO-PREVIEW">Gemini 3.1 Pro Preview</option>
              <option value="GEMINI-3.5-FLASH">Gemini 3.5 Flash</option>
              <option value="GEMINI-3-FLASH-PREVIEW">Gemini 3 Flash Preview</option>
              <option value="GEMINI-3.1-FLASH-LITE">Gemini 3.1 Flash Lite</option>
              <option value="GEMINI-3.1-FLASH-LITE-PREVIEW">Gemini 3.1 Flash Lite Preview</option>
              <option value="CLAUDE-OPUS-4.7">Claude Opus 4.7</option>
              <option value="CLAUDE-SONNET-4.6">Claude Sonnet 4.6</option>
              <option value="CLAUDE-HAIKU-4.5-20251001">Claude Haiku 4.5 (20251001)</option>
              {aiData?.myAiSettings?.hasOllama && (() => {
                const orgModel = aiData.myAiSettings!.effectivePreferredModel || '';
                const knownModels = [
                  'GPT-5.5','GPT-5.4','GPT-5.4-MINI',
                  'GEMINI-3.1-PRO-PREVIEW','GEMINI-3.5-FLASH','GEMINI-3-FLASH-PREVIEW',
                  'GEMINI-3.1-FLASH-LITE','GEMINI-3.1-FLASH-LITE-PREVIEW',
                  'CLAUDE-OPUS-4.7','CLAUDE-SONNET-4.6','CLAUDE-HAIKU-4.5-20251001',
                ];
                if (orgModel && !knownModels.includes(orgModel)) {
                  return <option value={orgModel}>{orgModel} (Organizational AI)</option>;
                }
                return null;
              })()}
            </select>
            {updatingModel && <span className="text-xs text-gray-500">Updating...</span>}
          </div>
          {updateError && <div className="text-xs text-red-600 mt-1">{updateError}</div>}
          {aiData?.myAiSettings && (
            <div className="mt-1 text-[11px] text-gray-500">
              Available: [
              {aiData.myAiSettings.decrypted_openai ? 'OpenAI ' : ''}
              {aiData.myAiSettings.decrypted_gemini ? 'Gemini ' : ''}
              {aiData.myAiSettings.decrypted_claude ? 'Claude ' : ''}
              {aiData.myAiSettings.hasOllama ? 'Ollama (Org) ' : ''}
              ]
              {(() => {
                const m = modelSel || '';
                // When org AI (Ollama) is active and the model is the org model, no warning needed
                if (aiData.myAiSettings.hasOllama && aiData.myAiSettings.useOrgAi) {
                  return null;
                }
                const available = {
                  'GPT-5.5': aiData.myAiSettings.decrypted_openai,
                  'GPT-5.4': aiData.myAiSettings.decrypted_openai,
                  'GPT-5.4-MINI': aiData.myAiSettings.decrypted_openai,
                  'GEMINI-3.1-PRO-PREVIEW': aiData.myAiSettings.decrypted_gemini,
                  'GEMINI-3.5-FLASH': aiData.myAiSettings.decrypted_gemini,
                  'GEMINI-3-FLASH-PREVIEW': aiData.myAiSettings.decrypted_gemini,
                  'GEMINI-3.1-FLASH-LITE': aiData.myAiSettings.decrypted_gemini,
                  'GEMINI-3.1-FLASH-LITE-PREVIEW': aiData.myAiSettings.decrypted_gemini,
                  'CLAUDE-OPUS-4.7': aiData.myAiSettings.decrypted_claude,
                  'CLAUDE-SONNET-4.6': aiData.myAiSettings.decrypted_claude,
                  'CLAUDE-HAIKU-4.5-20251001': aiData.myAiSettings.decrypted_claude,
                } as Record<string, boolean>;
                if (m && available[m] === false) {
                  return <span className="ml-1 text-yellow-700">(Selected provider has no key)</span>;
                }
                return null;
              })()}
            </div>
          )}
        </div>
      </div>

      {/* URL moved above alongside model selector */}

      <div className="space-y-2">
        <label className="block text-sm font-medium">Rule Text</label>
        <textarea
          value={ruleText}
          onChange={(e) => setRuleText(e.target.value)}
          rows={12}
          className="w-full border rounded p-2 font-mono"
          placeholder="# Paste detection rule content here (KQL, SPL, WAZUH...)"
        />
      </div>

      <button
        onClick={handleRun}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        {loading ? "Running..." : "Run Deconstruction"}
      </button>

      {error && <div className="text-red-600 text-sm">Error: {error.message}</div>}

      {data?.deconstructRule?.warning && (
        <div className="text-yellow-700 text-sm">Warning: {data.deconstructRule.warning}</div>
      )}

      {data?.deconstructRule?.providerUsed && (
        <div className="text-sm text-gray-700">Provider used: {data.deconstructRule.providerUsed}</div>
      )}

      {data?.deconstructRule?.report && (
        <pre className="whitespace-pre-wrap border rounded p-3 bg-gray-50">{data.deconstructRule.report}</pre>
      )}
    </div>
  );
};
