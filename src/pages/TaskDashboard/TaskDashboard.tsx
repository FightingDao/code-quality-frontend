import React, { useState, useEffect, useCallback } from 'react';
import {
  Row, Col, Card, Table, Tag, Typography, Select, Spin,
  Empty, Space, Tooltip, Progress, DatePicker, Modal, Descriptions, Divider,
} from 'antd';
import {
  FireOutlined, RocketOutlined, CheckCircleOutlined, AppstoreOutlined,
  InfoCircleOutlined, QuestionCircleOutlined,
} from '@ant-design/icons';
import { Pie, Radar } from '@ant-design/charts';
import { request } from '../../api/client';
import { PeriodSelector } from '../../components/PeriodSelector';
import { usePeriodStore } from '../../stores/periodStore';
import { useDefaultPeriod } from '../../hooks/useDefaultPeriod';
import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import isoWeek from 'dayjs/plugin/isoWeek';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import './TaskDashboard.css';

dayjs.extend(weekOfYear);
dayjs.extend(isoWeek);
dayjs.extend(advancedFormat);

const { Title, Text } = Typography;

// ─── 类型 ─────────────────────────────────────────────────────────────────────

interface KPIData {
  total: number;
  high: number;
  medium: number;
  low: number;
  avgScore: number;
  highRate: number;
}

interface DistributionItem {
  level: string;
  count: number;
}

interface DimensionItem {
  dimension: string;
  score: number;
}

interface TaskItem {
  id: string;
  taskNo: string;
  projectNames: string[];
  committers: string[];
  difficultyLevel: string;
  totalScore: number;
  scoreScale: number;
  scoreComplexity: number;
  scoreIssueDensity: number;
  scoreAi: number;
  scoreCrossModule: number;
  rawLoc: number;
  rawCommitCount: number;
  rawIssueCount: number;
  rawAvgAiScore: number | null;
  rawModuleCount: number;
}

// ─── 常量 ─────────────────────────────────────────────────────────────────────

const LEVEL_CONFIG: Record<string, { label: string; color: string; antColor: string; icon: React.ReactNode }> = {
  HIGH:   { label: '高难度', color: '#f5222d', antColor: 'red',    icon: <FireOutlined /> },
  MEDIUM: { label: '中等',   color: '#fa8c16', antColor: 'orange', icon: <RocketOutlined /> },
  LOW:    { label: '低难度', color: '#52c41a', antColor: 'green',  icon: <CheckCircleOutlined /> },
};

const DIM_LABELS: Record<string, string> = {
  scoreScale:        '代码规模',
  scoreComplexity:   '代码复杂度',
  scoreIssueDensity: '缺陷密度',
  scoreAi:           'AI质量反转',
  scoreCrossModule:  '跨模块影响',
};

const DIM_WEIGHT: Record<string, string> = {
  scoreScale:        '25%',
  scoreComplexity:   '25%',
  scoreIssueDensity: '20%',
  scoreAi:           '20%',
  scoreCrossModule:  '10%',
};

const DIM_DESC: Record<string, string> = {
  scoreScale:        'LOC / 50 × 70% + 提交数 × 5 × 30%（上限100）',
  scoreComplexity:   '均LOC/提交 ÷ 2 × 60% + P1 Issue占比 × 40%',
  scoreIssueDensity: 'Issues ÷ KLOC × 5（上限100，20条/KLOC = 100）',
  scoreAi:           '100 − AI质量分（分越低任务越难，无评分默认50）',
  scoreCrossModule:  '不同根目录数 × 10（上限100，10个模块 = 100）',
};

// ─── 任务详情弹窗 ─────────────────────────────────────────────────────────────

function TaskDetailModal({ task, onClose }: { task: TaskItem | null; onClose: () => void }) {
  if (!task) return null;

  const cfg = LEVEL_CONFIG[task.difficultyLevel];
  const scoreColor = (v: number) => v >= 65 ? '#f5222d' : v >= 35 ? '#fa8c16' : '#52c41a';

  const dims = [
    { key: 'scoreScale',        value: task.scoreScale },
    { key: 'scoreComplexity',   value: task.scoreComplexity },
    { key: 'scoreIssueDensity', value: task.scoreIssueDensity },
    { key: 'scoreAi',           value: task.scoreAi },
    { key: 'scoreCrossModule',  value: task.scoreCrossModule },
  ];

  const radarData = dims.map(d => ({ item: DIM_LABELS[d.key], score: +d.value.toFixed(1) }));

  return (
    <Modal
      open
      title={
        <Space>
          <span style={{ fontFamily: 'monospace', fontSize: 16 }}>{task.taskNo}</span>
          {cfg && <Tag color={cfg.antColor} icon={cfg.icon}>{cfg.label}</Tag>}
          <span style={{ fontSize: 20, fontWeight: 700, color: scoreColor(task.totalScore) }}>
            {task.totalScore.toFixed(1)}分
          </span>
        </Space>
      }
      onCancel={onClose}
      footer={null}
      width={680}
    >
      <Descriptions size="small" column={2} style={{ marginBottom: 16 }}>
        <Descriptions.Item label="项目">
          <Space size={4} wrap>{(task.projectNames || []).map(p => <Tag key={p}>{p}</Tag>)}</Space>
        </Descriptions.Item>
        <Descriptions.Item label="开发者">
          <Space size={4} wrap>{(task.committers || []).map(c => <Tag color="blue" key={c}>{c}</Tag>)}</Space>
        </Descriptions.Item>
        <Descriptions.Item label="改动行数">{task.rawLoc.toLocaleString()} LOC</Descriptions.Item>
        <Descriptions.Item label="提交数">{task.rawCommitCount} 个</Descriptions.Item>
        <Descriptions.Item label="Issue 数">{task.rawIssueCount} 条</Descriptions.Item>
        <Descriptions.Item label="跨模块数">{task.rawModuleCount} 个</Descriptions.Item>
        {task.rawAvgAiScore != null && (
          <Descriptions.Item label="均AI质量分">{task.rawAvgAiScore}</Descriptions.Item>
        )}
      </Descriptions>

      <Divider style={{ margin: '12px 0' }}>5维评分明细</Divider>

      <Row gutter={[16, 0]}>
        <Col span={12}>
          {dims.map(d => (
            <div key={d.key} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <Space size={4}>
                  <Typography.Text style={{ fontSize: 13 }}>{DIM_LABELS[d.key]}</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>权重 {DIM_WEIGHT[d.key]}</Typography.Text>
                </Space>
                <Typography.Text style={{ color: scoreColor(d.value), fontWeight: 700 }}>
                  {d.value.toFixed(1)}
                </Typography.Text>
              </div>
              <Progress
                percent={+d.value.toFixed(0)}
                size="small"
                strokeColor={scoreColor(d.value)}
                showInfo={false}
              />
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>{DIM_DESC[d.key]}</Typography.Text>
            </div>
          ))}
        </Col>
        <Col span={12}>
          <Radar
            data={radarData}
            xField="item"
            yField="score"
            meta={{ score: { min: 0, max: 100 } }}
            area={{ style: { fillOpacity: 0.2 } }}
            point={{ size: 4 }}
            height={260}
          />
        </Col>
      </Row>

      <Divider style={{ margin: '12px 0' }}>难度阈值说明</Divider>
      <Space>
        <Tag color="red">高难度 ≥ 65</Tag>
        <Tag color="orange">中等 35 ~ 64</Tag>
        <Tag color="green">低难度 &lt; 35</Tag>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          综合得分 = 规模×25% + 复杂度×25% + 缺陷密度×20% + AI反转×20% + 跨模块×10%
        </Typography.Text>
      </Space>
    </Modal>
  );
}

// ─── KPI 卡片 ─────────────────────────────────────────────────────────────────

function KPICard({ title, value, suffix, icon, color }: {
  title: string; value: number | string; suffix?: string;
  icon: React.ReactNode; color: string;
}) {
  return (
    <Card style={{ borderTop: `3px solid ${color}` }} styles={{ body: { padding: '16px 20px' } }}>
      <Space align="start" style={{ width: '100%', justifyContent: 'space-between' }}>
        <div>
          <Text type="secondary" style={{ fontSize: 13 }}>{title}</Text>
          <div style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1.2, marginTop: 4 }}>
            {value}<span style={{ fontSize: 14, fontWeight: 400, marginLeft: 4 }}>{suffix}</span>
          </div>
        </div>
        <div style={{ fontSize: 28, color, opacity: 0.7 }}>{icon}</div>
      </Space>
    </Card>
  );
}

// ─── 维度进度条 ───────────────────────────────────────────────────────────────

function DimensionBars({ item }: { item: TaskItem }) {
  const dims = [
    { key: 'scoreScale',        label: '代码规模',   value: item.scoreScale },
    { key: 'scoreComplexity',   label: '代码复杂度', value: item.scoreComplexity },
    { key: 'scoreIssueDensity', label: '缺陷密度',   value: item.scoreIssueDensity },
    { key: 'scoreAi',           label: 'AI质量反转', value: item.scoreAi },
    { key: 'scoreCrossModule',  label: '跨模块影响', value: item.scoreCrossModule },
  ];

  const getStrokeColor = (v: number) => v >= 65 ? '#f5222d' : v >= 35 ? '#fa8c16' : '#52c41a';

  return (
    <div style={{ padding: '8px 24px 12px' }}>
      <Row gutter={[16, 4]}>
        {dims.map(d => (
          <Col span={24} key={d.key}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Text style={{ width: 90, fontSize: 12, flexShrink: 0 }}>{d.label}</Text>
              <Progress
                percent={+d.value.toFixed(0)}
                size="small"
                strokeColor={getStrokeColor(d.value)}
                style={{ flex: 1, marginBottom: 0 }}
                format={v => <span style={{ fontSize: 11 }}>{v}</span>}
              />
            </div>
          </Col>
        ))}
        <Col span={24}>
          <div style={{ marginTop: 8, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>改动行数: {item.rawLoc.toLocaleString()}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>提交数: {item.rawCommitCount}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>Issue数: {item.rawIssueCount}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>模块数: {item.rawModuleCount}</Text>
            {item.rawAvgAiScore != null && (
              <Text type="secondary" style={{ fontSize: 12 }}>均AI质量分: {item.rawAvgAiScore}</Text>
            )}
          </div>
        </Col>
      </Row>
    </div>
  );
}

// ─── 主页面 ───────────────────────────────────────────────────────────────────

export const TaskDashboard: React.FC = () => {
  const { periodType } = usePeriodStore();
  const [selectedDate, setSelectedDate] = useDefaultPeriod('/tasks/periods', periodType);
  const [kpi, setKpi] = useState<KPIData | null>(null);
  const [distribution, setDistribution] = useState<DistributionItem[]>([]);
  const [avgDimensions, setAvgDimensions] = useState<DimensionItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [taskTotal, setTaskTotal] = useState(0);
  const [taskPage, setTaskPage] = useState(1);
  const [taskLimit] = useState(20);
  const [filterLevel, setFilterLevel] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);

  const getPeriodValue = useCallback(() => {
    if (periodType === 'week') return selectedDate.day(4).format('YYYYMMDD');
    if (periodType === 'month') return selectedDate.format('YYYYMM');
    return selectedDate.format('YYYYMMDD');
  }, [periodType, selectedDate]);

  const getWeekInfo = () => {
    if (periodType !== 'week') return null;
    const weekNum = selectedDate.week();
    const monday = selectedDate.day(1);
    const sunday = selectedDate.day(7);
    return {
      weekInMonth: `${selectedDate.month() + 1}月第${weekNum - dayjs(selectedDate).startOf('month').week() + 1}周`,
      dateRange: `${monday.format('MM-DD')} ~ ${sunday.format('MM-DD')}`,
    };
  };

  const weekInfo = getWeekInfo();
  const periodValue = getPeriodValue();

  // 加载数据
  useEffect(() => {
    setLoading(true);
    Promise.all([
      request.get('/tasks/overview', { periodType, periodValue }),
      request.get('/tasks/distribution', { periodType, periodValue }),
    ]).then(([overviewRes, distRes]: any[]) => {
      setKpi(overviewRes.data?.kpi ?? null);
      setDistribution(distRes.data?.difficultyDistribution ?? []);
      setAvgDimensions(distRes.data?.avgDimensions ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [periodType, periodValue]);

  // 加载任务列表
  useEffect(() => {
    const params: any = { periodType, periodValue, page: taskPage, limit: taskLimit };
    if (filterLevel) params.difficulty = filterLevel;
    request.get('/tasks/list', params).then((res: any) => {
      setTasks(res.data?.items ?? []);
      setTaskTotal(res.data?.meta?.total ?? 0);
    }).catch(() => {});
  }, [periodType, periodValue, taskPage, taskLimit, filterLevel]);

  const pieData = distribution.map(d => ({
    type: LEVEL_CONFIG[d.level]?.label ?? d.level,
    value: d.count,
    color: LEVEL_CONFIG[d.level]?.color ?? '#999',
  }));

  const radarData = avgDimensions.map(d => ({ item: d.dimension, score: d.score }));

  const columns = [
    {
      title: '任务号',
      dataIndex: 'taskNo',
      width: 150,
      render: (v: string, record: TaskItem) => (
        <Space>
          <Text strong style={{ fontFamily: 'monospace' }}>{v}</Text>
          <Tooltip title="查看评分依据">
            <InfoCircleOutlined
              style={{ color: '#1677ff', cursor: 'pointer' }}
              onClick={() => setSelectedTask(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
    {
      title: '项目',
      dataIndex: 'projectNames',
      width: 160,
      render: (v: string[]) => (
        <Space size={4} wrap>
          {(v || []).map(p => <Tag key={p} style={{ fontSize: 11, margin: 0 }}>{p}</Tag>)}
        </Space>
      ),
    },
    {
      title: '开发者',
      dataIndex: 'committers',
      width: 160,
      render: (v: string[]) => (
        <Space size={4} wrap>
          {(v || []).map(c => <Tag key={c} color="blue" style={{ fontSize: 11, margin: 0 }}>{c}</Tag>)}
        </Space>
      ),
    },
    {
      title: '难度',
      dataIndex: 'difficultyLevel',
      width: 90,
      render: (v: string) => {
        const cfg = LEVEL_CONFIG[v];
        return cfg ? <Tag color={cfg.antColor} icon={cfg.icon}>{cfg.label}</Tag> : <Tag>{v}</Tag>;
      },
    },
    {
      title: '综合得分',
      dataIndex: 'totalScore',
      width: 100,
      sorter: (a: TaskItem, b: TaskItem) => a.totalScore - b.totalScore,
      render: (v: number) => {
        const color = v >= 65 ? '#f5222d' : v >= 35 ? '#fa8c16' : '#52c41a';
        return <Text style={{ color, fontWeight: 700, fontSize: 16 }}>{v.toFixed(1)}</Text>;
      },
    },
    {
      title: '规模',
      dataIndex: 'scoreScale',
      width: 65,
      render: (v: number) => renderDimScore(v),
    },
    {
      title: '复杂度',
      dataIndex: 'scoreComplexity',
      width: 70,
      render: (v: number) => renderDimScore(v),
    },
    {
      title: '缺陷密度',
      dataIndex: 'scoreIssueDensity',
      width: 75,
      render: (v: number) => renderDimScore(v),
    },
    {
      title: 'AI反转',
      dataIndex: 'scoreAi',
      width: 70,
      render: (v: number) => renderDimScore(v),
    },
    {
      title: '跨模块',
      dataIndex: 'scoreCrossModule',
      width: 70,
      render: (v: number) => renderDimScore(v),
    },
  ];

  return (
    <div className="task-dashboard">
      {/* 头部 — 与大盘视图保持一致 */}
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
              onChange={d => d && setSelectedDate(d)}
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

      <Spin spinning={loading}>
        {/* KPI 卡片 */}
        <Row gutter={[16, 16]}>
          <Col span={6}>
            <KPICard title="总任务数" value={kpi?.total ?? 0} icon={<AppstoreOutlined />} color="#1677ff" />
          </Col>
          <Col span={6}>
            <KPICard title="高难度" value={kpi?.high ?? 0} icon={<FireOutlined />} color="#f5222d" />
          </Col>
          <Col span={6}>
            <KPICard title="中等难度" value={kpi?.medium ?? 0} icon={<RocketOutlined />} color="#fa8c16" />
          </Col>
          <Col span={6}>
            <KPICard title="低难度" value={kpi?.low ?? 0} icon={<CheckCircleOutlined />} color="#52c41a" />
          </Col>
        </Row>

        {/* 图表区 */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={10}>
            <Card title="难度分布" style={{ height: 320 }}>
              {pieData.length > 0 ? (
                <Pie
                  data={pieData}
                  angleField="value"
                  colorField="type"
                  radius={0.8}
                  innerRadius={0.5}
                  label={{ text: 'type', style: { fontSize: 13 } }}
                  legend={{ position: 'bottom' }}
                  color={pieData.map(d => d.color)}
                  height={240}
                />
              ) : <Empty description="暂无数据" style={{ marginTop: 60 }} />}
            </Card>
          </Col>
          <Col span={14}>
            <Card
              title={
                <Space size={6}>
                  全团队各维度均值
                  <Tooltip
                    overlayStyle={{ maxWidth: 340 }}
                    title={
                      <div style={{ fontSize: 12, lineHeight: '20px' }}>
                        {[
                          { name: '代码规模（权重25%）', desc: '综合改动行数与提交数量评估工作体量。LOC / 50 × 70% + 提交数 × 5 × 30%，满分 100。' },
                          { name: '代码复杂度（权重25%）', desc: '以均值 LOC/提交 衡量每次提交的复杂程度，结合 P1 严重 Issue 占比。均LOC/提交 ÷ 2 × 60% + P1占比 × 40%。' },
                          { name: '缺陷密度（权重20%）', desc: '每千行代码的 Issue 数量，反映代码质量压力。Issues ÷ KLOC × 5，20条/KLOC = 满分。' },
                          { name: 'AI质量反转（权重20%）', desc: 'AI 代码质量评分越低，说明任务越难。得分 = 100 − AI质量分，无 AI 评分时默认 50 分。' },
                          { name: '跨模块影响（权重10%）', desc: '任务涉及的不同根目录（模块）数量，模块越多协调成本越高。模块数 × 10，10个模块 = 满分。' },
                        ].map(d => (
                          <div key={d.name} style={{ marginBottom: 8 }}>
                            <div style={{ fontWeight: 600, color: '#fff' }}>{d.name}</div>
                            <div style={{ color: 'rgba(255,255,255,0.75)' }}>{d.desc}</div>
                          </div>
                        ))}
                      </div>
                    }
                  >
                    <QuestionCircleOutlined style={{ color: '#8c8c8c', cursor: 'help' }} />
                  </Tooltip>
                </Space>
              }
              style={{ height: 320 }}
            >
              {radarData.length > 0 ? (
                <Radar
                  data={radarData}
                  xField="item"
                  yField="score"
                  meta={{ score: { min: 0, max: 100 } }}
                  area={{ style: { fillOpacity: 0.2 } }}
                  point={{ size: 4 }}
                  height={240}
                />
              ) : <Empty description="暂无数据" style={{ marginTop: 60 }} />}
            </Card>
          </Col>
        </Row>

        {/* 任务列表 */}
        <Card
          title={`任务列表（共 ${taskTotal} 条）`}
          style={{ marginTop: 16 }}
          extra={
            <Select
              placeholder="按难度筛选"
              allowClear
              style={{ width: 130 }}
              options={[
                { label: '🔴 高难度', value: 'HIGH' },
                { label: '🟡 中等',   value: 'MEDIUM' },
                { label: '🟢 低难度', value: 'LOW' },
              ]}
              onChange={v => { setFilterLevel(v ?? ''); setTaskPage(1); }}
            />
          }
        >
          <Table
            dataSource={tasks}
            columns={columns}
            rowKey="id"
            size="small"
            scroll={{ x: 900 }}
            onRow={record => ({ onClick: () => setSelectedTask(record), style: { cursor: 'pointer' } })}
            pagination={{
              current: taskPage,
              pageSize: taskLimit,
              total: taskTotal,
              showSizeChanger: false,
              showTotal: t => `共 ${t} 条`,
              onChange: p => setTaskPage(p),
            }}
          />
        </Card>
      </Spin>

      <TaskDetailModal task={selectedTask} onClose={() => setSelectedTask(null)} />
    </div>
  );
};

// ─── 工具 ─────────────────────────────────────────────────────────────────────

function renderDimScore(v: number) {
  const color = v >= 65 ? '#f5222d' : v >= 35 ? '#fa8c16' : '#52c41a';
  return (
    <Tooltip title={`${v.toFixed(1)} / 100`}>
      <Text style={{ color, fontWeight: 600 }}>{v.toFixed(0)}</Text>
    </Tooltip>
  );
}
