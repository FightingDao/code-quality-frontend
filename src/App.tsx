import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { UserDetail } from './pages/UserDetail';
import { ProjectOverview } from './pages/ProjectOverview';
import { ProjectReport } from './pages/ProjectReport';
import { ProjectCodeReview } from './pages/ProjectCodeReview/ProjectCodeReview';
import { TeamReport } from './pages/TeamReport';
import { TeamManage } from './pages/TeamManage/TeamManage';
import './styles/global.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <QueryClientProvider client={queryClient}>
        <Router>
          <Layout>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/projects" element={<ProjectOverview />} />
              <Route path="/projects/:projectId/report" element={<ProjectReport />} />
              <Route path="/projects/:projectId/code-review" element={<ProjectCodeReview />} />
              <Route path="/users/:userId" element={<UserDetail />} />
              <Route path="/teams/:teamId/report" element={<TeamReport />} />
              <Route path="/teamConfig" element={<TeamManage />} />
            </Routes>
          </Layout>
        </Router>
      </QueryClientProvider>
    </ConfigProvider>
  );
}

export default App;