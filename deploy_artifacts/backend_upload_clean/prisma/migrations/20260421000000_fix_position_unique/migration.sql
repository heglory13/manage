-- Drop old unique constraint (layoutId + row + column)
DROP INDEX IF EXISTS "warehouse_positions_layoutId_row_column_key";

-- Create new unique constraint (layoutId + label)
-- Label must be unique per layout, but NULL labels can coexist
CREATE UNIQUE INDEX "warehouse_positions_layoutId_label_key"
  ON "warehouse_positions"("layoutId", "label")
  WHERE "label" IS NOT NULL;
