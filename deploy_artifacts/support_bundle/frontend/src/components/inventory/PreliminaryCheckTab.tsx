import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { api } from '../../services/api';
import { compressImageForUpload } from '../../lib/image';
import { formatDateTime } from '../../lib/utils';
import { Plus, Eye, Check, X, Upload, Image, ArrowRight } from 'lucide-react';

interface Classification {
  id: string;
  name: string;
}

interface WarehouseType {
  id: string;
  name: string;
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface PreliminaryCheck {
  id: string;
  quantity: number;
  actualQuantity?: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  imageUrl?: string;
  note?: string;
  createdAt: string;
  classification: Classification;
  warehouseType?: WarehouseType;
  creator: User;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function PreliminaryCheckTab() {
  const [checks, setChecks] = useState<PreliminaryCheck[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Create dialog
  const [showCreate, setShowCreate] = useState(false);
  const [classifications, setClassifications] = useState<Classification[]>([]);
  const [warehouseTypes, setWarehouseTypes] = useState<WarehouseType[]>([]);
  const [createForm, setCreateForm] = useState({
    classificationId: '',
    quantity: 0,
    warehouseTypeId: '',
    imageFile: null as File | null,
    imagePreview: '',
    note: '',
  });
  const [isUploading, setIsUploading] = useState(false);

  // Detail dialog with actual quantity validation
  const [selectedCheck, setSelectedCheck] = useState<PreliminaryCheck | null>(null);
  const [actualQuantity, setActualQuantity] = useState<number>(0);
  const [quantityError, setQuantityError] = useState('');

  // Navigation callback for stock in/out
  const [onNavigateToStockIn, setOnNavigateToStockIn] = useState<(() => void) | null>(null);

  const fetchChecks = useCallback(async (pageNum = 1) => {
    setIsLoading(true);
    try {
      const params: Record<string, string> = {
        page: String(pageNum),
        limit: String(pageSize),
      };
      if (statusFilter) params.status = statusFilter;

      const res = await api.get('/preliminary-checks', { params });
      const data = res.data as PaginatedResponse<PreliminaryCheck>;
      setChecks(data.data || []);
      setTotal(data.total || 0);
      setPage(pageNum);
    } catch (err) {
      console.error('Error fetching preliminary checks:', err);
    } finally {
      setIsLoading(false);
    }
  }, [pageSize, statusFilter]);

  const fetchFiltersData = useCallback(async () => {
    try {
      const [classRes, typeRes] = await Promise.all([
        api.get('/input-declarations/classifications'),
        api.get('/input-declarations/warehouse-types'),
      ]);
      setClassifications(classRes.data || []);
      setWarehouseTypes(typeRes.data || []);
    } catch (err) {
      console.error('Error fetching filters data:', err);
    }
  }, []);

  useEffect(() => {
    fetchChecks();
    fetchFiltersData();
  }, [fetchChecks, fetchFiltersData]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Vui lòng chọn file hình ảnh');
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Kích thước file không được vượt quá 5MB');
        return;
      }

      setCreateForm(prev => ({
        ...prev,
        imageFile: file,
        imagePreview: URL.createObjectURL(file),
      }));
    }
  };

  const handleCreate = async () => {
    try {
      setIsUploading(true);
      const payload: Record<string, unknown> = {
        classificationId: createForm.classificationId,
        quantity: createForm.quantity,
      };
      if (createForm.warehouseTypeId) payload.warehouseTypeId = createForm.warehouseTypeId;
      if (createForm.note) payload.note = createForm.note;

      // If there's an image file, upload it first
      if (createForm.imageFile) {
        const formData = new FormData();
        formData.append('file', await compressImageForUpload(createForm.imageFile));

        const uploadRes = await api.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        payload.imageUrl = uploadRes.data.url;
      }

      await api.post('/preliminary-checks', payload);
      setShowCreate(false);
      setCreateForm({
        classificationId: '',
        quantity: 0,
        warehouseTypeId: '',
        imageFile: null,
        imagePreview: '',
        note: '',
      });
      fetchChecks();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể tạo phiếu kiểm tra');
    } finally {
      setIsUploading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await api.patch(`/preliminary-checks/${id}/complete`, { status: 'APPROVED' });
      fetchChecks();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể duyệt phiếu');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await api.patch(`/preliminary-checks/${id}/complete`, { status: 'REJECTED' });
      fetchChecks();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể từ chối phiếu');
    }
  };

  // Handle viewing details and validating actual quantity
  const handleViewDetails = (check: PreliminaryCheck) => {
    setSelectedCheck(check);
    setActualQuantity(check.actualQuantity || check.quantity);
    setQuantityError('');
  };

  // Validate actual quantity before navigation
  const validateAndNavigateToStockIn = () => {
    if (!selectedCheck) return;

    if (actualQuantity <= 0) {
      setQuantityError('Số lượng thực tế phải lớn hơn 0');
      return;
    }

    if (actualQuantity < selectedCheck.quantity) {
      setQuantityError(`Số lượng thiếu: còn thiếu ${selectedCheck.quantity - actualQuantity} sản phẩm. Vui lòng nhập đủ số lượng!`);
      return;
    }

    if (actualQuantity > selectedCheck.quantity) {
      setQuantityError(`Số lượng vượt quá: vượt ${actualQuantity - selectedCheck.quantity} sản phẩm!`);
      return;
    }

    // Valid - navigate to stock in
    setQuantityError('');
    setSelectedCheck(null);
    // Trigger navigation to stock in tab in parent component
    // This would typically be done via a callback prop
    window.location.href = '/inventory?tab=stock-in';
  };

  const totalPages = Math.ceil(total / pageSize);

  const statusColors: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    APPROVED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
  };

  const statusLabels: Record<string, string> = {
    PENDING: 'Chờ duyệt',
    APPROVED: 'Đã duyệt',
    REJECTED: 'Từ chối',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Phiếu Kiểm tra sơ bộ</CardTitle>
            <div className="flex gap-2 items-center">
              <select
                className="rounded-md border border-input bg-background px-3 py-2 text-sm h-9"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  fetchChecks(1);
                }}
              >
                <option value="">Tất cả</option>
                <option value="PENDING">Chờ duyệt</option>
                <option value="APPROVED">Đã duyệt</option>
                <option value="REJECTED">Từ chối</option>
              </select>
              <Button onClick={() => setShowCreate(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Tạo phiếu mới
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:bg-muted/50" onClick={() => { setStatusFilter('PENDING'); fetchChecks(1); }}>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600">
              {checks.filter(c => c.status === 'PENDING').length}+
            </div>
            <p className="text-xs text-muted-foreground">Chờ duyệt</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/50" onClick={() => { setStatusFilter('APPROVED'); fetchChecks(1); }}>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">
              {checks.filter(c => c.status === 'APPROVED').length}+
            </div>
            <p className="text-xs text-muted-foreground">Đã duyệt</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/50" onClick={() => { setStatusFilter('REJECTED'); fetchChecks(1); }}>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">
              {checks.filter(c => c.status === 'REJECTED').length}+
            </div>
            <p className="text-xs text-muted-foreground">Từ chối</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{total}</div>
            <p className="text-xs text-muted-foreground">Tổng số phiếu</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="spinner"></div>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>STT</TableHead>
                    <TableHead>Ngày tạo</TableHead>
                    <TableHead>Phân loại hàng</TableHead>
                    <TableHead>Loại kho</TableHead>
                    <TableHead className="text-right">Số lượng</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Người tạo</TableHead>
                    <TableHead className="text-center">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checks.map((check, idx) => (
                    <TableRow key={check.id}>
                      <TableCell>{(page - 1) * pageSize + idx + 1}</TableCell>
                      <TableCell className="text-xs">{formatDateTime(check.createdAt)}</TableCell>
                      <TableCell className="font-medium">{check.classification?.name || '-'}</TableCell>
                      <TableCell>{check.warehouseType?.name || '-'}</TableCell>
                      <TableCell className="text-right font-bold">{check.quantity}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[check.status]}`}>
                          {statusLabels[check.status]}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">{check.creator?.name || '-'}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewDetails(check)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {check.status === 'PENDING' && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-green-600"
                                onClick={() => handleApprove(check.id)}
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-600"
                                onClick={() => handleReject(check.id)}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {checks.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Không có phiếu kiểm tra nào
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              {total > 0 && (
                <div className="flex items-center justify-between p-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Hiển thị {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} trong tổng {total} bản ghi
                  </p>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => fetchChecks(page - 1)} disabled={page <= 1}>
                      Trước
                    </Button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(p => (
                      <Button
                        key={p}
                        variant={p === page ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => fetchChecks(p)}
                      >
                        {p}
                      </Button>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => fetchChecks(page + 1)} disabled={page >= totalPages}>
                      Sau
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog with Image Upload */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tạo phiếu kiểm tra sơ bộ</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Phân loại hàng hoá *</Label>
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
                value={createForm.classificationId}
                onChange={(e) => setCreateForm({ ...createForm, classificationId: e.target.value })}
              >
                <option value="">Chọn phân loại</option>
                {classifications.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Số lượng *</Label>
              <Input
                type="number"
                min={1}
                value={createForm.quantity || ''}
                onChange={(e) => setCreateForm({ ...createForm, quantity: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>Loại kho</Label>
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
                value={createForm.warehouseTypeId}
                onChange={(e) => setCreateForm({ ...createForm, warehouseTypeId: e.target.value })}
              >
                <option value="">Chọn loại kho (không bắt buộc)</option>
                {warehouseTypes.map((wt) => (
                  <option key={wt.id} value={wt.id}>{wt.name}</option>
                ))}
              </select>
            </div>

            {/* Image Upload */}
            <div>
              <Label>Hình ảnh sản phẩm</Label>
              <div className="mt-1">
                <label
                  className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted transition-colors"
                >
                  {createForm.imagePreview ? (
                    <div className="relative w-full h-full">
                      <img
                        src={createForm.imagePreview}
                        alt="Preview"
                        className="w-full h-full object-contain rounded-lg"
                      />
                      <button
                        type="button"
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                        onClick={(e) => {
                          e.preventDefault();
                          setCreateForm(prev => ({ ...prev, imageFile: null, imagePreview: '' }));
                        }}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Click để upload hình ảnh
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        (PNG, JPG, GIF - tối đa 5MB)
                      </p>
                    </div>
                  )}
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageSelect}
                  />
                </label>
              </div>
            </div>

            <div>
              <Label>Ghi chú</Label>
              <textarea
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
                rows={3}
                value={createForm.note}
                onChange={(e) => setCreateForm({ ...createForm, note: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} disabled={isUploading}>Hủy</Button>
            <Button onClick={handleCreate} disabled={!createForm.classificationId || createForm.quantity <= 0 || isUploading}>
              {isUploading ? 'Đang tải...' : 'Tạo phiếu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog with Actual Quantity Validation */}
      <Dialog open={!!selectedCheck} onOpenChange={() => setSelectedCheck(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Chi tiết phiếu kiểm tra sơ bộ</DialogTitle>
          </DialogHeader>
          {selectedCheck && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Mã phiếu</Label>
                  <p className="font-mono text-sm">{selectedCheck.id.slice(0, 8)}...</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Trạng thái</Label>
                  <p>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[selectedCheck.status]}`}>
                      {statusLabels[selectedCheck.status]}
                    </span>
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Phân loại hàng</Label>
                  <p className="font-medium">{selectedCheck.classification?.name || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Loại kho</Label>
                  <p>{selectedCheck.warehouseType?.name || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Số lượng khai báo</Label>
                  <p className="font-bold text-lg">{selectedCheck.quantity}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Ngày tạo</Label>
                  <p className="text-sm">{formatDateTime(selectedCheck.createdAt)}</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-muted-foreground">Người tạo</Label>
                  <p>{selectedCheck.creator?.name || '-'} ({selectedCheck.creator?.email || '-'})</p>
                </div>
              </div>

              {/* Image Preview */}
              {selectedCheck.imageUrl && (
                <div>
                  <Label className="text-muted-foreground mb-2 block">Hình ảnh</Label>
                  <img
                    src={selectedCheck.imageUrl}
                    alt="Preview"
                    className="max-h-48 rounded border"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              )}

              {selectedCheck.note && (
                <div>
                  <Label className="text-muted-foreground">Ghi chú</Label>
                  <p className="text-sm">{selectedCheck.note}</p>
                </div>
              )}

              {/* Actual Quantity Validation for Pending Items */}
              {selectedCheck.status === 'PENDING' && (
                <div className="border-t pt-4 mt-4">
                  <Label className="text-primary mb-2 block">Xác nhận số lượng thực tế *</Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    Nhập số lượng thực tế để tiếp tục nhập kho chi tiết
                  </p>
                  <Input
                    type="number"
                    min={1}
                    value={actualQuantity}
                    onChange={(e) => {
                      setActualQuantity(parseInt(e.target.value) || 0);
                      setQuantityError('');
                    }}
                    className="mb-2"
                  />
                  {quantityError && (
                    <div className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200 mb-3">
                      ⚠️ {quantityError}
                    </div>
                  )}
                  <div className="text-sm text-muted-foreground">
                    <p>• Nhập đúng số lượng: {selectedCheck.quantity}</p>
                    <p>• Thiếu sẽ hiện cảnh báo</p>
                    <p>• Đủ số lượng mới cho phép nhập kho chi tiết</p>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedCheck(null)}>Đóng</Button>
            {selectedCheck?.status === 'PENDING' && (
              <>
                <Button variant="destructive" onClick={() => { handleReject(selectedCheck.id); setSelectedCheck(null); }}>
                  Từ chối
                </Button>
                <Button onClick={validateAndNavigateToStockIn}>
                  <ArrowRight className="w-4 h-4 mr-1" />
                  Nhập kho chi tiết
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
