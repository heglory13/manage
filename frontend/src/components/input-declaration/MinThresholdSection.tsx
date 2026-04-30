import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useState } from 'react';

interface MinThresholdSectionProps {
  skuCombos: { sku: string; productName: string; minThreshold: number }[];
  onUpdateThreshold: (sku: string, threshold: number) => void;
}

export default function MinThresholdSection({ skuCombos, onUpdateThreshold }: MinThresholdSectionProps) {
  const [editingSku, setEditingSku] = useState<string | null>(null);
  const [editValue, setEditValue] = useState(0);

  const handleStartEdit = (sku: string, currentValue: number) => {
    setEditingSku(sku);
    setEditValue(currentValue);
  };

  const handleSave = (sku: string) => {
    onUpdateThreshold(sku, editValue);
    setEditingSku(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ngưỡng tồn kho tối thiểu</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Tên sản phẩm</TableHead>
              <TableHead className="text-right">Ngưỡng tối thiểu</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {skuCombos.map(combo => (
              <TableRow key={combo.sku}>
                <TableCell className="font-medium">{combo.sku}</TableCell>
                <TableCell>{combo.productName}</TableCell>
                <TableCell className="text-right">
                  {editingSku === combo.sku ? (
                    <Input
                      type="number"
                      min={0}
                      value={editValue}
                      onChange={e => setEditValue(Number(e.target.value))}
                      className="w-24 text-right"
                      onKeyDown={e => e.key === 'Enter' && handleSave(combo.sku)}
                    />
                  ) : (
                    combo.minThreshold
                  )}
                </TableCell>
                <TableCell>
                  {editingSku === combo.sku ? (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => handleSave(combo.sku)}>
                        Lưu
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingSku(null)}>
                        Hủy
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => handleStartEdit(combo.sku, combo.minThreshold)}>
                      Sửa
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {skuCombos.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Chưa có SKU nào
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
