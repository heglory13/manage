import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface DetailedCheckFormProps {
  positions: { id: number; code: string; expected: number }[];
  onSubmit: (results: { positionId: number; actual: number; notes?: string }[]) => void;
  onCancel: () => void;
}

export default function DetailedCheckForm({ positions, onSubmit, onCancel }: DetailedCheckFormProps) {
  const [results, setResults] = useState<Record<number, { actual: number; notes: string }>>({});

  const handleSubmit = () => {
    const data = positions.map(pos => ({
      positionId: pos.id,
      actual: results[pos.id]?.actual ?? pos.expected,
      notes: results[pos.id]?.notes,
    }));
    onSubmit(data);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kiểm tra chi tiết</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-h-96 overflow-auto rounded border">
          <table className="w-full text-sm">
            <thead className="bg-muted sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left">Vị trí</th>
                <th className="px-3 py-2 text-right">Tồn kho</th>
                <th className="px-3 py-2 text-right">Thực tế</th>
                <th className="px-3 py-2 text-left">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {positions.map(pos => (
                <tr key={pos.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{pos.code}</td>
                  <td className="px-3 py-2 text-right">{pos.expected}</td>
                  <td className="px-3 py-2 text-right">
                    <Input
                      type="number"
                      min={0}
                      defaultValue={pos.expected}
                      onChange={e => setResults(prev => ({
                        ...prev,
                        [pos.id]: { ...prev[pos.id], actual: Number(e.target.value), notes: prev[pos.id]?.notes || '' }
                      }))}
                      className="w-20 text-right"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      placeholder="Ghi chú..."
                      onChange={e => setResults(prev => ({
                        ...prev,
                        [pos.id]: { ...prev[pos.id], actual: prev[pos.id]?.actual ?? pos.expected, notes: e.target.value }
                      }))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            Hủy
          </Button>
          <Button onClick={handleSubmit}>
            Hoàn thành kiểm tra
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
