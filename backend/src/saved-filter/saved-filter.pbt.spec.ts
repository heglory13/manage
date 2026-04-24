import * as fc from 'fast-check';
import { BadRequestException } from '@nestjs/common';
import { SavedFilterService } from './saved-filter.service.js';

/**
 * Feature: system-upgrade-v3
 * Property-based tests for SavedFilter validation
 */

// Mock PrismaService for unit testing
function createMockPrisma(existingCount: number = 0) {
  return {
    savedFilter: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(existingCount),
      create: jest.fn().mockImplementation((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'test-id', ...args.data, createdAt: new Date() }),
      ),
      findUnique: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue(undefined),
    },
  };
}

describe('SavedFilter PBT', () => {
  /**
   * Property 6: Tên bộ lọc đã lưu bắt buộc và không rỗng
   * **Validates: Requirements 9.6**
   */
  it('P6: empty or whitespace-only names are rejected, non-empty names are accepted', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          // Whitespace-only strings
          fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 0, maxLength: 10 }),
          // Valid strings with at least one non-whitespace char
          fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
        ),
        async (name) => {
          const mockPrisma = createMockPrisma(0);
          const service = new SavedFilterService(mockPrisma as never);

          const isWhitespaceOnly = name.trim().length === 0;

          if (isWhitespaceOnly) {
            await expect(
              service.create('user-1', {
                pageKey: 'products',
                name,
                filters: {},
              }),
            ).rejects.toThrow(BadRequestException);
          } else {
            const result = await service.create('user-1', {
              pageKey: 'products',
              name,
              filters: {},
            });
            expect(result).toBeDefined();
            expect(mockPrisma.savedFilter.create).toHaveBeenCalled();
          }
        },
      ),
    );
  });

  /**
   * Property 7: Giới hạn 20 bộ lọc đã lưu mỗi user mỗi trang
   * **Validates: Requirements 9.7, 9.8**
   */
  it('P7: limit of 20 filters per user per page is enforced', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 25 }),
        async (existingCount) => {
          const mockPrisma = createMockPrisma(existingCount);
          const service = new SavedFilterService(mockPrisma as never);

          if (existingCount >= 20) {
            await expect(
              service.create('user-1', {
                pageKey: 'products',
                name: 'Test Filter',
                filters: {},
              }),
            ).rejects.toThrow(BadRequestException);
          } else {
            const result = await service.create('user-1', {
              pageKey: 'products',
              name: 'Test Filter',
              filters: {},
            });
            expect(result).toBeDefined();
          }
        },
      ),
    );
  });
});
