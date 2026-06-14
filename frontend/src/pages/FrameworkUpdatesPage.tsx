import React, { useState, useEffect, useCallback } from 'react';
import { gql, useMutation, useQuery } from '@apollo/client';
import { Button, Card, Form, Input, Select, Tag, Table, Collapse, Typography, Space, Alert, message } from 'antd';
import { SyncOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { Navigate, useNavigate } from 'react-router-dom';

const { Text, Title } = Typography;
const { Panel } = Collapse;

// ---------------------------------------------------------------------------
// GraphQL
// ---------------------------------------------------------------------------

const LOADED_ATTACK_VERSIONS_QUERY = gql`
  query LoadedAttackVersions {
    loadedAttackVersions {
      framework
      version
      importedAt
    }
  }
`;

const LATEST_AVAILABLE_ATTACK_VERSION_QUERY = gql`
  query LatestAvailableAttackVersion {
    latestAvailableAttackVersion
  }
`;

const MITRE_IMPORT_JOBS_QUERY = gql`
  query MitreImportJobs($limit: Int) {
    mitreImportJobs(limit: $limit) {
      id
      version
      mode
      status
      log
      error
      createdAt
      startedAt
      finishedAt
      durationSeconds
      triggeredBy {
        username
      }
    }
  }
`;

const MITRE_IMPORT_JOB_QUERY = gql`
  query MitreImportJob($id: UUID!) {
    mitreImportJob(id: $id) {
      id
      version
      mode
      status
      log
      error
      createdAt
      startedAt
      finishedAt
      durationSeconds
      triggeredBy {
        username
      }
    }
  }
`;

const RUN_MITRE_IMPORT_MUTATION = gql`
  mutation RunMitreImport($version: String!, $mode: String) {
    runMitreImport(version: $version, mode: $mode) {
      job {
        id
        version
        mode
        status
        createdAt
      }
    }
  }
`;

const ME_QUERY = gql`
  query MeForFramework {
    me {
      id
      role
      isSuperuser
    }
  }
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function semverGt(a: string, b: string): boolean {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na !== nb) return na > nb;
  }
  return false;
}

function statusTag(status: string) {
  switch (status) {
    case 'RUNNING':
      return <Tag icon={<SyncOutlined spin />} color="processing">RUNNING</Tag>;
    case 'SUCCESS':
      return <Tag icon={<CheckCircleOutlined />} color="success">SUCCESS</Tag>;
    case 'FAILED':
      return <Tag icon={<CloseCircleOutlined />} color="error">FAILED</Tag>;
    default:
      return <Tag icon={<ClockCircleOutlined />} color="default">PENDING</Tag>;
  }
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '–';
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

// ---------------------------------------------------------------------------
// Running job poller
// ---------------------------------------------------------------------------

interface JobRecord {
  id: string;
  version: string;
  mode: string;
  status: string;
  log: string;
  error: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationSeconds: number | null;
  triggeredBy: { username: string } | null;
}

function RunningJobPoller({ jobId, onComplete }: { jobId: string; onComplete: (job: JobRecord) => void }) {
  const { data, startPolling, stopPolling } = useQuery(MITRE_IMPORT_JOB_QUERY, {
    variables: { id: jobId },
    fetchPolicy: 'network-only',
  });

  useEffect(() => {
    startPolling(3000);
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  const job: JobRecord | null = data?.mitreImportJob ?? null;

  useEffect(() => {
    if (job && job.status !== 'PENDING' && job.status !== 'RUNNING') {
      stopPolling();
      onComplete(job);
    }
  }, [job, stopPolling, onComplete]);

  if (!job) return null;

  return (
    <Alert
      type="info"
      icon={<SyncOutlined spin />}
      showIcon
      message={`Import v${job.version} running…`}
      description="Polling every 3 s. This may take several minutes."
      style={{ marginBottom: 16 }}
    />
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export const FrameworkUpdatesPage: React.FC = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  const { data: meData } = useQuery(ME_QUERY);
  const userRole = meData?.me?.role;
  const isSuperuser = Boolean(meData?.me?.isSuperuser);
  const canView = isSuperuser;
  const canManage = isSuperuser;

  const { data: versionsData } = useQuery(LOADED_ATTACK_VERSIONS_QUERY);
  const { data: latestData } = useQuery(LATEST_AVAILABLE_ATTACK_VERSION_QUERY, { fetchPolicy: 'cache-and-network' });
  const { data: jobsData, refetch: refetchJobs } = useQuery(MITRE_IMPORT_JOBS_QUERY, {
    variables: { limit: 10 },
    fetchPolicy: 'cache-and-network',
  });

  const [runImport, { loading: importing }] = useMutation(RUN_MITRE_IMPORT_MUTATION);

  const latestAvailable: string | null = latestData?.latestAvailableAttackVersion ?? null;
  const loadedVersions: { framework: string; version: string; importedAt: string }[] =
    versionsData?.loadedAttackVersions ?? [];
  const enterpriseVersion = loadedVersions.find(v => v.framework === 'enterprise-attack')?.version ?? null;

  const hasNewerVersion = !!(latestAvailable && enterpriseVersion && semverGt(latestAvailable, enterpriseVersion));

  // Prefill form with latest available version
  useEffect(() => {
    if (latestAvailable) {
      form.setFieldValue('version', latestAvailable);
    }
  }, [latestAvailable, form]);

  const handleSubmit = useCallback(async (values: { version: string; mode: string }) => {
    try {
      const result = await runImport({ variables: { version: values.version, mode: values.mode } });
      const job = result.data?.runMitreImport?.job;
      if (job) {
        setPollingJobId(job.id);
        refetchJobs();
      }
    } catch (err: any) {
      messageApi.error(err?.message ?? 'Failed to start import');
    }
  }, [runImport, refetchJobs, messageApi]);

  const handleJobComplete = useCallback((job: JobRecord) => {
    setPollingJobId(null);
    refetchJobs();
    if (job.status === 'SUCCESS') {
      messageApi.success(`ATT&CK v${job.version} import succeeded!`);
    } else {
      messageApi.error(`ATT&CK v${job.version} import failed.`);
    }
  }, [refetchJobs, messageApi]);

  if (userRole && !canView) {
    return <Navigate to="/" replace />;
  }

  const jobs: JobRecord[] = jobsData?.mitreImportJobs ?? [];

  const columns = [
    { title: 'Version', dataIndex: 'version', key: 'version', render: (v: string) => `v${v}` },
    { title: 'Mode', dataIndex: 'mode', key: 'mode' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: statusTag },
    { title: 'Triggered by', key: 'triggeredBy', render: (_: any, r: JobRecord) => r.triggeredBy?.username ?? '–' },
    {
      title: 'Started',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => v ? new Date(v).toLocaleString() : '–',
    },
    {
      title: 'Duration',
      dataIndex: 'durationSeconds',
      key: 'duration',
      render: formatDuration,
    },
    {
      title: 'Log',
      key: 'log',
      render: (_: any, r: JobRecord) => (
        <Collapse ghost>
          <Panel header="Show last 20 lines" key="log">
            <pre style={{ maxHeight: 200, overflow: 'auto', fontSize: 11, background: '#f5f5f5', padding: 8 }}>
              {r.log ? r.log.split('\n').slice(-20).join('\n') : '(empty)'}
            </pre>
            {r.error && (
              <pre style={{ maxHeight: 100, overflow: 'auto', fontSize: 11, background: '#fff1f0', padding: 8, color: '#cf1322' }}>
                {r.error.split('\n').slice(-10).join('\n')}
              </pre>
            )}
          </Panel>
        </Collapse>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      {contextHolder}

      <Title level={3} style={{ marginBottom: 24 }}>
        <ThunderboltOutlined style={{ marginRight: 8 }} />
        ATT&CK Framework Updates
      </Title>

      {/* Current version status */}
      <Card title="Currently Loaded Frameworks" style={{ marginBottom: 24 }}>
        {loadedVersions.length === 0 ? (
          <Text type="secondary">No frameworks loaded yet.</Text>
        ) : (
          <Space direction="vertical" size={4}>
            {loadedVersions.map(lv => (
              <div key={lv.framework}>
                <Text strong>{lv.framework}</Text>
                {': '}
                <Text>v{lv.version}</Text>
                {lv.importedAt && (
                  <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                    (imported {new Date(lv.importedAt).toLocaleDateString()})
                  </Text>
                )}
              </div>
            ))}
          </Space>
        )}

        {hasNewerVersion && (
          <Alert
            type="warning"
            showIcon
            style={{ marginTop: 16 }}
            message={`A newer ATT&CK version is available: v${latestAvailable}`}
            description="Use the form below to update."
          />
        )}
      </Card>

      {/* Trigger form */}
      <Card title="Run ATT&CK Update" style={{ marginBottom: 24 }}>
        {pollingJobId && (
          <RunningJobPoller jobId={pollingJobId} onComplete={handleJobComplete} />
        )}

        <Form
          form={form}
          layout="inline"
          initialValues={{ mode: 'remote' }}
          onFinish={handleSubmit}
          style={{ gap: 8 }}
          disabled={!canManage}
        >
          <Form.Item
            name="version"
            label="Version"
            rules={[{ required: true, pattern: /^\d+\.\d+$/, message: 'Enter a version like 19.1' }]}
          >
            <Input placeholder="19.1" style={{ width: 120 }} />
          </Form.Item>
          <Form.Item name="mode" label="Mode">
            <Select style={{ width: 120 }}>
              <Select.Option value="remote">Remote</Select.Option>
              <Select.Option value="local">Local</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              icon={<SyncOutlined />}
              loading={importing || !!pollingJobId}
              disabled={!canManage || !!pollingJobId}
            >
              Run Update
            </Button>
          </Form.Item>
        </Form>

        {jobs.some(j => j.status === 'SUCCESS') && (
          <div style={{ marginTop: 16 }}>
            <Button type="link" onClick={() => navigate('/coverage', { state: { frameworkUpdated: true } })}>
              ↗ Reload Coverage Map
            </Button>
          </div>
        )}
      </Card>

      {/* Job history */}
      <Card title="Recent Import Jobs">
        <Table
          dataSource={jobs}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={false}
          locale={{ emptyText: 'No import jobs yet.' }}
        />
      </Card>
    </div>
  );
};
