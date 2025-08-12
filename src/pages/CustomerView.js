import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { customerService } from '../services/customerService';
import { orderService } from '../services/orderService';
import { formatCustomerName } from '../utils/customerNameFormatter';
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
    <div className="p-4 sm:p-6">
      <h1 className="text-2xl sm:text-3xl font-bold mb-4">Customer Details</h1>
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4 space-y-3 sm:space-y-0">
          <h2 className="text-xl sm:text-2xl font-semibold">{formatCustomerName(customer)}</h2>
          <Link
            to={`/customers/edit/${customer.id}`}
            className="flex items-center justify-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors duration-200 w-full sm:w-auto"
          >
            <FaEdit />
            <span>Edit Customer</span>
          </Link>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg space-y-2">
          <p className="text-sm sm:text-base"><strong>Customer ID:</strong> <span className="break-all">{customer.id}</span></p>
          <p className="text-sm sm:text-base"><strong>Phone:</strong> <a href={`tel:${customer.phone}`} className="text-blue-600 hover:underline">{customer.phone}</a></p>
          {customer.post && (
            <p className="text-sm sm:text-base"><strong>Post:</strong> {customer.post}</p>
          )}
          <p className="text-sm sm:text-base"><strong>Email:</strong> 
            {customer.email ? (
              <a href={`mailto:${customer.email}`} className="text-blue-600 hover:underline break-all">{customer.email}</a>
            ) : (
              'N/A'
            )}
          </p>
          <p className="text-sm sm:text-base"><strong>Address:</strong> {customer.address || 'N/A'}</p>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 space-y-3 sm:space-y-0">
          <h3 className="text-lg sm:text-xl font-semibold">Measurements</h3>
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
            {customer.measurements && customer.measurements.length > 0 && (
              <Link
                to={`/customers/${id}/measurements/${customer.measurements[0].id}/edit`}
                className="flex items-center justify-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors duration-200 text-sm sm:text-base"
              >
                <FaEdit />
                <span>Edit Measurements</span>
              </Link>
            )}
            <Link
              to={`/customers/${id}/measurements/new`}
              className="flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 text-sm sm:text-base"
            >
              <FaPlus />
              <span>Add Measurements</span>
            </Link>
          </div>
        </div>
        
        {customer.measurements && customer.measurements.length > 0 ? (() => {
          // Combine all measurements from all templates into one unified view
          const allMeasurements = new Map();
          let latestDate = null;
          
          // Merge all measurements from different templates
          customer.measurements.forEach(measurement => {
            if (measurement.data && typeof measurement.data === 'object') {
              Object.entries(measurement.data).forEach(([key, value]) => {
                // Only include entries that have actual values
                if (value && typeof value === 'object' && value.value !== undefined) {
                  if (value.value !== null && value.value !== undefined && value.value !== '' && value.value !== 0) {
                    allMeasurements.set(key, value);
                  }
                } else if (value !== null && value !== undefined && value !== '' && value !== 0) {
                  allMeasurements.set(key, value);
                }
              });
            }
            
            // Track the latest creation date
            if (measurement.created_at) {
              const measurementDate = new Date(measurement.created_at);
              if (!latestDate || measurementDate > latestDate) {
                latestDate = measurementDate;
              }
            }
          });
          
          if (allMeasurements.size === 0) {
            return (
              <div className="bg-gray-50 p-6 rounded-lg">
                <div className="text-center py-4">
                  <p className="text-gray-500 mb-2">No measurements filled yet</p>
                  <p className="text-xs text-gray-400">Click "Add Measurements" to start adding measurements</p>
                </div>
              </div>
            );
          }
          
          return (
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                {Array.from(allMeasurements.entries())
                  .sort(([keyA], [keyB]) => {
                    // Sort measurements alphabetically by key
                    const displayKeyA = keyA.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    const displayKeyB = keyB.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    return displayKeyA.localeCompare(displayKeyB);
                  })
                  .map(([key, value]) => {
                    let displayValue;
                    let displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    
                    if (value && typeof value === 'object' && value.value !== undefined) {
                      displayValue = `${value.value}${value.unit ? ` ${value.unit}` : ''}`;
                    } else if (value !== null && value !== undefined) {
                      displayValue = String(value);
                    }
                    
                    return (
                      <div key={key} className="bg-white p-3 rounded border shadow-sm">
                        <div className="font-medium text-gray-700 text-xs uppercase tracking-wide mb-1">
                          {displayKey}
                        </div>
                        <div className="text-gray-900 font-semibold">
                          {displayValue}
                        </div>
                      </div>
                    );
                  })}
              </div>
              
              {latestDate && (
                <div className="mt-4 pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-400">
                    Last updated: {latestDate.toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          );
        })() : (
          <div className="text-center py-8">
            <div className="bg-gray-50 p-6 rounded-lg">
              <p className="text-gray-500 mb-4">No measurements available for this customer.</p>
              <p className="text-sm text-gray-400">Click "Add Measurements" above to create the first measurement set.</p>
            </div>
          </div>
        )}
      </div>

      <div className="mb-6">
        <h3 className="text-lg sm:text-xl font-semibold mb-4">Order History</h3>
        {orders.length > 0 ? (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                <div className="p-4">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-3 sm:space-y-0">
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 mb-3">
                        <h4 className="font-semibold text-gray-900 text-lg">Order #{order.sequence_id || (order.id ? order.id.substring(0, 8) : 'N/A')}</h4>
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          order.status === 'Completed' ? 'bg-green-100 text-green-800' :
                          order.status === 'In-Progress' ? 'bg-yellow-100 text-yellow-800' :
                          order.status === 'Delivered' ? 'bg-blue-100 text-blue-800' :
                          order.status === 'Cancelled' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {order.status || 'Pending'}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600 mb-3">
                        <p><strong>Order Date:</strong> {order.order_date ? new Date(order.order_date).toLocaleDateString() : 'N/A'}</p>
                        <p><strong>Delivery Date:</strong> {order.delivery_date ? new Date(order.delivery_date).toLocaleDateString() : 'N/A'}</p>
                      </div>

                      {/* Order Items */}
                      <div className="mb-3">
                        <h5 className="font-medium text-gray-700 mb-2">Items:</h5>
                        {order.items && order.items.length > 0 ? (
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="space-y-2">
                              {order.items.map((item, index) => (
                                <div key={index} className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-sm">
                                  <div className="flex-1">
                                    <span className="font-medium text-gray-900">
                                      {item.item_name || item.product_name || item.name || 'Unnamed Item'}
                                    </span>
                                    <span className="text-gray-600 ml-2">
                                      (Qty: {item.item_quantity || item.quantity || 1})
                                    </span>
                                  </div>
                                  <div className="text-right mt-1 sm:mt-0">
                                    <span className="font-semibold text-green-600">
                                      ₹{(item.price || 0).toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="bg-gray-50 rounded-lg p-3 text-center text-sm text-gray-500">
                            No items specified for this order
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="font-bold text-green-600 text-xl mb-2">₹{(order.total_amount || 0).toLocaleString()}</p>
                      <Link 
                        to={`/orders/${order.id}`} 
                        className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        <FaEye className="mr-1" />
                        View Details
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-50 p-6 rounded-lg text-center">
            <p className="text-gray-500">No orders found for this customer.</p>
          </div>
        )}
      </div>

      <Link to="/customers" className="text-indigo-600 hover:text-indigo-900 mt-4 block">
        Back to Customers
      </Link>
    </div>
  );
}

export default CustomerView;

