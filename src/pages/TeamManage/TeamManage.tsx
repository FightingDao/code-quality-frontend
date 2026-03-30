import React, { useState, useEffect, useRef } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Space, Popconfirm, Tag, Typography, Card, Tooltip, type InputRef } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, TeamOutlined, CloseOutlined } from '@ant-design/icons';
import { request } from '../../api/client';
import './TeamManage.css';

const { Title, Text } = Typography;

interface TeamMember {
  id: string;
  username: string;
  email: string;
  isLeader: boolean;
}

interface Team {
  id: string;
  name: string;
  description: string | null;
  leaderName: string | null;
  memberCount: number;
  projectCount: number;
  members?: TeamMember[];
  createdAt: string;
  updatedAt: string;
}

interface AvailableUser {
  id: string;
  username: string;
  email: string;
}

export const TeamManage: React.FC = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [selectedMemberNames, setSelectedMemberNames] = useState<string[]>([]);
  
  // 动态标签状态
  const [inputVisible, setInputVisible] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<InputRef>(null);
  
  const [form] = Form.useForm();

  // 获取小组列表
  const fetchTeams = async () => {
    setLoading(true);
    try {
      const res = await request.get('/teams');
      if (res.success) {
        setTeams(res.data);
      }
    } catch (error) {
      message.error('获取小组列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取可用用户 (用于其他可能的参考，但在添加成员时不强制要求匹配)
  const fetchAvailableUsers = async () => {
    try {
      const res = await request.get('/teams/available-users');
      if (res.success) {
        setAvailableUsers(res.data);
      }
    } catch (error) {
      console.error('获取可用用户失败:', error);
    }
  };

  useEffect(() => {
    fetchTeams();
    fetchAvailableUsers();
  }, []);

  useEffect(() => {
    if (inputVisible) {
      inputRef.current?.focus();
    }
  }, [inputVisible]);

  // 打开新建/编辑弹窗
  const openModal = async (team?: Team) => {
    if (team) {
      // 编辑模式：请求详情以获取成员列表
      setLoading(true);
      try {
        const res = await request.get(`/teams/${team.id}`);
        if (res.success) {
          const fullTeam = res.data;
          setEditingTeam(fullTeam);
          form.setFieldsValue({
            name: fullTeam.name,
            description: fullTeam.description,
            leaderName: fullTeam.leaderName,
          });
          setSelectedMemberNames(fullTeam.members?.map((m: any) => m.username) || []);
          setModalVisible(true);
        }
      } catch (error) {
        message.error('获取小组详情失败');
      } finally {
        setLoading(false);
      }
    } else {
      // 新建模式
      setEditingTeam(null);
      form.resetFields();
      setSelectedMemberNames([]);
      setModalVisible(true);
    }
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      values.memberNames = selectedMemberNames;
      
      if (editingTeam) {
        // 更新
        const res = await request.put(`/teams/${editingTeam.id}`, values);
        if (res.success) {
          message.success('更新成功');
          setModalVisible(false);
          fetchTeams();
        }
      } else {
        // 新建
        const res = await request.post('/teams', values);
        if (res.success) {
          message.success('创建成功');
          setModalVisible(false);
          fetchTeams();
        }
      }
    } catch (error) {
      message.error(editingTeam ? '更新失败' : '创建失败');
    }
  };

  // 删除小组
  const handleDelete = async (teamId: string) => {
    try {
      const res = await request.delete(`/teams/${teamId}`);
      if (res.success) {
        message.success('删除成功');
        fetchTeams();
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  // 动态添加成员
  const handleInputConfirm = () => {
    if (inputValue && !selectedMemberNames.includes(inputValue)) {
      setSelectedMemberNames([...selectedMemberNames, inputValue]);
    }
    setInputVisible(false);
    setInputValue('');
  };

  // 从选中列表移除成员
  const removeMemberFromSelection = (username: string) => {
    setSelectedMemberNames(selectedMemberNames.filter(name => name !== username));
  };

  const columns = [
    {
      title: '小组名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      ellipsis: true,
      render: (text: string) => (
        <span style={{ fontWeight: 600, color: '#1890ff' }}>{text}</span>
      ),
    },
    {
      title: '组长',
      dataIndex: 'leaderName',
      key: 'leaderName',
      width: 120,
      render: (text: string) => text || <Tag color="default">未设置</Tag>,
    },
    {
      title: '成员数',
      dataIndex: 'memberCount',
      key: 'memberCount',
      width: 100,
      align: 'center' as const,
      render: (count: number) => (
        <Tag color="blue" style={{ borderRadius: 10, padding: '0 10px' }}>{count} 人</Tag>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text: string) => text || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      align: 'center' as const,
      render: (_: any, record: Team) => (
        <Space size="middle">
          <Tooltip title="编辑">
            <Button 
              type="text" 
              icon={<EditOutlined style={{ color: '#1890ff' }} />}
              onClick={() => openModal(record)}
            />
          </Tooltip>
          <Popconfirm
            title="确定要删除该小组吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button 
                type="text" 
                danger 
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="team-manage-page">
      <div className="page-header">
        <div className="header-left">
          <TeamOutlined className="header-icon" />
          <div className="header-text">
            <Title level={4}>小组管理</Title>
            <Text type="secondary">管理团队小组和成员信息</Text>
          </div>
        </div>
        <Button 
          type="primary" 
          icon={<PlusOutlined />}
          onClick={() => openModal()}
          style={{ borderRadius: 6 }}
        >
          新建小组
        </Button>
      </div>

      <Card className="table-card" bordered={false}>
        <Table
          columns={columns}
          dataSource={teams}
          rowKey="id"
          loading={loading}
          scroll={{ x: 800 }}
          bordered
          className="team-table"
          pagination={{
            showTotal: (total) => `共 ${total} 条`,
            showSizeChanger: true,
            defaultPageSize: 10,
          }}
        />
      </Card>

      {/* 新建/编辑小组弹窗 */}
      <Modal
        title={editingTeam ? '编辑小组' : '新建小组'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText={editingTeam ? '保存' : '创建'}
        cancelText="取消"
        width={500}
        className="team-modal"
      >
        <Form
          form={form}
          layout="vertical"
          className="team-form"
        >
          <Form.Item
            name="name"
            label="小组名称"
            rules={[{ required: true, message: '请输入小组名称' }]}
          >
            <Input placeholder="请输入小组名称" maxLength={50} />
          </Form.Item>

          <Form.Item
            name="leaderName"
            label="组长姓名"
          >
            <Input placeholder="请输入组长姓名" maxLength={20} />
          </Form.Item>

          <Form.Item
            name="description"
            label="小组描述"
          >
            <Input.TextArea 
              placeholder="请输入小组描述" 
              rows={3} 
              maxLength={200}
              showCount
            />
          </Form.Item>

          <Form.Item label="管理成员" extra="输入用户名后按回车添加成员">
            <div className="tags-input-wrapper">
              {selectedMemberNames.map((username) => (
                <Tag
                  key={username}
                  closable
                  onClose={() => removeMemberFromSelection(username)}
                  className="member-tag"
                  closeIcon={<CloseOutlined style={{ fontSize: 10 }} />}
                >
                  {username}
                </Tag>
              ))}
              {inputVisible ? (
                <Input
                  ref={inputRef}
                  type="text"
                  size="small"
                  style={{ width: 120 }}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onBlur={handleInputConfirm}
                  onPressEnter={handleInputConfirm}
                />
              ) : (
                <Tag onClick={() => setInputVisible(true)} className="new-tag-btn">
                  <PlusOutlined /> 添加成员
                </Tag>
              )}
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
