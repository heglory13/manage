import { X } from 'lucide-react';
import { Button } from '../ui/button';

interface SavedFilterTabsProps {
  tabs: { id: number; name: string; isDefault?: boolean }[];
  activeTab: number | null;
  onTabChange: (id: number | null) => void;
  onAddTab?: () => void;
  onDeleteTab?: (id: number) => void;
}

export default function SavedFilterTabs({
  tabs,
  activeTab,
  onTabChange,
  onAddTab,
  onDeleteTab,
}: SavedFilterTabsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant={activeTab === null ? 'default' : 'outline'}
        size="sm"
        onClick={() => onTabChange(null)}
      >
        Tất cả
      </Button>
      
      {tabs.map(tab => (
        <div
          key={tab.id}
          className={`group flex items-center gap-1 rounded-full px-3 py-1 text-sm ${
            activeTab === tab.id
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground'
          }`}
        >
          <button onClick={() => onTabChange(tab.id)}>{tab.name}</button>
          {onDeleteTab && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteTab(tab.id);
              }}
              className="ml-1 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      ))}
      
      {onAddTab && (
        <Button variant="ghost" size="sm" onClick={onAddTab}>
          + Thêm bộ lọc
        </Button>
      )}
    </div>
  );
}
