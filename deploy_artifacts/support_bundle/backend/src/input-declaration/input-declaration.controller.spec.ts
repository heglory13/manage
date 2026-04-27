import { Test } from '@nestjs/testing';
import { InputDeclarationController } from './input-declaration.controller.js';
import { InputDeclarationService } from './input-declaration.service.js';
import { SkuComboService } from './sku-combo.service.js';

describe('InputDeclarationController', () => {
  let controller: InputDeclarationController;
  let inputService: Record<string, jest.Mock>;
  let skuComboService: Record<string, jest.Mock>;

  beforeEach(async () => {
    inputService = {
      getAllDeclarations: jest.fn(),
      getAllCategories: jest.fn(),
      getAll: jest.fn(),
      create: jest.fn(),
      getAllProductConditions: jest.fn(),
      createProductCondition: jest.fn(),
      getAllStorageZones: jest.fn(),
      createStorageZone: jest.fn(),
      getAllWarehouseTypes: jest.fn(),
      createWarehouseType: jest.fn(),
      createCategory: jest.fn(),
      deleteAttribute: jest.fn(),
      generateImportTemplate: jest.fn(),
      importDeclarationsFromExcel: jest.fn(),
    };

    skuComboService = {
      getAll: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    };

    const module = await Test.createTestingModule({
      controllers: [InputDeclarationController],
      providers: [
        { provide: InputDeclarationService, useValue: inputService },
        { provide: SkuComboService, useValue: skuComboService },
      ],
    }).compile();

    controller = module.get(InputDeclarationController);
  });

  describe('GET endpoints', () => {
    it('should return classifications', async () => {
      const mockData = [{ id: '1', name: 'Oversize', createdAt: new Date() }];
      inputService.getAll.mockResolvedValue(mockData);

      const result = await controller.getClassifications();
      expect(result).toEqual(mockData);
      expect(inputService.getAll).toHaveBeenCalledWith('classification');
    });

    it('should return colors', async () => {
      const mockData = [{ id: '1', name: 'Đen', createdAt: new Date() }];
      inputService.getAll.mockResolvedValue(mockData);

      const result = await controller.getColors();
      expect(result).toEqual(mockData);
      expect(inputService.getAll).toHaveBeenCalledWith('color');
    });

    it('should return sizes', async () => {
      const mockData = [{ id: '1', name: 'XL', createdAt: new Date() }];
      inputService.getAll.mockResolvedValue(mockData);

      const result = await controller.getSizes();
      expect(result).toEqual(mockData);
      expect(inputService.getAll).toHaveBeenCalledWith('size');
    });

    it('should return materials', async () => {
      const mockData = [{ id: '1', name: 'Cotton', createdAt: new Date() }];
      inputService.getAll.mockResolvedValue(mockData);

      const result = await controller.getMaterials();
      expect(result).toEqual(mockData);
      expect(inputService.getAll).toHaveBeenCalledWith('material');
    });

    it('should return product conditions', async () => {
      const mockData = [{ id: '1', name: 'Đạt tiêu chuẩn', createdAt: new Date() }];
      inputService.getAllProductConditions.mockResolvedValue(mockData);

      const result = await controller.getProductConditions();
      expect(result).toEqual(mockData);
    });

    it('should return storage zones', async () => {
      const mockData = [
        { id: '1', name: 'OV1', maxCapacity: 100, currentStock: 50, createdAt: new Date() },
      ];
      inputService.getAllStorageZones.mockResolvedValue(mockData);

      const result = await controller.getStorageZones();
      expect(result).toEqual(mockData);
    });

    it('should return sku combos with pagination', async () => {
      const mockData = { data: [], total: 0, page: 1, limit: 10, totalPages: 0 };
      skuComboService.getAll.mockResolvedValue(mockData);

      const result = await controller.getSkuCombos({ search: 'test', page: '1', limit: '10' });
      expect(result).toEqual(mockData);
    });
  });

  describe('POST endpoints', () => {
    it('should create classification', async () => {
      const mockResult = { id: '1', name: 'Oversize', createdAt: new Date() };
      inputService.create.mockResolvedValue(mockResult);

      const result = await controller.createClassification({ name: 'Oversize' });
      expect(result).toEqual(mockResult);
      expect(inputService.create).toHaveBeenCalledWith('classification', 'Oversize');
    });

    it('should create color', async () => {
      const mockResult = { id: '1', name: 'Đen', createdAt: new Date() };
      inputService.create.mockResolvedValue(mockResult);

      const result = await controller.createColor({ name: 'Đen' });
      expect(result).toEqual(mockResult);
      expect(inputService.create).toHaveBeenCalledWith('color', 'Đen');
    });

    it('should create product condition', async () => {
      const mockResult = { id: '1', name: 'Mới', createdAt: new Date() };
      inputService.createProductCondition.mockResolvedValue(mockResult);

      const result = await controller.createProductCondition({ name: 'Mới' });
      expect(result).toEqual(mockResult);
    });

    it('should create storage zone', async () => {
      const mockResult = {
        id: '1',
        name: 'OV1',
        maxCapacity: 100,
        currentStock: 0,
        createdAt: new Date(),
      };
      inputService.createStorageZone.mockResolvedValue(mockResult);

      const result = await controller.createStorageZone({
        name: 'OV1',
        maxCapacity: 100,
      });
      expect(result).toEqual(mockResult);
      expect(inputService.createStorageZone).toHaveBeenCalledWith('OV1', 100);
    });

    it('should create sku combo', async () => {
      const dto = {
        classificationId: 'c1',
        colorId: 'c2',
        sizeId: 's1',
        materialId: 'm1',
      };
      const mockResult = { id: '1', ...dto, compositeSku: 'A-B-C-D', createdAt: new Date() };
      skuComboService.create.mockResolvedValue(mockResult);

      const result = await controller.createSkuCombo(dto);
      expect(result).toEqual(mockResult);
    });

    it('should import declarations from excel buffer', async () => {
      const mockResult = {
        success: true,
        totalRows: 3,
        importedRows: 3,
        createdCounts: {
          categories: 1,
          classifications: 1,
          colors: 1,
          sizes: 1,
          materials: 1,
          productConditions: 0,
          storageZones: 0,
          warehouseTypes: 0,
        },
      };
      inputService.importDeclarationsFromExcel.mockResolvedValue(mockResult);

      const result = await controller.importDeclarations({
        buffer: Buffer.from('excel'),
      });

      expect(result).toEqual(mockResult);
      expect(inputService.importDeclarationsFromExcel).toHaveBeenCalled();
    });
  });
});
