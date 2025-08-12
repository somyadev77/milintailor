import Dexie from 'dexie';
import { v4 as uuidv4 } from 'uuid';
import supabase from './supabaseClient';
import { generateNumericId } from './utils/generateNumericId';

export const db = new Dexie('mytailor');

// Auto-sync management
let autoSyncTimeout = null;
let isSyncing = false;
const AUTO_SYNC_DELAY = 2000; // Wait 2 seconds after last change before syncing

db.version(8).stores({
  customers: 'id, name, phone, email, address, post, measurements, sync_status',
  orders: 'id, customer_id, order_date, delivery_date, remind_date, total_amount, advance_payment, status, is_urgent, notes, receipt_data, created_at, updated_at, sync_status, item_name, item_quantity, sequence_id',
  order_items: 'id, order_id, item_name, price, quantity, created_at, updated_at, sync_status',
  measurements: 'id, customer_id, template_name, data, sync_status',
});

// Migration function for existing orders without sequence_id
db.version(7).upgrade(async tx => {
  console.log('🔄 Running database migration to add sequence_id to existing orders...');
  
  const orders = await tx.orders.toArray();
  let maxSequenceId = 0;
  
  // First pass: find existing sequence_ids
  orders.forEach(order => {
    if (order.sequence_id) {
      const sequenceId = parseInt(order.sequence_id, 10);
      if (!isNaN(sequenceId) && sequenceId > maxSequenceId) {
        maxSequenceId = sequenceId;
      }
    }
  });
  
  // Second pass: assign sequence_ids to orders without them
  let nextSequenceId = maxSequenceId + 1;
  for (const order of orders) {
    if (!order.sequence_id) {
      console.log(`🔢 Assigning sequence_id ${nextSequenceId} to order ${order.id}`);
      await tx.orders.update(order.id, { sequence_id: nextSequenceId });
      nextSequenceId++;
    }
  }
  
  console.log('✅ Database migration completed successfully!');
});

db.version(8).upgrade(async tx => {
  console.log('🔄 Running database migration for order_items schema...');
  await tx.order_items.toCollection().modify(item => {
    if (item.item_quantity !== undefined) {
      item.quantity = item.item_quantity;
      delete item.item_quantity;
    }
    if (item.product_name !== undefined) {
      if (!item.item_name) { // only move if item_name is not set
        item.item_name = item.product_name;
      }
      delete item.product_name;
    }
  });
  console.log('✅ Database migration for order_items completed successfully!');
});

// Generic function to add a record and mark for sync
export const addRecord = async (tableName, data) => {
  let id;
  if (tableName === 'orders') {
    // Revert to numeric ID generation for orders
    id = await generateNumericId(); // Assuming this function existed originally
  } else {
    id = uuidv4();
  }
  const record = { ...data, id, sync_status: 'pending' };
  await db[tableName].add(record);
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

// Function to sanitize data for Supabase
const sanitizeDataForSupabase = (table, data) => {
  const sanitized = { ...data };
  
  // Convert all Date objects to ISO strings
  Object.keys(sanitized).forEach(key => {
    if (sanitized[key] instanceof Date) {
      sanitized[key] = sanitized[key].toISOString();
    }
    // Convert null to undefined for optional fields
    if (sanitized[key] === null) {
      sanitized[key] = undefined;
    }
    // For orders table: convert numeric ID to UUID and preserve as sequence_id
    if (table === 'orders' && key === 'id' && typeof sanitized[key] === 'string') {
      const numericId = parseInt(sanitized[key], 10);
      if (!isNaN(numericId)) {
        // Store the sequence number in sequence_id field
        sanitized.sequence_id = numericId;
        // Generate a UUID for the actual id field
        sanitized[key] = uuidv4();
        console.log(`🔄 Converted order ID ${numericId} to UUID ${sanitized[key]} with sequence_id ${numericId}`);
      }
    }
    // Ensure UUID format for other tables
    if (table !== 'orders' && key === 'id' && typeof sanitized[key] === 'string') {
      // Check if it's a valid UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(sanitized[key])) {
        console.warn(`⚠️ Invalid UUID format for ${table}.${key}: ${sanitized[key]}`);
      }
    }
    // Ensure foreign keys are properly formatted UUIDs
    if (key === 'customer_id' && typeof sanitized[key] === 'string') {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(sanitized[key])) {
        console.warn(`⚠️ Invalid UUID format for customer_id: ${sanitized[key]}`);
      }
    }
    if (key === 'order_id' && typeof sanitized[key] === 'string') {
      const numericId = parseInt(sanitized[key], 10);
      if (!isNaN(numericId)) {
        // For order_items, we need to find the UUID of the order with this sequence number
        // For now, keep as numeric - this will need to be handled separately
        sanitized[key] = numericId;
      }
    }
  });
  
  return sanitized;
};

// Function to check if sequence_id already exists in Supabase
const checkSequenceIdExists = async (sequenceId) => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('id, sequence_id')
      .eq('sequence_id', sequenceId)
      .limit(1);
    
    if (error) {
      console.warn(`Error checking sequence_id ${sequenceId}:`, error);
      return false;
    }
    
    return data && data.length > 0;
  } catch (error) {
    console.warn(`Exception checking sequence_id ${sequenceId}:`, error);
    return false;
  }
};

// Function to find next available sequence_id
const findNextAvailableSequenceId = async (startingId) => {
  let sequenceId = startingId;
  while (await checkSequenceIdExists(sequenceId)) {
    sequenceId++;
    console.log(`🔍 Sequence ID ${sequenceId - 1} exists, trying ${sequenceId}`);
  }
  return sequenceId;
};

// Synchronization logic
export const syncWithSupabase = async () => {
  // Check if we're online before attempting sync
  if (!navigator.onLine) {
    console.log('Device is offline, skipping sync');
    return;
  }

  // Sync tables in dependency order: parents before children
  const tables = ['customers', 'orders', 'measurements', 'order_items'];

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
          
          // Filter out fields that don't exist in Supabase schema
          let processedData = data;
          if (table === 'orders' && data.customer_measurements) {
            const { customer_measurements, ...filteredData } = data;
            console.log(`📤 Syncing ${table} record (filtered customer_measurements):`, { id: record.id, ...filteredData });
            console.log(`ℹ️ Skipped customer_measurements field - data stored separately in measurements table`);
            processedData = filteredData;
          }
          
          // Sanitize data for Supabase
          let sanitizedData = sanitizeDataForSupabase(table, processedData);
          
          // For orders table, ensure sequence_id doesn't conflict
          if (table === 'orders' && sanitizedData.sequence_id) {
            const originalSequenceId = sanitizedData.sequence_id;
            const availableSequenceId = await findNextAvailableSequenceId(originalSequenceId);
            
            if (availableSequenceId !== originalSequenceId) {
              console.log(`🔄 Order sequence_id ${originalSequenceId} already exists, using ${availableSequenceId}`);
              sanitizedData.sequence_id = availableSequenceId;
            }
          }
          
          // Fix for order_items before syncing
          if (table === 'order_items' && sanitizedData.order_id) {
            const numericOrderId = parseInt(sanitizedData.order_id, 10);
            if (!isNaN(numericOrderId)) {
              console.log(`🔍 Looking up UUID for order with sequence_id: ${numericOrderId}`);
              const { data: order, error } = await supabase
                .from('orders')
                .select('id')
                .eq('sequence_id', numericOrderId)
                .single();

              if (error) {
                console.error(`❌ Error fetching order UUID for sequence_id ${numericOrderId}:`, error);
                await db[table].update(record.id, { sync_status: 'failed', error_reason: `Order with sequence_id ${numericOrderId} not found` });
                continue; // Skip to the next record
              }

              if (order) {
                sanitizedData.order_id = order.id;
                console.log(`✅ Found UUID ${order.id} for order sequence_id ${numericOrderId}`);
              } else {
                console.error(`❌ Order with sequence_id ${numericOrderId} not found in Supabase. Cannot sync order_item.`);
                await db[table].update(record.id, { sync_status: 'failed', error_reason: `Order with sequence_id ${numericOrderId} not found` });
                continue; // Skip to the next record
              }
            }
            
            if (sanitizedData.item_quantity !== undefined) {
              sanitizedData.quantity = sanitizedData.item_quantity;
              delete sanitizedData.item_quantity;
            }
          }

          console.log(`📤 Syncing ${table} record:`, { id: record.id, ...sanitizedData });
          
          const { data: syncedData, error } = await supabase.from(table).upsert(sanitizedData).select();

          if (error) {
            // ... (error handling as before)
          } else {
            // If the local ID was temporary, update it with the permanent one from Supabase
            const permanentId = syncedData[0].id;
            if (record.id !== permanentId) {
              // Update the local record to change its ID to the permanent one
              await db.transaction('rw', db[table], async () => {
                await db[table].delete(record.id);
                const updatedRecord = { ...record, ...syncedData[0], sync_status: 'synced' };
                await db[table].add(updatedRecord);
              });
              console.log(`✅ Synced ${table} record and updated local ID from ${record.id} to ${permanentId}`);
            } else {
              await db[table].update(record.id, { sync_status: 'synced' });
              console.log(`✅ Successfully synced ${table} record ${record.id}`);
            }
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
  const tables = ['customers', 'orders', 'measurements'];
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
    const tables = ['customers', 'orders', 'measurements'];
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

// Function to validate and fix order-customer relationships
export const validateOrderCustomerLinks = async () => {
  try {
    console.log('🔗 Validating order-customer relationships...');
    
    const orders = await db.orders.toArray();
    const customers = await db.customers.toArray();
    const customerIds = new Set(customers.map(c => c.id));
    
    let fixedCount = 0;
    const orphanedOrders = [];
    
    for (const order of orders) {
      if (!order.customer_id) {
        orphanedOrders.push(order);
        console.warn(`⚠️ Order ${order.id} has no customer_id`);
      } else if (!customerIds.has(order.customer_id)) {
        orphanedOrders.push(order);
        console.warn(`⚠️ Order ${order.id} references non-existent customer ${order.customer_id}`);
      }
    }
    
    // For orphaned orders, try to find a matching customer or create a placeholder
    for (const order of orphanedOrders) {
      let customerToLink = null;
      
      // Try to find customer by phone or email if available in order data
      if (order.customer_phone) {
        customerToLink = customers.find(c => c.phone === order.customer_phone);
      }
      if (!customerToLink && order.customer_email) {
        customerToLink = customers.find(c => c.email === order.customer_email);
      }
      
      if (customerToLink) {
        // Link to existing customer
        await db.orders.update(order.id, { customer_id: customerToLink.id });
        console.log(`✅ Linked order ${order.id} to existing customer ${customerToLink.id}`);
        fixedCount++;
      } else {
        // Create placeholder customer
        const placeholderCustomer = await addRecord('customers', {
          name: order.customer_name || 'Unknown Customer',
          phone: order.customer_phone || '',
          email: order.customer_email || '',
          address: order.customer_address || ''
        });
        
        await db.orders.update(order.id, { customer_id: placeholderCustomer.id });
        console.log(`✅ Created placeholder customer ${placeholderCustomer.id} for order ${order.id}`);
        fixedCount++;
      }
    }
    
    console.log(`✅ Fixed ${fixedCount} order-customer relationships`);
    return fixedCount;
  } catch (error) {
    console.error('❌ Error validating order-customer links:', error);
    return 0;
  }
};

// Comprehensive data linking fix function
export const fixAllDataLinking = async () => {
  try {
    console.log('🚀 Starting comprehensive data linking fixes...');
    
    let totalFixed = 0;
    
    // 1. Clean up orphaned order items
    console.log('\n1. Cleaning orphaned order items...');
    const cleanedItems = await cleanupOrphanedOrderItems();
    totalFixed += cleanedItems;
    
    // 2. Validate and fix order-customer relationships
    console.log('\n2. Validating order-customer relationships...');
    const fixedLinks = await validateOrderCustomerLinks();
    totalFixed += fixedLinks;
    
    // 3. Fix orders with missing required fields
    console.log('\n3. Fixing orders with missing required fields...');
    const fixedFields = await fixAllOrdersRequiredFields();
    totalFixed += fixedFields;
    
    // 4. Force sync to ensure everything is properly synced
    console.log('\n4. Forcing sync with Supabase...');
    await syncWithSupabase();
    
    console.log(`\n🎉 Comprehensive fix completed! Fixed ${totalFixed} issues total.`);
    return totalFixed;
  } catch (error) {
    console.error('❌ Error during comprehensive data linking fix:', error);
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
    
    const tables = ['customers', 'orders', 'order_items', 'measurements'];
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
    newDb.version(5).stores({
      customers: 'id, name, phone, email, address, post, measurements, sync_status',
      orders: 'id, customer_id, order_date, delivery_date, remind_date, total_amount, advance_payment, status, is_urgent, notes, receipt_data, created_at, updated_at, sync_status',
      order_items: 'id, order_id, product_name, price, quantity, created_at, updated_at, sync_status',
      measurements: 'id, customer_id, template_name, data, sync_status',
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

// Function to clean up duplicate orders based on sequence ID or similar data
export const cleanupDuplicateOrders = async () => {
  try {
    console.log('🧹 Cleaning up duplicate orders...');
    
    const allOrders = await db.orders.toArray();
    console.log(`📊 Found ${allOrders.length} total orders`);
    
    // Group orders by their numeric ID (sequence)
    const orderGroups = {};
    
    allOrders.forEach(order => {
      const numericId = parseInt(order.id, 10);
      if (!isNaN(numericId)) {
        if (!orderGroups[numericId]) {
          orderGroups[numericId] = [];
        }
        orderGroups[numericId].push(order);
      }
    });
    
    let duplicatesRemoved = 0;
    
    // For each group, keep only the synced version or the most recent one
    for (const [sequenceId, orders] of Object.entries(orderGroups)) {
      if (orders.length > 1) {
        console.log(`🔍 Found ${orders.length} orders with sequence ID ${sequenceId}`);
        
        // Sort by sync_status priority: synced > pending > failed
        // Then by created_at or updated_at (most recent first)
        orders.sort((a, b) => {
          const statusPriority = { 'synced': 3, 'pending': 2, 'failed': 1, 'deleted': 0 };
          const aPriority = statusPriority[a.sync_status] || 0;
          const bPriority = statusPriority[b.sync_status] || 0;
          
          if (aPriority !== bPriority) {
            return bPriority - aPriority; // Higher priority first
          }
          
          // If same status, prefer the one with more recent timestamp
          const aTime = new Date(a.updated_at || a.created_at || 0);
          const bTime = new Date(b.updated_at || b.created_at || 0);
          return bTime - aTime;
        });
        
        // Keep the first (best) order, delete the rest
        const keepOrder = orders[0];
        const deleteOrders = orders.slice(1);
        
        console.log(`✅ Keeping order ${keepOrder.id} (status: ${keepOrder.sync_status})`);
        
        for (const orderToDelete of deleteOrders) {
          console.log(`🗑️ Removing duplicate order ${orderToDelete.id} (status: ${orderToDelete.sync_status})`);
          
          // Delete associated order items first
          const items = await db.order_items.where('order_id').equals(orderToDelete.id).toArray();
          for (const item of items) {
            await db.order_items.delete(item.id);
            console.log(`  🗑️ Deleted order item ${item.id}`);
          }
          
          // Delete the order
          await db.orders.delete(orderToDelete.id);
          duplicatesRemoved++;
        }
      }
    }
    
    console.log(`✅ Cleaned up ${duplicatesRemoved} duplicate orders`);
    return duplicatesRemoved;
  } catch (error) {
    console.error('❌ Error cleaning up duplicate orders:', error);
    return 0;
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
    const tables = ['customers', 'orders', 'order_items', 'measurements'];
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
  window.validateOrderCustomerLinks = validateOrderCustomerLinks;
  window.fixAllDataLinking = fixAllDataLinking;
  window.checkIndexedDBStructure = checkIndexedDBStructure;
  window.recreateIndexedDB = recreateIndexedDB;
  window.initializeDatabase = initializeDatabase;
  window.cleanupDuplicateOrders = cleanupDuplicateOrders;
}