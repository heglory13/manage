import { useEffect, useMemo, useState } from 'react';
import { KeyRound, Plus, Settings2, Trash2, UserCog } from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { api } from '../services/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';

type UserRecord = {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'MANAGER' | 'STAFF';
};

type PermissionState = Record<string, { view: boolean; save: boolean; delete: boolean }>;

const moduleDefinitions = [
  ['Bảng điều khiển Dashboard', 'dashboard'],
  ['Tracking quản lý tồn kho', 'inventory'],
  ['Nhập xuất kho', 'transactions'],
  ['Kiểm kê định kỳ', 'audit'],
  ['Sơ đồ Warehouse', 'warehouse'],
  ['Khai báo Input', 'input'],
] as const;

function createDefaultPermissions(): PermissionState {
  return Object.fromEntries(
    moduleDefinitions.map(([, key]) => [
      key,
      {
        view: true,
        save: key !== 'dashboard',
        delete: key !== 'dashboard',
      },
    ])
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [permissions, setPermissions] = useState<PermissionState>(createDefaultPermissions);
  const [formData, setFormData] = useState({ email: '', password: '', name: '', role: 'STAFF' });

  useEffect(() => {
    fetchUsers();
  }, []);

  const roleLabelMap = useMemo(
    () => ({
      ADMIN: 'Quản trị viên',
      MANAGER: 'Quản lý',
      STAFF: 'Nhân viên',
    }),
    []
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
      fetchUsers();
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Bạn có chắc muốn xóa người dùng này?')) {
      try {
        await api.delete(`/users/${id}`);
        fetchUsers();
      } catch (err) {
        console.error('Error:', err);
      }
    }
  };

  const handleChangeRole = async (id: string, role: string) => {
    try {
      await api.patch(`/users/${id}/role`, { role });
      fetchUsers();
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const openPermissions = (user: UserRecord) => {
    setSelectedUser(user);
    setPermissions(createDefaultPermissions());
    setShowPermissionModal(true);
  };

  const togglePermission = (moduleKey: string, permissionKey: 'view' | 'save' | 'delete') => {
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

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Quản lý nhân viên</h2>
            <p className="mt-1 text-sm text-slate-500">
              Quản lý tài khoản, vai trò và quyền truy cập của nhân sự trong hệ thống.
            </p>
          </div>

          <Button onClick={() => setShowCreateModal(true)}>
            <Plus size={16} />
            Thêm nhân viên
          </Button>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Danh sách nhân viên</CardTitle>
              <p className="text-sm text-slate-500">Theo dõi email, vai trò hệ thống và thao tác quản trị.</p>
            </div>
            <div className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
              {users.length} tài khoản
            </div>
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
                        <select
                          className="form-select max-w-[180px]"
                          value={user.role}
                          onChange={(e) => handleChangeRole(user.id, e.target.value)}
                        >
                          <option value="STAFF">Nhân viên</option>
                          <option value="MANAGER">Quản lý</option>
                          <option value="ADMIN">Quản trị viên</option>
                        </select>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => openPermissions(user)}>
                            <Settings2 size={14} />
                            Phân quyền
                          </Button>
                          <Button variant="outline" size="icon" onClick={() => handleDelete(user.id)}>
                            <Trash2 size={14} />
                          </Button>
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
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog size={18} />
              Tạo nhân viên mới
            </DialogTitle>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Mật khẩu</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Họ tên</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Vai trò</Label>
                <select
                  className="form-select"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                >
                  <option value="STAFF">Nhân viên</option>
                  <option value="MANAGER">Quản lý</option>
                  <option value="ADMIN">Quản trị viên</option>
                </select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                Hủy
              </Button>
              <Button type="submit">
                <Plus size={14} />
                Tạo tài khoản
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showPermissionModal} onOpenChange={setShowPermissionModal}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound size={18} />
              Thiết lập phân quyền: {selectedUser?.name ?? 'Nhân viên'}
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
                  <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400">Vai trò hệ thống</p>
                  <p className="mt-1 font-medium text-slate-800">{roleLabelMap[selectedUser.role]}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100">
                <div className="grid grid-cols-[1.8fr,0.4fr,0.4fr,0.4fr] gap-0 border-b border-slate-100 bg-slate-50/80 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-500">
                  <div>Module hệ thống</div>
                  <div className="text-center">Xem</div>
                  <div className="text-center">Ghi/Sửa</div>
                  <div className="text-center">Xóa</div>
                </div>

                {moduleDefinitions.map(([label, key]) => (
                  <div
                    key={key}
                    className="grid grid-cols-[1.8fr,0.4fr,0.4fr,0.4fr] items-center gap-0 border-b border-slate-100 px-4 py-3 last:border-b-0"
                  >
                    <div className="text-sm font-medium text-slate-700">{label}</div>

                    {(['view', 'save', 'delete'] as const).map((permissionKey) => (
                      <div key={permissionKey} className="flex justify-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 accent-violet-600"
                          checked={permissions[key][permissionKey]}
                          onChange={() => togglePermission(key, permissionKey)}
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Quyền xóa sẽ ảnh hưởng trực tiếp tới dữ liệu hệ thống. Ở bước này mình mới dựng giao diện và trạng thái
                cục bộ; phần đồng bộ nghiệp vụ phân quyền thật mình sẽ nối tiếp ở đợt sau.
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowPermissionModal(false)}>
                  Hủy
                </Button>
                <Button onClick={() => setShowPermissionModal(false)}>Lưu phân quyền</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
