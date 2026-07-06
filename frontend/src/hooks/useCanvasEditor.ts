import { useState, useCallback } from 'react';

interface Position {
  id?: number;
  row: number;
  col: number;
  zoneId: number;
  zoneName: string;
  zoneColor: string;
  capacity: number;
  currentQuantity: number;
  isActive: boolean;
}

interface Zone {
  id: number;
  name: string;
  color: string;
  warehouseTypeId: number;
}

interface CanvasEditorState {
  rows: number;
  columns: number;
  zones: Zone[];
  positions: Map<string, Position>;
  selectedPosition: { row: number; col: number } | null;
}

export function useCanvasEditor(initialState?: Partial<CanvasEditorState>) {
  const [state, setState] = useState<CanvasEditorState>({
    rows: initialState?.rows || 10,
    columns: initialState?.columns || 10,
    zones: initialState?.zones || [],
    positions: initialState?.positions || new Map(),
    selectedPosition: null,
  });

  const selectPosition = useCallback((row: number | null, col: number | null) => {
    setState(prev => ({
      ...prev,
      selectedPosition: row !== null && col !== null ? { row, col } : null,
    }));
  }, []);

  const updatePosition = useCallback((row: number, col: number, updates: Partial<Position>) => {
    setState(prev => {
      const newPositions = new Map(prev.positions);
      const key = `${row}-${col}`;
      const existing = newPositions.get(key) || { row, col, zoneId: 0, zoneName: '', zoneColor: '', capacity: 100, currentQuantity: 0, isActive: true };
      newPositions.set(key, { ...existing, ...updates });
      return { ...prev, positions: newPositions };
    });
  }, []);

  const addZone = useCallback((zone: Zone) => {
    setState(prev => ({
      ...prev,
      zones: [...prev.zones, zone],
    }));
  }, []);

  const updateZone = useCallback((zoneId: number, updates: Partial<Zone>) => {
    setState(prev => ({
      ...prev,
      zones: prev.zones.map(z => z.id === zoneId ? { ...z, ...updates } : z),
    }));
  }, []);

  const deleteZone = useCallback((zoneId: number) => {
    setState(prev => ({
      ...prev,
      zones: prev.zones.filter(z => z.id !== zoneId),
      positions: new Map(
        Array.from(prev.positions.entries()).filter(([_, p]) => p.zoneId !== zoneId)
      ),
    }));
  }, []);

  const setGridSize = useCallback((rows: number, columns: number) => {
    setState(prev => ({ ...prev, rows, columns }));
  }, []);

  const fillZone = useCallback((zoneId: number, zoneName: string, zoneColor: string) => {
    setState(prev => {
      const newPositions = new Map(prev.positions);
      prev.positions.forEach((pos, key) => {
        if (pos.row >= 1 && pos.row <= prev.rows && pos.col >= 1 && pos.col <= prev.columns) {
          newPositions.set(key, { ...pos, zoneId, zoneName, zoneColor });
        }
      });
      return { ...prev, positions: newPositions };
    });
  }, []);

  return {
    ...state,
    selectPosition,
    updatePosition,
    addZone,
    updateZone,
    deleteZone,
    setGridSize,
    fillZone,
  };
}
