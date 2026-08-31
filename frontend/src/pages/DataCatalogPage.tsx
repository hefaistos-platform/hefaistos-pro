import React, { useEffect, useMemo, useRef, useState } from 'react';
import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Input, Space, Typography, Select, Empty, Tag, Pagination, App, Progress } from 'antd';
import { PixelIcon } from '../components/ui/PixelIcon';
import { markdownToPlainText } from '../components/MarkdownRenderer';

const GET_DATA_CATALOG_PAGE_QUERY = gql`
  query GetDataCatalogPage($limit: Int, $offset: Int, $search: String, $platform: String) {
    allDataSources(limit: $limit, offset: $offset, search: $search, platform: $platform) {
      id
      name
      platform
      description
    }
    dataSourceCount(search: $search, platform: $platform)
    dataSourcePlatforms
    me {
      role
      isSuperuser
      isStaff
    }
  }
`;

const GET_ATTACK_IMPORT_JOBS_QUERY = gql`
  query GetAttackImportJobs($limit: Int) {
    attackDataImportJobs(limit: $limit) {
      id
      version
      status
      progressPercent
      progressMessage
      createdCount
      skippedCount
      failedCount
      totalCandidates
      error
      createdAt
      startedAt
      finishedAt
    }
  }
`;

const RUN_ATTACK_DATA_IMPORT_MUTATION = gql`
  mutation RunAttackDataImport($version: String) {
    runAttackDataImport(version: $version) {
      job {
        id
        version
        status
        progressPercent
        progressMessage
        createdCount
        skippedCount
        failedCount
        totalCandidates
        error
      }
    }
  }
`;

interface DataSource {
  id: string;
  name: string;
  platform: string | null;
  description: string | null;
}

interface AttackImportJob {
  id: string;
  version?: string | null;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';
  progressPercent?: number | null;
  progressMessage?: string | null;
  createdCount?: number | null;
  skippedCount?: number | null;
  failedCount?: number | null;
  totalCandidates?: number | null;
  error?: string | null;
  createdAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
}

interface DataCatalogPageData {
  allDataSources: DataSource[];
  dataSourceCount: number;
  dataSourcePlatforms: string[];
  me?: {
    role?: string | null;
    isSuperuser?: boolean | null;
    isStaff?: boolean | null;
  } | null;
}

interface DataCatalogPageVars {
  limit?: number;
  offset?: number;
  search?: string;
  platform?: string;
}

interface AttackImportJobsData {
  attackDataImportJobs: AttackImportJob[];
}

interface AttackImportJobsVars {
  limit?: number;
}

interface RunAttackDataImportData {
  runAttackDataImport: {
    job: AttackImportJob | null;
  } | null;
}

interface RunAttackDataImportVars {
  version?: string;
}

const DEFAULT_PAGE_SIZE = 48;
const JOB_RUNNING_STATUSES = new Set(['PENDING', 'RUNNING']);

export const DataCatalogPage = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();

  const [platformFilter, setPlatformFilter] = useState<string>('ALL');
  const [searchInput, setSearchInput] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = searchInput.trim();
      setSearchTerm(next);
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const queryVariables = useMemo<DataCatalogPageVars>(() => {
    const offset = Math.max((page - 1) * pageSize, 0);
    return {
      limit: pageSize,
      offset,
      search: searchTerm || undefined,
      platform: platformFilter === 'ALL' ? undefined : platformFilter,
    };
  }, [page, pageSize, platformFilter, searchTerm]);

  const { data, loading, error, refetch } = useQuery<DataCatalogPageData, DataCatalogPageVars>(
    GET_DATA_CATALOG_PAGE_QUERY,
    {
      variables: queryVariables,
      fetchPolicy: 'cache-and-network',
      notifyOnNetworkStatusChange: true,
    }
  );

  const role = (data?.me?.role || '').toUpperCase();
  const isAdmin = role === 'ADMIN' || Boolean(data?.me?.isSuperuser) || Boolean(data?.me?.isStaff);

  const {
    data: jobData,
    refetch: refetchJobs,
    startPolling,
    stopPolling,
  } = useQuery<AttackImportJobsData, AttackImportJobsVars>(
    GET_ATTACK_IMPORT_JOBS_QUERY,
    {
      variables: { limit: 5 },
      fetchPolicy: 'network-only',
      notifyOnNetworkStatusChange: true,
      skip: !isAdmin,
    }
  );

  useEffect(() => {
    if (!isAdmin) {
      stopPolling();
    }
    return () => {
      stopPolling();
    };
  }, [isAdmin, stopPolling]);

  const [runAttackDataImport, { loading: startingImport }] = useMutation<
    RunAttackDataImportData,
    RunAttackDataImportVars
  >(RUN_ATTACK_DATA_IMPORT_MUTATION);

  const allPlatforms = data?.dataSourcePlatforms || [];
  const dataSources = data?.allDataSources || [];
  const totalRows = data?.dataSourceCount || 0;
  const latestImportJob = (jobData?.attackDataImportJobs || [])[0] || null;
  const isImportInProgress = Boolean(latestImportJob && JOB_RUNNING_STATUSES.has(latestImportJob.status));

  const watchedJobIdsRef = useRef<Set<string>>(new Set());
  const completedNotificationsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isAdmin) return;
    if (latestImportJob && JOB_RUNNING_STATUSES.has(latestImportJob.status)) {
      startPolling(2000);
      return;
    }
    stopPolling();
  }, [isAdmin, latestImportJob, startPolling, stopPolling]);

  useEffect(() => {
    if (!latestImportJob) return;
    if (!watchedJobIdsRef.current.has(latestImportJob.id)) return;
    if (JOB_RUNNING_STATUSES.has(latestImportJob.status)) return;
    if (completedNotificationsRef.current.has(latestImportJob.id)) return;

    completedNotificationsRef.current.add(latestImportJob.id);

    if (latestImportJob.status === 'SUCCESS') {
      const created = latestImportJob.createdCount || 0;
      const skipped = latestImportJob.skippedCount || 0;
      const failed = latestImportJob.failedCount || 0;
      const versionText = latestImportJob.version ? `v${latestImportJob.version}` : 'auto-version';
      message.success(`ATT&CK import ${versionText} completed: ${created} created, ${skipped} skipped, ${failed} failed.`);
      refetch();
      return;
    }

    if (latestImportJob.status === 'FAILED') {
      message.error(`ATT&CK import failed.${latestImportJob.error ? ` ${latestImportJob.error}` : ''}`);
    }
  }, [latestImportJob, message, refetch]);

  const platformColors = [
    '#FF6B6B',
    '#4ECDC4',
    '#45B7D1',
    '#FFA07A',
    '#98D8C8',
    '#F7DC6F',
  ];

  const getPlatformColor = (platform: string | null) => {
    if (!platform) return '#999';
    const index = allPlatforms.indexOf(platform);
    return platformColors[index % platformColors.length];
  };

  const handlePlatformChange = (value: string) => {
    setPlatformFilter(value);
    setPage(1);
  };

  const handlePaginationChange = (nextPage: number, nextPageSize: number) => {
    if (nextPageSize !== pageSize) {
      setPageSize(nextPageSize);
      setPage(1);
      return;
    }
    setPage(nextPage);
  };

  const handleImportAttack = async () => {
    const confirmed = window.confirm(
      'Start async import of all ATT&CK data components into Data Catalog? Existing entries will be skipped.'
    );
    if (!confirmed) return;

    try {
      const response = await runAttackDataImport({ variables: {} });
      const job = response.data?.runAttackDataImport?.job;
      if (!job) {
        message.error('Import job was not started.');
        return;
      }

      watchedJobIdsRef.current.add(job.id);
      message.info('ATT&CK import started. Tracking progress...');
      await refetchJobs();
      startPolling(2000);
    } catch (err: any) {
      message.error(`Failed to start ATT&CK import: ${err?.message || 'Unknown error'}`);
    }
  };

  const importProgressPercent = Math.max(0, Math.min(100, latestImportJob?.progressPercent || 0));
  const importProgressStatus: 'active' | 'success' | 'exception' = latestImportJob?.status === 'FAILED'
    ? 'exception'
    : latestImportJob?.status === 'SUCCESS'
      ? 'success'
      : 'active';

  return (
    <div style={{ padding: '0 24px' }}>
      <div style={{ marginBottom: 24 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
          <Typography.Title level={3} style={{ margin: 0 }}>Data Source Catalog</Typography.Title>
          <Space>
            {isAdmin && (
              <Button
                onClick={handleImportAttack}
                loading={startingImport}
                disabled={startingImport || isImportInProgress}
              >
                {isImportInProgress ? 'Import In Progress' : 'Import ATT&CK Data'}
              </Button>
            )}
            <Button type="primary" onClick={() => navigate('/catalog/new')}>
              <PixelIcon name="add" className="w-5 h-5" />
              <span style={{ marginLeft: 8 }}>New Data Source</span>
            </Button>
          </Space>
        </Space>

        <Space style={{ marginBottom: 16 }} wrap>
          <Input.Search
            allowClear
            placeholder="Search data sources..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ width: 280 }}
          />
          <Select
            value={platformFilter}
            onChange={handlePlatformChange}
            style={{ minWidth: 220 }}
            options={[
              { label: 'All Platforms', value: 'ALL' },
              ...allPlatforms.map((p) => ({ label: p, value: p })),
            ]}
          />
          <Typography.Text type="secondary">
            Showing {dataSources.length} of {totalRows} data sources
          </Typography.Text>
        </Space>
      </div>

      {error && (
        <div style={{ marginBottom: 16 }}>
          <Typography.Text type="danger">Error: {error.message}</Typography.Text>
        </div>
      )}

      {isAdmin && latestImportJob && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }} size={6}>
            <Typography.Text>
              ATT&CK import status: <strong>{latestImportJob.status}</strong>
              {latestImportJob.version ? ` (v${latestImportJob.version})` : ''}
            </Typography.Text>
            <Progress percent={importProgressPercent} status={importProgressStatus} showInfo />
            {latestImportJob.progressMessage && (
              <Typography.Text type="secondary">{latestImportJob.progressMessage}</Typography.Text>
            )}
            <Typography.Text type="secondary">
              Created {latestImportJob.createdCount || 0} · Skipped {latestImportJob.skippedCount || 0} · Failed {latestImportJob.failedCount || 0} · Total {latestImportJob.totalCandidates || 0}
            </Typography.Text>
            {latestImportJob.status === 'FAILED' && latestImportJob.error && (
              <Typography.Text type="danger">{latestImportJob.error}</Typography.Text>
            )}
          </Space>
        </Card>
      )}

      {!loading && dataSources.length === 0 ? (
        <Card>
          <Empty
            description={searchTerm || platformFilter !== 'ALL' ? 'No data sources match your filters' : 'No data sources yet'}
          />
        </Card>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {dataSources.map((ds: DataSource) => (
              <Card
                key={ds.id}
                hoverable
                loading={loading}
                style={{ borderLeft: `5px solid ${getPlatformColor(ds.platform)}` }}
                onClick={() => navigate(`/catalog/${ds.id}`)}
              >
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8, marginBottom: 8 }}>
                    <Typography.Title level={4} style={{ margin: 0 }}>
                      {ds.name}
                    </Typography.Title>
                    {ds.platform && (
                      <Tag color={getPlatformColor(ds.platform)} style={{ color: '#fff' }}>
                        {ds.platform}
                      </Tag>
                    )}
                  </div>
                  {ds.description && (
                    <Typography.Text type="secondary" ellipsis={{ tooltip: markdownToPlainText(ds.description) }}>
                      {markdownToPlainText(ds.description)}
                    </Typography.Text>
                  )}
                </div>
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
                  <Button type="text" size="small" onClick={(e) => { e.stopPropagation(); navigate(`/catalog/${ds.id}`); }}>
                    View Details →
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {totalRows > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
              <Pagination
                current={page}
                pageSize={pageSize}
                total={totalRows}
                showSizeChanger
                pageSizeOptions={[24, 48, 96]}
                onChange={handlePaginationChange}
                showTotal={(total, range) => `${range[0]}-${range[1]} of ${total}`}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};
