import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { customerService } from '../services/customerService'; // Assuming you have this service
import { measurementService } from '../services/measurementService';
import { FaSave, FaTimes, FaUser, FaSpinner, FaRuler, FaEdit, FaPlus } from 'react-icons/fa';

const NewCustomer = () => {
  const { id } = useParams(); // For edit mode
  const isEditMode = Boolean(id);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: ''
  });
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditMode);
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();

  // Load customer data if in edit mode
  useEffect(() => {
    if (isEditMode && id) {
      const loadCustomer = async (customerId) => {
        try {
          // No need for a separate initialLoading state here, we can use the main one.
          setLoading(true); 
          const customer = await customerService.getById(customerId);
          if (customer) {
            setFormData({
              name: customer.name || '',
              phone: customer.phone || '',
              email: customer.email || '',
              address: customer.address || ''
            });
          } else {
            // Using a more modern approach than alert
            console.error('Customer not found');
            navigate('/customers');
          }
        } catch (error) {
          console.error('Error loading customer:', error);
          // Handle error gracefully
          navigate('/customers');
        } finally {
          setLoading(false);
          setInitialLoading(false);
        }
      };
      loadCustomer(id);
    }
  }, [isEditMode, id, navigate]);

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
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^[0-9]{10,}$/.test(formData.phone.replace(/\s+/g, ''))) {
      newErrors.phone = 'Please enter a valid phone number';
    }
    
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      if (isEditMode) {
        await customerService.update(id, formData);
        alert(`✅ Customer "${formData.name}" has been updated successfully.`);
      } else {
        await customerService.add(formData);
        alert(`✅ Customer "${formData.name}" has been added successfully.`);
      }
      navigate('/customers');
    } catch (error) {
      console.error(`Error ${isEditMode ? 'updating' : 'adding'} customer:`, error);
      alert(`❌ Failed to ${isEditMode ? 'update' : 'add'} customer. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  // Show loading spinner while loading customer data in edit mode
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <FaSpinner className="animate-spin text-4xl text-indigo-600 mx-auto mb-4" />
          <p className="text-lg text-gray-700">Loading customer data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          {/* Header */}
          <div className="flex items-center mb-8">
            <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl mr-4">
              <FaUser className="text-white text-xl" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {isEditMode ? 'Edit Customer' : 'Add New Customer'}
              </h1>
              <p className="text-gray-600 mt-1">
                {isEditMode 
                  ? 'Update customer information and details'
                  : 'Enter customer information to add them to your directory'
                }
              </p>
            </div>
          </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name Field */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Customer Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 ${
                errors.name ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400'
              }`}
              placeholder="Enter customer name"
            />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
          </div>

          {/* Phone Field */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number *
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 ${
                errors.phone ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400'
              }`}
              placeholder="Enter phone number"
            />
            {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone}</p>}
          </div>

          {/* Email Field */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address (Optional)
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 ${
                errors.email ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400'
              }`}
              placeholder="Enter email address"
            />
            {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
          </div>

          {/* Address Field - CORRECTED */}
          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
              Address (Optional)
            </label>
            <textarea
              id="address"
              name="address"
              value={formData.address} /* Use the value prop for controlled textareas */
              onChange={handleChange}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent hover:border-gray-400 transition-all duration-200"
              placeholder="Enter customer address"
            />
          </div>

          {/* Measurements Section */}
          {isEditMode && (
            <div className="border-t border-gray-200 mt-8 pt-6">
              <h2 className="text-xl font-semibold mb-4">Measurements for {formData.name}</h2>
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-6 rounded-xl border border-purple-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-700 mb-2">Manage customer measurements in the detailed view</p>
                    <p className="text-sm text-gray-500">Add, edit, and view all measurement sets for this customer</p>
                  </div>
                  <Link
                    to={`/customers/view/${id}`}
                    className="inline-flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium px-4 py-2 rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all duration-200"
                  >
                    <FaRuler />
                    <span>Manage Measurements</span>
                  </Link>
                </div>
              </div>
            </div>
          )}
          
          {/* Form Actions */}
          <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-4 pt-8 border-t border-gray-200">
            <button
              type="button"
              onClick={() => navigate('/customers')}
              className="w-full sm:w-auto px-6 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 flex items-center justify-center font-medium transition-all duration-200"
            >
              <FaTimes className="mr-2" />
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-medium transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              {loading ? (
                <>
                  <FaSpinner className="mr-2 animate-spin" />
                  {isEditMode ? 'Updating...' : 'Saving...'}
                </>
              ) : (
                <>
                  <FaSave className="mr-2" />
                  {isEditMode ? 'Update Customer' : 'Save Customer'}
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

export default NewCustomer;
