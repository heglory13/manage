import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface LayoutConfigFormProps {
  rows: number;
  columns: number;
  onRowsChange: (rows: number) => void;
  onColumnsChange: (columns: number) => void;
  onApply: () => void;
}

export default function LayoutConfigForm({ rows, columns, onRowsChange, onColumnsChange, onApply }: LayoutConfigFormProps) {
  return (
    <div className="space-y-4 rounded-lg border p-4">
      <h3 className="font-medium">Cấu hình lưới kho</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="rows">Số hàng</Label>
          <Input
            id="rows"
            type="number"
            min={1}
            max={50}
            value={rows}
            onChange={e => onRowsChange(Number(e.target.value))}
          />
        </div>
        <div>
          <Label htmlFor="columns">Số cột</Label>
          <Input
            id="columns"
            type="number"
            min={1}
            max={50}
            value={columns}
            onChange={e => onColumnsChange(Number(e.target.value))}
          />
        </div>
      </div>
      <Button onClick={onApply} className="w-full">
        Áp dụng
      </Button>
    </div>
  );
}
