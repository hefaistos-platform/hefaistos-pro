import React, { useEffect, useMemo, useState } from 'react';
import {
  Card,
  Typography,
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Space,
  Popconfirm,
  message,
  Tag,
  Tabs,
  Select,
  Drawer,
  Divider,
  Switch,
  Alert,
  Row,
  Col,
  Statistic,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  BankOutlined,
  TeamOutlined,
  ArrowRightOutlined,
  ExclamationCircleOutlined,
  MailOutlined,
  RobotOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';

const { Title, Text, Paragraph } = Typography;

const SYSTEM_SHARED_SMTP_NAME = 'System Shared SMTP';
const SYSTEM_SHARED_AI_NAME = 'System Shared AI';

// --- GraphQL Queries ---
const ALL_ORGANIZATIONS = gql`
  query AllOrganizations {
    allOrganizations {
      id
      name
      maxUsers
      memberCount
      smtpSharedEnabled
      aiSharedEnabled
      createdAt
      updatedAt
      entity {
        id
        name
      }
    }
  }
`;

const ORGANIZATION_WITH_MEMBERS = gql`
  query Organization($id: UUID!) {
    organization(id: $id) {
      id
      name
      members {
        id
        email
        username
        role
      }
    }
  }
`;

const ALL_ENTITIES = gql`
  query AllEntities {
    allEntities {
      id
      name
      organizationCount
      createdAt
    }
  }
`;

const GET_SHARED_SMTP_PROFILES = gql`
  query GetSharedSmtpProfiles($includeInactive: Boolean) {
    sharedSmtpProfiles(includeInactive: $includeInactive) {
      id
      name
      smtpServer
      smtpPort
      encryption
      loginMethod
      smtpUsername
      hasPassword
      fromEmail
      isActive
      updatedAt
    }
  }
`;

const GET_SHARED_AI_PROFILES = gql`
  query GetSharedAiProfiles($includeInactive: Boolean) {
    sharedAiProfiles(includeInactive: $includeInactive) {
      id
      name
      ollamaBaseUrl
      ollamaModel
      orgPreferredModel
      azureOpenaiEndpoint
      azureOpenaiDeployment
      ollamaEnabled
      openaiEnabled
      geminiEnabled
      claudeEnabled
      azureOpenaiEnabled
      hasOllama
      hasOpenai
      hasGemini
      hasClaude
      hasAzureOpenai
      hasAnyProvider
      isActive
      updatedAt
    }
  }
`;

const GET_PLATFORM_STATS = gql`
  query GetPlatformStats($inactivityDays: Int) {
    platformStats(inactivityDays: $inactivityDays) {
      generatedAt
      inactivityDays
      globalKpis {
        organizations
        users
        rulesTotal
        activeRules
        workbenchesTotal
        deployedWorkbenches
        l1Entries
        orgsWithSharedAi
        orgsWithSharedSmtp
        orgsWithCustomAi
        orgsWithCustomSmtp
        orgsNearUserCapacity
        orgsWithoutAdmin
      }
      organizations {
        organizationId
        organizationName
        maxUsers
        memberCount
        userUtilizationPercent
        adminCount
        rulesTotal
        activeRules
        workbenchesTotal
        deployedWorkbenches
        l1Entries
        aiSharedEnabled
        smtpSharedEnabled
        lastActivityAt
      }
      alerts {
        severity
        category
        organizationId
        organizationName
        message
      }
    }
  }
`;

// --- GraphQL Mutations ---
const CREATE_ORGANIZATION = gql`
  mutation CreateOrganization($name: String!, $entityId: UUID, $maxUsers: Int) {
    createOrganization(name: $name, entityId: $entityId, maxUsers: $maxUsers) {
      success
      message
      organization {
        id
        name
        maxUsers
      }
    }
  }
`;

const UPDATE_ORGANIZATION = gql`
  mutation UpdateOrganization($id: UUID!, $name: String, $entityId: UUID, $maxUsers: Int) {
    updateOrganization(id: $id, name: $name, entityId: $entityId, maxUsers: $maxUsers) {
      success
      message
      organization {
        id
        name
        maxUsers
      }
    }
  }
`;

const DELETE_ORGANIZATION = gql`
  mutation DeleteOrganization($id: UUID!) {
    deleteOrganization(id: $id) {
      success
      message
    }
  }
`;

const CREATE_ENTITY = gql`
  mutation CreateEntity($name: String!) {
    createEntity(name: $name) {
      success
      message
      entity {
        id
        name
      }
    }
  }
`;

const DELETE_ENTITY = gql`
  mutation DeleteEntity($id: UUID!) {
    deleteEntity(id: $id) {
      success
      message
    }
  }
`;

const SET_ORGANIZATION_SHARED_FLAGS = gql`
  mutation SetOrganizationSharedFlags(
    $organizationIds: [UUID!]!
    $smtpSharedEnabled: Boolean
    $aiSharedEnabled: Boolean
  ) {
    setOrganizationSharedFlags(
      organizationIds: $organizationIds
      smtpSharedEnabled: $smtpSharedEnabled
      aiSharedEnabled: $aiSharedEnabled
    ) {
      success
      message
      updatedCount
    }
  }
`;

const SET_SHARED_SMTP_PROFILE = gql`
  mutation SetSharedSmtpProfile(
    $id: UUID
    $name: String
    $smtpServer: String!
    $smtpPort: Int!
    $encryption: String!
    $loginMethod: String!
    $smtpUsername: String
    $smtpPassword: String
    $fromEmail: String
    $isActive: Boolean
  ) {
    setSharedSmtpProfile(
      id: $id
      name: $name
      smtpServer: $smtpServer
      smtpPort: $smtpPort
      encryption: $encryption
      loginMethod: $loginMethod
      smtpUsername: $smtpUsername
      smtpPassword: $smtpPassword
      fromEmail: $fromEmail
      isActive: $isActive
    ) {
      success
      message
      profile {
        id
        name
        hasPassword
        updatedAt
      }
    }
  }
`;

const SET_SHARED_AI_PROFILE = gql`
  mutation SetSharedAiProfile(
    $id: UUID
    $name: String
    $ollamaBaseUrl: String
    $ollamaModel: String
    $openaiKey: String
    $geminiKey: String
    $claudeKey: String
    $azureOpenaiEndpoint: String
    $azureOpenaiKey: String
    $azureOpenaiDeployment: String
    $orgPreferredModel: String
    $ollamaEnabled: Boolean
    $openaiEnabled: Boolean
    $geminiEnabled: Boolean
    $claudeEnabled: Boolean
    $azureOpenaiEnabled: Boolean
    $isActive: Boolean
  ) {
    setSharedAiProfile(
      id: $id
      name: $name
      ollamaBaseUrl: $ollamaBaseUrl
      ollamaModel: $ollamaModel
      openaiKey: $openaiKey
      geminiKey: $geminiKey
      claudeKey: $claudeKey
      azureOpenaiEndpoint: $azureOpenaiEndpoint
      azureOpenaiKey: $azureOpenaiKey
      azureOpenaiDeployment: $azureOpenaiDeployment
      orgPreferredModel: $orgPreferredModel
      ollamaEnabled: $ollamaEnabled
      openaiEnabled: $openaiEnabled
      geminiEnabled: $geminiEnabled
      claudeEnabled: $claudeEnabled
      azureOpenaiEnabled: $azureOpenaiEnabled
      isActive: $isActive
    ) {
      ok
      message
      profile {
        id
        name
        hasAnyProvider
        updatedAt
      }
    }
  }
`;

// --- TypeScript Interfaces ---
interface Organization {
  id: string;
  name: string;
  maxUsers?: number | null;
  memberCount: number;
  smtpSharedEnabled?: boolean;
  aiSharedEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
  entity?: {
    id: string;
    name: string;
  } | null;
}

interface Entity {
  id: string;
  name: string;
  organizationCount: number;
  createdAt: string;
}

interface MutationResponse {
  success: boolean;
  message: string;
}

interface CreateOrgData {
  createOrganization: MutationResponse & { organization?: { id: string; name: string; maxUsers?: number | null } };
}

interface UpdateOrgData {
  updateOrganization: MutationResponse & { organization?: { id: string; name: string; maxUsers?: number | null } };
}

interface DeleteOrgData {
  deleteOrganization: MutationResponse;
}

interface CreateEntityData {
  createEntity: MutationResponse & { entity?: { id: string; name: string } };
}

interface DeleteEntityData {
  deleteEntity: MutationResponse;
}

interface AllOrganizationsData {
  allOrganizations: Organization[];
}

interface AllEntitiesData {
  allEntities: Entity[];
}

interface OrganizationMember {
  id: string;
  email: string;
  username: string;
  role: string;
}

interface OrganizationWithMembers {
  id: string;
  name: string;
  members: OrganizationMember[];
}

interface OrganizationMembersData {
  organization: OrganizationWithMembers;
}

interface SharedSmtpProfile {
  id: string;
  name: string;
  smtpServer: string;
  smtpPort: number;
  encryption: 'NONE' | 'SSL' | 'STARTTLS';
  loginMethod: 'PLAIN' | 'LOGIN';
  smtpUsername?: string | null;
  hasPassword?: boolean | null;
  fromEmail?: string | null;
  isActive: boolean;
  updatedAt?: string | null;
}

interface SharedAiProfile {
  id: string;
  name: string;
  ollamaBaseUrl?: string | null;
  ollamaModel?: string | null;
  orgPreferredModel?: string | null;
  azureOpenaiEndpoint?: string | null;
  azureOpenaiDeployment?: string | null;
  ollamaEnabled?: boolean;
  openaiEnabled?: boolean;
  geminiEnabled?: boolean;
  claudeEnabled?: boolean;
  azureOpenaiEnabled?: boolean;
  hasOllama?: boolean;
  hasOpenai?: boolean;
  hasGemini?: boolean;
  hasClaude?: boolean;
  hasAzureOpenai?: boolean;
  hasAnyProvider: boolean;
  isActive: boolean;
  updatedAt?: string | null;
}

interface SetOrganizationSharedFlagsData {
  setOrganizationSharedFlags: {
    success: boolean;
    message: string;
    updatedCount: number;
  };
}

interface PlatformGlobalKpis {
  organizations: number;
  users: number;
  rulesTotal: number;
  activeRules: number;
  workbenchesTotal: number;
  deployedWorkbenches: number;
  l1Entries: number;
  orgsWithSharedAi: number;
  orgsWithSharedSmtp: number;
  orgsWithCustomAi: number;
  orgsWithCustomSmtp: number;
  orgsNearUserCapacity: number;
  orgsWithoutAdmin: number;
}

interface PlatformOrganizationStat {
  organizationId: string;
  organizationName: string;
  maxUsers?: number | null;
  memberCount: number;
  userUtilizationPercent?: number | null;
  adminCount: number;
  rulesTotal: number;
  activeRules: number;
  workbenchesTotal: number;
  deployedWorkbenches: number;
  l1Entries: number;
  aiSharedEnabled: boolean;
  smtpSharedEnabled: boolean;
  lastActivityAt?: string | null;
}

interface PlatformAlertRow {
  severity: string;
  category: string;
  organizationId: string;
  organizationName: string;
  message: string;
}

interface PlatformStatsData {
  platformStats: {
    generatedAt: string;
    inactivityDays: number;
    globalKpis: PlatformGlobalKpis;
    organizations: PlatformOrganizationStat[];
    alerts: PlatformAlertRow[];
  } | null;
}

export const OrganizationsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('organizations');
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
  const [isEntityModalOpen, setIsEntityModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [selectedOrgIds, setSelectedOrgIds] = useState<string[]>([]);
  const [memberDrawerOrg, setMemberDrawerOrg] = useState<Organization | null>(null);
  const [bulkEntityId, setBulkEntityId] = useState<string | undefined>();
  const [togglingOrgIds, setTogglingOrgIds] = useState<string[]>([]);
  const [orgForm] = Form.useForm();
  const [entityForm] = Form.useForm();
  const [smtpForm] = Form.useForm();
  const [aiForm] = Form.useForm();

  // Queries
  const { data: orgData, loading: orgLoading, refetch: refetchOrgs } = useQuery<AllOrganizationsData>(ALL_ORGANIZATIONS);
  const { data: entityData, loading: entityLoading, refetch: refetchEntities } = useQuery<AllEntitiesData>(ALL_ENTITIES);
  const { data: membersData, loading: membersLoading } = useQuery<OrganizationMembersData>(ORGANIZATION_WITH_MEMBERS, {
    variables: { id: memberDrawerOrg?.id },
    skip: !memberDrawerOrg,
    fetchPolicy: 'network-only',
  });
  const { data: sharedSmtpData, loading: loadingSharedSmtp, refetch: refetchSharedSmtp } = useQuery<{ sharedSmtpProfiles: SharedSmtpProfile[] }>(
    GET_SHARED_SMTP_PROFILES,
    { variables: { includeInactive: false }, fetchPolicy: 'cache-and-network' },
  );
  const { data: sharedAiData, loading: loadingSharedAi, refetch: refetchSharedAi } = useQuery<{ sharedAiProfiles: SharedAiProfile[] }>(
    GET_SHARED_AI_PROFILES,
    { variables: { includeInactive: false }, fetchPolicy: 'cache-and-network' },
  );
  const {
    data: platformStatsData,
    loading: platformStatsLoading,
    refetch: refetchPlatformStats,
  } = useQuery<PlatformStatsData>(GET_PLATFORM_STATS, {
    variables: { inactivityDays: 30 },
    fetchPolicy: 'network-only',
    nextFetchPolicy: 'cache-first',
  });

  // Mutations
  const [createOrganization, { loading: createOrgLoading }] = useMutation<CreateOrgData>(CREATE_ORGANIZATION);
  const [updateOrganization, { loading: updateOrgLoading }] = useMutation<UpdateOrgData>(UPDATE_ORGANIZATION);
  const [deleteOrganization] = useMutation<DeleteOrgData>(DELETE_ORGANIZATION);
  const [createEntity, { loading: createEntityLoading }] = useMutation<CreateEntityData>(CREATE_ENTITY);
  const [deleteEntity] = useMutation<DeleteEntityData>(DELETE_ENTITY);
  const [setOrganizationSharedFlags, { loading: savingSharedFlags }] = useMutation<SetOrganizationSharedFlagsData>(SET_ORGANIZATION_SHARED_FLAGS);
  const [setSharedSmtpProfile, { loading: savingSharedSmtpProfile }] = useMutation(SET_SHARED_SMTP_PROFILE);
  const [setSharedAiProfile, { loading: savingSharedAiProfile }] = useMutation(SET_SHARED_AI_PROFILE);

  const smtpProfiles = useMemo(
    () => sharedSmtpData?.sharedSmtpProfiles || [],
    [sharedSmtpData?.sharedSmtpProfiles],
  );
  const aiProfiles = useMemo(
    () => sharedAiData?.sharedAiProfiles || [],
    [sharedAiData?.sharedAiProfiles],
  );

  const primarySmtpProfile = useMemo(() => {
    return smtpProfiles.find((profile) => profile.name.toLowerCase() === SYSTEM_SHARED_SMTP_NAME.toLowerCase())
      || smtpProfiles[0]
      || null;
  }, [smtpProfiles]);

  const primaryAiProfile = useMemo(() => {
    return aiProfiles.find((profile) => profile.name.toLowerCase() === SYSTEM_SHARED_AI_NAME.toLowerCase())
      || aiProfiles[0]
      || null;
  }, [aiProfiles]);

  const smtpLoginMethod = Form.useWatch('loginMethod', smtpForm) || 'PLAIN';
  const platformStats = platformStatsData?.platformStats || null;
  const platformOrgRows = platformStats?.organizations || [];
  const platformAlerts = platformStats?.alerts || [];

  useEffect(() => {
    if (primarySmtpProfile) {
      smtpForm.setFieldsValue({
        smtpServer: primarySmtpProfile.smtpServer || '',
        smtpPort: primarySmtpProfile.smtpPort || 587,
        encryption: primarySmtpProfile.encryption || 'STARTTLS',
        loginMethod: primarySmtpProfile.loginMethod || 'PLAIN',
        smtpUsername: primarySmtpProfile.smtpUsername || '',
        smtpPassword: '',
        fromEmail: primarySmtpProfile.fromEmail || '',
      });
      return;
    }
    smtpForm.setFieldsValue({
      smtpServer: '',
      smtpPort: 587,
      encryption: 'STARTTLS',
      loginMethod: 'PLAIN',
      smtpUsername: '',
      smtpPassword: '',
      fromEmail: '',
    });
  }, [primarySmtpProfile, smtpForm]);

  useEffect(() => {
    aiForm.setFieldsValue({
      ollamaBaseUrl: primaryAiProfile?.ollamaBaseUrl || '',
      ollamaModel: primaryAiProfile?.ollamaModel || '',
      openaiKey: '',
      geminiKey: '',
      claudeKey: '',
      azureOpenaiEndpoint: primaryAiProfile?.azureOpenaiEndpoint || '',
      azureOpenaiKey: '',
      azureOpenaiDeployment: primaryAiProfile?.azureOpenaiDeployment || '',
      orgPreferredModel: primaryAiProfile?.orgPreferredModel || '',
      ollamaEnabled: primaryAiProfile?.ollamaEnabled ?? true,
      openaiEnabled: primaryAiProfile?.openaiEnabled ?? true,
      geminiEnabled: primaryAiProfile?.geminiEnabled ?? true,
      claudeEnabled: primaryAiProfile?.claudeEnabled ?? true,
      azureOpenaiEnabled: primaryAiProfile?.azureOpenaiEnabled ?? true,
    });
  }, [aiForm, primaryAiProfile]);

  const isTogglingOrg = (orgId: string): boolean => togglingOrgIds.includes(orgId);

  const applySharedFlags = async (
    organizationIds: string[],
    flags: { smtpSharedEnabled?: boolean; aiSharedEnabled?: boolean },
  ) => {
    if (!organizationIds.length) {
      message.warning('Select at least one organization.');
      return;
    }

    if (flags.smtpSharedEnabled === true && !primarySmtpProfile) {
      message.error('Shared SMTP profile is not configured. Configure it first in Shared Profiles tab.');
      return;
    }
    if (flags.aiSharedEnabled === true && !primaryAiProfile) {
      message.error('Shared AI profile is not configured. Configure it first in Shared Profiles tab.');
      return;
    }

    setTogglingOrgIds((prev) => Array.from(new Set([...prev, ...organizationIds])));
    try {
      const { data } = await setOrganizationSharedFlags({
        variables: {
          organizationIds,
          smtpSharedEnabled: flags.smtpSharedEnabled,
          aiSharedEnabled: flags.aiSharedEnabled,
        },
      });

      if (data?.setOrganizationSharedFlags?.success) {
        message.success(data.setOrganizationSharedFlags.message || 'Shared policy updated.');
        refetchOrgs();
      } else {
        message.error(data?.setOrganizationSharedFlags?.message || 'Failed to update shared policy.');
      }
    } catch (err: any) {
      message.error(err.message || 'Failed to update shared policy.');
    } finally {
      setTogglingOrgIds((prev) => prev.filter((id) => !organizationIds.includes(id)));
    }
  };

  const handleSaveSharedSmtpProfile = async () => {
    try {
      const values = await smtpForm.validateFields();
      const result = await setSharedSmtpProfile({
        variables: {
          id: primarySmtpProfile?.id,
          name: primarySmtpProfile?.name || SYSTEM_SHARED_SMTP_NAME,
          smtpServer: values.smtpServer,
          smtpPort: Number(values.smtpPort),
          encryption: values.encryption,
          loginMethod: values.loginMethod,
          smtpUsername: values.loginMethod === 'LOGIN' ? (values.smtpUsername || null) : null,
          smtpPassword: values.loginMethod === 'LOGIN'
            ? ((values.smtpPassword && String(values.smtpPassword).trim()) ? values.smtpPassword : null)
            : null,
          fromEmail: values.fromEmail || null,
          isActive: true,
        },
      });

      if (result.data?.setSharedSmtpProfile?.success) {
        message.success(result.data.setSharedSmtpProfile.message || 'Shared SMTP profile saved.');
        smtpForm.setFieldsValue({ smtpPassword: '' });
        refetchSharedSmtp();
      } else {
        message.error(result.data?.setSharedSmtpProfile?.message || 'Failed to save shared SMTP profile.');
      }
    } catch (err: any) {
      if (err?.errorFields) {
        return;
      }
      message.error(err.message || 'Failed to save shared SMTP profile.');
    }
  };

  const handleSaveSharedAiProfile = async () => {
    try {
      const values = await aiForm.validateFields();
      const result = await setSharedAiProfile({
        variables: {
          id: primaryAiProfile?.id,
          name: primaryAiProfile?.name || SYSTEM_SHARED_AI_NAME,
          ollamaBaseUrl: values.ollamaBaseUrl || null,
          ollamaModel: values.ollamaModel || null,
          openaiKey: values.openaiKey || undefined,
          geminiKey: values.geminiKey || undefined,
          claudeKey: values.claudeKey || undefined,
          azureOpenaiEndpoint: values.azureOpenaiEndpoint || null,
          azureOpenaiKey: values.azureOpenaiKey || undefined,
          azureOpenaiDeployment: values.azureOpenaiDeployment || null,
          orgPreferredModel: values.orgPreferredModel || null,
          ollamaEnabled: values.ollamaEnabled,
          openaiEnabled: values.openaiEnabled,
          geminiEnabled: values.geminiEnabled,
          claudeEnabled: values.claudeEnabled,
          azureOpenaiEnabled: values.azureOpenaiEnabled,
          isActive: true,
        },
      });

      if (result.data?.setSharedAiProfile?.ok) {
        message.success(result.data.setSharedAiProfile.message || 'Shared AI profile saved.');
        aiForm.setFieldsValue({ openaiKey: '', geminiKey: '', claudeKey: '', azureOpenaiKey: '' });
        refetchSharedAi();
      } else {
        message.error(result.data?.setSharedAiProfile?.message || 'Failed to save shared AI profile.');
      }
    } catch (err: any) {
      if (err?.errorFields) {
        return;
      }
      message.error(err.message || 'Failed to save shared AI profile.');
    }
  };

  // --- Organization handlers ---
  const handleCreateOrg = () => {
    setEditingOrg(null);
    orgForm.resetFields();
    setIsOrgModalOpen(true);
  };

  const handleEditOrg = (org: Organization) => {
    setEditingOrg(org);
    orgForm.setFieldsValue({ name: org.name, entityId: org.entity?.id, maxUsers: org.maxUsers ?? null });
    setIsOrgModalOpen(true);
  };

  const handleMoveOrg = async (orgId: string, entityId?: string | null) => {
    try {
      const { data } = await updateOrganization({ variables: { id: orgId, entityId: entityId || null } });
      if (data?.updateOrganization?.success) {
        message.success('Organization moved');
        refetchOrgs();
      } else {
        message.error(data?.updateOrganization?.message || 'Failed to move organization');
      }
    } catch (err: any) {
      message.error(err.message || 'Failed to move organization');
    }
  };

  const handleBulkMove = async () => {
    if (!selectedOrgIds.length || !bulkEntityId) {
      message.warning('Select organizations and target entity');
      return;
    }
    await Promise.all(selectedOrgIds.map((id) => handleMoveOrg(id, bulkEntityId)));
    setBulkEntityId(undefined);
    setSelectedOrgIds([]);
  };

  const handleOrgSubmit = async () => {
    try {
      const values = await orgForm.validateFields();

      const entityId = values.entityId || null;
      const maxUsers = values.maxUsers ?? null;

      if (editingOrg) {
        const { data } = await updateOrganization({
          variables: { id: editingOrg.id, name: values.name, entityId, maxUsers },
        });
        if (data?.updateOrganization?.success) {
          message.success('Organization updated successfully');
          setIsOrgModalOpen(false);
          refetchOrgs();
        } else {
          message.error(data?.updateOrganization?.message || 'Failed to update organization');
        }
      } else {
        const { data } = await createOrganization({
          variables: { name: values.name, entityId, maxUsers },
        });
        if (data?.createOrganization?.success) {
          message.success('Organization created successfully');
          setIsOrgModalOpen(false);
          refetchOrgs();
        } else {
          message.error(data?.createOrganization?.message || 'Failed to create organization');
        }
      }
    } catch {
      // form validation errors are shown inline
    }
  };

  const handleDeleteOrg = async (id: string) => {
    try {
      const { data } = await deleteOrganization({ variables: { id } });
      if (data?.deleteOrganization?.success) {
        message.success('Organization deleted successfully');
        refetchOrgs();
      } else {
        message.error(data?.deleteOrganization?.message || 'Failed to delete organization');
      }
    } catch (err: any) {
      message.error(err.message || 'Failed to delete organization');
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedOrgIds.length) {
      message.warning('Select organizations to delete');
      return;
    }
    await Promise.all(selectedOrgIds.map((id) => handleDeleteOrg(id)));
    setSelectedOrgIds([]);
  };

  // --- Entity handlers ---
  const handleCreateEntity = () => {
    entityForm.resetFields();
    setIsEntityModalOpen(true);
  };

  const handleEntitySubmit = async () => {
    try {
      const values = await entityForm.validateFields();
      const { data } = await createEntity({ variables: { name: values.name } });

      if (data?.createEntity?.success) {
        message.success('Entity created successfully');
        setIsEntityModalOpen(false);
        refetchEntities();
      } else {
        message.error(data?.createEntity?.message || 'Failed to create entity');
      }
    } catch {
      // form validation errors are shown inline
    }
  };

  const handleDeleteEntity = async (id: string) => {
    try {
      const { data } = await deleteEntity({ variables: { id } });
      if (data?.deleteEntity?.success) {
        message.success('Entity deleted successfully');
        refetchEntities();
      } else {
        message.error(data?.deleteEntity?.message || 'Failed to delete entity');
      }
    } catch (err: any) {
      message.error(err.message || 'Failed to delete entity');
    }
  };

  // --- Table columns ---
  const orgColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <strong>{name}</strong>,
    },
    {
      title: 'Entity',
      dataIndex: 'entity',
      key: 'entity',
      render: (entity: Organization['entity']) =>
        entity ? <Tag icon={<BankOutlined />} color="blue">{entity.name}</Tag> : <Tag>No Entity</Tag>,
    },
    {
      title: 'Members',
      dataIndex: 'memberCount',
      key: 'memberCount',
      render: (_: number, record: Organization) => (
        <Space size={6}>
          <Button type="link" size="small" icon={<TeamOutlined />} onClick={() => setMemberDrawerOrg(record)}>
            {record.memberCount}
          </Button>
          <Tag color={record.maxUsers != null && record.memberCount >= record.maxUsers ? 'red' : 'default'}>
            {record.memberCount} / {record.maxUsers ?? 'Unlimited'}
          </Tag>
        </Space>
      ),
    },
    {
      title: 'AI Shared',
      dataIndex: 'aiSharedEnabled',
      key: 'aiSharedEnabled',
      render: (enabled: boolean, record: Organization) => (
        <Switch
          checked={Boolean(enabled)}
          size="small"
          loading={isTogglingOrg(record.id)}
          disabled={isTogglingOrg(record.id)}
          onChange={(checked) => applySharedFlags([record.id], { aiSharedEnabled: checked })}
        />
      ),
    },
    {
      title: 'SMTP Shared',
      dataIndex: 'smtpSharedEnabled',
      key: 'smtpSharedEnabled',
      render: (enabled: boolean, record: Organization) => (
        <Switch
          checked={Boolean(enabled)}
          size="small"
          loading={isTogglingOrg(record.id)}
          disabled={isTogglingOrg(record.id)}
          onChange={(checked) => applySharedFlags([record.id], { smtpSharedEnabled: checked })}
        />
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Organization) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEditOrg(record)}
          />
          <Select
            size="small"
            style={{ width: 180 }}
            placeholder="Move to entity"
            allowClear
            options={(entityData?.allEntities || []).map((e) => ({ label: e.name, value: e.id }))}
            onChange={(val) => handleMoveOrg(record.id, val)}
            suffixIcon={<ArrowRightOutlined />}
          />
          <Popconfirm
            title="Delete Organization"
            description={`Are you sure you want to delete "${record.name}"?`}
            onConfirm={() => handleDeleteOrg(record.id)}
            okText="Yes"
            cancelText="No"
            okButtonProps={{ danger: true }}
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const entityColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <strong>{name}</strong>,
    },
    {
      title: 'Organizations',
      dataIndex: 'organizationCount',
      key: 'organizationCount',
      render: (count: number) => <Tag>{count}</Tag>,
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Entity) => (
        <Popconfirm
          title="Delete Entity"
          description={`Are you sure you want to delete "${record.name}"?`}
          onConfirm={() => handleDeleteEntity(record.id)}
          okText="Yes"
          cancelText="No"
          okButtonProps={{ danger: true }}
        >
          <Button type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  const platformColumns = [
    {
      title: 'Organization',
      dataIndex: 'organizationName',
      key: 'organizationName',
      render: (name: string) => <strong>{name}</strong>,
    },
    {
      title: 'Users',
      key: 'users',
      render: (_: unknown, row: PlatformOrganizationStat) => (
        <Space direction="vertical" size={0}>
          <Text>{row.memberCount} / {row.maxUsers ?? 'Unlimited'}</Text>
          <Tag color={row.userUtilizationPercent != null && row.userUtilizationPercent >= 90 ? 'volcano' : 'default'}>
            {row.userUtilizationPercent != null ? `${row.userUtilizationPercent.toFixed(1)}%` : 'n/a'}
          </Tag>
        </Space>
      ),
    },
    {
      title: 'Admins',
      dataIndex: 'adminCount',
      key: 'adminCount',
      render: (count: number) => (
        <Tag color={count > 0 ? 'green' : 'red'}>{count}</Tag>
      ),
    },
    {
      title: 'Rules',
      key: 'rules',
      render: (_: unknown, row: PlatformOrganizationStat) => (
        <Space direction="vertical" size={0}>
          <Text>{row.rulesTotal} total</Text>
          <Text type="secondary">{row.activeRules} active</Text>
        </Space>
      ),
    },
    {
      title: 'Workbenches',
      key: 'workbenches',
      render: (_: unknown, row: PlatformOrganizationStat) => (
        <Space direction="vertical" size={0}>
          <Text>{row.workbenchesTotal} total</Text>
          <Text type="secondary">{row.deployedWorkbenches} deployed</Text>
        </Space>
      ),
    },
    {
      title: 'L1 Entries',
      dataIndex: 'l1Entries',
      key: 'l1Entries',
      render: (count: number) => <Tag>{count}</Tag>,
    },
    {
      title: 'Shared Policy',
      key: 'shared',
      render: (_: unknown, row: PlatformOrganizationStat) => (
        <Space>
          <Tag color={row.aiSharedEnabled ? 'blue' : 'default'}>AI {row.aiSharedEnabled ? 'ON' : 'OFF'}</Tag>
          <Tag color={row.smtpSharedEnabled ? 'blue' : 'default'}>SMTP {row.smtpSharedEnabled ? 'ON' : 'OFF'}</Tag>
        </Space>
      ),
    },
    {
      title: 'Last Activity',
      dataIndex: 'lastActivityAt',
      key: 'lastActivityAt',
      render: (ts?: string | null) => ts ? new Date(ts).toLocaleString() : 'No activity',
    },
  ];

  const tabItems = [
    {
      key: 'organizations',
      label: (
        <span>
          <TeamOutlined /> Organizations ({orgData?.allOrganizations?.length || 0})
        </span>
      ),
      children: (
        <>
          <div style={{ marginBottom: 16, display: 'grid', gap: 12 }}>
            <Space wrap>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateOrg}>
                New Organization
              </Button>
              <Select
                style={{ width: 220 }}
                placeholder="Bulk move to entity"
                allowClear
                options={(entityData?.allEntities || []).map((e) => ({ label: e.name, value: e.id }))}
                value={bulkEntityId}
                onChange={(val) => setBulkEntityId(val)}
              />
              <Button icon={<ArrowRightOutlined />} onClick={handleBulkMove} disabled={!selectedOrgIds.length || !bulkEntityId}>
                Move Selected
              </Button>
              <Popconfirm
                title="Delete selected"
                icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}
                description={`Delete ${selectedOrgIds.length} organization(s)?`}
                onConfirm={handleBulkDelete}
                disabled={!selectedOrgIds.length}
              >
                <Button danger disabled={!selectedOrgIds.length} icon={<DeleteOutlined />}>Delete Selected</Button>
              </Popconfirm>
            </Space>
            <Space wrap>
              <Button
                icon={<RobotOutlined />}
                onClick={() => applySharedFlags(selectedOrgIds, { aiSharedEnabled: true })}
                disabled={!selectedOrgIds.length}
                loading={savingSharedFlags}
              >
                AI ON
              </Button>
              <Button
                onClick={() => applySharedFlags(selectedOrgIds, { aiSharedEnabled: false })}
                disabled={!selectedOrgIds.length}
                loading={savingSharedFlags}
              >
                AI OFF
              </Button>
              <Button
                icon={<MailOutlined />}
                onClick={() => applySharedFlags(selectedOrgIds, { smtpSharedEnabled: true })}
                disabled={!selectedOrgIds.length}
                loading={savingSharedFlags}
              >
                SMTP ON
              </Button>
              <Button
                onClick={() => applySharedFlags(selectedOrgIds, { smtpSharedEnabled: false })}
                disabled={!selectedOrgIds.length}
                loading={savingSharedFlags}
              >
                SMTP OFF
              </Button>
              <Button
                onClick={() => applySharedFlags(selectedOrgIds, { aiSharedEnabled: true, smtpSharedEnabled: true })}
                disabled={!selectedOrgIds.length}
                loading={savingSharedFlags}
              >
                AI+SMTP ON
              </Button>
              <Button
                onClick={() => applySharedFlags(selectedOrgIds, { aiSharedEnabled: false, smtpSharedEnabled: false })}
                disabled={!selectedOrgIds.length}
                loading={savingSharedFlags}
              >
                AI+SMTP OFF
              </Button>
              <Tag>{selectedOrgIds.length} selected</Tag>
            </Space>
          </div>
          <Table
            columns={orgColumns}
            dataSource={orgData?.allOrganizations || []}
            loading={orgLoading}
            rowKey="id"
            rowSelection={{ selectedRowKeys: selectedOrgIds, onChange: (keys) => setSelectedOrgIds(keys as string[]) }}
            pagination={{ pageSize: 10 }}
          />
        </>
      ),
    },
    {
      key: 'shared-profiles',
      label: (
        <span>
          <MailOutlined /> Shared Profiles
        </span>
      ),
      children: (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            Configure one system-wide shared SMTP profile and one system-wide shared AI profile. Then use Organization tab switches to apply ON/OFF per organization.
          </Paragraph>

          {smtpProfiles.length > 1 && (
            <Alert
              type="warning"
              showIcon
              message="Multiple active shared SMTP profiles detected"
              description={`Superuser Mgmt edits ${primarySmtpProfile?.name || SYSTEM_SHARED_SMTP_NAME}. Consider deactivating unused profiles in DB/admin if needed.`}
            />
          )}

          {aiProfiles.length > 1 && (
            <Alert
              type="warning"
              showIcon
              message="Multiple active shared AI profiles detected"
              description={`Superuser Mgmt edits ${primaryAiProfile?.name || SYSTEM_SHARED_AI_NAME}. Consider deactivating unused profiles in DB/admin if needed.`}
            />
          )}

          <Card loading={loadingSharedSmtp} title="Shared SMTP Profile">
            <Paragraph type="secondary">
              Profile name: <Text code>{primarySmtpProfile?.name || SYSTEM_SHARED_SMTP_NAME}</Text>
            </Paragraph>
            <Form form={smtpForm} layout="vertical">
              <Form.Item name="smtpServer" label="SMTP server" rules={[{ required: true, message: 'SMTP server is required' }]}>
                <Input placeholder="smtp.example.com" />
              </Form.Item>
              <Form.Item name="smtpPort" label="SMTP port" rules={[{ required: true, message: 'SMTP port is required' }]}>
                <Input type="number" min={1} max={65535} placeholder="587" />
              </Form.Item>
              <Form.Item name="encryption" label="Encryption" rules={[{ required: true, message: 'Select encryption mode' }]}>
                <Select
                  options={[
                    { value: 'SSL', label: 'SSL' },
                    { value: 'STARTTLS', label: 'STARTTLS' },
                    { value: 'NONE', label: 'None' },
                  ]}
                />
              </Form.Item>
              <Form.Item name="loginMethod" label="Login method" rules={[{ required: true, message: 'Select login method' }]}>
                <Select
                  options={[
                    { value: 'PLAIN', label: 'PLAIN' },
                    { value: 'LOGIN', label: 'LOGIN' },
                  ]}
                />
              </Form.Item>
              <Form.Item
                name="smtpUsername"
                label="SMTP username"
                rules={smtpLoginMethod === 'LOGIN' ? [{ required: true, message: 'SMTP username is required for LOGIN' }] : []}
              >
                <Input placeholder="username or email" />
              </Form.Item>
              <Form.Item
                name="smtpPassword"
                label="SMTP password"
                rules={smtpLoginMethod === 'LOGIN' && !primarySmtpProfile?.hasPassword
                  ? [{ required: true, message: 'SMTP password is required for LOGIN' }]
                  : []}
                extra={primarySmtpProfile?.hasPassword ? 'Leave empty to keep existing password.' : undefined}
              >
                <Input.Password placeholder={primarySmtpProfile?.hasPassword ? '(unchanged)' : 'SMTP password'} />
              </Form.Item>
              <Form.Item name="fromEmail" label="From (optional)" rules={[{ type: 'email', message: 'Enter a valid email address' }]}>
                <Input placeholder="noreply@example.com" />
              </Form.Item>
              <Form.Item style={{ marginBottom: 0 }}>
                <Button type="primary" onClick={handleSaveSharedSmtpProfile} loading={savingSharedSmtpProfile}>
                  Save Shared SMTP Profile
                </Button>
              </Form.Item>
            </Form>
          </Card>

          <Card loading={loadingSharedAi} title="Shared AI Profile">
            <Paragraph type="secondary">
              Profile name: <Text code>{primaryAiProfile?.name || SYSTEM_SHARED_AI_NAME}</Text>
            </Paragraph>
            <Form form={aiForm} layout="vertical">
              <Form.Item name="ollamaBaseUrl" label="Ollama Base URL">
                <Input placeholder="http://ollama:11434" />
              </Form.Item>
              <Form.Item name="ollamaModel" label="Ollama Model">
                <Input placeholder="llama3" />
              </Form.Item>
              <Form.Item name="openaiKey" label="OpenAI API Key">
                <Input.Password placeholder={primaryAiProfile?.hasOpenai ? 'set - enter new value to rotate' : 'sk-...'} />
              </Form.Item>
              <Form.Item name="geminiKey" label="Gemini API Key">
                <Input.Password placeholder={primaryAiProfile?.hasGemini ? 'set - enter new value to rotate' : 'AIza...'} />
              </Form.Item>
              <Form.Item name="claudeKey" label="Claude API Key">
                <Input.Password placeholder={primaryAiProfile?.hasClaude ? 'set - enter new value to rotate' : 'sk-ant-...'} />
              </Form.Item>
              <Form.Item name="azureOpenaiEndpoint" label="Azure OpenAI Endpoint">
                <Input placeholder="https://YOUR_RESOURCE.openai.azure.com" />
              </Form.Item>
              <Form.Item name="azureOpenaiKey" label="Azure OpenAI API Key">
                <Input.Password placeholder={primaryAiProfile?.hasAzureOpenai ? 'set - enter new value to rotate' : 'Azure API key'} />
              </Form.Item>
              <Form.Item name="azureOpenaiDeployment" label="Azure OpenAI Deployment">
                <Input placeholder="gpt-5-deployment" />
              </Form.Item>
              <Form.Item name="orgPreferredModel" label="Default Preferred Model">
                <Select
                  allowClear
                  options={[
                    { value: 'OLLAMA', label: 'OLLAMA' },
                    { value: 'GPT-5.5', label: 'GPT-5.5' },
                    { value: 'GPT-5.4', label: 'GPT-5.4' },
                    { value: 'GEMINI-3.5-FLASH', label: 'GEMINI-3.5-FLASH' },
                    { value: 'CLAUDE-SONNET-4.6', label: 'CLAUDE-SONNET-4.6' },
                    { value: 'AZURE-OPENAI', label: 'AZURE-OPENAI' },
                  ]}
                />
              </Form.Item>
              <Divider />
              <Space wrap>
                <Form.Item name="ollamaEnabled" label="Ollama" valuePropName="checked" style={{ marginBottom: 0 }}>
                  <Switch />
                </Form.Item>
                <Form.Item name="openaiEnabled" label="OpenAI" valuePropName="checked" style={{ marginBottom: 0 }}>
                  <Switch />
                </Form.Item>
                <Form.Item name="geminiEnabled" label="Gemini" valuePropName="checked" style={{ marginBottom: 0 }}>
                  <Switch />
                </Form.Item>
                <Form.Item name="claudeEnabled" label="Claude" valuePropName="checked" style={{ marginBottom: 0 }}>
                  <Switch />
                </Form.Item>
                <Form.Item name="azureOpenaiEnabled" label="Azure OpenAI" valuePropName="checked" style={{ marginBottom: 0 }}>
                  <Switch />
                </Form.Item>
              </Space>
              <Form.Item style={{ marginTop: 16, marginBottom: 0 }}>
                <Button type="primary" onClick={handleSaveSharedAiProfile} loading={savingSharedAiProfile}>
                  Save Shared AI Profile
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Space>
      ),
    },
    {
      key: 'platform-stats',
      label: (
        <span>
          <BarChartOutlined /> Platform stats
        </span>
      ),
      children: (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              System-wide visibility across all organizations. Updated:{' '}
              <Text code>
                {platformStats?.generatedAt ? new Date(platformStats.generatedAt).toLocaleString() : 'n/a'}
              </Text>
            </Paragraph>
            <Button onClick={() => refetchPlatformStats()} loading={platformStatsLoading}>
              Refresh stats
            </Button>
          </Space>

          <Row gutter={[12, 12]}>
            <Col xs={24} sm={12} md={8} lg={6}><Card><Statistic title="Organizations" value={platformStats?.globalKpis.organizations || 0} /></Card></Col>
            <Col xs={24} sm={12} md={8} lg={6}><Card><Statistic title="Users" value={platformStats?.globalKpis.users || 0} /></Card></Col>
            <Col xs={24} sm={12} md={8} lg={6}><Card><Statistic title="Rules" value={platformStats?.globalKpis.rulesTotal || 0} /></Card></Col>
            <Col xs={24} sm={12} md={8} lg={6}><Card><Statistic title="Active Rules" value={platformStats?.globalKpis.activeRules || 0} /></Card></Col>
            <Col xs={24} sm={12} md={8} lg={6}><Card><Statistic title="Workbenches" value={platformStats?.globalKpis.workbenchesTotal || 0} /></Card></Col>
            <Col xs={24} sm={12} md={8} lg={6}><Card><Statistic title="Deployed Workbenches" value={platformStats?.globalKpis.deployedWorkbenches || 0} /></Card></Col>
            <Col xs={24} sm={12} md={8} lg={6}><Card><Statistic title="L1 Entries" value={platformStats?.globalKpis.l1Entries || 0} /></Card></Col>
            <Col xs={24} sm={12} md={8} lg={6}><Card><Statistic title="Near Capacity Orgs" value={platformStats?.globalKpis.orgsNearUserCapacity || 0} /></Card></Col>
          </Row>

          <Row gutter={[12, 12]}>
            <Col xs={24} md={12} lg={6}><Card><Statistic title="Shared AI Orgs" value={platformStats?.globalKpis.orgsWithSharedAi || 0} /></Card></Col>
            <Col xs={24} md={12} lg={6}><Card><Statistic title="Shared SMTP Orgs" value={platformStats?.globalKpis.orgsWithSharedSmtp || 0} /></Card></Col>
            <Col xs={24} md={12} lg={6}><Card><Statistic title="Custom AI Orgs" value={platformStats?.globalKpis.orgsWithCustomAi || 0} /></Card></Col>
            <Col xs={24} md={12} lg={6}><Card><Statistic title="Custom SMTP Orgs" value={platformStats?.globalKpis.orgsWithCustomSmtp || 0} /></Card></Col>
          </Row>

          <Card title="Actionable Alerts" loading={platformStatsLoading}>
            {platformAlerts.length === 0 ? (
              <Alert type="success" showIcon message="No critical platform alerts right now." />
            ) : (
              <Space direction="vertical" style={{ width: '100%' }}>
                {platformAlerts.map((alert, idx) => (
                  <Alert
                    key={`${alert.organizationId}-${alert.category}-${idx}`}
                    type={alert.severity === 'critical' ? 'error' : 'warning'}
                    showIcon
                    message={`${alert.organizationName}: ${alert.message}`}
                    description={`Category: ${alert.category}`}
                  />
                ))}
              </Space>
            )}
          </Card>

          <Card title="Per-Organization Breakdown" loading={platformStatsLoading}>
            <Table<PlatformOrganizationStat>
              rowKey="organizationId"
              columns={platformColumns}
              dataSource={platformOrgRows}
              pagination={{ pageSize: 10 }}
            />
          </Card>
        </Space>
      ),
    },
    {
      key: 'entities',
      label: (
        <span>
          <BankOutlined /> Entities ({entityData?.allEntities?.length || 0})
        </span>
      ),
      children: (
        <>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateEntity}>
              New Entity
            </Button>
          </div>
          <Table
            columns={entityColumns}
            dataSource={entityData?.allEntities || []}
            loading={entityLoading}
            rowKey="id"
            pagination={{ pageSize: 10 }}
          />
        </>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Superuser Management</Title>
      </Space>
      <Paragraph type="secondary" style={{ marginBottom: 16 }}>
        Manage organizations, entities, and centralized shared AI/SMTP profiles. Only superusers have access to this page.
      </Paragraph>

      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />

        {/* Members Drawer */}
        <Drawer
          title={memberDrawerOrg ? `Members of ${memberDrawerOrg.name}` : 'Members'}
          open={!!memberDrawerOrg}
          onClose={() => setMemberDrawerOrg(null)}
          width={420}
        >
          <Paragraph type="secondary">
            Read-only roster. Role changes or invites are managed from the org user admin.
          </Paragraph>
          <Divider />
          {membersLoading ? (
            <div>Loading members...</div>
          ) : (
            <Table
              size="small"
              pagination={false}
              rowKey="id"
              dataSource={membersData?.organization?.members || []}
              columns={[
                { title: 'User', dataIndex: 'username', key: 'username' },
                { title: 'Email', dataIndex: 'email', key: 'email' },
                { title: 'Role', dataIndex: 'role', key: 'role', render: (r: string) => <Tag>{r}</Tag> },
              ]}
            />
          )}
        </Drawer>

        {/* Organization Modal */}
        <Modal
          title={editingOrg ? 'Edit Organization' : 'Create Organization'}
          open={isOrgModalOpen}
          onOk={handleOrgSubmit}
          onCancel={() => setIsOrgModalOpen(false)}
          confirmLoading={createOrgLoading || updateOrgLoading}
        >
          <Form form={orgForm} layout="vertical">
            <Form.Item
              name="name"
              label="Organization Name"
              rules={[{ required: true, message: 'Please enter organization name' }]}
            >
              <Input placeholder="Enter organization name" />
            </Form.Item>
            <Form.Item name="entityId" label="Entity (optional)">
              <Select
                allowClear
                placeholder="Select entity / holding company"
                loading={entityLoading}
                options={(entityData?.allEntities || []).map((e) => ({ label: e.name, value: e.id }))}
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
            <Form.Item
              name="maxUsers"
              label="Maximum Users (optional)"
              extra="Leave empty for unlimited users."
              rules={[{ type: 'number', min: 1, message: 'Maximum users must be at least 1.' }]}
            >
              <InputNumber min={1} style={{ width: '100%' }} placeholder="Unlimited" />
            </Form.Item>
          </Form>
        </Modal>

        {/* Entity Modal */}
        <Modal
          title="Create Entity"
          open={isEntityModalOpen}
          onOk={handleEntitySubmit}
          onCancel={() => setIsEntityModalOpen(false)}
          confirmLoading={createEntityLoading}
        >
          <Form form={entityForm} layout="vertical">
            <Form.Item
              name="name"
              label="Entity Name"
              rules={[{ required: true, message: 'Please enter entity name' }]}
            >
              <Input placeholder="Enter entity/holding company name" />
            </Form.Item>
          </Form>
        </Modal>
      </Card>
    </div>
  );
};
