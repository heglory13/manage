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
  ['Quan ly ton kho', 'inventory'],
  ['Nhap kiem so bo', 'preliminaryChecks'],
  ['Nhap / Xuat kho', 'transactions'],
  ['Kiem ke dinh ky', 'audit'],
  ['So do kho hang', 'warehouse'],
  ['Khai bao Input', 'input'],
  ['Nhat ky hoat dong', 'activityLogs'],
  ['Quan ly nhan vien', 'users'],
  ['Cau hinh chung', 'generalSettings'],
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
    preliminaryChecks: createFlags({ view: true }),
    transactions: createFlags({ view: true }),
    audit: createFlags({ view: true }),
    warehouse: createFlags({ view: true }),
    input: createFlags({ view: true }),
    activityLogs: createFlags(),
    users: createFlags(),
    generalSettings: createFlags(),
  };

  if (role === 'ADMIN') {
    base.inventory = createFlags({ view: true, create: true, save: true, edit: true, delete: true });
    base.preliminaryChecks = createFlags({ view: true, create: true, save: true, edit: true, delete: true });
    base.transactions = createFlags({ view: true, create: true, save: true, edit: true, delete: true });
    base.audit = createFlags({ view: true, create: true, save: true, edit: true, delete: true });
    base.warehouse = createFlags({ view: true, create: true, save: true, edit: true, delete: true });
    base.input = createFlags({ view: true, create: true, save: true, edit: true, delete: true });
    base.activityLogs = createFlags({ view: true });
    base.users = createFlags({ view: true, create: true, save: true, edit: true, delete: true });
    base.generalSettings = createFlags({ view: true, save: true, edit: true });
    return base;
  }

  if (role === 'MANAGER') {
    base.inventory = createFlags({ view: true, create: true, save: true, edit: true });
    base.preliminaryChecks = createFlags({ view: true, create: true, save: true, edit: true });
    base.transactions = createFlags({ view: true, create: true, save: true, edit: true });
    base.audit = createFlags({ view: true, create: true, save: true, edit: true });
    base.warehouse = createFlags({ view: true, create: true, save: true, edit: true });
    base.input = createFlags({ view: true, create: true, save: true, edit: true });
    base.activityLogs = createFlags({ view: true });
    base.users = createFlags({ view: true, create: true, save: true, edit: true });
    return base;
  }

  base.preliminaryChecks = createFlags({ view: true, create: true, save: true });
  base.transactions = createFlags({ view: true, create: true, save: true });
  base.audit = createFlags({ view: true, create: true, save: true });
  return base;
}

function normalizePermissions(role: UserRecord['role'], permissions?: PermissionState): PermissionState {
  const defaults = createDefaultPermissions(role);
  if (!permissions) {
    return defaults;
  }

  const normalizedEntries = Object.entries(defaults).map(([moduleKey, flags]) => [
    moduleKey,
    {
      view: typeof permissions[moduleKey]?.view === 'boolean' ? permissions[moduleKey].view : flags.view,
      create: typeof permissions[moduleKey]?.create === 'boolean' ? permissions[moduleKey].create : flags.create,
      save: typeof permissions[moduleKey]?.save === 'boolean' ? permissions[moduleKey].save : flags.save,
      edit: typeof permissions[moduleKey]?.edit === 'boolean' ? permissions[moduleKey].edit : flags.edit,
      delete: typeof permissions[moduleKey]?.delete === 'boolean' ? permissions[moduleKey].delete : flags.delete,
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

  const canCreateUser = Boolean(currentUser?.permissions?.users?.create) && (currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER');
  const canDeleteUser = currentUser?.role === 'ADMIN' && Boolean(currentUser?.permissions?.users?.delete);
  const canEditPermissions = Boolean(currentUser?.permissions?.users?.edit) && (currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER');
  const isManager = currentUser?.role === 'MANAGER';

  useEffect(() => {
    void fetchUsers();
  }, []);

  const roleLabelMap = useMemo(
    () => ({
      ADMIN: 'Quan tri vien',
      MANAGER: 'Quan ly',
      STAFF: 'Nhan vien',
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
    } catch (err) {
      console.error('Error:', err);
      alert('Khong the tao nhan vien moi.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!canDeleteUser) return;
    if (confirm('Ban co chac muon xoa nguoi dung nay?')) {
      try {
        await api.delete(`/users/${id}`);
        await fetchUsers();
      } catch (err) {
        console.error('Error:', err);
      }
    }
  };

  const handleChangeRole = async (id: string, role: string) => {
    try {
      await api.patch(`/users/${id}/role`, { role });
      await fetchUsers();
      if (currentUser?.id === id) {
        await refreshUser();
      }
    } catch (err) {
      console.error('Error:', err);
      alert('Khong the cap nhat vai tro.');
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
      setUsers((prev) =>
        prev.map((user) => (user.id === selectedUser.id ? { ...user, permissions: normalizePermissions(user.role, permissions) } : user)),
      );
      setShowPermissionModal(false);
      if (currentUser?.id === selectedUser.id) {
        await refreshUser();
      }
      await fetchUsers();
    } catch (err) {
      console.error('Error saving permissions:', err);
      alert('Khong the luu phan quyen.');
    } finally {
      setIsSavingPermissions(false);
    }
  };

  const togglePermission = (moduleKey: string, permissionKey: keyof PermissionFlags) => {
    setPermissions((prev) => ({
      ...prev,
      [moduleKey]: {
        ...prev[moduleKey],
        [permissionKey]: !prev[moduleKey][permissionKey],
      },
    }));
  };

  const roleBadgeClass = (role: UserRecord['role']) => {
    if (role === 'ADMIN') return 'badge-danger';
    if (role === 'MANAGER') return 'badge-warning';
    return 'badge-success';
  };

  const roleOptions = isManager
    ? [{ value: 'STAFF', label: 'Nhan vien' }]
    : [
        { value: 'STAFF', label: 'Nhan vien' },
        { value: 'MANAGER', label: 'Quan ly' },
        { value: 'ADMIN', label: 'Quan tri vien' },
      ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Quan ly nhan vien</h2>
            <p className="mt-1 text-sm text-slate-500">Quan ly tai khoan, vai tro va quyen truy cap cua nhan su trong he thong.</p>
          </div>

          {canCreateUser && (
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus size={16} />
              Them nhan vien
            </Button>
          )}
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Danh sach nhan vien</CardTitle>
              <p className="text-sm text-slate-500">Theo doi email, vai tro he thong va thao tac quan tri.</p>
            </div>
            <div className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">{users.length} tai khoan</div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex h-48 items-center justify-center">
                <div className="spinner" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nhan su</TableHead>
                    <TableHead>Vai tro he thong</TableHead>
                    <TableHead>Cap nhat vai tro</TableHead>
                    <TableHead className="text-right">Hanh dong</TableHead>
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
                        <select
                          className="form-select max-w-[180px]"
                          value={user.role}
                          onChange={(e) => handleChangeRole(user.id, e.target.value)}
                          disabled={isManager && user.role === 'ADMIN'}
                        >
                          {roleOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                          {user.role === 'ADMIN' && isManager && <option value="ADMIN">Quan tri vien</option>}
                        </select>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          {canEditPermissions && (
                            <Button variant="outline" size="sm" onClick={() => openPermissions(user)}>
                              <Settings2 size={14} />
                              Phan quyen
                            </Button>
                          )}
                          {canDeleteUser && (
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
                        Chua co tai khoan nao.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog size={18} />
              Tao nhan vien moi
            </DialogTitle>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
              </div>

              <div className="space-y-2">
                <Label>Mat khau</Label>
                <Input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Ho ten</Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
              </div>

              <div className="space-y-2">
                <Label>Vai tro</Label>
                <select className="form-select" value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })}>
                  {roleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                Huy
              </Button>
              <Button type="submit">
                <Plus size={14} />
                Tao tai khoan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showPermissionModal} onOpenChange={setShowPermissionModal}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound size={18} />
              Thiet lap phan quyen: {selectedUser?.name ?? 'Nhan vien'}
            </DialogTitle>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-5">
              <div className="grid gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 md:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400">Email</p>
                  <p className="mt-1 font-medium text-slate-800">{selectedUser.email}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400">Vai tro he thong</p>
                  <p className="mt-1 font-medium text-slate-800">{roleLabelMap[selectedUser.role]}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100">
                <div className="grid grid-cols-[1.7fr,0.5fr,0.5fr,0.5fr,0.5fr,0.5fr] gap-0 border-b border-slate-100 bg-slate-50/80 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-500">
                  <div>Module he thong</div>
                  <div className="text-center">Xem</div>
                  <div className="text-center">Them</div>
                  <div className="text-center">Ghi</div>
                  <div className="text-center">Sua</div>
                  <div className="text-center">Xoa</div>
                </div>

                {moduleDefinitions.map(([label, key]) => (
                  <div
                    key={key}
                    className="grid grid-cols-[1.7fr,0.5fr,0.5fr,0.5fr,0.5fr,0.5fr] items-center gap-0 border-b border-slate-100 px-4 py-3 last:border-b-0"
                  >
                    <div className="text-sm font-medium text-slate-700">{label}</div>

                    {(['view', 'create', 'save', 'edit', 'delete'] as const).map((permissionKey) => (
                      <div key={permissionKey} className="flex justify-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 accent-violet-600"
                          checked={Boolean(permissions[key]?.[permissionKey])}
                          onChange={() => togglePermission(key, permissionKey)}
                          disabled={key === 'activityLogs' && permissionKey !== 'view'}
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Cau hinh nay duoc luu truc tiep xuong backend. Cac thao tac nhu ngung giao dich, kich hoat lai giao dich va xoa giao dich se doc theo quyen da luu.
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowPermissionModal(false)} disabled={isSavingPermissions}>
                  Huy
                </Button>
                <Button onClick={handleSavePermissions} disabled={isSavingPermissions}>
                  Luu phan quyen
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
