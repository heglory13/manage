import { Button } from '../ui/button';

interface PeriodToggleProps {
  value: 'today' | 'week' | 'month' | 'quarter' | 'year';
  onChange: (value: 'today' | 'week' | 'month' | 'quarter' | 'year') => void;
}

const options = [
  { value: 'today', label: 'Hôm nay' },
  { value: 'week', label: 'Tuần' },
  { value: 'month', label: 'Tháng' },
  { value: 'quarter', label: 'Quý' },
  { value: 'year', label: 'Năm' },
] as const;

export default function PeriodToggle({ value, onChange }: PeriodToggleProps) {
  return (
    <div className="inline-flex rounded-md shadow-sm" role="group">
      {options.map((opt) => (
        <Button
          key={opt.value}
          variant={value === opt.value ? 'default' : 'outline'}
          size="sm"
          onClick={() => onChange(opt.value)}
          className={`rounded-none first:rounded-l-md last:rounded-r-md ${value === opt.value ? '' : 'border-l-0'}`}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}
