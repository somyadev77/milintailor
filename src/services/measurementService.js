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
      
      // If we have multiple template types, merge them into Universal Measurements
      if (measurements.length > 1) {
        const mergedData = {};
        let latestDate = null;
        let latestId = null;
        
        // Merge all measurement data from different templates
        measurements.forEach(measurement => {
          if (measurement.data && typeof measurement.data === 'object') {
            Object.assign(mergedData, measurement.data);
          }
          
          // Track the most recent measurement
          const measurementDate = new Date(measurement.updated_at || measurement.created_at);
          if (!latestDate || measurementDate > latestDate) {
            latestDate = measurementDate;
            latestId = measurement.id;
          }
        });
        
        // Return a single unified measurement
        return [{
          id: latestId,
          customer_id: customerId,
          template_name: UNIVERSAL_TEMPLATE_NAME,
          data: mergedData,
          created_at: measurements[0].created_at,
          updated_at: latestDate.toISOString()
        }];
      }
      
      // Ensure the template name is always 'Universal Measurements'
      return measurements.map(measurement => ({
        ...measurement,
        template_name: UNIVERSAL_TEMPLATE_NAME
      }));
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

  // Add or update measurement for a customer (always uses Universal Measurements)
  async saveForCustomer(customerId, templateName = null, measurementData) {
    try {
      // Always use Universal Measurements template name
      const standardTemplateName = UNIVERSAL_TEMPLATE_NAME;
      
      // Get any existing measurement (regardless of template name)
      const existingMeasurements = await db.measurements
        .where('customer_id')
        .equals(customerId)
        .and(record => record.sync_status !== 'deleted')
        .toArray();
      
      if (existingMeasurements.length > 0) {
        // Update the first/primary measurement and merge data from others
        const primaryMeasurement = existingMeasurements[0];
        const mergedData = { ...primaryMeasurement.data };
        
        // Merge data from all existing measurements
        existingMeasurements.forEach(measurement => {
          if (measurement.data && typeof measurement.data === 'object') {
            Object.assign(mergedData, measurement.data);
          }
        });
        
        // Add new measurement data
        Object.assign(mergedData, measurementData);
        
        // Update the primary measurement
        const updatedMeasurement = await updateRecord('measurements', primaryMeasurement.id, {
          template_name: standardTemplateName,
          data: mergedData,
          updated_at: new Date().toISOString()
        });
        
        // Delete any other measurements (cleanup multiple templates)
        for (let i = 1; i < existingMeasurements.length; i++) {
          await deleteRecord('measurements', existingMeasurements[i].id);
        }
        
        return updatedMeasurement;
      } else {
        // Create new Universal Measurements
        return await addRecord('measurements', {
          customer_id: customerId,
          template_name: standardTemplateName,
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
