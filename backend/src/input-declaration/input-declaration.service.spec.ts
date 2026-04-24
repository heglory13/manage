import * as fc from 'fast-check';
import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { InputDeclarationService } from './input-declaration.service.js';
import type { AttributeType } from './input-declaration.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('InputDeclarationService', () => {
  let service: InputDeclarationService;
  let prisma: Record<string, unknown>;

  const attributeTypes: AttributeType[] = [
    'classification',
    'color',
    'size',
    'material',
  ];

  beforeEach(async () => {
    prisma = {
      classification: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 'test-id',
          name: data.name,
          createdAt: new Date(),
        })),
      },
      color: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 'test-id',
          name: data.name,
          createdAt: new Date(),
        })),
      },
      size: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 'test-id',
          name: data.name,
          createdAt: new Date(),
        })),
      },
      material: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 'test-id',
          name: data.name,
          createdAt: new Date(),
        })),
      },
      productCondition: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 'test-id',
          name: data.name,
          createdAt: new Date(),
        })),
      },
      storageZone: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 'test-id',
          name: data.name,
          maxCapacity: data.maxCapacity,
          currentStock: 0,
          createdAt: new Date(),
        })),
      },
      warehouseType: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 'test-id',
          name: data.name,
          createdAt: new Date(),
        })),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        InputDeclarationService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(InputDeclarationService);
  });

  /**
   * **Validates: Requirements 1.2, 2.2, 3.2, 4.2, 7.2**
   * Feature: input-declaration-module, Property 1: Tạo thuộc tính hợp lệ thành công
   */
  describe('P1: Valid attribute creation succeeds', () => {
    it.each(attributeTypes)(
      'should create %s with any valid non-empty name',
      async (type) => {
        await fc.assert(
          fc.asyncProperty(
            fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
            async (name) => {
              const delegate = prisma[type] as Record<string, jest.Mock>;
              delegate.findFirst.mockResolvedValue(null);
              delegate.create.mockImplementation(({ data }: { data: { name: string } }) => ({
                id: 'test-id',
                name: data.name,
                createdAt: new Date(),
              }));

              const result = await service.create(type, name);
              expect(result).toBeDefined();
              expect(result.name).toBe(name.trim());
              expect(delegate.create).toHaveBeenCalled();
            },
          ),
          { numRuns: 100 },
        );
      },
    );
  });

  /**
   * **Validates: Requirements 1.3, 2.3, 3.3, 4.3, 7.3, 8.3**
   * Feature: input-declaration-module, Property 2: Từ chối tên rỗng hoặc chỉ chứa khoảng trắng
   */
  describe('P2: Reject empty or whitespace-only names', () => {
    it.each(attributeTypes)(
      'should reject %s with empty/whitespace name',
      async (type) => {
        await fc.assert(
          fc.asyncProperty(
            fc.stringOf(fc.constant(' ')),
            async (name) => {
              await expect(service.create(type, name)).rejects.toThrow(
                BadRequestException,
              );
              const delegate = prisma[type] as Record<string, jest.Mock>;
              expect(delegate.create).not.toHaveBeenCalled();
            },
          ),
          { numRuns: 100 },
        );
      },
    );

    it('should reject ProductCondition with empty/whitespace name', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.stringOf(fc.constant(' ')),
          async (name) => {
            await expect(
              service.createProductCondition(name),
            ).rejects.toThrow(BadRequestException);
            expect(
              (prisma.productCondition as Record<string, jest.Mock>).create,
            ).not.toHaveBeenCalled();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should reject StorageZone with empty/whitespace name', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.stringOf(fc.constant(' ')),
          async (name) => {
            await expect(
              service.createStorageZone(name, 100),
            ).rejects.toThrow(BadRequestException);
            expect(
              (prisma.storageZone as Record<string, jest.Mock>).create,
            ).not.toHaveBeenCalled();
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Validates: Requirements 1.4, 2.4, 3.4, 4.4, 7.4, 8.5, 11.1**
   * Feature: input-declaration-module, Property 3: Phát hiện trùng lặp không phân biệt hoa thường
   */
  describe('P3: Case-insensitive duplicate detection', () => {
    it.each(attributeTypes)(
      'should reject %s with case-insensitive duplicate name',
      async (type) => {
        await fc.assert(
          fc.asyncProperty(
            fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
            fc.constantFrom('toLowerCase', 'toUpperCase') as fc.Arbitrary<'toLowerCase' | 'toUpperCase'>,
            async (name, caseMethod) => {
              const delegate = prisma[type] as Record<string, jest.Mock>;
              // First call succeeds
              delegate.findFirst.mockResolvedValueOnce(null);
              delegate.create.mockResolvedValueOnce({
                id: 'existing-id',
                name: name.trim(),
                createdAt: new Date(),
              });
              await service.create(type, name);

              // Second call with different case should fail
              delegate.findFirst.mockResolvedValueOnce({
                id: 'existing-id',
                name: name.trim(),
              });

              const variant = name.trim()[caseMethod]();
              await expect(service.create(type, variant)).rejects.toThrow(
                ConflictException,
              );
            },
          ),
          { numRuns: 100 },
        );
      },
    );
  });

  /**
   * **Validates: Requirements 11.2**
   * Feature: input-declaration-module, Property 4: Loại bỏ khoảng trắng thừa trước khi lưu
   */
  describe('P4: Trim whitespace before saving', () => {
    it.each(attributeTypes)(
      'should trim whitespace for %s names',
      async (type) => {
        await fc.assert(
          fc.asyncProperty(
            fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
            fc.nat({ max: 5 }),
            fc.nat({ max: 5 }),
            async (name, leadingSpaces, trailingSpaces) => {
              const padded =
                ' '.repeat(leadingSpaces) + name + ' '.repeat(trailingSpaces);
              const delegate = prisma[type] as Record<string, jest.Mock>;
              delegate.findFirst.mockResolvedValue(null);
              delegate.create.mockImplementation(({ data }: { data: { name: string } }) => ({
                id: 'test-id',
                name: data.name,
                createdAt: new Date(),
              }));

              const result = await service.create(type, padded);
              expect(result.name).toBe(padded.trim());
            },
          ),
          { numRuns: 100 },
        );
      },
    );
  });

  /**
   * **Validates: Requirements 8.4**
   * Feature: input-declaration-module, Property 8: Từ chối sức chứa tối đa không hợp lệ
   */
  describe('P8: Reject invalid maxCapacity', () => {
    it('should reject StorageZone with maxCapacity <= 0', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ max: 0 }),
          async (maxCapacity) => {
            await expect(
              service.createStorageZone('Valid Zone', maxCapacity),
            ).rejects.toThrow(BadRequestException);
            expect(
              (prisma.storageZone as Record<string, jest.Mock>).create,
            ).not.toHaveBeenCalled();
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // === WarehouseType CRUD Tests ===

  describe('WarehouseType CRUD', () => {
    it('should return all warehouse types', async () => {
      const mockTypes = [
        { id: '1', name: 'Kho sản xuất', createdAt: new Date() },
        { id: '2', name: 'Kho lẻ', createdAt: new Date() },
      ];
      (prisma.warehouseType as Record<string, jest.Mock>).findMany.mockResolvedValue(mockTypes);

      const result = await service.getAllWarehouseTypes();
      expect(result).toEqual(mockTypes);
    });

    it('should create a valid warehouse type', async () => {
      const result = await service.createWarehouseType('Kho sản xuất');
      expect(result).toBeDefined();
      expect(result.name).toBe('Kho sản xuất');
    });

    it('should reject empty warehouse type name', async () => {
      await expect(service.createWarehouseType('   ')).rejects.toThrow(BadRequestException);
    });

    it('should reject duplicate warehouse type name (case-insensitive)', async () => {
      (prisma.warehouseType as Record<string, jest.Mock>).findFirst.mockResolvedValue({
        id: 'existing',
        name: 'Kho sản xuất',
      });

      await expect(service.createWarehouseType('kho sản xuất')).rejects.toThrow(ConflictException);
    });
  });
});
