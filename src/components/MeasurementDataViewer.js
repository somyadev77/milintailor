import React, { useState, useEffect } from 'react';
import { measurementService } from '../services/measurementService';
import { orderService } from '../services/orderService';
import { debugMeasurements, debugOrderData, cleanupCorruptedMeasurements } from '../utils/debugMeasurements';

const MeasurementDataViewer = () => {
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [orderData, setOrderData] = useState(null);
  const [measurementData, setMeasurementData] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const allOrders = await orderService.getAll();
      setOrders(allOrders);
    } catch (error) {
      console.error('Error loading orders:', error);
    }
  };

  const handleOrderSelect = async (orderId) => {
    if (!orderId) {
      setSelectedOrderId('');
      setOrderData(null);
      setMeasurementData(null);
      return;
    }

    setLoading(true);
    setSelectedOrderId(orderId);

    try {
      // Get order details
      const order = await orderService.getById(orderId);
      setOrderData(order);

      // Get measurement data for the customer
      if (order && order.customer_id) {
        const measurements = await measurementService.getByCustomer(order.customer_id);
        setMeasurementData(measurements);
      }
    } catch (error) {
      console.error('Error loading order/measurement data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatMeasurementValue = (key, value) => {
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return value?.toString() || '';
  };

  const renderMeasurementData = (data, title) => {
    if (!data || typeof data !== 'object') {
      return (
        <div className="p-3 bg-gray-50 rounded">
          <p className="text-gray-500">No measurement data available</p>
        </div>
      );
    }

    const entries = Object.entries(data);
    if (entries.length === 0) {
      return (
        <div className="p-3 bg-gray-50 rounded">
          <p className="text-gray-500">No measurements recorded</p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {entries.map(([key, value]) => (
          <div key={key} className="flex justify-between items-center p-2 bg-gray-50 rounded">
            <span className="font-medium text-gray-700">{key.replace(/_/g, ' ')}:</span>
            <span className="text-gray-900">{formatMeasurementValue(key, value)}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderReceiptMeasurements = (receiptData) => {
    if (!receiptData || !receiptData.measurements) {
      return <p className="text-gray-500">No measurement data in receipt</p>;
    }

    const { measurements } = receiptData;

    return (
      <div className="space-y-4">
        {/* Shirt Measurements */}
        {measurements.shirt && Object.keys(measurements.shirt).length > 0 && (
          <div>
            <h5 className="font-semibold text-blue-800 mb-2">👔 Shirt Measurements:</h5>
            <div className="space-y-1">
              {Object.entries(measurements.shirt).map(([key, measurement]) => (
                <div key={key} className="flex justify-between items-center p-2 bg-blue-50 rounded">
                  <span className="text-gray-700">{measurement.label || key}:</span>
                  <span className="font-medium">{measurement.value} {measurement.unit}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pant Measurements */}
        {measurements.pant && Object.keys(measurements.pant).length > 0 && (
          <div>
            <h5 className="font-semibold text-green-800 mb-2">👖 Pant Measurements:</h5>
            <div className="space-y-1">
              {Object.entries(measurements.pant).map(([key, measurement]) => (
                <div key={key} className="flex justify-between items-center p-2 bg-green-50 rounded">
                  <span className="text-gray-700">{measurement.label || key}:</span>
                  <span className="font-medium">{measurement.value} {measurement.unit}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Button/Style Measurements */}
        {measurements.button && Object.keys(measurements.button).length > 0 && (
          <div>
            <h5 className="font-semibold text-purple-800 mb-2">🎨 Style & Button:</h5>
            <div className="space-y-1">
              {Object.entries(measurements.button).map(([key, measurement]) => (
                <div key={key} className="flex justify-between items-center p-2 bg-purple-50 rounded">
                  <span className="text-gray-700">{measurement.label || key}:</span>
                  <span className="font-medium">{measurement.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Legacy Universal Measurements (for backward compatibility) */}
        {measurements.universal && Object.keys(measurements.universal).length > 0 && (
          <div>
            <h5 className="font-semibold text-gray-800 mb-2">📏 Universal Measurements (Legacy):</h5>
            <div className="space-y-1">
              {Object.entries(measurements.universal).map(([key, measurement]) => (
                <div key={key} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span className="text-gray-700">{measurement.label || key}:</span>
                  <span className="font-medium">{measurement.value} {measurement.unit}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Custom Measurements */}
        {measurements.custom && measurements.custom.length > 0 && (
          <div>
            <h5 className="font-semibold text-gray-800 mb-2">Custom Measurements:</h5>
            <div className="space-y-1">
              {measurements.custom.map((custom, index) => (
                <div key={index} className="flex justify-between items-center p-2 bg-green-50 rounded">
                  <span className="text-gray-700">{custom.name}:</span>
                  <span className="font-medium">{custom.value} {custom.unit}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Product-specific Measurements */}
        {measurements.product_specific && Object.keys(measurements.product_specific).length > 0 && (
          <div>
            <h5 className="font-semibold text-gray-800 mb-2">Product-specific Measurements:</h5>
            {Object.entries(measurements.product_specific).map(([productName, productMeasurements]) => (
              <div key={productName} className="mb-3">
                <h6 className="font-medium text-gray-700 mb-1">{productName}:</h6>
                <div className="space-y-1 ml-4">
                  {Object.entries(productMeasurements).map(([key, measurement]) => (
                    <div key={key} className="flex justify-between items-center p-2 bg-yellow-50 rounded">
                      <span className="text-gray-700">{measurement.label || key}:</span>
                      <span className="font-medium">{measurement.value} {measurement.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Debug functions
  const handleDebugMeasurements = async () => {
    await debugMeasurements();
  };

  const handleDebugOrders = async () => {
    await debugOrderData();
  };

  const handleCleanupCorrupted = async () => {
    const cleaned = await cleanupCorruptedMeasurements();
    alert(`Cleaned ${cleaned} corrupted measurements. Check console for details.`);
    // Reload data after cleanup
    if (selectedOrderId) {
      handleOrderSelect(selectedOrderId);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Measurement Data Viewer</h2>
      
      {/* Debug Tools */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold mb-3 text-yellow-800">🛠️ Debug Tools</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleDebugMeasurements}
            className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600"
          >
            Debug Measurements
          </button>
          <button
            onClick={handleDebugOrders}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Debug Orders
          </button>
          <button
            onClick={handleCleanupCorrupted}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Cleanup Corrupted Data
          </button>
        </div>
        <p className="text-sm text-yellow-700 mt-2">
          Use these tools to inspect and clean measurement data. Check browser console for detailed output.
        </p>
      </div>
      
      {/* Order Selection */}
      <div className="mb-6">
        <label htmlFor="orderSelect" className="block text-sm font-medium text-gray-700 mb-2">
          Select Order to View Measurements:
        </label>
        <select
          id="orderSelect"
          value={selectedOrderId}
          onChange={(e) => handleOrderSelect(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md"
        >
          <option value="">-- Select an Order --</option>
          {orders.map(order => (
            <option key={order.id} value={order.id}>
              Order #{order.id} - {order.customer?.name || 'Unknown Customer'} ({new Date(order.order_date).toLocaleDateString()})
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="text-center py-4">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2">Loading measurement data...</p>
        </div>
      )}

      {orderData && !loading && (
        <div className="space-y-6">
          {/* Order Info */}
          <div className="bg-white rounded-lg shadow-sm p-4 border">
            <h3 className="text-lg font-semibold mb-3">Order Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><strong>Order ID:</strong> {orderData.id}</div>
              <div><strong>Customer:</strong> {orderData.customer?.name || 'Unknown'}</div>
              <div><strong>Order Date:</strong> {new Date(orderData.order_date).toLocaleDateString()}</div>
              <div><strong>Status:</strong> {orderData.status}</div>
            </div>
          </div>

          {/* Receipt Measurement Data */}
          <div className="bg-white rounded-lg shadow-sm p-4 border">
            <h3 className="text-lg font-semibold mb-3">Receipt Measurement Data</h3>
            {orderData.receipt_data ? (
              <div>
                {typeof orderData.receipt_data === 'string' ? (
                  renderReceiptMeasurements(JSON.parse(orderData.receipt_data))
                ) : (
                  renderReceiptMeasurements(orderData.receipt_data)
                )}
              </div>
            ) : (
              <p className="text-gray-500">No receipt data available</p>
            )}
          </div>

          {/* Database Measurement Data */}
          <div className="bg-white rounded-lg shadow-sm p-4 border">
            <h3 className="text-lg font-semibold mb-3">Database Measurement Data</h3>
            {measurementData && measurementData.length > 0 ? (
              <div className="space-y-4">
                {measurementData.map((measurement, index) => (
                  <div key={measurement.id || index} className="border-l-4 border-blue-500 pl-4">
                    <h4 className="font-medium text-gray-800 mb-2">
                      {measurement.template_name || 'Unknown Template'}
                    </h4>
                    <div className="text-xs text-gray-500 mb-2">
                      ID: {measurement.id} | Sync Status: {measurement.sync_status || 'unknown'}
                    </div>
                    {renderMeasurementData(measurement.data, measurement.template_name)}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No measurement data found in database</p>
            )}
          </div>

          {/* Raw Data (for debugging) */}
          <div className="bg-white rounded-lg shadow-sm p-4 border">
            <details>
              <summary className="text-lg font-semibold cursor-pointer">Raw Data (for debugging)</summary>
              <div className="mt-3 space-y-4">
                <div>
                  <h4 className="font-medium text-gray-800 mb-2">Order Data:</h4>
                  <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto">
                    {JSON.stringify(orderData, null, 2)}
                  </pre>
                </div>
                <div>
                  <h4 className="font-medium text-gray-800 mb-2">Measurement Data:</h4>
                  <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto">
                    {JSON.stringify(measurementData, null, 2)}
                  </pre>
                </div>
              </div>
            </details>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeasurementDataViewer;
