import React from 'react';
import { Card, Tooltip } from 'antd';
import { UserOutlined, CodeOutlined, CheckCircleOutlined, TrophyOutlined, ArrowUpOutlined, ArrowDownOutlined, InfoCircleOutlined } from '@ant-design/icons';
import type { KPICardData } from '../../types';
import './KPICard.css';

interface KPICardProps {
  data: KPICardData;
  loading?: boolean;
  iconType?: 'user' | 'commit' | 'task' | 'trophy';
}

export const KPICard: React.FC<KPICardProps> = ({ data, loading, iconType = 'user' }) => {
  if (loading) {
    return (
      <Card className="kpi-card kpi-card-loading" bordered={false}>
        <div className="kpi-card-body">
          <div className="kpi-card-left">
            <div className="kpi-card-title-skeleton"></div>
            <div className="kpi-card-value-skeleton"></div>
          </div>
        </div>
      </Card>
    );
  }

  const { title, value, tips } = data;

  const getIcon = () => {
    switch (iconType) {
      case 'user':
        return <UserOutlined />;
      case 'commit':
        return <CodeOutlined />;
      case 'task':
        return <CheckCircleOutlined />;
      case 'trophy':
        return <TrophyOutlined />;
      default:
        return <UserOutlined />;
    }
  };

  const getCardClass = () => {
    switch (iconType) {
      case 'user':
        return 'kpi-card kpi-card-blue';
      case 'commit':
        return 'kpi-card kpi-card-green';
      case 'task':
        return 'kpi-card kpi-card-purple';
      case 'trophy':
        return 'kpi-card kpi-card-orange';
      default:
        return 'kpi-card kpi-card-blue';
    }
  };

  return (
    <Card className={getCardClass()} bordered={false}>
      <div className="kpi-card-body">
        <div className="kpi-card-left">
          <div className="kpi-card-title">
            {title}
            {tips && (
              <Tooltip title={tips}>
                <InfoCircleOutlined style={{ marginLeft: 4, fontSize: 12, color: '#999' }} />
              </Tooltip>
            )}
          </div>
          <div className="kpi-card-value">{value}</div>
        </div>
        <div className="kpi-card-icon-wrapper">
          {getIcon()}
        </div>
      </div>
    </Card>
  );
};