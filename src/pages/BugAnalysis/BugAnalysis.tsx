import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Row, Col, Card, Table, Tag, Typography, Select, Spin,
  Empty, Alert, Space, Badge, Tooltip, DatePicker, Modal, Descriptions, Divider, Button,
} from 'antd';
import {
  BugOutlined, UserOutlined,
  WarningOutlined, CheckCircleOutlined, RobotOutlined, EyeOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { EChart, echarts } from '../../components/EChart';
import { KPICard } from '../../components/KPICard';
import { request } from '../../api/client';
import { PeriodSelector } from '../../components/PeriodSelector';
import { usePeriodStore } from '../../stores/periodStore';
import { useDefaultPeriod } from '../../hooks/useDefaultPeriod';
import type { KPICardData } from '../../types';
import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import isoWeek from 'dayjs/plugin/isoWeek';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import './BugAnalysis.css';

dayjs.extend(weekOfYear);
dayjs.extend(isoWeek);
dayjs.extend(advancedFormat);

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

interface BugKPI {
  totalBugs: number;
  passedBugs: number;
  passRate: number;
  criticalAndSevere: number;
  criticalRate: number;
}

interface BugOverviewData {
  kpi: BugKPI;
  severityDistribution: { severity: string; count: number }[];
  phaseDistribution: { phase: string; count: number }[];
  typeDistribution: { type: string; count: number }[];
  trendSummary: string | null;
}

interface BugTrendPoint {
  periodValue: string;
  totalBugs: number;
  criticalAndSevere: number;
}

interface BugInsightsData {
  hasData: boolean;
  trendSummary?: string;
  topIssueTypes?: { type: string; count: number; percentage: number; insight: string }[];
  highRiskPersons?: { username: string; bugCount: number; severeBugCount: number; riskLevel: string; suggestion: string }[];
  phaseAnalysis?: { phase: string; count: number; suggestion: string }[];
  aiInsights?: string;
  aiSuggestions?: string[];
}

interface BugListItem {
  id: string;
  bugNo: string;
  bugName: string;
  severity: string;
  bugStatus: string;
  bugFoundPhase: string;
  bugTypeNew: string[];
  fixPerson: string;
  reporter: string;
  dateCreated: string;
  handOffsTimes: number;
  projectName: string;
}

interface BugDetail {
  id: string;
  bugNo: string;
  bugName: string;
  severity: string;
  bugStatus: string;
  bugFoundPhase: string;
  bugTypeNew: string[];
  subsystem: string[];
  fixPerson: string;
  reporter: string;
  createdBy: string;
  dateCreated: string;
  fixTimes: number;
  handOffsTimes: number;
  projectName: string;
  linkedGroupNoDisplay: string;
  committerName: string;
  commitHash: string;
}

interface CodeChange {
  commitHash: string;
  commitMessage: string;
  committerName: string;
  commitDate: string | null;
  projectName: string;
  diff: string;
}

const SEVERITY_COLOR: Record<string, string> = {
  '致命': 'red', '严重': 'orange', '一般': 'blue', '轻微': 'default', '未知': 'default',
};
const SEVERITY_CHART_COLOR: Record<string, string> = {
  '致命': '#f5222d', '严重': '#fa8c16', '一般': '#1890ff', '轻微': '#d9d9d9', '未知': '#bfbfbf',
};
const SEVERITY_ORDER: Record<string, number> = { '致命': 0, '严重': 1, '一般': 2, '轻微': 3, '未知': 4 };
const RISK_COLOR: Record<string, string> = { '高': 'red', '中': 'orange', '低': 'green' };

const CHART_HEIGHT = 260;

function DiffViewer({ diff }: { diff: string }) {
  if (!diff) {
    return <Text type="secondary" style={{ fontSize: 12 }}>暂无代码变更记录（可能 commit 在本地仓库中找不到）</Text>;
  }
  const lines = diff.split('\n');
  return (
    <div style={{
      fontFamily: 'monospace', fontSize: 12, lineHeight: '20px',
      background: '#0d1117', borderRadius: 6, padding: '12px 16px',
      overflowX: 'auto', maxHeight: 400, overflowY: 'auto',
    }}>
      {lines.map((line, i) => {
        let color = '#c9d1d9';
        let bg = 'transparent';
        if (line.startsWith('+') && !line.startsWith('+++')) { color = '#3fb950'; bg = '#1a2e1a'; }
        else if (line.startsWith('-') && !line.startsWith('---')) { color = '#f85149'; bg = '#2e1a1a'; }
        else if (line.startsWith('@@')) { color = '#79c0ff'; }
        else if (line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('---') || line.startsWith('+++')) {
          color = '#8b949e';
        }
        return (
          <div key={i} style={{ color, background: bg, whiteSpace: 'pre', padding: '0 4px' }}>
            {line || ' '}
          </div>
        );
      })}
    </div>
  );
}

export const BugAnalysis: React.FC = () => {
  const { periodType } = usePeriodStore();
  const [selectedDate, setSelectedDate, ready] = useDefaultPeriod('/bugs/periods', periodType);
  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState<BugOverviewData | null>(null);
  const [trend, setTrend] = useState<BugTrendPoint[]>([]);
  const [insights, setInsights] = useState<BugInsightsData | null>(null);
  const [bugList, setBugList] = useState<BugListItem[]>([]);
  const [bugTotal, setBugTotal] = useState(0);
  const [bugPage, setBugPage] = useState(1);
  const [severityFilter, setSeverityFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [bugDetail, setBugDetail] = useState<BugDetail | null>(null);
  const [codeChanges, setCodeChanges] = useState<CodeChange[]>([]);
  const [codeChangesLoading, setCodeChangesLoading] = useState(false);

  const getPeriodValue = useCallback(() => {
    if (periodType === 'week') {
      return selectedDate.day(4).format('YYYYMMDD');
    }
    return selectedDate.format('YYYYMM');
  }, [periodType, selectedDate]);

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

  const loadData = useCallback(async () => {
    const periodValue = getPeriodValue();
    setLoading(true);
    try {
      const params = { periodType, periodValue };
      const [ovRes, trRes, insRes] = await Promise.all([
        request.get<any>('/bugs/overview', params),
        request.get<any>('/bugs/trend', { periodType, limit: 7 }),
        request.get<any>('/bugs/insights', params),
      ]);
      if (ovRes.success) setOverview(ovRes.data);
      if (trRes.success) setTrend(trRes.data);
      if (insRes.success) setInsights(insRes.data);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [periodType, getPeriodValue]);

  const loadBugList = useCallback(async () => {
    const periodValue = getPeriodValue();
    try {
      const res = await request.get<any>('/bugs/list', {
        periodType,
        periodValue,
        page: bugPage,
        limit: 20,
        severity: severityFilter,
        status: statusFilter,
      });
      if (res.success) {
        setBugList(res.data);
        setBugTotal(res.meta?.total || 0);
      }
    } catch {
    }
  }, [periodType, getPeriodValue, bugPage, severityFilter, statusFilter]);

  useEffect(() => { if (ready) loadData(); }, [loadData, ready]);
  useEffect(() => { if (ready) loadBugList(); }, [loadBugList, ready]);

  const openDetail = useCallback(async (bugNo: string) => {
    setDetailVisible(true);
    setDetailLoading(true);
    setBugDetail(null);
    setCodeChanges([]);
    try {
      const res = await request.get<any>('/bugs/detail', { bugNo });
      if (res.success) setBugDetail(res.data);
    } catch {
    } finally {
      setDetailLoading(false);
    }
    setCodeChangesLoading(true);
    try {
      const res = await request.get<any>('/bugs/code-changes', { bugNo });
      if (res.success) setCodeChanges(res.data);
    } catch {
    } finally {
      setCodeChangesLoading(false);
    }
  }, []);

  const handleSearch = () => {
    setBugPage(1);
    loadBugList();
  };

  const handleReset = () => {
    setSeverityFilter(undefined);
    setStatusFilter(undefined);
    setBugPage(1);
  };

  const severityChartData = [...(overview?.severityDistribution || [])]
    .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9));

  const trendChartOption = useMemo<echarts.EChartsOption>(() => {
    const periods = trend.map(p => p.periodValue);
    const totalSeries = trend.map(p => p.totalBugs);
    const criticalSeries = trend.map(p => p.criticalAndSevere);
    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1e293b',
        borderColor: 'rgba(99,102,241,0.3)',
        borderWidth: 1,
        borderRadius: 10,
        textStyle: { color: '#f1f5f9', fontSize: 13 },
        formatter: (params: any[]) => {
          const title = params[0].axisValue;
          const items = params.map(p =>
            `<div style="display:flex;align-items:center;gap:8px;margin:4px 0">
              <span style="width:8px;height:8px;border-radius:50%;background:${p.color};display:inline-block"></span>
              <span style="color:#94a3b8;font-size:12px">${p.seriesName}</span>
              <span style="color:#f1f5f9;font-weight:600;margin-left:auto">${p.value} 个</span>
            </div>`
          ).join('');
          return `<div style="padding:4px 0"><div style="color:#94a3b8;font-size:11px;margin-bottom:6px">${title}</div>${items}</div>`;
        },
      },
      legend: {
        top: 0,
        right: 0,
        itemWidth: 12,
        itemHeight: 8,
        borderRadius: 4,
        textStyle: { color: '#64748b', fontSize: 12 },
      },
      grid: { left: 40, right: 20, top: 36, bottom: 30 },
      xAxis: {
        type: 'category',
        data: periods,
        axisLabel: { color: '#64748b', fontSize: 11 },
        axisLine: { lineStyle: { color: '#cbd5e1' } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        axisLabel: { color: '#64748b', fontSize: 11 },
        splitLine: { lineStyle: { color: '#e2e8f0', type: 'dashed' } },
        axisLine: { show: false },
      },
      series: [
        {
          name: '总计',
          type: 'line',
          smooth: true,
          data: totalSeries,
          symbol: 'circle',
          symbolSize: 7,
          lineStyle: { width: 2.5, color: '#6366f1' },
          itemStyle: { color: '#6366f1', borderColor: '#fff', borderWidth: 2 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(99,102,241,0.35)' },
              { offset: 1, color: 'rgba(99,102,241,0.03)' },
            ]),
          },
        },
        {
          name: '致命+严重',
          type: 'line',
          smooth: true,
          data: criticalSeries,
          symbol: 'circle',
          symbolSize: 7,
          lineStyle: { width: 2, color: '#f43f5e' },
          itemStyle: { color: '#f43f5e', borderColor: '#fff', borderWidth: 2 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(244,63,94,0.25)' },
              { offset: 1, color: 'rgba(244,63,94,0.02)' },
            ]),
          },
        },
      ],
    };
  }, [trend]);

  const SEVERITY_BAR_COLORS: Record<string, [string, string]> = {
    '致命': ['#dc2626', '#f87171'],
    '严重': ['#ea580c', '#fb923c'],
    '一般': ['#2563eb', '#60a5fa'],
    '轻微': ['#059669', '#34d399'],
    '未知': ['#6b7280', '#9ca3af'],
  };

  const severityChartOption = useMemo<echarts.EChartsOption>(() => ({
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1e293b',
      borderColor: 'rgba(99,102,241,0.3)',
      borderWidth: 1,
      borderRadius: 10,
      textStyle: { color: '#f1f5f9', fontSize: 13 },
      formatter: (params: any[]) => {
        const p = params[0];
        const [start] = SEVERITY_BAR_COLORS[p.name] || ['#3b82f6', '#3b82f6'];
        return `<div style="padding:4px 0">
          <div style="color:#94a3b8;font-size:11px;margin-bottom:6px">严重程度</div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="width:10px;height:10px;border-radius:3px;background:${start};display:inline-block"></span>
            <span style="color:#f1f5f9;font-weight:600">${p.name}: ${p.value} 个</span>
          </div>
        </div>`;
      },
    },
    grid: { left: 36, right: 24, top: 20, bottom: 30 },
    xAxis: {
      type: 'category',
      data: severityChartData.map(d => d.severity),
      axisLabel: { color: '#64748b', fontSize: 12, fontWeight: '500' as any },
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: { color: '#64748b', fontSize: 11 },
      splitLine: { lineStyle: { color: '#e2e8f0', type: 'dashed' } },
      axisLine: { show: false },
    },
    series: [{
      type: 'bar',
      data: severityChartData.map(d => ({
        value: d.count,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: (SEVERITY_BAR_COLORS[d.severity] || ['#3b82f6', '#93c5fd'])[0] },
            { offset: 1, color: (SEVERITY_BAR_COLORS[d.severity] || ['#3b82f6', '#93c5fd'])[1] },
          ]),
          borderRadius: [6, 6, 0, 0],
          shadowColor: 'rgba(0,0,0,0.08)',
          shadowBlur: 8,
          shadowOffsetY: 2,
        },
      })),
      barMaxWidth: 40,
      barMinWidth: 24,
      label: {
        show: true,
        position: 'top',
        distance: 4,
        color: '#475569',
        fontSize: 12,
        fontWeight: '600' as any,
      },
    }],
  }), [severityChartData]);

  const phaseChartOption = useMemo<echarts.EChartsOption>(() => {
    const phaseData = overview?.phaseDistribution || [];
    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1e293b',
        borderColor: 'rgba(99,102,241,0.3)',
        borderWidth: 1,
        borderRadius: 10,
        textStyle: { color: '#f1f5f9', fontSize: 13 },
        formatter: (params: any[]) => {
          const p = params[0];
          return `<div style="padding:4px 0">
            <div style="color:#94a3b8;font-size:11px;margin-bottom:6px">发现阶段</div>
            <div style="display:flex;align-items:center;gap:8px">
              <span style="width:10px;height:10px;border-radius:3px;background:#6366f1;display:inline-block"></span>
              <span style="color:#f1f5f9;font-weight:600">${p.name}: ${p.value} 个</span>
            </div>
          </div>`;
        },
      },
      grid: { left: 36, right: 24, top: 20, bottom: 30 },
      xAxis: {
        type: 'category',
        data: phaseData.map(d => d.phase),
        axisLabel: { color: '#64748b', fontSize: 11, fontWeight: '500' as any },
        axisLine: { lineStyle: { color: '#cbd5e1' } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        axisLabel: { color: '#64748b', fontSize: 11 },
        splitLine: { lineStyle: { color: '#e2e8f0', type: 'dashed' } },
        axisLine: { show: false },
      },
      series: [{
        type: 'bar',
        data: phaseData.map((d, i) => ({
          value: d.count,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: i % 2 === 0 ? '#4f46e5' : '#0891b2' },
              { offset: 1, color: i % 2 === 0 ? '#818cf8' : '#67e8f9' },
            ]),
            borderRadius: [6, 6, 0, 0],
            shadowColor: 'rgba(99,102,241,0.2)',
            shadowBlur: 10,
            shadowOffsetY: 4,
          },
        })),
        barMaxWidth: 44,
        barMinWidth: 28,
        label: {
          show: true,
          position: 'top',
          distance: 4,
          color: '#475569',
          fontSize: 12,
          fontWeight: '600' as any,
        },
      }],
    };
  }, [overview?.phaseDistribution]);

  const kpiData: Array<{ data: KPICardData; iconType: 'user' | 'commit' | 'task' | 'trophy' }> = overview
    ? [
        { data: { title: '本期 Bug 总数', value: overview.kpi.totalBugs }, iconType: 'commit' },
        { data: { title: '验证通过率', value: `${overview.kpi.passRate}%`, tips: `${overview.kpi.passedBugs} 个已通过` }, iconType: 'task' },
        { data: { title: '致命 + 严重', value: overview.kpi.criticalAndSevere, tips: `占比 ${overview.kpi.criticalRate}%` }, iconType: 'trophy' },
        { data: { title: '涉及修复人数', value: overview.kpi.fixerCount ?? 0 }, iconType: 'user' },
      ]
    : [];

  const bugColumns = [
    {
      title: 'Bug 号',
      dataIndex: 'bugNo',
      key: 'bugNo',
      width: 130,
      render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: '标题',
      dataIndex: 'bugName',
      key: 'bugName',
      ellipsis: true,
      render: (v: string) => <Tooltip title={v}><span>{v}</span></Tooltip>,
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      align: 'center' as const,
      render: (v: string) => <Tag color={SEVERITY_COLOR[v] || 'default'}>{v || '-'}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'bugStatus',
      key: 'bugStatus',
      width: 120,
      render: (v: string) => (
        <Badge
          status={v?.includes('验证通过') ? 'success' : v?.includes('待') ? 'processing' : 'default'}
          text={v || '-'}
        />
      ),
    },
    { title: '发现阶段', dataIndex: 'bugFoundPhase', key: 'bugFoundPhase', width: 100, align: 'center' as const },
    { title: '修复人', dataIndex: 'fixPerson', key: 'fixPerson', width: 100 },
    { title: '关联项目', dataIndex: 'projectName', key: 'projectName', width: 130, ellipsis: true },
    {
      title: '创建时间',
      dataIndex: 'dateCreated',
      key: 'dateCreated',
      width: 120,
      align: 'center' as const,
      render: (v: string) => v ? dayjs(v).format('MM-DD HH:mm') : '-',
    },
    {
      title: '详情',
      key: 'action',
      width: 70,
      align: 'center' as const,
      fixed: 'right' as const,
      render: (_: any, record: BugListItem) => (
        <Space
          onClick={() => openDetail(record.bugNo)}
          style={{ cursor: 'pointer', color: '#666' }}
        >
          <EyeOutlined />
          <span>查看</span>
        </Space>
      ),
    },
  ];

  const hasData = (overview?.kpi?.totalBugs ?? 0) > 0;

  return (
    <div className="bug-analysis-page">
      <div className="page-header">
        <Space size="large">
          {/* <div className="filter-group">
            <span className="filter-label">统计维度：</span>
            <PeriodSelector />
          </div> */}
          <div className="filter-group">
            <span className="filter-label">时间范围：</span>
            <DatePicker
              picker={periodType === 'week' ? 'week' : 'month'}
              value={selectedDate}
              onChange={(d) => d && setSelectedDate(d)}
              allowClear={false}
              format={periodType === 'week' ? 'YYYY-WW[周]' : 'YYYY-MM'}
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

      <Spin spinning={loading}>
        {!hasData && !loading ? (
          <Empty
            description="本期暂无 Bug 数据"
            style={{ marginTop: 60 }}
          />
        ) : (
          <>
            <div className="kpi-section">
              <Row gutter={24}>
                {kpiData.map((item, index) => (
                  <Col span={6} key={index}>
                    <KPICard data={item.data} loading={loading} iconType={item.iconType} />
                  </Col>
                ))}
              </Row>
            </div>

            {/* {overview?.trendSummary && (
              <Alert message={overview.trendSummary} type="info" showIcon style={{ marginBottom: 24 }} />
            )} */}

            <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
              <Col span={10}>
                <Card title="缺陷趋势（最近 7 期）" bordered={false} size="small" className="chart-card">
                  {trend.length > 0 ? (
                    <EChart option={trendChartOption} height={CHART_HEIGHT} />
                  ) : (
                    <Empty description="暂无趋势数据" style={{ paddingTop: 60 }} />
                  )}
                </Card>
              </Col>
              <Col span={7}>
                <Card title="严重程度分布" bordered={false} size="small" className="chart-card">
                  {severityChartData.length > 0 ? (
                    <EChart option={severityChartOption} height={CHART_HEIGHT} />
                  ) : (
                    <Empty description="暂无数据" style={{ paddingTop: 60 }} />
                  )}
                </Card>
              </Col>
              <Col span={7}>
                <Card title="发现阶段分布" bordered={false} size="small" className="chart-card">
                  {(overview?.phaseDistribution?.length ?? 0) > 0 ? (
                    <EChart option={phaseChartOption} height={CHART_HEIGHT} />
                  ) : (
                    <Empty description="暂无数据" style={{ paddingTop: 60 }} />
                  )}
                </Card>
              </Col>
            </Row>

            <div className="section-card">
              <Title level={5} style={{ marginBottom: 20 }}>Bug 明细</Title>
              <div className="analysis-filter-bar" style={{ display: 'flex', alignItems: 'flex-end', gap: '16px' }}>
                <div className="filter-item" style={{ display: 'flex', flexDirection: 'column', minWidth: '140px' }}>
                  <div className="filter-label">严重程度</div>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="全部"
                    value={severityFilter}
                    onChange={(v) => setSeverityFilter(v)}
                    allowClear
                  >
                    <Option value="">全部</Option>
                    {['致命', '严重', '一般', '轻微'].map(v => <Option key={v} value={v}>{v}</Option>)}
                  </Select>
                </div>
                <div className="filter-item" style={{ display: 'flex', flexDirection: 'column', minWidth: '140px' }}>
                  <div className="filter-label">状态</div>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="全部"
                    value={statusFilter}
                    onChange={(v) => setStatusFilter(v)}
                    allowClear
                  >
                    <Option value="">全部</Option>
                    <Option value="验证通过">验证通过</Option>
                    <Option value="待验证">待验证</Option>
                    <Option value="待处理">待处理</Option>
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
                dataSource={bugList}
                columns={bugColumns}
                rowKey="id"
                bordered
                pagination={{
                  current: bugPage,
                  pageSize: 20,
                  total: bugTotal,
                  onChange: setBugPage,
                  showTotal: (total, range) => `显示 ${range[0]} 到 ${range[1]} 条，共 ${total} 条`,
                }}
                size="middle"
                scroll={{ x: 1100 }}
              />
            </div>

            {insights?.hasData && (
              <div className="section-card">
                <Title level={5} style={{ marginBottom: 20 }}>
                  <RobotOutlined style={{ color: '#722ed1', marginRight: 6 }} />
                  AI 洞察
                </Title>
                <Row gutter={[16, 16]}>
                  <Col span={24}>
                    <Paragraph style={{ fontSize: 14, lineHeight: 1.8 }}>
                      {insights.aiInsights || '暂无'}
                    </Paragraph>
                    {(insights.aiSuggestions || []).length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <Text strong>改进建议：</Text>
                        <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                          {insights.aiSuggestions!.map((s, i) => (
                            <li key={i} style={{ marginBottom: 6, color: '#595959' }}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </Col>

                  {(insights.highRiskPersons || []).length > 0 && (
                    <Col span={12}>
                      <Card title="高风险修复人" bordered={false} size="small" className="insight-sub-card">
                        <Table
                          dataSource={insights.highRiskPersons}
                          rowKey="username"
                          pagination={false}
                          size="small"
                          columns={[
                            { title: '用户名', dataIndex: 'username' },
                            { title: 'Bug 数', dataIndex: 'bugCount', width: 70, align: 'center' as const },
                            {
                              title: '风险',
                              dataIndex: 'riskLevel',
                              width: 80,
                              align: 'center' as const,
                              render: (v: string) => <Tag color={RISK_COLOR[v] || 'default'}>{v}</Tag>,
                            },
                            { title: '建议', dataIndex: 'suggestion', ellipsis: true },
                          ]}
                        />
                      </Card>
                    </Col>
                  )}

                  {(insights.topIssueTypes || []).length > 0 && (
                    <Col span={12}>
                      <Card title="高频问题类型" bordered={false} size="small" className="insight-sub-card">
                        <Table
                          dataSource={insights.topIssueTypes}
                          rowKey="type"
                          pagination={false}
                          size="small"
                          columns={[
                            { title: '类型', dataIndex: 'type' },
                            { title: '数量', dataIndex: 'count', width: 60, align: 'center' as const },
                            { title: '占比', dataIndex: 'percentage', width: 70, align: 'center' as const, render: (v: number) => `${v}%` },
                            { title: '洞察', dataIndex: 'insight', ellipsis: true },
                          ]}
                        />
                      </Card>
                    </Col>
                  )}


                </Row>
              </div>
            )}
          </>
        )}
      </Spin>

      <Modal
        title={bugDetail ? `Bug 详情 - ${bugDetail.bugNo}` : 'Bug 详情'}
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={1000}
      >
        <Spin spinning={detailLoading}>
          {bugDetail && (
            <>
              <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
                <Descriptions.Item label="Bug 号">
                  <Text code>{bugDetail.bugNo}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="严重程度">
                  <Tag color={SEVERITY_COLOR[bugDetail.severity] || 'default'}>{bugDetail.severity}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Badge
                    status={bugDetail.bugStatus?.includes('验证通过') ? 'success' : bugDetail.bugStatus?.includes('待') ? 'processing' : 'default'}
                    text={bugDetail.bugStatus}
                  />
                </Descriptions.Item>
                <Descriptions.Item label="发现阶段">{bugDetail.bugFoundPhase}</Descriptions.Item>
                <Descriptions.Item label="标题" span={2}>{bugDetail.bugName}</Descriptions.Item>
                <Descriptions.Item label="修复人">{bugDetail.fixPerson || '-'}</Descriptions.Item>
                <Descriptions.Item label="报告人">{bugDetail.reporter || '-'}</Descriptions.Item>
                <Descriptions.Item label="项目">{bugDetail.projectName || '-'}</Descriptions.Item>
                <Descriptions.Item label="修复次数">{bugDetail.fixTimes ?? '-'}</Descriptions.Item>
                {bugDetail.bugTypeNew && (bugDetail.bugTypeNew as string[]).length > 0 && (
                  <Descriptions.Item label="缺陷类型" span={2}>
                    <Space size={4} wrap>
                      {bugDetail.bugTypeNew.map((t, i) => <Tag key={i}>{t}</Tag>)}
                    </Space>
                  </Descriptions.Item>
                )}
                {bugDetail.subsystem && (bugDetail.subsystem as string[]).length > 0 && (
                  <Descriptions.Item label="影响文件/模块" span={2}>
                    <Space size={4} wrap>
                      {(bugDetail.subsystem as string[]).map((s, i) => (
                        <Tag key={i} color="geekblue">{s}</Tag>
                      ))}
                    </Space>
                  </Descriptions.Item>
                )}
                {bugDetail.commitHash && (
                  <Descriptions.Item label="关联 commit" span={2}>
                    <Text code style={{ fontSize: 12 }}>{bugDetail.commitHash}</Text>
                    {bugDetail.committerName && (
                      <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>提交人: {bugDetail.committerName}</Text>
                    )}
                  </Descriptions.Item>
                )}
                {bugDetail.linkedGroupNoDisplay && (
                  <Descriptions.Item label="负责部门组" span={2}>
                    {bugDetail.linkedGroupNoDisplay}
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="创建时间">
                  {bugDetail.dateCreated ? dayjs(bugDetail.dateCreated).format('YYYY-MM-DD HH:mm') : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="移交次数">{bugDetail.handOffsTimes ?? '-'}</Descriptions.Item>
              </Descriptions>

              <Divider orientation="left" style={{ fontSize: 13 }}>
                代码变更
              </Divider>
              <Spin spinning={codeChangesLoading}>
                {codeChanges.length === 0 && !codeChangesLoading ? (
                  <Text type="secondary">未找到关联的代码变更（commit 消息中未包含该 Bug 号，或本地仓库路径未配置）</Text>
                ) : (
                  codeChanges.map((c, idx) => (
                    <div key={idx} style={{ marginBottom: 20 }}>
                      <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Tag color="blue">{c.projectName || '未知仓库'}</Tag>
                        <Text code style={{ fontSize: 12 }}>{c.commitHash.slice(0, 10)}</Text>
                        <Text style={{ fontSize: 12, color: '#595959' }}>{c.commitMessage}</Text>
                        <Text type="secondary" style={{ fontSize: 11, marginLeft: 'auto' }}>
                          {c.committerName}
                          {c.commitDate ? ' · ' + dayjs(c.commitDate).format('MM-DD HH:mm') : ''}
                        </Text>
                      </div>
                      <DiffViewer diff={c.diff} />
                    </div>
                  ))
                )}
              </Spin>
            </>
          )}
        </Spin>
      </Modal>
    </div>
  );
};
