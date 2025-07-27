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

  // Get default templates (create some basic ones if none exist)
  async getDefaultTemplates() {
    try {
      const existingTemplates = await this.getAll();
      
      if (existingTemplates.length === 0) {
        // Create default templates
        const defaultTemplates = [
          {
            name: 'Men\'s Shirt',
            fields: [
              { name: 'chest', label: 'Chest', unit: 'inches', required: true },
              { name: 'shoulder', label: 'Shoulder', unit: 'inches', required: true },
              { name: 'sleeve_length', label: 'Sleeve Length', unit: 'inches', required: true },
              { name: 'shirt_length', label: 'Shirt Length', unit: 'inches', required: true },
              { name: 'collar', label: 'Collar', unit: 'inches', required: false },
              { name: 'waist', label: 'Waist', unit: 'inches', required: false }
            ]
          },
          {
            name: 'Men\'s Trouser',
            fields: [
              { name: 'waist', label: 'Waist', unit: 'inches', required: true },
              { name: 'hip', label: 'Hip', unit: 'inches', required: true },
              { name: 'inseam', label: 'Inseam', unit: 'inches', required: true },
              { name: 'outseam', label: 'Outseam', unit: 'inches', required: true },
              { name: 'thigh', label: 'Thigh', unit: 'inches', required: false },
              { name: 'knee', label: 'Knee', unit: 'inches', required: false },
              { name: 'bottom', label: 'Bottom', unit: 'inches', required: false }
            ]
          },
          {
            name: 'Women\'s Blouse',
            fields: [
              { name: 'bust', label: 'Bust', unit: 'inches', required: true },
              { name: 'waist', label: 'Waist', unit: 'inches', required: true },
              { name: 'shoulder', label: 'Shoulder', unit: 'inches', required: true },
              { name: 'sleeve_length', label: 'Sleeve Length', unit: 'inches', required: true },
              { name: 'blouse_length', label: 'Blouse Length', unit: 'inches', required: true },
              { name: 'neck', label: 'Neck', unit: 'inches', required: false }
            ]
          },
          {
            name: 'Women\'s Skirt',
            fields: [
              { name: 'waist', label: 'Waist', unit: 'inches', required: true },
              { name: 'hip', label: 'Hip', unit: 'inches', required: true },
              { name: 'skirt_length', label: 'Skirt Length', unit: 'inches', required: true },
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
