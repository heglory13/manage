import { useState, useMemo } from 'react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  width?: string;
}

interface FilterableTableProps<T> {
  columns: Column[];
  data: T[];
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

export default function FilterableTable<T extends Record<string, any>>({
  columns,
  data,
  onRowClick,
  emptyMessage = 'Không có dữ liệu',
}: FilterableTableProps<T>) {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const filteredData = useMemo(() => {
    let result = [...data];
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        result = result.filter(row => 
          String(row[key]).toLowerCase().includes(value.toLowerCase())
        );
      }
    });
    
    if (sortKey) {
      result.sort((a, b) => {
        const aVal = a[sortKey];
        const bVal = b[sortKey];
        if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    return result;
  }, [data, filters, sortKey, sortOrder]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {columns.filter(col => col.filterable).map(col => (
          <Input
            key={col.key}
            placeholder={`Lọc ${col.label}...`}
            value={filters[col.key] || ''}
            onChange={e => setFilters(prev => ({ ...prev, [col.key]: e.target.value }))}
            className="max-w-[200px]"
          />
        ))}
      </div>

      <div className="overflow-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left font-medium ${col.sortable ? 'cursor-pointer hover:bg-muted/80' : ''}`}
                  style={{ width: col.width }}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className="flex items-center gap-2">
                    {col.label}
                    {col.sortable && sortKey === col.key && (
                      <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              filteredData.map((row, idx) => (
                <tr
                  key={idx}
                  className={`border-t ${onRowClick ? 'cursor-pointer hover:bg-muted/50' : ''}`}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map(col => (
                    <td key={col.key} className="px-4 py-3">
                      {row[col.key]?.toString() || '-'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
