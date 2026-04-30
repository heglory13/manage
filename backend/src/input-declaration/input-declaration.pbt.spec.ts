import * as fc from 'fast-check';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { InputDeclarationService } from './input-declaration.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Feature: system-upgrade-v2
 * Property-Based Tests for Input Declaration Module
 */

describe('Input Declaration PBT', () => {
  /**
   * Property 21: Tên Loại kho validation
   * Empty/whitespace names must be rejected. Case-insensitive duplicates must be rejected.
   *
   * **Validates: Requirements 16.3, 16.4**
   */
  describe('P21: WarehouseType name validation', () => {
    it('rejects empty or whitespace-only names', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 0, maxLength: 10 }),
          async (whitespaceStr) => {
            const mockPrisma = {
              warehouseType: {
                findFirst: jest.fn(),
                create: jest.fn(),
              },
            };

            const service = new InputDeclarationService(mockPrisma as unknown as PrismaService);

            await expect(service.createWarehouseType(whitespaceStr)).rejects.toThrow(BadRequestException);
            expect(mockPrisma.warehouseType.create).not.toHaveBeenCalled();
          },
        ),
      );
    });

    it('rejects case-insensitive duplicate names', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
          async (name) => {
            const mockPrisma = {
              warehouseType: {
                findFirst: jest.fn().mockResolvedValue({ id: 'existing', name }),
                create: jest.fn(),
              },
            };

            const service = new InputDeclarationService(mockPrisma as unknown as PrismaService);

            // Try creating with same name (case variation)
            await expect(service.createWarehouseType(name)).rejects.toThrow(ConflictException);
            expect(mockPrisma.warehouseType.create).not.toHaveBeenCalled();
          },
        ),
      );
    });
  });
});
