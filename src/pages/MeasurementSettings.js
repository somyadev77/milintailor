import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit, GripVertical } from 'lucide-react';
import { supabase } from '../supabaseClient';

const MeasurementSettings = () => {
  const [customFields, setCustomFields] = useState([]);
  const [isAddingField, setIsAddingField] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [globalSettings, setGlobalSettings] = useState({
    defaultUnit: 'inches'
  });
  const [newField, setNewField] = useState({
    name: '',
    label: '',
    type: 'number',
    unit: 'inches',
    required: false,
    category: 'body'
  });

  // Update new field unit when global settings change
  useEffect(() => {
    setNewField(prev => ({
      ...prev,
      unit: globalSettings.defaultUnit
    }));
  }, [globalSettings.defaultUnit]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fieldTypes = [
    { value: 'number', label: 'Number' },
    { value: 'text', label: 'Text' },
    { value: 'select', label: 'Dropdown' }
  ];

  const units = [
    { value: 'inches', label: 'Inches (in)' },
    { value: 'cm', label: 'Centimeters (cm)' },
    { value: 'mm', label: 'Millimeters (mm)' },
    { value: 'feet', label: 'Feet (ft)' },
    { value: 'meters', label: 'Meters (m)' }
  ];

  const categories = [
    { value: 'body', label: 'Body Measurements' },
    { value: 'garment', label: 'Garment Specifications' },
    { value: 'style', label: 'Style Preferences' },
    { value: 'other', label: 'Other' }
  ];

  // Default measurement fields that cannot be deleted
  const defaultFields = [
    { name: 'chest', label: 'Chest', type: 'number', unit: 'inches', category: 'body', isDefault: true },
    { name: 'waist', label: 'Waist', type: 'number', unit: 'inches', category: 'body', isDefault: true },
    { name: 'hip', label: 'Hip', type: 'number', unit: 'inches', category: 'body', isDefault: true },
    { name: 'shoulder', label: 'Shoulder', type: 'number', unit: 'inches', category: 'body', isDefault: true },
    { name: 'sleeveLength', label: 'Sleeve Length', type: 'number', unit: 'inches', category: 'body', isDefault: true },
    { name: 'neckSize', label: 'Neck Size', type: 'number', unit: 'inches', category: 'body', isDefault: true },
    { name: 'inseam', label: 'Inseam', type: 'number', unit: 'inches', category: 'body', isDefault: true },
    { name: 'outseam', label: 'Outseam', type: 'number', unit: 'inches', category: 'body', isDefault: true }
  ];

  useEffect(() => {
    loadCustomFields();
    loadGlobalSettings();
  }, []);

  const loadCustomFields = async () => {
    try {
      setLoading(true);
      // Try to load from Supabase first
      const { data, error } = await supabase
        .from('measurement_fields')
        .select('*')
        .order('order_index');

      if (error) {
        console.warn('Supabase not available, loading from IndexedDB:', error);
        // Fallback to IndexedDB
        const savedFields = localStorage.getItem('customMeasurementFields');
        if (savedFields) {
          setCustomFields(JSON.parse(savedFields));
        }
      } else {
        setCustomFields(data || []);
      }
    } catch (err) {
      console.warn('Error loading custom fields, using local storage:', err);
      const savedFields = localStorage.getItem('customMeasurementFields');
      if (savedFields) {
        setCustomFields(JSON.parse(savedFields));
      }
    } finally {
      setLoading(false);
    }
  };

  const loadGlobalSettings = async () => {
    try {
      // Try to load from Supabase first
      const { data, error } = await supabase
        .from('measurement_settings')
        .select('*')
        .single();

      if (error || !data) {
        console.warn('Supabase settings not available, loading from localStorage:', error);
        // Fallback to localStorage
        const savedSettings = localStorage.getItem('measurementGlobalSettings');
        if (savedSettings) {
          setGlobalSettings(JSON.parse(savedSettings));
        }
      } else {
        setGlobalSettings({
          defaultUnit: data.default_unit || 'inches'
        });
      }
    } catch (err) {
      console.warn('Error loading global settings, using localStorage:', err);
      const savedSettings = localStorage.getItem('measurementGlobalSettings');
      if (savedSettings) {
        setGlobalSettings(JSON.parse(savedSettings));
      }
    }
  };

  const saveGlobalSettings = async (settings) => {
    // Save to localStorage as backup
    localStorage.setItem('measurementGlobalSettings', JSON.stringify(settings));
    
    try {
      // Try to save to Supabase
      const { error } = await supabase
        .from('measurement_settings')
        .upsert({
          id: 1, // Single row for global settings
          default_unit: settings.defaultUnit,
          updated_at: new Date().toISOString()
        });
      
      if (error) {
        console.warn('Could not sync global settings to Supabase:', error);
      }
    } catch (err) {
      console.warn('Supabase sync failed for global settings:', err);
    }
  };

  const saveToStorage = async (fields) => {
    // Save to localStorage as backup
    localStorage.setItem('customMeasurementFields', JSON.stringify(fields));
    
    try {
      // Try to save to Supabase
      const { error } = await supabase
        .from('measurement_fields')
        .upsert(fields.map((field, index) => ({
          ...field,
          order_index: index
        })));
      
      if (error) {
        console.warn('Could not sync to Supabase:', error);
      }
    } catch (err) {
      console.warn('Supabase sync failed:', err);
    }
  };

  const handleAddField = async () => {
    if (!newField.name || !newField.label) {
      alert('Please fill in both name and label fields');
      return;
    }

    // Check for duplicate names
    const allFields = [...defaultFields, ...customFields];
    if (allFields.some(field => field.name === newField.name)) {
      alert('A field with this name already exists');
      return;
    }

    setSaving(true);
    try {
      const fieldToAdd = {
        ...newField,
        id: Date.now().toString(),
        created_at: new Date().toISOString()
      };

      const updatedFields = [...customFields, fieldToAdd];
      setCustomFields(updatedFields);
      await saveToStorage(updatedFields);
      
      // Reset form with global default unit
      setNewField({
        name: '',
        label: '',
        type: 'number',
        unit: globalSettings.defaultUnit,
        required: false,
        category: 'body'
      });
      setIsAddingField(false);
    } catch (err) {
      console.error('Error adding field:', err);
      alert('Error adding field. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditField = async (fieldId, updatedField) => {
    setSaving(true);
    try {
      const updatedFields = customFields.map(field => 
        field.id === fieldId ? { ...field, ...updatedField } : field
      );
      setCustomFields(updatedFields);
      await saveToStorage(updatedFields);
      setEditingField(null);
    } catch (err) {
      console.error('Error updating field:', err);
      alert('Error updating field. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteField = async (fieldId) => {
    if (!window.confirm('Are you sure you want to delete this field?')) {
      return;
    }

    setSaving(true);
    try {
      const updatedFields = customFields.filter(field => field.id !== fieldId);
      setCustomFields(updatedFields);
      await saveToStorage(updatedFields);
    } catch (err) {
      console.error('Error deleting field:', err);
      alert('Error deleting field. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const FieldForm = ({ field, onSave, onCancel, isEditing = false }) => {
    const [formData, setFormData] = useState(field);

    return (
      <div className="bg-gray-50 p-4 rounded-lg border">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Field Name (Internal) *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., bicep, thigh"
              disabled={isEditing} // Don't allow changing name when editing
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Display Label *
            </label>
            <input
              type="text"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Bicep, Thigh"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Field Type
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {fieldTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unit (for number fields)
            </label>
            <select
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={formData.type !== 'number'}
            >
              {units.map(unit => (
                <option key={unit.value} value={unit.value}>{unit.label}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {categories.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id={`required-${formData.name}`}
              checked={formData.required}
              onChange={(e) => setFormData({ ...formData, required: e.target.checked })}
              className="mr-2"
            />
            <label htmlFor={`required-${formData.name}`} className="text-sm text-gray-700">
              Required field
            </label>
          </div>
        </div>
        
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => onSave(formData)}
            disabled={saving}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : (isEditing ? 'Update' : 'Add Field')}
          </button>
          <button
            onClick={onCancel}
            className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Loading measurement settings...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Measurement Settings</h1>
        <p className="text-gray-600">
          Manage custom measurement fields that will appear in the order creation form.
        </p>
      </div>

      {/* Global Settings Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Global Settings</h2>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Unit
              </label>
              <select
                value={globalSettings.defaultUnit}
                onChange={(e) => {
                  const newSettings = { ...globalSettings, defaultUnit: e.target.value };
                  setGlobalSettings(newSettings);
                  saveGlobalSettings(newSettings);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {units.map(unit => (
                  <option key={unit.value} value={unit.value}>{unit.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Default Unit
              </label>
              <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-700">
                {units.find(u => u.value === globalSettings.defaultUnit)?.label || 'Inches (in)'}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                This unit will be used as default for new measurement fields
              </p>
            </div>
          </div>
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">💡 Pro Tip</h4>
            <p className="text-sm text-blue-800">
              Choose the unit system that your tailor shop primarily uses. This will be applied to all new measurement fields by default, but you can still customize individual field units as needed.
            </p>
          </div>
        </div>
      </div>

      {/* Default Fields Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Default Measurement Fields</h2>
        <div className="bg-white rounded-lg shadow">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
            {defaultFields.map(field => (
              <div key={field.name} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-medium text-gray-900">{field.label}</h3>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    Default
                  </span>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <div>Type: {field.type}</div>
                  <div>Unit: {field.unit}</div>
                  <div>Category: {field.category}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Custom Fields Section */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Custom Measurement Fields</h2>
          <button
            onClick={() => setIsAddingField(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus size={16} />
            Add Custom Field
          </button>
        </div>

        {/* Add New Field Form */}
        {isAddingField && (
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-800 mb-3">Add New Custom Field</h3>
            <FieldForm
              field={newField}
              onSave={handleAddField}
              onCancel={() => setIsAddingField(false)}
            />
          </div>
        )}

        {/* Custom Fields List */}
        <div className="bg-white rounded-lg shadow">
          {customFields.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>No custom measurement fields added yet.</p>
              <p className="text-sm">Click "Add Custom Field" to create your first custom measurement field.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {customFields.map((field, index) => (
                <div key={field.id} className="p-6">
                  {editingField === field.id ? (
                    <FieldForm
                      field={field}
                      onSave={(updatedField) => handleEditField(field.id, updatedField)}
                      onCancel={() => setEditingField(null)}
                      isEditing={true}
                    />
                  ) : (
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <GripVertical size={16} className="text-gray-400" />
                          <h3 className="font-medium text-gray-900">{field.label}</h3>
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                            Custom
                          </span>
                          {field.required && (
                            <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                              Required
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>Name: <span className="font-mono">{field.name}</span></div>
                          <div>Type: {field.type}</div>
                          <div>Unit: {field.unit}</div>
                          <div>Category: {field.category}</div>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => setEditingField(field.id)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Edit field"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteField(field.id)}
                          className="text-red-600 hover:text-red-800"
                          title="Delete field"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Usage Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">How to use custom fields</h3>
        <div className="text-blue-800 space-y-2">
          <p>• Custom fields will automatically appear in the order creation form</p>
          <p>• Fields are grouped by category for better organization</p>
          <p>• Required fields must be filled out before saving an order</p>
          <p>• Field names should be unique and use lowercase with underscores (e.g., arm_length)</p>
          <p>• Changes are automatically saved and synced across devices</p>
        </div>
      </div>
    </div>
  );
};

export default MeasurementSettings;
