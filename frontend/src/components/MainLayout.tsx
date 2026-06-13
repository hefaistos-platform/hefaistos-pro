import React, { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { Layout, Menu, Button, Typography, App, Space, Dropdown, Alert } from 'antd';
import type { MenuProps } from 'antd';
import {
  DatabaseOutlined,
  DeploymentUnitOutlined,
  ApartmentOutlined,
  LogoutOutlined,
  RadarChartOutlined,
  HeatMapOutlined,
  BookOutlined,
  TeamOutlined,
  CrownOutlined,
  BulbOutlined,
  TableOutlined,
  ExclamationCircleOutlined,
  UserOutlined,
  FileTextOutlined,
  ReadOutlined,
  AppstoreOutlined,
  SyncOutlined,
  FileSearchOutlined,
} from '@ant-design/icons';
import { NotificationBell } from './NotificationBell';
import { NewsIcon } from './NewsIcon';
// Theme toggle removed (light theme only)


const { Header, Sider, Content } = Layout;

const ME_ROLE_QUERY = gql`
  query GetMyRole {
    me {
      id
      role
      username
      email
      avatarUrl
      isSuperuser
    }
  }
`;

interface MeRoleData {
  me: {
    id: string;
    role: string;
    username: string;
    email: string;
    avatarUrl?: string | null;
    isSuperuser?: boolean;
  };
}

export const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const { data: meData } = useQuery<MeRoleData>(ME_ROLE_QUERY);
  const userRole = meData?.me?.role;
  const currentRole = userRole?.toUpperCase();
  const isSuperuser = meData?.me?.isSuperuser;
  const username = meData?.me?.username;
  const email = meData?.me?.email;
  const isElOne = currentRole === 'ELONE' && !isSuperuser;
  const isBotAuditorOrg = currentRole === 'BOT_AUDITOR_ORG';
  const isBotAuditorGlobal = currentRole === 'BOT_AUDITOR_GLOBAL';
  const isBotAuditor = isBotAuditorOrg || isBotAuditorGlobal;

  // Map route prefixes to menu keys
  const selectedKey = useMemo(() => {
    if (location.pathname.startsWith('/mgmt/framework-updates')) return 'framework-updates';
    if (location.pathname.startsWith('/mgmt/news')) return 'news';
    if (location.pathname.startsWith('/mgmt/config')) return 'config';
    if (location.pathname.startsWith('/mgmt/logs')) return 'logs';
    if (location.pathname.startsWith('/mgmt/users')) return 'config';
    if (location.pathname.startsWith('/mgmt/cave')) return 'mgmt-cave';
    if (location.pathname.startsWith('/mgmt/superuser')) return 'superuser';
    if (location.pathname.startsWith('/coverage')) return 'coverage';
    if (location.pathname.startsWith('/catalog')) return 'catalog';
    if (location.pathname.startsWith('/playbooks')) return 'playbooks';
    if (location.pathname.startsWith('/l1-portal')) return 'l1-portal';
    if (location.pathname.startsWith('/rules')) return 'rules';
    if (location.pathname.startsWith('/repos')) return 'config';
    if (location.pathname.startsWith('/kb')) return 'kb';
    if (location.pathname.startsWith('/profile')) return 'profile';
    if (location.pathname.startsWith('/tools/ach')) return 'tools-ach';
    if (location.pathname.startsWith('/tools/dld')) return 'tools-dld';
    if (location.pathname.startsWith('/pain-points')) return 'pain-points';
    return 'board';
  }, [location.pathname]);

  const items = isElOne
    ? [
      { key: 'l1-portal', icon: <ReadOutlined />, label: 'L1 Portal', onClick: () => navigate('/l1-portal') },
      { key: 'kb', icon: <BookOutlined />, label: 'Knowledge Base', onClick: () => navigate('/kb') },
      { key: 'pain-points', icon: <ExclamationCircleOutlined />, label: 'Pain Points', onClick: () => navigate('/pain-points') },
      { key: 'profile', icon: <TeamOutlined />, label: 'My Profile', onClick: () => navigate('/profile') },
    ]
    : [
      { key: 'board', icon: <RadarChartOutlined />, label: 'Lifecycle Hub', onClick: () => navigate('/') },
      { key: 'tools-ach', icon: <TableOutlined />, label: 'ACH Matrix', onClick: () => navigate('/tools/ach') },
      { key: 'playbooks', icon: <DeploymentUnitOutlined />, label: 'Workbench Hub', onClick: () => navigate('/playbooks') },
      { key: 'l1-portal', icon: <ReadOutlined />, label: 'L1 Portal', onClick: () => navigate('/l1-portal') },
      { key: 'rules', icon: <ApartmentOutlined />, label: 'Rule Hub', onClick: () => navigate('/rules') },
      { key: 'catalog', icon: <DatabaseOutlined />, label: 'Data Catalog', onClick: () => navigate('/catalog') },
      { key: 'coverage', icon: <HeatMapOutlined />, label: 'Coverage Map', onClick: () => navigate('/coverage') },
      { key: 'tools-dld', icon: <RadarChartOutlined />, label: 'Logic Deconstructor', onClick: () => navigate('/tools/dld') },
      { key: 'kb', icon: <BookOutlined />, label: 'Knowledge Base', onClick: () => navigate('/kb') },
      { key: 'pain-points', icon: <ExclamationCircleOutlined />, label: 'Pain Points', onClick: () => navigate('/pain-points') },
      ...(currentRole === 'ADMIN' || currentRole === 'REVIEWER' || isSuperuser || isBotAuditor ? [{
        key: 'mgmt-cave',
        icon: <CrownOutlined />,
        label: 'MGMT Cave',
        onClick: () => navigate('/mgmt/cave')
      }] : []),
      { key: 'profile', icon: <TeamOutlined />, label: 'My Profile', onClick: () => navigate('/profile') },
    ];

  if (!isElOne && (currentRole === 'ADMIN' || isSuperuser || isBotAuditor)) {
    items.push({ key: 'news', icon: <BulbOutlined />, label: 'News Management', onClick: () => navigate('/mgmt/news') });
    items.push({ key: 'config', icon: <AppstoreOutlined />, label: 'Configuration', onClick: () => navigate('/mgmt/config') });
    items.push({ key: 'framework-updates', icon: <SyncOutlined />, label: 'Framework Updates', onClick: () => navigate('/mgmt/framework-updates') });
    items.push({ key: 'logs', icon: <FileSearchOutlined />, label: 'Logs', onClick: () => navigate('/mgmt/logs') });
  }

  // Superuser management - only for Django superusers
  if (!isElOne && (isSuperuser || isBotAuditorGlobal)) {
    items.push({ key: 'superuser', icon: <CrownOutlined />, label: 'Superuser Mgmt', onClick: () => navigate('/mgmt/superuser') });
  }

  useEffect(() => {
    if (!isElOne) return;

    const path = location.pathname;
    const allowed =
      path === '/l1-portal' ||
      /^\/l1-portal\/[^/]+\/?$/.test(path) ||
      path === '/kb' ||
      path.startsWith('/kb/article/') ||
      path === '/pain-points' ||
      path.startsWith('/pain-points/') ||
      path === '/profile' ||
      path.startsWith('/profile/');

    if (!allowed) {
      navigate('/l1-portal', { replace: true });
    }
  }, [isElOne, location.pathname, navigate]);

  const userMenuItems: MenuProps['items'] = isElOne
    ? [
      {
        key: 'profile',
        icon: <UserOutlined />,
        label: 'My Profile',
        onClick: () => navigate('/profile')
      },
      {
        type: 'divider'
      },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: 'Log Out',
        onClick: () => {
          void logout();
        },
        danger: true
      }
    ]
    : [
      {
        key: 'profile',
        icon: <UserOutlined />,
        label: 'My Profile',
        onClick: () => navigate('/profile')
      },
      {
        key: 'my-rules',
        icon: <FileTextOutlined />,
        label: 'My Rules',
        onClick: () => navigate(`/rules?author=${encodeURIComponent(username || '')}`)
      },
      {
        key: 'my-workbench',
        icon: <AppstoreOutlined />,
        label: 'My Workbench',
        onClick: () => navigate(`/playbooks?author=${encodeURIComponent(username || '')}`)
      },
      {
        type: 'divider'
      },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: 'Log Out',
        onClick: () => {
          void logout();
        },
        danger: true
      }
    ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth={60} width={230} style={{ background: '#ffffff', borderRight: '1px solid #e5e7eb' }}>
        <div style={{ height: 56 }} />
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={items}
          style={{ borderInlineEnd: 'none' }}
        />
          <div style={{ position: 'absolute', bottom: 0, width: '100%', padding: 12, borderTop: '1px solid #f0f0f0' }}>
          <Button
            type="text"
            icon={<LogoutOutlined />}
            block
            onClick={() => {
              void logout();
            }}
            style={{ textAlign: 'left' }}
          >
            Logout
          </Button>
        </div>
      </Sider>
      <Layout>
          <Header style={{ background: '#f5f8fc', padding: '0 24px', display: 'flex', alignItems: 'center', gap: 24, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div className="logo-brand" onClick={() => navigate('/')} title="Go to Lifecycle Hub" role="button" aria-label="Go home">
              <span className="logo-title">HEFAISTOS</span>
            </div>
            <Typography.Text style={{ fontSize: 16, fontWeight: 600, color: '#1677ff' }}>
              {items.find(i => i.key === selectedKey)?.label}
            </Typography.Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* User Dropdown Menu */}
            <Dropdown
              menu={{
                items: userMenuItems
              }}
              trigger={['click']}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  maxWidth: 260,
                  padding: '4px 10px',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 18,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                  fontSize: 12,
                  lineHeight: 1.2,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'background 0.15s'
                }}
                title={email ? `${username || 'User'} (${userRole || ''}) • ${email}` : `${username || 'User'} (${userRole || ''})`}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f7ff')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
                role="button"
                aria-label="User menu"
              >
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '100%'
                }}>
                  {/* Avatar Thumbnail */}
                  <span style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    overflow: 'hidden',
                    background: '#dbeafe',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#1e3a8a',
                    flexShrink: 0,
                    border: '1px solid #bfdbfe'
                  }}>
                    {meData?.me?.avatarUrl ? (
                      <img
                        src={meData.me.avatarUrl}
                        alt="avatar"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      (username || 'U').charAt(0).toUpperCase()
                    )}
                  </span>
                  <span style={{ fontWeight: 600, color: '#34495e' }}>{username || 'User'}</span>
                  {userRole && (
                    <span style={{
                      background: '#e0f2ff',
                      color: '#1677ff',
                      fontSize: 10,
                      fontWeight: 600,
                      padding: '2px 6px',
                      borderRadius: 10,
                      letterSpacing: '0.5px',
                      flexShrink: 0
                    }}>{userRole}</span>
                  )}
                  {email && (
                    <span style={{
                      color: '#6b7280',
                      fontSize: 11,
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 110
                    }}>{email}</span>
                  )}
                </span>
              </div>
            </Dropdown>
            <Space>
              <NewsIcon />
              <NotificationBell />
            </Space>
          </div>
        </Header>
          <Content style={{ margin: 0, padding: '24px 32px', background: '#f9fbfd' }}>
          <App>
            {isBotAuditor && (
              <Alert
                type="warning"
                showIcon
                message="Bot Auditor Read-Only Mode"
                description="This account can inspect features, but all write operations are blocked and sensitive fields are redacted."
                style={{ marginBottom: 16 }}
              />
            )}
            {children}
          </App>
        </Content>
      </Layout>
    </Layout>
  );
};
