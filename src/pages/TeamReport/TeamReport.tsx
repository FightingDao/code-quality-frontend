import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Table, Typography, Row, Col, Space, Button, message, DatePicker } from 'antd';
import { ArrowLeftOutlined, ClockCircleOutlined, BulbOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { request } from '../../api/client';
import { PeriodSelector } from '../../components/PeriodSelector';
import { usePeriodStore } from '../../stores/periodStore';
import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import isoWeek from 'dayjs/plugin/isoWeek';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import './TeamReport.css';

dayjs.extend(weekOfYear);
dayjs.extend(isoWeek);
dayjs.extend(advancedFormat);

const { Title, Text } = Typography;

type SortField = 'commitCount' | 'taskCount' | 'aiQualityScore';
type SortOrder = 'ascend' | 'descend';

export const TeamReport: React.FC = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const { periodType } = usePeriodStore();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs>(dayjs());
  const navigate = useNavigate();

  // 排序状态：默认按代码质量降序
  const [sortField, setSortField] = useState<SortField>('aiQualityScore');
  const [sortOrder, setSortOrder] = useState<SortOrder>('descend');

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
  }, [teamId, periodType, selectedDate]);

  const fetchReport = async () => {
    if (!teamId) return;
    setLoading(true);
    const periodValue = getFormattedPeriodValue();
    try {
      const res = await request.get(`/teams/${teamId}/report`, { periodType, periodValue });
      if (res.success) setData(res.data);
    } catch (error) {
      message.error('加载小组报告失败');
    } finally {
      setLoading(false);
    }
  };

  // 成员数据排序（在条件返回之前）
  const sortedMembers = React.useMemo(() => {
    if (!data?.members) return [];
    const members = [...data.members];
    members.sort((a: any, b: any) => {
      const aVal = a[sortField] ?? 0;
      const bVal = b[sortField] ?? 0;
      return sortOrder === 'descend' ? bVal - aVal : aVal - bVal;
    });
    return members;
  }, [data?.members, sortField, sortOrder]);

  const handleMemberSort = (sorter: any) => {
    if (sorter.field) {
      setSortField(sorter.field);
      setSortOrder(sorter.order || 'descend');
    }
  };

  if (!data && !loading) return null;

  const memberColumns = [
    { title: '排名', key: 'index', render: (_: any, __: any, index: number) => <span className={`rank-badge rank-${index+1}`}>{index + 1}</span>, width: 80, align: 'center' as const },
    { title: '成员姓名', dataIndex: 'username', key: 'username' },
    { title: '提交次数', dataIndex: 'commitCount', key: 'commitCount', sorter: true, align: 'center' as const },
    { title: '任务数', dataIndex: 'taskCount', key: 'taskCount', sorter: true, align: 'center' as const },
    { title: '代码质量', dataIndex: 'aiQualityScore', key: 'aiQualityScore', render: (val: number) => <span style={{ color: '#52c41a' }}>{val || '-'}</span>, sorter: true, align: 'center' as const, defaultSortOrder: 'descend' as const },
    { title: '负责项目', dataIndex: 'projects', key: 'projects', render: (ps: any) => {
      if (typeof ps === 'string') return ps || '-';
      if (Array.isArray(ps)) return ps.map(p => p.name || p).join(', ') || '-';
      return '-';
    }},
  ];

  const projectColumns = [
    { title: '项目名称', dataIndex: 'name', key: 'name' },
    { title: '提交次数', dataIndex: 'commitCount', key: 'commitCount', align: 'center' as const },
    { title: '新增行数', dataIndex: 'insertions', key: 'insertions', render: (v: number) => <span className="text-green">+{v || 0}</span>, align: 'center' as const },
    { title: '删除行数', dataIndex: 'deletions', key: 'deletions', render: (v: number) => <span className="text-red">-{v || 0}</span>, align: 'center' as const },
    { title: '参与人数', dataIndex: 'contributorCount', key: 'contributorCount', align: 'center' as const },
  ];

  return (
    <div className="team-report">
      <div className="team-header-banner">
        <Button icon={<ArrowLeftOutlined />} type="link" onClick={() => navigate('/dashboard')} className="back-btn-white">返回大盘</Button>
        <div className="banner-content">
          <Title level={2} style={{ color: 'white', margin: 0 }}>{data?.teamName || '-'} - 小组整体分析报告</Title>
          <div className="leader-info">小组Leader: {data?.leaderName || '未设置'}</div>
          <div className="report-time-white"><ClockCircleOutlined /> 报告生成时间: {data?.reportGeneratedAt ? dayjs(data.reportGeneratedAt).format('YYYY-MM-DD HH:mm') : '-'}</div>
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

      <div className="ai-quick-analysis">
        <div className="ai-icon">AI</div>
        <div className="ai-content">
          <strong>AI 快速分析</strong>
          <p>{data?.aiSummary || '正在生成该小组的综合分析报告...'}</p>
        </div>
      </div>

      <Card className="detail-eval-card" bordered={false} title="AI 详细评价">
        <div className="eval-rating-badge">整体评级：<span className="text-green">{data?.aiRating || '良好'}</span></div>
        <Row gutter={48} style={{ marginTop: 24 }}>
          <Col span={12}>
            <div className="eval-list-wrap">
              <div className="eval-list-title text-green"><CheckCircleOutlined /> 团队优势</div>
              <ul className="eval-list success-list">
                {data?.aiAdvantages?.length > 0 ? data.aiAdvantages.map((item: string, i: number) => <li key={i}>{item}</li>) : <li>-</li>}
              </ul>
            </div>
          </Col>
          <Col span={12}>
            <div className="eval-list-wrap">
              <div className="eval-list-title text-red"><BulbOutlined /> 改进建议</div>
              <ul className="eval-list warning-list">
                {data?.aiSuggestions?.length > 0 ? data.aiSuggestions.map((item: string, i: number) => <li key={i}>{item}</li>) : <li>-</li>}
              </ul>
            </div>
          </Col>
        </Row>
      </Card>

      <Card className="table-card" bordered={false} title="成员表现排行">
        <Table 
          columns={memberColumns} 
          dataSource={sortedMembers} 
          rowKey="id" 
          pagination={false} 
          loading={loading}
          onChange={(_p, _f, sorter) => handleMemberSort(sorter)}
        />
      </Card>

      <Card className="table-card" bordered={false} title="项目统计概览">
        <Table columns={projectColumns} dataSource={data?.projects || []} rowKey="id" pagination={false} loading={loading} />
      </Card>

      <Card className="summary-card-container" bordered={false} title="详细数据汇总">
        <Row gutter={24}>
          <Col span={8}>
            <div className="summary-box">
              <div className="summary-label">总任务数</div>
              <div className="summary-val">{data?.totalTasks || 0}</div>
            </div>
          </Col>
          <Col span={8}>
            <div className="summary-box">
              <div className="summary-label">总新增行数</div>
              <div className="summary-val green">+{data?.totalInsertions || 0}</div>
            </div>
          </Col>
          <Col span={8}>
            <div className="summary-box">
              <div className="summary-label">总删除行数</div>
              <div className="summary-val red">-{data?.totalDeletions || 0}</div>
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  );
};