import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { formatNumber } from '../../lib/utils';

interface PositionDetailPopupProps {
  open: boolean;
  onClose: () => void;
  position: {
    code: string;
    zoneName: string;
    zoneColor: string;
    row: number;
    col: number;
    capacity: number;
    currentQuantity: number;
    skus?: { sku: string; productName: string; quantity: number }[];
  } | null;
}

export default function PositionDetailPopup({ open, onClose, position }: PositionDetailPopupProps) {
  if (!position) return null;

  const usagePercent = position.capacity > 0 ? (position.currentQuantity / position.capacity) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chi tiết vị trí {position.code}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Khu vực</p>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-full" style={{ backgroundColor: position.zoneColor }} />
                <p className="font-medium">{position.zoneName}</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tọa độ</p>
              <p className="font-medium">Hàng {position.row}, Cột {position.col}</p>
            </div>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Sức chứa</p>
            <div className="mt-1">
              <div className="flex justify-between text-sm">
                <span>{formatNumber(position.currentQuantity)} / {formatNumber(position.capacity)}</span>
                <span className={usagePercent > 90 ? 'text-red-600' : usagePercent > 70 ? 'text-yellow-600' : 'text-green-600'}>
                  {usagePercent.toFixed(1)}%
                </span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-gray-200">
                <div
                  className={`h-2 rounded-full ${usagePercent > 90 ? 'bg-red-500' : usagePercent > 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                  style={{ width: `${Math.min(usagePercent, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {position.skus && position.skus.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground">Sản phẩm trong kho</p>
              <div className="mt-2 space-y-2">
                {position.skus.map((sku, idx) => (
                  <div key={idx} className="flex justify-between rounded border p-2">
                    <div>
                      <p className="font-medium">{sku.sku}</p>
                      <p className="text-sm text-muted-foreground">{sku.productName}</p>
                    </div>
                    <p className="font-medium">{formatNumber(sku.quantity)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
