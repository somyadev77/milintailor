import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaUsers, FaShoppingCart, FaMoneyBillWave, FaClock } from 'react-icons/fa';
import { orderService } from '../services/orderService';

const Dashboard = () => {
  const [metrics, setMetrics] = useState({
    totalCustomers: 0,
    totalOrders: 0,
    pendingOrders: 0,
    totalRevenue: 0
  });
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        // Fetch metrics
        const dashboardMetrics = await orderService.getDashboardMetrics();
        setMetrics(dashboardMetrics);
        
        // Fetch recent orders
        const allOrders = await orderService.getAll();
        setRecentOrders(allOrders.slice(0, 5)); // Get latest 5 orders
        
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);


  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'Completed':
        return 'bg-green-200 text-green-800';
      case 'In-Progress':
        return 'bg-yellow-200 text-yellow-800';
      case 'Pending':
        return 'bg-red-200 text-red-800';
      default:
        return 'bg-gray-200 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex justify-center items-center min-h-screen">
        <div className="text-lg text-gray-600">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Dashboard</h1>

      {/* Key Metrics - Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-500">Total Customers</div>
            <div className="text-3xl font-bold text-gray-900">{metrics.totalCustomers}</div>
          </div>
          <FaUsers className="text-4xl text-blue-500" />
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-500">Total Orders</div>
            <div className="text-3xl font-bold text-gray-900">{metrics.totalOrders}</div>
          </div>
          <FaShoppingCart className="text-4xl text-green-500" />
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-500">Pending Orders</div>
            <div className="text-3xl font-bold text-gray-900">{metrics.pendingOrders}</div>
          </div>
          <FaClock className="text-4xl text-orange-500" />
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-500">Total Revenue (₹)</div>
            <div className="text-3xl font-bold text-gray-900">₹{metrics.totalRevenue.toLocaleString()}</div>
          </div>
          <FaMoneyBillWave className="text-4xl text-purple-500" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Recent Orders</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full leading-normal">
              <thead>
                <tr>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Customer Name
                  </th>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Total Amount
                  </th>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Delivery Date
                  </th>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                      <Link to={`/orders/${order.id}`} className="text-blue-600 hover:underline">
                        {order.customer}
                      </Link>
                    </td>
                    <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                      ₹{(order.total_amount || 0).toLocaleString()}
                    </td>
                    <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                      {order.delivery_date ? new Date(order.delivery_date).toLocaleDateString() : 'Not set'}
                    </td>
                    <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                      <span
                        className={`relative inline-block px-3 py-1 font-semibold leading-tight ${getStatusBadgeColor(order.status)} rounded-full`}
                      >
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="lg:col-span-1 bg-white p-6 rounded-lg shadow-md flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Quick Actions</h2>
            <Link
              to="/orders/new"
              className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              + Create New Order
            </Link>
            {/* Add more quick actions as needed */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;