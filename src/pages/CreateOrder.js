import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaCalendarAlt, FaSearch, FaPlus, FaSpinner } from 'react-icons/fa';
import { customerService } from '../services/customerService';
import { orderService } from '../services/orderService';
import { measurementService } from '../services/measurementService';
// eslint-disable-next-line no-unused-vars
import { getAllMeasurementFieldsFlat, createDefaultMeasurements } from '../services/measurementFieldsService';
import { getAllMeasurementFields as getStaticMeasurementFields } from '../config/measurementFields';
import { measurementGlobalSettingsService } from '../services/measurementGlobalSettingsService';
import { formatCustomerName } from '../utils/customerNameFormatter';
import ButtonColorSelector from '../components/ButtonColorSelector';

const CreateOrder = () => {
  const [customerType, setCustomerType] = useState('new');
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  // Editable customer details for both new and existing customers
  const [editableCustomerDetails, setEditableCustomerDetails] = useState({
    name: '',
    post: '',
    phone: '',
    email: '',
    address: ''
  });
  const [products, setProducts] = useState([{ name: '', price: '', quantity: 1, measurements: {} }]);
  const [measurementFields, setMeasurementFields] = useState({});
  // eslint-disable-next-line no-unused-vars
  const [defaultMeasurements, setDefaultMeasurements] = useState({});
  const [universalMeasurements, setUniversalMeasurements] = useState({});
  const [customMeasurements, setCustomMeasurements] = useState([]);
  const [newCustomMeasurement, setNewCustomMeasurement] = useState({ name: '', value: '', unit: 'inches' });
  const [globalUnit, setGlobalUnit] = useState('inches');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState('');
  const [includeShirt, setIncludeShirt] = useState(true);
  const [includePant, setIncludePant] = useState(true);
  const navigate = useNavigate();

  const handleMeasurementSelection = (type) => {
    if (type === 'shirt') {
      const newIncludeShirt = !includeShirt;
      if (!newIncludeShirt && !includePant) {
        alert("At least one measurement type must be selected.");
        return;
      }
      setIncludeShirt(newIncludeShirt);
    } else if (type === 'pant') {
      const newIncludePant = !includePant;
      if (!newIncludePant && !includeShirt) {
        alert("At least one measurement type must be selected.");
        return;
      }
      setIncludePant(newIncludePant);
    }
  };

  useEffect(() => {
    const loadCustomers = async () => {
      const allCustomers = await customerService.getAll();
      setCustomers(allCustomers);
    };


    const loadMeasurements = async () => {
      // Use static measurements from config instead of dynamic service
      const staticFields = getStaticMeasurementFields();
      const fieldsObject = {};
      staticFields.forEach(field => {
        if (field && field.name && field.label) {
          fieldsObject[field.name] = {
            label: field.label,
            value: '',
            unit: field.unit || globalUnit,
            required: false
          };
        }
      });
      setMeasurementFields(fieldsObject);
      setProducts([{ name: '', price: '', quantity: 1, measurements: fieldsObject }]);
    };

    const loadMeasurementTemplates = async (defaultUnit = 'inches') => {
      // Use static measurement fields
      const staticFields = getStaticMeasurementFields();
      
      // Create universal measurements from all static fields
      const allUniversalFields = {};
      staticFields.forEach(field => {
        if (field && field.name && field.label) {
          // Avoid duplicates by using field name as key
          if (!allUniversalFields[field.name]) {
            allUniversalFields[field.name] = {
              label: field.label,
              value: '',
              unit: field.unit || defaultUnit,
              required: false // All fields are optional
            };
          }
        }
      });
      
      console.log('All universal measurement fields from static config:', allUniversalFields);
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
          
          // Load measurements from separate records
          const newUniversalMeasurements = { ...universalMeasurements };
          const customMeasurementsFromData = [];
          
          // Load shirt measurements
          const shirtMeasurement = customerMeasurements.find(m => m.template_name === 'Shirt Measurements');
          if (shirtMeasurement && shirtMeasurement.data) {
            Object.keys(newUniversalMeasurements).forEach(field => {
              if (shirtMeasurement.data[field]) {
                newUniversalMeasurements[field] = {
                  ...newUniversalMeasurements[field],
                  value: shirtMeasurement.data[field]
                };
              }
            });
          }
          
          // Load pant measurements
          const pantMeasurement = customerMeasurements.find(m => m.template_name === 'Pant Measurements');
          if (pantMeasurement && pantMeasurement.data) {
            Object.keys(newUniversalMeasurements).forEach(field => {
              if (pantMeasurement.data[field]) {
                newUniversalMeasurements[field] = {
                  ...newUniversalMeasurements[field],
                  value: pantMeasurement.data[field]
                };
              }
            });
          }
          
          // Load custom measurements
          const customMeasurement = customerMeasurements.find(m => m.template_name === 'Custom Measurements');
          if (customMeasurement && customMeasurement.data) {
            Object.entries(customMeasurement.data).forEach(([key, value]) => {
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
          }
          
          // Also check legacy 'Universal Measurements' for backward compatibility
          const universalMeasurement = customerMeasurements.find(m => m.template_name === 'Universal Measurements');
          if (universalMeasurement && universalMeasurement.data) {
            Object.keys(newUniversalMeasurements).forEach(field => {
              if (universalMeasurement.data[field] && !newUniversalMeasurements[field].value) {
                newUniversalMeasurements[field] = {
                  ...newUniversalMeasurements[field],
                  value: universalMeasurement.data[field]
                };
              }
            });
            
            // Load custom measurements from universal data if not already loaded
            if (customMeasurementsFromData.length === 0) {
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
            }
          }
          
          setUniversalMeasurements(newUniversalMeasurements);
          setCustomMeasurements(customMeasurementsFromData);
          
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
    setProducts([...products, { name: '', price: '', quantity: 1, measurements: measurementFields }]);
  };

  const handleProductChange = async (index, field, value) => {
    const updatedProducts = [...products];
    updatedProducts[index][field] = value;

    if (field === 'name' && value !== 'custom' && value !== '') {
      // Product selected, assign static measurements
      const staticFields = getStaticMeasurementFields();
      const measurements = staticFields.reduce((acc, f) => {
        if (f && f.name && f.label) {
          acc[f.name] = {
            label: f.label,
            value: '',
            unit: globalUnit, // Always use global unit
            required: false // All fields are optional
          };
        }
        return acc;
      }, {});
      updatedProducts[index].measurements = measurements;
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

  // Handle customer details changes
  const handleCustomerDetailChange = (field, value) => {
    setEditableCustomerDetails(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Clear customer details when switching customer types
  const handleCustomerTypeChange = (type) => {
    setCustomerType(type);
    setSelectedCustomer(null);
    setSearchQuery('');
    setEditableCustomerDetails({
      name: '',
      post: '',
      phone: '',
      email: '',
      address: ''
    });
  };

  // Update customer selection to populate editable fields
  const handleCustomerSelection = (customer) => {
    setSelectedCustomer(customer);
    setSearchQuery('');
    setEditableCustomerDetails({
      name: customer.name || '',
      post: customer.post || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || ''
    });
  };

  // Helper function to calculate delivery date
  const calculateDeliveryDate = (days) => {
    const today = new Date();
    const deliveryDate = new Date(today);
    deliveryDate.setDate(today.getDate() + days);
    return deliveryDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
  };

  // Handle preset selection
  const handlePresetSelect = (days, presetLabel) => {
    const calculatedDate = calculateDeliveryDate(days);
    setDeliveryDate(calculatedDate);
    setSelectedPreset(presetLabel);
  };

  // Handle manual date selection
  const handleManualDateChange = (selectedDate) => {
    setDeliveryDate(selectedDate);
    setSelectedPreset(''); // Clear preset selection
  };

  const handleRemoveProduct = (index) => {
    if (products.length > 1) {
      const updatedProducts = [...products];
      updatedProducts.splice(index, 1);
      setProducts(updatedProducts);
    }
  };

  const calculateTotal = () => {
    return products.reduce((sum, product) => {
      const price = Number(product.price) || 0;
      return sum + price;
    }, 0);
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
          status: orderData.status || 'Pending',
          notes: orderData.notes || ''
        },
      items: orderItems.map(item => ({
        item_name: item.item_name || '',
        price: item.price || 0,
        quantity: item.quantity || 1
      })),
      payment: {
        total_amount: orderData.total_amount || 0,
        advance_payment: orderData.advance_payment || 0,
        due_amount: (orderData.total_amount || 0) - (orderData.advance_payment || 0)
      },
      measurements: {
        include_shirt: includeShirt,
        include_pant: includePant,
        shirt: {},
        pant: {},
        button: {},
        product_specific: {},
        custom: []
      }
    };

    // Separate universal measurements by category for receipt
    const staticFields = getStaticMeasurementFields();
    Object.entries(universalMeasurements).forEach(([field, measurement]) => {
      if (measurement.value) {
        const staticField = staticFields.find(f => f.name === field);
        const measurementData = {
          label: measurement.label,
          value: measurement.value,
          unit: measurement.unit
        };
        
        if (staticField) {
          if (staticField.category === 'shirt' && includeShirt) {
            receiptData.measurements.shirt[field] = measurementData;
          } else if (staticField.category === 'pant' && includePant) {
            receiptData.measurements.pant[field] = measurementData;
          } else if (staticField.category === 'button' && includeShirt) {
            receiptData.measurements.button[field] = measurementData;
          }
        }
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
          post: document.getElementById('newCustomerPost').value,
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
        total_amount: calculateTotal(),
        advance_payment: 0, // Can be added as a field later
        status: 'Pending',
        notes: null, // Use null instead of empty string
      };
      
      // Prepare order items
      const orderItems = products.map(product => ({
        item_name: product.name,
        price: Number(product.price) || 0,
        quantity: Number(product.quantity) || 1
      }));
      
      console.log(`🛒 Products from form:`, products);
      console.log(`📦 Prepared order items:`, orderItems);
      
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
      
      console.log(`📋 Final order data:`, orderData);
      console.log(`📦 Final order items to save:`, orderItems);
      
      // Create the order
      const savedOrder = await orderService.create(orderData, orderItems);
      console.log(`✅ Order saved:`, savedOrder);
      
      // Save measurements for each product
      if (customerId && savedOrder) {
        // Separate measurements by category
        const staticFields = getStaticMeasurementFields();
        const shirtMeasurementData = {};
        const pantMeasurementData = {};
        const buttonMeasurementData = {};
        const customMeasurementData = {};
        
        // Process universal measurements by category
        Object.entries(universalMeasurements).forEach(([field, measurement]) => {
          if (measurement.value && measurement.value !== '') {
            const staticField = staticFields.find(f => f.name === field);
            if (staticField) {
              if (staticField.category === 'shirt') {
                shirtMeasurementData[field] = measurement.value;
              } else if (staticField.category === 'pant') {
                pantMeasurementData[field] = measurement.value;
              } else if (staticField.category === 'button') {
                buttonMeasurementData[field] = measurement.value;
              }
            }
          }
        });
        
        // Add custom measurements to separate data
        customMeasurements.forEach((custom, index) => {
          if (custom.name && custom.value && custom.value !== '') {
            customMeasurementData[`custom_${index}_${custom.name.replace(/\s+/g, '_').toLowerCase()}`] = custom.value;
          }
        });
        
        // Save measurements separately by category
        if (Object.keys(shirtMeasurementData).length > 0 && includeShirt) {
          // Include button data with shirt measurements
          const combinedShirtData = { ...shirtMeasurementData, ...buttonMeasurementData };
          await measurementService.saveForCustomer(customerId, 'Shirt Measurements', combinedShirtData);
          console.log('✅ Saved shirt measurements:', combinedShirtData);
        }
        
        if (Object.keys(pantMeasurementData).length > 0 && includePant) {
          await measurementService.saveForCustomer(customerId, 'Pant Measurements', pantMeasurementData);
          console.log('✅ Saved pant measurements:', pantMeasurementData);
        }
        
        if (Object.keys(customMeasurementData).length > 0) {
          await measurementService.saveForCustomer(customerId, 'Custom Measurements', customMeasurementData);
          console.log('✅ Saved custom measurements:', customMeasurementData);
        }
        
        // Update the order with customer measurements reference
        const measurementReferences = [];
        if (Object.keys(shirtMeasurementData).length > 0 || Object.keys(buttonMeasurementData).length > 0) {
          measurementReferences.push({
            template_name: 'Shirt Measurements',
            data: { ...shirtMeasurementData, ...buttonMeasurementData }
          });
        }
        if (Object.keys(pantMeasurementData).length > 0) {
          measurementReferences.push({
            template_name: 'Pant Measurements',
            data: pantMeasurementData
          });
        }
        if (Object.keys(customMeasurementData).length > 0) {
          measurementReferences.push({
            template_name: 'Custom Measurements',
            data: customMeasurementData
          });
        }
        
        if (measurementReferences.length > 0) {
          // Log measurement references for debugging (measurements are already stored separately)
          console.log('✅ Measurement references created:', measurementReferences);
          console.log('ℹ️ Measurements are stored separately in measurements table, not in orders table');
        }
        
        // Save product-specific measurements
        for (const product of products) {
          if (Object.keys(product.measurements).length > 0) {
            const measurementData = {};
            Object.entries(product.measurements).forEach(([field, measurement]) => {
              if (measurement.value && measurement.value !== '') {
                measurementData[field] = measurement.value;
              }
            });
            
            if (Object.keys(measurementData).length > 0) {
              await measurementService.saveForCustomer(customerId, product.name, measurementData);
              console.log(`✅ Saved ${product.name} measurements:`, measurementData);
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
      alert(`Failed to create order: ${error.message}. Please try again.`);
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6">Create New Order</h1>
      
      {notification && <div className="mb-4 p-4 bg-green-200 text-green-800 rounded">{notification}</div>}

      {/* Customer Details Section */}
      <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Customer Details</h2>
        
        <div className="flex flex-wrap space-x-2 sm:space-x-4 mb-4">
          <button
            className={`px-3 py-2 sm:px-4 text-sm sm:text-base rounded ${customerType === 'new' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            onClick={() => handleCustomerTypeChange('new')}
          >
            New Customer
          </button>
          <button
            className={`px-3 py-2 sm:px-4 text-sm sm:text-base rounded ${customerType === 'existing' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            onClick={() => handleCustomerTypeChange('existing')}
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
                className="w-full p-2 border rounded pl-10 text-sm sm:text-base"
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
                        className="p-2 hover:bg-gray-100 cursor-pointer text-sm sm:text-base"
                        onClick={() => handleCustomerSelection(customer)}
                      >
                        {formatCustomerName(customer)} ({customer.phone || 'N/A'})
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            {/* Show editable form fields when customer is selected or for new customers */}
            {(selectedCustomer || customerType === 'existing') && (
              <div className="mt-4 space-y-4">
                {selectedCustomer && (
                  <div className="mb-4 p-3 border rounded bg-blue-50">
                    <h3 className="text-sm font-semibold text-blue-800 mb-1">Selected Customer (Editable):</h3>
                    <p className="text-xs text-blue-600">You can modify these details for this order only</p>
                  </div>
                )}
                
                {/* Editable form fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="existingCustomerName" className="block text-sm font-medium text-gray-700">
                      Client Name
                    </label>
                    <input 
                      type="text" 
                      id="existingCustomerName" 
                      className="mt-1 block w-full p-2 border border-gray-300 rounded-md text-sm sm:text-base"
                      value={editableCustomerDetails.name}
                      onChange={(e) => handleCustomerDetailChange('name', e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="existingCustomerPost" className="block text-sm font-medium text-gray-700">
                      Post (e.g., PSI, Havaldar)
                    </label>
                    <input 
                      type="text" 
                      id="existingCustomerPost" 
                      className="mt-1 block w-full p-2 border border-gray-300 rounded-md text-sm sm:text-base"
                      value={editableCustomerDetails.post}
                      onChange={(e) => handleCustomerDetailChange('post', e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="existingCustomerPhone" className="block text-sm font-medium text-gray-700">
                    Phone Number
                  </label>
                  <input 
                    type="text" 
                    id="existingCustomerPhone" 
                    className="mt-1 block w-full p-2 border border-gray-300 rounded-md text-sm sm:text-base"
                    value={editableCustomerDetails.phone}
                    onChange={(e) => handleCustomerDetailChange('phone', e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="existingCustomerEmail" className="block text-sm font-medium text-gray-700">
                    Email (Optional)
                  </label>
                  <input 
                    type="email" 
                    id="existingCustomerEmail" 
                    className="mt-1 block w-full p-2 border border-gray-300 rounded-md text-sm sm:text-base"
                    value={editableCustomerDetails.email}
                    onChange={(e) => handleCustomerDetailChange('email', e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="existingCustomerAddress" className="block text-sm font-medium text-gray-700">
                    Address
                  </label>
                  <textarea 
                    id="existingCustomerAddress" 
                    rows="3" 
                    className="mt-1 block w-full p-2 border border-gray-300 rounded-md text-sm sm:text-base"
                    placeholder="Enter customer address"
                    value={editableCustomerDetails.address}
                    onChange={(e) => handleCustomerDetailChange('address', e.target.value)}
                  ></textarea>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* First row: Name and Post */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="newCustomerName" className="block text-sm font-medium text-gray-700">
                  Client Name
                </label>
                <input type="text" id="newCustomerName" className="mt-1 block w-full p-2 border border-gray-300 rounded-md text-sm sm:text-base" />
              </div>
              <div>
                <label htmlFor="newCustomerPost" className="block text-sm font-medium text-gray-700">
                  Post (e.g., PSI, Havaldar)
                </label>
                <input type="text" id="newCustomerPost" className="mt-1 block w-full p-2 border border-gray-300 rounded-md text-sm sm:text-base" />
              </div>
            </div>
            {/* Second row: Phone Number */}
            <div>
              <label htmlFor="newCustomerPhone" className="block text-sm font-medium text-gray-700">
                Phone Number
              </label>
              <input type="text" id="newCustomerPhone" className="mt-1 block w-full p-2 border border-gray-300 rounded-md text-sm sm:text-base" />
            </div>
            <div>
              <label htmlFor="newCustomerEmail" className="block text-sm font-medium text-gray-700">
                Email (Optional)
              </label>
              <input type="email" id="newCustomerEmail" className="mt-1 block w-full p-2 border border-gray-300 rounded-md text-sm sm:text-base" />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="newCustomerAddress" className="block text-sm font-medium text-gray-700">
                Address
              </label>
              <textarea id="newCustomerAddress" rows="3" className="mt-1 block w-full p-2 border border-gray-300 rounded-md text-sm sm:text-base" placeholder="Enter customer address"></textarea>
            </div>
          </div>
        )}
      </div>

      {/* Order Items Section */}
      <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Order Items & Pricing</h2>
        
        {/* Header row with labels */}
        <div className="hidden sm:flex items-center space-x-4 mb-2 text-sm font-medium text-gray-700">
          <div className="flex-1">Product Name</div>
          <div className="w-24 text-center">Qty</div>
          <div className="w-32 text-center">Price (₹)</div>
          <div className="w-24"></div>
        </div>
        
        {products.map((product, index) => (
          <div key={index} className="mb-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center sm:space-x-4 mb-2">
              <input
                type="text"
                placeholder="Enter product name"
                className="flex-1 p-2 border rounded mb-2 sm:mb-0 text-sm sm:text-base"
                value={product.name}
                onChange={(e) => handleProductChange(index, 'name', e.target.value)}
              />
              <input
                type="number"
                min="1"
                placeholder="1"
                className="w-full sm:w-24 p-2 border rounded text-center mb-2 sm:mb-0 text-sm sm:text-base"
                value={product.quantity}
                onChange={(e) => handleProductChange(index, 'quantity', e.target.value)}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                className="w-full sm:w-32 p-2 border rounded text-right mb-2 sm:mb-0 text-sm sm:text-base"
                value={product.price}
                onChange={(e) => handleProductChange(index, 'price', e.target.value)}
              />
              {products.length > 1 ? (
                <button
                  onClick={() => handleRemoveProduct(index)}
                  className="w-full sm:w-24 p-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                >
                  Remove
                </button>
              ) : (
                <div className="w-20"></div>
              )}
            </div>
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
      <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Universal Measurements</h2>
        
        {customerType === 'existing' && selectedCustomer && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <h3 className="text-md font-semibold text-yellow-800 mb-2">Measurement Selection</h3>
            <p className="text-sm text-gray-600 mb-2">Select which measurements to include for this order.</p>
            <div className="flex items-center space-x-6">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeShirt}
                  onChange={() => handleMeasurementSelection('shirt')}
                  className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-gray-800 font-medium">Shirt Measurements</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={includePant}
                  onChange={() => handleMeasurementSelection('pant')}
                  className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-gray-800 font-medium">Pant Measurements</span>
              </label>
            </div>
          </div>
        )}

        <p className="text-sm text-gray-600 mb-4">These measurements will be saved for the customer and can be used across all orders.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Shirt Measurements Column */}
          {includeShirt && (
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center">
              <span className="mr-2">👔</span> Shirt Measurements
            </h3>
            
            {/* Button Color Selector in Shirt Column */}
            {Object.entries(universalMeasurements)
              .filter(([field, measurement]) => {
                const staticFields = getStaticMeasurementFields();
                const staticField = staticFields.find(f => f.name === field);
                return staticField && staticField.category === 'button';
              })
              .map(([field, measurement]) => {
                const staticFields = getStaticMeasurementFields();
                const staticField = staticFields.find(f => f.name === field);
                return (
                  <div key={field} className="mb-4">
                    <ButtonColorSelector
                      name={field}
                      label={measurement.label}
                      value={measurement.value || ''}
                      onChange={(e) => handleUniversalMeasurementChange(field, e.target.value)}
                      options={staticField.options}
                    />
                  </div>
                );
              })}
            
            <div className="space-y-4">
              {Object.entries(universalMeasurements)
                .filter(([field, measurement]) => {
                  const staticFields = getStaticMeasurementFields();
                  const staticField = staticFields.find(f => f.name === field);
                  return staticField && staticField.category === 'shirt';
                })
                .map(([field, measurement]) => {
                  const hasValue = measurement.value && measurement.value !== '' && measurement.value !== '0';
                  return (
                    <div key={field} className={`flex flex-col space-y-2 ${hasValue ? 'bg-green-50 border border-green-200 rounded-lg p-4' : 'bg-white rounded-lg p-4 border border-gray-200'}`}>
                      <label className="text-base font-semibold text-gray-900">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-900">
                            {measurement.label} {measurement.required && <span className="text-red-500">*</span>}
                            <span className="text-gray-600 ml-2 font-medium">({measurement.unit})</span>
                          </span>
                          {hasValue && (
                            <span className="text-sm bg-green-100 text-green-800 px-3 py-1 rounded-full font-medium">
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
                })
              }
            </div>
          </div>
          )}
          
          {/* Pant Measurements Column */}
          {includePant && (
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <h3 className="text-lg font-semibold text-green-900 mb-4 flex items-center">
              <span className="mr-2">👖</span> Pant Measurements
            </h3>
            <div className="space-y-4">
              {Object.entries(universalMeasurements)
                .filter(([field, measurement]) => {
                  const staticFields = getStaticMeasurementFields();
                  const staticField = staticFields.find(f => f.name === field);
                  return staticField && staticField.category === 'pant';
                })
                .map(([field, measurement]) => {
                  const hasValue = measurement.value && measurement.value !== '' && measurement.value !== '0';
                  return (
                    <div key={field} className={`flex flex-col space-y-2 ${hasValue ? 'bg-green-50 border border-green-200 rounded-lg p-4' : 'bg-white rounded-lg p-4 border border-gray-200'}`}>
                      <label className="text-base font-semibold text-gray-900">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-900">
                            {measurement.label} {measurement.required && <span className="text-red-500">*</span>}
                            <span className="text-gray-600 ml-2 font-medium">({measurement.unit})</span>
                          </span>
                          {hasValue && (
                            <span className="text-sm bg-green-100 text-green-800 px-3 py-1 rounded-full font-medium">
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
                })
              }
            </div>
          </div>
          )}
        </div>

        {/* Measurement Summary */}
        {Object.keys(universalMeasurements).length > 0 && (
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 mb-6">
            <h3 className="font-semibold text-gray-800 mb-2">Universal Measurements Summary</h3>
        <div className="flex flex-wrap items-center space-x-4 sm:space-x-6 text-sm">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
              <div className="sm:col-span-2 md:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Measurement Name</label>
                <input
                  type="text"
                  placeholder="e.g., Bicep, Thigh, Calf"
                  value={newCustomMeasurement.name}
                  onChange={(e) => setNewCustomMeasurement(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-2 border rounded text-sm sm:text-base"
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
                  className="w-full p-2 border rounded text-sm sm:text-base"
                />
              </div>
              <div className="flex items-end space-x-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Unit</label>
                  <select
                    value={newCustomMeasurement.unit}
                    onChange={(e) => setNewCustomMeasurement(prev => ({ ...prev, unit: e.target.value }))}
                    className="w-full p-2 border rounded text-sm sm:text-base"
                  >
                    {measurementGlobalSettingsService.getAvailableUnits().map(unit => (
                      <option key={unit.value} value={unit.value}>{unit.shortLabel}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={addCustomMeasurement}
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm sm:text-base hover:bg-blue-700 whitespace-nowrap"
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


      {/* Scheduling Section */}
      <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Scheduling</h2>
        
        {/* Delivery Date Presets */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button 
            onClick={() => handlePresetSelect(5, '5 days')} 
            className={`px-3 py-2 sm:px-4 rounded-lg text-sm font-medium transition-colors ${
              selectedPreset === '5 days' 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
          >
            5 days
          </button>
          <button 
            onClick={() => handlePresetSelect(10, '10 days')} 
            className={`px-3 py-2 sm:px-4 rounded-lg text-sm font-medium transition-colors ${
              selectedPreset === '10 days' 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
          >
            10 days
          </button>
          <button 
            onClick={() => handlePresetSelect(15, '15 days')} 
            className={`px-3 py-2 sm:px-4 rounded-lg text-sm font-medium transition-colors ${
              selectedPreset === '15 days' 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
          >
            15 days
          </button>
          <button 
            onClick={() => handlePresetSelect(20, '20 days')} 
            className={`px-3 py-2 sm:px-4 rounded-lg text-sm font-medium transition-colors ${
              selectedPreset === '20 days' 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
          >
            20 days
          </button>
        </div>
        
        {/* Calendar Date Input */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="deliveryDate" className="block text-sm font-medium text-gray-700">
              Delivery Date
            </label>
            <div className="relative mt-1">
              <input
                type="date"
                id="deliveryDate"
                className="block w-full p-2 border border-gray-300 rounded-md pr-10 text-sm sm:text-base"
                value={deliveryDate}
                onChange={(e) => handleManualDateChange(e.target.value)}
              />
              <FaCalendarAlt className="absolute right-3 top-3 text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-4">
        <button
          onClick={() => navigate('/orders')}
          className="w-full sm:w-auto px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          className="w-full sm:w-auto px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center justify-center"
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
