import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Component, ReactNode } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TransactionsPage from './pages/TransactionsPage';
import InventoryPage from './pages/InventoryPage';
import BarcodePrintPage from './pages/BarcodePrintPage';
import BarcodeMgmtPage from './pages/BarcodeMgmtPage';
import WarehousePage from './pages/WarehousePage';
import StocktakingPage from './pages/StocktakingPage';
import PreliminaryChecksPage from './pages/PreliminaryChecksPage';
import UsersPage from './pages/UsersPage';
import ActivityLogsPage from './pages/ActivityLogsPage';
import InputDeclarationPage from './pages/InputDeclarationPage';
import GeneralSettingsPage from './pages/GeneralSettingsPage';
import OrderPlansPage from './pages/OrderPlansPage';

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

function ProtectedRoute({ children, roles, permission }: { children: React.ReactNode; roles?: string[]; permission?: string }) {
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

  // Check granular permission (view) for the module
  if (permission && user.permissions) {
    const modulePerms = user.permissions[permission];
    if (modulePerms && modulePerms.view === false) {
      // Find first accessible route to redirect to (avoid redirect loop)
      const fallbackRoutes = [
        { path: '/transactions', perm: 'transactions' },
        { path: '/inventory', perm: 'inventory' },
        { path: '/preliminary-checks', perm: 'preliminaryChecks' },
        { path: '/warehouse', perm: 'warehouse' },
        { path: '/', perm: 'dashboard' },
      ];
      const fallback = fallbackRoutes.find((r) => {
        const p = user.permissions?.[r.perm];
        return !p || p.view !== false;
      });
      return <Navigate to={fallback?.path || '/login'} replace />;
    }
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
            <Route path="/" element={<ProtectedRoute permission="dashboard"><DashboardPage /></ProtectedRoute>} />
            <Route path="/products" element={<Navigate to="/transactions" replace />} />
            <Route path="/preliminary-checks" element={<ProtectedRoute permission="preliminaryChecks"><PreliminaryChecksPage /></ProtectedRoute>} />
            <Route path="/order-plans" element={<ProtectedRoute permission="orderPlans"><OrderPlansPage /></ProtectedRoute>} />
            <Route path="/transactions" element={<ProtectedRoute permission="transactions"><TransactionsPage /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute permission="inventory"><InventoryPage /></ProtectedRoute>} />
            <Route path="/barcode-print" element={<ProtectedRoute permission="barcodePrint"><BarcodePrintPage /></ProtectedRoute>} />
            <Route path="/barcode-management" element={<ProtectedRoute permission="barcodePrint"><BarcodeMgmtPage /></ProtectedRoute>} />
            <Route path="/warehouse" element={<ProtectedRoute permission="warehouse"><WarehousePage /></ProtectedRoute>} />
            <Route path="/stocktaking" element={<ProtectedRoute permission="audit"><StocktakingPage /></ProtectedRoute>} />
            <Route path="/input-declarations" element={<ProtectedRoute permission="input"><InputDeclarationPage /></ProtectedRoute>} />
            <Route path="/general-settings" element={<ProtectedRoute roles={['ADMIN']} permission="generalSettings"><GeneralSettingsPage /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute roles={['ADMIN', 'MANAGER']} permission="users"><UsersPage /></ProtectedRoute>} />
            <Route path="/activity-logs" element={<ProtectedRoute roles={['ADMIN', 'MANAGER']} permission="activityLogs"><ActivityLogsPage /></ProtectedRoute>} />
          </Routes>
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
