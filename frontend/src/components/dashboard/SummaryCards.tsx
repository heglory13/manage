import { formatNumber } from '../../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface SummaryCardsProps {
  data: {
    total: number;
    difference: number;
    differencePercent: number;
    lastPeriod: number;
  };
  title: string;
}

export default function SummaryCards({ data, title }: SummaryCardsProps) {
  const isPositive = data.difference >= 0;
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{formatNumber(data.total)}</div>
        <div className={`mt-1 text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {isPositive ? '+' : ''}{formatNumber(data.difference)} ({data.differencePercent.toFixed(1)}%)
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          Kỳ trước: {formatNumber(data.lastPeriod)}
        </div>
      </CardContent>
    </Card>
  );
}
