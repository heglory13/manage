import { useEffect, useMemo, useState } from 'react';
import { KeyRound, Plus, Settings2, Trash2, UserCog } from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';

type PermissionFlags = {
  view: boolean;
  create: boolean;
  save: boolean;
  edit: boolean;
  delete: boolean;
};

type PermissionState = Record<string, PermissionFlags>;

type UserRecord = {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'MANAGER' | 'STAFF';
  permissions?: PermissionState;
};

const moduleDefinitions = [
  ['Dashboard', 'dashboard'],
  ['Quản lý tồn kho', 'inventory'],
  ['In mã vạch', 'barcodePrint'],
  ['Nhập kiểm sơ bộ', 'preliminaryChecks'],
  ['Kế hoạch đặt hàng', 'orderPlans'],
  ['Nhập / Xuất kho', 'transactions'],
  ['Kiểm kê định kỳ', 'audit'],
  ['Sơ đồ kho hàng', 'warehouse'],
  ['Khai báo Input', 'input'],
  ['Nhật ký hoạt động', 'activityLogs'],
  ['Quản lý nhân viên', 'users'],
  ['Cấu hình chung', 'generalSettings'],
] as const;

function createFlags(overrides?: Partial<PermissionFlags>): PermissionFlags {
  return {
    view: false,
    create: false,
    save: false,
    edit: false,
    delete: false,
    ...overrides,
  };
}

function createDefaultPermissions(role: UserRecord['role']): PermissionState {
  const base: PermissionState = {
    dashboard: createFlags({ view: true }),
    inventory: createFlags({ view: true }),
    barcodePrint: createFlags({ view: true }),
    preliminaryChecks: createFlags({ view: true }),
    orderPlans: createFlags({ view: true }),
    transactions: createFlags({ view: true }),
    audit: createFlags({ view: true }),
    warehouse: createFlags({ view: true }),
    input: createFlags({ view: true }),
    activityLogs: createFlags(),
    users: createFlags(),
    generalSettings: createFlags(),
  };

  if (role === 'ADMIN') {
    Object.keys(base).forEach((key) => {
      base[key] = createFlags({ view: true, create: true, save: true, edit: true, delete: true });
    });
    return base;
  }

  if (role === 'MANAGER') {
    base.inventory = createFlags({ view: true, create: true, save: true, edit: true });
    base.barcodePrint = createFlags({ view: true, create: true, save: true, edit: true });
    base.preliminaryChecks = createFlags({ view: true, create: true, save: true, edit: true });
    base.orderPlans = createFlags({ view: true, create: true, save: true, edit: true });
    base.transactions = createFlags({ view: true, create: true, save: true, edit: true });
    base.audit = createFlags({ view: true, create: true, save: true, edit: true });
    base.warehouse = createFlags({ view: true, create: true, save: true, edit: true });
    base.input = createFlags({ view: true, create: true, save: true, edit: true });
    base.activityLogs = createFlags({ view: true });
    base.users = createFlags({ view: true, create: true, save: true, edit: true });
    base.generalSettings = createFlags({ view: true, save: true, edit: true });
    return base;
  }

  base.inventory = createFlags({ view: true, create: true, save: true, edit: true });
  base.barcodePrint = createFlags({ view: true, create: true, save: true, edit: true });
  base.preliminaryChecks = createFlags({ view: true, create: true, save: true, edit: true });
  base.orderPlans = createFlags({ view: true, create: true, save: true, edit: true });
  base.transactions = createFlags({ view: true, create: true, save: true, edit: true });
  base.audit = createFlags({ view: true, create: true, save: true, edit: true });
  base.warehouse = createFlags({ view: true, create: true, save: true, edit: true });
  base.input = createFlags({ view: true, create: true, save: true, edit: true });
  base.activityLogs = createFlags({ view: true });
  return base;
}

function normalizePermissions(role: UserRecord['role'], permissions?: PermissionState): PermissionState {
  const defaults = createDefaultPermissions(role);
  if (!permissions) return defaults;

  const normalizedEntries = Object.entries(defaults).map(([moduleKey, defaultFlags]) => [
    moduleKey,
    {
      view: permissions[moduleKey]?.view !== undefined ? Boolean(permissions[moduleKey].view) : defaultFlags.view,
      create: permissions[moduleKey]?.create !== undefined ? Boolean(permissions[moduleKey].create) : defaultFlags.create,
      save: permissions[moduleKey]?.save !== undefined ? Boolean(permissions[moduleKey].save) : defaultFlags.save,
      edit: permissions[moduleKey]?.edit !== undefined ? Boolean(permissions[moduleKey].edit) : defaultFlags.edit,
      delete: permissions[moduleKey]?.delete !== undefined ? Boolean(permissions[moduleKey].delete) : defaultFlags.delete,
    },
  ]);

  return Object.fromEntries(normalizedEntries);
}

export default function UsersPage() {
  const { user: currentUser, refreshUser } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [permissions, setPermissions] = useState<PermissionState>(createDefaultPermissions('STAFF'));
  const [formData, setFormData] = useState({ email: '', password: '', name: '', role: 'STAFF' });
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [changePasswordTarget, setChangePasswordTarget] = useState<UserRecord | null>(null);
  const [changePasswordData, setChangePasswordData] = useState({ newPassword: '', confirmPassword: '' });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const isAdmin = currentUser?.role === 'ADMIN';
  const isManager = currentUser?.role === 'MANAGER';
  const isStaff = currentUser?.role === 'STAFF';

  // Admin: tạo mọi vai trò. Manager: chỉ tạo STAFF. Staff: không được tạo.
  const canCreateUser = !isStaff && Boolean(currentUser?.permissions?.users?.create);

  // Admin và Manager đều có thể xoá (Manager chỉ xoá được STAFF).
  const canDeleteUser = (isAdmin || isManager) && Boolean(currentUser?.permissions?.users?.delete);

  // Admin/Manager mới có thể phân quyền (nếu có permission users.edit).
  const canEditPermissions = !isStaff && Boolean(currentUser?.permissions?.users?.edit);

  // Admin: phân quyền cho tất cả. Manager: chỉ phân quyền cho STAFF.
  const canEditTargetPermissions = (targetUser: UserRecord) => {
    if (!canEditPermissions || !currentUser) return false;
    if (isManager) return targetUser.role === 'STAFF';
    return true; // Admin có thể phân quyền cho tất cả
  };

  // Admin xoá được STAFF. Manager chỉ xoá được STAFF (không xoá được Manager ngang hàng).
  const canDeleteTargetUser = (targetUser: UserRecord) => {
    if (!canDeleteUser) return false;
    if (isManager) return targetUser.role === 'STAFF';
    return targetUser.role === 'STAFF'; // Admin cũng chỉ xoá STAFF qua UI này
  };

  // Có thể đổi vai trò của user này không?
  // Admin: đổi vai trò của tất cả. Manager: chỉ đổi STAFF (và chỉ về STAFF).
  const canChangeRoleOf = (targetUser: UserRecord) => {
    if (isAdmin) return true;
    if (isManager) return targetUser.role === 'STAFF';
    return false;
  };

  useEffect(() => {
    void fetchUsers();
  }, []);

  const roleLabelMap = useMemo(
    () => ({
      ADMIN: 'Quản trị viên',
      MANAGER: 'Quản lý',
      STAFF: 'Nhân viên',
    }),
    [],
  );

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/users');
      setUsers(res.data.data || res.data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/users', formData);
      setShowCreateModal(false);
      setFormData({ email: '', password: '', name: '', role: 'STAFF' });
      await fetchUsers();
    } catch (err: any) {
      console.error('Error:', err);
      alert(err.response?.data?.message || 'Không thể tạo nhân viên mới.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!canDeleteUser) return;
    if (confirm('Bạn có chắc muốn xoá người dùng này?')) {
      try {
        await api.delete(`/users/${id}`);
        await fetchUsers();
      } catch (err: any) {
        alert(err.response?.data?.message || 'Không thể xoá người dùng.');
      }
    }
  };

  const handleChangeRole = async (id: string, role: string) => {
    try {
      await api.patch(`/users/${id}/role`, { role });
      await fetchUsers();
      if (currentUser?.id === id) await refreshUser();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể cập nhật vai trò.');
    }
  };

  const openChangePassword = (user: UserRecord) => {
    setChangePasswordTarget(user);
    setChangePasswordData({ newPassword: '', confirmPassword: '' });
    setShowChangePasswordModal(true);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const pwd = changePasswordData.newPassword;
    if (pwd.length < 8) {
      alert('Mật khẩu phải có ít nhất 8 ký tự.');
      return;
    }
    if (!/[A-Z]/.test(pwd) || !/[a-z]/.test(pwd) || !/[0-9]/.test(pwd)) {
      alert('Mật khẩu phải có ít nhất 1 chữ hoa, 1 chữ thường và 1 chữ số.');
      return;
    }
    if (pwd !== changePasswordData.confirmPassword) {
      alert('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (!changePasswordTarget) return;
    setIsChangingPassword(true);
    try {
      await api.patch(`/users/${changePasswordTarget.id}/password`, {
        newPassword: changePasswordData.newPassword,
      });
      setShowChangePasswordModal(false);
      alert('Đổi mật khẩu thành công.');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể đổi mật khẩu.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const openPermissions = (user: UserRecord) => {
    setSelectedUser(user);
    setPermissions(normalizePermissions(user.role, user.permissions));
    setShowPermissionModal(true);
  };

  const handleSavePermissions = async () => {
    if (!selectedUser) return;
    setIsSavingPermissions(true);
    try {
      await api.patch(`/users/${selectedUser.id}/permissions`, { permissions });
      setShowPermissionModal(false);
      if (currentUser?.id === selectedUser.id) await refreshUser();
      await fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể lưu phân quyền.');
    } finally {
      setIsSavingPermissions(false);
    }
  };

  const togglePermission = (moduleKey: string, permissionKey: keyof PermissionFlags) => {
    if (!selectedUser) return;
    // Manager không được toggle quyền Xoá cho bất kỳ ai
    if (isManager && permissionKey === 'delete') return;

    setPermissions((prev) => ({
      ...prev,
      [moduleKey]: {
        ...prev[moduleKey],
        [permissionKey]: !prev[moduleKey]?.[permissionKey],
      },
    }));
  };

  const roleBadgeClass = (role: UserRecord['role']) => {
    if (role === 'ADMIN') return 'badge-danger';
    if (role === 'MANAGER') return 'badge-warning';
    return 'badge-success';
  };

  // Danh sách vai trò có thể chọn khi tạo mới
  const createRoleOptions = isManager
    ? [{ value: 'STAFF', label: 'Nhân viên' }]
    : [
        { value: 'STAFF', label: 'Nhân viên' },
        { value: 'MANAGER', label: 'Quản lý' },
        { value: 'ADMIN', label: 'Quản trị viên' },
      ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Quản lý nhân viên</h2>
            <p className="mt-1 text-sm text-slate-500">Quản lý tài khoản, vai trò và quyền truy cập của nhân sự trong hệ thống.</p>
          </div>

          {canCreateUser && (
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus size={16} />
              Thêm nhân viên
            </Button>
          )}
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Danh sách nhân viên</CardTitle>
              <p className="text-sm text-slate-500">Theo dõi email, vai trò hệ thống và thao tác quản trị.</p>
            </div>
            <div className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">{users.length} tài khoản</div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex h-48 items-center justify-center">
                <div className="spinner" />
              </div>
            ) : (
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nhân sự</TableHead>
                    <TableHead>Vai trò hệ thống</TableHead>
                    <TableHead>Cập nhật vai trò</TableHead>
                    <TableHead className="text-right">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="ims-user-avatar h-10 w-10 text-sm">{user.name.slice(0, 1).toUpperCase()}</div>
                          <div>
                            <div className="font-medium text-slate-900">{user.name}</div>
                            <div className="text-xs text-slate-500">{user.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={roleBadgeClass(user.role)}>{roleLabelMap[user.role]}</span>
                      </TableCell>
                      <TableCell>
                        {canChangeRoleOf(user) ? (
                          <select
                            className="form-select max-w-[180px]"
                            value={user.role}
                            onChange={(e) => handleChangeRole(user.id, e.target.value)}
                          >
                            {/* Admin thấy đủ 3 lựa chọn */}
                            {isAdmin && (
                              <>
                                <option value="STAFF">Nhân viên</option>
                                <option value="MANAGER">Quản lý</option>
                                <option value="ADMIN">Quản trị viên</option>
                              </>
                            )}
                            {/* Manager chỉ thấy STAFF (chỉ có thể giữ STAFF) */}
                            {isManager && <option value="STAFF">Nhân viên</option>}
                          </select>
                        ) : (
                          <span className="text-sm text-slate-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          {canEditTargetPermissions(user) && (
                            <Button variant="outline" size="sm" onClick={() => openPermissions(user)}>
                              <Settings2 size={14} />
                              Phân quyền
                            </Button>
                          )}
                          {isAdmin && (
                            <Button variant="outline" size="sm" onClick={() => openChangePassword(user)} title="Đổi mật khẩu">
                              <KeyRound size={14} />
                              Đổi MK
                            </Button>
                          )}
                          {canDeleteTargetUser(user) && (
                            <Button variant="outline" size="icon" onClick={() => handleDelete(user.id)}>
                              <Trash2 size={14} />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}

                  {users.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-10 text-center text-slate-500">
                        Chưa có tài khoản nào.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal tạo tài khoản */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog size={18} />
              Tạo nhân viên mới
            </DialogTitle>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
              </div>

              <div className="space-y-2">
                <Label>Mật khẩu</Label>
                <Input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Họ tên</Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
              </div>

              <div className="space-y-2">
                <Label>Vai trò</Label>
                <select className="form-select" value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })}>
                  {createRoleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                Huỷ
              </Button>
              <Button type="submit">
                <Plus size={14} />
                Tạo tài khoản
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal đổi mật khẩu - chỉ Admin */}
      <Dialog open={showChangePasswordModal} onOpenChange={setShowChangePasswordModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound size={18} />
              Đổi mật khẩu: {changePasswordTarget?.name ?? ''}
            </DialogTitle>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleChangePassword}>
            <div className="space-y-2">
              <Label>Mật khẩu mới</Label>
              <Input
                type="password"
                minLength={6}
                value={changePasswordData.newPassword}
                onChange={(e) => setChangePasswordData({ ...changePasswordData, newPassword: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Xác nhận mật khẩu mới</Label>
              <Input
                type="password"
                minLength={6}
                value={changePasswordData.confirmPassword}
                onChange={(e) => setChangePasswordData({ ...changePasswordData, confirmPassword: e.target.value })}
                required
              />
            </div>

            <div className="rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm text-violet-800">
              <strong>Lưu ý:</strong> Sau khi đổi mật khẩu, tài khoản <strong>{changePasswordTarget?.name}</strong> cần đăng nhập lại bằng mật khẩu mới.
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowChangePasswordModal(false)} disabled={isChangingPassword}>
                Huỷ
              </Button>
              <Button type="submit" disabled={isChangingPassword}>
                {isChangingPassword ? 'Đang lưu...' : 'Xác nhận đổi mật khẩu'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal phân quyền */}
      <Dialog open={showPermissionModal} onOpenChange={setShowPermissionModal}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound size={18} />
              Thiết lập phân quyền: {selectedUser?.name ?? 'Nhân viên'}
            </DialogTitle>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-5">
              <div className="grid gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400">Email</p>
                  <p className="mt-1 font-medium text-slate-800">{selectedUser.email}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400">Vai trò hệ thống</p>
                  <p className="mt-1 font-medium text-slate-800">{roleLabelMap[selectedUser.role]}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100">
                <div className="grid grid-cols-[1.7fr,0.5fr,0.5fr,0.5fr,0.5fr,0.5fr] gap-0 border-b border-slate-100 bg-slate-50/80 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-500">
                  <div>Module hệ thống</div>
                  <div className="text-center">Xem</div>
                  <div className="text-center">Thêm</div>
                  <div className="text-center">Ghi</div>
                  <div className="text-center">Sửa</div>
                  <div className={`text-center ${isManager ? 'opacity-40' : ''}`}>Xoá</div>
                </div>

                {moduleDefinitions.map(([label, key]) => {
                  return (
                    <div
                      key={key}
                      className="grid grid-cols-[1.7fr,0.5fr,0.5fr,0.5fr,0.5fr,0.5fr] items-center gap-0 border-b border-slate-100 px-4 py-3 last:border-b-0"
                    >
                      <div className="text-sm font-medium text-slate-700">{label}</div>

                      {(['view', 'create', 'save', 'edit', 'delete'] as const).map((permissionKey) => {
                        // Chỉ disabled khi: Quản lý đang phân quyền → cột Xoá bị khoá
                        const isDisabled = isManager && permissionKey === 'delete';

                        return (
                          <div key={permissionKey} className="flex justify-center">
                            <input
                              type="checkbox"
                              className={`h-4 w-4 rounded border-slate-300 accent-violet-600 ${isDisabled ? 'cursor-not-allowed opacity-30' : 'cursor-pointer'}`}
                              checked={Boolean(permissions[key]?.[permissionKey])}
                              onChange={() => togglePermission(key, permissionKey)}
                              disabled={isDisabled}
                            />
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {/* Thông tin quyền hạn theo vai trò người đang đăng nhập */}
              {isAdmin && (
                <div className="rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm text-violet-800">
                  <strong>Quản trị viên:</strong> Bạn có thể thiết lập toàn bộ quyền (bao gồm Xoá) cho Quản lý và Nhân viên.
                </div>
              )}
              {isManager && (
                <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <strong>Quản lý:</strong> Bạn chỉ có thể thiết lập quyền Xem / Thêm / Ghi / Sửa cho Nhân viên. Quyền <strong>Xoá</strong> chỉ dành cho Quản trị viên thiết lập.
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowPermissionModal(false)} disabled={isSavingPermissions}>
                  Huỷ
                </Button>
                <Button onClick={handleSavePermissions} disabled={isSavingPermissions}>
                  Lưu phân quyền
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
