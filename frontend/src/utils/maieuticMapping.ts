// Utility to map MaieuticOutput into PlaybookWorkbench form state

import { MaieuticOutput, MaieuticImportSelections } from '../types/maieutic';

/**
 * Merges Maieutic Engine output into the workbench form state.
 * Respects partial import selections.
 * 
 * @param maieuticData - The Maieutic output to merge
 * @param selections - Which parts to import
 * @param currentFormState - The existing workbench form state
 * @returns Updated form state with merged Maieutic data
 */
export function applyMaieuticToWorkbench(
  maieuticData: MaieuticOutput,
  selections: MaieuticImportSelections,
  currentFormState: {
    goal?: string;
    technicalContext?: string;
    blindSpots?: string;
    falsePositives?: string;
    responsePlaybook?: string;
    detectionRule?: string;
  }
): {
  goal?: string;
  technicalContext?: string;
  blindSpots?: string;
  falsePositives?: string;
  responsePlaybook?: string;
  detectionRule?: string;
  robustnessLevel?: number;
  dataSourceMaturity?: string;
} {
  const result: {
    goal?: string;
    technicalContext?: string;
    blindSpots?: string;
    falsePositives?: string;
    responsePlaybook?: string;
    detectionRule?: string;
    robustnessLevel?: number;
    dataSourceMaturity?: string;
  } = { ...currentFormState };

  // Extract robustness level and data source maturity from AI recommendation
  if (maieuticData.robustnessRecommendation) {
    result.robustnessLevel = maieuticData.robustnessRecommendation.level;
    result.dataSourceMaturity = maieuticData.robustnessRecommendation.source_type;
  }

  // Import Hypothesis -> goal + technicalContext
  if (selections.importHypothesis) {
    const hypothesisText = `Intent: ${maieuticData.hypothesis.intent}\nCapability: ${maieuticData.hypothesis.capability}`;
    result.goal = result.goal
      ? `${result.goal}\n\n--- Maieutic Hypothesis ---\n${hypothesisText}`
      : hypothesisText;
  }

  // Import QA Log -> technicalContext (append as investigation notes)
  if (selections.importQALog && maieuticData.qaLog.length > 0) {
    const qaText = maieuticData.qaLog
      .map((entry, idx) => `Q${idx + 1}: ${entry.question}\nA${idx + 1}: ${entry.answer}`)
      .join('\n\n');
    result.technicalContext = result.technicalContext
      ? `${result.technicalContext}\n\n--- Maieutic Interrogation Log ---\n${qaText}`
      : qaText;
  }

  // Import Robustness -> blindSpots + falsePositives
  if (selections.importRobustness) {
    const robustnessBlindSpots = `Data Quality: ${maieuticData.robustness.dataQuality}\nCoverage: ${maieuticData.robustness.coverage}\nJustification: ${maieuticData.robustness.justification}`;
    result.blindSpots = result.blindSpots
      ? `${result.blindSpots}\n\n--- Maieutic Robustness ---\n${robustnessBlindSpots}`
      : robustnessBlindSpots;

    const robustnessFP = maieuticData.robustness.falsePositiveRate;
    result.falsePositives = result.falsePositives
      ? `${result.falsePositives}\n\n--- Maieutic FP Analysis ---\n${robustnessFP}`
      : robustnessFP;
  }

  // Import Playbook -> responsePlaybook (concatenate manual + SOAR)
  if (selections.importPlaybook) {
    const sections: string[] = [];
    if (maieuticData.playbookDesign.manualSteps) {
      sections.push(`--- Manual Steps ---\n${maieuticData.playbookDesign.manualSteps}`);
    }
    if (maieuticData.playbookDesign.soarPlaybook) {
      sections.push(`--- SOAR Playbook ---\n${maieuticData.playbookDesign.soarPlaybook}`);
    }
    const playbookText = sections.join('\n\n');
    result.responsePlaybook = result.responsePlaybook
      ? `${result.responsePlaybook}\n\n${playbookText}`
      : playbookText;
  }

  // Import Detection Rule -> detectionRule (format: "format\n---\nrule")
  if (selections.importDetectionRule && maieuticData.detectionRule.rule.trim()) {
    const ruleText = `${maieuticData.detectionRule.format}\n---\n${maieuticData.detectionRule.rule}`;
    result.detectionRule = ruleText; // Overwrite instead of concatenate for detection rules
  }

  return result;
}
