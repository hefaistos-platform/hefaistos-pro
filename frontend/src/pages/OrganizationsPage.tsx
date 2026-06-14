import React, { useState } from 'react';
import { Card, Typography, Table, Button, Modal, Form, Input, InputNumber, Space, Popconfirm, message, Tag, Tabs, Select, Drawer, Divider } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, BankOutlined, TeamOutlined, ArrowRightOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { gql } from '@apollo/client';
import { useQuery, useMutation } from '@apollo/client/react';

const { Title } = Typography;

// --- GraphQL Queries ---
const ALL_ORGANIZATIONS = gql`
  query AllOrganizations {
    allOrganizations {
      id
      name
      maxUsers
      memberCount
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

// --- TypeScript Interfaces ---
interface Organization {
  id: string;
  name: string;
  maxUsers?: number | null;
  memberCount: number;
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

export const OrganizationsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('organizations');
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
  const [isEntityModalOpen, setIsEntityModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [selectedOrgIds, setSelectedOrgIds] = useState<string[]>([]);
  const [memberDrawerOrg, setMemberDrawerOrg] = useState<Organization | null>(null);
  const [bulkEntityId, setBulkEntityId] = useState<string | undefined>();
  const [orgForm] = Form.useForm();
  const [entityForm] = Form.useForm();

  // Queries
  const { data: orgData, loading: orgLoading, refetch: refetchOrgs } = useQuery<AllOrganizationsData>(ALL_ORGANIZATIONS);
  const { data: entityData, loading: entityLoading, refetch: refetchEntities } = useQuery<AllEntitiesData>(ALL_ENTITIES);
  const { data: membersData, loading: membersLoading } = useQuery<OrganizationMembersData>(ORGANIZATION_WITH_MEMBERS, {
    variables: { id: memberDrawerOrg?.id },
    skip: !memberDrawerOrg,
    fetchPolicy: 'network-only',
  });

  // Mutations
  const [createOrganization, { loading: createOrgLoading }] = useMutation<CreateOrgData>(CREATE_ORGANIZATION);
  const [updateOrganization, { loading: updateOrgLoading }] = useMutation<UpdateOrgData>(UPDATE_ORGANIZATION);
  const [deleteOrganization] = useMutation<DeleteOrgData>(DELETE_ORGANIZATION);
  const [createEntity, { loading: createEntityLoading }] = useMutation<CreateEntityData>(CREATE_ENTITY);
  const [deleteEntity] = useMutation<DeleteEntityData>(DELETE_ENTITY);

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
          variables: { id: editingOrg.id, name: values.name, entityId, maxUsers }
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
          variables: { name: values.name, entityId, maxUsers }
        });
        if (data?.createOrganization?.success) {
          message.success('Organization created successfully');
          setIsOrgModalOpen(false);
          refetchOrgs();
        } else {
          message.error(data?.createOrganization?.message || 'Failed to create organization');
        }
      }
    } catch (err) {
      console.error('Form validation failed:', err);
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
    } catch (err) {
      console.error('Form validation failed:', err);
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
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
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
            <Tag>{selectedOrgIds.length} selected</Tag>
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
      <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
        Manage organizations and holding entities. Only superusers have access to this page.
      </Typography.Paragraph>

      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />

      {/* Members Drawer */}
      <Drawer
        title={memberDrawerOrg ? `Members of ${memberDrawerOrg.name}` : 'Members'}
        open={!!memberDrawerOrg}
        onClose={() => setMemberDrawerOrg(null)}
        width={420}
      >
        <Typography.Paragraph type="secondary">
          Read-only roster. Role changes or invites are managed from the org user admin.
        </Typography.Paragraph>
        <Divider />
        {membersLoading ? (
          <div>Loading members…</div>
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
