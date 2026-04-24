import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import PositionCell from './PositionCell';

interface WarehouseGridProps {
  rows: number;
  columns: number;
  positions: { [key: string]: { zoneColor?: string; zoneName?: string; isActive?: boolean } };
  selectedPosition: { row: number; col: number } | null;
  onPositionClick: (row: number, col: number) => void;
  onPositionDoubleClick?: (row: number, col: number) => void;
}

export default function WarehouseGrid({
  rows,
  columns,
  positions,
  selectedPosition,
  onPositionClick,
  onPositionDoubleClick,
}: WarehouseGridProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sơ đồ kho</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* Column headers */}
            <div className="mb-1 flex">
              <div className="w-12" /> {/* Corner cell */}
              {Array.from({ length: columns }, (_, i) => (
                <div key={i} className="flex-1 text-center text-xs text-muted-foreground">
                  C{i + 1}
                </div>
              ))}
            </div>

            {/* Grid rows */}
            {Array.from({ length: rows }, (_, rowIdx) => (
              <div key={rowIdx} className="flex">
                <div className="flex h-12 w-12 items-center justify-center text-xs text-muted-foreground">
                  R{rowIdx + 1}
                </div>
                {Array.from({ length: columns }, (_, colIdx) => {
                  const row = rowIdx + 1;
                  const col = colIdx + 1;
                  const key = `${row}-${col}`;
                  const pos = positions[key] || {};
                  const isSelected = selectedPosition?.row === row && selectedPosition?.col === col;

                  return (
                    <div
                      key={col}
                      className="flex-1 p-0.5"
                      onDoubleClick={() => onPositionDoubleClick?.(row, col)}
                    >
                      <PositionCell
                        row={row}
                        col={col}
                        zoneColor={pos.zoneColor}
                        zoneName={pos.zoneName}
                        isSelected={isSelected}
                        isActive={pos.isActive ?? true}
                        onClick={() => onPositionClick(row, col)}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
