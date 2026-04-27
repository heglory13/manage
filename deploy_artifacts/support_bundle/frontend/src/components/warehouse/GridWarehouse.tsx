import PositionCell from './PositionCell';

interface GridWarehouseProps {
  rows: number;
  columns: number;
  positions: {
    [key: string]: {
      zoneId: number;
      zoneName: string;
      zoneColor: string;
      isActive: boolean;
    };
  };
  selectedPosition: { row: number; col: number } | null;
  onPositionClick: (row: number, col: number) => void;
}

export default function GridWarehouse({
  rows,
  columns,
  positions,
  selectedPosition,
  onPositionClick,
}: GridWarehouseProps) {
  const cells = [];
  
  for (let row = 1; row <= rows; row++) {
    for (let col = 1; col <= columns; col++) {
      const key = `${row}-${col}`;
      const pos = positions[key];
      const isSelected = selectedPosition?.row === row && selectedPosition?.col === col;
      
      cells.push(
        <PositionCell
          key={key}
          row={row}
          col={col}
          zoneColor={pos?.zoneColor}
          zoneName={pos?.zoneName}
          isSelected={isSelected}
          isActive={pos?.isActive ?? true}
          onClick={() => onPositionClick(row, col)}
        />
      );
    }
  }

  return (
    <div className="overflow-auto rounded-lg border bg-card p-4">
      <div
        className="grid gap-1"
        style={{
          gridTemplateColumns: `repeat(${columns}, 3rem)`,
        }}
      >
        {cells}
      </div>
    </div>
  );
}
