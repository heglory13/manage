import { Button } from '../ui/button';

interface CanvasEditorToolbarProps {
  tool: 'select' | 'zone' | 'position';
  onToolChange: (tool: 'select' | 'zone' | 'position') => void;
  selectedZoneColor: string;
  onZoneColorChange: (color: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

const zoneColors = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16',
  '#22c55e', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7',
];

export default function CanvasEditorToolbar({
  tool,
  onToolChange,
  selectedZoneColor,
  onZoneColorChange,
  onSave,
  onCancel,
}: CanvasEditorToolbarProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-card p-2">
      <div className="flex items-center gap-2">
        <Button
          variant={tool === 'select' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onToolChange('select')}
        >
          Chọn
        </Button>
        <Button
          variant={tool === 'zone' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onToolChange('zone')}
        >
          Khu vực
        </Button>
        <Button
          variant={tool === 'position' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onToolChange('position')}
        >
          Vị trí
        </Button>

        {tool === 'zone' && (
          <div className="ml-4 flex items-center gap-1">
            <span className="text-sm text-muted-foreground">Màu:</span>
            {zoneColors.map(color => (
              <button
                key={color}
                className={`h-6 w-6 rounded-full border-2 ${selectedZoneColor === color ? 'border-foreground' : 'border-transparent'}`}
                style={{ backgroundColor: color }}
                onClick={() => onZoneColorChange(color)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Hủy
        </Button>
        <Button size="sm" onClick={onSave}>
          Lưu
        </Button>
      </div>
    </div>
  );
}
