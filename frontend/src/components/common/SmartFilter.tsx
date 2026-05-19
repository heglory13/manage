import { useState, useRef, useEffect, useCallback } from 'react';
import { Filter, Save, Trash2, X, ChevronDown, Check, Search, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

export interface FilterField {
  key: string;
  label: string;
  type: 'select' | 'text' | 'date' | 'number';
  options?: { value: string; label: string }[];
  placeholder?: string;
  /**
   * Load options từ server. Nếu hàm chấp nhận tham số, SmartFilter sẽ truyền
   * từ khoá tìm kiếm khi người dùng gõ (server-side search).
   * Nếu không có tham số thì sẽ tải toàn bộ options một lần khi mở dropdown.
   */
  asyncLoad?: (q?: string) => Promise<{ value: string; label: string }[]>;
}

interface SmartFilterProps {
  fields: FilterField[];
  filters: Record<string, unknown>;
  draftFilters: Record<string, unknown>;
  savedFilters: { id: string; name: string; filters: Record<string, unknown>; createdAt: string }[];
  activeFilterId: string | null;
  hasPendingChanges: boolean;
  onUpdateFilter: (key: string, value: unknown) => void;
  onRemoveFilter: (key: string) => void;
  onClearFilters: () => void;
  onApplyDraftFilters: () => void;
  onApplyFilter: (filter: { id: string; name: string; filters: Record<string, unknown>; createdAt: string }) => void;
  onSaveFilter: (name: string) => Promise<unknown>;
  onDeleteFilter: (id: string) => Promise<void>;
}

function isActiveValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return value !== '' && value !== null && value !== undefined;
}

function getSelectedArr(val: unknown): string[] {
  if (Array.isArray(val)) return val as string[];
  if (val && typeof val === 'string') return [val];
  return [];
}

export default function SmartFilter({
  fields,
  filters,
  draftFilters,
  savedFilters,
  activeFilterId,
  hasPendingChanges,
  onUpdateFilter,
  onRemoveFilter,
  onClearFilters,
  onApplyDraftFilters,
  onApplyFilter,
  onSaveFilter,
  onDeleteFilter,
}: SmartFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [showSavedList, setShowSavedList] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [dropdownSearch, setDropdownSearch] = useState<Record<string, string>>({});
  const [dropdownAlignRight, setDropdownAlignRight] = useState<Record<string, boolean>>({});
  const [loadedOptions, setLoadedOptions] = useState<Record<string, { value: string; label: string }[]>>({});
  const [loadingFields, setLoadingFields] = useState<Set<string>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const draftCount = Object.values(draftFilters).filter(isActiveValue).length;
  const appliedCount = Object.values(filters).filter(isActiveValue).length;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowSavedList(false);
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenDropdown(null);
        setShowSavedList(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
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

  const toggleOption = (key: string, optValue: string, current: string[]) => {
    const next = current.includes(optValue)
      ? current.filter((v) => v !== optValue)
      : [...current, optValue];
    if (next.length > 0) onUpdateFilter(key, next);
    else onRemoveFilter(key);
  };

  const openDropdownFor = useCallback((field: FilterField) => {
    const isCurrentlyOpen = openDropdown === field.key;
    setOpenDropdown(isCurrentlyOpen ? null : field.key);
    if (isCurrentlyOpen) return;

    setDropdownSearch((s) => ({ ...s, [field.key]: '' }));

    // Tính toán căn phải nếu gần mép màn hình
    const triggerEl = triggerRefs.current[field.key];
    if (triggerEl) {
      const rect = triggerEl.getBoundingClientRect();
      const spaceOnRight = window.innerWidth - rect.left;
      setDropdownAlignRight((prev) => ({ ...prev, [field.key]: spaceOnRight < 300 }));
    }

    // Nếu asyncLoad tồn tại và chưa có dữ liệu, tải tạm thời (không có khóa tìm kiếm)
    if (field.asyncLoad && !loadedOptions[field.key]) {
      setLoadingFields((prev) => new Set([...prev, field.key]));
      field.asyncLoad()
        .then((results) => {
          setLoadedOptions((prev) => ({ ...prev, [field.key]: results }));
        })
        .catch(() => {
          setLoadedOptions((prev) => ({ ...prev, [field.key]: [] }));
        })
        .finally(() => {
          setLoadingFields((prev) => {
            const next = new Set(prev);
            next.delete(field.key);
            return next;
          });
        });
    }
  }, [openDropdown, loadedOptions]);

  // Debounced server-side search: khi dropdown mở và người dùng gõ, gọi asyncLoad(q)
  useEffect(() => {
    const key = openDropdown;
    if (!key) return;
    const field = fields.find((f) => f.key === key);
    if (!field?.asyncLoad) return;

    const q = (dropdownSearch[key] ?? '').trim();
    const timer = setTimeout(() => {
      setLoadingFields((prev) => new Set([...prev, key]));
      // call asyncLoad with query; nếu implementation ignore param thì vẫn OK
      field.asyncLoad(q)
        .then((results) => {
          setLoadedOptions((prev) => ({ ...prev, [key]: results }));
        })
        .catch(() => {
          setLoadedOptions((prev) => ({ ...prev, [key]: [] }));
        })
        .finally(() => {
          setLoadingFields((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [openDropdown, dropdownSearch, fields]);

  const activeFilterName = savedFilters.find((f) => f.id === activeFilterId)?.name;

  const renderDropdown = (field: FilterField, selectedVals: string[]) => {
    const hasAsync = !!field.asyncLoad;
    const hasStatic = !hasAsync && field.options && field.options.length > 0;
    if (!hasAsync && !hasStatic) return null;

    const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const searchTerm = norm(dropdownSearch[field.key] ?? '');
    const isLoading = loadingFields.has(field.key);

    const sourceOpts = hasAsync ? (loadedOptions[field.key] ?? []) : (field.options ?? []);

    const words = searchTerm.split(/\s+/).filter(Boolean);
    const filteredOpts = words.length === 0
      ? sourceOpts
      : sourceOpts.filter((opt) =>
          words.every((w) => norm(opt.label).includes(w))
        );

    const selectedNotInSource = selectedVals
      .filter((v) => !sourceOpts.find((o) => o.value === v))
      .map((v) => ({ value: v, label: v }));

    // Tách selected và unselected để hiển thị selected lên đầu
    const selectedOpts = filteredOpts.filter((o) => selectedVals.includes(o.value));
    const unselectedOpts = filteredOpts.filter((o) => !selectedVals.includes(o.value));
    const displayOpts = [...selectedNotInSource, ...selectedOpts, ...unselectedOpts];

    const displayLabel =
      selectedVals.length === 0
        ? (field.placeholder ?? 'Chọn...')
        : selectedVals.length === 1
          ? (sourceOpts.find((o) => o.value === selectedVals[0])?.label ?? selectedVals[0])
          : `${selectedVals.length} đã chọn`;

    const alignRight = dropdownAlignRight[field.key];

    return (
      <div className="relative">
        <button
          ref={(el) => { triggerRefs.current[field.key] = el; }}
          type="button"
          onClick={() => openDropdownFor(field)}
          className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm transition ${
            selectedVals.length > 0
              ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
              : 'border-input bg-background text-slate-500 hover:border-slate-300'
          }`}
        >
          <span className="truncate">{displayLabel}</span>
          <div className="ml-1 flex flex-shrink-0 items-center gap-1">
            {selectedVals.length > 0 && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveFilter(field.key);
                }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onRemoveFilter(field.key); } }}
                className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-200 text-indigo-600 hover:bg-indigo-300"
              >
                <X size={9} strokeWidth={3} />
              </span>
            )}
            <ChevronDown
              size={12}
              className={`transition-transform ${openDropdown === field.key ? 'rotate-180' : ''}`}
            />
          </div>
        </button>

        {openDropdown === field.key && (
          <div
            className={`absolute top-full z-50 mt-1 w-72 max-w-[calc(100vw-1rem)] rounded-xl border border-slate-200 bg-white shadow-xl ${
              alignRight ? 'right-0' : 'left-0'
            }`}
          >
            {/* Search input */}
            <div className="border-b border-slate-100 p-2">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Tìm kiếm..."
                  value={dropdownSearch[field.key] ?? ''}
                  onChange={(e) => setDropdownSearch((s) => ({ ...s, [field.key]: e.target.value }))}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full rounded-md border border-slate-200 py-1.5 pl-8 pr-3 text-sm outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200"
                />
              </div>
            </div>

            {/* Options list */}
            <div className="max-h-56 overflow-y-auto overflow-x-hidden">
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-slate-400">
                  <Loader2 size={14} className="animate-spin" />
                  Đang tải...
                </div>
              ) : displayOpts.length > 0 ? (
                displayOpts.map((opt) => {
                  const checked = selectedVals.includes(opt.value);
                  return (
                    <label
                      key={opt.value}
                      className={`flex cursor-pointer items-start gap-2.5 px-3 py-2 text-sm hover:bg-slate-50 ${
                        checked ? 'bg-indigo-50/50' : ''
                      }`}
                    >
                      <div
                        className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition ${
                          checked ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300 bg-white'
                        }`}
                      >
                        {checked && <Check size={10} className="text-white" strokeWidth={3} />}
                      </div>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={() => toggleOption(field.key, opt.value, selectedVals)}
                      />
                      <span className={`leading-5 ${checked ? 'font-medium text-slate-900' : 'text-slate-700'}`}>
                        {opt.label}
                      </span>
                    </label>
                  );
                })
              ) : (
                <div className="px-3 py-6 text-center text-sm text-slate-400">Không tìm thấy kết quả</div>
              )}
            </div>

            {/* Footer */}
            {!isLoading && (
              <div className="flex items-center justify-between border-t border-slate-100 px-3 py-1.5">
                <span className="text-[11px] text-slate-400">
                  {sourceOpts.length > 0 ? `${filteredOpts.length}/${sourceOpts.length} mục` : ''}
                </span>
                {selectedVals.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onRemoveFilter(field.key)}
                    className="text-[11px] text-rose-500 hover:text-rose-700"
                  >
                    Bỏ chọn tất cả ({selectedVals.length})
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3 overflow-x-hidden" ref={panelRef}>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          className={`gap-2 ${appliedCount > 0 ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
        >
          <Filter size={14} />
          Bộ lọc
          {draftCount > 0 && (
            <span className="ml-1 rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {draftCount}
            </span>
          )}
        </Button>

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
            <div className="absolute right-0 top-full z-50 mt-1 w-64 max-w-[calc(100vw-1rem)] rounded-xl border border-slate-200 bg-white shadow-lg">
              {savedFilters.length === 0 ? (
                <div className="px-4 py-3 text-sm text-slate-500">Chưa có bộ lọc nào được lưu</div>
              ) : (
                <div className="max-h-60 overflow-auto">
                  {savedFilters.map((savedFilter) => (
                    <div
                      key={savedFilter.id}
                      className={`flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 ${savedFilter.id === activeFilterId ? 'bg-indigo-50' : ''}`}
                    >
                      <button
                        type="button"
                        className="flex-1 text-left text-sm font-medium text-slate-800"
                        onClick={() => {
                          onApplyFilter(savedFilter);
                          setShowSavedList(false);
                          setIsOpen(true);
                        }}
                      >
                        {savedFilter.name}
                      </button>
                      <button
                        type="button"
                        className="ml-2 text-slate-400 hover:text-rose-500"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (confirm(`Xóa bộ lọc "${savedFilter.name}"?`)) {
                            await onDeleteFilter(savedFilter.id);
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

        {showSaveInput ? (
          <>
            <Input
              className="h-8 w-full text-sm sm:w-40"
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
            variant="outline"
            className="text-slate-600"
            onClick={() => setShowSaveInput(true)}
            disabled={draftCount === 0}
          >
            Lưu bộ lọc
          </Button>
        )}

        {draftCount > 0 && (
          <Button variant="ghost" size="sm" className="gap-1 text-slate-500" onClick={onClearFilters}>
            <X size={14} />
            Xóa lọc
          </Button>
        )}
      </div>

      {isOpen && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm overflow-x-hidden">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {fields.map((field) => {
              const selectedVals = getSelectedArr(draftFilters[field.key]);

              return (
                <div key={field.key} className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {field.label}
                  </label>

                  {field.type === 'date' ? (
                    <Input
                      type="date"
                      className="text-sm"
                      value={(draftFilters[field.key] as string) || ''}
                      onChange={(e) => {
                        if (e.target.value) onUpdateFilter(field.key, e.target.value);
                        else onRemoveFilter(field.key);
                      }}
                    />
                  ) : field.asyncLoad || (field.options && field.options.length > 0) ? (
                    renderDropdown(field, selectedVals)
                  ) : (
                    <Input
                      type={field.type === 'number' ? 'number' : 'text'}
                      className="text-sm"
                      placeholder={field.placeholder || `Lọc ${field.label.toLowerCase()}...`}
                      value={(draftFilters[field.key] as string) || ''}
                      onChange={(e) => {
                        if (e.target.value) onUpdateFilter(field.key, e.target.value);
                        else onRemoveFilter(field.key);
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {draftCount > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
              {Object.entries(draftFilters)
                .filter(([, value]) => isActiveValue(value))
                .flatMap(([key, value]) => {
                  const field = fields.find((item) => item.key === key);
                  const vals = getSelectedArr(value);

                  if (vals.length > 0 && (field?.options || field?.asyncLoad)) {
                    const sourceOpts = field?.options ?? loadedOptions[key] ?? [];
                    return vals.map((v) => {
                      const displayValue = sourceOpts.find((o) => o.value === v)?.label ?? v;
                      return (
                        <span
                          key={`${key}-${v}`}
                          className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700"
                        >
                          {field?.label}: {displayValue}
                          <button
                            type="button"
                            onClick={() => {
                              const next = vals.filter((x) => x !== v);
                              if (next.length > 0) onUpdateFilter(key, next);
                              else onRemoveFilter(key);
                            }}
                            className="hover:text-indigo-900"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      );
                    });
                  }

                  const displayValue = String(value);
                  return [
                    <span
                      key={key}
                      className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700"
                    >
                      {field?.label}: {displayValue}
                      <button type="button" onClick={() => onRemoveFilter(key)} className="hover:text-indigo-900">
                        <X size={12} />
                      </button>
                    </span>,
                  ];
                })}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
            <div className={`text-xs ${hasPendingChanges ? 'text-amber-600' : 'text-emerald-600'}`}>
              {hasPendingChanges ? 'Có thay đổi chưa áp dụng' : 'Bộ lọc đã được áp dụng'}
            </div>
            <Button size="sm" onClick={onApplyDraftFilters} disabled={!hasPendingChanges}>
              Lọc
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
