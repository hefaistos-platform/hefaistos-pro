/**
 * PlatformCredentials settings page.
 *
 * Allows organisation admins to configure, save, and test API credentials
 * for each supported SIEM/EDR platform (Microsoft Defender, Azure Sentinel,
 * Splunk, IBM QRadar, Wazuh).  Credentials are stored encrypted on the backend.
 */

import React, { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
  Tooltip,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { App } from 'antd';
import { useMutation, useQuery } from '@apollo/client';
import {
  GET_PLATFORM_CREDENTIALS,
  SET_PLATFORM_CREDENTIAL,
  DELETE_PLATFORM_CREDENTIAL,
  TEST_PLATFORM_CONNECTION,
  PlatformCredential,
} from '../../graphql/deployment';

const { Title, Text } = Typography;

// ---------------------------------------------------------------------------
// Platform metadata
// ---------------------------------------------------------------------------

interface PlatformMeta {
  key: string;
  label: string;
  icon: string;
  fields: FieldDef[];
}

interface FieldDef {
  name: string;
  label: string;
  placeholder?: string;
  secret?: boolean;
  required?: boolean;
  type?: string;
}

const PLATFORMS: PlatformMeta[] = [
  {
    key: 'defender',
    label: 'Microsoft Defender for Endpoint',
    icon: '🛡️',
    fields: [
      { name: 'tenant_id', label: 'Azure Tenant ID', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', required: true },
      { name: 'client_id', label: 'Application (Client) ID', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', required: true },
      { name: 'client_secret', label: 'Client Secret', secret: true, required: true },
    ],
  },
  {
    key: 'sentinel',
    label: 'Azure Sentinel',
    icon: '🔵',
    fields: [
      { name: 'tenant_id', label: 'Tenant ID', required: true },
      { name: 'client_id', label: 'Client ID', required: true },
      { name: 'client_secret', label: 'Client Secret', secret: true, required: true },
      { name: 'subscription_id', label: 'Subscription ID', required: true },
      { name: 'resource_group', label: 'Resource Group', placeholder: 'e.g., rg-sentinel-prod', required: true },
      { name: 'workspace_name', label: 'Log Analytics Workspace', placeholder: 'e.g., sentinel-workspace-prod', required: true },
    ],
  },
  {
    key: 'splunk',
    label: 'Splunk Enterprise',
    icon: '🟢',
    fields: [
      { name: 'splunk_url', label: 'Splunk URL', placeholder: 'https://splunk.example.com:8089', required: true },
      { name: 'username', label: 'Username', required: true },
      { name: 'password', label: 'Password', secret: true, required: true },
      { name: 'alert_email', label: 'Alert Email (Optional)', placeholder: 'soc@example.com', type: 'email' },
    ],
  },
  {
    key: 'qradar',
    label: 'IBM QRadar',
    icon: '🟣',
    fields: [
      { name: 'qradar_url', label: 'QRadar Console URL', placeholder: 'https://qradar.example.com', required: true },
      { name: 'sec_token', label: 'SEC Token', placeholder: 'Enter SEC authorization token', secret: true, required: true },
    ],
  },
  {
    key: 'wazuh',
    label: 'Wazuh Manager',
    icon: '🟠',
    fields: [
      { name: 'wazuh_url', label: 'Wazuh API URL', placeholder: 'https://wazuh.example.com:55000', required: true },
      { name: 'username', label: 'Username', required: true },
      { name: 'password', label: 'Password', secret: true, required: true },
    ],
  },
];

// ---------------------------------------------------------------------------
// Single platform card
// ---------------------------------------------------------------------------

interface PlatformCardProps {
  meta: PlatformMeta;
  credential?: PlatformCredential;
  onSave: (platform: string, values: Record<string, unknown>) => Promise<void>;
  onTest: (platform: string) => Promise<void>;
  onDelete: (platform: string) => Promise<void>;
  testing: boolean;
  saving: boolean;
}

const PlatformCard: React.FC<PlatformCardProps> = ({
  meta,
  credential,
  onSave,
  onTest,
  onDelete,
  testing,
  saving,
}) => {
  const [form] = Form.useForm();

  const statusIcon = credential?.testStatus === true
    ? <CheckCircleOutlined style={{ color: '#52c41a' }} />
    : credential?.testStatus === false
      ? <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
      : null;

  const cardTitle = (
    <Space>
      <span>{meta.icon}</span>
      <span>{meta.label}</span>
      {statusIcon}
      {credential?.hasCredentials && (
        <Tag color="blue" style={{ fontSize: 11 }}>Configured</Tag>
      )}
      {credential?.enabled && credential?.hasCredentials && (
        <Tag color="green" style={{ fontSize: 11 }}>Enabled</Tag>
      )}
    </Space>
  );

  const handleFinish = (values: Record<string, unknown>) => {
    onSave(meta.key, values);
  };

  return (
    <Card title={cardTitle} style={{ marginBottom: 16 }}>
      {credential?.lastTested && (
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
          Last tested: {new Date(credential.lastTested).toLocaleString()}
          {credential.testMessage && ` — ${credential.testMessage}`}
        </Text>
      )}

      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        initialValues={{ enabled: credential?.enabled ?? true }}
      >
        <Form.Item name="enabled" label="Enable for deployment" valuePropName="checked">
          <Switch />
        </Form.Item>

        {meta.fields.map((f) => (
          <Form.Item
            key={f.name}
            name={f.name}
            label={f.label}
            rules={f.required ? [{ required: true, message: `${f.label} is required` }] : []}
          >
            {f.secret ? (
              <Input.Password placeholder={f.placeholder || (credential?.hasCredentials ? '(stored - enter to replace)' : '')} />
            ) : (
              <Input placeholder={f.placeholder} type={f.type} />
            )}
          </Form.Item>
        ))}

        <Space>
          <Button type="primary" htmlType="submit" loading={saving}>
            Save {meta.label} Config
          </Button>
          <Button
            onClick={() => onTest(meta.key)}
            loading={testing}
            disabled={!credential?.hasCredentials}
          >
            Test Connection
          </Button>
          {credential?.hasCredentials && (
            <Tooltip title="Remove stored credentials">
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={() => onDelete(meta.key)}
              >
                Remove
              </Button>
            </Tooltip>
          )}
        </Space>
      </Form>
    </Card>
  );
};

// ---------------------------------------------------------------------------
// Main PlatformCredentials page
// ---------------------------------------------------------------------------

const PlatformCredentials: React.FC = () => {
  const { message } = App.useApp();

  const { data, loading, refetch } = useQuery<{ platformCredentials: PlatformCredential[] }>(
    GET_PLATFORM_CREDENTIALS,
    { fetchPolicy: 'cache-and-network' },
  );

  const [setPlatformCredential] = useMutation(SET_PLATFORM_CREDENTIAL);
  const [deletePlatformCredential] = useMutation(DELETE_PLATFORM_CREDENTIAL);
  const [testPlatformConnection] = useMutation(TEST_PLATFORM_CONNECTION);

  const [testingPlatform, setTestingPlatform] = useState<string | null>(null);
  const [savingPlatform, setSavingPlatform] = useState<string | null>(null);

  const credMap = new Map<string, PlatformCredential>(
    (data?.platformCredentials ?? []).map((c) => [c.platform, c]),
  );

  const handleSave = async (platform: string, values: Record<string, unknown>) => {
    const { enabled, ...credFields } = values as { enabled: boolean; [k: string]: unknown };

    // Filter out empty/blank credential fields so we don't overwrite stored values with blanks
    const filteredCreds = Object.fromEntries(
      Object.entries(credFields).filter(([, v]) => v != null && v !== ''),
    );

    setSavingPlatform(platform);
    try {
      const result = await setPlatformCredential({
        variables: {
          platform,
          credentials: JSON.stringify(filteredCreds),
          enabled: enabled ?? true,
        },
      });

      if (result.data?.setPlatformCredential?.success) {
        message.success('Credentials saved successfully');
        refetch();
      } else {
        message.error(result.data?.setPlatformCredential?.message || 'Save failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save credentials';
      message.error(msg);
    } finally {
      setSavingPlatform(null);
    }
  };

  const handleTest = async (platform: string) => {
    setTestingPlatform(platform);
    try {
      const result = await testPlatformConnection({ variables: { platform } });
      if (result.data?.testPlatformConnection?.success) {
        message.success('Connection successful!');
      } else {
        message.error(result.data?.testPlatformConnection?.message || 'Connection failed');
      }
      refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection test failed';
      message.error(msg);
    } finally {
      setTestingPlatform(null);
    }
  };

  const handleDelete = async (platform: string) => {
    try {
      const result = await deletePlatformCredential({ variables: { platform } });
      if (result.data?.deletePlatformCredential?.success) {
        message.success('Credentials removed');
        refetch();
      } else {
        message.error(result.data?.deletePlatformCredential?.message || 'Delete failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to remove credentials';
      message.error(msg);
    }
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '48px auto' }} />;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 0' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ marginBottom: 4 }}>Platform Credentials</Title>
        <Text type="secondary">
          Configure API credentials for SIEM/EDR platform integrations. Credentials are encrypted at rest.
        </Text>
      </div>

      <Alert
        message="Security Notice"
        description="Credentials are encrypted using AES-256 (Fernet) and stored securely. Never share API keys or tokens."
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      {PLATFORMS.map((meta) => (
        <PlatformCard
          key={meta.key}
          meta={meta}
          credential={credMap.get(meta.key)}
          onSave={handleSave}
          onTest={handleTest}
          onDelete={handleDelete}
          testing={testingPlatform === meta.key}
          saving={savingPlatform === meta.key}
        />
      ))}
    </div>
  );
};

export default PlatformCredentials;
