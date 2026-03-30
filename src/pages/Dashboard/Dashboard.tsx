import React, { useState, useEffect, useCallback } from 'react';
import { Row, Col, Table, Select, Typography, message, Button, Space, DatePicker } from 'antd';
import { SearchOutlined, EyeOutlined, DownOutlined, UpOutlined } from '@ant-design/icons';
import { KPICard } from '../../components/KPICard';
import { PeriodSelector } from '../../components/PeriodSelector';
import { usePeriodStore } from '../../stores/periodStore';
import { request } from '../../api/client';
import type { KPICardData } from '../../types';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import isoWeek from 'dayjs/plugin/isoWeek';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import './Dashboard.css';

dayjs.extend(weekOfYear);
dayjs.extend(isoWeek);
dayjs.extend(advancedFormat);

const { Title } = Typography;
const { Option } = Select;

interface DashboardOverview {
  totalMembers: number;
  totalCommits: number;
  totalTasks: number;
  avgQualityScore: string | null;
}

interface TeamDashboard {
  id: string;
  name: string;
  leader: string;
  totalMembers: number;
  avgQualityScore: string | null;
  totalCommits: number;
  totalTasks: number;
}

interface CodeAnalysisItem {
  id: string;
  userName: string;
  userId: string;
  teamName: string;
  projectName: string;
  projectId: string;
  projectIds: string[];
  insertions: number;
  deletions: number;
  commitCount: number;
  totalTasks: number;
  aiQualityScore: string | null;
  qualityLevel: string;
}

export const Dashboard: React.FC = () => {
  const { periodType } = usePeriodStore();
  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [teamDashboards, setTeamDashboards] = useState<TeamDashboard[]>([]);
  const [analyses, setAnalyses] = useState<CodeAnalysisItem[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [isTeamsExpanded, setIsTeamsExpanded] = useState(true);
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs>(dayjs());
  const navigate = useNavigate();

  // 筛选状态
  const [filters, setFilters] = useState({
    teamId: '',
    projectId: '',
    userName: '',
    version: '',
  });

  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [versions, setVersions] = useState<{ value: string; label: string }[]>([]);

  // 格式化日期逻辑
  const getFormattedPeriodValue = useCallback(() => {
    if (periodType === 'week') {
      // 周维度：返回当周周四的日期 (YYYYMMDD)
      // dayjs().day(4) 返回本周周四
      return selectedDate.day(4).format('YYYYMMDD');
    } else if (periodType === 'month') {
      // 月维度：返回 YYYYMM
      return selectedDate.format('YYYYMM');
    }
    return selectedDate.format('YYYYMMDD');
  }, [periodType, selectedDate]);

  // 获取当前的 periodValue（用于跳转）
  const periodValue = getFormattedPeriodValue();

  const fetchDashboardData = async () => {
    setLoading(true);
    const periodValue = getFormattedPeriodValue();
    try {
      const [overviewRes, teamsRes, analysesRes] = await Promise.all([
        request.get('/dashboard/overview', { periodType, periodValue }),
        request.get('/dashboard/teams', { periodType, periodValue }),
        request.get('/dashboard/analyses', { periodType, periodValue, page: 1, limit: 10, sortBy: 'insertions', sortOrder: 'desc' }),
      ]);

      if (overviewRes.success) setOverview(overviewRes.data);
      if (teamsRes.success) setTeamDashboards(teamsRes.data);
      if (analysesRes.success) {
        setAnalyses(analysesRes.data);
        setPagination({
          current: analysesRes.meta.page,
          pageSize: analysesRes.meta.limit,
          total: analysesRes.meta.total,
        });
      }
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchFilters = async () => {
    const periodValue = getFormattedPeriodValue();
    try {
      const res = await request.get('/dashboard/filter-options', { periodType, periodValue });
      if (res.success) {
        setTeams(res.data.teams || []);
        setProjects(res.data.projects || []);
        setUsers(res.data.users || []);
        setVersions(res.data.versions || []);
      }
    } catch (error) {
      console.error('加载筛选数据失败:', error);
    }
  };

  const fetchAnalyses = async (page: number, limit: number, sortField?: string, sortOrder?: string, customFilters?: typeof filters) => {
    setLoading(true);
    const periodValue = getFormattedPeriodValue();
    try {
      const params: any = {
        periodType,
        periodValue,
        page,
        limit,
        ...(customFilters || filters)
      };
      
      // 添加排序参数（默认按新增行倒序）
      params.sortBy = sortField || 'insertions';
      params.sortOrder = sortOrder || 'desc';
      
      const res = await request.get('/dashboard/analyses', params);
      if (res.success) {
        setAnalyses(res.data);
        setPagination({
          current: res.meta.page,
          pageSize: res.meta.limit,
          total: res.meta.total,
        });
      }
    } catch (error) {
      message.error('加载分析列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    fetchFilters();
    fetchAnalyses(1, 10, 'insertions', 'desc');
  }, [periodType, selectedDate]);

  const kpiData: Array<{ data: KPICardData; iconType: 'user' | 'commit' | 'task' | 'trophy' }> = overview
    ? [
        { data: { title: '总成员数', value: overview.totalMembers }, iconType: 'user' },
        { data: { title: '代码提交总次数', value: overview.totalCommits }, iconType: 'commit' },
        { data: { title: '灵犀总任务数', value: overview.totalTasks }, iconType: 'task' },
        { data: { title: 'AI分析平均代码质量', value: overview.avgQualityScore ? Number(overview.avgQualityScore).toFixed(1) : '0', tips: '满分10分，由AI根据代码规范、复杂度、可维护性等维度综合评估' }, iconType: 'trophy' },
      ]
    : [];

  // 排序状态（默认按新增行倒序）
  const [sortField, setSortField] = React.useState<string>('insertions');
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('desc');

  const columns = [
    {
      title: '成员姓名',
      dataIndex: 'userName',
      key: 'userName',
      render: (text: string, record: CodeAnalysisItem) => (
        <span 
          className="user-link"
          onClick={() => navigate(`/users/${record.userId}?projectId=${record.projectId}&periodType=${periodType}&periodValue=${periodValue}`)}
        >
          {text}
        </span>
      ),
    },
    { title: '所在小组', dataIndex: 'teamName', key: 'teamName' },
    { 
      title: '负责项目', 
      dataIndex: 'projectName', 
      key: 'projectName',
      render: (text: string) => <span title={text}>{text}</span>,
    },
    {
      title: '新增行',
      dataIndex: 'insertions',
      key: 'insertions',
      sorter: true,
      defaultSortOrder: 'descend',
      align: 'center' as const,
      render: (val: number) => <span style={{ color: '#52c41a', fontWeight: 500 }}>+{val?.toLocaleString() || 0}</span>,
    },
    {
      title: '删除行',
      dataIndex: 'deletions',
      key: 'deletions',
      sorter: true,
      align: 'center' as const,
      render: (val: number) => <span style={{ color: '#f5222d', fontWeight: 500 }}>-{val?.toLocaleString() || 0}</span>,
    },
    {
      title: '提交次数',
      dataIndex: 'commitCount',
      key: 'commitCount',
      sorter: true,
      align: 'center' as const,
    },
    {
      title: '任务数',
      dataIndex: 'totalTasks',
      key: 'totalTasks',
      sorter: true,
      align: 'center' as const,
    },
    {
      title: '代码质量',
      dataIndex: 'aiQualityScore',
      key: 'aiQualityScore',
      sorter: true,
      align: 'center' as const,
      render: (score: string) => {
        const numScore = parseFloat(score);
        let color = '#52c41a';
        if (numScore < 6) color = '#f5222d';
        else if (numScore < 7) color = '#faad14';
        else if (numScore < 8) color = '#52c41a';
        else color = '#1890ff';
        return <span style={{ color, fontWeight: 'bold' }}>{score}</span>;
      },
    },
    {
      title: '详情',
      key: 'action',
      align: 'center' as const,
      render: (_: any, record: CodeAnalysisItem) => (
        <Space onClick={() => navigate(`/users/${record.userId}?projectId=${record.projectId}&periodType=${periodType}&periodValue=${periodValue}`)} style={{ cursor: 'pointer', color: '#666' }}>
          <EyeOutlined />
          <span>查看</span>
        </Space>
      ),
    },
  ];

  // 处理排序变化
  const handleTableChange = (pagination: any, _filters: any, sorter: any) => {
    // sorter.order: 'descend' | 'ascend' | null
    const sortField = sorter.field || 'insertions';
    const sortOrder = sorter.order === 'ascend' ? 'asc' : 'desc';
    
    fetchAnalyses(pagination.current || 1, pagination.pageSize || 10, sortField, sortOrder);
  };

  // 计算周信息
  const getWeekInfo = () => {
    if (periodType !== 'week') return null;
    const weekNum = selectedDate.week();
    const month = selectedDate.month() + 1;
    // 计算本周周一和周日
    const monday = selectedDate.day(1);
    const sunday = selectedDate.day(7);
    return {
      weekInMonth: `${month}月第${weekNum - dayjs(selectedDate).startOf('month').week() + 1}周`,
      dateRange: `${monday.format('MM-DD')} ~ ${sunday.format('MM-DD')}`
    };
  };

  const weekInfo = getWeekInfo();

  return (
    <div className="dashboard">
      <div className="dashboard-page-header">
        <Space size="large">
          <div className="filter-group">
            <span className="filter-label">统计维度：</span>
            <PeriodSelector />
          </div>
          <div className="filter-group">
            <span className="filter-label">时间范围：</span>
            <DatePicker
              picker={periodType === 'week' ? 'week' : 'month'}
              value={selectedDate}
              onChange={(date) => date && setSelectedDate(date)}
              format={periodType === 'week' ? 'YYYY-WW[周]' : 'YYYY-MM'}
              allowClear={false}
              className="custom-range-picker"
            />
            {weekInfo && (
              <span className="week-info-text" style={{ marginLeft: 8, color: '#666', fontSize: 13 }}>
                （{weekInfo.weekInMonth}，{weekInfo.dateRange}）
              </span>
            )}
          </div>
        </Space>
      </div>

      <div className="kpi-section">
        <Row gutter={24}>
          {kpiData.map((item, index) => (
            <Col span={6} key={index}>
              <KPICard data={item.data} loading={loading} iconType={item.iconType} />
            </Col>
          ))}
        </Row>
      </div>

      <div className="section-card team-section">
        <div className="section-header">
          <Title level={5} style={{ margin: 0 }}>各组整体分析报告</Title>
          <Button
            type="link"
            onClick={() => setIsTeamsExpanded(!isTeamsExpanded)}
            icon={isTeamsExpanded ? <UpOutlined /> : <DownOutlined />}
            style={{ color: '#1890ff' }}
          >
            {isTeamsExpanded ? '收起全部' : '展开全部'}
          </Button>
        </div>
        {isTeamsExpanded && (
          <Row gutter={[24, 24]} style={{ marginTop: 16 }}>
            {teamDashboards.map((team) => (
              <Col span={8} key={team.id}>
                <div className="team-analysis-card">
                  <div className="team-card-top">
                    <span className="team-card-name">{team.name}</span>
                    <span className="team-card-leader">Leader: {team.leader || '未设置'}</span>
                  </div>
                  <div className="team-card-grid">
                    <div className="grid-item">
                      <div className="grid-label">成员数</div>
                      <div className="grid-value">{team.totalMembers}</div>
                    </div>
                    <div className="grid-item">
                      <div className="grid-label">平均质量</div>
                      <div className="grid-value">{team.avgQualityScore || '0.0'}</div>
                    </div>
                    <div className="grid-item">
                      <div className="grid-label">总提交量</div>
                      <div className="grid-value">{team.totalCommits}</div>
                    </div>
                    <div className="grid-item">
                      <div className="grid-label">总任务数</div>
                      <div className="grid-value">{team.totalTasks || 0}</div>
                    </div>
                  </div>
                  <Button
                    block
                    className="team-card-btn"
                    icon={<SearchOutlined />}
                    onClick={() => navigate(`/teams/${team.id}/report`)}
                  >
                    查看小组整体分析
                  </Button>
                </div>
              </Col>
            ))}
          </Row>
        )}
      </div>

      <div className="section-card analysis-section">
        <Title level={5} style={{ marginBottom: 20 }}>代码分析列表</Title>
        <div className="analysis-filter-bar" style={{ display: 'flex', alignItems: 'flex-end', gap: '16px' }}>
          <div className="filter-item" style={{ display: 'flex', flexDirection: 'column', minWidth: '140px' }}>
            <div className="filter-label">成员姓名</div>
            <Select
              style={{ width: '100%' }}
              placeholder="全部成员"
              value={filters.userName || undefined}
              onChange={(v) => setFilters({ ...filters, userName: v })}
              allowClear
            >
              <Option value="">全部成员</Option>
              {users.map(u => <Option key={u.id} value={u.name}>{u.name}</Option>)}
            </Select>
          </div>
          <div className="filter-item" style={{ display: 'flex', flexDirection: 'column', minWidth: '140px' }}>
            <div className="filter-label">小组</div>
            <Select
              style={{ width: '100%' }}
              placeholder="全部小组"
              value={filters.teamId || undefined}
              onChange={(v) => setFilters({ ...filters, teamId: v })}
              allowClear
            >
              <Option value="">全部小组</Option>
              {teams.map(t => <Option key={t.id} value={t.id}>{t.name}</Option>)}
            </Select>
          </div>
          <div className="filter-item" style={{ display: 'flex', flexDirection: 'column', minWidth: '140px' }}>
            <div className="filter-label">项目</div>
            <Select
              style={{ width: '100%' }}
              placeholder="全部项目"
              value={filters.projectId || undefined}
              onChange={(v) => setFilters({ ...filters, projectId: v })}
              allowClear
            >
              <Option value="">全部项目</Option>
              {projects.map(p => <Option key={p.id} value={p.id}>{p.name}</Option>)}
            </Select>
          </div>
          <Button 
            type="primary" 
            icon={<SearchOutlined />}
            onClick={() => fetchAnalyses(1, pagination.pageSize)}
            style={{ minWidth: '80px', height: '32px' }}
          >
            搜索
          </Button>
          <Button 
            onClick={() => {
              const emptyFilters = { teamId: '', projectId: '', userName: '', version: '' };
              setFilters(emptyFilters);
              fetchAnalyses(1, pagination.pageSize, undefined, undefined, emptyFilters);
            }}
            style={{ minWidth: '80px', height: '32px' }}
          >
            重置
          </Button>
        </div>

        <Table
          className="custom-analysis-table"
          columns={columns}
          dataSource={analyses}
          rowKey="id"
          loading={loading}
          bordered
          pagination={{
            ...pagination,
            showTotal: (total, range) => `显示 ${range[0]} 到 ${range[1]} 条，共 ${total} 条`,
          }}
          onChange={handleTableChange}
        />
      </div>
    </div>
  );
};