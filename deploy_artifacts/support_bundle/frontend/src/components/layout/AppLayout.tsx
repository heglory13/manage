import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Bell,
  Boxes,
  ClipboardCheck,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  PackagePlus,
  Search,
  Settings2,
  ShieldCheck,
  Users,
  Warehouse,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { defaultGeneralSettings, fetchGeneralSettings } from '../../services/generalSettings';

const roleLabels: Record<string, string> = {
  ADMIN: 'QUAN TRI VIEN',
  MANAGER: 'QUAN LY',
  STAFF: 'NHAN VIEN',
};

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: [] as string[] },
  { name: 'Quan ly ton kho', href: '/inventory', icon: Boxes, roles: [] as string[] },
  { name: 'Nhap kiem so bo', href: '/preliminary-checks', icon: PackagePlus, roles: [] as string[] },
  { name: 'Nhap / Xuat kho', href: '/transactions', icon: ClipboardList, roles: [] as string[] },
  { name: 'Kiem ke dinh ky', href: '/stocktaking', icon: ClipboardCheck, roles: [] as string[] },
  { name: 'So do kho hang', href: '/warehouse', icon: Warehouse, roles: [] as string[] },
  { name: 'Khai bao Input', href: '/input-declarations', icon: ShieldCheck, roles: [] as string[] },
  { name: 'Cau hinh thong tin chung', href: '/general-settings', icon: Settings2, roles: ['ADMIN'] },
  { name: 'Quan ly nhan vien', href: '/users', icon: Users, roles: ['ADMIN', 'MANAGER'] },
  { name: 'Nhat ky hoat dong', href: '/activity-logs', icon: Bell, roles: ['ADMIN', 'MANAGER'] },
];

function getPageMeta(pathname: string) {
  const active = navigation.find((item) => item.href === pathname);
  const title = active?.name || 'Dashboard';

  return {
    title,
    breadcrumb: active?.href === '/' ? 'He thong / Dashboard' : `He thong / ${title}`,
  };
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const pageMeta = getPageMeta(location.pathname);
  const [brandName, setBrandName] = useState(defaultGeneralSettings.brandName);
  const [logoUrl, setLogoUrl] = useState('');

  const filteredNav = navigation.filter((item) => {
    if (item.roles.length === 0) return true;
    return user ? item.roles.includes(user.role) : false;
  });

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

  const defaultLogoUrl = `${import.meta.env.BASE_URL}logo.png?v=20260426-local`;
  const resolvedLogoUrl = logoUrl || defaultLogoUrl;

  return (
    <div className="app-shell">
      <aside className="ims-sidebar">
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
          <div>
            <h1 className="ims-page-title">{pageMeta.title}</h1>
            <p className="ims-breadcrumb">{pageMeta.breadcrumb}</p>
          </div>

          <div className="ims-topbar-actions">
            <label className="ims-search">
              <Search size={14} />
              <input placeholder="Tim nhanh..." />
            </label>

            <button className="ims-icon-btn">
              <Bell size={16} />
            </button>

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
