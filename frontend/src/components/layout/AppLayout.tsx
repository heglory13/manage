import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  Boxes,
  ClipboardCheck,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  PackagePlus,
  Printer,
  Search,
  Settings2,
  ShieldCheck,
  Users,
  Warehouse,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { defaultGeneralSettings, fetchGeneralSettings } from '../../services/generalSettings';

const roleLabels: Record<string, string> = {
  ADMIN: 'QUẢN TRỊ VIÊN',
  MANAGER: 'QUẢN LÝ',
  STAFF: 'NHÂN VIÊN',
};

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: [] as string[], permissionKey: 'dashboard' },
  { name: 'Quản lý tồn kho', href: '/inventory', icon: Boxes, roles: [] as string[], permissionKey: 'inventory' },
  { name: 'Nhập kiểm sơ bộ', href: '/preliminary-checks', icon: PackagePlus, roles: [] as string[], permissionKey: 'preliminaryChecks' },
  { name: 'Kế hoạch đặt hàng', href: '/order-plans', icon: FileText, roles: [] as string[], permissionKey: 'orderPlans' },
  { name: 'Nhập / Xuất kho', href: '/transactions', icon: ClipboardList, roles: [] as string[], permissionKey: 'transactions' },
  { name: 'Kiểm kê định kỳ', href: '/stocktaking', icon: ClipboardCheck, roles: [] as string[], permissionKey: 'audit' },
  { name: 'Sơ đồ kho hàng', href: '/warehouse', icon: Warehouse, roles: [] as string[], permissionKey: 'warehouse' },
  { name: 'In tem mã vạch', href: '/barcode-management', icon: Printer, roles: [] as string[], permissionKey: 'input' },
  { name: 'Khai báo Input', href: '/input-declarations', icon: ShieldCheck, roles: [] as string[], permissionKey: 'input' },
  { name: 'Cấu hình thông tin chung', href: '/general-settings', icon: Settings2, roles: ['ADMIN', 'MANAGER'], permissionKey: 'generalSettings' },
  { name: 'Quản lý nhân viên', href: '/users', icon: Users, roles: ['ADMIN', 'MANAGER'], permissionKey: 'users' },
  { name: 'Nhật ký hoạt động', href: '/activity-logs', icon: Bell, roles: ['ADMIN', 'MANAGER'], permissionKey: 'activityLogs' },
];

function getPageMeta(pathname: string) {
  const active = navigation.find((item) => item.href === pathname);
  const title = active?.name || 'Dashboard';

  return {
    title,
    breadcrumb: active?.href === '/' ? 'Hệ thống / Dashboard' : `Hệ thống / ${title}`,
  };
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const pageMeta = getPageMeta(location.pathname);
  const [brandName, setBrandName] = useState(defaultGeneralSettings.brandName);
  const [logoUrl, setLogoUrl] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const filteredNav = useMemo(
    () =>
      navigation.filter((item) => {
        if (!user) return false;
        // Role-based check
        if (item.roles.length > 0 && !item.roles.includes(user.role)) return false;
        // Permission-based check: if user has permissions object, check view permission
        if (user.permissions && item.permissionKey) {
          const modulePerms = user.permissions[item.permissionKey];
          if (modulePerms && modulePerms.view === false) return false;
        }
        return true;
      }),
    [user],
  );

  useEffect(() => {
    const loadGeneralSettings = async () => {
      try {
        const settings = await fetchGeneralSettings();
        setBrandName(settings.brandName || defaultGeneralSettings.brandName);
        setLogoUrl(settings.logoUrl || '');
      } catch (error) {
        console.error('Error loading general settings for layout:', error);
      }
    };

    void loadGeneralSettings();
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  const defaultLogoUrl = `${import.meta.env.BASE_URL}logo.png?v=20260426-local`;
  const resolvedLogoUrl = logoUrl || defaultLogoUrl;
  const canGoBack = typeof window !== 'undefined' && window.history.length > 1 && location.pathname !== '/';

  return (
    <div className="app-shell">
      {mobileNavOpen && <button className="ims-mobile-overlay" onClick={() => setMobileNavOpen(false)} aria-label="Đóng điều hướng" />}

      <aside className={`ims-sidebar ${mobileNavOpen ? 'mobile-open' : ''}`}>
        <div className="ims-brand">
          <div className="ims-brand-mark">
            <img
              src={resolvedLogoUrl}
              alt={brandName}
              onError={(event) => {
                const target = event.currentTarget;
                if (target.src !== defaultLogoUrl) {
                  target.src = defaultLogoUrl;
                }
              }}
            />
          </div>
          <div className="ims-brand-title">{brandName}</div>
          <button className="ims-mobile-close" onClick={() => setMobileNavOpen(false)} aria-label="Đóng menu">
            <X size={18} />
          </button>
        </div>

        <nav className="ims-nav">
          {filteredNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.href}
                to={item.href}
                end={item.href === '/'}
                className={({ isActive }) => `ims-nav-item ${isActive ? 'active' : ''}`}
              >
                <span className="ims-nav-icon">
                  <Icon size={16} strokeWidth={1.9} />
                </span>
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="ims-sidebar-footer">
          <div className="ims-user-card">
            <div className="ims-user-avatar">
              {user?.name?.slice(0, 1).toUpperCase() ?? 'A'}
            </div>
            <div>
              <div className="ims-user-name">{user?.name ?? 'Admin User'}</div>
              <div className="ims-user-role">
                {user ? roleLabels[user.role] : 'QUAN TRI VIEN'}
              </div>
            </div>
          </div>

          <button className="ims-logout-btn" onClick={logout}>
            <span className="ims-logout-icon">
              <LogOut size={15} />
            </span>
            <span>Dang xuat</span>
          </button>
        </div>
      </aside>

      <div className="ims-main">
        <header className="ims-topbar">
          <div className="ims-topbar-heading">
            <div className="ims-mobile-actions">
              <button className="ims-icon-btn" onClick={() => (canGoBack ? navigate(-1) : navigate('/'))} aria-label="Quay lai">
                <ArrowLeft size={16} />
              </button>
              <button className="ims-icon-btn" onClick={() => setMobileNavOpen(true)} aria-label="Mo menu">
                <Menu size={16} />
              </button>
            </div>
            <div>
              <h1 className="ims-page-title">{pageMeta.title}</h1>
              <p className="ims-breadcrumb">{pageMeta.breadcrumb}</p>
            </div>
          </div>

          <div className="ims-topbar-actions">
            <div className="ims-topbar-user">
              <div className="ims-topbar-user-text">
                <strong>{user?.name ?? 'Admin User'}</strong>
                <span>{user ? roleLabels[user.role] : 'QUAN TRI VIEN'}</span>
              </div>
              <div className="ims-topbar-avatar">
                {user?.name?.slice(0, 1).toUpperCase() ?? 'A'}
              </div>
            </div>
          </div>
        </header>

        <main className="ims-page">{children}</main>
      </div>
    </div>
  );
}
