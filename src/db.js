import Dexie from 'dexie';
import { v4 as uuidv4 } from 'uuid';
import supabase from './supabaseClient';

export const db = new Dexie('mytailor');

// Auto-sync management
let autoSyncTimeout = null;
let isSyncing = false;
const AUTO_SYNC_DELAY = 2000; // Wait 2 seconds after last change before syncing

db.version(4).stores({
  customers: 'id, name, phone, email, address, measurements, sync_status',
  orders: 'id, customer_id, order_date, delivery_date, remind_date, total_amount, advance_payment, status, is_urgent, notes, receipt_data, created_at, updated_at, sync_status',
  order_items: 'id, order_id, product_name, price, quantity, created_at, updated_at, sync_status',
  measurements: 'id, customer_id, template_name, data, sync_status',
  measurement_templates: 'id, name, fields, sync_status',
});

// Generic function to add a record and mark for sync
export const addRecord = async (tableName, data) => {
  const id = uuidv4();
  const record = { ...data, id, sync_status: 'pending' };
  await db[tableName].add(record);
  
  // Trigger automatic sync after adding record
  triggerAutoSync();
  
  return record;
};

// Generic function to update a record and mark for sync
export const updateRecord = async (tableName, id, data) => {
  const record = { ...data, sync_status: 'pending' };
  await db[tableName].update(id, record);
  
  // Trigger automatic sync after updating record
  triggerAutoSync();
  
  return record;
};

// Generic function to delete a record and mark for sync (soft delete)
export const deleteRecord = async (tableName, id) => {
  await db[tableName].update(id, { sync_status: 'deleted' });
  
  // Trigger automatic sync after deleting record
  triggerAutoSync();
};

// Synchronization logic
export const syncWithSupabase = async () => {
  // Check if we're online before attempting sync
  if (!navigator.onLine) {
    console.log('Device is offline, skipping sync');
    return;
  }

  // Sync tables in dependency order: parents before children
  const tables = ['customers', 'measurement_templates', 'orders', 'measurements', 'order_items'];

  for (const table of tables) {
    try {
      // First check if the table exists in Supabase by doing a simple query
      const { error: tableCheckError } = await supabase.from(table).select('count').limit(1);
      
      if (tableCheckError) {
        if (tableCheckError.code === 'PGRST116' || tableCheckError.message?.includes('relation') || tableCheckError.message?.includes('does not exist')) {
          console.warn(`Table '${table}' does not exist in Supabase. Skipping sync for this table.`);
          continue;
        }
      }

      const pendingRecords = await db[table].where('sync_status').equals('pending').toArray();
      if (pendingRecords.length > 0) {
        console.log(`🔄 Syncing ${pendingRecords.length} pending ${table} records to Supabase...`);
      }
      
      for (const record of pendingRecords) {
        try {
          const { sync_status, ...data } = record;
          console.log(`📤 Syncing ${table} record:`, { id: record.id, ...data });
          
          const { error } = await supabase.from(table).upsert(data);
          if (error) {
            // If it's a 404 or table doesn't exist error, mark as failed but don't retry
            if (error.code === 'PGRST116' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
              console.warn(`Table '${table}' does not exist in Supabase. Marking record as failed.`);
              await db[table].update(record.id, { sync_status: 'failed' });
            } 
            // Handle foreign key constraint violations (orphaned records)
            else if (error.code === '23503') {
              console.warn(`🔗 Foreign key constraint violation for ${table} record ${record.id}:`, error.message);
              
              if (table === 'order_items' && error.message?.includes('order_items_order_id_fkey')) {
                console.log(`🗑️ Order item ${record.id} references non-existent order ${data.order_id}. Marking as failed.`);
                await db[table].update(record.id, { sync_status: 'failed', error_reason: 'Referenced order does not exist in Supabase' });
              } else {
                console.log(`🗑️ ${table} record ${record.id} has foreign key constraint violation. Marking as failed.`);
                await db[table].update(record.id, { sync_status: 'failed', error_reason: 'Foreign key constraint violation' });
              }
            }
            else {
              console.error(`❌ Error syncing ${table} record ${record.id}:`, error);
              console.error(`📊 Failed data for ${table}:`, data);
              
              // Log additional details for debugging
              if (error.code) {
                console.error(`🔍 Error code: ${error.code}`);
              }
              if (error.details) {
                console.error(`🔍 Error details: ${error.details}`);
              }
              if (error.hint) {
                console.error(`🔍 Error hint: ${error.hint}`);
              }
              
              await db[table].update(record.id, { sync_status: 'failed', error_reason: error.message });
            }
          } else {
            console.log(`✅ Successfully synced ${table} record ${record.id}`);
            await db[table].update(record.id, { sync_status: 'synced' });
          }
        } catch (syncError) {
          console.error(`Exception while syncing ${table} record ${record.id}:`, syncError);
          await db[table].update(record.id, { sync_status: 'failed' });
        }
      }

      const deletedRecords = await db[table].where('sync_status').equals('deleted').toArray();
      for (const record of deletedRecords) {
        try {
          const { error } = await supabase.from(table).delete().eq('id', record.id);
          if (error) {
            if (error.code === 'PGRST116' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
              console.warn(`Table '${table}' does not exist in Supabase. Removing local deleted record.`);
              await db[table].delete(record.id);
            } else {
              console.error(`Error deleting ${table} record ${record.id}:`, error);
            }
          } else {
            await db[table].delete(record.id);
          }
        } catch (deleteError) {
          console.error(`Exception while deleting ${table} record ${record.id}:`, deleteError);
        }
      }
    } catch (tableError) {
      console.error(`Error processing table ${table}:`, tableError);
    }
  }
};

// Function to trigger automatic sync with debouncing
const triggerAutoSync = () => {
  // Only trigger auto-sync if we're online
  if (!navigator.onLine) {
    console.log('📴 Device offline - auto-sync will be triggered when back online');
    return;
  }
  
  // Clear any existing timeout to debounce multiple rapid changes
  if (autoSyncTimeout) {
    clearTimeout(autoSyncTimeout);
  }
  
  // Set a new timeout to sync after the delay
  autoSyncTimeout = setTimeout(async () => {
    // Prevent multiple concurrent syncs
    if (isSyncing) {
      console.log('🔄 Sync already in progress, skipping auto-sync');
      return;
    }
    
    try {
      isSyncing = true;
      console.log('🤖 Auto-sync triggered - syncing changes to Supabase...');
      await syncWithSupabase();
      console.log('✅ Auto-sync completed successfully');
    } catch (error) {
      console.error('❌ Auto-sync failed:', error);
      // Retry after 10 seconds if sync fails
      setTimeout(() => {
        if (navigator.onLine) {
          console.log('🔄 Retrying auto-sync after failure...');
          triggerAutoSync();
        }
      }, 10000);
    } finally {
      isSyncing = false;
      autoSyncTimeout = null;
    }
  }, AUTO_SYNC_DELAY);
  
  console.log(`⏰ Auto-sync scheduled in ${AUTO_SYNC_DELAY}ms`);
};

// Function to manually trigger sync
export const forceSyncWithSupabase = async () => {
  console.log('🚀 Manual sync triggered...');
  
  // Clear any pending auto-sync
  if (autoSyncTimeout) {
    clearTimeout(autoSyncTimeout);
    autoSyncTimeout = null;
  }
  
  try {
    isSyncing = true;
    await syncWithSupabase();
  } finally {
    isSyncing = false;
  }
};

// Function to check sync status of all tables
export const checkSyncStatus = async () => {
  const tables = ['customers', 'orders', 'measurements', 'measurement_templates'];
  const status = {};
  
  for (const table of tables) {
    const pending = await db[table].where('sync_status').equals('pending').count();
    const synced = await db[table].where('sync_status').equals('synced').count();
    const failed = await db[table].where('sync_status').equals('failed').count();
    const deleted = await db[table].where('sync_status').equals('deleted').count();
    
    status[table] = { pending, synced, failed, deleted, total: pending + synced + failed + deleted };
  }
  
  console.table(status);
  return status;
};

// Function to test Supabase connection
export const testSupabaseConnection = async () => {
  try {
    console.log('🔍 Testing Supabase connection...');
    
    // Test each table
    const tables = ['customers', 'orders', 'measurements', 'measurement_templates'];
    const results = {};
    
    for (const table of tables) {
      try {
        const { data, error } = await supabase.from(table).select('count').limit(1);
        if (error) {
          results[table] = { status: 'error', error: error.message };
        } else {
          results[table] = { status: 'success', accessible: true };
        }
      } catch (err) {
        results[table] = { status: 'error', error: err.message };
      }
    }
    
    console.table(results);
    return results;
  } catch (error) {
    console.error('❌ Supabase connection test failed:', error);
    return { error: error.message };
  }
};

// Listen for online/offline events
window.addEventListener('online', () => {
  console.log('📶 Device came back online - triggering auto-sync');
  triggerAutoSync();
});

window.addEventListener('offline', () => {
  console.log('📴 Device went offline - auto-sync will resume when back online');
  // Clear any pending auto-sync when going offline
  if (autoSyncTimeout) {
    clearTimeout(autoSyncTimeout);
    autoSyncTimeout = null;
  }
});

// Initial sync on app load
syncWithSupabase();

// Function to clean up orphaned order_items
export const cleanupOrphanedOrderItems = async () => {
  try {
    console.log('🧹 Cleaning up orphaned order_items...');
    
    // Get all order_items
    const orderItems = await db.order_items.toArray();
    const orders = await db.orders.toArray();
    const orderIds = new Set(orders.map(order => order.id));
    
    const orphanedItems = [];
    
    for (const item of orderItems) {
      if (!orderIds.has(item.order_id)) {
        orphanedItems.push(item);
      }
    }
    
    console.log(`Found ${orphanedItems.length} orphaned order_items`);
    
    for (const item of orphanedItems) {
      console.log(`🗑️ Deleting orphaned order_item ${item.id} (references missing order ${item.order_id})`);
      await db.order_items.delete(item.id);
    }
    
    console.log(`✅ Cleaned up ${orphanedItems.length} orphaned order_items`);
    return orphanedItems.length;
  } catch (error) {
    console.error('❌ Error cleaning up orphaned order_items:', error);
    return 0;
  }
};

// Function to inspect failed orders
export const inspectFailedOrders = async () => {
  try {
    console.log('🔍 Inspecting failed orders...');
    
    const failedOrders = await db.orders.where('sync_status').equals('failed').toArray();
    const pendingOrders = await db.orders.where('sync_status').equals('pending').toArray();
    
    console.log(`Found ${failedOrders.length} failed orders and ${pendingOrders.length} pending orders`);
    
    [...failedOrders, ...pendingOrders].forEach(order => {
      console.log(`📋 Order ${order.id}:`, {
        sync_status: order.sync_status,
        customer_id: order.customer_id,
        order_date: order.order_date,
        delivery_date: order.delivery_date,
        total_amount: order.total_amount,
        status: order.status,
        receipt_data: typeof order.receipt_data,
        error_reason: order.error_reason
      });
    });
    
    return { failed: failedOrders, pending: pendingOrders };
  } catch (error) {
    console.error('❌ Error inspecting failed orders:', error);
    return { failed: [], pending: [] };
  }
};

// Function to fix failed orders by resetting them to pending
export const fixFailedOrders = async () => {
  try {
    console.log('🔧 Fixing failed orders by resetting to pending...');
    
    const failedOrders = await db.orders.where('sync_status').equals('failed').toArray();
    console.log(`Found ${failedOrders.length} failed orders`);
    
    for (const order of failedOrders) {
      // Reset to pending
      await db.orders.update(order.id, {
        sync_status: 'pending',
        error_reason: undefined
      });
      console.log(`🔄 Reset order ${order.id} to pending`);
    }
    
    console.log(`✅ Fixed ${failedOrders.length} failed orders`);
    return failedOrders.length;
  } catch (error) {
    console.error('❌ Error fixing failed orders:', error);
    return 0;
  }
};

// Function to fix ALL orders (pending and failed) with missing required fields
export const fixAllOrdersRequiredFields = async () => {
  try {
    console.log('🔧 Fixing all orders with missing required fields...');
    
    // Get all orders that are not synced
    const allOrders = await db.orders.where('sync_status').anyOf(['pending', 'failed']).toArray();
    console.log(`Found ${allOrders.length} orders to check`);
    
    let fixedCount = 0;
    
    for (const order of allOrders) {
      const updates = {};
      let needsUpdate = false;
      
      // Check if customer_id is missing (this shouldn't happen but let's be safe)
      if (!order.customer_id) {
        console.warn(`⚠️ Order ${order.id} has no customer_id - this order cannot be synced`);
        updates.sync_status = 'failed';
        updates.error_reason = 'Missing customer_id - order cannot be synced';
        needsUpdate = true;
      }
      
      // Reset failed orders to pending if they have customer_id
      if (order.sync_status === 'failed' && order.customer_id) {
        updates.sync_status = 'pending';
        updates.error_reason = undefined;
        needsUpdate = true;
        console.log(`🔄 Reset order ${order.id} from failed to pending`);
      }
      
      if (needsUpdate) {
        await db.orders.update(order.id, updates);
        fixedCount++;
      }
    }
    
    console.log(`✅ Fixed ${fixedCount} orders with missing required fields`);
    return fixedCount;
  } catch (error) {
    console.error('❌ Error fixing orders with missing required fields:', error);
    return 0;
  }
};

// Function to check IndexedDB structure
export const checkIndexedDBStructure = async () => {
  try {
    console.log('🔍 Checking IndexedDB structure...');
    
    // Check if database is open
    const isOpen = db.isOpen();
    console.log(`Database open status: ${isOpen}`);
    
    if (!isOpen) {
      console.log('📊 Opening database...');
      await db.open();
    }
    
    const tables = ['customers', 'orders', 'order_items', 'measurements', 'measurement_templates'];
    const tableStatus = {};
    
    for (const tableName of tables) {
      try {
        const count = await db[tableName].count();
        tableStatus[tableName] = { exists: true, count };
      } catch (error) {
        tableStatus[tableName] = { exists: false, error: error.message };
      }
    }
    
    console.table(tableStatus);
    return { isOpen, tables: tableStatus };
  } catch (error) {
    console.error('❌ Error checking IndexedDB structure:', error);
    return { error: error.message };
  }
};

// Function to recreate IndexedDB database
export const recreateIndexedDB = async () => {
  try {
    console.log('🔄 Recreating IndexedDB database...');
    
    // Close current database
    if (db.isOpen()) {
      db.close();
    }
    
    // Delete the database
    await db.delete();
    console.log('🗑️ Deleted existing database');
    
    // Recreate with current schema
    const newDb = new Dexie('mytailor');
    newDb.version(4).stores({
      customers: 'id, name, phone, email, address, measurements, sync_status',
      orders: 'id, customer_id, order_date, delivery_date, remind_date, total_amount, advance_payment, status, is_urgent, notes, receipt_data, created_at, updated_at, sync_status',
      order_items: 'id, order_id, product_name, price, quantity, created_at, updated_at, sync_status',
      measurements: 'id, customer_id, template_name, data, sync_status',
      measurement_templates: 'id, name, fields, sync_status',
    });
    
    // Open the new database
    await newDb.open();
    console.log('✅ Database recreated successfully');
    
    // Update the global db reference
    Object.setPrototypeOf(db, newDb);
    Object.assign(db, newDb);
    
    // Verify structure
    await checkIndexedDBStructure();
    
    return true;
  } catch (error) {
    console.error('❌ Error recreating IndexedDB:', error);
    return false;
  }
};

// Function to force database initialization
export const initializeDatabase = async () => {
  try {
    console.log('🚀 Initializing database...');
    
    if (!db.isOpen()) {
      await db.open();
    }
    
    // Test each table
    const tables = ['customers', 'orders', 'order_items', 'measurements', 'measurement_templates'];
    for (const table of tables) {
      try {
        await db[table].count();
        console.log(`✅ Table '${table}' is accessible`);
      } catch (error) {
        console.error(`❌ Table '${table}' error:`, error.message);
      }
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    return false;
  }
};

// Make functions available globally for debugging
if (typeof window !== 'undefined') {
  window.forceSyncWithSupabase = forceSyncWithSupabase;
  window.checkSyncStatus = checkSyncStatus;
  window.testSupabaseConnection = testSupabaseConnection;
  window.cleanupOrphanedOrderItems = cleanupOrphanedOrderItems;
  window.inspectFailedOrders = inspectFailedOrders;
  window.fixFailedOrders = fixFailedOrders;
  window.fixAllOrdersRequiredFields = fixAllOrdersRequiredFields;
  window.checkIndexedDBStructure = checkIndexedDBStructure;
  window.recreateIndexedDB = recreateIndexedDB;
  window.initializeDatabase = initializeDatabase;
}

