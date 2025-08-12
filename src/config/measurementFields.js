// Static measurement fields configuration

export const measurementFields = [
  // PANT measurements (as per error.txt)
  { name: 'pant_length', label: 'લંબાઈ - Length', unit: 'inches', category: 'pant' },
  { name: 'waist', label: 'કમર - Waist', unit: 'inches', category: 'pant' },
  { name: 'seat', label: 'સીટ - Seat/Hips', unit: 'inches', category: 'pant' },
  { name: 'thigh_loose', label: 'જાંઘ લુઝ - Thigh Loose', unit: 'inches', category: 'pant' },
  { name: 'knee_loose', label: 'ટણ લુઝ - Knee Loose', unit: 'inches', category: 'pant' },
  { name: 'bottom', label: 'મોરી - Bottom', unit: 'inches', category: 'pant' },
  
  // SHIRT measurements (as per error.txt)
  { name: 'shirt_length', label: 'લંબાઈ - Length', unit: 'inches', category: 'shirt' },
  { name: 'shoulder', label: 'શોલ્ડર - Shoulder', unit: 'inches', category: 'shirt' },
  { name: 'sleeve', label: 'બાંય - Sleeve', unit: 'inches', category: 'shirt' },
  { name: 'sleeve_loose', label: 'બાંય લુઝ - Sleeve Loose', unit: 'inches', category: 'shirt' },
  { name: 'chest', label: 'છાતી - Chest', unit: 'inches', category: 'shirt' },
  { name: 'shirt_waist', label: 'કમર - Waist', unit: 'inches', category: 'shirt' },
  { name: 'collar', label: 'કોલર - Collar', unit: 'inches', category: 'shirt' },

  // BUTTON COLOR - Separate category
  {
    name: 'button_color',
    label: 'બટન રંગ - Button Color',
    category: 'button',
    type: 'select',
    options: [
      { value: '', label: 'Select Color' },
      { value: 'black', label: 'Black', colorCode: '#000000' },
      { value: 'white', label: 'White', colorCode: '#FFFFFF' },
      { value: 'khaki', label: 'Khaki', colorCode: '#F0E68C' },
      { value: 'gold', label: 'Gold', colorCode: '#FFD700' },
      { value: 'silver', label: 'Silver', colorCode: '#C0C0C0' },
      { value: 'brass', label: 'Brass', colorCode: '#B5A642' },
      { value: 'navy_blue', label: 'Navy Blue', colorCode: '#000080' }
    ]
  }
];

// Helper functions for working with measurement fields
export const getMeasurementFieldsMap = () => {
  const fieldsMap = new Map();
  measurementFields.forEach(field => {
    fieldsMap.set(field.name, {
      name: field.name,
      label: field.label,
      unit: field.unit || 'inches',
      category: field.category || 'body',
      required: false // All fields are optional
    });
  });
  return fieldsMap;
};

export const getMeasurementFieldsByCategory = () => {
  const fieldsByCategory = {};
  measurementFields.forEach(field => {
    const category = field.category || 'other';
    if (!fieldsByCategory[category]) {
      fieldsByCategory[category] = [];
    }
    fieldsByCategory[category].push(field);
  });
  return fieldsByCategory;
};

export const getAllMeasurementFields = () => {
  return measurementFields.map(field => ({
    ...field,
    required: false // All fields are optional
  }));
};

export const createDefaultMeasurements = () => {
  const measurements = {};
  measurementFields.forEach(field => {
    measurements[field.name] = {
      label: field.label,
      value: '',
      unit: field.unit || 'inches',
      required: false
    };
  });
  return measurements;
};
