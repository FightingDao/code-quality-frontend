import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import weekOfYear from 'dayjs/plugin/weekOfYear';

dayjs.extend(isoWeek);
dayjs.extend(weekOfYear);

/**
 * 格式化日期
 */
export const formatDate = (date: string | Date, format = 'YYYY-MM-DD'): string => {
  return dayjs(date).format(format);
};

/**
 * 获取当前周期的值
 */
export const getCurrentPeriodValue = (periodType: 'week' | 'month'): string => {
  const now = dayjs();

  if (periodType === 'week') {
    // 返回当前周一的日期，格式为 YYYYMMDD
    const monday = now.startOf('isoWeek');
    return monday.format('YYYYMMDD');
  } else {
    // 返回当前月份，格式为 YYYYMM
    return now.format('YYYYMM');
  }
};

/**
 * 获取周期显示文本
 */
export const getPeriodLabel = (periodType: 'week' | 'month', periodValue: string): string => {
  if (periodType === 'week') {
    const date = dayjs(periodValue, 'YYYYMMDD');
    const weekNum = date.isoWeek();
    return `${date.year()}年第${weekNum}周`;
  } else {
    const date = dayjs(periodValue, 'YYYYMM');
    return `${date.year()}年${date.month() + 1}月`;
  }
};

/**
 * 格式化数字（添加千分位）
 */
export const formatNumber = (num: number): string => {
  return num.toLocaleString('zh-CN');
};

/**
 * 计算变化百分比
 */
export const calculateChange = (current: number, previous: number): number => {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
};

/**
 * 格式化变化百分比
 */
export const formatChange = (change: number): string => {
  const prefix = change > 0 ? '+' : '';
  return `${prefix}${change.toFixed(2)}%`;
};

/**
 * 获取变化类型
 */
export const getChangeType = (change: number): 'increase' | 'decrease' => {
  return change >= 0 ? 'increase' : 'decrease';
};