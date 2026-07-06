import { formatDateTime } from '../../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface AlertItem {
  id: number;
  type: 'warning' | 'error' | 'info';
  title: string;
  message: string;
  createdAt: string;
}

interface AlertSectionProps {
  alerts: AlertItem[];
  onDismiss?: (id: number) => void;
}

export default function AlertSection({ alerts, onDismiss }: AlertSectionProps) {
  const alertStyles = {
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };

  const alertIcons = {
    warning: '⚠️',
    error: '❌',
    info: 'ℹ️',
  };

  if (alerts.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Thông báo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`flex items-start gap-3 rounded-lg border p-3 ${alertStyles[alert.type]}`}
          >
            <span className="text-xl">{alertIcons[alert.type]}</span>
            <div className="flex-1">
              <div className="font-medium">{alert.title}</div>
              <div className="text-sm opacity-80">{alert.message}</div>
              <div className="mt-1 text-xs opacity-60">
                {formatDateTime(alert.createdAt)}
              </div>
            </div>
            {onDismiss && (
              <button
                onClick={() => onDismiss(alert.id)}
                className="text-sm opacity-60 hover:opacity-100"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
