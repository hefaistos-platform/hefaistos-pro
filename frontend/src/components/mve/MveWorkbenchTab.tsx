import React, { useEffect, useMemo, useState } from 'react';
import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import {
  Background,
  Connection,
  Controls,
  Edge,
  Node,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import { DeleteOutlined, ExportOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Col, Form, Input, InputNumber, Modal, Radio, Row, Select, Space, Spin, Tag, Tooltip, Typography, message } from 'antd';

const GET_MVE_DRAFTS_QUERY = gql`
  query GetMveDrafts {
    allMveDrafts {
      id
      name
      status
      anchorEntity
      maxTotalSpanMs
      isAdvopsValidated
      updatedAt
    }
  }
`;

const GET_MVE_DRAFT_QUERY = gql`
  query GetMveDraft($id: UUID!) {
    mveDraft(id: $id) {
      id
      name
      status
      anchorEntity
      maxTotalSpanMs
      isAdvopsValidated
      validationSummary
      lastValidatedAt
      updatedAt
      nodes {
        id
        stepOrder
        nodeType
        label
        tacticRef
        techniqueRef
        criteria
        positionX
        positionY
        dataSource {
          id
          name
        }
        detectionRule {
          id
          title
          format
        }
        capabilityAbstraction {
          id
          abstractionLayer
          componentArtifact
          technique {
            techniqueId
            name
          }
        }
      }
      edges {
        id
        source
        target
      }
      latestValidation {
        id
        status
        createdAt
        completedAt
        errorMessage
        resultData
      }
    }
  }
`;

const GET_MVE_OPTIONS_QUERY = gql`
  query GetMveOptions {
    capabilityAbstractions(includeBaseline: true) {
      id
      abstractionLayer
      componentArtifact
      technique {
        techniqueId
        name
      }
    }
    allDataSources {
      id
      name
    }
    searchAllRules(query: "", limit: 200) {
      id
      title
      format
    }
    allRuleRepositories {
      id
      name
      provider
      url
    }
    mveAppendTargets {
      id
      title
      status
      updatedAt
      author {
        id
        username
      }
    }
  }
`;

const GET_MVE_VALIDATION_QUERY = gql`
  query GetMveValidationRun($id: UUID!) {
    mveValidationRun(id: $id) {
      id
      status
      errorMessage
      resultData
      createdAt
      completedAt
    }
  }
`;

const CREATE_MVE_DRAFT_MUTATION = gql`
  mutation CreateMveDraft($name: String!, $anchorEntity: String!, $maxTotalSpanMs: Int!) {
    createMveDraft(name: $name, anchorEntity: $anchorEntity, maxTotalSpanMs: $maxTotalSpanMs) {
      mveDraft {
        id
      }
    }
  }
`;

const UPDATE_MVE_DRAFT_MUTATION = gql`
  mutation UpdateMveDraft(
    $draftId: UUID!
    $name: String
    $anchorEntity: String
    $maxTotalSpanMs: Int
    $status: String
  ) {
    updateMveDraft(
      draftId: $draftId
      name: $name
      anchorEntity: $anchorEntity
      maxTotalSpanMs: $maxTotalSpanMs
      status: $status
    ) {
      mveDraft {
        id
        name
        status
        anchorEntity
        maxTotalSpanMs
      }
    }
  }
`;

const DELETE_MVE_DRAFT_MUTATION = gql`
  mutation DeleteMveDraft($draftId: UUID!) {
    deleteMveDraft(draftId: $draftId) {
      ok
    }
  }
`;

const ADD_MVE_NODE_MUTATION = gql`
  mutation AddMveNode(
    $draftId: UUID!
    $nodeType: String!
    $stepOrder: Int
    $label: String
    $dataSourceId: ID
    $detectionRuleId: ID
    $capabilityAbstractionId: UUID
    $tacticRef: String
    $techniqueRef: String
    $criteria: GenericScalar
    $positionX: Float
    $positionY: Float
  ) {
    addMveNode(
      draftId: $draftId
      nodeType: $nodeType
      stepOrder: $stepOrder
      label: $label
      dataSourceId: $dataSourceId
      detectionRuleId: $detectionRuleId
      capabilityAbstractionId: $capabilityAbstractionId
      tacticRef: $tacticRef
      techniqueRef: $techniqueRef
      criteria: $criteria
      positionX: $positionX
      positionY: $positionY
    ) {
      node {
        id
      }
    }
  }
`;

const UPDATE_MVE_NODE_MUTATION = gql`
  mutation UpdateMveNode(
    $nodeId: UUID!
    $stepOrder: Int
    $label: String
    $dataSourceId: ID
    $detectionRuleId: ID
    $capabilityAbstractionId: UUID
    $tacticRef: String
    $techniqueRef: String
    $criteria: GenericScalar
    $positionX: Float
    $positionY: Float
  ) {
    updateMveNode(
      nodeId: $nodeId
      stepOrder: $stepOrder
      label: $label
      dataSourceId: $dataSourceId
      detectionRuleId: $detectionRuleId
      capabilityAbstractionId: $capabilityAbstractionId
      tacticRef: $tacticRef
      techniqueRef: $techniqueRef
      criteria: $criteria
      positionX: $positionX
      positionY: $positionY
    ) {
      node {
        id
      }
    }
  }
`;

const DELETE_MVE_NODE_MUTATION = gql`
  mutation DeleteMveNode($nodeId: UUID!) {
    deleteMveNode(nodeId: $nodeId) {
      ok
    }
  }
`;

const ADD_MVE_EDGE_MUTATION = gql`
  mutation AddMveEdge($draftId: UUID!, $sourceNodeId: UUID!, $targetNodeId: UUID!) {
    addMveEdge(draftId: $draftId, sourceNodeId: $sourceNodeId, targetNodeId: $targetNodeId) {
      edge {
        id
      }
    }
  }
`;

const DELETE_MVE_EDGE_MUTATION = gql`
  mutation DeleteMveEdge($edgeId: UUID!) {
    deleteMveEdge(edgeId: $edgeId) {
      ok
    }
  }
`;

const START_MVE_VALIDATION_MUTATION = gql`
  mutation StartMveValidation($draftId: UUID!) {
    startMveValidation(draftId: $draftId) {
      success
      message
      validationRun {
        id
        status
      }
    }
  }
`;

const EXPORT_MVE_YAML_MUTATION = gql`
  mutation ExportMveOpenTideYaml(
    $draftId: UUID!
    $mode: String
    $repositoryId: ID
    $branch: String
    $filePath: String
    $commitMessage: String
    $targetGraphId: UUID
  ) {
    exportMveOpenTideYaml(
      draftId: $draftId
      mode: $mode
      repositoryId: $repositoryId
      branch: $branch
      filePath: $filePath
      commitMessage: $commitMessage
      targetGraphId: $targetGraphId
    ) {
      success
      message
      yamlText
      url
      generatedFileName
      mveDraft {
        id
        status
      }
    }
  }
`;

type DraftRow = {
  id: string;
  name: string;
  status: string;
  anchorEntity: string;
  maxTotalSpanMs: number;
  isAdvopsValidated: boolean;
  updatedAt: string;
};

type DraftNode = {
  id: string;
  stepOrder: number;
  nodeType: 'EVENT' | 'RULE';
  label: string;
  tacticRef?: string;
  techniqueRef?: string;
  criteria?: Record<string, unknown>;
  positionX: number;
  positionY: number;
  dataSource?: { id: string; name: string } | null;
  detectionRule?: { id: string; title: string; format?: string } | null;
  capabilityAbstraction?: {
    id: string;
    abstractionLayer: string;
    componentArtifact: string;
    technique?: { techniqueId: string; name: string } | null;
  } | null;
};

type AddNodeFormValues = {
  nodeType: 'EVENT' | 'RULE';
  stepOrder?: number;
  label?: string;
  dataSourceId?: string;
  detectionRuleId?: string;
  capabilityAbstractionId?: string;
  tacticRef?: string;
  techniqueRef?: string;
  criteriaText?: string;
};

type ExportMode = 'SAVE' | 'PUSH_GIT' | 'APPEND_WORKBENCH';

type AbstractionOption = {
  value: string;
  label: string;
  techniqueId: string;
};

type ExportFormValues = {
  repositoryId?: string;
  branch?: string;
  filePath?: string;
  commitMessage?: string;
  targetGraphId?: string;
};

const CARD_HEIGHT = 620;
const ACTION_ICON_BUTTON_STYLE: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 10,
  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.06)',
};
const TOOLTIP_STYLE: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  borderRadius: 8,
  padding: '6px 10px',
};

const MveWorkbenchTab: React.FC = () => {
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [yamlPreview, setYamlPreview] = useState<string>('');
  const [yamlOpen, setYamlOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportMode, setExportMode] = useState<ExportMode>('SAVE');
  const [addNodeOpen, setAddNodeOpen] = useState(false);
  const [constraintsForm] = Form.useForm();
  const [addNodeForm] = Form.useForm<AddNodeFormValues>();
  const [exportForm] = Form.useForm<ExportFormValues>();

  const { data: draftsData, loading: draftsLoading, refetch: refetchDrafts } = useQuery<{ allMveDrafts: DraftRow[] }>(
    GET_MVE_DRAFTS_QUERY,
    { fetchPolicy: 'network-only' }
  );
  const { data: optionsData, loading: optionsLoading } = useQuery(GET_MVE_OPTIONS_QUERY, { fetchPolicy: 'cache-and-network' });
  const {
    data: selectedDraftData,
    loading: selectedDraftLoading,
    refetch: refetchSelectedDraft,
  } = useQuery(
    GET_MVE_DRAFT_QUERY,
    {
      variables: { id: selectedDraftId },
      skip: !selectedDraftId,
      fetchPolicy: 'network-only',
    }
  );
  const {
    data: validationData,
    stopPolling,
  } = useQuery(
    GET_MVE_VALIDATION_QUERY,
    {
      variables: { id: activeRunId },
      skip: !activeRunId,
      pollInterval: activeRunId ? 2000 : 0,
      fetchPolicy: 'network-only',
    }
  );

  const [createDraft, { loading: creatingDraft }] = useMutation(CREATE_MVE_DRAFT_MUTATION);
  const [updateDraft, { loading: savingConstraints }] = useMutation(UPDATE_MVE_DRAFT_MUTATION);
  const [deleteDraft, { loading: deletingDraft }] = useMutation(DELETE_MVE_DRAFT_MUTATION);
  const [addNode, { loading: addingNode }] = useMutation(ADD_MVE_NODE_MUTATION);
  const [updateNode] = useMutation(UPDATE_MVE_NODE_MUTATION);
  const [deleteNode, { loading: deletingNode }] = useMutation(DELETE_MVE_NODE_MUTATION);
  const [addEdgeMutation] = useMutation(ADD_MVE_EDGE_MUTATION);
  const [deleteEdgeMutation] = useMutation(DELETE_MVE_EDGE_MUTATION);
  const [startValidation, { loading: startingValidation }] = useMutation(START_MVE_VALIDATION_MUTATION);
  const [exportYaml, { loading: exportingYaml }] = useMutation(EXPORT_MVE_YAML_MUTATION);

  const selectedDraft = selectedDraftData?.mveDraft ?? null;
  const dataSources = optionsData?.allDataSources ?? [];
  const rules = optionsData?.searchAllRules ?? [];
  const abstractions = optionsData?.capabilityAbstractions ?? [];
  const repositories = optionsData?.allRuleRepositories ?? [];
  const appendTargets = optionsData?.mveAppendTargets ?? [];

  useEffect(() => {
    const available = draftsData?.allMveDrafts ?? [];
    if (!available.length) {
      setSelectedDraftId(null);
      return;
    }
    if (!selectedDraftId || !available.some((item) => item.id === selectedDraftId)) {
      setSelectedDraftId(available[0].id);
    }
  }, [draftsData?.allMveDrafts, selectedDraftId]);

  useEffect(() => {
    if (!selectedDraft) return;
    constraintsForm.setFieldsValue({
      name: selectedDraft.name,
      anchorEntity: selectedDraft.anchorEntity,
      maxTotalSpanMs: selectedDraft.maxTotalSpanMs,
    });
    const mappedNodes: Node[] = (selectedDraft.nodes || []).map((node: DraftNode) => {
      const sourceLabel = node.nodeType === 'EVENT'
        ? node.dataSource?.name || 'Data source'
        : node.detectionRule?.title || 'Rule';
      const capLabel = node.capabilityAbstraction?.componentArtifact || 'Unbound abstraction';
      const label = `${node.stepOrder}. ${node.label || sourceLabel}`;
      return {
        id: node.id,
        position: { x: node.positionX || 120, y: node.positionY || 120 },
        data: {
          label: (
            <div>
              <div style={{ fontWeight: 600 }}>{label}</div>
              <div style={{ fontSize: 11 }}>{capLabel}</div>
            </div>
          ),
          nodeType: node.nodeType,
        },
        style: {
          width: 230,
          borderRadius: 8,
          border: node.nodeType === 'EVENT' ? '2px solid #1677ff' : '2px solid #fa8c16',
          background: '#ffffff',
        },
      };
    });
    const mappedEdges: Edge[] = (selectedDraft.edges || []).map((edge: any) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      markerEnd: { type: 'arrowclosed' as any },
    }));
    setNodes(mappedNodes);
    setEdges(mappedEdges);
  }, [selectedDraft, constraintsForm, setNodes, setEdges]);

  useEffect(() => {
    if (!activeRunId || !validationData?.mveValidationRun) return;
    const run = validationData.mveValidationRun;
    if (run.status === 'COMPLETED' || run.status === 'FAILED') {
      stopPolling();
      setActiveRunId(null);
      refetchSelectedDraft();
      message.info(run.status === 'COMPLETED' ? 'MVE validation finished.' : 'MVE validation failed.');
    }
  }, [activeRunId, validationData, stopPolling, refetchSelectedDraft]);

  useEffect(() => {
    if (!exportOpen || !selectedDraft) return;
    exportForm.setFieldsValue({
      branch: exportForm.getFieldValue('branch') || 'main',
      commitMessage: exportForm.getFieldValue('commitMessage') || `Publish MVE VelocityDetection: ${selectedDraft.name}`,
      filePath: exportForm.getFieldValue('filePath') || '',
    });
  }, [exportOpen, selectedDraft, exportForm]);

  const abstractionOptions = useMemo<AbstractionOption[]>(
    () =>
      abstractions.map((item: any) => ({
        value: item.id,
        label: `${item.abstractionLayer} :: ${item.componentArtifact} (${item.technique?.techniqueId || 'N/A'})`,
        techniqueId: item.technique?.techniqueId || '',
      })),
    [abstractions]
  );

  const handleCreateDraft = async () => {
    const name = window.prompt('Name this Velocity chain', 'New Velocity Chain');
    if (!name) return;
    try {
      const result = await createDraft({
        variables: {
          name,
          anchorEntity: 'host.hostname',
          maxTotalSpanMs: 800,
        },
      });
      const newId = result.data?.createMveDraft?.mveDraft?.id as string | undefined;
      await refetchDrafts();
      if (newId) {
        setSelectedDraftId(newId);
      }
      message.success('MVE draft created.');
    } catch (error: any) {
      message.error(error?.message || 'Failed to create MVE draft.');
    }
  };

  const handleDeleteDraft = async () => {
    if (!selectedDraftId) return;
    if (!window.confirm('Delete this MVE draft and all nodes/edges?')) return;
    try {
      await deleteDraft({ variables: { draftId: selectedDraftId } });
      setSelectedDraftId(null);
      await refetchDrafts();
      message.success('MVE draft deleted.');
    } catch (error: any) {
      message.error(error?.message || 'Failed to delete draft.');
    }
  };

  const handleSaveConstraints = async () => {
    if (!selectedDraftId) return;
    try {
      const values = await constraintsForm.validateFields();
      await updateDraft({
        variables: {
          draftId: selectedDraftId,
          name: values.name,
          anchorEntity: values.anchorEntity,
          maxTotalSpanMs: Number(values.maxTotalSpanMs),
        },
      });
      await Promise.all([refetchSelectedDraft(), refetchDrafts()]);
      message.success('MVE constraints saved.');
    } catch (error: any) {
      message.error(error?.message || 'Failed to save constraints.');
    }
  };

  const handleAddNode = async () => {
    if (!selectedDraftId) return;
    try {
      const values = await addNodeForm.validateFields();
      let parsedCriteria: Record<string, unknown> = {};
      if (values.criteriaText && values.criteriaText.trim()) {
        parsedCriteria = JSON.parse(values.criteriaText);
      }
      await addNode({
        variables: {
          draftId: selectedDraftId,
          nodeType: values.nodeType,
          stepOrder: values.stepOrder || null,
          label: values.label || '',
          dataSourceId: values.nodeType === 'EVENT' ? values.dataSourceId : null,
          detectionRuleId: values.nodeType === 'RULE' ? values.detectionRuleId : null,
          capabilityAbstractionId: values.capabilityAbstractionId || null,
          tacticRef: values.tacticRef || null,
          techniqueRef: values.techniqueRef || null,
          criteria: parsedCriteria,
          positionX: 120 + Math.random() * 240,
          positionY: 120 + Math.random() * 240,
        },
      });
      setAddNodeOpen(false);
      addNodeForm.resetFields();
      await refetchSelectedDraft();
      message.success('Node added.');
    } catch (error: any) {
      if (error?.message?.includes('JSON')) {
        message.error('Criteria must be valid JSON.');
      } else if (error?.errorFields) {
        return;
      } else {
        message.error(error?.message || 'Failed to add node.');
      }
    }
  };

  const handleDeleteSelectedNode = async () => {
    if (!selectedNodeId) return;
    try {
      await deleteNode({ variables: { nodeId: selectedNodeId } });
      setSelectedNodeId(null);
      await refetchSelectedDraft();
      message.success('Node deleted.');
    } catch (error: any) {
      message.error(error?.message || 'Failed to delete node.');
    }
  };

  const handleValidation = async () => {
    if (!selectedDraftId) return;
    try {
      const result = await startValidation({ variables: { draftId: selectedDraftId } });
      const payload = result.data?.startMveValidation;
      if (!payload?.success) {
        message.error(payload?.message || 'Failed to queue validation.');
        return;
      }
      const runId = payload.validationRun?.id as string | undefined;
      if (runId) {
        setActiveRunId(runId);
      }
      message.success(payload.message || 'Validation queued.');
    } catch (error: any) {
      message.error(error?.message || 'Failed to start validation.');
    }
  };

  const openExportModal = () => {
    if (!selectedDraftId) return;
    setExportMode('SAVE');
    exportForm.setFieldsValue({
      repositoryId: undefined,
      branch: 'main',
      filePath: '',
      commitMessage: selectedDraft ? `Publish MVE VelocityDetection: ${selectedDraft.name}` : '',
      targetGraphId: undefined,
    });
    setExportOpen(true);
  };

  const downloadYamlToPc = (yamlText: string, fileName: string) => {
    const blob = new Blob([yamlText], { type: 'text/yaml;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(href);
  };

  const handleExportAction = async () => {
    if (!selectedDraftId) return;
    try {
      const values = await exportForm.validateFields();
      const variables: Record<string, unknown> = {
        draftId: selectedDraftId,
        mode: exportMode,
      };
      if (exportMode === 'PUSH_GIT') {
        variables.repositoryId = values.repositoryId;
        variables.branch = values.branch || 'main';
        variables.filePath = values.filePath || null;
        variables.commitMessage = values.commitMessage || null;
      }
      if (exportMode === 'APPEND_WORKBENCH') {
        variables.targetGraphId = values.targetGraphId;
      }

      const result = await exportYaml({ variables });
      const payload = result.data?.exportMveOpenTideYaml;
      if (!payload?.success) {
        message.error(payload?.message || 'Export failed.');
        return;
      }

      const yamlText = payload.yamlText || '';
      const generatedName = payload.generatedFileName || `mve-${selectedDraftId}.yaml`;
      if (exportMode === 'SAVE') {
        downloadYamlToPc(yamlText, generatedName);
      }
      if (exportMode === 'PUSH_GIT' && payload.url) {
        window.open(payload.url, '_blank', 'noopener,noreferrer');
      }

      setYamlPreview(yamlText);
      setYamlOpen(true);
      setExportOpen(false);
      await Promise.all([refetchSelectedDraft(), refetchDrafts()]);
      message.success(payload.message || 'Export completed.');
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.message || 'Export failed.');
    }
  };

  const handleConnect = async (connection: Connection) => {
    if (!selectedDraftId || !connection.source || !connection.target) return;
    setEdges((existing) => addEdge(connection, existing));
    try {
      await addEdgeMutation({
        variables: {
          draftId: selectedDraftId,
          sourceNodeId: connection.source,
          targetNodeId: connection.target,
        },
      });
      await refetchSelectedDraft();
    } catch (error: any) {
      message.error(error?.message || 'Failed to create edge.');
      await refetchSelectedDraft();
    }
  };

  const handleNodeDragStop = async (_event: React.MouseEvent, node: Node) => {
    try {
      await updateNode({
        variables: {
          nodeId: node.id,
          positionX: node.position.x,
          positionY: node.position.y,
        },
      });
    } catch (error: any) {
      message.warning(error?.message || 'Could not persist node position.');
    }
  };

  const handleEdgeDoubleClick = async (_event: React.MouseEvent, edge: Edge) => {
    try {
      await deleteEdgeMutation({ variables: { edgeId: edge.id } });
      setEdges((existing) => existing.filter((item) => item.id !== edge.id));
    } catch (error: any) {
      message.error(error?.message || 'Failed to delete edge.');
    }
  };

  const draftOptions = (draftsData?.allMveDrafts || []).map((item) => ({
    value: item.id,
    label: `${item.name} (${item.status})`,
  }));

  const nodeType = Form.useWatch('nodeType', addNodeForm);

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Alert
        type="info"
        showIcon
        message="Machina Velocity Engine (MVE)"
        description="Build chain-sequence detections with capability abstractions, global velocity constraints, and asynchronous AdvOps/ACH validation."
      />

      <Row gutter={12}>
        <Col span={7}>
          <Card title="Drafts" style={{ height: CARD_HEIGHT }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Button onClick={handleCreateDraft} loading={creatingDraft} type="primary">
                  + New MVE Draft
                </Button>
                <Button danger onClick={handleDeleteDraft} loading={deletingDraft} disabled={!selectedDraftId}>
                  Delete
                </Button>
              </Space>
              <Select
                style={{ width: '100%' }}
                placeholder="Select draft"
                value={selectedDraftId || undefined}
                options={draftOptions}
                onChange={(value) => setSelectedDraftId(value)}
                loading={draftsLoading}
              />
              {selectedDraft && (
                <Card size="small">
                  <Space direction="vertical" size={4}>
                    <Typography.Text strong>{selectedDraft.name}</Typography.Text>
                    <Space>
                      <Tag color={selectedDraft.isAdvopsValidated ? 'green' : 'gold'}>
                        {selectedDraft.isAdvopsValidated ? 'AdvOps Validated' : 'Pending Validation'}
                      </Tag>
                      <Tag>{selectedDraft.status}</Tag>
                    </Space>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      Updated: {new Date(selectedDraft.updatedAt).toLocaleString()}
                    </Typography.Text>
                  </Space>
                </Card>
              )}

              <Card size="small" title="Global Constraints">
                <Form layout="vertical" form={constraintsForm}>
                  <Form.Item label="Name" name="name" rules={[{ required: true, message: 'Required' }]}>
                    <Input />
                  </Form.Item>
                  <Form.Item label="Anchor Entity" name="anchorEntity" rules={[{ required: true, message: 'Required' }]}>
                    <Input placeholder="host.hostname" />
                  </Form.Item>
                  <Form.Item label="Max Total Span (ms)" name="maxTotalSpanMs" rules={[{ required: true, message: 'Required' }]}>
                    <InputNumber min={1} style={{ width: '100%' }} />
                  </Form.Item>
                </Form>
                <Button block onClick={handleSaveConstraints} loading={savingConstraints} disabled={!selectedDraftId}>
                  Save Constraints
                </Button>
              </Card>

              <Space direction="vertical" style={{ width: '100%' }}>
                <Space wrap size={[8, 8]}>
                  <Tooltip
                    title="Add Node"
                    placement="top"
                    mouseEnterDelay={0.2}
                    overlayInnerStyle={TOOLTIP_STYLE}
                  >
                    <Button
                      type="primary"
                      shape="default"
                      size="large"
                      icon={<PlusOutlined />}
                      onClick={() => setAddNodeOpen(true)}
                      disabled={!selectedDraftId}
                      aria-label="Add Node"
                      style={ACTION_ICON_BUTTON_STYLE}
                    />
                  </Tooltip>
                  <Tooltip
                    title="Delete Selected Node"
                    placement="top"
                    mouseEnterDelay={0.2}
                    overlayInnerStyle={TOOLTIP_STYLE}
                  >
                    <Button
                      danger
                      shape="default"
                      size="large"
                      icon={<DeleteOutlined />}
                      onClick={handleDeleteSelectedNode}
                      disabled={!selectedNodeId}
                      loading={deletingNode}
                      aria-label="Delete Selected Node"
                      style={ACTION_ICON_BUTTON_STYLE}
                    />
                  </Tooltip>
                  <Tooltip
                    title="Validate with AdvOps"
                    placement="top"
                    mouseEnterDelay={0.2}
                    overlayInnerStyle={TOOLTIP_STYLE}
                  >
                  <Button
                    type="primary"
                    size="large"
                    icon={<SearchOutlined />}
                    onClick={handleValidation}
                    disabled={!selectedDraftId}
                    loading={startingValidation}
                    aria-label="Validate with AdvOps"
                    style={{ borderRadius: 10 }}
                  >
                    AdvOps
                  </Button>
                  </Tooltip>
                  <Tooltip
                    title="Export OpenTide YAML"
                    placement="top"
                    mouseEnterDelay={0.2}
                    overlayInnerStyle={TOOLTIP_STYLE}
                  >
                  <Button
                    size="large"
                    icon={<ExportOutlined />}
                    onClick={openExportModal}
                    disabled={!selectedDraftId}
                    loading={exportingYaml}
                    aria-label="Export OpenTide YAML"
                    style={{ borderRadius: 10 }}
                  >
                    OpenTide
                  </Button>
                  </Tooltip>
                </Space>
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                  Tip: Hover action buttons for labels.
                </Typography.Text>
              </Space>
            </Space>
          </Card>
        </Col>
        <Col span={17}>
          <Card title="Kinetic Chain Canvas" style={{ height: CARD_HEIGHT }}>
            {selectedDraftLoading || optionsLoading ? (
              <Spin />
            ) : !selectedDraft ? (
              <Typography.Text type="secondary">Create or select an MVE draft to start.</Typography.Text>
            ) : (
              <>
                <div style={{ height: 520, border: '1px solid #f0f0f0', borderRadius: 8 }}>
                  <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={handleConnect}
                    onNodeDragStop={handleNodeDragStop}
                    onNodeClick={(_evt, node) => setSelectedNodeId(node.id)}
                    onPaneClick={() => setSelectedNodeId(null)}
                    onEdgeDoubleClick={handleEdgeDoubleClick}
                    fitView
                  >
                    <Background />
                    <Controls />
                  </ReactFlow>
                </div>
                <Space style={{ marginTop: 8 }}>
                  <Typography.Text type="secondary">
                    Double-click an edge to delete it. Drag nodes to persist placement.
                  </Typography.Text>
                  {selectedNodeId ? <Tag color="blue">Selected node: {selectedNodeId.slice(0, 8)}</Tag> : null}
                </Space>
              </>
            )}
          </Card>
        </Col>
      </Row>

      {validationData?.mveValidationRun && (
        <Alert
          type={validationData.mveValidationRun.status === 'FAILED' ? 'error' : 'info'}
          showIcon
          message={`Validation status: ${validationData.mveValidationRun.status}`}
          description={
            validationData.mveValidationRun.errorMessage
              ? validationData.mveValidationRun.errorMessage
              : `Run ID ${validationData.mveValidationRun.id}`
          }
        />
      )}

      <Modal
        title="Add MVE Node"
        open={addNodeOpen}
        onCancel={() => setAddNodeOpen(false)}
        onOk={handleAddNode}
        okButtonProps={{ loading: addingNode }}
        width={760}
      >
        <Form form={addNodeForm} layout="vertical" initialValues={{ nodeType: 'EVENT', criteriaText: '{}' }}>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="nodeType" label="Type" rules={[{ required: true }]}>
                <Select
                  options={[
                    { value: 'EVENT', label: 'Event (Data Catalog)' },
                    { value: 'RULE', label: 'Rule (Rule Hub)' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="stepOrder" label="Step Order">
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="label" label="Label">
                <Input placeholder="Optional custom label" />
              </Form.Item>
            </Col>
          </Row>

          {nodeType === 'EVENT' && (
            <Form.Item name="dataSourceId" label="Data Source" rules={[{ required: true, message: 'Required for EVENT node' }]}>
              <Select
                showSearch
                optionFilterProp="label"
                options={dataSources.map((item: any) => ({ value: item.id, label: item.name }))}
              />
            </Form.Item>
          )}

          {nodeType === 'RULE' && (
            <Form.Item name="detectionRuleId" label="Detection Rule" rules={[{ required: true, message: 'Required for RULE node' }]}>
              <Select
                showSearch
                optionFilterProp="label"
                options={rules.map((item: any) => ({ value: item.id, label: `[${item.format}] ${item.title}` }))}
              />
            </Form.Item>
          )}

          <Form.Item name="capabilityAbstractionId" label="Capability Abstraction Binding">
            <Select
              showSearch
              optionFilterProp="label"
              options={abstractionOptions}
              onChange={(value: string) => {
                const selected = abstractionOptions.find((item: AbstractionOption) => item.value === value);
                if (selected?.techniqueId) {
                  addNodeForm.setFieldValue('techniqueRef', selected.techniqueId);
                }
              }}
            />
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="tacticRef" label="Tactic Ref">
                <Input placeholder="TA0001" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="techniqueRef" label="Technique Ref">
                <Input placeholder="T1190" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="criteriaText" label="Criteria (JSON)">
            <Input.TextArea rows={6} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Export MVE VelocityDetection"
        open={exportOpen}
        onCancel={() => setExportOpen(false)}
        onOk={handleExportAction}
        okText={exportMode === 'SAVE' ? 'Download' : exportMode === 'PUSH_GIT' ? 'Push' : 'Append'}
        okButtonProps={{ loading: exportingYaml }}
        width={760}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Radio.Group
            value={exportMode}
            onChange={(event) => setExportMode(event.target.value as ExportMode)}
            options={[
              { label: 'Save to PC', value: 'SAVE' },
              { label: 'Push to Git', value: 'PUSH_GIT' },
              { label: 'Append to Workbench', value: 'APPEND_WORKBENCH' },
            ]}
            optionType="button"
            buttonStyle="solid"
          />

          <Form layout="vertical" form={exportForm}>
            {exportMode === 'PUSH_GIT' && (
              <>
                <Form.Item
                  name="repositoryId"
                  label="Configured Repository"
                  rules={[{ required: true, message: 'Select a repository' }]}
                >
                  <Select
                    showSearch
                    optionFilterProp="label"
                    options={repositories.map((repo: any) => ({
                      value: repo.id,
                      label: `${repo.name} (${repo.provider || 'N/A'})`,
                    }))}
                    placeholder="Select configured Git repository"
                  />
                </Form.Item>
                <Row gutter={12}>
                  <Col span={8}>
                    <Form.Item
                      name="branch"
                      label="Branch"
                      rules={[{ required: true, message: 'Branch required' }]}
                      initialValue="main"
                    >
                      <Input placeholder="main" />
                    </Form.Item>
                  </Col>
                  <Col span={16}>
                    <Form.Item name="filePath" label="File Path (optional)">
                      <Input placeholder="Objects/Velocity Detections/MVE-CHAIN-0001.yaml" />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item name="commitMessage" label="Commit Message (optional)">
                  <Input placeholder="Publish MVE VelocityDetection" />
                </Form.Item>
              </>
            )}

            {exportMode === 'APPEND_WORKBENCH' && (
              <Form.Item
                name="targetGraphId"
                label="Target Workbench (DEPLOYED + authored by you)"
                rules={[{ required: true, message: 'Select target workbench' }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={appendTargets.map((target: any) => ({
                    value: target.id,
                    label: `${target.title} (${target.status})`,
                  }))}
                  placeholder="Select Workbench"
                />
              </Form.Item>
            )}
          </Form>

          {exportMode === 'SAVE' && (
            <Alert
              type="info"
              showIcon
              message="Save to PC"
              description="Generates OpenTide YAML and downloads it directly to your machine."
            />
          )}
          {exportMode === 'PUSH_GIT' && (
            <Alert
              type="info"
              showIcon
              message="Push to Git"
              description="Pushes generated YAML to the selected configured repository."
            />
          )}
          {exportMode === 'APPEND_WORKBENCH' && (
            <Alert
              type="info"
              showIcon
              message="Append to Workbench"
              description="Appends this velocity chain to the target Workbench OpenTide YAML under mve_velocity_detections."
            />
          )}
        </Space>
      </Modal>

      <Modal
        title="OpenTide VelocityDetection YAML"
        open={yamlOpen}
        onCancel={() => setYamlOpen(false)}
        width={900}
        footer={[
          <Button key="copy" onClick={() => navigator.clipboard.writeText(yamlPreview || '')}>
            Copy YAML
          </Button>,
          <Button key="close" type="primary" onClick={() => setYamlOpen(false)}>
            Close
          </Button>,
        ]}
      >
        <Input.TextArea value={yamlPreview} rows={24} readOnly style={{ fontFamily: 'monospace' }} />
      </Modal>
    </Space>
  );
};

export default MveWorkbenchTab;
