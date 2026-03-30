import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Table, Typography, Space, Tag, message, Button } from 'antd';
import { ArrowLeftOutlined, ClockCircleOutlined, InfoCircleOutlined, CheckCircleOutlined, BulbOutlined, StarFilled } from '@ant-design/icons';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { request } from '../../api/client';
import { usePeriodStore } from '../../stores/periodStore';
import dayjs from 'dayjs';
import './UserDetail.css';

const { Title, Text } = Typography;

export const UserDetail: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const urlPeriodType = searchParams.get('periodType') as 'week' | 'month' | null;
  const urlPeriodValue = searchParams.get('periodValue');
  const { periodType: storePeriodType, setPeriodType } = usePeriodStore();
  
  // 优先使用 URL 参数，否则使用 store 中的值
  const periodType = urlPeriodType || storePeriodType;
  const periodValue = urlPeriodValue || usePeriodStore().periodValue;
  
  const [activeTab, setActiveTab] = useState<'评审详情' | '代码分析报告'>('评审详情');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchUserAnalysis();
  }, [userId, projectId, periodType, periodValue]);

  const fetchUserAnalysis = async () => {
    setLoading(true);
    try {
      const params: any = { periodType };
      if (periodValue) params.periodValue = periodValue;
      if (projectId) params.projectId = projectId;
      
      const res = await request.get(`/users/${userId}/analysis`, params);
      if (res.success) {
        setData(res.data);
      }
    } catch (error) {
      message.error('加载用户详情失败');
    } finally {
      setLoading(false);
    }
  };

  // 1. 评审详情：评审项, 版本信息, 代码统计, 类型分布等
  const renderReviewDetails = () => {
    if (!data) return null;
    
    // 解析代码统计 (commitTypes - 提交类型统计)
    const commitTypes = data.report.commitTypes || {};
    const langText = Object.entries(commitTypes)
      .map(([type, count]) => `${type}: ${count}`)
      .join(', ') || '暂无统计数据';

    // 解析类型分布 (fileChanges)
    const fileChanges = data.report.fileChanges || [];

    return (
      <div className="tab-pane-content">
        <Card className="review-item-main-card" bordered={false}>
          <div className="inner-card-title">评审项</div>
          <Row gutter={48} style={{ marginTop: 16 }}>
            <Col span={12}>
              <div className="info-item-row">
                <Text type="secondary">当前版本：</Text><Text strong>{data.report.currentVersion || '-'}</Text>
              </div>
              <div className="info-item-row">
                <Text type="secondary">新增提交：</Text><Text strong>{data.report.commitCount || 0} 次</Text>
              </div>
            </Col>
            <Col span={12}>
              <div className="info-item-row">
                <Text type="secondary">对比版本：</Text><Text strong>{data.report.compareVersion || '-'}</Text>
              </div>
              <div className="info-item-row">
                <Text type="secondary">作者：</Text><Text strong>{data.user.username}</Text>
              </div>
            </Col>
          </Row>
        </Card>

        <Card className="data-block-card" title="版本信息" bordered={false}>
          <div className="v-stat-flex">
            <div className="v-stat-node">新增：<span className="text-green">+{data.statistics.totalInsertions || 0} 行</span></div>
            <div className="v-stat-node">删除：<span className="text-red">-{data.statistics.totalDeletions || 0} 行</span></div>
            <div className="v-stat-node">净增：<span className="text-blue">{(data.statistics.netGrowth || 0) >= 0 ? '+' : ''}{data.statistics.netGrowth || 0} 行</span></div>
          </div>
        </Card>

        <Card className="data-block-card purple-theme" title="代码统计" bordered={false}>
          <div className="stat-summary-desc">{langText}</div>
        </Card>

        <Card className="data-block-card" title="类型分布" bordered={false}>
          <div className="file-dist-list">
            {fileChanges.length > 0 ? (
              fileChanges.map((file: any, index: number) => (
                <div className="file-dist-row" key={index}>
                  <span>{index + 1}. {file.path}</span>
                  <span className="fw-700">+{file.insertions}/-{file.deletions}</span>
                </div>
              ))
            ) : (
              <div className="file-dist-row"><span>暂无文件变更明细</span></div>
            )}
          </div>
        </Card>
      </div>
    );
  };

  // 2. 代码分析报告：提交记录详情, 统计汇总, 问题建议
  const renderAnalysisReport = () => {
    if (!data) return null;
    const columns = [
      { title: 'Hash', dataIndex: 'hash', key: 'hash', render: (text: string) => <span className="hash-code">{text}</span> },
      { title: '信息', dataIndex: 'message', key: 'message' },
      { title: '项目', dataIndex: 'projectName', key: 'projectName', render: (name: string) => name ? <Tag>{name}</Tag> : '-' },
      { title: '类型', dataIndex: 'type', key: 'type', render: (type: string) => <Tag color={type === '新功能' ? 'green' : 'purple'} className="status-tag-custom">{type}</Tag> },
      { title: '提交时间', dataIndex: 'time', key: 'time', render: (t: string) => t ? dayjs(t).format('YYYY/MM/DD HH:mm:ss') : '-' },
      { title: '新增', dataIndex: 'insertions', key: 'insertions', render: (val: number) => <span className="text-green">{val || 0}</span> },
      { title: '删除', dataIndex: 'deletions', key: 'deletions', render: (val: number) => <span className="text-red">{val || 0}</span> },
    ];

    return (
      <div className="tab-pane-content">
        <Title level={5} className="block-header-title">提交记录详情</Title>
        <Table
          className="blue-thead-table"
          dataSource={data.commits || []}
          columns={columns}
          pagination={false}
          rowKey={(record) => record.hash + record.time}
          size="middle"
        />

        <Title level={5} className="block-header-title" style={{ marginTop: 32 }}>统计汇总</Title>
        <Row gutter={20} className="stats-row">
          <Col span={6}>
            <div className="score-kpi-box bg-blue-pale">
              <div className="kpi-label">总提交数</div>
              <div className="kpi-value">{data.statistics.totalCommits || 0}</div>
            </div>
          </Col>
          <Col span={6}>
            <div className="score-kpi-box bg-green-pale">
              <div className="kpi-label">总新增</div>
              <div className="kpi-value text-green">+{data.statistics.totalInsertions || 0}</div>
            </div>
          </Col>
          <Col span={6}>
            <div className="score-kpi-box bg-red-pale">
              <div className="kpi-label">总删除</div>
              <div className="kpi-value text-red">-{data.statistics.totalDeletions || 0}</div>
            </div>
          </Col>
          <Col span={6}>
            <div className="score-kpi-box bg-purple-pale">
              <div className="kpi-label">净增长</div>
              <div className="kpi-value text-purple">{(data.statistics.netGrowth || 0) >= 0 ? '+' : ''}{data.statistics.netGrowth || 0}</div>
            </div>
          </Col>
        </Row>

        <Title level={5} className="block-header-title" style={{ marginTop: 32 }}>问题与建议</Title>
        <div className="ai-issue-stack">
          <Card className="issue-item-card yellow-block" bordered={false}>
            <div className="issue-head"><InfoCircleOutlined className="text-orange" /> 主要问题</div>
            <ul className="issue-ul">
              {data.report.issues?.length > 0 ? data.report.issues.map((item: string, i: number) => <li key={i}>{item}</li>) : <li>暂无明显问题</li>}
            </ul>
          </Card>
          <Card className="issue-item-card blue-block" bordered={false}>
            <div className="issue-head"><BulbOutlined className="text-blue" /> 代码建议</div>
            <ul className="issue-ul blue-marker">
              {data.report.suggestions?.length > 0 ? data.report.suggestions.map((item: string, i: number) => <li key={i}>{item}</li>) : <li>暂无优化建议</li>}
            </ul>
          </Card>
          <Card className="issue-item-card green-block" bordered={false}>
            <div className="issue-head"><CheckCircleOutlined className="text-green" /> 综合评价</div>
            <ul className="issue-ul green-marker">
              {data.report.advantages?.length > 0 ? data.report.advantages.map((item: string, i: number) => <li key={i}>{item}</li>) : <li>暂无</li>}
            </ul>
          </Card>
          
          <Title level={5} className="block-header-title" style={{ marginTop: 16 }}>总体评价</Title>
          <Card className="issue-item-card info-block" bordered={false}>
            <div className="big-score-text text-blue" style={{ fontSize: 24, fontWeight: 700 }}>
              {data.report.overallEvaluation || '良好'}
            </div>
          </Card>
        </div>
      </div>
    );
  };

  return (
    <div className="detail-page-wrapper">
      <div className="page-top-header">
        <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} className="back-button">
          返回
        </Button>
        <div className="header-info-block">
          <Title level={2}>个人代码评审详情 - {data?.user.username || ''}</Title>
          <Text type="secondary">查看 {data?.user.username || ''} 的评审详情和代码分析报告，包含版本对比、代码统计、提交记录、问题分析和优化建议等完整信息</Text>
          <div className="report-generated-time">
            <ClockCircleOutlined /> 报告生成时间：{data?.user?.reportTime ? dayjs(data.user.reportTime.replace('Z', '')).format('YYYY-MM-DD HH:mm') : '-'}
          </div>
        </div>
      </div>

      {/* 项目选择器：如果用户有多个项目，显示切换按钮 */}
      {data?.projects && data.projects.length > 0 && (
        <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Text type="secondary" style={{ lineHeight: '32px' }}>切换项目：</Text>
          {data.projects.map((p: any) => (
            <Tag
              key={p.id}
              color={p.id === projectId ? 'blue' : 'default'}
              style={{ cursor: 'pointer', padding: '4px 12px', fontSize: 14 }}
              onClick={() => navigate(`/users/${userId}?projectId=${p.id}&periodValue=${periodValue}`)}
            >
              {p.name} ({p.commitCount}次提交)
            </Tag>
          ))}
        </div>
      )}

      <div className="main-content-card">
        <div className="custom-capsule-switcher">
          <div 
            className={`switcher-item ${activeTab === '评审详情' ? 'active' : ''}`}
            onClick={() => setActiveTab('评审详情')}
          >
            评审详情
          </div>
          <div 
            className={`switcher-item ${activeTab === '代码分析报告' ? 'active' : ''}`}
            onClick={() => setActiveTab('代码分析报告')}
          >
            代码分析报告
          </div>
        </div>

        <div className="active-pane-wrapper">
          {loading ? <div style={{ padding: '40px 0', textAlign: 'center' }}>加载中...</div> : (activeTab === '评审详情' ? renderReviewDetails() : renderAnalysisReport())}
        </div>
      </div>
    </div>
  );
};