// Debug script to check orders sync status
// Open browser console and paste this code to run diagnostics

console.log('🔍 Starting Orders Debug Session...');

// Function to check sync status
async function debugOrdersSync() {
  try {
    console.log('📊 Checking sync status...');
    await window.checkSyncStatus();
    
    console.log('🔍 Inspecting failed orders...');
    const failedOrders = await window.inspectFailedOrders();
    
    console.log('🧹 Cleaning up orphaned order items...');
    await window.cleanupOrphanedOrderItems();
    
    console.log('🔧 Fixing orders with missing required fields...');
    const fixedCount = await window.fixAllOrdersRequiredFields();
    
    console.log('🌐 Testing Supabase connection...');
    await window.testSupabaseConnection();
    
    if (fixedCount > 0) {
      console.log('🚀 Attempting manual sync after fixes...');
      await window.forceSyncWithSupabase();
    }
    
    console.log('✅ Debug session complete!');
    
  } catch (error) {
    console.error('❌ Debug session failed:', error);
  }
}

// Function to inspect database structure
async function checkDatabaseStructure() {
  console.log('🗄️ Checking IndexedDB structure...');
  await window.checkIndexedDBStructure();
}

// Function to recreate database if needed
async function recreateDatabase() {
  console.log('⚠️ Recreating IndexedDB database...');
  const success = await window.recreateIndexedDB();
  if (success) {
    console.log('✅ Database recreated successfully. Please refresh the page.');
  } else {
    console.log('❌ Failed to recreate database.');
  }
}

// Run the debug functions
console.log('Available debug functions:');
console.log('- debugOrdersSync(): Run full diagnostic');
console.log('- checkDatabaseStructure(): Check IndexedDB structure');
console.log('- recreateDatabase(): Recreate IndexedDB (use with caution)');
console.log('');
console.log('Running full diagnostic now...');

debugOrdersSync();
