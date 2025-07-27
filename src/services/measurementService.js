import { db, addRecord, updateRecord, deleteRecord } from '../db';

export const measurementService = {
  // Get measurements for a specific customer
  async getByCustomer(customerId) {
    try {
      const measurements = await db.measurements
        .where('customer_id')
        .equals(customerId)
        .and(record => record.sync_status !== 'deleted')
        .toArray();
      
      return measurements;
    } catch (error) {
      console.error('Error fetching customer measurements:', error);
      return [];
    }
  },

  // Get measurement by customer and template
  async getByCustomerAndTemplate(customerId, templateName) {
    try {
      const measurement = await db.measurements
        .where('customer_id')
        .equals(customerId)
        .and(record => record.template_name === templateName && record.sync_status !== 'deleted')
        .first();
      
      return measurement;
    } catch (error) {
      console.error('Error fetching customer measurement by template:', error);
      return null;
    }
  },

  // Add or update measurement for a customer
  async saveForCustomer(customerId, templateName, measurementData) {
    try {
      // Check if measurement already exists
      const existingMeasurement = await this.getByCustomerAndTemplate(customerId, templateName);
      
      if (existingMeasurement) {
        // Update existing measurement
        return await updateRecord('measurements', existingMeasurement.id, {
          data: measurementData,
          updated_at: new Date().toISOString()
        });
      } else {
        // Create new measurement
        return await addRecord('measurements', {
          customer_id: customerId,
          template_name: templateName,
          data: measurementData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error saving customer measurement:', error);
      throw error;
    }
  },

  // Delete measurement
  async delete(id) {
    try {
      await deleteRecord('measurements', id);
      return true;
    } catch (error) {
      console.error('Error deleting measurement:', error);
      throw error;
    }
  },

  // Get all measurements for a customer organized by template
  async getCustomerMeasurementsOrganized(customerId) {
    try {
      const measurements = await this.getByCustomer(customerId);
      const organized = {};
      
      measurements.forEach(measurement => {
        organized[measurement.template_name] = measurement.data;
      });
      
      return organized;
    } catch (error) {
      console.error('Error getting organized customer measurements:', error);
      return {};
    }
  }
};
