type BarcodeLabelItem = {
  categoryName: string;
  productName?: string;
  barcodeValue: string;
  salePrice: number;
  quantity: number;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN').format(value) + ' VND';
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Open print window with barcode labels sized exactly 50mm x 30mm.
 * Layout: 2 labels per row, matching thermal printer template.
 */
export function openBarcodePrintWindow(items: BarcodeLabelItem[]) {
  const labels = items.flatMap((item) =>
    Array.from({ length: Math.max(item.quantity, 0) }, () => item),
  );

  if (labels.length === 0) return;

  const printWindow = window.open('', '_blank', 'width=1100,height=780');
  if (!printWindow) return;

  const html = `<!doctype html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <title>In tem ma vach</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Libre+Barcode+128&display=swap" rel="stylesheet">
  <style>
    @page {
      size: auto;
      margin: 2mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', Arial, sans-serif;
      background: #f1f5f9;
      padding: 8px;
    }
    .sheet {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      justify-content: center;
    }
    .label {
      width: 50mm;
      height: 30mm;
      border: 1px solid #333;
      background: #fff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      text-align: center;
      padding: 1mm 2mm;
      overflow: hidden;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .name {
      font-size: 6pt;
      font-weight: 500;
      line-height: 1.2;
      width: 100%;
      word-wrap: break-word;
      flex-shrink: 0;
    }
    .barcode {
      font-family: 'Libre Barcode 128', cursive;
      font-size: 24pt;
      line-height: 0.9;
      max-width: 100%;
      overflow: hidden;
      flex-shrink: 1;
      min-height: 0;
    }
    .sku {
      font-size: 5.5pt;
      font-weight: 600;
      color: #111;
      flex-shrink: 0;
    }
    .price {
      font-size: 8pt;
      font-weight: 700;
      color: #000;
      flex-shrink: 0;
    }
    @media print {
      body { background: white; padding: 0; }
      .sheet { gap: 0; }
      .label { border-color: #000; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    ${labels.map((item) => `
      <div class="label">
        <div class="name">${escapeHtml(item.productName || item.categoryName)}</div>
        <div class="barcode">${escapeHtml(item.barcodeValue)}</div>
        <div class="sku">${escapeHtml(item.barcodeValue)}</div>
        <div class="price">${formatCurrency(item.salePrice)}</div>
      </div>
    `).join('')}
  </div>
  <script>
    window.onload = () => { window.focus(); window.print(); };
  <\/script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
