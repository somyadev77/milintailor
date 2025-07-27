import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { customerService } from '../services/customerService';
import { orderService } from '../services/orderService';
import { FaArrowLeft, FaUser, FaPhone, FaEnvelope, FaMapMarkerAlt, FaRuler, FaShoppingCart, FaCalendarAlt, FaEye, FaClock, FaCheckCircle, FaSpinner, FaExclamationCircle, FaTimes, FaEdit, FaTrash, FaPrint, FaPlus } from 'react-icons/fa';

function CustomerView() {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const fetchCustomerDetails = async () => {
      try {
        const customerData = await customerService.getWithMeasurements(id);
        const customerOrders = await orderService.getByCustomer(id);
        setCustomer(customerData);
        setOrders(customerOrders);
      } catch (error) {
        console.error('Error fetching customer details:', error);
      }
    };
    fetchCustomerDetails();
  }, [id]);

  if (!customer) {
    return <div className="p-6">Loading customer details...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Customer Details</h1>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">{customer.name}</h2>
        <p><strong>Phone:</strong> {customer.phone}</p>
        <p><strong>Email:</strong> {customer.email || 'N/A'}</p>
        <p><strong>Address:</strong> {customer.address || 'N/A'}</p>
      </div>

      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-2">Measurements</h3>
        {customer.measurements && customer.measurements.length > 0 ? (
          <div className="space-y-4">
            {customer.measurements.map((measurement, index) => (
              <div key={measurement.id || index} className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold text-lg mb-2">
                  {measurement.template_name || `Measurement Set ${index + 1}`}
                </h4>
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
          <p>No measurements available.</p>
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

