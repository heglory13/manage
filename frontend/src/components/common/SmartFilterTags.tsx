import { X } from 'lucide-react';

interface SmartFilterTagsProps {
  filters: Record<string, string>;
  onRemove: (key: string) => void;
  onClearAll: () => void;
}

const filterLabels: Record<string, string> = {
  search: 'Tìm kiếm',
  status: 'Trạng thái',
  warehouseId: 'Kho',
  categoryId: 'Danh mục',
  role: 'Vai trò',
  isActive: 'Hoạt động',
  entityType: 'Loại',
  startDate: 'Từ ngày',
  endDate: 'Đến ngày',
};

export default function SmartFilterTags({ filters, onRemove, onClearAll }: SmartFilterTagsProps) {
  const activeFilters = Object.entries(filters).filter(([_, value]) => value);

  if (activeFilters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      <span className="text-sm text-muted-foreground">Đang lọc:</span>
      
      {activeFilters.map(([key, value]) => (
        <div
          key={key}
          className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary"
        >
          <span className="font-medium">{filterLabels[key] || key}:</span>
          <span>{value}</span>
          <button
            onClick={() => onRemove(key)}
            className="ml-1 rounded-full p-0.5 hover:bg-primary/20"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
      
      <button
        onClick={onClearAll}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        Xóa tất cả
      </button>
    </div>
  );
}
