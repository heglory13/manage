import { useState, useRef, useEffect } from 'react';
import { Filter, Save, Trash2, X, ChevronDown } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

export interface FilterField {
  key: string;
  label: string;
  type: 'select' | 'text' | 'date';
  options?: { value: string; label: string }[];
  placeholder?: string;
}

interface SmartFilterProps {
  fields: FilterField[];
  filters: Record<string, unknown>;
  savedFilters: { id: string; name: string; filters: Record<string, unknown>; createdAt: string }[];
  activeFilterId: string | null;
  onUpdateFilter: (key: string, value: unknown) => void;
  onRemoveFilter: (key: string) => void;
  onClearFilters: () => void;
  onApplyFilter: (filter: { id: string; name: string; filters: Record<string, unknown>; createdAt: string }) => void;
  onSaveFilter: (name: string) => Promise<unknown>;
  onDeleteFilter: (id: string) => Promise<void>;
}

export default function SmartFilter({
  fields,
  filters,
  savedFilters,
  activeFilterId,
  onUpdateFilter,
  onRemoveFilter,
  onClearFilters,
  onApplyFilter,
  onSaveFilter,
  onDeleteFilter,
}: SmartFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [showSavedList, setShowSavedList] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const activeCount = Object.values(filters).filter((v) => v !== '' && v !== null && v !== undefined).length;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowSavedList(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSave = async () => {
    const trimmed = saveName.trim();
    if (!trimmed) return;
    try {
      await onSaveFilter(trimmed);
      setSaveName('');
      setShowSaveInput(false);
    } catch (err: any) {
      alert(err.message || 'Không thể lưu bộ lọc');
    }
  };

  const activeFilterName = savedFilters.find((f) => f.id === activeFilterId)?.name;

  return (
    <div className="space-y-3" ref={panelRef}>
      {/* Toggle bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className={`gap-2 ${activeCount > 0 ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
        >
          <Filter size={14} />
          Bộ lọc
          {activeCount > 0 && (
            <span className="ml-1 rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {activeCount}
            </span>
          )}
        </Button>

        {/* Saved filters dropdown */}
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setShowSavedList(!showSavedList)}
          >
            <Save size={14} />
            {activeFilterName || 'Bộ lọc đã lưu'}
            <ChevronDown size={12} />
          </Button>
          {showSavedList && (
            <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-xl border border-slate-200 bg-white shadow-lg">
              {savedFilters.length === 0 ? (
                <div className="px-4 py-3 text-sm text-slate-500">Chưa có bộ lọc nào được lưu</div>
              ) : (
                <div className="max-h-60 overflow-auto">
                  {savedFilters.map((sf) => (
                    <div
                      key={sf.id}
                      className={`flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 ${sf.id === activeFilterId ? 'bg-indigo-50' : ''}`}
                    >
                      <button
                        type="button"
                        className="flex-1 text-left text-sm font-medium text-slate-800"
                        onClick={() => {
                          onApplyFilter(sf);
                          setShowSavedList(false);
                          setIsOpen(true);
                        }}
                      >
                        {sf.name}
                      </button>
                      <button
                        type="button"
                        className="ml-2 text-slate-400 hover:text-rose-500"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (confirm(`Xóa bộ lọc "${sf.name}"?`)) {
                            await onDeleteFilter(sf.id);
                          }
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {activeCount > 0 && (
          <Button variant="ghost" size="sm" className="gap-1 text-slate-500" onClick={onClearFilters}>
            <X size={14} />
            Xóa lọc
          </Button>
        )}
      </div>

      {/* Filter fields */}
      {isOpen && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {fields.map((field) => (
              <div key={field.key} className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {field.label}
                </label>
                {field.type === 'select' ? (
                  <select
                    className="form-select text-sm"
                    value={(filters[field.key] as string) || ''}
                    onChange={(e) => {
                      if (e.target.value) onUpdateFilter(field.key, e.target.value);
                      else onRemoveFilter(field.key);
                    }}
                  >
                    <option value="">Tất cả</option>
                    {field.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : field.type === 'date' ? (
                  <Input
                    type="date"
                    className="text-sm"
                    value={(filters[field.key] as string) || ''}
                    onChange={(e) => {
                      if (e.target.value) onUpdateFilter(field.key, e.target.value);
                      else onRemoveFilter(field.key);
                    }}
                  />
                ) : (
                  <Input
                    type="text"
                    className="text-sm"
                    placeholder={field.placeholder || `Lọc ${field.label.toLowerCase()}...`}
                    value={(filters[field.key] as string) || ''}
                    onChange={(e) => {
                      if (e.target.value) onUpdateFilter(field.key, e.target.value);
                      else onRemoveFilter(field.key);
                    }}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Active filter tags */}
          {activeCount > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
              {Object.entries(filters)
                .filter(([, v]) => v !== '' && v !== null && v !== undefined)
                .map(([key, value]) => {
                  const field = fields.find((f) => f.key === key);
                  const displayValue =
                    field?.type === 'select'
                      ? field.options?.find((o) => o.value === value)?.label || String(value)
                      : String(value);
                  return (
                    <span
                      key={key}
                      className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700"
                    >
                      {field?.label}: {displayValue}
                      <button type="button" onClick={() => onRemoveFilter(key)} className="hover:text-indigo-900">
                        <X size={12} />
                      </button>
                    </span>
                  );
                })}
            </div>
          )}

          {/* Save filter */}
          <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
            {showSaveInput ? (
              <>
                <Input
                  className="h-8 max-w-[200px] text-sm"
                  placeholder="Tên bộ lọc..."
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  autoFocus
                />
                <Button size="sm" onClick={handleSave} disabled={!saveName.trim()}>
                  Lưu
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowSaveInput(false); setSaveName(''); }}>
                  Hủy
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="gap-1 text-slate-500"
                onClick={() => setShowSaveInput(true)}
                disabled={activeCount === 0}
              >
                <Save size={13} />
                Lưu bộ lọc hiện tại
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
