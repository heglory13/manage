import { NavLink, useLocation } from 'react-router-dom';
import {
  Bell,
  Boxes,
  ClipboardCheck,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Search,
  ShieldCheck,
  Users,
  Warehouse,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const roleLabels: Record<string, string> = {
  ADMIN: 'QUẢN TRỊ VIÊN',
  MANAGER: 'QUẢN LÝ',
  STAFF: 'NHÂN VIÊN',
};

const navigation = [
  { name: 'Bảng điều khiển', href: '/', icon: LayoutDashboard, roles: [] as string[] },
  { name: 'Quản lý tồn kho', href: '/inventory', icon: Boxes, roles: [] as string[] },
  { name: 'Nhập / Xuất kho', href: '/transactions', icon: ClipboardList, roles: [] as string[] },
  { name: 'Kiểm kê định kỳ', href: '/stocktaking', icon: ClipboardCheck, roles: [] as string[] },
  { name: 'Sơ đồ kho hàng', href: '/warehouse', icon: Warehouse, roles: [] as string[] },
  { name: 'Khai báo Input', href: '/input-declarations', icon: ShieldCheck, roles: [] as string[] },
  { name: 'Quản lý nhân viên', href: '/users', icon: Users, roles: ['ADMIN'] },
  { name: 'Nhật ký hoạt động', href: '/activity-logs', icon: Bell, roles: ['ADMIN', 'MANAGER'] },
];

function getPageMeta(pathname: string) {
  const active = navigation.find((item) => item.href === pathname);

  return {
    title: active?.name || 'Bảng điều khiển',
    breadcrumb: active?.href === '/' ? 'Hệ thống / Dashboard' : `Hệ thống / ${active?.name ?? 'Dashboard'}`,
  };
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const pageMeta = getPageMeta(location.pathname);

  const filteredNav = navigation.filter((item) => {
    if (item.roles.length === 0) return true;
    return user ? item.roles.includes(user.role) : false;
  });

  return (
    <div className="app-shell">
      <aside className="ims-sidebar">
        <div className="ims-brand">
          <div className="ims-brand-mark">W</div>
          <div className="ims-brand-title">IMS Pro</div>
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
                <Icon size={16} strokeWidth={1.9} />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="ims-sidebar-footer">
          <div className="ims-user-card">
            <div className="ims-user-avatar">{user?.name?.slice(0, 1).toUpperCase() ?? 'A'}</div>
            <div>
              <div className="ims-user-name">{user?.name ?? 'Admin User'}</div>
              <div className="ims-user-role">{user ? roleLabels[user.role] : 'QUẢN TRỊ VIÊN'}</div>
            </div>
          </div>

          <button className="ims-logout-btn" onClick={logout}>
            <LogOut size={15} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      <div className="ims-main">
        <header className="ims-topbar">
          <div>
            <h1 className="ims-page-title">{pageMeta.title}</h1>
            <p className="ims-breadcrumb">{pageMeta.breadcrumb}</p>
          </div>

          <div className="ims-topbar-actions">
            <label className="ims-search">
              <Search size={14} />
              <input placeholder="Tìm nhanh..." aria-label="Tìm nhanh" />
            </label>

            <button className="ims-icon-btn" aria-label="Thông báo">
              <Bell size={16} />
            </button>

            <div className="ims-topbar-user">
              <div className="ims-topbar-user-text">
                <strong>{user?.name ?? 'Admin User'}</strong>
                <span>{user ? roleLabels[user.role] : 'QUẢN TRỊ VIÊN'}</span>
              </div>
              <div className="ims-topbar-avatar">{user?.name?.slice(0, 1).toUpperCase() ?? 'A'}</div>
            </div>
          </div>
        </header>

        <main className="ims-page">{children}</main>
      </div>
    </div>
  );
}
