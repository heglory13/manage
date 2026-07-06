import { useState, useEffect, useRef } from 'react';
import { Input } from '../ui/input';
import { api } from '../../services/api';
import { Search, X, Check } from 'lucide-react';

interface SkuCombo {
  id: string;
  compositeSku: string;
  classification?: { id: string; name: string };
  color?: { id: string; name: string };
  size?: { id: string; name: string };
  material?: { id: string; name: string };
  product?: { id: string; name: string };
}

interface SmartSkuComboSelectProps {
  value: string;
  onChange: (skuComboId: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function SmartSkuComboSelect({
  value,
  onChange,
  placeholder = 'Tìm SKU (gõ để tìm kiếm...)',
  disabled = false,
}: SmartSkuComboSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SkuCombo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSku, setSelectedSku] = useState<SkuCombo | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (!isOpen || searchTerm.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await api.get('/sku-combos', {
          params: {
            search: searchTerm,
            limit: 50, // Only fetch top 50 results for better performance
          },
        });
        setResults(res.data.data || res.data || []);
      } catch (err) {
        console.error('Error searching SKU combos:', err);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [searchTerm, isOpen]);

  // Fetch selected SKU details when value changes
  useEffect(() => {
    if (value) {
      const timer = setTimeout(async () => {
        try {
          const res = await api.get(`/sku-combos/${value}`);
          setSelectedSku(res.data);
        } catch (err) {
          console.error('Error fetching selected SKU:', err);
        }
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setSelectedSku(null);
    }
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (sku: SkuCombo) => {
    onChange(sku.id);
    setSelectedSku(sku);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = () => {
    onChange('');
    setSelectedSku(null);
    setSearchTerm('');
    inputRef.current?.focus();
  };

  const formatSkuDisplay = (sku: SkuCombo) => {
    const parts = [
      sku.compositeSku,
      sku.classification?.name,
      sku.color?.name,
      sku.size?.name,
      sku.material?.name,
    ].filter(Boolean);
    return parts.join(' - ');
  };

  return (
    <div className="relative">
      {/* Selected Display */}
      <div
        className={`flex items-center gap-2 p-2 border rounded-md bg-background ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-muted/50'
        }`}
        onClick={() => {
          if (!disabled) {
            setIsOpen(true);
            setTimeout(() => inputRef.current?.focus(), 0);
          }
        }}
      >
        {selectedSku ? (
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{selectedSku.compositeSku}</p>
            <p className="text-xs text-muted-foreground truncate">
              {[
                selectedSku.classification?.name,
                selectedSku.color?.name,
                selectedSku.size?.name,
                selectedSku.material?.name,
              ]
                .filter(Boolean)
                .join(' - ')}
            </p>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm flex-1">
            {placeholder}
          </span>
        )}
        {selectedSku && (
          <button
            type="button"
            className="p-1 hover:bg-muted rounded"
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-80 overflow-hidden"
        >
          {/* Search Input */}
          <div className="p-2 border-b bg-muted/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                type="text"
                placeholder="Gõ SKU, phân loại, màu, size... để tìm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Gõ ít nhất 2 ký tự để tìm kiếm
            </p>
          </div>

          {/* Results */}
          <div className="overflow-y-auto max-h-60">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Đang tìm kiếm...
              </div>
            ) : results.length > 0 ? (
              <ul className="py-1">
                {results.map((sku) => (
                  <li
                    key={sku.id}
                    className={`px-3 py-2 cursor-pointer hover:bg-muted/50 ${
                      sku.id === value ? 'bg-primary/10' : ''
                    }`}
                    onClick={() => handleSelect(sku)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm">{sku.compositeSku}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {[
                            sku.classification?.name,
                            sku.color?.name,
                            sku.size?.name,
                            sku.material?.name,
                          ]
                            .filter(Boolean)
                            .join(' - ')}
                        </p>
                        {sku.product?.name && (
                          <p className="text-xs text-primary truncate">
                            {sku.product.name}
                          </p>
                        )}
                      </div>
                      {sku.id === value && (
                        <Check className="w-4 h-4 text-primary flex-shrink-0" />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : searchTerm.length >= 2 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Không tìm thấy SKU nào phù hợp
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Nhập từ khóa để tìm kiếm
              </div>
            )}
          </div>

          {/* Footer hint */}
          {results.length > 0 && (
            <div className="p-2 border-t bg-muted/50 text-xs text-muted-foreground text-center">
              {results.length} kết quả được tìm thấy
            </div>
          )}
        </div>
      )}
    </div>
  );
}
