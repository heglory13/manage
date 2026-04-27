import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface SkuComponents {
  category: string; // DANHMUC (viết hoa, không dấu)
  id: string; // 001, 002, ...
  date: string; // YYYYMMDD
}

/**
 * Vietnamese diacritics mapping table.
 * Maps accented Vietnamese characters to their ASCII equivalents.
 */
const DIACRITICS_MAP: Record<string, string> = {
  // a variants
  à: 'a', á: 'a', ả: 'a', ã: 'a', ạ: 'a',
  ă: 'a', ằ: 'a', ắ: 'a', ẳ: 'a', ẵ: 'a', ặ: 'a',
  â: 'a', ầ: 'a', ấ: 'a', ẩ: 'a', ẫ: 'a', ậ: 'a',
  // e variants
  è: 'e', é: 'e', ẻ: 'e', ẽ: 'e', ẹ: 'e',
  ê: 'e', ề: 'e', ế: 'e', ể: 'e', ễ: 'e', ệ: 'e',
  // i variants
  ì: 'i', í: 'i', ỉ: 'i', ĩ: 'i', ị: 'i',
  // o variants
  ò: 'o', ó: 'o', ỏ: 'o', õ: 'o', ọ: 'o',
  ô: 'o', ồ: 'o', ố: 'o', ổ: 'o', ỗ: 'o', ộ: 'o',
  ơ: 'o', ờ: 'o', ớ: 'o', ở: 'o', ỡ: 'o', ợ: 'o',
  // u variants
  ù: 'u', ú: 'u', ủ: 'u', ũ: 'u', ụ: 'u',
  ư: 'u', ừ: 'u', ứ: 'u', ử: 'u', ữ: 'u', ự: 'u',
  // y variants
  ỳ: 'y', ý: 'y', ỷ: 'y', ỹ: 'y', ỵ: 'y',
  // d variant
  đ: 'd',
};

@Injectable()
export class SkuGeneratorService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Converts Vietnamese diacritics to uppercase ASCII.
   * Removes all non-alphanumeric characters and spaces.
   * Example: "Đồng hồ" → "DONGHO"
   */
  removeDiacritics(text: string): string {
    let result = '';
    const lower = text.toLowerCase();
    for (const char of lower) {
      if (DIACRITICS_MAP[char]) {
        result += DIACRITICS_MAP[char];
      } else if (/[a-z0-9]/.test(char)) {
        result += char;
      }
      // Skip spaces and other non-alphanumeric characters
    }
    return result.toUpperCase();
  }

  /**
   * Generates a unique SKU in format DANHMUC-NNN-YYYYMMDD.
   * Uses the category code (already uppercase, no diacritics) when available.
   * Handles collision by incrementing ID until unique.
   */
  async generateSku(categoryName: string, createdAt: Date): Promise<string> {
    const categoryCode = this.removeDiacritics(categoryName);
    const dateStr = this.formatDate(createdAt);

    // Find the highest existing ID for this category prefix
    const prefix = `${categoryCode}-`;
    const existingProducts = await this.prisma.product.findMany({
      where: {
        sku: { startsWith: prefix },
      },
      select: { sku: true },
      orderBy: { sku: 'desc' },
    });

    let nextId = 1;
    if (existingProducts.length > 0) {
      // Extract the highest ID from existing SKUs
      for (const product of existingProducts) {
        const parsed = this.parseSku(product.sku);
        const id = parseInt(parsed.id, 10);
        if (id >= nextId) {
          nextId = id + 1;
        }
      }
    }

    // Handle collision: increment ID until unique
    let sku: string;
    do {
      const idStr = String(nextId).padStart(3, '0');
      sku = this.formatSku({ category: categoryCode, id: idStr, date: dateStr });
      const existing = await this.prisma.product.findUnique({
        where: { sku },
      });
      if (!existing) break;
      nextId++;
    } while (true);

    return sku;
  }

  /**
   * Parses a SKU string into its components.
   * SKU format: DANHMUC-NNN-YYYYMMDD
   */
  parseSku(sku: string): SkuComponents {
    const lastDashIndex = sku.lastIndexOf('-');
    const date = sku.substring(lastDashIndex + 1);
    const rest = sku.substring(0, lastDashIndex);
    const secondLastDashIndex = rest.lastIndexOf('-');
    const category = rest.substring(0, secondLastDashIndex);
    const id = rest.substring(secondLastDashIndex + 1);

    return { category, id, date };
  }

  /**
   * Formats SKU components back into a SKU string.
   */
  formatSku(components: SkuComponents): string {
    return `${components.category}-${components.id}-${components.date}`;
  }

  /**
   * Formats a Date into YYYYMMDD string.
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }
}
