import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaCalendarAlt, FaSearch, FaPlus, FaSpinner } from 'react-icons/fa';
import { customerService } from '../services/customerService';
import { orderService } from '../services/orderService';
import { measurementService } from '../services/measurementService';
// eslint-disable-next-line no-unused-vars
import { getAllMeasurementFields, createDefaultMeasurements } from '../services/measurementFieldsService';
import { measurementTemplateService } from '../services/measurementTemplateService';
import { measurementGlobalSettingsService } from '../services/measurementGlobalSettingsService';

const CreateOrder = () => {
  const [customerType, setCustomerType] = useState('new');
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [products, setProducts] = useState([{ name: '', price: '', measurements: {} }]);
  const [measurementFields, setMeasurementFields] = useState({});
  const [measurementTemplates, setMeasurementTemplates] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [defaultMeasurements, setDefaultMeasurements] = useState({});
  const [universalMeasurements, setUniversalMeasurements] = useState({});
  const [customMeasurements, setCustomMeasurements] = useState([]);
  const [newCustomMeasurement, setNewCustomMeasurement] = useState({ name: '', value: '', unit: 'inches' });
  const [globalUnit, setGlobalUnit] = useState('inches');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [remindDate, setRemindDate] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const loadCustomers = async () => {
      const allCustomers = await customerService.getAll();
      setCustomers(allCustomers);
    };


    const loadMeasurements = async () => {
      const fields = await getAllMeasurementFields();
      setMeasurementFields(fields);
      setProducts([{ name: '', price: '', measurements: fields }]);
    };

    const loadMeasurementTemplates = async (defaultUnit = 'inches') => {
      // Load default templates first
      await measurementTemplateService.getDefaultTemplates();
      const templates = await measurementTemplateService.getAll();
      setMeasurementTemplates(templates);
      
      // Create universal measurements from all template fields
      const allUniversalFields = {};
      templates.forEach(template => {
        if (template && template.fields && Array.isArray(template.fields)) {
          template.fields.forEach(field => {
            if (field && field.name && field.label) {
              // Avoid duplicates by using field name as key
              if (!allUniversalFields[field.name]) {
                allUniversalFields[field.name] = {
                  label: field.label,
                  value: '',
                  unit: defaultUnit, // Always use global default unit, ignore template unit
                  required: false // Always make fields optional
                };
              }
            }
          });
        }
      });
      
      console.log('All universal measurement fields:', allUniversalFields);
      setUniversalMeasurements(allUniversalFields);
    };

    const initializeData = async () => {
      await loadCustomers();
      const defaultUnit = await measurementGlobalSettingsService.getDefaultUnit();
      console.log('🔧 Global default unit loaded:', defaultUnit);
      setGlobalUnit(defaultUnit);
      setNewCustomMeasurement(prev => ({ ...prev, unit: defaultUnit }));
      await loadMeasurements();
      await loadMeasurementTemplates(defaultUnit);
    };

    initializeData();
  }, []);

  useEffect(() => {
    if (customerType === 'existing') {
      const lowerCaseQuery = searchQuery.toLowerCase();
      setCustomers(prev => prev.filter(customer =>
        (customer.name && customer.name.toLowerCase().includes(lowerCaseQuery)) ||
        (customer.phone && customer.phone.includes(searchQuery))
      ));
    }
  }, [searchQuery, customerType]);

  // Load customer measurements when existing customer is selected
  useEffect(() => {
    const loadCustomerMeasurements = async () => {
      if (selectedCustomer && selectedCustomer.id) {
        try {
          // Get all measurements for the customer
          const customerMeasurements = await measurementService.getByCustomer(selectedCustomer.id);
          
          // Load universal measurements
          const universalMeasurement = customerMeasurements.find(m => m.template_name === 'Universal Measurements');
          if (universalMeasurement && universalMeasurement.data) {
            const newUniversalMeasurements = { ...universalMeasurements };
            Object.keys(newUniversalMeasurements).forEach(field => {
              if (universalMeasurement.data[field]) {
                newUniversalMeasurements[field] = {
                  ...newUniversalMeasurements[field],
                  value: universalMeasurement.data[field]
                };
              }
            });
            setUniversalMeasurements(newUniversalMeasurements);
            
            // Load custom measurements from universal data
            const customMeasurementsFromData = [];
            Object.entries(universalMeasurement.data).forEach(([key, value]) => {
              if (key.startsWith('custom_')) {
                const parts = key.split('_');
                if (parts.length >= 3) {
                  const name = parts.slice(2).join(' ').replace(/_/g, ' ');
                  customMeasurementsFromData.push({
                    id: Date.now() + Math.random(),
                    name: name.charAt(0).toUpperCase() + name.slice(1),
                    value: value,
                    unit: globalUnit
                  });
                }
              }
            });
            setCustomMeasurements(customMeasurementsFromData);
          }
          
          // Update product measurements if products are already selected
          const updatedProducts = [...products];
          updatedProducts.forEach((product, index) => {
            if (product.name && product.name !== 'custom' && product.name !== '') {
              const productMeasurement = customerMeasurements.find(m => m.template_name === product.name);
              if (productMeasurement && productMeasurement.data && product.measurements) {
                Object.keys(product.measurements).forEach(field => {
                  if (productMeasurement.data[field]) {
                    updatedProducts[index].measurements[field] = {
                      ...updatedProducts[index].measurements[field],
                      value: productMeasurement.data[field]
                    };
                  }
                });
              }
            }
          });
          setProducts(updatedProducts);
          
        } catch (error) {
          console.error('Error loading customer measurements:', error);
        }
      }
    };
    
    loadCustomerMeasurements();
  }, [selectedCustomer]);

  const handleAddProduct = () => {
    setProducts([...products, { name: '', price: '', measurements: measurementFields }]);
  };

  const handleProductChange = async (index, field, value) => {
    const updatedProducts = [...products];
    updatedProducts[index][field] = value;

    if (field === 'name' && value !== 'custom' && value !== '') {
      const template = measurementTemplates.find(t => t && t.name === value);
      if (template && template.fields && Array.isArray(template.fields)) {
        const measurements = template.fields.reduce((acc, f) => {
          if (f && f.name && f.label) {
            acc[f.name] = {
              label: f.label,
              value: '',
              unit: globalUnit, // Always use global unit, ignore template unit
              required: false // Always make fields optional
            };
          }
          return acc;
        }, {});
        updatedProducts[index].measurements = measurements;
        
        // If existing customer is selected, try to load their existing measurements
        if (selectedCustomer) {
          try {
            const existingMeasurement = await measurementService.getByCustomerAndTemplate(selectedCustomer.id, value);
            if (existingMeasurement && existingMeasurement.data) {
              Object.keys(measurements).forEach(field => {
                if (existingMeasurement.data[field]) {
                  updatedProducts[index].measurements[field].value = existingMeasurement.data[field];
                }
              });
            }
          } catch (error) {
            console.error('Error loading existing measurements:', error);
          }
        }
      }
    } else if (field === 'name' && (value === 'custom' || value === '')) {
      updatedProducts[index].measurements = {};
    }
    
    setProducts(updatedProducts);
  };

  const handleMeasurementChange = (index, field, value) => {
    const updatedProducts = [...products];
    if (updatedProducts[index].measurements[field]) {
      updatedProducts[index].measurements[field].value = value;
      setProducts(updatedProducts);
    }
  };

  const handleUniversalMeasurementChange = (field, value) => {
    setUniversalMeasurements(prev => ({
      ...prev,
      [field]: { ...prev[field], value }
    }));
  };

  const handleCustomMeasurementChange = (index, field, value) => {
    const updatedCustom = [...customMeasurements];
    updatedCustom[index][field] = value;
    setCustomMeasurements(updatedCustom);
  };

  const addCustomMeasurement = () => {
    if (newCustomMeasurement.name && newCustomMeasurement.value) {
      setCustomMeasurements(prev => [...prev, { ...newCustomMeasurement, id: Date.now() }]);
      setNewCustomMeasurement({ name: '', value: '', unit: globalUnit });
    }
  };

  const removeCustomMeasurement = (index) => {
    setCustomMeasurements(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoveProduct = (index) => {
    if (products.length > 1) {
      const updatedProducts = [...products];
      updatedProducts.splice(index, 1);
      setProducts(updatedProducts);
    }
  };

  const calculateTotal = () => {
    return products.reduce((sum, product) => sum + (Number(product.price) || 0), 0);
  };

  const generateReceiptData = (customerData, orderData, orderItems) => {
    const receiptData = {
      customer: {
        id: customerData.id || 'NEW',
        name: customerData.name || '',
        phone: customerData.phone || '',
        email: customerData.email || '',
        address: customerData.address || ''
      },
      order: {
        id: orderData.id || 'PENDING',
        date: new Date().toLocaleDateString(),
        delivery_date: orderData.delivery_date || '',
        remind_date: orderData.remind_date || '',
        status: orderData.status || 'Pending',
        is_urgent: orderData.is_urgent || false,
        notes: orderData.notes || ''
      },
      items: orderItems.map(item => ({
        product_name: item.product_name || '',
        price: item.price || 0,
        quantity: item.quantity || 1
      })),
      payment: {
        total_amount: orderData.total_amount || 0,
        advance_payment: orderData.advance_payment || 0,
        due_amount: (orderData.total_amount || 0) - (orderData.advance_payment || 0)
      },
      measurements: {
        universal: {},
        product_specific: {},
        custom: []
      }
    };

    // Add universal measurements
    Object.entries(universalMeasurements).forEach(([field, measurement]) => {
      if (measurement.value) {
        receiptData.measurements.universal[field] = {
          label: measurement.label,
          value: measurement.value,
          unit: measurement.unit
        };
      }
    });

    // Add custom measurements
    customMeasurements.forEach((custom, index) => {
      if (custom.name && custom.value) {
        receiptData.measurements.custom.push({
          name: custom.name,
          value: custom.value,
          unit: custom.unit
        });
      }
    });

    // Add product-specific measurements
    products.forEach((product, productIndex) => {
      if (product.name && Object.keys(product.measurements).length > 0) {
        receiptData.measurements.product_specific[product.name] = {};
        Object.entries(product.measurements).forEach(([field, measurement]) => {
          if (measurement.value) {
            receiptData.measurements.product_specific[product.name][field] = {
              label: measurement.label,
              value: measurement.value,
              unit: measurement.unit || '',
              required: measurement.required || false
            };
          }
        });
      }
    });

    return receiptData;
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      let customerId = selectedCustomer ? selectedCustomer.id : null;
      
      // If new customer, create them first
      if (customerType === 'new') {
        const newCustomer = await customerService.add({
          name: document.getElementById('newCustomerName').value,
          phone: document.getElementById('newCustomerPhone').value,
          email: document.getElementById('newCustomerEmail').value,
          address: document.getElementById('newCustomerAddress').value,
        });
        customerId = newCustomer.id;
      }
      
      // Prepare order data
      const orderData = {
        customer_id: customerId,
        delivery_date: deliveryDate || null, // Use null instead of empty string
        remind_date: remindDate || null, // Use null instead of empty string
        total_amount: calculateTotal(),
        advance_payment: 0, // Can be added as a field later
        status: 'Pending',
        is_urgent: isUrgent,
        notes: null, // Use null instead of empty string
      };
      
      // Prepare order items
      const orderItems = products.map(product => ({
        product_name: product.name,
        price: Number(product.price) || 0,
        quantity: 1 // Can be added as a field later
      }));
      
      // Get customer data for receipt
      const customerData = customerType === 'new' ? {
        name: document.getElementById('newCustomerName').value,
        phone: document.getElementById('newCustomerPhone').value,
        email: document.getElementById('newCustomerEmail').value,
        address: document.getElementById('newCustomerAddress').value,
      } : selectedCustomer;
      
      // Generate receipt data
      const receiptData = generateReceiptData(customerData, orderData, orderItems);
      orderData.receipt_data = receiptData;
      
      // Create the order
      // eslint-disable-next-line no-unused-vars
      const savedOrder = await orderService.create(orderData, orderItems);
      
      // Save measurements for each product
      if (customerId) {
        // Save universal measurements
        const universalMeasurementData = {};
        Object.entries(universalMeasurements).forEach(([field, measurement]) => {
          if (measurement.value) {
            universalMeasurementData[field] = measurement.value;
          }
        });
        
        // Add custom measurements to universal data
        customMeasurements.forEach((custom, index) => {
          if (custom.name && custom.value) {
            universalMeasurementData[`custom_${index}_${custom.name.replace(/\s+/g, '_').toLowerCase()}`] = custom.value;
          }
        });
        
        // Save combined measurements
        if (Object.keys(universalMeasurementData).length > 0) {
          await measurementService.saveForCustomer(customerId, 'Universal Measurements', universalMeasurementData);
        }
        
        // Save product-specific measurements
        for (const product of products) {
          if (Object.keys(product.measurements).length > 0) {
            const measurementData = {};
            Object.entries(product.measurements).forEach(([field, measurement]) => {
              if (measurement.value) {
                measurementData[field] = measurement.value;
              }
            });
            
            if (Object.keys(measurementData).length > 0) {
              await measurementService.saveForCustomer(customerId, product.name, measurementData);
            }
          }
        }
      }
      
      setNotification('Order Saved Locally!');
      setTimeout(() => {
        navigate('/orders');
      }, 1500);
    } catch (error) {
      console.error('Error creating order:', error);
      alert('Failed to create order. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Create New Order</h1>
      
      {notification && <div className="mb-4 p-4 bg-green-200 text-green-800 rounded">{notification}</div>}

      {/* Customer Details Section */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Customer Details</h2>
        
        <div className="flex space-x-4 mb-4">
          <button
            className={`px-4 py-2 rounded ${customerType === 'new' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            onClick={() => setCustomerType('new')}
          >
            New Customer
          </button>
          <button
            className={`px-4 py-2 rounded ${customerType === 'existing' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            onClick={() => setCustomerType('existing')}
          >
            Existing Customer
          </button>
        </div>

        {customerType === 'existing' ? (
          <div className="mb-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by name or phone"
                className="w-full p-2 border rounded pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <FaSearch className="absolute left-3 top-3 text-gray-400" />
            </div>
            
            {searchQuery && customers.length > 0 && (
              <>
                <div className="mt-4 border-t pt-4">
                  <h3 className="text-md font-semibold mb-2">Search Results</h3>
                  <ul>
                    {customers.filter(customer => customer && customer.id).map(customer => (
                      <li
                        key={customer.id}
                        className="p-2 hover:bg-gray-100 cursor-pointer"
                        onClick={() => setSelectedCustomer(customer)}
                      >
                        {customer.name || 'Unknown'} ({customer.phone || 'N/A'})
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            {selectedCustomer && (
              <div className="mt-4 p-4 border rounded bg-gray-50">
                <h3 className="text-md font-semibold mb-2">Selected Customer:</h3>
                <p><strong>Name:</strong> {selectedCustomer.name}</p>
                <p><strong>Phone:</strong> {selectedCustomer.phone}</p>
                <p><strong>Email:</strong> {selectedCustomer.email}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="newCustomerName" className="block text-sm font-medium text-gray-700">
                Name
              </label>
              <input type="text" id="newCustomerName" className="mt-1 block w-full p-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label htmlFor="newCustomerPhone" className="block text-sm font-medium text-gray-700">
                Phone
              </label>
              <input type="text" id="newCustomerPhone" className="mt-1 block w-full p-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label htmlFor="newCustomerEmail" className="block text-sm font-medium text-gray-700">
                Email (Optional)
              </label>
              <input type="email" id="newCustomerEmail" className="mt-1 block w-full p-2 border border-gray-300 rounded-md" />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="newCustomerAddress" className="block text-sm font-medium text-gray-700">
                Address
              </label>
              <textarea id="newCustomerAddress" rows="3" className="mt-1 block w-full p-2 border border-gray-300 rounded-md" placeholder="Enter customer address"></textarea>
            </div>
          </div>
        )}
      </div>

      {/* Order Items Section */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Order Items & Pricing</h2>
        {products.map((product, index) => (
          <div key={index} className="flex items-center space-x-4 mb-3">
            <input
              type="text"
              placeholder="Product name"
              className="flex-1 p-2 border rounded"
              value={product.name}
              onChange={(e) => handleProductChange(index, 'name', e.target.value)}
            />
            <input
              type="number"
              placeholder="Price"
              className="w-32 p-2 border rounded"
              value={product.price}
              onChange={(e) => handleProductChange(index, 'price', e.target.value)}
            />
            {products.length > 1 && (
              <button
                onClick={() => handleRemoveProduct(index)}
                className="p-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Remove
              </button>
            )}
          </div>
        ))}
        <button
          onClick={handleAddProduct}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          <FaPlus className="inline-block mr-2" /> Add Another Item
        </button>
        <div className="text-right text-xl font-bold mt-4">
          Total: ₹{calculateTotal().toLocaleString()}
        </div>
      </div>

      {/* Universal Measurements Section */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Universal Measurements</h2>
        <p className="text-sm text-gray-600 mb-4">These measurements will be saved for the customer and can be used across all orders.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {Object.entries(universalMeasurements).map(([field, measurement]) => {
            const hasValue = measurement.value && measurement.value !== '' && measurement.value !== '0';
            return (
              <div key={field} className={`flex flex-col space-y-1 ${hasValue ? 'bg-green-50 border border-green-200 rounded-lg p-3' : ''}`}>
                <label className="text-sm font-medium text-gray-700">
                  <div className="flex items-center justify-between">
                    <span>
                      {measurement.label} {measurement.required && <span className="text-red-500">*</span>}
                      <span className="text-gray-500 ml-1">({measurement.unit})</span>
                    </span>
                    {hasValue && (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                        ✓ Filled
                      </span>
                    )}
                  </div>
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    step="0.1"
                    value={measurement.value}
                    onChange={(e) => handleUniversalMeasurementChange(field, e.target.value)}
                    className={`flex-1 p-2 border rounded text-sm min-w-0 ${
                      hasValue 
                        ? 'border-green-300 bg-green-50 font-semibold'
                        : 'border-gray-300 bg-gray-50'
                    }`}
                    placeholder={hasValue ? measurement.value : '0.0 (empty)'}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Measurement Summary */}
        {Object.keys(universalMeasurements).length > 0 && (
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 mb-6">
            <h3 className="font-semibold text-gray-800 mb-2">Universal Measurements Summary</h3>
            <div className="flex items-center space-x-6 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span>Filled: {Object.values(universalMeasurements).filter(m => m.value && m.value !== '' && m.value !== '0').length}</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                <span>Empty: {Object.values(universalMeasurements).filter(m => !m.value || m.value === '' || m.value === '0').length}</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span>Total: {Object.keys(universalMeasurements).length}</span>
              </div>
            </div>
          </div>
        )}

        {/* Custom Measurements */}
        <div className="border-t pt-4">
          <h3 className="text-md font-semibold mb-3">Custom Measurements</h3>
          
          {/* Add New Custom Measurement */}
          <div className="mb-4 p-4 bg-gray-50 rounded">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Measurement Name</label>
                <input
                  type="text"
                  placeholder="e.g., Bicep, Thigh, Calf"
                  value={newCustomMeasurement.name}
                  onChange={(e) => setNewCustomMeasurement(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-2 border rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Value</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="0.0"
                  value={newCustomMeasurement.value}
                  onChange={(e) => setNewCustomMeasurement(prev => ({ ...prev, value: e.target.value }))}
                  className="w-full p-2 border rounded text-sm"
                />
              </div>
              <div className="flex items-end space-x-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Unit</label>
                  <select
                    value={newCustomMeasurement.unit}
                    onChange={(e) => setNewCustomMeasurement(prev => ({ ...prev, unit: e.target.value }))}
                    className="w-full p-2 border rounded text-sm"
                  >
                    {measurementGlobalSettingsService.getAvailableUnits().map(unit => (
                      <option key={unit.value} value={unit.value}>{unit.shortLabel}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={addCustomMeasurement}
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 whitespace-nowrap"
                >
                  <FaPlus className="inline-block mr-1" /> Add
                </button>
              </div>
            </div>
          </div>

          {/* Display Custom Measurements */}
          {customMeasurements.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-700">Added Custom Measurements:</h4>
              {customMeasurements.map((custom, index) => (
                <div key={index} className="p-3 bg-white border rounded">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                      <input
                        type="text"
                        value={custom.name}
                        onChange={(e) => handleCustomMeasurementChange(index, 'name', e.target.value)}
                        className="w-full p-2 border rounded text-sm"
                        placeholder="Measurement name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Value</label>
                      <input
                        type="number"
                        step="0.1"
                        value={custom.value}
                        onChange={(e) => handleCustomMeasurementChange(index, 'value', e.target.value)}
                        className="w-full p-2 border rounded text-sm"
                        placeholder="0.0"
                      />
                    </div>
                    <div className="flex items-end space-x-2">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Unit</label>
                        <select
                          value={custom.unit}
                          onChange={(e) => handleCustomMeasurementChange(index, 'unit', e.target.value)}
                          className="w-full p-2 border rounded text-sm"
                        >
                          {measurementGlobalSettingsService.getAvailableUnits().map(unit => (
                            <option key={unit.value} value={unit.value}>{unit.shortLabel}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={() => removeCustomMeasurement(index)}
                        className="px-3 py-2 bg-red-500 text-white rounded text-sm hover:bg-red-600 whitespace-nowrap"
                        title="Remove measurement"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>


      {/* Scheduling and Priority Section */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Scheduling & Priority</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="deliveryDate" className="block text-sm font-medium text-gray-700">
              Delivery Date
            </label>
            <div className="relative mt-1">
              <input
                type="date"
                id="deliveryDate"
                className="block w-full p-2 border border-gray-300 rounded-md pr-10"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
              />
              <FaCalendarAlt className="absolute right-3 top-3 text-gray-400" />
            </div>
          </div>
          <div>
            <label htmlFor="remindDate" className="block text-sm font-medium text-gray-700">
              Reminder Date (Optional)
            </label>
            <div className="relative mt-1">
              <input
                type="date"
                id="remindDate"
                className="block w-full p-2 border border-gray-300 rounded-md pr-10"
                value={remindDate}
                onChange={(e) => setRemindDate(e.target.value)}
              />
              <FaCalendarAlt className="absolute right-3 top-3 text-gray-400" />
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center">
          <input
            type="checkbox"
            id="isUrgent"
            className="h-4 w-4 text-blue-600 border-gray-300 rounded"
            checked={isUrgent}
            onChange={(e) => setIsUrgent(e.target.checked)}
          />
          <label htmlFor="isUrgent" className="ml-2 block text-sm font-medium text-gray-900">
            Mark as Urgent
          </label>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-4">
        <button
          onClick={() => navigate('/orders')}
          className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center justify-center"
          disabled={isLoading}
        >
          {isLoading ? <FaSpinner className="animate-spin mr-2" /> : null}
          {isLoading ? 'Creating Order...' : 'Create Order'}
        </button>
      </div>
    </div>
  );
};

export default CreateOrder;
