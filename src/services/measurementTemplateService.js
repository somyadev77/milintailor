import { db, addRecord, updateRecord, deleteRecord } from '../db';

export const measurementTemplateService = {
  // Get all measurement templates
  async getAll() {
    try {
      const templates = await db.measurement_templates
        .where('sync_status')
        .notEqual('deleted')
        .toArray();
      
      return templates.filter(template => template && template.name).sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('Error fetching measurement templates:', error);
      return [];
    }
  },

  // Get template by ID
  async getById(id) {
    try {
      return await db.measurement_templates.get(id);
    } catch (error) {
      console.error('Error fetching measurement template:', error);
      return null;
    }
  },

  // Search templates by name
  async search(query) {
    try {
      const templates = await this.getAll();
      return templates.filter(template => 
        template && template.name && template.name.toLowerCase().includes(query.toLowerCase())
      );
    } catch (error) {
      console.error('Error searching measurement templates:', error);
      return [];
    }
  },

  // Add new measurement template
  async add(templateData) {
    try {
      const template = await addRecord('measurement_templates', {
        ...templateData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      return template;
    } catch (error) {
      console.error('Error adding measurement template:', error);
      throw error;
    }
  },

  // Update measurement template
  async update(id, templateData) {
    try {
      const updatedTemplate = await updateRecord('measurement_templates', id, {
        ...templateData,
        updated_at: new Date().toISOString()
      });
      return updatedTemplate;
    } catch (error) {
      console.error('Error updating measurement template:', error);
      throw error;
    }
  },

  // Delete measurement template
  async delete(id) {
    try {
      await deleteRecord('measurement_templates', id);
      return true;
    } catch (error) {
      console.error('Error deleting measurement template:', error);
      throw error;
    }
  },

  // Get all unique fields from all templates
  async getAllUniqueFields() {
    try {
      const templates = await this.getAll();
      const fieldsMap = new Map();
      
      // Collect all fields from all templates
      templates.forEach(template => {
        if (template.fields && Array.isArray(template.fields)) {
          template.fields.forEach(field => {
            if (field.name && !fieldsMap.has(field.name)) {
              fieldsMap.set(field.name, {
                name: field.name,
                label: field.label || field.name,
                unit: field.unit || 'inches',
                required: false // Make all fields optional for order creation
              });
            }
          });
        }
      });
      
      return Array.from(fieldsMap.values()).sort((a, b) => a.label.localeCompare(b.label));
    } catch (error) {
      console.error('Error getting all unique fields:', error);
      return [];
    }
  },

  // Get default templates (create some basic ones if none exist)
  async getDefaultTemplates() {
    try {
      console.log('📋 Getting default templates...');
      const existingTemplates = await this.getAll();
      console.log('📊 Existing templates found:', existingTemplates.length);
      
      if (existingTemplates.length === 0) {
        console.log('🆕 No templates found, creating default templates...');
        // Create default templates
        const defaultTemplates = [
          {
            name: 'Men\'s Shirt',
            fields: [
              { name: 'chest', label: 'Chest', unit: 'inches', required: false },
              { name: 'shoulder', label: 'Shoulder', unit: 'inches', required: false },
              { name: 'sleeve_length', label: 'Sleeve Length', unit: 'inches', required: false },
              { name: 'shirt_length', label: 'Shirt Length', unit: 'inches', required: false },
              { name: 'collar', label: 'Collar', unit: 'inches', required: false },
              { name: 'waist', label: 'Waist', unit: 'inches', required: false }
            ]
          },
          {
            name: 'Men\'s Trouser',
            fields: [
              { name: 'waist', label: 'Waist', unit: 'inches', required: false },
              { name: 'hip', label: 'Hip', unit: 'inches', required: false },
              { name: 'inseam', label: 'Inseam', unit: 'inches', required: false },
              { name: 'outseam', label: 'Outseam', unit: 'inches', required: false },
              { name: 'thigh', label: 'Thigh', unit: 'inches', required: false },
              { name: 'knee', label: 'Knee', unit: 'inches', required: false },
              { name: 'bottom', label: 'Bottom', unit: 'inches', required: false }
            ]
          },
          {
            name: 'Women\'s Blouse',
            fields: [
              { name: 'bust', label: 'Bust', unit: 'inches', required: false },
              { name: 'waist', label: 'Waist', unit: 'inches', required: false },
              { name: 'shoulder', label: 'Shoulder', unit: 'inches', required: false },
              { name: 'sleeve_length', label: 'Sleeve Length', unit: 'inches', required: false },
              { name: 'blouse_length', label: 'Blouse Length', unit: 'inches', required: false },
              { name: 'neck', label: 'Neck', unit: 'inches', required: false }
            ]
          },
          {
            name: 'Women\'s Skirt',
            fields: [
              { name: 'waist', label: 'Waist', unit: 'inches', required: false },
              { name: 'hip', label: 'Hip', unit: 'inches', required: false },
              { name: 'skirt_length', label: 'Skirt Length', unit: 'inches', required: false },
              { name: 'thigh', label: 'Thigh', unit: 'inches', required: false }
            ]
          }
        ];

        // Add default templates to database
        for (const template of defaultTemplates) {
          await this.add(template);
        }

        return await this.getAll();
      }

      return existingTemplates;
    } catch (error) {
      console.error('Error getting default templates:', error);
      return [];
    }
  }
};
