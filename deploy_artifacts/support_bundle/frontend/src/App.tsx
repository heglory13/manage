import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Component, ReactNode } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import InventoryPage from './pages/InventoryPage';
import TransactionsPage from './pages/TransactionsPage';
import WarehousePage from './pages/WarehousePage';
import StocktakingPage from './pages/StocktakingPage';
import PreliminaryChecksPage from './pages/PreliminaryChecksPage';
import UsersPage from './pages/UsersPage';
import ActivityLogsPage from './pages/ActivityLogsPage';
import InputDeclarationPage from './pages/InputDeclarationPage';
import GeneralSettingsPage from './pages/GeneralSettingsPage';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('App Error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <h2>Đã xảy ra lỗi</h2>
          <p>Vui lòng tải lại trang</p>
          <button onClick={() => window.location.reload()} style={{ padding: '10px 20px', cursor: 'pointer' }}>
            Tải lại
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            border: '4px solid #e2e8f0',
            borderTop: '4px solid #0d6efd',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ErrorBoundary>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/products" element={<Navigate to="/inventory" replace />} />
            <Route path="/inventory" element={<ProtectedRoute><InventoryPage /></ProtectedRoute>} />
            <Route path="/preliminary-checks" element={<ProtectedRoute><PreliminaryChecksPage /></ProtectedRoute>} />
            <Route path="/transactions" element={<ProtectedRoute><TransactionsPage /></ProtectedRoute>} />
            <Route path="/warehouse" element={<ProtectedRoute><WarehousePage /></ProtectedRoute>} />
            <Route path="/stocktaking" element={<ProtectedRoute><StocktakingPage /></ProtectedRoute>} />
            <Route path="/input-declarations" element={<ProtectedRoute><InputDeclarationPage /></ProtectedRoute>} />
            <Route path="/general-settings" element={<ProtectedRoute roles={['ADMIN']}><GeneralSettingsPage /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute roles={['ADMIN', 'MANAGER']}><UsersPage /></ProtectedRoute>} />
            <Route path="/activity-logs" element={<ProtectedRoute roles={['ADMIN', 'MANAGER']}><ActivityLogsPage /></ProtectedRoute>} />
          </Routes>
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
