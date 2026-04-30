interface CapacityWarningProps {
  current: number;
  max: number;
  threshold?: number;
}

export function CapacityWarning({ current, max, threshold = 80 }: CapacityWarningProps) {
  const percentage = max > 0 ? (current / max) * 100 : 0;
  
  if (percentage >= threshold) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span>Kho đã sử dụng {percentage.toFixed(1)}%</span>
      </div>
    );
  }
  
  return null;
}
