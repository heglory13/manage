import { useState } from 'react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import * as XLSX from 'xlsx';

interface ExcelImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (data: any[]) => Promise<void>;
  templateColumns: string[];
}

export default function ExcelImportDialog({
  open,
  onClose,
  onImport,
  templateColumns,
}: ExcelImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const workbook = XLSX.read(event.target?.result, { type: 'binary' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      setData(jsonData);
    };
    reader.readAsBinaryString(selectedFile);
  };

  const handleImport = async () => {
    if (data.length === 0) return;
    setIsLoading(true);
    try {
      await onImport(data);
      onClose();
      setFile(null);
      setData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([{}]);
    templateColumns.forEach((col, idx) => {
      XLSX.utils.sheet_add_aoa(ws, [[col]], { origin: `A1` });
    });
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'import-template.xlsx');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nhập từ Excel</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadTemplate}>
              Tải mẫu
            </Button>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
              id="excel-file"
            />
            <label htmlFor="excel-file">
              <Button variant="outline" as="span" className="cursor-pointer">
                Chọn file
              </Button>
            </label>
          </div>

          {file && (
            <div className="text-sm">
              <p>File: {file.name}</p>
              <p>Số dòng: {data.length}</p>
            </div>
          )}

          {data.length > 0 && (
            <div className="max-h-64 overflow-auto rounded border">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    {Object.keys(data[0] || {}).map(key => (
                      <th key={key} className="px-3 py-2 text-left">{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.slice(0, 10).map((row, idx) => (
                    <tr key={idx} className="border-t">
                      {Object.values(row).map((val, i) => (
                        <td key={i} className="px-3 py-2">{String(val)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.length > 10 && (
                <p className="p-2 text-center text-sm text-muted-foreground">
                  ... và {data.length - 10} dòng khác
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button onClick={handleImport} disabled={data.length === 0 || isLoading}>
              {isLoading ? 'Đang nhập...' : 'Nhập dữ liệu'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
