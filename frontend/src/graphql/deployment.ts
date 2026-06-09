/**
 * GraphQL queries and mutations for OpenTide rule deployment.
 *
 * Provides:
 * - DEPLOY_OPENTIDE_RULE mutation – deploy a rule to one or more SIEM/EDR platforms
 * - GET_PLATFORM_CREDENTIALS query – list configured platform credentials
 * - SET_PLATFORM_CREDENTIAL mutation – add / update platform credentials
 * - DELETE_PLATFORM_CREDENTIAL mutation – remove platform credentials
 */

import { gql } from '@apollo/client';

// ---------------------------------------------------------------------------
// Deployment mutation
// ---------------------------------------------------------------------------

export const DEPLOY_OPENTIDE_RULE = gql`
  mutation DeployOpenTideRule($ruleId: UUID!, $platforms: [String]!) {
    deployOpenTideRule(ruleId: $ruleId, platforms: $platforms) {
      success
      message
      results {
        platform
        success
        ruleId
        message
        errors
      }
    }
  }
`;

// ---------------------------------------------------------------------------
// Platform credential management
// ---------------------------------------------------------------------------

export const GET_PLATFORM_CREDENTIALS = gql`
  query GetPlatformCredentials {
    platformCredentials {
      id
      platform
      platformDisplay
      enabled
      hasCredentials
      lastTested
      testStatus
      testMessage
      createdAt
      updatedAt
    }
  }
`;

export const SET_PLATFORM_CREDENTIAL = gql`
  mutation SetPlatformCredential(
    $platform: String!
    $credentials: JSONString!
    $enabled: Boolean
  ) {
    setPlatformCredential(
      platform: $platform
      credentials: $credentials
      enabled: $enabled
    ) {
      success
      message
      credential {
        id
        platform
        platformDisplay
        enabled
        updatedAt
      }
    }
  }
`;

export const DELETE_PLATFORM_CREDENTIAL = gql`
  mutation DeletePlatformCredential($platform: String!) {
    deletePlatformCredential(platform: $platform) {
      success
      message
    }
  }
`;

export const TEST_PLATFORM_CONNECTION = gql`
  mutation TestPlatformConnection($platform: String!) {
    testPlatformConnection(platform: $platform) {
      success
      message
    }
  }
`;

// ---------------------------------------------------------------------------
// TypeScript interfaces
// ---------------------------------------------------------------------------

export interface PlatformDeploymentResult {
  platform: string;
  success: boolean;
  ruleId: string | null;
  message: string;
  errors: string[];
}

export interface DeployOpenTideRuleResult {
  success: boolean;
  message: string;
  results: PlatformDeploymentResult[];
}

export interface PlatformCredential {
  id: string;
  platform: string;
  platformDisplay: string;
  enabled: boolean;
  hasCredentials: boolean;
  lastTested?: string | null;
  testStatus?: boolean | null;
  testMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SetPlatformCredentialResult {
  success: boolean;
  message: string;
  credential: PlatformCredential | null;
}

export interface DeletePlatformCredentialResult {
  success: boolean;
  message: string;
}

export interface TestPlatformConnectionResult {
  success: boolean;
  message: string;
}
