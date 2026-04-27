import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface PositionConfigDialogProps {
  open: boolean;
  onClose: () => void;
  position: {
    row: number;
    col: number;
    zoneId?: number;
    capacity: number;
  } | null;
  onSave: (data: { zoneId: number; capacity: number }) => void;
}

export default function PositionConfigDialog({
  open,
  onClose,
  position,
  onSave,
}: PositionConfigDialogProps) {
  if (!position) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    onSave({
      zoneId: Number(formData.get('zoneId')),
      capacity: Number(formData.get('capacity')),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cấu hình vị trí ({position.row}-{position.col})</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="capacity">Sức chứa</Label>
            <Input
              id="capacity"
              name="capacity"
              type="number"
              min={1}
              defaultValue={position.capacity}
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button type="submit">
              Lưu
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
