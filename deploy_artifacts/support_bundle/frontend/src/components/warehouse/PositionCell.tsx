interface PositionCellProps {
  row: number;
  col: number;
  zoneColor?: string;
  zoneName?: string;
  isSelected: boolean;
  isActive: boolean;
  onClick: () => void;
}

export default function PositionCell({
  row,
  col,
  zoneColor,
  zoneName,
  isSelected,
  isActive,
  onClick,
}: PositionCellProps) {
  return (
    <button
      onClick={onClick}
      className={`
        relative flex h-12 w-12 items-center justify-center rounded border-2 text-xs font-medium transition-all
        ${isSelected ? 'border-primary ring-2 ring-primary ring-offset-2' : 'border-transparent'}
        ${isActive ? '' : 'opacity-50'}
      `}
      style={{ backgroundColor: zoneColor || '#f3f4f6' }}
      title={`Hàng ${row}, Cột ${col}${zoneName ? ` - ${zoneName}` : ''}`}
    >
      <span className="text-[10px] text-gray-600">
        {row}-{col}
      </span>
    </button>
  );
}
