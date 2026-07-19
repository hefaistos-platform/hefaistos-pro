import { OpenTideRule } from '../types/opentide';

export type PlatformTab = 'kql' | 'eql' | 'spl' | 'wazuh' | 'qradar';
export type RuleFormat = 'KQL' | 'EQL' | 'SPL' | 'WAZUH' | 'AQL';

export interface DetectionFormatDefinition {
  id: PlatformTab;
  format: RuleFormat;
  displayName: string;
  fileExtension: string;
  commentSyntax: 'line' | 'xml';
  commentPrefix?: string;
  tabLabel: string;
  tabColor: string;
  tabActiveColor: string;
  getContent: (rule: OpenTideRule) => string;
  setContent: (rule: OpenTideRule, content: string) => OpenTideRule;
}

export const DETECTION_FORMAT_REGISTRY: DetectionFormatDefinition[] = [
  {
    id: 'kql',
    format: 'KQL',
    displayName: 'KQL',
    fileExtension: 'kql',
    commentSyntax: 'line',
    commentPrefix: '//',
    tabLabel: '🔷 KQL',
    tabColor: 'bg-blue-50 text-blue-700 border border-blue-200',
    tabActiveColor: 'bg-blue-600 text-white',
    getContent: (rule) => rule.platforms.kql?.query ?? '',
    setContent: (rule, content) => {
      const hasContent = Boolean(content.trim());
      return {
        ...rule,
        platforms: {
          ...rule.platforms,
          kql: hasContent ? { query: content, data_source: rule.platforms.kql?.data_source } : undefined,
        },
      };
    },
  },
  {
    id: 'eql',
    format: 'EQL',
    displayName: 'Elastic EQL',
    fileExtension: 'eql',
    commentSyntax: 'line',
    commentPrefix: '//',
    tabLabel: '🟡 Elastic EQL',
    tabColor: 'bg-yellow-50 text-yellow-800 border border-yellow-200',
    tabActiveColor: 'bg-yellow-500 text-white',
    getContent: (rule) => rule.platforms.elastic?.query ?? '',
    setContent: (rule, content) => {
      const hasContent = Boolean(content.trim());
      return {
        ...rule,
        platforms: {
          ...rule.platforms,
          elastic: hasContent ? { query: content } : undefined,
        },
      };
    },
  },
  {
    id: 'spl',
    format: 'SPL',
    displayName: 'SPL',
    fileExtension: 'spl',
    commentSyntax: 'line',
    commentPrefix: '#',
    tabLabel: '🟠 SPL',
    tabColor: 'bg-orange-50 text-orange-700 border border-orange-200',
    tabActiveColor: 'bg-orange-500 text-white',
    getContent: (rule) => rule.platforms.spl?.query ?? '',
    setContent: (rule, content) => {
      const hasContent = Boolean(content.trim());
      return {
        ...rule,
        platforms: {
          ...rule.platforms,
          spl: hasContent ? { query: content, index: rule.platforms.spl?.index } : undefined,
        },
      };
    },
  },
  {
    id: 'wazuh',
    format: 'WAZUH',
    displayName: 'WAZUH',
    fileExtension: 'xml',
    commentSyntax: 'xml',
    tabLabel: '🟢 WAZUH',
    tabColor: 'bg-green-50 text-green-700 border border-green-200',
    tabActiveColor: 'bg-green-600 text-white',
    getContent: (rule) => rule.platforms.wazuh?.rule ?? '',
    setContent: (rule, content) => {
      const hasContent = Boolean(content.trim());
      return {
        ...rule,
        platforms: {
          ...rule.platforms,
          wazuh: hasContent ? { rule: content } : undefined,
        },
      };
    },
  },
  {
    id: 'qradar',
    format: 'AQL',
    displayName: 'QRadar',
    fileExtension: 'aql',
    commentSyntax: 'line',
    commentPrefix: '--',
    tabLabel: '🟣 QRadar',
    tabColor: 'bg-purple-50 text-purple-700 border border-purple-200',
    tabActiveColor: 'bg-purple-600 text-white',
    getContent: (rule) => rule.platforms.qradar?.query ?? '',
    setContent: (rule, content) => {
      const hasContent = Boolean(content.trim());
      return {
        ...rule,
        platforms: {
          ...rule.platforms,
          qradar: hasContent ? { query: content, scope: rule.platforms.qradar?.scope } : undefined,
        },
      };
    },
  },
];

export const FORMAT_BY_TAB = Object.fromEntries(
  DETECTION_FORMAT_REGISTRY.map((f) => [f.id, f])
) as Record<PlatformTab, DetectionFormatDefinition>;

export function getFormatByTab(tab: PlatformTab): DetectionFormatDefinition {
  return FORMAT_BY_TAB[tab];
}

export function getFormatByName(format: string): DetectionFormatDefinition | undefined {
  return DETECTION_FORMAT_REGISTRY.find((f) => f.format === format);
}

export function buildSaveButtonLabel(format: Pick<DetectionFormatDefinition, 'displayName'>): string {
  return `SAVE ${format.displayName.toUpperCase()}`;
}
