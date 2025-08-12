import React, { useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import SyncStatus from './components/SyncStatus';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import InstallPrompt from './components/InstallPrompt';
import AutoDataFix from './components/AutoDataFix';
import { usePreventNumberScroll } from './hooks/usePreventNumberScroll';
import './styles/global.css';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import NewCustomer from './pages/NewCustomer';
import CustomerView from './pages/CustomerView';
import EditMeasurement from './pages/EditMeasurement';
import NewMeasurementPage from './pages/NewMeasurementPage';
import Orders from './pages/Orders';
import CreateOrder from './pages/CreateOrder'; // Change from NewOrder to CreateOrder
import MeasurementSettings from './pages/MeasurementSettings';
import OfflineData from './pages/OfflineData';
import MeasurementDataViewer from './components/MeasurementDataViewer';
import { db, forceSyncWithSupabase } from './db';

function App() {
  // Prevent mouse wheel scroll on number inputs globally
  usePreventNumberScroll();

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize the database
        await db.open();
        console.log('📱 App started - initializing sync...');
        
        // Force sync on app startup if online
        if (navigator.onLine) {
          console.log('🔄 App startup - forcing sync to get latest data...');
          await forceSyncWithSupabase();
          console.log('✅ App startup sync completed');
          
          // Dispatch a custom event to trigger data refresh in components
          window.dispatchEvent(new CustomEvent('appSyncComplete'));
        } else {
          console.log('📴 App started offline - will sync when online');
        }
      } catch (err) {
        console.error('Failed to initialize app:', err);
      }
    };
    
    initializeApp();
  }, []);

  return (
    <AuthProvider>
      <Router>
        <SyncStatus />
        <InstallPrompt />
        <AutoDataFix />
        <Layout>
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers"
              element={
                <ProtectedRoute>
                  <Customers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers/new"
              element={
                <ProtectedRoute>
                  <NewCustomer />
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers/view/:id"
              element={
                <ProtectedRoute>
                  <CustomerView />
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers/edit/:id"
              element={
                <ProtectedRoute>
                  <NewCustomer />
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers/:customerId/measurements/:measurementId/edit"
              element={
                <ProtectedRoute>
                  <EditMeasurement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers/:customerId/measurements/new"
              element={
                <ProtectedRoute>
                  <NewMeasurementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/orders"
              element={
                <ProtectedRoute>
                  <Orders />
                </ProtectedRoute>
              }
            />
            <Route
              path="/orders/:id"
              element={
                <ProtectedRoute>
                  <Orders />
                </ProtectedRoute>
              } 
            />
            <Route
              path="/orders/new"
              element={
                <ProtectedRoute>
                  <CreateOrder />
                </ProtectedRoute>
              } 
            />
            <Route
              path="/settings/measurements"
              element={
                <ProtectedRoute>
                  <MeasurementSettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/offline-data"
              element={
                <ProtectedRoute>
                  <OfflineData />
                </ProtectedRoute>
              }
            />
            <Route
              path="/measurement-data-viewer"
              element={
                <ProtectedRoute>
                  <MeasurementDataViewer />
                </ProtectedRoute>
              }
            />
          </Routes>
        </Layout>
      </Router>
    </AuthProvider>
  );
}

export default App;

