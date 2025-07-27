import React from 'react';
import { Link, useLocation } from 'react-router-dom'; // Import Link and useLocation
import Navbar from './Navbar'; // Import the Navbar component

const Layout = ({ children }) => {
  const location = useLocation();

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <div className="w-64 bg-gray-800 text-white flex flex-col">
        <div className="p-4 text-2xl font-bold border-b border-gray-700">
          Milin Tailor
        </div>
        <nav className="flex-1 px-2 py-4 space-y-2">
          <Link to="/" className={`block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700 ${isActive('/') ? 'bg-blue-600' : ''}`}>
            Dashboard
          </Link>

          {/* Orders with sub-menu */}
          <div className="">
            <span className={`block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700 cursor-pointer ${isActive('/orders') ? 'bg-blue-600' : ''}`}>
              Orders
            </span>
            <div className="ml-4 mt-1 space-y-1">
              <Link to="/orders/new" className={`block py-2 px-4 rounded transition duration-200 hover:bg-gray-700 text-sm ${isActive('/orders/new') ? 'bg-blue-600' : ''}`}>
                Create Order
              </Link>
              <Link to="/orders" className={`block py-2 px-4 rounded transition duration-200 hover:bg-gray-700 text-sm ${isActive('/orders') && location.pathname === '/orders' ? 'bg-blue-600' : ''}`}> {/* Assuming /orders for viewing orders */}
                View/Edit Orders
              </Link>
            </div>
          </div>

          {/* Customers with sub-menu */}
          <div className="">
            <span className={`block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700 cursor-pointer ${isActive('/customers') ? 'bg-blue-600' : ''}`}>
              Customers
            </span>
            <div className="ml-4 mt-1 space-y-1">
              <Link to="/customers/new" className={`block py-2 px-4 rounded transition duration-200 hover:bg-gray-700 text-sm ${isActive('/customers/new') ? 'bg-blue-600' : ''}`}>
                Add Customer
              </Link>
              <Link to="/customers" className={`block py-2 px-4 rounded transition duration-200 hover:bg-gray-700 text-sm ${isActive('/customers') && location.pathname === '/customers' ? 'bg-blue-600' : ''}`}>
                View Customers
              </Link>
            </div>
          </div>

          <Link to="/settings/measurements" className={`block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700 ${isActive('/settings/measurements') ? 'bg-blue-600' : ''}`}> {/* Assuming a route for settings */}
            Measurement Settings
          </Link>
          <Link to="/offline-data" className={`block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700 ${isActive('/offline-data') ? 'bg-blue-600' : ''}`}> {/* Assuming a route for offline data */}
            Offline Data
          </Link>
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* <Navbar /> */}
        {/* <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-semibold text-gray-900">Dashboard</h2>
          </div>
        </header> */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;