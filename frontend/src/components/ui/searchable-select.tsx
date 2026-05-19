import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, X } from 'lucide-react';

interface Option {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Chọn...',
  className = '',
  disabled = false,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    const query = search.toLowerCase();
    return options.filter((option) => option.label.toLowerCase().includes(query));
  }, [options, search]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (option: Option) => {
    if (option.disabled) return;
    onChange(option.value);
    setIsOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearch('');
  };

  const handleOpen = () => {
    if (disabled) return;
    setIsOpen(true);
    setSearch('');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        className={`form-select flex w-full items-center justify-between text-left ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
        onClick={handleOpen}
        disabled={disabled}
      >
        <span className={`min-w-0 flex-1 truncate ${selectedOption ? 'text-slate-900' : 'text-slate-400'}`}>
          {selectedOption?.label || placeholder}
        </span>
        <div className="flex flex-shrink-0 items-center gap-1">
          {value && (
            <span
              role="button"
              tabIndex={-1}
              className="rounded p-0.5 text-slate-400 hover:bg-slate-200"
              onClick={handleClear}
              onKeyDown={() => {}}
            >
              <X size={14} />
            </span>
          )}
          <ChevronDown size={14} className="text-slate-400" />
        </div>
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 p-2">
            <input
              ref={inputRef}
              type="text"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200"
              placeholder="Gõ để tìm..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="max-h-48 overflow-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-3 text-sm text-slate-400">Không tìm thấy</div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={option.disabled}
                  className={`w-full px-4 py-2.5 text-left text-sm ${
                    option.disabled
                      ? 'cursor-not-allowed text-slate-400 italic'
                      : option.value === value
                        ? 'bg-indigo-50 font-medium text-indigo-700 hover:bg-indigo-100'
                        : 'text-slate-800 hover:bg-slate-50'
                  }`}
                  onClick={() => handleSelect(option)}
                >
                  {option.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
