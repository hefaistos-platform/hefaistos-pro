/**
 * SystemUpdateTab
 *
 * Superuser-only configuration tab for triggering in-app Docker Compose
 * system updates for HEFAISTOS PRO.
 *
 * Features:
 * - Displays current version and update capability status.
 * - "Check updates" action (re-fetches version/capability info).
 * - "Update now" action with confirmation modal.
 * - Optional "Force update (down/up)" toggle with warning text.
 * - Live-refreshable job logs and status indicator.
 *
 * Authorization: only rendered and actionable when isSuperuser === true.
 * The backend enforces this independently; the UI gate is defence-in-depth.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Modal,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  SyncOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { App } from 'antd';
import { gql, useQuery, useMutation, ApolloError } from '@apollo/client';

const { Title, Text, Paragraph } = Typography;

// ---------------------------------------------------------------------------
// GraphQL
// ---------------------------------------------------------------------------

const SYSTEM_UPDATE_INFO = gql`
  query SystemUpdateInfo {
    systemUpdateInfo {
      currentVersion
      composeDir
      composeCommand
      capable
      capabilityNote
    }
  }
`;

const SYSTEM_UPDATE_JOB_STATUS = gql`
  query SystemUpdateJobStatus($jobId: String!) {
    systemUpdateJobStatus(jobId: $jobId) {
      jobId
      status
      mode
      actor
      startedAt
      endedAt
      failedStep
      errorMessage
    }
  }
`;

const SYSTEM_UPDATE_JOB_LOGS = gql`
  query SystemUpdateJobLogs($jobId: String!) {
    systemUpdateJobLogs(jobId: $jobId)
  }
`;

const START_SYSTEM_UPDATE = gql`
  mutation StartSystemUpdate($mode: String) {
    startSystemUpdate(mode: $mode) {
      jobId
      success
      message
    }
  }
`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UpdateInfo {
  currentVersion: string;
  composeDir: string;
  composeCommand: string;
  capable: boolean;
  capabilityNote: string;
}

interface JobStatus {
  jobId: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  mode: string;
  actor: string;
  startedAt: string | null;
  endedAt: string | null;
  failedStep: string | null;
  errorMessage: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'default',
  running: 'processing',
  success: 'success',
  failed: 'error',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <SyncOutlined spin />,
  running: <SyncOutlined spin />,
  success: <CheckCircleOutlined />,
  failed: <CloseCircleOutlined />,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SystemUpdateTabProps {
  isSuperuser: boolean;
}

const LOG_POLL_INTERVAL_MS = 2000;
const STATUS_POLL_INTERVAL_MS = 3000;

export const SystemUpdateTab: React.FC<SystemUpdateTabProps> = ({ isSuperuser }) => {
  const { message } = App.useApp();

  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [forceMode, setForceMode] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  // --- Info query ----------------------------------------------------------
  const {
    data: infoData,
    loading: infoLoading,
    refetch: refetchInfo,
    error: infoError,
  } = useQuery<{ systemUpdateInfo: UpdateInfo }>(SYSTEM_UPDATE_INFO, {
    skip: !isSuperuser,
    fetchPolicy: 'cache-and-network',
  });

  // --- Job status poll -----------------------------------------------------
  const {
    data: statusData,
    startPolling: startStatusPoll,
    stopPolling: stopStatusPoll,
    refetch: refetchStatus,
  } = useQuery<{ systemUpdateJobStatus: JobStatus | null }>(SYSTEM_UPDATE_JOB_STATUS, {
    variables: { jobId: activeJobId ?? '' },
    skip: !activeJobId || !isSuperuser,
    fetchPolicy: 'network-only',
  });

  // --- Job logs poll -------------------------------------------------------
  const {
    data: logsData,
    startPolling: startLogsPoll,
    stopPolling: stopLogsPoll,
  } = useQuery<{ systemUpdateJobLogs: string[] | null }>(SYSTEM_UPDATE_JOB_LOGS, {
    variables: { jobId: activeJobId ?? '' },
    skip: !activeJobId || !isSuperuser,
    fetchPolicy: 'network-only',
  });

  const jobStatus = statusData?.systemUpdateJobStatus ?? null;
  const jobLogs = logsData?.systemUpdateJobLogs ?? [];
  const isJobActive = jobStatus?.status === 'pending' || jobStatus?.status === 'running';

  // Start/stop polling when job is active
  useEffect(() => {
    if (!activeJobId) return;
    if (isJobActive) {
      startStatusPoll(STATUS_POLL_INTERVAL_MS);
      startLogsPoll(LOG_POLL_INTERVAL_MS);
    } else {
      stopStatusPoll();
      stopLogsPoll();
    }
    return () => {
      stopStatusPoll();
      stopLogsPoll();
    };
  }, [activeJobId, isJobActive, startStatusPoll, stopStatusPoll, startLogsPoll, stopLogsPoll]);

  // Scroll logs to bottom when new lines arrive
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [jobLogs]);

  // --- Mutation ------------------------------------------------------------
  const [startUpdate, { loading: startLoading }] = useMutation<{
    startSystemUpdate: { jobId: string | null; success: boolean; message: string };
  }>(START_SYSTEM_UPDATE);

  const handleStartUpdate = useCallback(async () => {
    setConfirmOpen(false);
    try {
      const result = await startUpdate({
        variables: { mode: forceMode ? 'force' : 'standard' },
      });
      const data = result.data?.startSystemUpdate;
      if (data?.success && data.jobId) {
        setActiveJobId(data.jobId);
        message.info(`Update job started (${data.jobId.slice(0, 8)}…)`);
      } else {
        message.error(data?.message ?? 'Failed to start update.');
      }
    } catch (err: unknown) {
      const msg = err instanceof ApolloError ? err.message : 'Update request failed.';
      message.error(msg);
    }
  }, [forceMode, startUpdate, message]);

  // --- Guard ---------------------------------------------------------------
  if (!isSuperuser) {
    return (
      <Alert
        type="error"
        message="Access Denied"
        description="System updates are restricted to superuser accounts."
        showIcon
        icon={<CloseCircleOutlined />}
      />
    );
  }

  // --- Render --------------------------------------------------------------
  const info = infoData?.systemUpdateInfo;

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ marginBottom: 4 }}>
          System Update
        </Title>
        <Text type="secondary">
          Trigger a Docker Compose system update for HEFAISTOS PRO. This is a
          system-wide operation and requires superuser access.
        </Text>
      </div>

      {/* Version / capability info */}
      <div style={{ marginBottom: 24, padding: '16px 20px', border: '1px solid #303030', borderRadius: 6 }}>
        {infoLoading && <Spin size="small" />}
        {infoError && (
          <Text type="danger">Failed to load update info: {infoError.message}</Text>
        )}
        {info && (
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <Space>
              <Text strong>Current version:</Text>
              <Tag color="blue">{info.currentVersion}</Tag>
            </Space>
            <Space>
              <Text strong>Compose directory:</Text>
              <Text code>{info.composeDir}</Text>
            </Space>
            <Space>
              <Text strong>Compose command:</Text>
              <Text code>{info.composeCommand}</Text>
            </Space>
            <Space>
              <Text strong>Update capability:</Text>
              {info.capable ? (
                <Tag color="green" icon={<CheckCircleOutlined />}>
                  Available
                </Tag>
              ) : (
                <Tag color="red" icon={<CloseCircleOutlined />}>
                  Unavailable
                </Tag>
              )}
              <Text type="secondary" style={{ fontSize: 12 }}>
                {info.capabilityNote}
              </Text>
            </Space>
          </Space>
        )}
        <div style={{ marginTop: 12 }}>
          <Button
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => refetchInfo()}
            loading={infoLoading}
          >
            Check updates
          </Button>
        </div>
      </div>

      {/* Force mode toggle */}
      <div style={{ marginBottom: 16 }}>
        <Checkbox
          checked={forceMode}
          onChange={(e) => setForceMode(e.target.checked)}
          disabled={isJobActive || startLoading}
        >
          Force update (down/up — recovery mode)
        </Checkbox>
        {forceMode && (
          <Alert
            type="warning"
            showIcon
            icon={<WarningOutlined />}
            message="Force mode will bring all services down before restarting."
            description={
              <span>
                This causes deliberate downtime. Only use for recovery when a
                standard update fails. Command sequence:{' '}
                <Text code>docker compose down → pull → up → migrate</Text>
              </span>
            }
            style={{ marginTop: 8 }}
          />
        )}
        {!forceMode && (
          <div style={{ marginTop: 6 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Standard mode (low downtime): pull → migrate → up --remove-orphans
            </Text>
          </div>
        )}
      </div>

      {/* Start update button */}
      <Space style={{ marginBottom: 24 }}>
        <Button
          type="primary"
          danger={forceMode}
          icon={<SyncOutlined />}
          loading={startLoading}
          disabled={isJobActive || !info?.capable}
          onClick={() => setConfirmOpen(true)}
        >
          {forceMode ? 'Force Update (down/up)' : 'Update now'}
        </Button>
        {isJobActive && (
          <Tag color="processing" icon={<SyncOutlined spin />}>
            Update in progress…
          </Tag>
        )}
      </Space>

      {/* Confirmation modal */}
      <Modal
        open={confirmOpen}
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: forceMode ? '#ff4d4f' : '#faad14' }} />
            Confirm system update
          </Space>
        }
        onOk={handleStartUpdate}
        onCancel={() => setConfirmOpen(false)}
        okText={forceMode ? 'Yes, force update' : 'Yes, update now'}
        okButtonProps={{ danger: forceMode }}
        cancelText="Cancel"
      >
        <Paragraph>
          You are about to trigger a{' '}
          <strong>{forceMode ? 'force (down/up)' : 'standard'}</strong> system
          update. This will run Docker Compose commands on the host and{' '}
          {forceMode
            ? 'will cause service downtime.'
            : 'may briefly restart individual services.'}
        </Paragraph>
        <Paragraph>
          <strong>Are you sure you want to proceed?</strong>
        </Paragraph>
      </Modal>

      {/* Job status and logs */}
      {activeJobId && (
        <div>
          <div style={{ marginBottom: 12 }}>
            <Space>
              <Text strong>Job:</Text>
              <Text code>{activeJobId.slice(0, 8)}…</Text>
              {jobStatus && (
                <>
                  <Badge
                    status={
                      jobStatus.status === 'running' || jobStatus.status === 'pending'
                        ? 'processing'
                        : jobStatus.status === 'success'
                        ? 'success'
                        : 'error'
                    }
                  />
                  <Tag color={STATUS_COLORS[jobStatus.status] ?? 'default'}>
                    {STATUS_ICONS[jobStatus.status]} {jobStatus.status.toUpperCase()}
                  </Tag>
                  {jobStatus.mode && (
                    <Tag color="default">mode: {jobStatus.mode}</Tag>
                  )}
                  {jobStatus.startedAt && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Started: {new Date(jobStatus.startedAt).toLocaleTimeString()}
                    </Text>
                  )}
                  {jobStatus.endedAt && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Ended: {new Date(jobStatus.endedAt).toLocaleTimeString()}
                    </Text>
                  )}
                </>
              )}
              {isJobActive && (
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={() => refetchStatus()}
                >
                  Refresh status
                </Button>
              )}
            </Space>
          </div>

          {jobStatus?.failedStep && (
            <Alert
              type="error"
              showIcon
              message={`Failed step: ${jobStatus.failedStep}`}
              description={jobStatus.errorMessage}
              style={{ marginBottom: 12 }}
            />
          )}

          {/* Log viewer */}
          <div
            style={{
              background: '#1a1a1a',
              border: '1px solid #303030',
              borderRadius: 4,
              padding: '10px 14px',
              maxHeight: 400,
              overflowY: 'auto',
              fontFamily: 'monospace',
              fontSize: 12,
              lineHeight: '1.6',
              color: '#d4d4d4',
            }}
          >
            {jobLogs.length === 0 ? (
              <Text type="secondary" style={{ fontFamily: 'monospace', fontSize: 12 }}>
                {isJobActive ? 'Waiting for log output…' : 'No logs available.'}
              </Text>
            ) : (
              jobLogs.map((line, idx) => (
                <div key={idx} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {line}
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        </div>
      )}

      {/* Documentation note */}
      <div style={{ marginTop: 32 }}>
        <Alert
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          message="About system updates"
          description={
            <span>
              Updates use Docker Compose to pull new images and restart services.
              Standard mode minimizes downtime. Force mode brings all services down first (recovery only).
              Only one update may run at a time. Check{' '}
              <Text code>Docs/system-update.md</Text> for operational details.
            </span>
          }
        />
      </div>
    </div>
  );
};

export default SystemUpdateTab;
