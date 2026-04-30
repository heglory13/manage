import * as React from 'react';

interface SpreadsheetWarehouseProps {
  rows: number;
  columns: number;
  data: { [key: string]: any };
  onCellChange: (row: number, col: number, value: any) => void;
}

export default function SpreadsheetWarehouse({
  rows,
  columns,
  data,
  onCellChange,
}: SpreadsheetWarehouseProps) {
  const headerCells = [];
  for (let col = 0; col <= columns; col++) {
    if (col === 0) {
      headerCells.push(
        <th key="corner" className="w-12 border bg-muted p-2 text-center text-xs font-medium">
          #
        </th>
      );
    } else {
      headerCells.push(
        <th key={col} className="w-12 border bg-muted p-2 text-center text-xs font-medium">
          C{col}
        </th>
      );
    }
  }

  const tableRows = [];
  for (let row = 1; row <= rows; row++) {
    const cells = [
      <td key="row-header" className="border bg-muted p-2 text-center text-xs font-medium">
        R{row}
      </td>,
    ];

    for (let col = 1; col <= columns; col++) {
      const key = `${row}-${col}`;
      const cellData = data[key] || {};
      
      cells.push(
        <td
          key={col}
          className="border p-0"
          style={{ backgroundColor: cellData.zoneColor || '#f9fafb' }}
        >
          <input
            type="text"
            className="w-full border-0 bg-transparent p-2 text-center text-xs focus:ring-2 focus:ring-inset"
            defaultValue={cellData.value || ''}
            onChange={e => onCellChange(row, col, e.target.value)}
            placeholder="-"
          />
        </td>
      );
    }
    
    tableRows.push(
      <tr key={row}>
        {cells}
      </tr>
    );
  }

  return (
    <div className="overflow-auto rounded-lg border">
      <table className="border-collapse">
        <thead>
          <tr>
            {headerCells}
          </tr>
        </thead>
        <tbody>
          {tableRows}
        </tbody>
      </table>
    </div>
  );
}
