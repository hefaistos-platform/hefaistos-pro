import React, { useMemo, useState } from 'react';
import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import { Alert, Button, Card, Modal, Select, Space, Switch, Table, Tag, Tooltip, Typography, message } from 'antd';

const { Text } = Typography;

const GET_ORG_AI_TASK_CONFIGS = gql`
  query GetOrgAiTaskConfigs {
    orgAiTaskConfigs {
      taskKey
      title
      description
      aiRequired
      enabled
      schedule
      dayOfWeek
      dayOfMonth
      runHour
      runMinute
      nextRunAt
      lastRunAt
      lastStatus
      lastMessage
      updatedAt
    }
  }
`;

const GET_ORG_AI_TASK_RUNS = gql`
  query GetOrgAiTaskRuns($limit: Int, $taskKey: String) {
    orgAiTaskRuns(limit: $limit, taskKey: $taskKey) {
      id
      taskKey
      title
      status
      trigger
      startedAt
      completedAt
      durationMs
      outputSummary
      errorMessage
      runByUsername
    }
  }
`;

const SET_ORG_AI_TASK_CONFIG = gql`
  mutation SetOrgAiTaskConfig(
    $taskKey: String!
    $enabled: Boolean
    $schedule: String
    $dayOfWeek: Int
    $dayOfMonth: Int
    $runHour: Int
    $runMinute: Int
  ) {
    setOrgAiTaskConfig(
      taskKey: $taskKey
      enabled: $enabled
      schedule: $schedule
      dayOfWeek: $dayOfWeek
      dayOfMonth: $dayOfMonth
      runHour: $runHour
      runMinute: $runMinute
    ) {
      success
      message
    }
  }
`;

const RUN_ORG_AI_TASK_NOW = gql`
  mutation RunOrgAiTaskNow($taskKey: String!) {
    runOrgAiTaskNow(taskKey: $taskKey) {
      success
      message
      run {
        id
        taskKey
        status
        trigger
        startedAt
        completedAt
        durationMs
        outputSummary
        errorMessage
      }
    }
  }
`;

interface TaskConfig {
  taskKey: string;
  title: string;
  description: string;
  aiRequired: boolean;
  enabled: boolean;
  schedule: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  dayOfWeek: number;
  dayOfMonth: number;
  runHour: number;
  runMinute: number;
  nextRunAt?: string | null;
  lastRunAt?: string | null;
  lastStatus?: 'SUCCESS' | 'FAILED' | 'SKIPPED' | null;
  lastMessage?: string | null;
}

interface TaskRun {
  id: string;
  taskKey: string;
  title: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  trigger: 'SCHEDULED' | 'MANUAL';
  startedAt?: string | null;
  completedAt?: string | null;
  durationMs?: number | null;
  outputSummary?: string | null;
  errorMessage?: string | null;
  runByUsername?: string | null;
}

const SCHEDULE_OPTIONS = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
];

const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Monday' },
  { value: 1, label: 'Tuesday' },
  { value: 2, label: 'Wednesday' },
  { value: 3, label: 'Thursday' },
  { value: 4, label: 'Friday' },
  { value: 5, label: 'Saturday' },
  { value: 6, label: 'Sunday' },
];

const HOUR_OPTIONS = Array.from({ length: 24 }).map((_, hour) => ({
  value: hour,
  label: `${String(hour).padStart(2, '0')}:00`,
}));

const MINUTE_OPTIONS = [0, 15, 30, 45].map((minute) => ({
  value: minute,
  label: String(minute).padStart(2, '0'),
}));

const REPORT_TASK_KEYS = new Set<string>([
  'coverage_gap_digest',
  'detection_debt_snapshot',
  'executive_risk_narrative',
  'compliance_evidence_draft',
  'program_review_digest',
]);

const statusColor = (status?: string | null): string => {
  if (status === 'SUCCESS') return 'green';
  if (status === 'FAILED') return 'red';
  if (status === 'SKIPPED') return 'orange';
  return 'default';
};

const formatDateTime = (value?: string | null): string => (value ? new Date(value).toLocaleString() : 'N/A');

const compactText = (value?: string | null, max = 220): string => {
  const raw = (value || '').trim();
  if (!raw) return '';
  if (raw.length <= max) return raw;
  return `${raw.slice(0, max - 3)}...`;
};

const getRunOutputText = (run: TaskRun): string => (run.outputSummary || run.errorMessage || '').trim();

const sanitizeFilenamePart = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'task';

const triggerText = (value?: string | null): string => (value || 'MANUAL').toLowerCase();

const buildConfigVariables = (task: TaskConfig, patch: Partial<TaskConfig>) => {
  const merged = { ...task, ...patch };
  return {
    taskKey: task.taskKey,
    enabled: merged.enabled,
    schedule: merged.schedule,
    dayOfWeek: merged.dayOfWeek,
    dayOfMonth: merged.dayOfMonth,
    runHour: merged.runHour,
    runMinute: merged.runMinute,
  };
};

const AITasksTab: React.FC<{ canManage: boolean }> = ({ canManage }) => {
  const [savingTaskKey, setSavingTaskKey] = useState<string | null>(null);
  const [runningTaskKey, setRunningTaskKey] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<TaskRun | null>(null);

  const { data, loading, error, refetch } = useQuery<{ orgAiTaskConfigs: TaskConfig[] }>(
    GET_ORG_AI_TASK_CONFIGS,
    {
      fetchPolicy: 'cache-and-network',
      skip: !canManage,
    },
  );
  const { data: runsData, loading: runsLoading, refetch: refetchRuns } = useQuery<{ orgAiTaskRuns: TaskRun[] }>(
    GET_ORG_AI_TASK_RUNS,
    {
      variables: { limit: 40 },
      fetchPolicy: 'cache-and-network',
      skip: !canManage,
    },
  );

  const [setOrgAiTaskConfig] = useMutation(SET_ORG_AI_TASK_CONFIG);
  const [runOrgAiTaskNow] = useMutation(RUN_ORG_AI_TASK_NOW);

  const tasks = useMemo(() => data?.orgAiTaskConfigs ?? [], [data?.orgAiTaskConfigs]);
  const runs = useMemo(() => runsData?.orgAiTaskRuns ?? [], [runsData?.orgAiTaskRuns]);

  const taskTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    tasks.forEach((task) => map.set(task.taskKey, task.title));
    return map;
  }, [tasks]);

  const runTitle = (record: TaskRun): string => taskTitleMap.get(record.taskKey) || record.title || record.taskKey;

  const downloadRunOutput = (record: TaskRun) => {
    const output = getRunOutputText(record);
    if (!output) {
      message.warning('No run output is available to download.');
      return;
    }
    const startedAt = record.startedAt ? new Date(record.startedAt).toISOString().slice(0, 19).replace(/:/g, '-') : 'unknown-time';
    const filename = `${sanitizeFilenamePart(record.taskKey)}-${triggerText(record.trigger)}-${startedAt}.txt`;
    const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
    const downloadUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(downloadUrl);
  };

  const persistTaskConfig = async (task: TaskConfig, patch: Partial<TaskConfig>) => {
    setSavingTaskKey(task.taskKey);
    try {
      const response = await setOrgAiTaskConfig({
        variables: buildConfigVariables(task, patch),
      });
      const payload = response.data?.setOrgAiTaskConfig;
      if (!payload?.success) {
        message.error(payload?.message || 'Failed to save task configuration');
        return;
      }
      message.success('Task configuration saved');
      await Promise.all([refetch(), refetchRuns()]);
    } catch (e: any) {
      message.error(e?.message || 'Failed to save task configuration');
    } finally {
      setSavingTaskKey(null);
    }
  };

  const handleRunNow = async (taskKey: string) => {
    setRunningTaskKey(taskKey);
    try {
      const response = await runOrgAiTaskNow({ variables: { taskKey } });
      const payload = response.data?.runOrgAiTaskNow;
      if (!payload?.success) {
        message.error(payload?.message || 'Task execution failed');
      } else {
        message.success(payload?.message || 'Task executed');
      }
      await Promise.all([refetch(), refetchRuns()]);
    } catch (e: any) {
      message.error(e?.message || 'Task execution failed');
    } finally {
      setRunningTaskKey(null);
    }
  };

  if (!canManage) {
    return <Alert type="warning" showIcon message="Only administrators can manage AI tasks." />;
  }

  if (error) {
    return <Alert type="error" showIcon message="Failed to load AI tasks." description={error.message} />;
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      <Card
        loading={loading}
        title="AI Tasks"
        extra={<Button onClick={() => { refetch(); refetchRuns(); }}>Refresh</Button>}
      >
        <Text type="secondary">
          Enable AI-assisted operational tasks, choose cadence, and run tasks on demand.
          All schedules are stored in UTC.
        </Text>
        <div className="mt-4 space-y-4">
          {tasks.map((task) => {
            const saving = savingTaskKey === task.taskKey;
            const running = runningTaskKey === task.taskKey;
            return (
              <div key={task.taskKey} className="rounded-lg border border-gray-200 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="md:max-w-[48%]">
                    <div className="flex items-center gap-2">
                      <Text strong>{task.title}</Text>
                      {task.aiRequired ? <Tag color="blue">AI Required</Tag> : <Tag>AI Optional</Tag>}
                    </div>
                    <Text type="secondary">{task.description}</Text>
                    <div className="mt-2 text-xs text-gray-500">
                      Last run: {formatDateTime(task.lastRunAt)}{' '}
                      {task.lastStatus && <Tag color={statusColor(task.lastStatus)}>{task.lastStatus}</Tag>}
                    </div>
                    <div className="text-xs text-gray-500">Next run: {formatDateTime(task.nextRunAt)}</div>
                    {task.lastMessage && (
                      <div className="mt-2 rounded bg-gray-50 p-2 text-xs text-gray-700 whitespace-pre-wrap">
                        {compactText(task.lastMessage, 420)}
                      </div>
                    )}
                  </div>

                  <Space wrap align="start">
                    <Tooltip title="Enable or disable this task">
                      <Switch
                        checked={task.enabled}
                        loading={saving}
                        onChange={(checked) => persistTaskConfig(task, { enabled: checked })}
                      />
                    </Tooltip>
                    <Select
                      style={{ width: 118 }}
                      value={task.schedule}
                      disabled={saving}
                      options={SCHEDULE_OPTIONS}
                      onChange={(value) => persistTaskConfig(task, { schedule: value })}
                    />
                    {task.schedule === 'WEEKLY' && (
                      <Select
                        style={{ width: 128 }}
                        value={task.dayOfWeek}
                        disabled={saving}
                        options={WEEKDAY_OPTIONS}
                        onChange={(value) => persistTaskConfig(task, { dayOfWeek: value })}
                      />
                    )}
                    {task.schedule === 'MONTHLY' && (
                      <Select
                        style={{ width: 96 }}
                        value={task.dayOfMonth}
                        disabled={saving}
                        options={Array.from({ length: 28 }).map((_, index) => ({ value: index + 1, label: `Day ${index + 1}` }))}
                        onChange={(value) => persistTaskConfig(task, { dayOfMonth: value })}
                      />
                    )}
                    <Select
                      style={{ width: 100 }}
                      value={task.runHour}
                      disabled={saving}
                      options={HOUR_OPTIONS}
                      onChange={(value) => persistTaskConfig(task, { runHour: value })}
                    />
                    <Select
                      style={{ width: 88 }}
                      value={task.runMinute}
                      disabled={saving}
                      options={MINUTE_OPTIONS}
                      onChange={(value) => persistTaskConfig(task, { runMinute: value })}
                    />
                    <Button
                      type="primary"
                      loading={running}
                      disabled={saving}
                      onClick={() => handleRunNow(task.taskKey)}
                    >
                      Run Now
                    </Button>
                  </Space>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Recent AI Task Runs" loading={runsLoading}>
        <Table
          rowKey="id"
          size="small"
          pagination={{ pageSize: 10 }}
          dataSource={runs}
          columns={[
            {
              title: 'Started',
              dataIndex: 'startedAt',
              key: 'startedAt',
              width: 190,
              render: (value: string | null | undefined) => formatDateTime(value),
            },
            {
              title: 'Task',
              dataIndex: 'taskKey',
              key: 'task',
              width: 260,
              render: (_value: string, record: TaskRun) => taskTitleMap.get(record.taskKey) || record.title || record.taskKey,
            },
            {
              title: 'Trigger',
              dataIndex: 'trigger',
              key: 'trigger',
              width: 100,
              render: (value: string) => <Tag>{value}</Tag>,
            },
            {
              title: 'Status',
              dataIndex: 'status',
              key: 'status',
              width: 110,
              render: (value: string) => <Tag color={statusColor(value)}>{value}</Tag>,
            },
            {
              title: 'Duration',
              dataIndex: 'durationMs',
              key: 'durationMs',
              width: 110,
              render: (value: number | null | undefined) => (value ? `${(value / 1000).toFixed(1)}s` : 'N/A'),
            },
            {
              title: 'Result',
              key: 'result',
              render: (_value: unknown, record: TaskRun) => {
                const text = getRunOutputText(record);
                const isReport = REPORT_TASK_KEYS.has(record.taskKey);
                if (!text) {
                  return <span>N/A</span>;
                }
                return (
                  <Space direction="vertical" size={4}>
                    <span>{compactText(text, isReport ? 180 : 260)}</span>
                    <Space size={8}>
                      <Button size="small" onClick={() => setSelectedRun(record)}>
                        Read
                      </Button>
                      <Button size="small" onClick={() => downloadRunOutput(record)}>
                        Download
                      </Button>
                    </Space>
                  </Space>
                );
              },
            },
          ]}
        />
      </Card>
      <Modal
        open={Boolean(selectedRun)}
        onCancel={() => setSelectedRun(null)}
        width={900}
        title={selectedRun ? `${runTitle(selectedRun)} - Full Output` : 'Task Output'}
        footer={[
          <Button
            key="download"
            onClick={() => {
              if (selectedRun) downloadRunOutput(selectedRun);
            }}
            disabled={!selectedRun || !getRunOutputText(selectedRun)}
          >
            Download
          </Button>,
          <Button key="close" type="primary" onClick={() => setSelectedRun(null)}>
            Close
          </Button>,
        ]}
      >
        {selectedRun && (
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            <Text type="secondary">
              Status: {selectedRun.status} | Trigger: {selectedRun.trigger} | Started: {formatDateTime(selectedRun.startedAt)}
            </Text>
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                maxHeight: 520,
                overflowY: 'auto',
                background: '#fafafa',
                border: '1px solid #f0f0f0',
                borderRadius: 8,
                padding: 12,
                margin: 0,
              }}
            >
              {getRunOutputText(selectedRun) || 'No output is available for this run.'}
            </pre>
          </Space>
        )}
      </Modal>
    </Space>
  );
};

export default AITasksTab;
