import { useState } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface SpreadsheetColumn {
  key: string;
  header: string;
  width?: number;
}

interface SpreadsheetLayoutProps {
  columns: SpreadsheetColumn[];
  data: Record<string, any>[];
  onDataChange: (data: Record<string, any>[]) => void;
}

export default function SpreadsheetLayout({ columns, data, onDataChange }: SpreadsheetLayoutProps) {
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleCellChange = (rowIndex: number, colKey: string, value: any) => {
    const newData = [...data];
    newData[rowIndex] = { ...newData[rowIndex], [colKey]: value };
    onDataChange(newData);
  };

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, 'spreadsheet-export.xlsx');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const workbook = XLSX.read(event.target?.result, { type: 'binary' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      onDataChange(jsonData);
    };
    reader.readAsBinaryString(file);
  };

  const handleDeleteRow = (rowIndex: number) => {
    const newData = data.filter((_, i) => i !== rowIndex);
    onDataChange(newData);
  };

  const handleAddRow = () => {
    const newRow: Record<string, any> = {};
    columns.forEach(col => {
      newRow[col.key] = '';
    });
    onDataChange([...data, newRow]);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Bảng dữ liệu</CardTitle>
          <div className="flex gap-2">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleImport}
              className="hidden"
              id="spreadsheet-import"
            />
            <label htmlFor="spreadsheet-import">
              <Button variant="outline" as="span" className="cursor-pointer">
                Nhập Excel
              </Button>
            </label>
            <Button variant="outline" onClick={handleExport}>
              Xuất Excel
            </Button>
            <Button onClick={handleAddRow}>
              Thêm dòng
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto rounded-lg border">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-muted">
                <th className="w-12 border p-2 text-center text-xs">#</th>
                {columns.map(col => (
                  <th
                    key={col.key}
                    className="border p-2 text-left text-xs font-medium"
                    style={{ width: col.width }}
                  >
                    {col.header}
                  </th>
                ))}
                <th className="w-16 border p-2"></th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-muted/50">
                  <td className="border p-2 text-center text-xs text-muted-foreground">
                    {rowIndex + 1}
                  </td>
                  {columns.map(col => (
                    <td key={col.key} className="border p-0">
                      {editingCell?.row === rowIndex && editingCell?.col === col.key ? (
                        <input
                          type="text"
                          className="w-full border-0 bg-background p-2 focus:ring-2 focus:ring-primary"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={() => {
                            handleCellChange(rowIndex, col.key, editValue);
                            setEditingCell(null);
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              handleCellChange(rowIndex, col.key, editValue);
                              setEditingCell(null);
                            }
                            if (e.key === 'Escape') {
                              setEditingCell(null);
                            }
                          }}
                          autoFocus
                        />
                      ) : (
                        <div
                          className="cursor-pointer p-2 hover:bg-muted/50"
                          onClick={() => {
                            setEditingCell({ row: rowIndex, col: col.key });
                            setEditValue(row[col.key] || '');
                          }}
                        >
                          {row[col.key]?.toString() || ''}
                        </div>
                      )}
                    </td>
                  ))}
                  <td className="border p-2 text-center">
                    <button
                      onClick={() => handleDeleteRow(rowIndex)}
                      className="text-red-600 hover:text-red-700"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 2} className="border p-8 text-center text-muted-foreground">
                    Chưa có dữ liệu
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
