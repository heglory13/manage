import * as fc from 'fast-check';
import { InventoryService } from './inventory.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('Inventory PBT', () => {
  it('computeBusinessStatus should return HET_HANG only when stock is 0 or below', () => {
    const service = new InventoryService({} as PrismaService);

    fc.assert(
      fc.property(fc.integer({ min: -1000, max: 100000 }), (stock) => {
        const result = (
          service as unknown as {
            computeBusinessStatus: (value: number) => string;
          }
        ).computeBusinessStatus(stock);

        if (stock > 0) {
          expect(result).toBe('CON_HANG');
        } else {
          expect(result).toBe('HET_HANG');
        }
      }),
    );
  });

  it('filtered category rows should all match the requested businessStatus', () => {
    const service = new InventoryService({} as PrismaService);

    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -100, max: 1000 }), {
          minLength: 1,
          maxLength: 50,
        }),
        fc.constantFrom('CON_HANG', 'HET_HANG'),
        (stocks, filterStatus) => {
          const rows = stocks.map((stock) => ({
            stock,
            businessStatus: (
              service as unknown as {
                computeBusinessStatus: (value: number) => string;
              }
            ).computeBusinessStatus(stock),
          }));

          const filtered = rows.filter(
            (item) => item.businessStatus === filterStatus,
          );
          for (const item of filtered) {
            expect(item.businessStatus).toBe(filterStatus);
          }
        },
      ),
    );
  });
});
