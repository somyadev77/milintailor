import React, { useState, useEffect } from 'react';
import { FaWifi, FaSync, FaCheck, FaExclamationTriangle, FaTimes } from 'react-icons/fa';
import { db, syncWithSupabase } from '../db';

const SyncStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState('idle'); // idle, syncing, success, error
  const [pendingCount, setPendingCount] = useState(0);

  const performSync = async () => {
    if (!navigator.onLine || syncStatus === 'syncing') return;

    setSyncStatus('syncing');
    try {
      await syncWithSupabase();
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 3000);
      checkPendingItems();
    } catch (error) {
      console.error('Sync error:', error);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 5000);
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      performSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus('idle');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check pending items periodically
    const interval = setInterval(checkPendingItems, 5000);
    checkPendingItems(); // Initial check

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [syncStatus]);

  const checkPendingItems = async () => {
    try {
      const tables = ['customers', 'orders', 'measurements', 'measurement_templates'];
      let total = 0;

      for (const table of tables) {
        const pending = await db[table].where('sync_status').equals('pending').count();
        const deleted = await db[table].where('sync_status').equals('deleted').count();
        total += pending + deleted;
      }

      setPendingCount(total);
    } catch (error) {
      console.error('Error checking pending items:', error);
    }
  };


  const getSyncIcon = () => {
    switch (syncStatus) {
      case 'syncing':
        return <FaSync className="animate-spin text-blue-500" />;
      case 'success':
        return <FaCheck className="text-green-500" />;
      case 'error':
        return <FaExclamationTriangle className="text-red-500" />;
      default:
        return isOnline ? <FaWifi className="text-green-500" /> : <FaTimes className="text-red-500" />;
    }
  };

  const getSyncMessage = () => {
    if (!isOnline) {
      return pendingCount > 0 
        ? `Offline - ${pendingCount} items pending sync`
        : 'Offline - All data saved locally';
    }

    switch (syncStatus) {
      case 'syncing':
        return 'Synchronizing...';
      case 'success':
        return 'Synchronized successfully';
      case 'error':
        return 'Sync failed - will retry';
      default:
        return pendingCount > 0 
          ? `Online - ${pendingCount} items to sync`
          : 'Online - All data synchronized';
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50">
      <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg shadow-lg text-sm font-medium transition-all duration-300 ${
        isOnline 
          ? syncStatus === 'error' 
            ? 'bg-red-100 text-red-800 border border-red-200'
            : 'bg-green-100 text-green-800 border border-green-200'
          : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
      }`}>
        {getSyncIcon()}
        <span>{getSyncMessage()}</span>
        {isOnline && pendingCount > 0 && syncStatus === 'idle' && (
          <button
            onClick={performSync}
            className="ml-2 px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors"
          >
            Sync Now
          </button>
        )}
      </div>
    </div>
  );
};

export default SyncStatus;
