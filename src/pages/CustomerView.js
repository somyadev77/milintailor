import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { customerService } from '../services/customerService';
import { orderService } from '../services/orderService';
import { FaArrowLeft, FaUser, FaPhone, FaEnvelope, FaMapMarkerAlt, FaRuler, FaShoppingCart, FaCalendarAlt, FaEye, FaClock, FaCheckCircle, FaSpinner, FaExclamationCircle, FaTimes, FaEdit, FaTrash, FaPrint, FaPlus } from 'react-icons/fa';

function CustomerView() {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchCustomerDetails = async () => {
    try {
      setLoading(true);
      const customerData = await customerService.getWithMeasurements(id);
      const customerOrders = await orderService.getByCustomer(id);
      setCustomer(customerData);
      setOrders(customerOrders);
    } catch (error) {
      console.error('Error fetching customer details:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomerDetails();
  }, [id]);

  if (!customer) {
    return <div className="p-6">Loading customer details...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Customer Details</h1>
      <div className="mb-6">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-2xl font-semibold">{customer.name}</h2>
          <Link
            to={`/customers/edit/${customer.id}`}
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors duration-200"
          >
            <FaEdit />
            <span>Edit Customer</span>
          </Link>
        </div>
        <p><strong>Phone:</strong> {customer.phone}</p>
        <p><strong>Email:</strong> {customer.email || 'N/A'}</p>
        <p><strong>Address:</strong> {customer.address || 'N/A'}</p>
      </div>

      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">Measurements</h3>
          <Link
            to={`/customers/${id}/measurements/new`}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
          >
            <FaPlus />
            <span>Add Measurement</span>
          </Link>
        </div>
        {customer.measurements && customer.measurements.length > 0 ? (
          <div className="space-y-4">
            {customer.measurements.map((measurement, index) => (
              <div key={measurement.id || index} className="bg-gray-50 p-4 rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-lg">
                    {measurement.template_name || `Measurement Set ${index + 1}`}
                  </h4>
                  {measurement.id && (
                    <Link
                      to={`/customers/${id}/measurements/${measurement.id}/edit`}
                      className="flex items-center space-x-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors duration-200"
                    >
                      <FaEdit />
                      <span>Edit</span>
                    </Link>
                  )}
                </div>
                {measurement.data && typeof measurement.data === 'object' ? (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {Object.entries(measurement.data).map(([key, value]) => {
                      let displayValue;
                      if (value && typeof value === 'object' && value.value !== undefined) {
                        displayValue = `${value.value}${value.unit ? ` ${value.unit}` : ''}`;
                      } else if (value !== null && value !== undefined) {
                        displayValue = String(value);
                      } else {
                        displayValue = 'N/A';
                      }
                      return (
                        <div key={key}>
                          <span className="font-medium">{key}:</span> {displayValue}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-gray-500">No measurement data available</p>
                )}
                {measurement.created_at && (
                  <p className="text-xs text-gray-400 mt-2">
                    Created: {new Date(measurement.created_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">No measurements available for this customer.</p>
            <p className="text-sm text-gray-400">Click "Add Measurement" above to create the first measurement set.</p>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-2">Order History</h3>
        {orders.length > 0 ? (
          <ul>
{orders.map((order) => (
              <li key={order.id} className="mb-2">
                <Link to={`/orders/${order.id}`} className="text-blue-600 hover:underline">
                  Order ID: {order.id ? order.id.substring(0, 8) : 'N/A'}, 
                  Date: {order.order_date ? new Date(order.order_date).toLocaleDateString() : 'N/A'}, 
                  Total: ₹{(order.total_amount || 0).toLocaleString()}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p>No orders found.</p>
        )}
      </div>

      <Link to="/customers" className="text-indigo-600 hover:text-indigo-900 mt-4 block">
        Back to Customers
      </Link>
    </div>
  );
}

export default CustomerView;

