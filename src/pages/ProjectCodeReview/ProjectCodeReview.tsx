import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Table, Tag, Typography, Row, Col, Empty, Spin, Button, Tabs, Tooltip, Modal, Descriptions, DatePicker, Space } from 'antd';
import {
  FileTextOutlined,
  WarningOutlined,
  BulbOutlined,
  ArrowLeftOutlined,
  BugOutlined,
  ThunderboltOutlined,
  SafetyOutlined,
  CodeOutlined,
  ClockCircleOutlined,
  UserOutlined,
  StarFilled
} from '@ant-design/icons';
import { request } from '../../api/client';
import { PeriodSelector } from '../../components/PeriodSelector';
import { usePeriodStore } from '../../stores/periodStore';
import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import isoWeek from 'dayjs/plugin/isoWeek';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import './ProjectCodeReview.css';

dayjs.extend(weekOfYear);
dayjs.extend(isoWeek);
dayjs.extend(advancedFormat);

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;

// 严重程度配置
const severityConfig: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
  P0: { color: '#ff4d4f', text: '阻塞', icon: <WarningOutlined /> },
  P1: { color: '#fa8c16', text: '重要', icon: <BugOutlined /> },
  P2: { color: '#52c41a', text: '建议', icon: <BulbOutlined /> },
};

// 问题类型图标
const issueTypeIcon: Record<string, React.ReactNode> = {
  '代码可维护性': <CodeOutlined />,
  '错误处理': <SafetyOutlined />,
  '性能问题': <ThunderboltOutlined />,
  '安全问题': <WarningOutlined />,
  '类型定义': <FileTextOutlined />,
  '硬编码常量': <CodeOutlined />,
};

export const ProjectCodeReview: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { periodType, setPeriodType } = usePeriodStore();

  // 从 URL 参数同步 periodType 到 store
  useEffect(() => {
    const urlPeriodType = searchParams.get('periodType');
    if (urlPeriodType && (urlPeriodType === 'week' || urlPeriodType === 'month') && urlPeriodType !== periodType) {
      setPeriodType(urlPeriodType as 'week' | 'month');
    }
  }, [searchParams, periodType, setPeriodType]);

  // 从 URL 参数解析 periodValue 并设置 selectedDate
  useEffect(() => {
    const urlPeriodValue = searchParams.get('periodValue');
    const urlPeriodType = searchParams.get('periodType') || periodType;
    if (urlPeriodValue) {
      if (urlPeriodType === 'week') {
        // 周维度，格式 YYYYMMDD（周四日期）
        const thursdayDate = dayjs(urlPeriodValue, 'YYYYMMDD');
        if (thursdayDate.isValid()) {
          setSelectedDate(thursdayDate);
        }
      } else if (urlPeriodType === 'month') {
        // 月维度，格式 YYYYMM
        const monthDate = dayjs(urlPeriodValue, 'YYYYMM');
        if (monthDate.isValid()) {
          setSelectedDate(monthDate);
        }
      }
    }
  }, [searchParams]); // 只在 URL 参数变化时执行一次

  // 时间范围状态
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs>(dayjs());

  const getFormattedPeriodValue = useCallback(() => {
    if (periodType === 'week') {
      return selectedDate.day(4).format('YYYYMMDD');
    }
    return selectedDate.format('YYYYMM');
  }, [periodType, selectedDate]);

  const periodValue = getFormattedPeriodValue();

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

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [projectInfo, setProjectInfo] = useState<any>(null);
  const [projectReport, setProjectReport] = useState<any>(null);
  const [selectedIssue, setSelectedIssue] = useState<any>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [viewMode, setViewMode] = useState<'severity' | 'file'>('severity');

  // 处理日期切换
  const handleDateChange = useCallback((date: dayjs.Dayjs | null) => {
    if (date) {
      setSelectedDate(date);
    }
  }, []);

  useEffect(() => {
    fetchReviewData();
    fetchProjectInfo();
    fetchProjectReport();
  }, [projectId, periodType, periodValue]);

  const fetchReviewData = async () => {
    setLoading(true);
    setError(null);
    console.log('Fetching with params:', { periodType, periodValue, projectId });
    try {
      const res = await request.get(`/code-review/${projectId}`, {
        periodType, periodValue
      });
      console.log('API response:', res);
      if (res.success) {
        setData(res.data);
      } else {
        setError(res.message || '获取数据失败');
      }
    } catch (error: any) {
      console.error('加载代码审查数据失败', error);
      setError(error.message || '网络请求失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectInfo = async () => {
    try {
      const res = await request.get(`/projects/${projectId}`);
      if (res.success) {
        setProjectInfo(res.data);
      }
    } catch (error) {
      console.error('加载项目信息失败', error);
    }
  };

  const fetchProjectReport = async () => {
    try {
      const res = await request.get(`/projects/${projectId}/report`, {
        periodType, periodValue
      });
      if (res.success) {
        setProjectReport(res.data);
      }
    } catch (error) {
      console.error('加载项目报告失败', error);
    }
  };

  // 问题明细表格列定义
  const issueColumns: any[] = [
    {
      title: '提交人',
      dataIndex: 'committer_name',
      key: 'committer_name',
      width: 130,
      render: (name: string) => name || '-',
    },
    {
      title: '文件',
      dataIndex: 'file_path',
      key: 'file_path',
      width: 180,
      ellipsis: true,
      render: (path: string) => (
        <Tooltip title={path}>
          <span className="file-path">{path.split('/').pop()}</span>
        </Tooltip>
      ),
    },
    {
      title: '问题类型',
      dataIndex: 'issue_type',
      key: 'issue_type',
      width: 130,
      render: (type: string) => (
        <Tag icon={issueTypeIcon[type] || <FileTextOutlined />} color="blue">
          {type}
        </Tag>
      ),
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      width: 90,
      render: (severity: string) => {
        const config = severityConfig[severity];
        return config ? (
          <Tag icon={config.icon} color={config.color}>
            {config.text}
          </Tag>
        ) : severity;
      },
    },
    {
      title: '问题描述',
      dataIndex: 'description',
      key: 'description',
      width: 280,
      ellipsis: true,
      render: (desc: string) => (
        <Tooltip title={desc}>
          <span>{desc}</span>
        </Tooltip>
      ),
    },
    {
      title: '修改建议',
      dataIndex: 'suggestion',
      key: 'suggestion',
      width: 350,
      ellipsis: true,
      render: (suggestion: string) => suggestion ? (
        <Tooltip title={suggestion}>
          <span className="suggestion-text">{suggestion}</span>
        </Tooltip>
      ) : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 70,
      fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Button type="link" size="small" onClick={() => showIssueDetail(record)}>
          详情
        </Button>
      ),
    },
  ];

  // 显示问题详情
  const showIssueDetail = (issue: any) => {
    setSelectedIssue(issue);
    setDetailVisible(true);
  };

  // 按文件分组的数据
  const getFileGroupedData = () => {
    if (!data?.issues) return [];
    const fileMap = new Map<string, any[]>();
    data.issues.forEach((issue: any) => {
      const file = issue.file_path;
      if (!fileMap.has(file)) {
        fileMap.set(file, []);
      }
      fileMap.get(file)!.push(issue);
    });
    return Array.from(fileMap.entries()).map(([file, issues]) => ({
      file,
      issues,
      p0Count: issues.filter(i => i.severity === 'P0').length,
      p1Count: issues.filter(i => i.severity === 'P1').length,
      p2Count: issues.filter(i => i.severity === 'P2').length,
    }));
  };

  // 文件分组的表格列
  const fileGroupColumns: any[] = [
    {
      title: '文件路径',
      dataIndex: 'file',
      key: 'file',
      render: (file: string) => (
        <Tooltip title={file}>
          <span className="file-path">{file}</span>
        </Tooltip>
      ),
    },
    {
      title: 'P0',
      dataIndex: 'p0Count',
      key: 'p0',
      width: 60,
      render: (v: number) => v > 0 ? <Tag color="#ff4d4f">{v}</Tag> : '-',
    },
    {
      title: 'P1',
      dataIndex: 'p1Count',
      key: 'p1',
      width: 60,
      render: (v: number) => v > 0 ? <Tag color="#fa8c16">{v}</Tag> : '-',
    },
    {
      title: 'P2',
      dataIndex: 'p2Count',
      key: 'p2',
      width: 60,
      render: (v: number) => v > 0 ? <Tag color="#52c41a">{v}</Tag> : '-',
    },
    {
      title: '问题列表',
      key: 'issues',
      render: (_: any, record: any) => (
        <div className="issue-list">
          {record.issues.slice(0, 2).map((issue: any) => (
            <div key={issue.id} className="issue-item">
              <Tag color={severityConfig[issue.severity]?.color}>
                {issue.severity}
              </Tag>
              <Text ellipsis style={{ maxWidth: 400 }}>{issue.description}</Text>
            </div>
          ))}
          {record.issues.length > 2 && <Text type="secondary">+{record.issues.length - 2} 更多...</Text>}
        </div>
      ),
    },
  ];

  // 共性问题表格列定义 - 4列：问题类型、出现次数、问题描述、统一整改建议
  const commonIssueColumns: any[] = [
    {
      title: '问题类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: string) => (
        <Tag icon={issueTypeIcon[type] || <FileTextOutlined />} color="blue">
          {type}
        </Tag>
      ),
    },
    {
      title: '出现次数',
      dataIndex: 'count',
      key: 'count',
      width: 90,
      align: 'center' as const,
      sorter: (a: any, b: any) => a.count - b.count,
    },
    {
      title: '问题描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (desc: string) => (
        <Tooltip title={desc}>
          <span>{desc || '-'}</span>
        </Tooltip>
      ),
    },
    {
      title: '统一整改建议',
      dataIndex: 'suggestion',
      key: 'suggestion',
      ellipsis: true,
      render: (suggestion: string) => (
        <Tooltip title={suggestion}>
          <span style={{ color: '#52c41a' }}>{suggestion || '-'}</span>
        </Tooltip>
      ),
    },
  ];

  // 从 issues 数据中提取共性问题汇总
  const getCommonIssueData = () => {
    if (!data?.issues) return [];
    
    // 按问题类型分组
    const typeMap = new Map<string, { count: number; descriptions: string[]; suggestions: string[] }>();
    
    data.issues.forEach((issue: any) => {
      const type = issue.issue_type;
      if (!typeMap.has(type)) {
        typeMap.set(type, { count: 0, descriptions: [], suggestions: [] });
      }
      const item = typeMap.get(type)!;
      item.count++;
      if (issue.description && !item.descriptions.includes(issue.description)) {
        item.descriptions.push(issue.description);
      }
      if (issue.suggestion && !item.suggestions.includes(issue.suggestion)) {
        item.suggestions.push(issue.suggestion);
      }
    });
    
    // 转换为表格数据
    return Array.from(typeMap.entries())
      .map(([type, data]) => ({
        key: type,
        type,
        count: data.count,
        description: data.descriptions[0] || '-', // 取第一个问题描述
        suggestion: data.suggestions[0] || '-', // 取第一个建议
      }))
      .sort((a, b) => b.count - a.count);
  };

  // 贡献者表格列
  const memberColumns: any[] = [
    { title: '提交人', dataIndex: 'username', key: 'username', width: 120, fixed: 'left' as const },
    { title: '提交次数', dataIndex: 'commitCount', key: 'commitCount', width: 90, align: 'center' as const },
    { title: '提交占比', dataIndex: 'commitRatio', key: 'commitRatio', width: 90, align: 'center' as const },
    { title: '新增行数', dataIndex: 'insertions', key: 'insertions', width: 100, align: 'center' as const, render: (val: number) => <span style={{ color: '#52c41a' }}>+{val || 0}</span> },
    { title: '删除行数', dataIndex: 'deletions', key: 'deletions', width: 100, align: 'center' as const, render: (val: number) => <span style={{ color: '#f5222d' }}>-{val || 0}</span> },
    { title: '净增行数', dataIndex: 'netLines', key: 'netLines', width: 100, align: 'center' as const, render: (val: number) => <span style={{ color: val >= 0 ? '#722ed1' : '#fa8c16', fontWeight: 600 }}>{val >= 0 ? '+' : ''}{val || 0}</span> },
    { title: '必须修改', dataIndex: 'mustFixCount', key: 'mustFixCount', width: 90, align: 'center' as const, render: (val: number) => val > 0 ? <Tag color="#ff4d4f">{val}</Tag> : <Tag>0</Tag> },
    { title: '建议修改', dataIndex: 'suggestCount', key: 'suggestCount', width: 90, align: 'center' as const, render: (val: number) => val > 0 ? <Tag color="#52c41a">{val}</Tag> : <Tag>0</Tag> },
    { title: '问题总数', dataIndex: 'issueCount', key: 'issueCount', width: 90, align: 'center' as const, render: (val: number) => <span style={{ fontWeight: 600, color: val > 0 ? '#fa8c16' : '#52c41a' }}>{val}</span> },
    { title: '问题占比', dataIndex: 'issueRatio', key: 'issueRatio', width: 90, align: 'center' as const },
    { title: '质量评价', dataIndex: 'qualityRating', key: 'qualityRating', width: 110, align: 'center' as const, fixed: 'right' as const, render: (val: string) => {
      const colorMap: Record<string, string> = { '优': '#52c41a', '良好': '#1890ff', '待改进': '#fa8c16', '需重点关注': '#ff4d4f' };
      return <Tag color={colorMap[val] || '#666'} style={{ fontWeight: 600 }}>{val}</Tag>;
    }},
  ];

  // 总体评价数据
  const getOverallRating = () => {
    if (!projectReport?.avgQualityScore) return null;
    const score = projectReport.avgQualityScore;
    let rating = '良好', color = '#1890ff';
    if (score >= 8.5) { rating = '优秀'; color = '#52c41a'; }
    else if (score >= 7) { rating = '良好'; color = '#1890ff'; }
    else if (score >= 6) { rating = '一般'; color = '#fa8c16'; }
    else { rating = '需改进'; color = '#ff4d4f'; }
    return { score, rating, color };
  };
  const overallRating = getOverallRating();

  // 按严重程度分组
  const issues = data?.issues || [];
  const p0Issues = issues.filter((i: any) => i.severity === 'P0');
  const p1Issues = issues.filter((i: any) => i.severity === 'P1');
  const p2Issues = issues.filter((i: any) => i.severity === 'P2');

  // 执行优先级表格数据
  const priorityData = [
    {
      key: 'P0',
      level: 'P0 阻塞',
      description: '严重问题，必须修复',
      count: p0Issues.length,
      examples: p0Issues.slice(0, 3).map((i: any) => `${i.file_path?.split('/').pop()}: ${i.description}`),
    },
    {
      key: 'P1',
      level: 'P1 重要',
      description: '重要问题，应该修复',
      count: p1Issues.length,
      examples: p1Issues.slice(0, 3).map((i: any) => `${i.file_path?.split('/').pop()}: ${i.description}`),
    },
    {
      key: 'P2',
      level: 'P2 建议',
      description: '改进建议',
      count: p2Issues.length,
      examples: p2Issues.slice(0, 3).map((i: any) => `${i.file_path?.split('/').pop()}: ${i.description}`),
    },
  ];

  // 无数据占位组件
  const NoDataPlaceholder = ({ text = '暂无数据' }: { text?: string }) => (
    <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>
      <Text type="secondary">{text}</Text>
    </div>
  );

  if (loading) {
    return (
      <div className="loading-container">
        <Spin size="large" tip="加载代码审查数据..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="project-code-review">
        <div className="page-header-block">
          <Button icon={<ArrowLeftOutlined />} type="link" onClick={() => navigate('/projects')} className="back-btn">
            返回项目概览
          </Button>
          <Title level={3} style={{ marginTop: 8, marginBottom: 8 }}>代码审查报告 - {projectInfo?.name || projectId}</Title>
        </div>
        <Card>
          <Empty description={error} />
        </Card>
      </div>
    );
  }

  const priorityColumns: any[] = [
    {
      title: '优先级',
      dataIndex: 'level',
      key: 'level',
      width: 100,
      render: (level: string) => {
        const colorMap: Record<string, string> = { 'P0 阻塞': '#ff4d4f', 'P1 重要': '#fa8c16', 'P2 建议': '#52c41a' };
        return <Tag color={colorMap[level]} style={{ fontSize: 13, padding: '2px 8px' }}>{level}</Tag>;
      },
    },
    {
      title: '说明',
      dataIndex: 'description',
      key: 'description',
      width: 180,
    },
    {
      title: '数量',
      dataIndex: 'count',
      key: 'count',
      width: 80,
      align: 'center' as const,
      render: (count: number) => <span style={{ fontWeight: 600 }}>{count}</span>,
    },
    {
      title: '示例问题',
      dataIndex: 'examples',
      key: 'examples',
      render: (examples: string[]) => (
        <ul style={{ margin: 0, paddingLeft: 16 }}>
          {examples.map((ex, idx) => <li key={idx} style={{ fontSize: 12, color: '#666' }}>{ex}</li>)}
        </ul>
      ),
    },
  ];

  return (
    <div className="project-code-review">
      {/* 页面头部 - 移植自项目报告 */}
      <div className="page-header-block">
        <Button icon={<ArrowLeftOutlined />} type="link" onClick={() => navigate('/projects')} className="back-btn">
          返回项目概览
        </Button>
        <Title level={3} style={{ marginTop: 8, marginBottom: 8 }}>🔍 代码审查报告 - {projectInfo?.name || projectId}</Title>
        <Text type="secondary">查看 {projectInfo?.name || ''} 项目的代码质量审查详情</Text>
        <div className="report-time">
          <ClockCircleOutlined />
          <span>报告生成时间：{projectReport?.reportGeneratedAt ? dayjs(projectReport.reportGeneratedAt).format('YYYY-MM-DD HH:mm') : '-'}</span>
        </div>
      </div>

      {/* 统计维度切换 - 与小组整体分析报告页面保持一致 */}
      <div className="filter-card">
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
              onChange={handleDateChange}
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

      {/* 版本信息 - 移植自项目报告 */}
      <Title level={5} className="block-header-title" style={{ marginTop: 24 }}>版本信息</Title>
      <Row gutter={16} className="info-cards-row">
        <Col span={8}><div className="info-box bg-green"><div className="info-label">当前版本</div><div className="info-val">{projectReport?.currentVersion || '-'}</div></div></Col>
        <Col span={8}><div className="info-box bg-orange"><div className="info-label">对比版本</div><div className="info-val">{projectReport?.compareVersion || '-'}</div></div></Col>
        <Col span={8}><div className="info-box bg-purple"><div className="info-label">总任务数</div><div className="info-val">{projectReport?.totalTasks || 0}</div></div></Col>
      </Row>

      {/* 整体统计 - 移植自项目报告 */}
      <Title level={5} className="block-header-title" style={{ marginTop: 32 }}>整体统计</Title>
      <Row gutter={16} className="stat-cards-row">
        <Col span={5}><div className="stat-box"><div className="stat-label">总提交次数</div><div className="stat-val blue">{projectReport?.totalCommits || 0}</div></div></Col>
        <Col span={5}><div className="stat-box"><div className="stat-label">新增行数</div><div className="stat-val green">+{projectReport?.totalInsertions || 0}</div></div></Col>
        <Col span={5}><div className="stat-box"><div className="stat-label">删除行数</div><div className="stat-val red">-{projectReport?.totalDeletions || 0}</div></div></Col>
        <Col span={5}><div className="stat-box"><div className="stat-label">净增长</div><div className="stat-val purple">{(() => {
          const netGrowth = (projectReport?.totalInsertions || 0) - (projectReport?.totalDeletions || 0);
          return netGrowth >= 0 ? `+${netGrowth.toLocaleString()}` : netGrowth.toLocaleString();
        })()}</div></div></Col>
        <Col span={4}><div className="stat-box"><div className="stat-label">贡献者</div><div className="stat-val orange">{projectReport?.totalContributors || 0}</div></div></Col>
      </Row>

      {/* 贡献者统计 - 移植自项目报告 */}
      {projectReport?.members && projectReport.members.length > 0 && (
        <>
          <Title level={5} className="block-header-title" style={{ marginTop: 32 }}>贡献者统计</Title>
          <Table 
            className="purple-table" 
            columns={memberColumns} 
            dataSource={projectReport.members} 
            rowKey="id" 
            pagination={false} 
          />
        </>
      )}

      {/* 问题详情 */}
      <Card 
        className="issues-card"
        title={<><FileTextOutlined /> 问题明细</>}
        extra={
          issues.length > 0 ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                size="small"
                type={viewMode === 'severity' ? 'primary' : 'default'}
                onClick={() => setViewMode('severity')}
              >
                按严重程度
              </Button>
              <Button
                size="small"
                type={viewMode === 'file' ? 'primary' : 'default'}
                onClick={() => setViewMode('file')}
              >
                按文件
              </Button>
            </div>
          ) : null
        }
      >
        {issues.length === 0 ? (
          <NoDataPlaceholder text="该时间段暂无代码审查数据" />
        ) : viewMode === 'severity' ? (
          <Tabs defaultActiveKey="all">
            <TabPane
              tab={<span>全部问题 ({issues.length})</span>}
              key="all"
            >
              <Table
                columns={issueColumns}
                dataSource={issues}
                rowKey="id"
                pagination={{ pageSize: 10 }}
                scroll={{ x: 1400 }}
              />
            </TabPane>
            <TabPane
              tab={<span><WarningOutlined style={{ color: '#ff4d4f' }} /> 阻塞 ({p0Issues.length})</span>}
              key="p0"
            >
              {p0Issues.length > 0 ? (
                <Table
                  columns={issueColumns}
                  dataSource={p0Issues}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: 1400 }}
                />
              ) : (
                <NoDataPlaceholder text="暂无阻塞问题" />
              )}
            </TabPane>
            <TabPane
              tab={<span><BugOutlined style={{ color: '#fa8c16' }} /> 重要 ({p1Issues.length})</span>}
              key="p1"
            >
              {p1Issues.length > 0 ? (
                <Table
                  columns={issueColumns}
                  dataSource={p1Issues}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: 1400 }}
                />
              ) : (
                <NoDataPlaceholder text="暂无重要问题" />
              )}
            </TabPane>
            <TabPane
              tab={<span><BulbOutlined style={{ color: '#52c41a' }} /> 建议 ({p2Issues.length})</span>}
              key="p2"
            >
              {p2Issues.length > 0 ? (
                <Table
                  columns={issueColumns}
                  dataSource={p2Issues}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: 1400 }}
                />
              ) : (
                <NoDataPlaceholder text="暂无改进建议" />
              )}
            </TabPane>
          </Tabs>
        ) : (
          <Table
            columns={fileGroupColumns}
            dataSource={getFileGroupedData()}
            rowKey="file"
            pagination={{ pageSize: 10 }}
            expandable={{
              expandedRowRender: (record) => (
                <Table
                  columns={issueColumns.filter(c => c.key !== 'action')}
                  dataSource={record.issues}
                  rowKey="id"
                  pagination={false}
                  size="small"
                />
              ),
            }}
          />
        )}
      </Card>

      {/* 共性问题汇总 */}
      <Card className="common-issues-card" title={<><FileTextOutlined /> 共性问题汇总</>}>
        {getCommonIssueData().length > 0 ? (
          <Table
            columns={commonIssueColumns}
            dataSource={getCommonIssueData()}
            pagination={false}
          />
        ) : (
          <NoDataPlaceholder text="暂无共性问题数据" />
        )}
      </Card>

      {/* 执行优先级 - 表格形式 */}
      <Card className="priority-card" title={<><ThunderboltOutlined /> 执行优先级</>}>
        {issues.length > 0 ? (
          <Table
            columns={priorityColumns}
            dataSource={priorityData}
            rowKey="key"
            pagination={false}
            rowClassName={(record) => {
              if (record.key === 'P0') return 'priority-row-p0';
              if (record.key === 'P1') return 'priority-row-p1';
              return 'priority-row-p2';
            }}
          />
        ) : (
          <NoDataPlaceholder text="暂无优先级数据" />
        )}
      </Card>

      {/* 总体评价 */}
      <Card className="overall-rating-card" title={<><StarFilled style={{ color: '#faad14' }} /> 总体评价</>}>
        {overallRating ? (
          <Row gutter={32}>
            <Col span={5}>
              <div className="rating-score-box" style={{ borderColor: overallRating.color }}>
                <div className="score-value" style={{ color: overallRating.color }}>{overallRating.score.toFixed(1)}</div>
                <div className="score-label">综合评分</div>
                <div className="score-rating" style={{ color: overallRating.color, marginTop: 8, fontSize: 14, fontWeight: 500 }}>
                  {overallRating.rating}
                </div>
              </div>
            </Col>
            <Col span={19}>
              <div className="rating-content">
                {projectReport?.aiAdvantages && projectReport.aiAdvantages.length > 0 && (
                  <div className="rating-section">
                    <Text strong style={{ color: '#52c41a', fontSize: 14 }}>✅ 优点</Text>
                    <ul>
                      {projectReport.aiAdvantages.slice(0, 3).map((item: string, idx: number) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {projectReport?.aiSuggestions && projectReport.aiSuggestions.length > 0 && (
                  <div className="rating-section">
                    <Text strong style={{ color: '#fa8c16', fontSize: 14 }}>💡 改进建议</Text>
                    <ul>
                      {projectReport.aiSuggestions.slice(0, 3).map((item: string, idx: number) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Col>
          </Row>
        ) : (
          <NoDataPlaceholder text="暂无总体评价数据" />
        )}
      </Card>

      {/* 问题详情弹窗 */}
      <Modal
        title={
          <span>
            <Tag color={severityConfig[selectedIssue?.severity]?.color}>
              {selectedIssue?.severity}
            </Tag>
            问题详情
          </span>
        }
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>
        ]}
        width={800}
      >
        {selectedIssue && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="提交人">
              {selectedIssue.committer_name ? (
                <span><UserOutlined style={{ marginRight: 4 }} />{selectedIssue.committer_name}</span>
              ) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="文件路径">
              <Text code>{selectedIssue.file_path}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="行号">
              {selectedIssue.line_start
                ? (selectedIssue.line_end && selectedIssue.line_start !== selectedIssue.line_end
                    ? `${selectedIssue.line_start} - ${selectedIssue.line_end}`
                    : selectedIssue.line_start)
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="问题类型">
              <Tag icon={issueTypeIcon[selectedIssue.issue_type] || <FileTextOutlined />} color="blue">
                {selectedIssue.issue_type}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="严重程度">
              <Tag color={severityConfig[selectedIssue.severity]?.color}>
                {severityConfig[selectedIssue.severity]?.text}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="问题描述">
              <Paragraph>{selectedIssue.description}</Paragraph>
            </Descriptions.Item>
            <Descriptions.Item label="修改建议">
              <Paragraph type="success">{selectedIssue.suggestion || '暂无建议'}</Paragraph>
            </Descriptions.Item>
            {selectedIssue.code_snippet && (
              <Descriptions.Item label="问题代码">
                <pre className="code-snippet error">{selectedIssue.code_snippet}</pre>
              </Descriptions.Item>
            )}
            {selectedIssue.code_example && (
              <Descriptions.Item label="代码示例">
                <pre className="code-snippet success">{selectedIssue.code_example}</pre>
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};