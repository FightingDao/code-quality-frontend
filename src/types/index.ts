// API 统一响应格式
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

// 小组类型
export interface Team {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

// 用户类型
export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  teamId?: string;
  gitUsername?: string;
  gitEmail?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  team?: Team;
}

// 项目类型
export interface Project {
  id: string;
  name: string;
  repository: string;
  description?: string;
  teamId?: string;
  techStack?: string[];
  isActive: boolean;
  defaultBranch?: string;
  lastCommitAt?: string;
  createdAt: string;
  updatedAt: string;
  team?: Team;
}

// 代码分析类型
export interface CodeAnalysis {
  id: string;
  userId: string;
  projectId: string;
  periodType: 'week' | 'month' | 'quarter';
  periodValue: string;

  commitCount: number;
  insertions: number;
  deletions: number;
  filesChanged: number;

  totalLines: number;
  codeLines: number;
  commentLines: number;
  blankLines: number;

  languages?: Record<string, number>;
  fileChanges?: FileChange[];

  aiQualityScore?: number;
  aiQualityReport?: string;

  taskCount?: number;
  createdAt: string;
  updatedAt: string;

  user?: User;
  project?: Project;
}

// 文件变更类型
export interface FileChange {
  path: string;
  insertions: number;
  deletions: number;
  language: string;
}

// 代码评审类型
export interface CodeReview {
  id: string;
  analysisId: string;

  commitHash: string;
  commitMessage: string;
  commitBranch?: string;
  commitDate: string;

  committerId: string;
  committerName: string;

  reviewerId?: string;
  reviewerName?: string;

  status: 'pending' | 'approved' | 'rejected' | 'changes_requested';
  comments?: string;
  reviewResult?: string;

  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// 小组统计类型
export interface TeamStatistic {
  id: string;
  teamId: string;
  periodType: 'week' | 'month' | 'quarter';
  periodValue: string;

  totalMembers: number;
  activeMembers: number;
  totalCommits: number;
  totalInsertions: number;
  totalDeletions: number;
  totalTasks: number;
  avgQualityScore?: number;

  createdAt: string;
  updatedAt: string;
}

// 项目统计类型
export interface ProjectStatistic {
  id: string;
  projectId: string;
  periodType: 'week' | 'month' | 'quarter';
  periodValue: string;

  totalContributors: number;
  totalCommits: number;
  totalInsertions: number;
  totalDeletions: number;
  totalTasks: number;
  totalLines: number;
  avgQualityScore?: number;

  createdAt: string;
  updatedAt: string;
}

// 周期选择器类型
export type PeriodType = 'week' | 'month' | 'quarter';

// KPI 卡片数据类型
export interface KPICardData {
  title: string;
  value: number | string;
  change?: number;
  changeType?: 'increase' | 'decrease';
  icon?: string;
  tips?: string; // 提示信息
}

// 图表数据类型
export interface ChartData {
  x: string | number;
  y: number;
  [key: string]: any;
}