// Test script to verify orders sync with Supabase
// Run this in browser console after opening the app

console.log('🧪 Testing Orders Sync...');

async function testOrdersSync() {
  try {
    // First, let's check if we can access Supabase directly
    console.log('1. Testing direct Supabase connection...');
    
    // Import the supabase client
    const { supabase } = window;
    if (!supabase) {
      console.error('❌ Supabase client not available on window object');
      return;
    }
    
    // Test if orders table exists
    console.log('2. Checking if orders table exists...');
    const { data: ordersTest, error: ordersError } = await supabase
      .from('orders')
      .select('count')
      .limit(1);
      
    if (ordersError) {
      console.error('❌ Orders table error:', ordersError);
      console.log('📝 Need to create orders table in Supabase first!');
      return;
    }
    
    console.log('✅ Orders table exists');
    
    // Test if customers table exists (needed as foreign key)
    console.log('3. Checking if customers table exists...');
    const { data: customersTest, error: customersError } = await supabase
      .from('customers')
      .select('count')
      .limit(1);
      
    if (customersError) {
      console.error('❌ Customers table error:', customersError);
      console.log('📝 Need to create customers table in Supabase first!');
      return;
    }
    
    console.log('✅ Customers table exists');
    
    // Check current sync status
    console.log('4. Checking current sync status...');
    await window.checkSyncStatus();
    
    // Get failed orders details
    console.log('5. Getting failed orders details...');
    const failedData = await window.inspectFailedOrders();
    
    if (failedData.failed.length > 0) {
      console.log('6. Analyzing failed orders...');
      failedData.failed.forEach((order, index) => {
        console.log(`Failed Order ${index + 1}:`, {
          id: order.id,
          customer_id: order.customer_id,
          user_id: order.user_id,
          sync_status: order.sync_status,
          error_reason: order.error_reason,
          has_receipt_data: !!order.receipt_data,
          receipt_data_type: typeof order.receipt_data
        });
      });
    }
    
    if (failedData.pending.length > 0) {
      console.log('7. Analyzing pending orders...');
      failedData.pending.forEach((order, index) => {
        console.log(`Pending Order ${index + 1}:`, {
          id: order.id,
          customer_id: order.customer_id,
          user_id: order.user_id,
          sync_status: order.sync_status,
          has_receipt_data: !!order.receipt_data,
          receipt_data_type: typeof order.receipt_data
        });
      });
    }
    
    // Try to fix orders
    console.log('8. Attempting to fix orders...');
    const fixedCount = await window.fixAllOrdersRequiredFields();
    console.log(`Fixed ${fixedCount} orders`);
    
    // Force sync
    console.log('9. Force syncing...');
    await window.forceSyncWithSupabase();
    
    // Check final status
    console.log('10. Final sync status check...');
    await window.checkSyncStatus();
    
    console.log('✅ Test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Make supabase available on window for testing
import('../src/supabaseClient.js').then(module => {
  window.supabase = module.default;
  console.log('✅ Supabase client loaded');
  testOrdersSync();
}).catch(error => {
  console.error('❌ Failed to load Supabase client:', error);
  // Try alternative approach
  testOrdersSync();
});
