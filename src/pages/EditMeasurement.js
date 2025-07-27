import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { measurementService } from '../services/measurementService';
import { measurementTemplateService } from '../services/measurementTemplateService';
import { customerService } from '../services/customerService';
import { FaSave, FaTimes, FaRuler, FaSpinner, FaArrowLeft } from 'react-icons/fa';

const EditMeasurement = () => {
  const { customerId, measurementId } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [measurement, setMeasurement] = useState(null);
  const [template, setTemplate] = useState(null);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    // Guard clause: Don't run if parameters aren't ready yet
    if (!customerId || !measurementId) {
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        console.log('Loading measurement edit data...', { customerId, measurementId });
        
        // Load customer data
        const customerData = await customerService.getById(customerId);
        console.log('Customer data:', customerData);
        if (!customerData) {
          console.error('Customer not found');
          navigate('/customers');
          return;
        }
        setCustomer(customerData);

        let targetMeasurement = null;
        
        // Check if we're creating a new measurement
        if (measurementId === 'new') {
          console.log('Creating new measurement');
          // Create a new empty measurement object
          targetMeasurement = {
            id: 'new',
            customerId: customerId,
            templateName: 'Universal Measurements',
            data: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
        } else {
          // Load existing measurement
          const measurements = await measurementService.getByCustomer(customerId);
          console.log('All customer measurements:', measurements);
          targetMeasurement = measurements.find(m => m.id === measurementId);
          console.log('Target measurement:', targetMeasurement);
          
          if (!targetMeasurement) {
            console.error('Measurement not found with ID:', measurementId);
            alert('Measurement not found. Redirecting to customer details.');
            navigate(`/customers/view/${customerId}`);
            return;
          }
        }
        
        setMeasurement(targetMeasurement);

        // Load templates and create default ones if needed
        await measurementTemplateService.getDefaultTemplates();
        const templates = await measurementTemplateService.getAll();
        console.log('Available templates:', templates);
        
        // Create a comprehensive template that includes ALL fields from ALL templates
        const allFields = new Map();
        
        // Add fields from all templates to create a universal measurement set
        templates.forEach(template => {
          if (template && template.fields && Array.isArray(template.fields)) {
            template.fields.forEach(field => {
              if (field && field.name && field.label) {
                // Use field name as key to avoid duplicates
                if (!allFields.has(field.name)) {
                  allFields.set(field.name, {
                    name: field.name,
                    label: field.label,
                    unit: field.unit || 'inches',
                    required: field.required || false
                  });
                }
              }
            });
          }
        });
        
        // Also include any existing fields from the measurement data that might not be in templates
        if (targetMeasurement.data) {
          Object.keys(targetMeasurement.data).forEach(key => {
            if (!allFields.has(key)) {
              allFields.set(key, {
                name: key,
                label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
                unit: 'inches',
                required: false
              });
            }
          });
        }
        
        // Convert Map to array for the template
        const comprehensiveTemplate = {
          name: 'Universal Measurements',
          fields: Array.from(allFields.values()).sort((a, b) => a.label.localeCompare(b.label))
        };
        
        console.log('Comprehensive template with all fields:', comprehensiveTemplate);
        setTemplate(comprehensiveTemplate);

        // Initialize form data - show ALL fields from comprehensive template, including empty ones
        const initialFormData = {};
        
        // Initialize all comprehensive template fields (including empty ones)
        comprehensiveTemplate.fields.forEach(field => {
          const existingValue = targetMeasurement.data && targetMeasurement.data[field.name];
          if (existingValue && typeof existingValue === 'object' && existingValue.value !== undefined) {
            initialFormData[field.name] = existingValue.value;
          } else if (existingValue !== null && existingValue !== undefined) {
            initialFormData[field.name] = existingValue;
          } else {
            // Show empty fields as well
            initialFormData[field.name] = '';
          }
        });
        console.log('Initial form data:', initialFormData);
        setFormData(initialFormData);

      } catch (error) {
        console.error('Error loading measurement data:', error);
        alert('Error loading measurement data. Please try again.');
        navigate(`/customers/view/${customerId}`);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [customerId, measurementId, navigate]);

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
    
    if (template && template.fields) {
      template.fields.forEach(field => {
        if (field.required && (!formData[field.name] || formData[field.name].toString().trim() === '')) {
          newErrors[field.name] = `${field.label} is required`;
        } else if (formData[field.name] && isNaN(formData[field.name])) {
          newErrors[field.name] = `${field.label} must be a valid number`;
        }
      });
    }
    
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
      // Prepare measurement data with units - include ALL fields
      const measurementData = {};
      template.fields.forEach(field => {
        const value = formData[field.name];
        // Include field even if empty, but with appropriate value
        if (value !== '' && value !== null && value !== undefined && value !== '0') {
          measurementData[field.name] = {
            value: parseFloat(value),
            unit: field.unit || 'inches'
          };
        } else {
          // Keep track of empty fields too
          measurementData[field.name] = {
            value: null,
            unit: field.unit || 'inches'
          };
        }
      });

      console.log('Saving measurement data:', measurementData);
      
      if (measurementId === 'new') {
        // Creating a new measurement
        await measurementService.saveForCustomer(customerId, template.name, measurementData);
        alert('✅ New measurement created successfully!');
      } else {
        // Updating existing measurement
        await measurementService.saveForCustomer(customerId, template.name, measurementData);
        alert('✅ Measurements updated successfully!');
      }
      
      navigate(`/customers/view/${customerId}`);
    } catch (error) {
      console.error('Error updating measurement:', error);
      alert('❌ Failed to update measurement. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <FaSpinner className="animate-spin text-4xl text-indigo-600 mx-auto mb-4" />
          <p className="text-lg text-gray-700">Loading measurement data...</p>
        </div>
      </div>
    );
  }

  // Debug logs to understand the state
  const isNewMeasurement = measurementId === 'new';
  console.log('Render conditions check:', {
    loading,
    isNewMeasurement,
    hasCustomer: !!customer,
    hasMeasurement: !!measurement,
    hasTemplate: !!template,
    customerData: customer,
    measurementData: measurement,
    templateData: template
  });

  // Only show "not found" error if we're not loading AND we're missing essential data
  // For new measurements, we expect measurement.id to be 'new' and other data to be loaded
  if (!customer || !template || (!measurement && !isNewMeasurement)) {
    console.log('Showing measurement not found due to missing data');
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-gray-700">Measurement not found</p>
          <Link 
            to={`/customers/view/${customerId}`}
            className="text-indigo-600 hover:text-indigo-800 mt-4 inline-block"
          >
            Back to Customer
          </Link>
        </div>
      </div>
    );
  }

  // Additional safety check for new measurements
  if (isNewMeasurement && !measurement) {
    console.log('New measurement detected but measurement object not initialized yet');
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <FaSpinner className="animate-spin text-4xl text-indigo-600 mx-auto mb-4" />
          <p className="text-lg text-gray-700">Initializing new measurement...</p>
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
                  Edit {template.name} Measurements
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

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Measurement Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {template.fields.map((field) => {
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
                      className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 ${
                        errors[field.name] 
                          ? 'border-red-500 bg-red-50' 
                          : hasValue 
                            ? 'border-green-300 bg-green-50 font-semibold'
                            : 'border-gray-300 hover:border-gray-400 bg-gray-50'
                      }`}
                      placeholder={`Enter ${field.label.toLowerCase()}${hasValue ? '' : ' (empty)'}`}
                    />
                    {errors[field.name] && (
                      <p className="mt-1 text-sm text-red-600">{errors[field.name]}</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Summary */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <h3 className="font-semibold text-gray-800 mb-2">Measurement Summary</h3>
              <div className="flex items-center space-x-6 text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span>Filled: {template.fields.filter(field => formData[field.name] && formData[field.name] !== '' && formData[field.name] !== '0').length}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                  <span>Empty: {template.fields.filter(field => !formData[field.name] || formData[field.name] === '' || formData[field.name] === '0').length}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span>Total: {template.fields.length}</span>
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
                    Updating...
                  </>
                ) : (
                  <>
                    <FaSave className="mr-2" />
                    Update Measurements
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

export default EditMeasurement;
