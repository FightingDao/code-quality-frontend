import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Typography, Space, Select, Row, Col, DatePicker, message, Button } from 'antd';
import { EyeOutlined, FileTextOutlined, SearchOutlined, BugOutlined } from '@ant-design/icons';
import { KPICard } from '../../components/KPICard';
import { PeriodSelector } from '../../components/PeriodSelector';
import { usePeriodStore } from '../../stores/periodStore';
import { request } from '../../api/client';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import isoWeek from 'dayjs/plugin/isoWeek';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import './ProjectOverview.css';

dayjs.extend(weekOfYear);
dayjs.extend(isoWeek);
dayjs.extend(advancedFormat);

const { Title } = Typography;
const { Option } = Select;

export const ProjectOverview: React.FC = () => {
  const { periodType } = usePeriodStore();
  const [loading, setLoading] = useState(false);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [allAnalyses, setAllAnalyses] = useState<any[]>([]); // 所有项目数据，用于统计卡片
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs>(dayjs());
  // const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [versions, setVersions] = useState<{ value: string; label: string }[]>([]);
  const [filters, setFilters] = useState({
    // teamId: '',
    projectId: '',
    userName: '',
    version: '',
  });
  const navigate = useNavigate();

  const getFormattedPeriodValue = useCallback(() => {
    if (periodType === 'week') {
      return selectedDate.day(4).format('YYYYMMDD');
    }
    return selectedDate.format('YYYYMM');
  }, [periodType, selectedDate]);

  // 计算周信息
  const getWeekInfo = () => {
    if (periodType !== 'week') return null;
    const weekNum = selectedDate.week();
    const month = selectedDate.month() + 1;
    const monday = selectedDate.day(1);
    const sunday = selectedDate.day(7);
    return {
      weekInMonth: `${month}月第${weekNum - dayjs(selectedDate).startOf('month').week() + 1}周`,
      dateRange: `${monday.format('MM-DD')} ~ ${sunday.format('MM-DD')}`
    };
  };

  const weekInfo = getWeekInfo();

  // 获取当前的 periodValue（用于跳转）
  const periodValue = getFormattedPeriodValue();

  useEffect(() => {
    fetchAllAnalyses(); // 获取所有项目数据（统计卡片）
    fetchAnalyses();    // 获取筛选后的数据（表格）
    fetchFilterOptions();
  }, [periodType, selectedDate]);

  const fetchFilterOptions = async () => {
    const periodValue = getFormattedPeriodValue();
    try {
      const res = await request.get('/dashboard/filter-options', { periodType, periodValue });
      if (res.success) {
        // setTeams(res.data.teams || []);
        setProjects(res.data.projects || []);
        setUsers(res.data.users || []);
        setVersions(res.data.versions || []);
      }
    } catch (e) {
      console.error('加载筛选选项失败');
    }
  };

  // 获取所有项目数据（用于统计卡片，不受筛选影响）
  const fetchAllAnalyses = async () => {
    const periodValue = getFormattedPeriodValue();
    try {
      const params: any = {
        periodType,
        periodValue,
        page: 1,
        limit: 1000,
      };
      const res = await request.get('/dashboard/project-analyses', params);
      if (res.success) {
        setAllAnalyses(res.data);
      }
    } catch (error) {
      console.error('加载统计数据失败');
    }
  };

  // 获取筛选后的数据（用于表格）
  const fetchAnalyses = async (customFilters?: typeof filters) => {
    setLoading(true);
    const periodValue = getFormattedPeriodValue();
    try {
      const params: any = {
        periodType,
        periodValue,
        page: 1,
        limit: 1000,
      };
      const currentFilters = customFilters || filters;
      // 添加筛选条件
      if (currentFilters.projectId) params.projectId = currentFilters.projectId;
      if (currentFilters.userName) params.userName = currentFilters.userName;
      if (currentFilters.version) params.version = currentFilters.version;
      
      // 使用项目维度接口
      const res = await request.get('/dashboard/project-analyses', params);
      if (res.success) {
        setAnalyses(res.data);
      }
    } catch (error) {
      message.error('加载项目概览失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchAnalyses();
  };

  const handleReset = () => {
    const emptyFilters = { projectId: '', userName: '', version: '' };
    setFilters(emptyFilters as any);
    fetchAnalyses(emptyFilters as any);
  };

  // 表格数据（根据筛选条件）
  const tableData = analyses.map((item, index) => ({
    ...item,
    key: item.projectId || index,
  }));

  // 统计卡片数据（所有项目，不受筛选影响）
  const uniqueProjects = allAnalyses.length;
  const totalInsertions = allAnalyses.reduce((sum, a) => sum + (a.insertions || 0), 0);
  const totalDeletions = allAnalyses.reduce((sum, a) => sum + (a.deletions || 0), 0);

  const columns: any = [
    // { title: '小组', dataIndex: 'teamName' },
    { title: '项目', dataIndex: 'projectName' },
    { title: '当前版本', dataIndex: 'branch' },
    { title: '对比版本', dataIndex: 'compareVersion' },
    { title: '提交次数', dataIndex: 'commitCount', sorter: (a: any, b: any) => a.commitCount - b.commitCount, align: 'center' },
    { title: '新增行数', dataIndex: 'insertions', render: (v: number) => <span style={{ color: '#52c41a', fontWeight: 500 }}>+{v?.toLocaleString()}</span>, sorter: (a: any, b: any) => a.insertions - b.insertions, align: 'center' },
    { title: '删除行数', dataIndex: 'deletions', render: (v: number) => <span style={{ color: '#f5222d', fontWeight: 500 }}>-{v?.toLocaleString()}</span>, sorter: (a: any, b: any) => a.deletions - b.deletions, align: 'center' },
    {
      title: '贡献者',
      dataIndex: 'contributors',
      key: 'contributors',
      render: (contributors: { userId: string; userName: string }[], record: any) => (
        <span>
          {contributors.map((c, idx) => (
            <span key={c.userId}>
              <span 
                style={{ color: '#1890ff', cursor: 'pointer' }}
                onClick={() => navigate(`/users/${c.userId}?projectId=${record.projectId}&periodType=${periodType}&periodValue=${periodValue}`)}
              >
                {c.userName}
              </span>
              {idx < contributors.length - 1 && '、'}
            </span>
          ))}
        </span>
      ),
    },
    // 暂时隐藏整体分析列
    // {
    //   title: '整体分析',
    //   key: 'analysis',
    //   align: 'center',
    //   render: (_: any, record: any) => (
    //     <Space 
    //       direction="vertical" 
    //       size={0}
    //       onClick={() => navigate(`/projects/${record.projectId}/report?periodType=${periodType}&periodValue=${periodValue}`)} 
    //       style={{ cursor: 'pointer', color: '#722ed1', width: '100%', alignItems: 'center' }}
    //     >
    //       <FileTextOutlined style={{ fontSize: 18 }} />
    //       <span style={{ fontSize: 12 }}>分析</span>
    //     </Space>
    //   )
    // },
    {
      title: '代码审查',
      key: 'codeReview',
      align: 'center',
      render: (_: any, record: any) => (
        <Space 
          direction="vertical" 
          size={0}
          onClick={() => navigate(`/projects/${record.projectId}/code-review?periodType=${periodType}&periodValue=${periodValue}`)} 
          style={{ cursor: 'pointer', color: '#52c41a', width: '100%', alignItems: 'center' }}
        >
          <BugOutlined style={{ fontSize: 18 }} />
          <span style={{ fontSize: 12 }}>审查</span>
        </Space>
      )
    }
  ];

  return (
    <div className="project-overview">
      <div className="page-header">
        <Space size="large">
          <div className="filter-group"><span className="filter-label">统计维度：</span><PeriodSelector /></div>
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
          <Col span={8}><KPICard data={{ title: '总项目数', value: uniqueProjects }} iconType="commit" /></Col>
          <Col span={8}><KPICard data={{ title: '总新增行数', value: totalInsertions }} iconType="task" /></Col>
          <Col span={8}><KPICard data={{ title: '总删除行数', value: totalDeletions }} iconType="trophy" /></Col>
        </Row>
      </div>

      <Card className="project-list-card" bordered={false}>
        <Title level={5} style={{ marginBottom: 20 }}>代码分析列表</Title>
        <div className="analysis-filter-bar" style={{ display: 'flex', alignItems: 'flex-end', gap: '16px' }}>
          {/* 小组筛选暂时隐藏 */}
          {/* <div className="filter-item" style={{ display: 'flex', flexDirection: 'column', minWidth: '140px' }}>
            <div className="filter-label">小组</div>
            <Select 
              placeholder="全部小组" 
              allowClear 
              style={{ width: '100%' }}
              value={filters.teamId || undefined}
              onChange={(v) => setFilters({ ...filters, teamId: v || '' })}
            >
              {teams.map(t => <Option key={t.id} value={t.id}>{t.name}</Option>)}
            </Select>
          </div> */}
          <div className="filter-item" style={{ display: 'flex', flexDirection: 'column', minWidth: '140px' }}>
            <div className="filter-label">项目</div>
            <Select 
              placeholder="全部项目" 
              allowClear
              style={{ width: '100%' }}
              value={filters.projectId || undefined}
              onChange={(v) => setFilters({ ...filters, projectId: v || '' })}
            >
              {projects.map(p => <Option key={p.id} value={p.id}>{p.name}</Option>)}
            </Select>
          </div>
          <div className="filter-item" style={{ display: 'flex', flexDirection: 'column', minWidth: '140px' }}>
            <div className="filter-label">版本号</div>
            <Select 
              placeholder="全部版本" 
              allowClear
              style={{ width: '100%' }}
              value={filters.version || undefined}
              onChange={(v) => setFilters({ ...filters, version: v || '' })}
              showSearch
              optionFilterProp="children"
            >
              {versions.map(v => <Option key={v.value} value={v.value}>{v.label}</Option>)}
            </Select>
          </div>
          <div className="filter-item" style={{ display: 'flex', flexDirection: 'column', minWidth: '140px' }}>
            <div className="filter-label">贡献者</div>
            <Select 
              placeholder="全部贡献者" 
              allowClear
              style={{ width: '100%' }}
              value={filters.userName || undefined}
              onChange={(v) => setFilters({ ...filters, userName: v || '' })}
              showSearch
              optionFilterProp="children"
            >
              {users.map(u => <Option key={u.id} value={u.name}>{u.name}</Option>)}
            </Select>
          </div>
          <Button 
            type="primary" 
            icon={<SearchOutlined />} 
            onClick={handleSearch}
            style={{ minWidth: '80px', height: '32px' }}
          >
            搜索
          </Button>
          <Button 
            onClick={handleReset}
            style={{ minWidth: '80px', height: '32px' }}
          >
            重置
          </Button>
        </div>
        <Table 
          className="custom-table" 
          dataSource={tableData} 
          columns={columns} 
          loading={loading} 
          pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 条` }} 
          bordered 
        />
      </Card>
    </div>
  );
};