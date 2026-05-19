import { Download } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';

interface TransactionExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  onExportAll: () => void | Promise<void>;
  onExportFiltered: () => void | Promise<void>;
  isExporting?: boolean;
}

export function TransactionExportDialog({
  open,
  onOpenChange,
  title = 'Xuất Excel Transaction',
  onExportAll,
  onExportFiltered,
  isExporting = false,
}: TransactionExportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download size={18} />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <button
            type="button"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left transition hover:border-violet-200 hover:bg-violet-50/40 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => void onExportAll()}
            disabled={isExporting}
          >
            <div className="text-sm font-semibold text-slate-900">Xuất Excel toàn bộ Transaction trong mục này</div>
            <div className="mt-1 text-sm text-slate-500">Xuất toàn bộ dữ liệu của mục hiện tại, không áp dụng bộ lọc đang chọn.</div>
          </button>

          <button
            type="button"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left transition hover:border-violet-200 hover:bg-violet-50/40 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => void onExportFiltered()}
            disabled={isExporting}
          >
            <div className="text-sm font-semibold text-slate-900">Xuất Excel toàn bộ Transaction theo bộ lọc đang chọn</div>
            <div className="mt-1 text-sm text-slate-500">Xuất tất cả transaction khớp với bộ lọc hiện tại, kể cả khi dữ liệu trải qua nhiều trang.</div>
          </button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
