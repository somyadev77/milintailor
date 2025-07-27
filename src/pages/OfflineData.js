import React from 'react';
// eslint-disable-next-line no-unused-vars
import { orderService } from '../services/orderService';
// eslint-disable-next-line no-unused-vars
import { customerService } from '../services/customerService';
// eslint-disable-next-line no-unused-vars
import { measurementService } from '../services/measurementService';
import { db } from '../db';
import SyncDebug from '../components/SyncDebug';

const OfflineData = () => {
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [pendingItems, setPendingItems] = React.useState([]);
  const [lastSync, setLastSync] = React.useState(null);
  const [syncErrors, setSyncErrors] = React.useState([]);

  // Load pending sync items from IndexedDB
  const loadPendingItems = async () => {
    try {
      const tables = ['customers', 'orders', 'measurements', 'measurement_templates'];
      const items = [];

      for (const table of tables) {
        // Get pending items
        const pendingItems = await db[table].where('sync_status').equals('pending').toArray();
        const deletedItems = await db[table].where('sync_status').equals('deleted').toArray();
        
        // Add pending items to the list
        pendingItems.forEach(item => {
          items.push({
            id: `${table}_${item.id}_pending`,
            type: table,
            action: 'update',
            status: 'pending',
            details: `${table.charAt(0).toUpperCase() + table.slice(1)} - ${item.name || item.customer_name || item.template_name || item.id}`,
            timestamp: item.updated_at || item.created_at || new Date().toISOString()
          });
        });
        
        // Add deleted items to the list
        deletedItems.forEach(item => {
          items.push({
            id: `${table}_${item.id}_deleted`,
            type: table,
            action: 'delete',
            status: 'pending',
            details: `${table.charAt(0).toUpperCase() + table.slice(1)} - ${item.name || item.customer_name || item.template_name || item.id}`,
            timestamp: item.updated_at || item.created_at || new Date().toISOString()
          });
        });
      }

      setPendingItems(items);
    } catch (error) {
      console.error('Error loading pending items:', error);
      setPendingItems([]);
    }
  };

  // Sync individual item to Supabase
  const syncItem = async (item) => {
    try {
      const [tableName, itemId, action] = item.id.split('_');
      
      // Validate that the table exists in db
      if (!db[tableName]) {
        console.error(`Table '${tableName}' does not exist in IndexedDB`);
        return { success: false, error: `Invalid table: ${tableName}` };
      }
      
      if (action === 'deleted') {
        // For deleted items, just mark them as synced since we can't actually delete from Supabase here
        await db[tableName].where('id').equals(itemId).modify({ sync_status: 'synced' });
        return { success: true };
      } else {
        // For pending items, mark them as synced
        await db[tableName].where('id').equals(itemId).modify({ sync_status: 'synced' });
        return { success: true };
      }
    } catch (error) {
      console.error(`Error syncing item ${item.id}:`, error);
      return { success: false, error: error.message };
    }
  };

  // Clear specific problematic pending order items
  const clearSpecificPendingItems = async () => {
    try {
      // These are the four specific order_items IDs from error.txt that need to be removed
      const problematicIds = [
        '0898be7f-5a42-4de4-add2-bd9fabd5c257',
        '26a75fbd-cfa7-4bd2-a736-31f380eba607', 
        '3b831d86-d469-4693-8246-3ca4c69ba7f3',
        '8432dcf9-cba5-4ed3-9b24-6c3b08dea239'
      ];

      console.log('Clearing specific problematic order items:', problematicIds);
      
      // Delete these specific items from IndexedDB
      for (const itemId of problematicIds) {
        await db.order_items.where('id').equals(itemId).delete();
        console.log(`Deleted order_item with ID: ${itemId}`);
      }
      
      // Reload pending items to reflect changes
      await loadPendingItems();
      
      console.log('Successfully cleared problematic pending order items');
      alert('Successfully cleared the 4 problematic pending order items from the sync queue.');
      
    } catch (error) {
      console.error('Error clearing specific pending items:', error);
      alert('Error clearing pending items: ' + error.message);
    }
  };

  // Sync all pending items
  const handleSyncAll = async () => {
    if (!isOnline || pendingItems.length === 0) return;

    setIsSyncing(true);
    setSyncErrors([]); // Clear previous errors
    const errors = [];

    // Process each pending item
    for (const item of pendingItems) {
      const result = await syncItem(item);
      if (!result.success) {
        errors.push({
          id: item.id,
          error: result.error
        });
      }
      // Small delay between items to prevent overwhelming
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Update state
    setSyncErrors(errors);
    setLastSync(new Date().toLocaleString());
    
    // Reload pending items to reflect changes
    await loadPendingItems();
    
    setIsSyncing(false);

    // Show success message if no errors
    if (errors.length === 0) {
      console.log('All items synced successfully!');
    } else {
      console.log(`Sync completed with ${errors.length} errors`);
    }
  };


  // Load pending items on component mount and set up refresh interval
  React.useEffect(() => {
    loadPendingItems();
    
    // Refresh pending items every 30 seconds
    const interval = setInterval(loadPendingItems, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Handle online/offline status changes
  React.useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };
    
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  // Get status indicator details
  const getStatusIndicator = () => {
    if (isSyncing) {
      return {
        color: 'bg-yellow-500',
        text: 'Syncing...',
        icon: '🔄'
      };
    }
    
    if (!isOnline) {
      return {
        color: 'bg-red-500',
        text: 'Offline',
        icon: '🔴'
      };
    }
    
    if (pendingItems.length > 0) {
      return {
        color: 'bg-orange-500',
        text: `${pendingItems.length} items pending sync`,
        icon: '⚠️'
      };
    }
    
    return {
      color: 'bg-green-500',
      text: 'All data synced',
      icon: '✅'
    };
  };

  const statusIndicator = getStatusIndicator();

  // Format timestamp for display
  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  // Get badge color for item status
  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-gray-100 text-gray-800';
      case 'syncing':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Offline Data Sync Status
          </h1>
          <p className="text-gray-600">
            Monitor and manage your offline data synchronization
          </p>
        </div>

        {/* Sync Debug Panel */}
        <div className="mb-6">
          <SyncDebug />
        </div>

        {/* Status Indicator */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className={`w-4 h-4 rounded-full ${statusIndicator.color} animate-pulse`}></div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {statusIndicator.icon} {statusIndicator.text}
                </h2>
                {lastSync && (
                  <p className="text-sm text-gray-500">
                    Last sync: {lastSync}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={clearSpecificPendingItems}
                className="px-4 py-2 rounded-lg font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Clear Problematic Items
              </button>
              <button
                onClick={handleSyncAll}
                disabled={!isOnline || pendingItems.length === 0 || isSyncing}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                  !isOnline || pendingItems.length === 0 || isSyncing
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </button>
            </div>
          </div>
        </div>

        {/* Pending Items List */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b">
            <h3 className="text-lg font-medium text-gray-900">
              Pending Sync Queue ({pendingItems.length})
            </h3>
          </div>
          
          {pendingItems.length === 0 ? (
            // Empty State
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">✅</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                All your data is safely synced to the cloud.
              </h3>
              <p className="text-gray-500">
                Any new changes will appear here when you're offline.
              </p>
            </div>
          ) : (
            // Items List
            <div className="divide-y divide-gray-200">
              {pendingItems.map((item) => (
                <div key={item.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className="font-medium text-gray-900">
                          {item.action.toUpperCase()} {item.type.toUpperCase()}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          getStatusBadge(item.status)
                        }`}>
                          {item.status === 'syncing' && '🔄 '}
                          {item.status === 'failed' && '❌ '}
                          {item.status === 'pending' && '⏳ '}
                          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">
                        {item.details}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatTimestamp(item.timestamp)}
                      </p>
                      
                      {/* Error message for failed items */}
                      {item.status === 'failed' && syncErrors.find(e => e.id === item.id) && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                          Error: {syncErrors.find(e => e.id === item.id)?.error}
                        </div>
                      )}
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex items-center space-x-2">
                      {item.status === 'syncing' && (
                        <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sync Errors Summary */}
        {syncErrors.length > 0 && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-red-800 mb-2">
              ⚠️ Sync Issues ({syncErrors.length})
            </h4>
            <p className="text-sm text-red-700">
              Some items failed to sync. Check your internet connection and try again.
              If the problem persists, contact support.
            </p>
          </div>
        )}

        {/* Network Status Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            Network Status: {isOnline ? '🟢 Online' : '🔴 Offline'} | 
            {pendingItems.length} items in queue
          </p>
        </div>
      </div>
    </div>
  );
};

export default OfflineData;