import React from 'react';
import { FaPrint, FaTimes } from 'react-icons/fa';
import { getAllMeasurementFields } from '../config/measurementFields';

const MeasurementPreviewModal = ({ order, onClose, onPrint }) => {
  const measurements = order.customer_measurements?.[0]?.data;

  if (!measurements) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
        <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md">
          <h3 className="text-lg sm:text-xl font-bold mb-4">No Measurements Available</h3>
          <button
            onClick={onClose}
            className="bg-gray-600 text-white font-bold py-2 px-4 rounded hover:bg-gray-700 w-full sm:w-auto"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // Get static measurement fields to get proper labels
  const staticFields = getAllMeasurementFields();
  const fieldMap = new Map();
  staticFields.forEach(field => {
    fieldMap.set(field.name, field.label);
  });

  // Filter out empty measurements and custom measurements for cleaner display
  const validMeasurements = Object.entries(measurements)
    .filter(([key, value]) => {
      // Skip empty values
      if (!value || value === '' || value === '0') return false;
      // Skip numeric keys (old data format)
      if (!isNaN(parseInt(key, 10))) return false;
      return true;
    })
    .map(([key, value]) => ({
      key,
      label: fieldMap.get(key) || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value: value
    }));

  if (validMeasurements.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
        <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md">
          <h3 className="text-lg sm:text-xl font-bold mb-4">No Valid Measurements Found</h3>
          <p className="text-sm sm:text-base text-gray-600 mb-4">This order doesn't have any measurement data to display.</p>
          <button
            onClick={onClose}
            className="bg-gray-600 text-white font-bold py-2 px-4 rounded hover:bg-gray-700 w-full sm:w-auto"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 p-4 sm:p-6 border-b space-y-2 sm:space-y-0">
          <div className="flex-1">
            <h2 className="text-lg sm:text-xl font-bold">Measurement Preview</h2>
            <p className="text-sm text-gray-600 break-words">Customer: {order.customer?.name || order.customer || 'N/A'}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 p-2 self-end sm:self-auto">
            <FaTimes size={20} />
          </button>
        </div>
        
        <div className="p-4 sm:p-6">
          {/* Mobile Card View (sm and below) */}
          <div className="block sm:hidden space-y-3">
            {validMeasurements.map((measurement, index) => (
              <div key={measurement.key} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                <div className="font-medium text-gray-900 text-sm mb-1">
                  {measurement.label}
                </div>
                <div className="text-gray-700 text-base font-semibold">
                  {measurement.value}
                </div>
              </div>
            ))}
          </div>
          
          {/* Desktop Table View (sm and above) */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th className="py-3 px-4 text-left font-semibold text-gray-700 border-b">Measurement</th>
                  <th className="py-3 px-4 text-left font-semibold text-gray-700 border-b">Value</th>
                </tr>
              </thead>
              <tbody>
                {validMeasurements.map((measurement, index) => (
                  <tr key={measurement.key} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="py-2 px-4 border-b font-medium text-gray-900">
                      {measurement.label}
                    </td>
                    <td className="py-2 px-4 border-b text-gray-700">
                      {measurement.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-end p-4 sm:p-6 border-t space-y-2 sm:space-y-0 sm:space-x-2">
          <button onClick={onPrint} className="bg-blue-600 text-white font-bold py-2 px-4 rounded hover:bg-blue-700 flex items-center justify-center">
            <FaPrint className="mr-2" /> Print Measurements
          </button>
          <button onClick={onClose} className="bg-gray-600 text-white font-bold py-2 px-4 rounded hover:bg-gray-700">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default MeasurementPreviewModal;

