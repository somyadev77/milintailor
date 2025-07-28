import React, { useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import SyncStatus from './components/SyncStatus';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import InstallPrompt from './components/InstallPrompt';
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
import { db } from './db';

function App() {
  useEffect(() => {
    // Initialize the database
    db.open().catch(err => {
      console.error('Failed to open database:', err);
    });
  }, []);

  return (
    <AuthProvider>
      <Router>
        <SyncStatus />
        <InstallPrompt />
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
          </Routes>
        </Layout>
      </Router>
    </AuthProvider>
  );
}

export default App;

