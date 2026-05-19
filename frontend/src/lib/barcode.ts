import JsBarcode from 'jsbarcode';
import type { jsPDF as JsPDFType } from 'jspdf';

type BarcodeLabelItem = {
  categoryName: string;
  productName?: string;
  barcodeValue: string;
  salePrice: number;
  quantity: number; // number of ROWS to print
};

type LabelConfig = {
  labelWidthMm: number;
  labelHeightMm: number;
  cols: number;
  rowsPerPage: number;
  nameSize: string;
  skuSize: string;
  priceSize: string;
  barcodeHeight: number;
  barcodeWidth: number;
};

// rowsPerPage = 1: mỗi trang PDF là 1 hàng tem (đúng với cách máy in tem đọc từng trang)
const LABEL_CONFIGS: Record<string, LabelConfig> = {
  '72x22':  { labelWidthMm: 36,   labelHeightMm: 22, cols: 2, rowsPerPage: 1, nameSize: '6.5pt', skuSize: '6.5pt', priceSize: '8.5pt', barcodeHeight: 32, barcodeWidth: 1.2 },
  '74x22':  { labelWidthMm: 37,   labelHeightMm: 22, cols: 2, rowsPerPage: 1, nameSize: '7pt',   skuSize: '7pt',   priceSize: '9pt',   barcodeHeight: 35, barcodeWidth: 1.3 },
  '110x22': { labelWidthMm: 110/3, labelHeightMm: 22, cols: 3, rowsPerPage: 1, nameSize: '7pt',   skuSize: '6.5pt', priceSize: '9pt',   barcodeHeight: 35, barcodeWidth: 1.2 },
  '40x30':  { labelWidthMm: 40,   labelHeightMm: 30, cols: 1, rowsPerPage: 1, nameSize: '8pt',   skuSize: '7.5pt', priceSize: '10pt',  barcodeHeight: 40, barcodeWidth: 1.5 },
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

function generateBarcodeSvg(value: string, width = 1.5, height = 40): string {
  const svgNs = 'http://www.w3.org/2000/svg';
  const doc = document.implementation.createDocument(svgNs, 'svg', null);
  const svg = doc.documentElement;
  svg.setAttribute('xmlns', svgNs);

  try {
    JsBarcode(svg, value, {
      format: 'CODE128',
      width,
      height,
      displayValue: false,
      margin: 0,
      background: 'transparent',
    });
  } catch {
    return `<span style="font-size:8pt;color:#999;">[${value}]</span>`;
  }

  return new XMLSerializer().serializeToString(svg);
}

function generateBarcodeDataUrl(value: string, barcodeWidth: number, barcodeHeight: number): string {
  const canvas = document.createElement('canvas');
  try {
    JsBarcode(canvas, value, {
      format: 'CODE128',
      width: barcodeWidth * 6, // 6× for ultra-sharp barcode bars
      height: barcodeHeight * 6,
      displayValue: false,
      margin: 0,
      background: '#ffffff',
    });
    return canvas.toDataURL('image/png');
  } catch {
    return '';
  }
}

// ─── Vector PDF helpers ───────────────────────────────────────────────────────

const MM_PER_PT = 25.4 / 72; // 1pt = 0.35278mm

// NotoSans font cache — fetched once per session, reused across all PDF generations
let _fontCache: { normal: string; bold: string } | null = null;

// Fonts already injected into document.fonts for on-screen preview rendering
const _browserFontLoaded = new Set<string>();

// Custom TTF font data cache — keyed by CSS font-family name (e.g. "Montserrat")
// Maps family → { normal: base64, bold: base64 } | null (null = not available)
const _customFontCache = new Map<string, { normal: string; bold: string } | null>();

// Map CSS font-family → file name prefix in public/fonts/
const FONT_FILE_MAP: Record<string, string> = {
  'Roboto':             'Roboto',
  'Lato':               'Lato',
  'Montserrat':         'Montserrat',
  'Poppins':            'Poppins',
  'Raleway':            'Raleway',
  'Oswald':             'Oswald',
  'Nunito':             'Nunito',
  'Ubuntu':             'Ubuntu',
  'Playfair Display':   'PlayfairDisplay',
  'Cormorant Garamond': 'CormorantGaramond',
  'Cinzel':             'Cinzel',
  'Bebas Neue':         'BebasNeue',
  'Pacifico':           'Pacifico',
  'Dancing Script':     'DancingScript',
  'Source Code Pro':    'SourceCodePro',
  'UTM AVO':            'UTMAvo',
  'Arkhip':             'Arkhip',
};

/**
 * Load a custom TTF font into the browser's FontFace registry so CSS
 * `fontFamily` inline styles immediately reflect the selected font in previews.
 * System fonts (Arial, Georgia, Impact, Courier New) are skipped.
 */
export async function loadFontForPreview(family: string): Promise<void> {
  if (!family || _browserFontLoaded.has(family)) return;
  const prefix = FONT_FILE_MAP[family];
  if (!prefix) return; // system font or unknown — browser already has it

  const base = (import.meta.env.BASE_URL ?? '/').replace(/\/?$/, '/');

  await Promise.allSettled([
    (async () => {
      try {
        const face = new FontFace(family, `url(${base}fonts/${prefix}-400.ttf)`);
        await face.load();
        document.fonts.add(face);
      } catch { /* file may not exist */ }
    })(),
    (async () => {
      try {
        const face = new FontFace(family, `url(${base}fonts/${prefix}-700.ttf)`, { weight: '700' });
        await face.load();
        document.fonts.add(face);
      } catch { /* file may not exist */ }
    })(),
  ]);

  _browserFontLoaded.add(family);
}

async function fetchTtfBase64(relativePath: string): Promise<string | null> {
  // Use Vite's BASE_URL so paths work correctly in any deployment subdirectory
  const base = (import.meta.env.BASE_URL ?? '/').replace(/\/?$/, '/');
  const url = base + relativePath.replace(/^\//, '');
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return arrayBufferToBase64(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function getCustomFontData(family: string): Promise<{ normal: string; bold: string } | null> {
  if (_customFontCache.has(family)) return _customFontCache.get(family)!;

  const prefix = FONT_FILE_MAP[family];
  if (!prefix) { _customFontCache.set(family, null); return null; }

  const [normal, bold] = await Promise.all([
    fetchTtfBase64(`fonts/${prefix}-400.ttf`),
    fetchTtfBase64(`fonts/${prefix}-700.ttf`),
  ]);

  if (!normal) { _customFontCache.set(family, null); return null; }

  const data = { normal, bold: bold ?? normal };
  _customFontCache.set(family, data);
  return data;
}

// Register a custom font into a specific jsPDF instance.
// Returns the font name to use with setFont(), or 'NotoSans' as fallback.
async function resolveLogoFont(pdf: JsPDFType, family: string): Promise<string> {
  const data = await getCustomFontData(family);
  if (!data) return 'NotoSans';

  const prefix = FONT_FILE_MAP[family]!;

  // Register fonts — each step individually guarded.
  // "Already in VFS / already registered" errors on the second PDF generation are fine.
  try { pdf.addFileToVFS(`${prefix}-n.ttf`, data.normal); } catch { /* already in VFS */ }
  try { pdf.addFont(`${prefix}-n.ttf`, family, 'normal'); } catch { /* already registered */ }
  try { pdf.addFileToVFS(`${prefix}-b.ttf`, data.bold);   } catch { /* already in VFS */ }
  try { pdf.addFont(`${prefix}-b.ttf`, family, 'bold');   } catch { /* already registered */ }

  // jsPDF reports TTF parse failures via its internal PubSub (no thrown JS exception),
  // so addFont above may silently leave font metrics undefined.
  // Verify BOTH weights with a multi-char string — single ASCII may slip through broken metrics.
  try {
    pdf.setFont(family, 'normal');
    pdf.getTextWidth('ABCDEFGabcdefg0123456789');
    pdf.setFont(family, 'bold');
    pdf.getTextWidth('ABCDEFGabcdefg0123456789');
    return family;
  } catch {
    return 'NotoSans';
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += 8192) {
    chunks.push(String.fromCharCode(...Array.from(bytes.subarray(i, i + 8192))));
  }
  return btoa(chunks.join(''));
}

async function loadVietnameseFonts(pdf: JsPDFType): Promise<void> {
  if (!_fontCache) {
    const base = (import.meta.env.BASE_URL ?? '/').replace(/\/?$/, '/');
    const [normalBuf, boldBuf] = await Promise.all([
      fetch(`${base}fonts/NotoSans-Regular.ttf`).then((r) => r.arrayBuffer()),
      fetch(`${base}fonts/NotoSans-Bold.ttf`).then((r) => r.arrayBuffer()),
    ]);
    _fontCache = { normal: arrayBufferToBase64(normalBuf), bold: arrayBufferToBase64(boldBuf) };
  }
  // Guard: addFileToVFS throws if the same key already exists in this pdf's VFS
  try { pdf.addFileToVFS('NotoSans-Regular.ttf', _fontCache.normal); } catch { /* already added */ }
  try { pdf.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal'); } catch { /* already registered */ }
  try { pdf.addFileToVFS('NotoSans-Bold.ttf', _fontCache.bold); } catch { /* already added */ }
  try { pdf.addFont('NotoSans-Bold.ttf', 'NotoSans', 'bold'); } catch { /* already registered */ }
}

function parseBarcodeRects(
  value: string,
  barcodeWidth: number,
  barcodeHeight: number,
): { bars: Array<{ x: number; y: number; w: number; h: number }>; svgW: number; svgH: number } {
  const svgNs = 'http://www.w3.org/2000/svg';
  const xmlDoc = document.implementation.createDocument(svgNs, 'svg', null);
  const svgEl = xmlDoc.documentElement;
  svgEl.setAttribute('xmlns', svgNs);
  try {
    JsBarcode(svgEl, value, {
      format: 'CODE128',
      width: barcodeWidth,
      height: barcodeHeight,
      displayValue: false,
      margin: 0,
      background: '#ffffff',
    });
  } catch {
    return { bars: [], svgW: 0, svgH: 0 };
  }

  // Serialize then re-parse via innerHTML — ensures querySelectorAll works reliably
  // (XML document querySelectorAll can miss namespaced elements in some browsers)
  const svgString = new XMLSerializer().serializeToString(svgEl);
  const div = document.createElement('div');
  div.innerHTML = svgString;
  const svg = div.querySelector('svg');
  if (!svg) return { bars: [], svgW: 0, svgH: 0 };

  const svgW = parseFloat(svg.getAttribute('width') || '0');
  const svgH = parseFloat(svg.getAttribute('height') || '0');

  const bars: Array<{ x: number; y: number; w: number; h: number }> = [];
  for (const rect of svg.querySelectorAll('rect')) {
    const fill  = rect.getAttribute('fill')  ?? '';
    const style = rect.getAttribute('style') ?? '';
    // Skip white background rects (JsBarcode's first rect is always the background)
    const isWhite =
      fill === '#ffffff' || fill === 'white' || fill === '#fff' ||
      style.includes('255,255,255') || style.includes('#ffffff') || style.includes('#fff');
    if (isWhite) continue;
    const w = parseFloat(rect.getAttribute('width')  || '0');
    const h = parseFloat(rect.getAttribute('height') || '0');
    if (w > 0 && h > 0) {
      bars.push({
        x: parseFloat(rect.getAttribute('x') || '0'),
        y: parseFloat(rect.getAttribute('y') || '0'),
        w,
        h,
      });
    }
  }
  return { bars, svgW, svgH };
}

function drawLabelVector(
  pdf: JsPDFType,
  name: string,
  sku: string,
  price: string,
  cfg: LabelConfig,
  xMm: number,
  yMm: number,
): void {
  const pad = 1.8;
  const namePt   = parseFloat(cfg.nameSize);
  const skuPt    = parseFloat(cfg.skuSize);
  const pricePt  = parseFloat(cfg.priceSize);
  const nameHMm  = namePt  * MM_PER_PT;
  const nameLineHMm = nameHMm * 1.25;
  const skuHMm   = skuPt   * MM_PER_PT;
  const priceHMm = pricePt * MM_PER_PT;

  // Name
  pdf.setFont('NotoSans', 'normal');
  pdf.setFontSize(namePt);
  pdf.setTextColor(0);
  const nameLines = (pdf.splitTextToSize(name, cfg.labelWidthMm - pad * 2) as string[]).slice(0, 2);
  nameLines.forEach((line, i) => {
    pdf.text(line, xMm + pad, yMm + pad + nameLineHMm * i + nameHMm, {
      baseline: 'bottom',
      maxWidth: cfg.labelWidthMm - pad * 2,
    });
  });

  const nameBlockH   = pad + nameLineHMm * nameLines.length + pad * 0.5;
  const bottomBlockH = skuHMm * 1.35 + priceHMm * 1.4 + pad;
  const barcodeAreaY = yMm + nameBlockH;
  const barcodeAreaH = cfg.labelHeightMm - nameBlockH - bottomBlockH;
  const barcodeAreaX = xMm + pad;
  const barcodeAreaW = cfg.labelWidthMm - pad * 2;

  // Barcode — vector rects (infinitely sharp at any zoom)
  if (barcodeAreaH > 1) {
    const { bars, svgW, svgH } = parseBarcodeRects(sku, cfg.barcodeWidth, cfg.barcodeHeight);
    if (bars.length > 0 && svgW > 0 && svgH > 0) {
      const sx = barcodeAreaW / svgW;
      const sy = barcodeAreaH / svgH;
      pdf.setFillColor(0);
      for (const bar of bars) {
        pdf.rect(barcodeAreaX + bar.x * sx, barcodeAreaY + bar.y * sy, bar.w * sx, bar.h * sy, 'F');
      }
    }
  }

  // SKU
  const skuBottomY = yMm + cfg.labelHeightMm - priceHMm * 1.4 - pad * 0.3;
  pdf.setFont('NotoSans', 'bold');
  pdf.setFontSize(skuPt);
  pdf.setTextColor(0);
  pdf.text(sku, xMm + cfg.labelWidthMm / 2, skuBottomY, {
    align: 'center',
    baseline: 'bottom',
    maxWidth: cfg.labelWidthMm - pad * 2,
  });

  // Price
  pdf.setFont('NotoSans', 'bold');
  pdf.setFontSize(pricePt);
  pdf.text(price, xMm + cfg.labelWidthMm / 2, yMm + cfg.labelHeightMm - pad * 0.3, {
    align: 'center',
    baseline: 'bottom',
    maxWidth: cfg.labelWidthMm - pad * 2,
  });
}

// ─────────────────────────────────────────────────────────────────────────────

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

async function renderLabelCanvas(
  name: string,
  sku: string,
  price: string,
  barcodeDataUrl: string,
  cfg: LabelConfig,
): Promise<HTMLCanvasElement> {
  const SCALE = 8; // 8× = ~768 DPI — excellent print quality, ~25× smaller than SCALE=40
  const PX_PER_MM = 3.7795;

  const wPx = Math.round(cfg.labelWidthMm * PX_PER_MM * SCALE);
  const hPx = Math.round(cfg.labelHeightMm * PX_PER_MM * SCALE);

  const canvas = document.createElement('canvas');
  canvas.width = wPx;
  canvas.height = hPx;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, wPx, hPx);

  const pad = 1.8 * PX_PER_MM * SCALE;
  const PT_TO_PX = (96 / 72) * SCALE;

  const namePx  = parseFloat(cfg.nameSize)  * PT_TO_PX;
  const skuPx   = parseFloat(cfg.skuSize)   * PT_TO_PX;
  const pricePx = parseFloat(cfg.priceSize) * PT_TO_PX;

  // === Name (top) ===
  ctx.font = `500 ${namePx}px Arial, sans-serif`;
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const nameLineH = namePx * 1.25;
  const nameLines = wrapText(ctx, name, wPx - pad * 2);
  nameLines.slice(0, 2).forEach((line, i) => {
    ctx.fillText(line, pad, pad + nameLineH * i, wPx - pad * 2);
  });
  const nameBlockH = pad + nameLineH * Math.min(nameLines.length, 2) + pad * 0.5;

  // === Barcode (middle) ===
  const bottomBlockH = skuPx * 1.35 + pricePx * 1.4 + pad;
  const barcodeY = nameBlockH;
  const barcodeH = hPx - nameBlockH - bottomBlockH;

  if (barcodeDataUrl && barcodeH > 5) {
    await new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, pad, barcodeY, wPx - pad * 2, barcodeH);
        resolve();
      };
      img.onerror = () => resolve();
      img.src = barcodeDataUrl;
    });
  }

  // === SKU ===
  ctx.font = `bold ${skuPx}px "Courier New", monospace`;
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  const skuY = hPx - pricePx * 1.4 - pad * 0.3;
  ctx.fillText(sku, wPx / 2, skuY, wPx - pad * 2);

  // === Price ===
  ctx.font = `900 ${pricePx}px Arial, sans-serif`;
  ctx.fillText(price, wPx / 2, hPx - pad * 0.3, wPx - pad * 2);

  applyBWThreshold(canvas);
  return canvas;
}

// ─── Custom label (in tem tùy chỉnh) ─────────────────────────────────────────

export type CustomLabelData = {
  client: string;
  product: string;
  size: string;
  material: string;
  origin: string;
  website: string;
  slogan: string;
  // Logo text config (replaces logoImage)
  logoLine1: string;          // e.g., "HAVIAS"
  logoLine2: string;          // e.g., "Factory" — optional, can be empty
  logoFontFamily: string;     // font for line 1
  logoLine2FontFamily: string; // font for line 2 (can differ from line 1)
  logoLine1Weight: number;    // CSS font-weight: 400 | 700 | 900
  logoLine2Weight: number;    // CSS font-weight: 300 | 400 | 700
  // Footer style (replaces footerImage)
  sloganWeight: number;     // 400 | 700 | 900
  // Per-field font overrides for footer
  websiteFontFamily?: string;
  websiteWeight?: number;
  sloganFontFamily?: string;
  // Extra QR image (kept as-is)
  extraImage?: string;
};

// Mỗi page PDF = 1 hàng tem — giống barcode. Height = chiều cao thực của tem.
const CUSTOM_LABEL_CONFIGS: Record<string, { labelWidthMm: number; labelHeightMm: number; cols: number }> = {
  '40x30':  { labelWidthMm: 40,      labelHeightMm: 30, cols: 1 },
  '72x22':  { labelWidthMm: 36,      labelHeightMm: 22, cols: 2 },
  '74x22':  { labelWidthMm: 37,      labelHeightMm: 22, cols: 2 },
  '80':     { labelWidthMm: 80,      labelHeightMm: 80, cols: 1 },
  '110x22': { labelWidthMm: 110 / 3, labelHeightMm: 22, cols: 3 },
};

function applyBWThreshold(canvas: HTMLCanvasElement, threshold = 180): void {
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    const bw = gray < threshold ? 0 : 255;
    d[i] = bw; d[i + 1] = bw; d[i + 2] = bw;
  }
  ctx.putImageData(imageData, 0, 0);
}

function loadImageEl(src: string): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Renders the logo header (line1 + line2) to a 600-DPI canvas using CSS web fonts.
// Returns a PNG data URL for embedding in jsPDF — always matches the on-screen preview.
async function renderLogoHeaderCanvas(
  data: CustomLabelData,
  labelWidthMm: number,
  labelHeightMm: number,
): Promise<string> {
  const PX_PER_MM = 600 / 25.4; // 600 DPI

  // Mirror layout from drawCustomLabelVector so the PDF header height is identical
  const haviasMm        = Math.max(3.5, labelHeightMm * 0.165);
  const factoryMm       = Math.max(1.8, labelHeightMm * 0.090);
  const brandGapMm      = Math.max(0.2, labelHeightMm * 0.008);
  const headerContentMm = haviasMm + brandGapMm
    + (data.logoLine2 ? factoryMm : 0)
    + Math.max(0.4, labelHeightMm * 0.012);

  const wPx = Math.ceil(labelWidthMm    * PX_PER_MM);
  const hPx = Math.ceil(headerContentMm * PX_PER_MM);

  const canvas = document.createElement('canvas');
  canvas.width  = wPx;
  canvas.height = hPx;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, wPx, hPx);

  const line2Font = data.logoLine2FontFamily || data.logoFontFamily;
  await Promise.allSettled([
    data.logoFontFamily ? document.fonts.load(`${data.logoLine1Weight} 16px "${data.logoFontFamily}"`) : Promise.resolve(),
    line2Font ? document.fonts.load(`${data.logoLine2Weight} 16px "${line2Font}"`) : Promise.resolve(),
  ]);

  const haviasPx   = Math.round(haviasMm   * PX_PER_MM);
  const factoryPx  = Math.round(haviasPx   * 0.55);
  const gapPx      = Math.round(brandGapMm * PX_PER_MM);
  const line2H     = data.logoLine2 ? factoryPx + gapPx : 0;
  const totalTextH = haviasPx + line2H;
  const textStartY = Math.round((hPx - totalTextH) / 2);

  ctx.textBaseline = 'top';

  ctx.font = `${data.logoLine1Weight} ${haviasPx}px "${data.logoFontFamily}", sans-serif`;
  const line1Width = data.logoLine1 ? ctx.measureText(data.logoLine1).width : 0;
  const blockLeft  = Math.round((wPx - line1Width) / 2);

  if (data.logoLine1) {
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    ctx.fillText(data.logoLine1, blockLeft, textStartY);
  }

  if (data.logoLine2) {
    ctx.font      = `${data.logoLine2Weight} ${factoryPx}px "${line2Font}", sans-serif`;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'right';
    ctx.fillText(data.logoLine2, blockLeft + line1Width, textStartY + haviasPx + gapPx);
  }

  return canvas.toDataURL('image/png');
}

// Renders the footer (website + slogan) to a 600-DPI canvas using CSS web fonts.
async function renderFooterCanvas(
  data: CustomLabelData,
  labelWidthMm: number,
  labelHeightMm: number,
): Promise<string> {
  const PX_PER_MM = 600 / 25.4;

  const websiteMm       = Math.max(1.1, labelHeightMm * 0.038);
  const sloganMm        = Math.max(1.5, labelHeightMm * 0.055);
  const footerContentMm = data.website ? websiteMm * 1.35 + sloganMm : sloganMm;

  const wPx = Math.ceil(labelWidthMm    * PX_PER_MM);
  const hPx = Math.ceil(footerContentMm * PX_PER_MM);

  const canvas = document.createElement('canvas');
  canvas.width  = wPx;
  canvas.height = hPx;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, wPx, hPx);

  const _webFont    = data.websiteFontFamily || data.logoFontFamily;
  const _webWeight  = data.websiteWeight ?? 400;
  const _slogFont   = data.sloganFontFamily || data.logoFontFamily;
  if (_webFont) {
    await Promise.allSettled([
      document.fonts.load(`${_webWeight} 16px "${_webFont}"`),
    ]);
  }
  if (_slogFont && _slogFont !== _webFont) {
    await Promise.allSettled([
      document.fonts.load(`${data.sloganWeight} 16px "${_slogFont}"`),
    ]);
  }

  ctx.textAlign = 'center';
  let fy = 0;

  if (data.website) {
    const webPx = Math.round(websiteMm * PX_PER_MM);
    ctx.font         = `${_webWeight} ${webPx}px "${_webFont}", sans-serif`;
    ctx.fillStyle    = '#999999';
    ctx.textBaseline = 'top';
    ctx.fillText(data.website, wPx / 2, fy);
    fy += Math.round(websiteMm * 1.35 * PX_PER_MM);
  }

  const sloganPx = Math.round(sloganMm * PX_PER_MM);
  ctx.font         = `${data.sloganWeight} ${sloganPx}px "${_slogFont}", sans-serif`;
  ctx.fillStyle    = '#000000';
  ctx.textBaseline = 'top';
  ctx.fillText(`── ${data.slogan} ──`, wPx / 2, fy);

  return canvas.toDataURL('image/png');
}

async function renderCustomLabelCanvas(
  data: CustomLabelData,
  labelWidthMm: number,
  labelHeightMm: number,
): Promise<HTMLCanvasElement> {
  const SCALE = 8; // 8× = ~768 DPI — sufficient for printing, much smaller file
  const PX_PER_MM = 3.7795;
  const px = (mm: number) => Math.round(mm * PX_PER_MM * SCALE);

  // Wait for web fonts to be ready before drawing on canvas
  const _line2Font = data.logoLine2FontFamily || data.logoFontFamily;
  await Promise.allSettled([
    data.logoFontFamily ? document.fonts.load(`900 16px "${data.logoFontFamily}"`) : Promise.resolve(),
    data.logoFontFamily ? document.fonts.load(`700 16px "${data.logoFontFamily}"`) : Promise.resolve(),
    data.logoFontFamily ? document.fonts.load(`400 16px "${data.logoFontFamily}"`) : Promise.resolve(),
    _line2Font && _line2Font !== data.logoFontFamily ? document.fonts.load(`${data.logoLine2Weight} 16px "${_line2Font}"`) : Promise.resolve(),
  ]);

  const wPx = px(labelWidthMm);
  const hPx = px(labelHeightMm);

  const canvas = document.createElement('canvas');
  canvas.width = wPx;
  canvas.height = hPx;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, wPx, hPx);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const extraImg = await loadImageEl(data.extraImage ?? '');

  // ── Layout — tỉ lệ theo labelHeightMm, khớp mẫu HAVIAS Factory ────────────
  const padMm     = Math.max(0.8,  labelHeightMm * 0.028);
  const divLineMm = 0.28;
  const divGapMm  = Math.max(0.3,  labelHeightMm * 0.012);

  // Header: logo line1 (đậm) + logo line2 (nhẹ) — text-based
  const haviasMm  = Math.max(3.5,  labelHeightMm * 0.165);
  const factoryMm = Math.max(1.8,  labelHeightMm * 0.090);
  const brandGapMm = Math.max(0.2, labelHeightMm * 0.008);
  const headerContentMm = haviasMm + brandGapMm
    + (data.logoLine2 ? factoryMm : 0)
    + Math.max(0.4, labelHeightMm * 0.012);
  const headerEndGapMm = Math.max(0.3, labelHeightMm * 0.010);

  // Footer: website (nhỏ) + slogan (đậm) — text-based
  const websiteMm  = Math.max(1.1, labelHeightMm * 0.038);
  const sloganMm   = Math.max(1.5, labelHeightMm * 0.055);
  const footerContentMm = data.website ? websiteMm * 1.35 + sloganMm : sloganMm;

  // Phân bổ 5 dòng dữ liệu từ không gian còn lại
  const sectionSepMm = divGapMm * 2 + divLineMm;
  const fixedMm = padMm * 2 + headerContentMm + headerEndGapMm
                + sectionSepMm * 2 + footerContentMm;
  const numDataRows = 5;
  const rowMm = Math.max(2, (labelHeightMm - fixedMm) / numDataRows);

  const rowH      = px(rowMm);
  const keyColPx  = px(Math.min(labelWidthMm * 0.28, 16));
  const pad       = px(padMm);
  const rowFontPx = Math.round(Math.min(
    rowH * 0.52,
    px(Math.max(1.6, labelWidthMm * 0.036)),
  ));

  let y = pad;

  // ── Header ─────────────────────────────────────────────────────────────────
  {
    const haviasPx  = px(haviasMm);
    const factoryPx = Math.round(haviasPx * 0.55);
    const gapPx     = px(brandGapMm);
    const line2H    = data.logoLine2 ? factoryPx + gapPx : 0;
    const totalTextH = haviasPx + line2H;
    const blockH    = px(headerContentMm);
    const textStartY = y + Math.round((blockH - totalTextH) / 2);

    ctx.textBaseline = 'top';

    // Line 1 — measure width to center the block
    ctx.font = `${data.logoLine1Weight} ${haviasPx}px "${data.logoFontFamily}", sans-serif`;
    const line1Width = data.logoLine1 ? ctx.measureText(data.logoLine1).width : 0;
    const blockLeft = Math.round((wPx - line1Width) / 2);

    if (data.logoLine1) {
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'left';
      ctx.fillText(data.logoLine1, blockLeft, textStartY);
    }

    if (data.logoLine2) {
      // Line 2 — right edge aligns with right edge of line 1 block
      ctx.font = `${data.logoLine2Weight} ${factoryPx}px "${_line2Font}", sans-serif`;
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'right';
      ctx.fillText(data.logoLine2, blockLeft + line1Width, textStartY + haviasPx + gapPx);
    }

    y += blockH;
  }

  y += px(headerEndGapMm);

  // ── Đường kẻ trên (sau header) ────────────────────────────────────────────
  y += px(divGapMm);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = px(divLineMm);
  ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(wPx - pad, y); ctx.stroke();
  y += px(divGapMm);

  // ── 5 dòng dữ liệu ────────────────────────────────────────────────────────
  const dataRows: [string, string][] = [
    ['Client:',   data.client   || '-'],
    ['Product:',  data.product  || '-'],
    ['Size:',     data.size     || '-'],
    ['Material:', data.material || '-'],
    ['Orginal:',  data.origin   || '-'],
  ];

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < numDataRows; i++) {
    const [key, val] = dataRows[i];
    const midY = y + rowH / 2;

    ctx.font = `400 ${rowFontPx}px Arial, sans-serif`;
    ctx.fillStyle = '#000000';
    ctx.fillText(key, pad, midY, keyColPx - px(0.3));

    if (i === numDataRows - 1 && extraImg) {
      const maxEH = rowH * 0.85;
      const maxEW = px(Math.min(10, labelWidthMm * 0.22));
      const sc = Math.min(maxEW / extraImg.width, maxEH / extraImg.height);
      const ew = extraImg.width * sc;
      const eh = extraImg.height * sc;
      ctx.fillText(val, pad + keyColPx, midY, wPx - pad * 2 - keyColPx - ew - px(1));
      ctx.drawImage(extraImg, wPx - pad - ew, y + (rowH - eh) / 2, ew, eh);
    } else {
      ctx.fillText(val, pad + keyColPx, midY, wPx - pad * 2 - keyColPx);
    }

    if (i < numDataRows - 1) {
      ctx.strokeStyle = '#cccccc';
      ctx.lineWidth = px(0.12);
      ctx.beginPath(); ctx.moveTo(pad, y + rowH); ctx.lineTo(wPx - pad, y + rowH); ctx.stroke();
    }

    y += rowH;
  }

  // ── Đường kẻ dưới (trước footer) ──────────────────────────────────────────
  y += px(divGapMm);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = px(divLineMm);
  ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(wPx - pad, y); ctx.stroke();
  y += px(divGapMm);

  // ── Footer ─────────────────────────────────────────────────────────────────
  ctx.textAlign = 'center';

  if (data.website) {
    const webPx = px(websiteMm);
    const _webFont   = data.websiteFontFamily || data.logoFontFamily;
    const _webWeight = data.websiteWeight ?? 400;
    ctx.font = `${_webWeight} ${webPx}px "${_webFont}", sans-serif`;
    ctx.fillStyle = '#999999';
    ctx.textBaseline = 'top';
    ctx.fillText(data.website, wPx / 2, y);
    y += Math.round(webPx * 1.35);
  }
  const sloganPx = px(sloganMm);
  const _slogFont = data.sloganFontFamily || data.logoFontFamily;
  ctx.font = `${data.sloganWeight} ${sloganPx}px "${_slogFont}", sans-serif`;
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'top';
  ctx.fillText(`── ${data.slogan} ──`, wPx / 2, y, wPx - pad * 2);

  applyBWThreshold(canvas);
  return canvas;
}

function imgToDataUrl(img: HTMLImageElement): string {
  const SCALE = 4; // upscale 4× trước threshold → in sắc nét, ít răng cưa trên screen
  const c = document.createElement('canvas');
  c.width = img.naturalWidth * SCALE;
  c.height = img.naturalHeight * SCALE;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  applyBWThreshold(c);
  return c.toDataURL('image/png');
}

async function drawCustomLabelVector(
  pdf: JsPDFType,
  data: CustomLabelData,
  extraImg: HTMLImageElement | null,
  labelWidthMm: number,
  labelHeightMm: number,
  xMm: number,
  yMm: number,
  logoFontName: string,    // resolved jsPDF font name for logo line 1
  line2FontName: string,   // resolved jsPDF font name for logo line 2
  websiteFontName: string, // resolved jsPDF font name for website footer
  sloganFontName: string,  // resolved jsPDF font name for slogan footer
): Promise<void> {
  const mmToPt = (mm: number) => mm / MM_PER_PT;

  const padMm           = Math.max(0.8,  labelHeightMm * 0.028);
  const divLineMm       = 0.28;
  const divGapMm        = Math.max(0.3,  labelHeightMm * 0.012);
  const haviasMm        = Math.max(3.5,  labelHeightMm * 0.165);
  const factoryMm       = Math.max(1.8,  labelHeightMm * 0.090);
  const brandGapMm      = Math.max(0.2,  labelHeightMm * 0.008);
  const headerContentMm = haviasMm + brandGapMm
    + (data.logoLine2 ? factoryMm : 0)
    + Math.max(0.4, labelHeightMm * 0.012);
  const headerEndGapMm  = Math.max(0.3,  labelHeightMm * 0.010);
  const websiteMm       = Math.max(1.1,  labelHeightMm * 0.038);
  const sloganMm        = Math.max(1.5,  labelHeightMm * 0.055);
  const footerContentMm = data.website ? websiteMm * 1.35 + sloganMm : sloganMm;
  const sectionSepMm = divGapMm * 2 + divLineMm;
  const fixedMm      = padMm * 2 + headerContentMm + headerEndGapMm + sectionSepMm * 2 + footerContentMm;
  const numDataRows  = 5;
  const rowMm        = Math.max(2, (labelHeightMm - fixedMm) / numDataRows);
  const keyColMm     = Math.min(labelWidthMm * 0.28, 16);
  const rowFontMm    = Math.min(rowMm * 0.52, Math.max(1.6, labelWidthMm * 0.036));

  let y = yMm + padMm;

  // ── Header — pure vector text (infinitely sharp at any zoom) ─────────────
  {
    const line1Style = data.logoLine1Weight >= 700 ? 'bold' : 'normal';
    const line2Style = data.logoLine2Weight >= 700 ? 'bold' : 'normal';
    const line2H     = data.logoLine2 ? (brandGapMm + factoryMm) : 0;
    const totalTextH = haviasMm + line2H;
    const textStartY = y + (headerContentMm - totalTextH) / 2;
    const centerX    = xMm + labelWidthMm / 2;

    // Measure line 1 width (need font set first for accurate getTextWidth)
    pdf.setFont(logoFontName, line1Style);
    pdf.setFontSize(mmToPt(haviasMm));
    const line1W = data.logoLine1 ? pdf.getTextWidth(data.logoLine1) : 0;

    if (data.logoLine1) {
      pdf.setTextColor(0);
      pdf.text(data.logoLine1, centerX, textStartY + haviasMm / 2, { align: 'center', baseline: 'middle' });
    }

    if (data.logoLine2) {
      pdf.setFont(line2FontName, line2Style);
      pdf.setFontSize(mmToPt(factoryMm));
      pdf.setTextColor(0);
      // Right edge of line 2 aligns with right edge of line 1 block
      const line1RightX = centerX + line1W / 2;
      pdf.text(data.logoLine2, line1RightX, textStartY + haviasMm + brandGapMm + factoryMm / 2, {
        align: 'right',
        baseline: 'middle',
      });
    }
  }
  y += headerContentMm + headerEndGapMm;

  // ── Top divider ─────────────────────────────────────────────────────────────
  y += divGapMm;
  pdf.setDrawColor(0);
  pdf.setLineWidth(divLineMm);
  pdf.line(xMm + padMm, y, xMm + labelWidthMm - padMm, y);
  y += divGapMm;

  // ── 5 data rows ─────────────────────────────────────────────────────────────
  const dataRows: [string, string][] = [
    ['Client:',   data.client   || '-'],
    ['Product:',  data.product  || '-'],
    ['Size:',     data.size     || '-'],
    ['Material:', data.material || '-'],
    ['Orginal:',  data.origin   || '-'],
  ];

  pdf.setFont('NotoSans', 'normal');
  pdf.setFontSize(mmToPt(rowFontMm));
  pdf.setTextColor(0);

  for (let i = 0; i < numDataRows; i++) {
    const [key, val] = dataRows[i];
    const midY = y + rowMm / 2;

    pdf.text(key, xMm + padMm, midY, { baseline: 'middle', maxWidth: keyColMm - 0.3 });

    if (i === numDataRows - 1 && extraImg) {
      const maxEW = Math.min(10, labelWidthMm * 0.22);
      const maxEH = rowMm * 0.85;
      const sc    = Math.min(maxEW / extraImg.naturalWidth, maxEH / extraImg.naturalHeight);
      const ew    = extraImg.naturalWidth * sc;
      const eh    = extraImg.naturalHeight * sc;
      pdf.text(val, xMm + padMm + keyColMm, midY, {
        baseline: 'middle',
        maxWidth: labelWidthMm - padMm * 2 - keyColMm - ew - 1,
      });
      pdf.addImage(imgToDataUrl(extraImg), 'PNG', xMm + labelWidthMm - padMm - ew, y + (rowMm - eh) / 2, ew, eh);
    } else {
      pdf.text(val, xMm + padMm + keyColMm, midY, {
        baseline: 'middle',
        maxWidth: labelWidthMm - padMm * 2 - keyColMm,
      });
    }

    if (i < numDataRows - 1) {
      pdf.setDrawColor(204, 204, 204);
      pdf.setLineWidth(0.12);
      pdf.line(xMm + padMm, y + rowMm, xMm + labelWidthMm - padMm, y + rowMm);
    }

    y += rowMm;
  }

  // ── Bottom divider ──────────────────────────────────────────────────────────
  y += divGapMm;
  pdf.setDrawColor(0);
  pdf.setLineWidth(divLineMm);
  pdf.line(xMm + padMm, y, xMm + labelWidthMm - padMm, y);
  y += divGapMm;

  // ── Footer — pure vector text ────────────────────────────────────────────────
  if (data.website) {
    const webStyle = (data.websiteWeight ?? 400) >= 700 ? 'bold' : 'normal';
    pdf.setFont(websiteFontName, webStyle);
    pdf.setFontSize(mmToPt(websiteMm));
    pdf.setTextColor(153, 153, 153);
    pdf.text(data.website, xMm + labelWidthMm / 2, y + websiteMm / 2, { align: 'center', baseline: 'middle' });
    y += websiteMm * 1.35;
  }
  {
    const sloganStyle = data.sloganWeight >= 700 ? 'bold' : 'normal';
    pdf.setFont(sloganFontName, sloganStyle);
    pdf.setFontSize(mmToPt(sloganMm));
    const textW    = pdf.getTextWidth(data.slogan);
    const centerX  = xMm + labelWidthMm / 2;
    const midY     = y + sloganMm / 2;
    const gapMm    = 1.0;
    const lineLen  = Math.max(0, (labelWidthMm - padMm * 2 - textW) / 2 - gapMm);
    pdf.text(data.slogan, centerX, midY, { align: 'center', baseline: 'middle' });
    if (lineLen > 0.3) {
      pdf.setDrawColor(0);
      pdf.setLineWidth(0.15);
      const lx1 = centerX - textW / 2 - gapMm - lineLen;
      const lx2 = centerX - textW / 2 - gapMm;
      const rx1 = centerX + textW / 2 + gapMm;
      const rx2 = centerX + textW / 2 + gapMm + lineLen;
      pdf.line(lx1, midY, lx2, midY);
      pdf.line(rx1, midY, rx2, midY);
    }
  }
}

export async function openCustomBarcodePrintPdf(
  data: CustomLabelData,
  quantity: number,
  paperSize: string = '80',
): Promise<void> {
  if (quantity <= 0) return;

  const { default: jsPDF } = await import('jspdf');
  const cfg = CUSTOM_LABEL_CONFIGS[paperSize] ?? CUSTOM_LABEL_CONFIGS['80'];

  const pageWidthMm  = cfg.labelWidthMm * cfg.cols;
  const pageHeightMm = cfg.labelHeightMm;

  const pdf = new jsPDF({
    orientation: pageWidthMm >= pageHeightMm ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [pageWidthMm, pageHeightMm],
    compress: true,
  });

  await loadVietnameseFonts(pdf);

  // Resolve logo fonts into jsPDF — vector text, sharp at any zoom level
  const logoFontName    = await resolveLogoFont(pdf, data.logoFontFamily);
  const line2FontName   = await resolveLogoFont(pdf, data.logoLine2FontFamily || data.logoFontFamily);
  const websiteFontName = await resolveLogoFont(pdf, data.websiteFontFamily || data.logoFontFamily);
  const sloganFontName  = await resolveLogoFont(pdf, data.sloganFontFamily || data.logoFontFamily);

  const extraImg = await loadImageEl(data.extraImage ?? '');

  const numRows = Math.ceil(quantity / cfg.cols);
  for (let row = 0; row < numRows; row++) {
    if (row > 0) pdf.addPage([pageWidthMm, pageHeightMm]);
    const labelsThisRow = Math.min(cfg.cols, quantity - row * cfg.cols);
    for (let col = 0; col < labelsThisRow; col++) {
      await drawCustomLabelVector(
        pdf,
        data,
        extraImg,
        cfg.labelWidthMm,
        cfg.labelHeightMm,
        col * cfg.labelWidthMm,
        0,
        logoFontName,
        line2FontName,
        websiteFontName,
        sloganFontName,
      );
    }
  }

  pdf.save(`tem-tuy-chinh-${paperSize}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ─── Barcode product label ────────────────────────────────────────────────────

/**
 * Generate PDF using jsPDF with exact label-sheet page dimensions.
 * Full vector output (text + barcode bars) with embedded NotoSans font for Vietnamese support.
 * Infinitely sharp at any zoom level, tiny file size regardless of label count.
 */
export async function openBarcodePrintWindow(
  items: BarcodeLabelItem[],
  paperSize: string = '72x22',
): Promise<void> {
  if (items.length === 0) return;

  const { default: jsPDF } = await import('jspdf');
  const cfg = LABEL_CONFIGS[paperSize] ?? LABEL_CONFIGS['72x22'];

  const allRows: Array<{ name: string; sku: string; price: string }> = [];
  for (const item of items) {
    const name  = item.productName || item.categoryName;
    const price = formatCurrency(item.salePrice);
    for (let r = 0; r < Math.max(item.quantity, 0); r++) {
      allRows.push({ name, sku: item.barcodeValue, price });
    }
  }
  if (allRows.length === 0) return;

  const totalLabels  = allRows.length;
  const pageWidthMm  = cfg.labelWidthMm * cfg.cols;
  const totalRows    = Math.ceil(totalLabels / cfg.cols);
  const pageHeightMm = cfg.labelHeightMm * Math.min(totalRows, cfg.rowsPerPage);

  const pdf = new jsPDF({
    orientation: pageWidthMm >= pageHeightMm ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [pageWidthMm, pageHeightMm],
    compress: true,
  });

  await loadVietnameseFonts(pdf);

  // Shift content slightly left to compensate for printer right-margin drift
  const X_SHIFT_MM = -1.5;

  let pageRowIdx = 0;
  for (let i = 0; i < totalLabels; i++) {
    if (pageRowIdx === cfg.rowsPerPage) {
      pdf.addPage([pageWidthMm, pageHeightMm]);
      pageRowIdx = 0;
    }
    const col = i % cfg.cols;
    const { name, sku, price } = allRows[i];
    drawLabelVector(pdf, name, sku, price, cfg, col * cfg.labelWidthMm + X_SHIFT_MM, pageRowIdx * cfg.labelHeightMm);
    if (col === cfg.cols - 1) pageRowIdx++;
  }

  pdf.save(`tem-${paperSize}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

/**
 * Open a screen-preview window (HTML) — useful for quick visual check before printing.
 */
export function openBarcodePrintPreview(
  items: BarcodeLabelItem[],
  paperSize: string = '72x22',
) {
  if (items.length === 0) return;

  const printWindow = window.open('', '_blank', 'width=1100,height=780');
  if (!printWindow) return;

  const cfg = LABEL_CONFIGS[paperSize] ?? LABEL_CONFIGS['72x22'];
  const totalRowWidth = cfg.labelWidthMm * cfg.cols;

  const allRows: string[] = [];
  for (const item of items) {
    const name = escapeHtml(item.productName || item.categoryName);
    const sku = item.barcodeValue;
    const price = formatCurrency(item.salePrice);
    const numRows = Math.max(item.quantity, 0);
    const barcodeSvg = generateBarcodeSvg(sku, cfg.barcodeWidth, cfg.barcodeHeight);

    for (let r = 0; r < numRows; r++) {
      let cells = '';
      for (let c = 0; c < cfg.cols; c++) {
        cells += `<div class="label">
          <div class="name">${name}</div>
          <div class="barcode">${barcodeSvg}</div>
          <div class="sku">${escapeHtml(sku)}</div>
          <div class="price">${price}</div>
        </div>`;
      }
      allRows.push(`<div class="row">${cells}</div>`);
    }
  }

  const pages: string[] = [];
  for (let i = 0; i < allRows.length; i += cfg.rowsPerPage) {
    pages.push(`<div class="page">${allRows.slice(i, i + cfg.rowsPerPage).join('')}</div>`);
  }

  const html = `<!doctype html><html lang="vi"><head><meta charset="UTF-8"/>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, sans-serif; background: #e8e8e8; padding: 10mm; }
.page { background: white; width: ${totalRowWidth}mm; margin-bottom: 5mm; box-shadow: 0 2px 8px rgba(0,0,0,.15); }
.row { display: flex; width: ${totalRowWidth}mm; height: ${cfg.labelHeightMm}mm; }
.label { width: ${cfg.labelWidthMm}mm; height: ${cfg.labelHeightMm}mm; display: flex; flex-direction: column; align-items: center; justify-content: space-between; text-align: center; padding: 1mm 1.5mm; overflow: hidden; }
.name { font-size: ${cfg.nameSize}; font-weight: 500; line-height: 1.25; width: 100%; text-align: left; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; flex-shrink: 0; }
.barcode { width: 100%; flex: 1; display: flex; align-items: center; justify-content: center; overflow: hidden; min-height: 0; }
.barcode svg { width: 100%; height: auto; max-height: 100%; }
.sku { font-size: ${cfg.skuSize}; font-weight: 600; color: #000; flex-shrink: 0; }
.price { font-size: ${cfg.priceSize}; font-weight: 900; color: #000; flex-shrink: 0; }
</style></head><body>${pages.join('')}</body></html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
