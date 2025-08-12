import { db, addRecord, updateRecord, deleteRecord } from '../db';
import supabase from '../supabaseClient';

// Standard template name used throughout the application
const UNIVERSAL_TEMPLATE_NAME = 'Universal Measurements';

export const measurementService = {
  // Get measurements for a specific customer (always returns Universal Measurements)
  async getByCustomer(customerId) {
    try {
      // First get local measurements
      let measurements = await db.measurements
        .where('customer_id')
        .equals(customerId)
        .and(record => record.sync_status !== 'deleted')
        .toArray();
      
      // If online, also fetch from Supabase and merge
      if (navigator.onLine) {
        try {
          // Check if measurements table exists in Supabase
          const { error: tableCheckError } = await supabase.from('measurements').select('count').limit(1);
          
          if (!tableCheckError) {
            // Fetch measurements from Supabase for this customer
            const { data: remoteMeasurements, error } = await supabase
              .from('measurements')
              .select('*')
              .eq('customer_id', customerId);
            
            if (!error && remoteMeasurements) {
              // Merge remote measurements into local database
              for (const remoteMeasurement of remoteMeasurements) {
                const existingLocal = await db.measurements.get(remoteMeasurement.id);
                if (!existingLocal) {
                  // Add new measurement from Supabase to local DB
                  await db.measurements.add({ ...remoteMeasurement, sync_status: 'synced' });
                  console.log(`📥 Added measurement ${remoteMeasurement.id} from Supabase to local DB`);
                } else if (existingLocal.sync_status !== 'pending') {
                  // Update local measurement if it's not pending sync (to avoid overwriting unsaved changes)
                  const remoteUpdated = new Date(remoteMeasurement.updated_at || remoteMeasurement.created_at);
                  const localUpdated = new Date(existingLocal.updated_at || existingLocal.created_at);
                  
                  if (remoteUpdated > localUpdated) {
                    await db.measurements.update(remoteMeasurement.id, { 
                      ...remoteMeasurement, 
                      sync_status: 'synced' 
                    });
                    console.log(`🔄 Updated measurement ${remoteMeasurement.id} from Supabase`);
                  }
                }
              }
              
              // Re-fetch local measurements after sync
              measurements = await db.measurements
                .where('customer_id')
                .equals(customerId)
                .and(record => record.sync_status !== 'deleted')
                .toArray();
            } else if (error && !error.message?.includes('relation') && !error.message?.includes('does not exist')) {
              console.warn('Error fetching measurements from Supabase:', error);
            }
          } else {
            console.warn('Measurements table does not exist in Supabase, using local data only');
          }
        } catch (syncError) {
          console.warn('Supabase measurements sync failed, using local data only:', syncError);
        }
      }
      
      // Return measurements with their actual template names (don't force Universal Measurements)
      return measurements;
    } catch (error) {
      console.error('Error fetching customer measurements:', error);
      return [];
    }
  },

  // Get the universal measurement for a customer
  async getUniversalMeasurement(customerId) {
    try {
      // Use getByCustomer to get synced measurements
      const measurements = await this.getByCustomer(customerId);
      
      if (measurements.length === 0) {
        return null;
      }
      
      // Return the first (unified) measurement
      return measurements[0];
    } catch (error) {
      console.error('Error fetching universal measurement:', error);
      return null;
    }
  },

  // Add or update measurement for a customer
  // Supports both saveForCustomer(customerId, measurementData) and saveForCustomer(customerId, templateName, measurementData)
  async saveForCustomer(customerId, templateNameOrData, measurementData = null) {
    try {
      // Handle both API signatures for backward compatibility
      let actualTemplateName, actualMeasurementData;
      
      if (measurementData === null) {
        // Called as saveForCustomer(customerId, measurementData)
        actualTemplateName = UNIVERSAL_TEMPLATE_NAME;
        actualMeasurementData = templateNameOrData;
      } else {
        // Called as saveForCustomer(customerId, templateName, measurementData)
        actualTemplateName = templateNameOrData || UNIVERSAL_TEMPLATE_NAME;
        actualMeasurementData = measurementData;
      }
      
      // Validate that measurement data is an object, not a string
      if (typeof actualMeasurementData === 'string') {
        console.error('❌ Measurement data cannot be a string:', actualMeasurementData);
        throw new Error('Measurement data must be an object, not a string');
      }
      
      if (!actualMeasurementData || typeof actualMeasurementData !== 'object') {
        console.error('❌ Invalid measurement data:', actualMeasurementData);
        throw new Error('Measurement data must be a valid object');
      }
      
      // Use the actual template name (don't force Universal Measurements)
      const standardTemplateName = actualTemplateName;
      
      // Get existing measurement with the same template name
      const existingMeasurements = await db.measurements
        .where('customer_id')
        .equals(customerId)
        .and(record => record.sync_status !== 'deleted' && record.template_name === standardTemplateName)
        .toArray();
      
      if (existingMeasurements.length > 0) {
        // Update the existing measurement with the same template name
        const existingMeasurement = existingMeasurements[0];
        const mergedData = { ...existingMeasurement.data };
        
        // Validate existing data before merging
        if (existingMeasurement.data && typeof existingMeasurement.data === 'object') {
          Object.assign(mergedData, existingMeasurement.data);
        }
        
        // Add new measurement data, including custom fields
        Object.assign(mergedData, actualMeasurementData);
        
        // Update the measurement
        const updatedMeasurement = await updateRecord('measurements', existingMeasurement.id, {
          template_name: standardTemplateName,
          data: mergedData,
          updated_at: new Date().toISOString()
        });
        
        console.log(`✅ Updated ${standardTemplateName} measurement for customer ${customerId}:`, mergedData);
        return updatedMeasurement;
      } else {
        // Create new measurement with the specified template name
        const newMeasurement = await addRecord('measurements', {
          customer_id: customerId,
          template_name: standardTemplateName,
          data: actualMeasurementData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        
        console.log(`✅ Created new ${standardTemplateName} measurement for customer ${customerId}:`, actualMeasurementData);
        return newMeasurement;
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
