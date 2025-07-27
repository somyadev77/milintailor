# Fix Orders Sync Issues - Step by Step Guide

## Problem
Orders are failing to sync with Supabase database.

## Solution Steps

### Step 1: Execute the Supabase Schema
1. Open your Supabase dashboard
2. Go to the SQL Editor
3. Copy and paste the content from `supabase_orders_schema.sql`
4. Execute the script to create/recreate the orders and order_items tables

### Step 2: Clear and Recreate Local Database
1. Open your browser and navigate to http://localhost:3000
2. Open Developer Tools (F12)
3. Go to the Console tab
4. Run the following commands:

```javascript
// Check current database structure
await window.checkIndexedDBStructure();

// Recreate the database with updated schema
await window.recreateIndexedDB();

// Refresh the page after database recreation
location.reload();
```

### Step 3: Debug Current Issues
After refreshing the page, run the debug script:

```javascript
// Copy and paste the content from debug_orders.js file
// This will run a comprehensive diagnostic
```

### Step 4: Manual Troubleshooting Commands

If issues persist, run these commands one by one in the browser console:

```javascript
// 1. Check sync status
await window.checkSyncStatus();

// 2. Inspect failed orders
await window.inspectFailedOrders();

// 3. Fix orders with missing required fields
await window.fixAllOrdersRequiredFields();

// 4. Clean up orphaned order items
await window.cleanupOrphanedOrderItems();

// 5. Test Supabase connection
await window.testSupabaseConnection();

// 6. Force manual sync
await window.forceSyncWithSupabase();

// 7. Check final status
await window.checkSyncStatus();
```

### Step 5: Test Order Creation
1. Go to "Create New Order" in the app
2. Fill out a test order with customer details
3. Submit the order
4. Check the console for sync messages
5. Verify the order appears in both local storage and Supabase

### Common Issues and Solutions

#### Issue: Table doesn't exist error
**Solution:** Make sure you've executed the SQL schema in Supabase

#### Issue: Foreign key constraint violations
**Solution:** Run `await window.cleanupOrphanedOrderItems();`

#### Issue: Missing user_id field
**Solution:** Run `await window.fixAllOrdersRequiredFields();`

#### Issue: Database schema mismatch
**Solution:** Run `await window.recreateIndexedDB();` and refresh

#### Issue: JSON parsing errors
**Solution:** Check if receipt_data is properly stringified in the order service

### Verification Steps

After completing all steps:

1. **Check Supabase Dashboard:**
   - Go to your Supabase project
   - Check the "orders" table has data
   - Check the "order_items" table has data

2. **Check Local Database:**
   - In browser console: `await window.checkIndexedDBStructure();`
   - Verify all tables exist and have data

3. **Test Sync Status:**
   - In browser console: `await window.checkSyncStatus();`
   - Should show most records as "synced"

### Emergency Reset (Last Resort)

If nothing works, perform a complete reset:

```javascript
// WARNING: This will delete all local data
await window.recreateIndexedDB();
location.reload();
```

Then start fresh by creating new orders.

## Files Changed

1. `src/db.js` - Updated schema to version 3 with new fields
2. `src/services/orderService.js` - Added proper timestamp handling
3. `supabase_orders_schema.sql` - New SQL schema for Supabase
4. Debug scripts created for troubleshooting

## Expected Outcome

After completing these steps:
- Orders should sync successfully to Supabase
- No failed orders in sync status
- Orders visible in both app and Supabase dashboard
- Real-time sync working for new orders
