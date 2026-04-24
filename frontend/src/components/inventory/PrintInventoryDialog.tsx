import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';

interface PrintInventoryDialogProps {
  open: boolean;
  onClose: () => void;
  inventoryData: any[];
}

export default function PrintInventoryDialog({ open, onClose, inventoryData }: PrintInventoryDialogProps) {
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>In tồn kho</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; }
            h1 { text-align: center; }
            .footer { margin-top: 20px; text-align: right; }
          </style>
        </head>
        <body>
          <h1>BÁO CÁO TỒN KHO</h1>
          <p>Ngày in: ${new Date().toLocaleDateString('vi-VN')}</p>
          <table>
            <thead>
              <tr>
                <th>Mã vị trí</th>
                <th>Kho</th>
                <th>Khu vực</th>
                <th>Tọa độ</th>
                <th>Tồn kho</th>
                <th>Sức chứa</th>
              </tr>
            </thead>
            <tbody>
              ${inventoryData.map(item => `
                <tr>
                  <td>${item.code}</td>
                  <td>${item.warehouseName}</td>
                  <td>${item.zoneName}</td>
                  <td>${item.row}-${item.column}</td>
                  <td>${item.currentQuantity}</td>
                  <td>${item.capacity}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="footer">
            <p>Tổng số vị trí: ${inventoryData.length}</p>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>In báo cáo tồn kho</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Bạn có {inventoryData.length} vị trí trong kho. Bạn có muốn in báo cáo không?
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button onClick={handlePrint}>
              In ngay
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
