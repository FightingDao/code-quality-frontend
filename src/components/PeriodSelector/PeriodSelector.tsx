import React from 'react';
import { Segmented } from 'antd';
import { usePeriodStore } from '../../stores/periodStore';
import './PeriodSelector.css';

export const PeriodSelector: React.FC = () => {
  const { periodType, setPeriodType } = usePeriodStore();

  const options = [
    { label: '周', value: 'week' },
    { label: '月', value: 'month' },
  ];

  return (
    <div className="custom-period-segmented">
      <Segmented
        options={options}
        value={periodType}
        onChange={(value) => setPeriodType(value as 'week' | 'month')}
        className="period-segmented-control"
      />
    </div>
  );
};