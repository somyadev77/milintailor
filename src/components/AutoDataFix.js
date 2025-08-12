import React, { useEffect, useState } from 'react';
import { fixAllDataLinking, checkSyncStatus } from '../db';

const AutoDataFix = () => {
  const [isFixing, setIsFixing] = useState(false);
  const [fixResults, setFixResults] = useState(null);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    let mounted = true;

    const runAutoFix = async () => {
      // Wait a bit for the app to fully load
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      if (!mounted) return;

      try {
        console.log('🔧 AutoDataFix: Starting automatic data linking fixes...');
        setIsFixing(true);

        // Check if there are any issues first
        const syncStatus = await checkSyncStatus();
        
        const hasPendingIssues = Object.values(syncStatus).some(
          status => status.pending > 0 || status.failed > 0
        );

        if (hasPendingIssues) {
          console.log('🛠️ AutoDataFix: Issues detected, running comprehensive fix...');
          
          // Run comprehensive fix
          const fixedCount = await fixAllDataLinking();
          
          setFixResults({
            fixedCount,
            syncStatus: await checkSyncStatus(),
            timestamp: new Date().toISOString()
          });

          if (fixedCount > 0) {
            console.log(`✅ AutoDataFix: Successfully fixed ${fixedCount} data linking issues`);
            setShowResults(true);
            
            // Auto-hide results after 10 seconds
            setTimeout(() => {
              if (mounted) setShowResults(false);
            }, 10000);
          } else {
            console.log('ℹ️ AutoDataFix: No issues found that could be automatically fixed');
          }
        } else {
          console.log('✅ AutoDataFix: No data linking issues detected');
        }

      } catch (error) {
        console.error('❌ AutoDataFix: Error during automatic fix:', error);
      } finally {
        if (mounted) setIsFixing(false);
      }
    };

    runAutoFix();

    return () => {
      mounted = false;
    };
  }, []);

  if (!isFixing && !showResults) {
    return null;
  }

  return (
    <>
      {isFixing && (
        <div className="fixed top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          <span className="text-sm">Fixing data links...</span>
        </div>
      )}

      {showResults && fixResults && fixResults.fixedCount > 0 && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg z-50 max-w-sm">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium">Data Links Fixed</h3>
              <p className="text-xs text-green-200 mt-1">
                Fixed {fixResults.fixedCount} data linking issues automatically
              </p>
            </div>
            <button
              onClick={() => setShowResults(false)}
              className="ml-4 flex-shrink-0 text-green-300 hover:text-white"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default AutoDataFix;
