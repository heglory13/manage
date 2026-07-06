export function generatePositionCode(warehouseCode: string, zoneName: string, row: number, col: number): string {
  const zonePrefix = zoneName.substring(0, 2).toUpperCase();
  return `${warehouseCode}-${zonePrefix}-R${row.toString().padStart(2, '0')}C${col.toString().padStart(2, '0')}`;
}

export function calculateZoneCapacity(rows: number, cols: number, maxCapacityPerPosition: number): number {
  return rows * cols * maxCapacityPerPosition;
}

export function getZoneColor(index: number): string {
  const colors = [
    '#ef4444', '#f97316', '#f59e0b', '#84cc16',
    '#22c55e', '#14b8a6', '#06b6d4', '#0ea5e9',
    '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7',
    '#d946ef', '#ec4899', '#f43f5e',
  ];
  return colors[index % colors.length];
}

export function isPositionInBounds(row: number, col: number, rows: number, cols: number): boolean {
  return row >= 1 && row <= rows && col >= 1 && col <= cols;
}

export function getAdjacentPositions(row: number, col: number, rows: number, cols: number): { row: number; col: number }[] {
  const directions = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
  ];
  
  return directions
    .map(([dr, dc]) => ({ row: row + dr, col: col + dc }))
    .filter(p => isPositionInBounds(p.row, p.col, rows, cols));
}
