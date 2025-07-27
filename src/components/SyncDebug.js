import React, { useState, useEffect } from 'react';
import { checkSyncStatus, forceSyncWithSupabase, testSupabaseConnection } from '../db';

const SyncDebug = () => {
  const [syncStatus, setSyncStatus] = useState({});
  const [connectionStatus, setConnectionStatus] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const refreshSyncStatus = async () => {
    const status = await checkSyncStatus();
    setSyncStatus(status);
  };

  const testConnection = async () => {
    const status = await testSupabaseConnection();
    setConnectionStatus(status);
  };

  const forceSync = async () => {
    setIsLoading(true);
    try {
      await forceSyncWithSupabase();
      await refreshSyncStatus();
    } catch (error) {
      console.error('Error during manual sync:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshSyncStatus();
    testConnection();
  }, []);

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-blue-500">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">🔄 Sync Debug Panel</h3>
        <div className="space-x-2">
          <button
            onClick={refreshSyncStatus}
            className="px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Refresh Status
          </button>
          <button
            onClick={testConnection}
            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Test Connection
          </button>
          <button
            onClick={forceSync}
            disabled={isLoading}
            className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {isLoading ? 'Syncing...' : 'Force Sync'}
          </button>
        </div>
      </div>

      {/* Sync Status */}
      <div className="mb-4">
        <h4 className="font-medium text-gray-700 mb-2">📊 Local Data Sync Status:</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-2">Table</th>
                <th className="text-center p-2">Pending</th>
                <th className="text-center p-2">Synced</th>
                <th className="text-center p-2">Failed</th>
                <th className="text-center p-2">Deleted</th>
                <th className="text-center p-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(syncStatus).map(([table, status]) => (
                <tr key={table} className="border-t">
                  <td className="p-2 font-medium">{table}</td>
                  <td className="text-center p-2">
                    <span className={`px-2 py-1 rounded ${status.pending > 0 ? 'bg-yellow-200 text-yellow-800' : 'bg-gray-100'}`}>
                      {status.pending}
                    </span>
                  </td>
                  <td className="text-center p-2">
                    <span className={`px-2 py-1 rounded ${status.synced > 0 ? 'bg-green-200 text-green-800' : 'bg-gray-100'}`}>
                      {status.synced}
                    </span>
                  </td>
                  <td className="text-center p-2">
                    <span className={`px-2 py-1 rounded ${status.failed > 0 ? 'bg-red-200 text-red-800' : 'bg-gray-100'}`}>
                      {status.failed}
                    </span>
                  </td>
                  <td className="text-center p-2">
                    <span className={`px-2 py-1 rounded ${status.deleted > 0 ? 'bg-purple-200 text-purple-800' : 'bg-gray-100'}`}>
                      {status.deleted}
                    </span>
                  </td>
                  <td className="text-center p-2 font-medium">{status.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Connection Status */}
      <div>
        <h4 className="font-medium text-gray-700 mb-2">🔗 Supabase Connection Status:</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
          {Object.entries(connectionStatus).map(([table, status]) => (
            <div
              key={table}
              className={`p-2 rounded text-xs text-center ${
                status.status === 'success' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}
            >
              <div className="font-medium">{table}</div>
              <div>{status.status === 'success' ? '✅ OK' : '❌ Error'}</div>
              {status.error && (
                <div className="text-xs mt-1 opacity-75">{status.error}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 text-xs text-gray-500">
        💡 <strong>Tip:</strong> Check the browser console for detailed sync logs. Use the buttons above to debug sync issues.
      </div>
    </div>
  );
};

export default SyncDebug;
