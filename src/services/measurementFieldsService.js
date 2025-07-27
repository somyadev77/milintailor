import { supabase } from '../supabaseClient';

// Default measurement fields that are always available
export const defaultMeasurementFields = [
  { name: 'chest', label: 'Chest', type: 'number', unit: 'inches', category: 'body', isDefault: true },
  { name: 'waist', label: 'Waist', type: 'number', unit: 'inches', category: 'body', isDefault: true },
  { name: 'hip', label: 'Hip', type: 'number', unit: 'inches', category: 'body', isDefault: true },
  { name: 'shoulder', label: 'Shoulder', type: 'number', unit: 'inches', category: 'body', isDefault: true },
  { name: 'sleeveLength', label: 'Sleeve Length', type: 'number', unit: 'inches', category: 'body', isDefault: true },
  { name: 'neckSize', label: 'Neck Size', type: 'number', unit: 'inches', category: 'body', isDefault: true },
  { name: 'inseam', label: 'Inseam', type: 'number', unit: 'inches', category: 'body', isDefault: true },
  { name: 'outseam', label: 'Outseam', type: 'number', unit: 'inches', category: 'body', isDefault: true }
];

/**
 * Load custom measurement fields from storage
 * @returns {Promise<Array>} Array of custom measurement fields
 */
export const loadCustomMeasurementFields = async () => {
  try {
    // Try to load from Supabase first
    const { data, error } = await supabase
      .from('measurement_fields')
      .select('*');

    if (error) {
      console.warn('Supabase not available, loading from localStorage:', error);
      // Fallback to localStorage
      const savedFields = localStorage.getItem('customMeasurementFields');
      return savedFields ? JSON.parse(savedFields) : [];
    }

    return data || [];
  } catch (err) {
    console.warn('Error loading custom fields, using localStorage:', err);
    const savedFields = localStorage.getItem('customMeasurementFields');
    return savedFields ? JSON.parse(savedFields) : [];
  }
};

/**
 * Get all measurement fields (default + custom) organized by category
 * @returns {Promise<Object>} Object with categories as keys and field arrays as values
 */
export const getAllMeasurementFields = async () => {
  const customFields = await loadCustomMeasurementFields();
  const allFields = [...defaultMeasurementFields, ...customFields];
  
  // Group fields by category
  const fieldsByCategory = allFields.reduce((acc, field) => {
    const category = field.category || 'other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(field);
    return acc;
  }, {});

  return fieldsByCategory;
};

/**
 * Get all measurement fields as a flat array
 * @returns {Promise<Array>} Array of all measurement fields
 */
export const getAllMeasurementFieldsFlat = async () => {
  const customFields = await loadCustomMeasurementFields();
  return [...defaultMeasurementFields, ...customFields];
};

/**
 * Create default measurement object with all fields set to empty values
 * @returns {Promise<Object>} Object with field names as keys and empty values
 */
export const createDefaultMeasurements = async () => {
  const allFields = await getAllMeasurementFieldsFlat();
  const measurements = {};
  
  allFields.forEach(field => {
    switch (field.type) {
      case 'number':
        measurements[field.name] = '';
        break;
      case 'text':
        measurements[field.name] = '';
        break;
      case 'select':
        measurements[field.name] = '';
        break;
      default:
        measurements[field.name] = '';
    }
  });

  return measurements;
};

/**
 * Validate measurements against field requirements
 * @param {Object} measurements - Measurements object to validate
 * @returns {Promise<Object>} Validation result with isValid and errors
 */
export const validateMeasurements = async (measurements) => {
  const allFields = await getAllMeasurementFieldsFlat();
  const errors = [];

  allFields.forEach(field => {
    if (field.required && (!measurements[field.name] || measurements[field.name] === '')) {
      errors.push(`${field.label} is required`);
    }

    // Type-specific validation
    if (measurements[field.name] && field.type === 'number') {
      const value = parseFloat(measurements[field.name]);
      if (isNaN(value) || value < 0) {
        errors.push(`${field.label} must be a valid positive number`);
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Format measurement value for display
 * @param {*} value - The measurement value
 * @param {Object} field - The field definition
 * @returns {string} Formatted value with unit
 */
export const formatMeasurementValue = (value, field) => {
  if (!value) return '';
  
  if (field.type === 'number' && field.unit) {
    return `${value} ${field.unit}`;
  }
  
  return value.toString();
};

/**
 * Get field definition by name
 * @param {string} fieldName - Name of the field
 * @returns {Promise<Object|null>} Field definition or null if not found
 */
export const getFieldByName = async (fieldName) => {
  const allFields = await getAllMeasurementFieldsFlat();
  return allFields.find(field => field.name === fieldName) || null;
};

/**
 * Save custom measurement fields to storage
 * @param {Array} fields - Array of custom fields to save
 * @returns {Promise<void>}
 */
export const saveCustomMeasurementFields = async (fields) => {
  // Save to localStorage as backup
  localStorage.setItem('customMeasurementFields', JSON.stringify(fields));
  
  try {
    // Try to save to Supabase (without order_index if column doesn't exist)
    const { error } = await supabase
      .from('measurement_fields')
      .upsert(fields);
    
    if (error) {
      console.warn('Could not sync to Supabase:', error);
    }
  } catch (err) {
    console.warn('Supabase sync failed:', err);
  }
};
