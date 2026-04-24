import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useState } from 'react';

interface ProductConditionSectionProps {
  conditions: { id: number; name: string }[];
  onAdd: (name: string) => void;
  onDelete: (id: number) => void;
}

export default function ProductConditionSection({ conditions, onAdd, onDelete }: ProductConditionSectionProps) {
  const [newCondition, setNewCondition] = useState('');

  const handleAdd = () => {
    if (!newCondition.trim()) return;
    onAdd(newCondition.trim());
    setNewCondition('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tình trạng sản phẩm</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Thêm tình trạng sản phẩm..."
            value={newCondition}
            onChange={e => setNewCondition(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <button
            onClick={handleAdd}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Thêm
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {conditions.map(condition => (
            <div
              key={condition.id}
              className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-sm"
            >
              <span>{condition.name}</span>
              <button
                onClick={() => onDelete(condition.id)}
                className="text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            </div>
          ))}
          {conditions.length === 0 && (
            <p className="text-sm text-muted-foreground">Chưa có tình trạng nào</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
