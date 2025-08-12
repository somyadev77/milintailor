// Debug utility to check measurement data integrity
import { db } from '../db';

export const debugMeasurements = async () => {
  try {
    console.log('🔍 Debugging measurement data...');
    
    // Get all measurements from local database
    const allMeasurements = await db.measurements.toArray();
    
    console.log(`📊 Found ${allMeasurements.length} measurements in local database`);
    
    allMeasurements.forEach((measurement, index) => {
      console.log(`\n📋 Measurement ${index + 1}:`);
      console.log(`  ID: ${measurement.id}`);
      console.log(`  Customer ID: ${measurement.customer_id}`);
      console.log(`  Template: ${measurement.template_name}`);
      console.log(`  Sync Status: ${measurement.sync_status}`);
      
      // Check if data is valid
      if (typeof measurement.data === 'string') {
        console.error(`❌ Data is a string (should be object):`, measurement.data);
      } else if (measurement.data && typeof measurement.data === 'object') {
        console.log(`  Data keys: ${Object.keys(measurement.data).join(', ')}`);
        
        // Check for suspicious string-like data
        Object.entries(measurement.data).forEach(([key, value]) => {
          if (key.match(/^\d+$/)) {
            console.error(`❌ Found numeric key "${key}" with value "${value}" - possible string iteration!`);
          }
        });
      } else {
        console.warn(`⚠️ Data is not an object:`, typeof measurement.data, measurement.data);
      }
    });
    
    return allMeasurements;
  } catch (error) {
    console.error('Error debugging measurements:', error);
    return [];
  }
};

export const debugOrderData = async () => {
  try {
    console.log('🔍 Debugging order data...');
    
    // Get all orders from local database
    const allOrders = await db.orders.toArray();
    const allOrderItems = await db.order_items.toArray();
    
    console.log(`📊 Found ${allOrders.length} orders and ${allOrderItems.length} order items in local database`);
    
    allOrders.forEach((order, index) => {
      console.log(`\n📋 Order ${index + 1}:`);
      console.log(`  ID: ${order.id} (type: ${typeof order.id})`);
      console.log(`  Customer ID: ${order.customer_id}`);
      console.log(`  Sync Status: ${order.sync_status}`);
      
      if (order.sync_status === 'failed') {
        console.error(`❌ Order sync failed:`, order.error_reason || 'No error reason');
      }
    });
    
    allOrderItems.forEach((item, index) => {
      console.log(`\n📦 Order Item ${index + 1}:`);
      console.log(`  ID: ${item.id} (type: ${typeof item.id})`);
      console.log(`  Order ID: ${item.order_id} (type: ${typeof item.order_id})`);
      console.log(`  Sync Status: ${item.sync_status}`);
      
      if (item.sync_status === 'failed') {
        console.error(`❌ Order item sync failed:`, item.error_reason || 'No error reason');
      }
    });
    
    return { orders: allOrders, orderItems: allOrderItems };
  } catch (error) {
    console.error('Error debugging orders:', error);
    return { orders: [], orderItems: [] };
  }
};

// Clean up corrupted measurement data
export const cleanupCorruptedMeasurements = async () => {
  try {
    console.log('🧹 Cleaning up corrupted measurement data...');
    
    const allMeasurements = await db.measurements.toArray();
    let cleanedCount = 0;
    
    for (const measurement of allMeasurements) {
      let needsUpdate = false;
      const cleanedData = {};
      
      if (measurement.data && typeof measurement.data === 'object') {
        // Check for numeric keys (string iteration artifacts)
        Object.entries(measurement.data).forEach(([key, value]) => {
          if (!key.match(/^\d+$/)) {
            // Keep non-numeric keys
            cleanedData[key] = value;
          } else {
            console.log(`🗑️ Removing corrupted key "${key}": "${value}" from measurement ${measurement.id}`);
            needsUpdate = true;
          }
        });
        
        if (needsUpdate) {
          await db.measurements.update(measurement.id, {
            data: cleanedData,
            sync_status: 'pending'
          });
          cleanedCount++;
          console.log(`✅ Cleaned measurement ${measurement.id}`);
        }
      }
    }
    
    console.log(`🧹 Cleaned ${cleanedCount} corrupted measurements`);
    return cleanedCount;
  } catch (error) {
    console.error('Error cleaning up measurements:', error);
    return 0;
  }
};
