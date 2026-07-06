SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE barcode_print_logs;
TRUNCATE TABLE activity_logs;
TRUNCATE TABLE saved_filters;
TRUNCATE TABLE stocktaking_status_history;
TRUNCATE TABLE stocktaking_items;
TRUNCATE TABLE stocktaking_records;
TRUNCATE TABLE order_plans;
TRUNCATE TABLE inventory_transactions;
TRUNCATE TABLE preliminary_checks;
TRUNCATE TABLE warehouse_positions;
TRUNCATE TABLE warehouse_layouts;
TRUNCATE TABLE warehouse_config;
TRUNCATE TABLE sku_combos;
TRUNCATE TABLE products;
TRUNCATE TABLE storage_zones;
TRUNCATE TABLE product_conditions;
TRUNCATE TABLE materials;
TRUNCATE TABLE sizes;
TRUNCATE TABLE colors;
TRUNCATE TABLE classifications;
TRUNCATE TABLE categories;
TRUNCATE TABLE warehouse_types;
TRUNCATE TABLE general_settings;

SET FOREIGN_KEY_CHECKS = 1;

-- Users table is NOT truncated - keeping all user accounts
SELECT 'Done! All data cleared except users.' AS result;
