import { Button } from '../ui/button';

interface ExcelTemplateButtonProps {
  onDownload: () => void;
  templateName: string;
}

export default function ExcelTemplateButton({ onDownload, templateName }: ExcelTemplateButtonProps) {
  return (
    <Button variant="outline" size="sm" onClick={onDownload}>
      <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      Tải mẫu {templateName}
    </Button>
  );
}
