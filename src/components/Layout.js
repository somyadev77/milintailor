import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom'; // Import Link and useLocation
import Navbar from './Navbar'; // Import the Navbar component

const Layout = ({ children }) => {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  return (
    <>
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={closeSidebar}
        ></div>
      )}
      <div className="min-h-screen bg-gray-100 flex">
        {/* Sidebar */}
        <div className={`fixed inset-y-0 left-0 w-64 bg-gray-800 text-white flex flex-col transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 z-50 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img 
                src="/logo.jpg" 
                alt="Milin Tailor Logo" 
                className="h-8 w-8 rounded-full object-cover"
              />
              <span className="text-xl font-bold">Milin Tailor</span>
            </div>
            {/* Close button for mobile */}
            <button 
              onClick={closeSidebar}
              className="lg:hidden p-1 rounded-md hover:bg-gray-700"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
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
        <div className="flex-1 flex flex-col lg:ml-0">
          {/* Mobile header with hamburger menu */}
          <header className="lg:hidden bg-white shadow-sm border-b">
            <div className="flex items-center justify-between px-4 py-3">
              <button
                onClick={toggleSidebar}
                className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="flex items-center space-x-2">
                <img 
                  src="/logo.jpg" 
                  alt="Milin Tailor Logo" 
                  className="h-8 w-8 rounded-full object-cover"
                />
                <span className="text-lg font-semibold text-gray-900">Milin Tailor</span>
              </div>
              <div className="w-10"></div> {/* Spacer for center alignment */}
            </div>
          </header>
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
    </>
  );
};

export default Layout;