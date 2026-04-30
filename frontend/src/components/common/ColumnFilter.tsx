import { Button } from '../ui/button';

interface ColumnFilterProps {
  column: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}

export function ColumnFilter({ column, options, value, onChange }: ColumnFilterProps) {
  return (
    <div className="flex items-center gap-2 p-2">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="rounded border p-1 text-sm"
      >
        <option value="">Tất cả {column}</option>
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {value && (
        <Button variant="ghost" size="sm" onClick={() => onChange('')}>
          Xóa
        </Button>
      )}
    </div>
  );
}
