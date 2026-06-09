import React, { useMemo, useState } from 'react';
import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Input, Space, Typography, Select, Empty, Tag } from 'antd';
import { PixelIcon } from '../components/ui/PixelIcon';

// Define the GraphQL query to fetch all data sources
const GET_ALL_DATASOURCES_QUERY = gql`
  query GetAllDataSources {
    allDataSources {
      id
      name
      platform
      description
    }
  }
`;

// Define the TypeScript types for our data
interface DataSource {
  id: string;
  name: string;
  platform: string | null;
  description: string | null;
}

interface AllDataSourcesData {
  allDataSources: DataSource[];
}

export const DataCatalogPage = () => {
  const { data, loading, error } = useQuery<AllDataSourcesData>(GET_ALL_DATASOURCES_QUERY);
  const navigate = useNavigate();

  const [platformFilter, setPlatformFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');

  const allPlatforms = useMemo(() => {
    const list = (data?.allDataSources || []).map(d => d.platform).filter(Boolean) as string[];
    return Array.from(new Set(list)).sort();
  }, [data]);

  const filtered = useMemo(() => {
    const rows = data?.allDataSources || [];
    return rows.filter(r => {
      const platformMatch = platformFilter === 'ALL' || r.platform === platformFilter;
      const text = `${r.name} ${r.platform || ''} ${r.description || ''}`.toLowerCase();
      const term = search.trim().toLowerCase();
      const searchMatch = !term || text.includes(term);
      return platformMatch && searchMatch;
    });
  }, [data, platformFilter, search]);

  // Color palette for datasource tiles
  const platformColors = [
    '#FF6B6B', // Red
    '#4ECDC4', // Teal
    '#45B7D1', // Blue
    '#FFA07A', // Light Salmon
    '#98D8C8', // Mint
    '#F7DC6F', // Golden
  ];

  const getPlatformColor = (platform: string | null) => {
    if (!platform) return '#999';
    const index = allPlatforms.indexOf(platform);
    return platformColors[index % platformColors.length];
  };

  return (
    <div style={{ padding: '0 24px' }}>
      <div style={{ marginBottom: 24 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
          <Typography.Title level={3} style={{ margin: 0 }}>Data Source Catalog</Typography.Title>
          <Button type="primary" onClick={() => navigate('/catalog/new')}>
            <PixelIcon name="add" className="w-5 h-5" />
            <span style={{ marginLeft: 8 }}>New Data Source</span>
          </Button>
        </Space>

        <Space style={{ marginBottom: 16 }} wrap>
          <Input.Search
            allowClear
            placeholder="Search data sources..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 280 }}
          />
          <Select
            value={platformFilter}
            onChange={setPlatformFilter}
            style={{ minWidth: 220 }}
            options={[{ label: 'All Platforms', value: 'ALL' }, ...allPlatforms.map(p => ({ label: p, value: p }))]}
          />
          <Typography.Text type="secondary">
            Showing {filtered.length} of {data?.allDataSources.length || 0} data sources
          </Typography.Text>
        </Space>
      </div>

      {error && (
        <div style={{ marginBottom: 16 }}>
          <Typography.Text type="danger">Error: {error.message}</Typography.Text>
        </div>
      )}

      {!loading && filtered.length === 0 ? (
        <Card>
          <Empty
            description={search || platformFilter !== 'ALL' ? 'No data sources match your filters' : 'No data sources yet'}
          />
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {filtered.map((ds: DataSource) => (
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
                  <Typography.Text type="secondary" ellipsis>
                    {ds.description}
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
      )}
    </div>
  );
};