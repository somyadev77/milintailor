// Database Data Linking Diagnostic Script
// Run this in browser console to diagnose data linking issues

console.log("🔍 Starting Data Linking Diagnostic...");

// Function to diagnose data linking issues
async function diagnoseDatabaseLinking() {
  try {
    console.log("📊 Checking IndexedDB structure...");
    const dbStructure = await window.checkIndexedDBStructure();
    console.log("Database structure:", dbStructure);

    console.log("\n📈 Checking sync status...");
    const syncStatus = await window.checkSyncStatus();
    console.log("Sync status:", syncStatus);

    console.log("\n🔗 Checking order-customer relationships...");
    
    // Get all orders
    const orders = await db.orders.toArray();
    console.log(`Found ${orders.length} orders`);

    // Get all customers
    const customers = await db.customers.toArray();
    console.log(`Found ${customers.length} customers`);
    
    // Get all order items
    const orderItems = await db.order_items.toArray();
    console.log(`Found ${orderItems.length} order items`);

    // Check for orphaned orders (orders without valid customer_id)
    const orphanedOrders = [];
    const customerIds = new Set(customers.map(c => c.id));
    
    for (const order of orders) {
      if (!order.customer_id) {
        orphanedOrders.push({
          id: order.id,
          issue: "Missing customer_id",
          sync_status: order.sync_status
        });
      } else if (!customerIds.has(order.customer_id)) {
        orphanedOrders.push({
          id: order.id,
          customer_id: order.customer_id,
          issue: "customer_id references non-existent customer",
          sync_status: order.sync_status
        });
      }
    }

    if (orphanedOrders.length > 0) {
      console.warn(`⚠️  Found ${orphanedOrders.length} orphaned orders:`);
      console.table(orphanedOrders);
    } else {
      console.log("✅ All orders have valid customer references");
    }

    // Check for orphaned order items (items without valid order_id)
    const orphanedItems = [];
    const orderIds = new Set(orders.map(o => o.id));
    
    for (const item of orderItems) {
      if (!item.order_id) {
        orphanedItems.push({
          id: item.id,
          issue: "Missing order_id",
          sync_status: item.sync_status
        });
      } else if (!orderIds.has(item.order_id)) {
        orphanedItems.push({
          id: item.id,
          order_id: item.order_id,
          issue: "order_id references non-existent order",
          sync_status: item.sync_status
        });
      }
    }

    if (orphanedItems.length > 0) {
      console.warn(`⚠️  Found ${orphanedItems.length} orphaned order items:`);
      console.table(orphanedItems);
    } else {
      console.log("✅ All order items have valid order references");
    }

    // Check orders with failed sync status
    const failedOrders = orders.filter(o => o.sync_status === 'failed');
    if (failedOrders.length > 0) {
      console.warn(`⚠️  Found ${failedOrders.length} orders with failed sync:`);
      failedOrders.forEach(order => {
        console.log(`Order ${order.id}: ${order.error_reason || 'No error reason'}`);
      });
    }

    // Check for customers without names
    const customersWithoutNames = customers.filter(c => !c.name || c.name.trim() === '');
    if (customersWithoutNames.length > 0) {
      console.warn(`⚠️  Found ${customersWithoutNames.length} customers without names:`);
      console.table(customersWithoutNames.map(c => ({
        id: c.id,
        phone: c.phone,
        email: c.email,
        sync_status: c.sync_status
      })));
    }

    // Sample order data for inspection
    if (orders.length > 0) {
      console.log("\n📋 Sample order data:");
      const sampleOrder = orders[0];
      console.log("Sample order structure:", {
        id: sampleOrder.id,
        customer_id: sampleOrder.customer_id,
        order_date: sampleOrder.order_date,
        delivery_date: sampleOrder.delivery_date,
        total_amount: sampleOrder.total_amount,
        status: sampleOrder.status,
        sync_status: sampleOrder.sync_status,
        has_customer_id: !!sampleOrder.customer_id,
        customer_id_type: typeof sampleOrder.customer_id
      });
      
      // Check if this order has a matching customer
      if (sampleOrder.customer_id) {
        const matchingCustomer = customers.find(c => c.id === sampleOrder.customer_id);
        if (matchingCustomer) {
          console.log("✅ Sample order has matching customer:", {
            customer_id: matchingCustomer.id,
            customer_name: matchingCustomer.name,
            customer_phone: matchingCustomer.phone
          });
        } else {
          console.warn("❌ Sample order customer_id doesn't match any customer");
        }
      }
      
      // Check order items for this order
      const orderItemsForSample = orderItems.filter(item => item.order_id === sampleOrder.id);
      console.log(`Order has ${orderItemsForSample.length} items`);
    }

    console.log("\n🧪 Testing Supabase connection...");
    const supabaseTest = await window.testSupabaseConnection();
    console.log("Supabase connection test:", supabaseTest);

    return {
      orders: orders.length,
      customers: customers.length,
      orderItems: orderItems.length,
      orphanedOrders: orphanedOrders.length,
      orphanedItems: orphanedItems.length,
      failedOrders: failedOrders.length,
      customersWithoutNames: customersWithoutNames.length
    };

  } catch (error) {
    console.error("❌ Error during diagnosis:", error);
    return { error: error.message };
  }
}

// Function to fix common data linking issues
async function fixDataLinkingIssues() {
  console.log("🔧 Starting automatic fixes...");

  try {
    // 1. Clean up orphaned order items
    console.log("1. Cleaning orphaned order items...");
    const cleanedItems = await window.cleanupOrphanedOrderItems();
    console.log(`✅ Cleaned ${cleanedItems} orphaned order items`);

    // 2. Fix failed orders
    console.log("2. Fixing failed orders...");
    const fixedOrders = await window.fixAllOrdersRequiredFields();
    console.log(`✅ Fixed ${fixedOrders} orders with issues`);

    // 3. Force sync to Supabase
    console.log("3. Forcing sync with Supabase...");
    await window.forceSyncWithSupabase();
    console.log("✅ Sync completed");

    // 4. Re-run diagnosis
    console.log("4. Re-running diagnosis...");
    const result = await diagnoseDatabaseLinking();
    
    return result;
  } catch (error) {
    console.error("❌ Error during fixes:", error);
    return { error: error.message };
  }
}

// Function to recreate database if severely corrupted
async function recreateDatabase() {
  console.log("🔄 Recreating database (this will delete all local data)...");
  
  if (!confirm("⚠️ This will delete all local data and recreate the database. Are you sure?")) {
    console.log("❌ Database recreation cancelled");
    return;
  }

  try {
    const result = await window.recreateIndexedDB();
    if (result) {
      console.log("✅ Database recreated successfully");
      console.log("🔄 Please refresh the page to continue");
    } else {
      console.error("❌ Failed to recreate database");
    }
    return result;
  } catch (error) {
    console.error("❌ Error recreating database:", error);
    return false;
  }
}

// Make functions available globally
window.diagnoseDatabaseLinking = diagnoseDatabaseLinking;
window.fixDataLinkingIssues = fixDataLinkingIssues;
window.recreateDatabase = recreateDatabase;

console.log(`
🎯 Diagnostic functions available:

1. diagnoseDatabaseLinking() - Check for data linking issues
2. fixDataLinkingIssues() - Automatically fix common issues  
3. recreateDatabase() - Recreate database (deletes all data)

Run: await diagnoseDatabaseLinking()
`);

// Auto-run diagnosis
diagnoseDatabaseLinking().then(result => {
  console.log("\n📊 Diagnosis Summary:", result);
  
  if (result.orphanedOrders > 0 || result.orphanedItems > 0 || result.failedOrders > 0) {
    console.log("\n💡 Issues found! Run: await fixDataLinkingIssues()");
  } else if (result.error) {
    console.log("\n💡 Database issues detected! Consider running: await recreateDatabase()");
  } else {
    console.log("\n✅ No major data linking issues found!");
  }
});
