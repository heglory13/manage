import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';

interface PreliminaryCheckFormProps {
  warehouseId: number;
  onStart: () => void;
  isLoading?: boolean;
}

export default function PreliminaryCheckForm({ warehouseId, onStart, isLoading }: PreliminaryCheckFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Kiểm tra sơ bộ</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Kiểm tra sơ bộ giúp bạn xác định nhanh các vị trí có sự chênh lệch tồn kho
          trước khi tiến hành kiểm tra chi tiết.
        </p>
        <Button onClick={onStart} disabled={isLoading}>
          {isLoading ? 'Đang khởi tạo...' : 'Bắt đầu kiểm tra sơ bộ'}
        </Button>
      </CardContent>
    </Card>
  );
}
