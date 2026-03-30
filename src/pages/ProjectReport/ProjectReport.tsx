import React, { useState, useEffect, useCallback } from 'react';
import { Card, Typography, Row, Col, Space, Button, Table, message, DatePicker } from 'antd';
import { ArrowLeftOutlined, ClockCircleOutlined, InfoCircleOutlined, CheckCircleOutlined, BulbOutlined, StarFilled } from '@ant-design/icons';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { request } from '../../api/client';
import { PeriodSelector } from '../../components/PeriodSelector';
import { usePeriodStore } from '../../stores/periodStore';
import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import isoWeek from 'dayjs/plugin/isoWeek';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import './ProjectReport.css';

dayjs.extend(weekOfYear);
dayjs.extend(isoWeek);
dayjs.extend(advancedFormat);

const { Title, Text } = Typography;

export const ProjectReport: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams] = useSearchParams();
  const { periodType: storePeriodType, setPeriodType } = usePeriodStore();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const navigate = useNavigate();

  // 从 URL 参数获取 periodType 和 periodValue
  const urlPeriodType = searchParams.get('periodType') as 'week' | 'month' || storePeriodType;
  const urlPeriodValue = searchParams.get('periodValue');

  // 如果 URL 有 periodType，同步到 store
  useEffect(() => {
    if (searchParams.get('periodType')) {
      setPeriodType(searchParams.get('periodType') as 'week' | 'month');
    }
  }, [searchParams, setPeriodType]);

  // 根据 URL 的 periodValue 计算 selectedDate
  const getInitialDate = useCallback(() => {
    if (urlPeriodValue) {
      if (urlPeriodType === 'week') {
        // periodValue 是周四日期，如 20260319
        return dayjs(urlPeriodValue, 'YYYYMMDD');
      } else {
        // periodValue 是月份，如 202603
        return dayjs(urlPeriodValue, 'YYYYMM');
      }
    }
    return dayjs();
  }, [urlPeriodValue, urlPeriodType]);

  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs>(getInitialDate);
  const periodType = urlPeriodType;

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

  useEffect(() => {
    fetchReport();
  }, [projectId, periodType, selectedDate]);

  const fetchReport = async () => {
    if (!projectId) return;
    setLoading(true);
    const periodValue = getFormattedPeriodValue();
    try {
      const res = await request.get(`/projects/${projectId}/report`, { periodType, periodValue });
      if (res.success) setData(res.data);
    } catch (error) {
      message.error('加载项目报告失败');
    } finally {
      setLoading(false);
    }
  };

  if (!data && !loading) return null;

  const memberColumns = [
    { title: '提交人', dataIndex: 'username', key: 'username' },
    { title: '提交次数', dataIndex: 'commitCount', key: 'commitCount', align: 'center' as const },
    { title: '新增行数', dataIndex: 'insertions', key: 'insertions', render: (val: number) => <span className="text-green">+{val || 0}</span>, align: 'center' as const },
    { title: '删除行数', dataIndex: 'deletions', key: 'deletions', render: (val: number) => <span className="text-red">-{val || 0}</span>, align: 'center' as const },
    { 
      title: '代码质量', 
      dataIndex: 'aiQualityScore', 
      key: 'aiQualityScore',
      render: (score: number) => (
        <Space style={{ color: '#faad14' }}>
          <StarFilled />
          <StarFilled />
          <span style={{ color: '#666', marginLeft: 4 }}>{score >= 90 ? '优秀' : '良好'}</span>
        </Space>
      ),
      align: 'center' as const
    },
    { title: '主要贡献', dataIndex: 'mainContributions', key: 'mainContributions', render: (v: string) => v || '业务开发' },
  ];

  return (
    <div className="project-report">
      <div className="page-header-block">
        <Button icon={<ArrowLeftOutlined />} type="link" onClick={() => navigate('/projects')} className="back-btn">返回项目概览</Button>
        <Title level={3} style={{ marginTop: 8, marginBottom: 8 }}>项目整体分析 - {data?.name || '-'}</Title>
        <Text type="secondary">查看 {data?.name || ''} 项目团队的整体代码分析和质量评估</Text>
        <div className="report-time">
          <ClockCircleOutlined />
          <span>报告生成时间：{data?.reportGeneratedAt ? dayjs(data.reportGeneratedAt).format('YYYY-MM-DD HH:mm') : '-'}</span>
        </div>
      </div>

      <div className="filter-card">
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

      <Title level={5} className="block-header-title" style={{ marginTop: 24 }}>版本信息</Title>
      <Row gutter={16} className="info-cards-row">
        {/* <Col span={6}><div className="info-box bg-blue"><div className="info-label">小组</div><div className="info-val">{data?.teamName || '-'}</div></div></Col> */}
        <Col span={8}><div className="info-box bg-green"><div className="info-label">当前版本</div><div className="info-val">{data?.currentVersion || '-'}</div></div></Col>
        <Col span={8}><div className="info-box bg-orange"><div className="info-label">对比版本</div><div className="info-val">{data?.compareVersion || '-'}</div></div></Col>
        <Col span={8}><div className="info-box bg-purple"><div className="info-label">总任务数</div><div className="info-val">{data?.totalTasks || 0}</div></div></Col>
      </Row>

      <Title level={5} className="block-header-title" style={{ marginTop: 32 }}>整体统计</Title>
      <Row gutter={16} className="stat-cards-row">
        <Col span={5}><div className="stat-box"><div className="stat-label">总提交次数</div><div className="stat-val blue">{data?.totalCommits || 0}</div></div></Col>
        <Col span={5}><div className="stat-box"><div className="stat-label">新增行数</div><div className="stat-val green">+{data?.totalInsertions || 0}</div></div></Col>
        <Col span={5}><div className="stat-box"><div className="stat-label">删除行数</div><div className="stat-val red">-{data?.totalDeletions || 0}</div></div></Col>
        <Col span={5}><div className="stat-box"><div className="stat-label">净增长</div><div className="stat-val purple">{(() => {
          const netGrowth = (data?.totalInsertions || 0) - (data?.totalDeletions || 0);
          return netGrowth >= 0 ? `+${netGrowth.toLocaleString()}` : netGrowth.toLocaleString();
        })()}</div></div></Col>
        <Col span={4}><div className="stat-box"><div className="stat-label">贡献者</div><div className="stat-val orange">{data?.totalContributors || 0}</div></div></Col>
      </Row>

      <Title level={5} className="block-header-title" style={{ marginTop: 32 }}>贡献者统计</Title>
      <Table className="purple-table" columns={memberColumns} dataSource={data?.members || []} rowKey="id" pagination={false} loading={loading} />

      <Title level={5} className="block-header-title" style={{ marginTop: 32 }}>代码质量概览</Title>
      <div className="ai-issue-stack">
        <Card className="issue-item-card yellow-block" bordered={false}>
          <div className="issue-head"><InfoCircleOutlined className="text-orange" /> 常见问题</div>
          <ul className="issue-ul">
            {data?.aiCommonIssues?.length > 0 ? data.aiCommonIssues.map((issue: string, i: number) => <li key={i}>{issue}</li>) : <li>暂无</li>}
          </ul>
        </Card>
        <Card className="issue-item-card blue-block" bordered={false}>
          <div className="issue-head"><BulbOutlined className="text-blue" /> 改进建议</div>
          <ul className="issue-ul blue-marker">
            {data?.aiSuggestions?.length > 0 ? data.aiSuggestions.map((item: string, i: number) => <li key={i}>{item}</li>) : <li>暂无</li>}
          </ul>
        </Card>
        <Card className="issue-item-card green-block" bordered={false}>
          <div className="issue-head"><CheckCircleOutlined className="text-green" /> 最佳实践</div>
          <ul className="issue-ul green-marker">
            {data?.aiBestPractices?.length > 0 ? data.aiBestPractices.map((item: string, i: number) => <li key={i}>{item}</li>) : <li>暂无</li>}
          </ul>
        </Card>
      </div>

      <Title level={5} className="block-header-title" style={{ marginTop: 32 }}>团队表现评价</Title>
      <Card className="team-eval-card" bordered={false}>
        <div className="eval-rating">
          <span className="rating-label">综合评级</span>
          <div className="rating-stars"><StarFilled /> <StarFilled /> <StarFilled /> <StarFilled /> <StarFilled /><span className="rating-text">{data?.aiRating || '良好'}</span></div>
        </div>
        {/* <Row gutter={24} style={{ marginTop: 24 }}>
          <Col span={12}>
            <div className="eval-sub-block green-light-block">
              <div className="sub-block-title"><CheckCircleOutlined /> 团队优势</div>
              <ul className="eval-list">
                {data?.aiAdvantages?.length > 0 ? data.aiAdvantages.map((item: string, i: number) => <li key={i}>{item}</li>) : <li>团队技术栈统一，交付质量高</li>}
              </ul>
            </div>
          </Col>
          <Col span={12}>
            <div className="eval-sub-block blue-light-block">
              <div className="sub-block-title"><BulbOutlined /> 改进建议</div>
              <ul className="eval-list blue-list">
                {data?.aiSuggestions?.length > 0 ? data.aiSuggestions.map((item: string, i: number) => <li key={i}>{item}</li>) : <li>建议加强技术方案评审</li>}
              </ul>
            </div>
          </Col>
        </Row> */}
      </Card>
    </div>
  );
};