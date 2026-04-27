type BarcodeLabelItem = {
  productName: string;
  sku: string;
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

export function openBarcodePrintWindow(items: BarcodeLabelItem[]) {
  const labels = items.flatMap((item) =>
    Array.from({ length: Math.max(item.quantity, 0) }, () => item),
  );

  if (labels.length === 0) {
    return;
  }

  const printWindow = window.open('', '_blank', 'width=1100,height=780');
  if (!printWindow) {
    return;
  }

  const html = `
    <!doctype html>
    <html lang="vi">
      <head>
        <meta charset="UTF-8" />
        <title>In tem ma vach</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Libre+Barcode+39+Text&display=swap" rel="stylesheet">
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; padding: 16px; font-family: 'Inter', sans-serif; background: #f8fafc; }
          .sheet { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
          .label {
            background: white;
            border: 1px solid #cbd5e1;
            padding: 12px 10px;
            min-height: 142px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            text-align: center;
            break-inside: avoid;
          }
          .name { font-size: 18px; line-height: 1.2; font-weight: 500; margin-bottom: 6px; }
          .barcode { font-family: 'Libre Barcode 39 Text', cursive; font-size: 54px; line-height: 0.9; letter-spacing: 2px; margin: 6px 0 2px; }
          .sku { font-size: 13px; font-weight: 500; margin-top: 2px; }
          .price { font-size: 18px; font-weight: 700; margin-top: 8px; }
          @media print {
            body { background: white; padding: 8px; }
            .sheet { gap: 8px; }
            .label { border-color: #111827; }
          }
        </style>
      </head>
      <body>
        <div class="sheet">
          ${labels
            .map(
              (item) => `
                <div class="label">
                  <div class="name">${escapeHtml(item.productName)}</div>
                  <div class="barcode">*${escapeHtml(item.sku)}*</div>
                  <div class="sku">${escapeHtml(item.sku)}</div>
                  <div class="price">${formatCurrency(item.salePrice)}</div>
                </div>
              `,
            )
            .join('')}
        </div>
        <script>
          window.onload = () => {
            window.focus();
            window.print();
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
