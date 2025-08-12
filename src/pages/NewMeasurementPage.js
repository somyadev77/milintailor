import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { customerService } from '../services/customerService';
import { measurementService } from '../services/measurementService';
import { getAllMeasurementFieldsFlat } from '../services/measurementFieldsService';
import { getAllMeasurementFields as getStaticMeasurementFields } from '../config/measurementFields';
import { FaSave, FaTimes, FaRuler, FaSpinner, FaArrowLeft } from 'react-icons/fa';
import ButtonColorSelector from '../components/ButtonColorSelector';
const NewMeasurementPage = () => {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});

  // Use static measurement fields from config
  const measurementFields = getStaticMeasurementFields();

  useEffect(() => {
    const loadCustomer = async () => {
      if (!customerId) {
        console.error('No customer ID provided');
        navigate('/customers');
        return;
      }

      try {
        setLoading(true);
        console.log('🔍 Loading customer for new measurement:', customerId);
        
        const customerData = await customerService.getById(customerId);
        if (!customerData) {
          console.error('❌ Customer not found');
          alert('Customer not found. Redirecting to customers list.');
          navigate('/customers');
          return;
        }
        
        console.log('✅ Customer loaded:', customerData);
        setCustomer(customerData);
        
        // Initialize empty form data
        const initialFormData = {};
        measurementFields.forEach(field => {
          initialFormData[field.name] = '';
        });
        setFormData(initialFormData);
        
      } catch (error) {
        console.error('Error loading customer:', error);
        alert('Error loading customer data. Please try again.');
        navigate('/customers');
      } finally {
        setLoading(false);
      }
    };

    loadCustomer();
  }, [customerId, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    measurementFields.forEach(field => {
      if (field.required && (!formData[field.name] || formData[field.name].toString().trim() === '')) {
        newErrors[field.name] = `${field.label} is required`;
      } else if (formData[field.name] && field.type !== 'select' && isNaN(formData[field.name])) {
        newErrors[field.name] = `${field.label} must be a valid number`;
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setSaving(true);
    try {
      // Prepare measurement data with units
      const measurementData = {};
      measurementFields.forEach(field => {
        const value = formData[field.name];
        if (value !== '' && value !== null && value !== undefined) {
          measurementData[field.name] = {
            value: field.type === 'select' ? value : parseFloat(value),
            unit: field.unit || (field.type === 'select' ? '' : 'inches')
          };
        } else {
          measurementData[field.name] = {
            value: null,
            unit: field.unit || (field.type === 'select' ? '' : 'inches')
          };
        }
      });

      console.log('💾 Saving new measurement data:', measurementData);
      
      await measurementService.saveForCustomer(customerId, 'Basic Measurements', measurementData);
      alert('✅ New measurement created successfully!');
      
      navigate(`/customers/view/${customerId}`);
    } catch (error) {
      console.error('❌ Error creating measurement:', error);
      alert('❌ Failed to create measurement. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <FaSpinner className="animate-spin text-4xl text-indigo-600 mx-auto mb-4" />
          <p className="text-lg text-gray-700">Loading customer data...</p>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-gray-700">Customer not found</p>
          <Link 
            to="/customers"
            className="text-indigo-600 hover:text-indigo-800 mt-4 inline-block"
          >
            Back to Customers
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center">
              <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl mr-4">
                <FaRuler className="text-white text-xl" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Add New Measurements
                </h1>
                <p className="text-gray-600 mt-1">
                  Customer: <span className="font-semibold">{customer.name}</span>
                </p>
              </div>
            </div>
            <Link
              to={`/customers/view/${customerId}`}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors duration-200"
            >
              <FaArrowLeft />
              <span>Back to Customer</span>
            </Link>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Button Color Section - Third separate section */}
            {measurementFields
              .filter((field) => field.category === 'button')
              .map((field) => (
                <ButtonColorSelector
                  key={field.name}
                  name={field.name}
                  label={field.label}
                  value={formData[field.name] || ''}
                  onChange={handleChange}
                  options={field.options}
                />
              ))}

            {/* Shirt and Pant Measurements in Two Columns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Shirt Column */}
              <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
                <h3 className="text-xl font-bold text-blue-800 mb-4 flex items-center">
                  👕 Shirt Measurements
                </h3>
                <div className="space-y-4">
                  {measurementFields
                    .filter((field) => field.category === 'shirt')
                    .map((field) => {
                      const hasValue = formData[field.name] && formData[field.name] !== '' && formData[field.name] !== '0';
                      return (
                      <div key={field.name} className={`relative ${hasValue ? 'bg-green-50 border border-green-200 rounded-lg p-3' : ''}`}>
                        <label 
                          htmlFor={field.name} 
                          className="block text-sm font-medium text-gray-700 mb-2"
                        >
                          <div className="flex items-center justify-between">
                            <span>
                              {field.label} {field.required && <span className="text-red-500">*</span>}
                              {field.unit && <span className="text-gray-500 ml-1">({field.unit})</span>}
                            </span>
                            {hasValue && (
                              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                                ✓ Filled
                              </span>
                            )}
                          </div>
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          id={field.name}
                          name={field.name}
                          value={formData[field.name] || ''}
                          onChange={handleChange}
                          className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                            errors[field.name] 
                              ? 'border-red-500 bg-red-50' 
                              : hasValue 
                                ? 'border-green-300 bg-green-50 font-semibold'
                                : 'border-gray-300 hover:border-gray-400 bg-white'
                          }`}
                          placeholder={`Enter ${field.label.toLowerCase()}${hasValue ? '' : ' (optional)'}`}
                        />
                        {errors[field.name] && (
                          <p className="mt-1 text-sm text-red-600">{errors[field.name]}</p>
                        )}
                      </div>
                      );
                    })}
                </div>
              </div>

              {/* Pant Column */}
              <div className="bg-green-50 rounded-xl p-6 border border-green-200">
                <h3 className="text-xl font-bold text-green-800 mb-4 flex items-center">
                  👖 Pant Measurements
                </h3>
                <div className="space-y-4">
                  {measurementFields
                    .filter((field) => field.category === 'pant')
                    .map((field) => {
                      const hasValue = formData[field.name] && formData[field.name] !== '' && formData[field.name] !== '0';
                      return (
                      <div key={field.name} className={`relative ${hasValue ? 'bg-green-100 border border-green-300 rounded-lg p-3' : ''}`}>
                        <label 
                          htmlFor={field.name} 
                          className="block text-sm font-medium text-gray-700 mb-2"
                        >
                          <div className="flex items-center justify-between">
                            <span>
                              {field.label} {field.required && <span className="text-red-500">*</span>}
                              {field.unit && <span className="text-gray-500 ml-1">({field.unit})</span>}
                            </span>
                            {hasValue && (
                              <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded-full">
                                ✓ Filled
                              </span>
                            )}
                          </div>
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          id={field.name}
                          name={field.name}
                          value={formData[field.name] || ''}
                          onChange={handleChange}
                          className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 ${
                            errors[field.name] 
                              ? 'border-red-500 bg-red-50' 
                              : hasValue 
                                ? 'border-green-400 bg-green-100 font-semibold'
                                : 'border-gray-300 hover:border-gray-400 bg-white'
                          }`}
                          placeholder={`Enter ${field.label.toLowerCase()}${hasValue ? '' : ' (optional)'}`}
                        />
                        {errors[field.name] && (
                          <p className="mt-1 text-sm text-red-600">{errors[field.name]}</p>
                        )}
                      </div>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <h3 className="font-semibold text-gray-800 mb-2">Measurement Summary</h3>
              <div className="flex items-center space-x-6 text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span>Filled: {measurementFields.filter(field => formData[field.name] && formData[field.name] !== '' && formData[field.name] !== '0').length}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                  <span>Empty: {measurementFields.filter(field => !formData[field.name] || formData[field.name] === '' || formData[field.name] === '0').length}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span>Total: {measurementFields.length}</span>
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-4 pt-8 border-t border-gray-200">
              <button
                type="button"
                onClick={() => navigate(`/customers/view/${customerId}`)}
                className="w-full sm:w-auto px-6 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 flex items-center justify-center font-medium transition-all duration-200"
              >
                <FaTimes className="mr-2" />
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-medium transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                {saving ? (
                  <>
                    <FaSpinner className="mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <FaSave className="mr-2" />
                    Create Measurements
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default NewMeasurementPage;

