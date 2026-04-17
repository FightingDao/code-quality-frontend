import React, { useState } from 'react';
import { Layout as AntLayout, Menu, Typography } from 'antd';
import {
  DashboardOutlined,
  ProjectOutlined,
  TeamOutlined,
  BugOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import './Layout.css';

const { Sider, Content } = AntLayout;
const { Title } = Typography;

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '大盘视图',
    },
    {
      key: '/projects',
      icon: <ProjectOutlined />,
      label: '项目概览',
    },
    {
      key: '/tasks',
      icon: <AppstoreOutlined />,
      label: '任务大盘',
    },
    {
      key: '/bugs',
      icon: <BugOutlined />,
      label: 'Bug 分析',
    },
    {
      key: '/teamConfig',
      icon: <TeamOutlined />,
      label: '小组管理',
    },
  ];

  const handleMenuClick = (e: any) => {
    navigate(e.key);
  };

  const getActiveKey = () => {
    if (location.pathname.startsWith('/dashboard')) return '/dashboard';
    if (location.pathname.startsWith('/projects')) return '/projects';
    if (location.pathname.startsWith('/tasks')) return '/tasks';
    if (location.pathname.startsWith('/bugs')) return '/bugs';
    if (location.pathname.startsWith('/teamConfig')) return '/teamConfig';
    return location.pathname;
  };

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        className="custom-sider"
        width={220}
        theme="light"
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100,
          borderRight: '1px solid #f0f0f0'
        }}
      >
        <div className="sider-logo">
          <Title level={4} style={{ color: '#000', margin: 0 }}>
            {collapsed ? 'CC' : 'CodeClaw'}
          </Title>
          {!collapsed && <div className="logo-subtitle">管理员视图</div>}
        </div>
        <Menu
          theme="light"
          mode="inline"
          selectedKeys={[getActiveKey()]}
          items={menuItems}
          onClick={handleMenuClick}
          className="custom-menu"
        />
      </Sider>
      <AntLayout 
        style={{ 
          marginLeft: collapsed ? 80 : 220, 
          transition: 'all 0.2s',
          backgroundColor: '#f0f2f5' 
        }}
      >
        <Content style={{ margin: 0, overflow: 'initial' }}>
          <div className="layout-content">
            {children}
          </div>
        </Content>
      </AntLayout>
    </AntLayout>
  );
};