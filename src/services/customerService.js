import { db, addRecord, updateRecord, deleteRecord } from '../db';
import supabase from '../supabaseClient';

export const customerService = {
  // Get all customers (prioritize local data)
  async getAll() {
    try {
      // First, try to get from local database
      const localCustomers = await db.customers.where('sync_status').notEqual('deleted').toArray();
      
      // If online, sync with Supabase
      if (navigator.onLine) {
        const { data: remoteCustomers, error } = await supabase
          .from('customers')
          .select('*');
          
        if (!error && remoteCustomers) {
          // Merge remote data into local database
          for (const customer of remoteCustomers) {
            const existingCustomer = await db.customers.get(customer.id);
            if (!existingCustomer) {
              await db.customers.add({ ...customer, sync_status: 'synced' });
            }
          }
          
          // Return updated local data
          return await db.customers.where('sync_status').notEqual('deleted').toArray();
        }
      }
      
      return localCustomers;
    } catch (error) {
      console.error('Error fetching customers:', error);
      return [];
    }
  },

  // Get customer by ID
  async getById(id) {
    try {
      return await db.customers.get(id);
    } catch (error) {
      console.error('Error fetching customer:', error);
      return null;
    }
  },

  // Search customers
  async search(query) {
    try {
      const customers = await this.getAll();
      return customers.filter(customer => 
        customer.name.toLowerCase().includes(query.toLowerCase()) ||
        customer.phone.includes(query) ||
        (customer.email && customer.email.toLowerCase().includes(query.toLowerCase()))
      );
    } catch (error) {
      console.error('Error searching customers:', error);
      return [];
    }
  },

  // Add new customer
  async add(customerData) {
    try {
      const customer = await addRecord('customers', {
        ...customerData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      return customer;
    } catch (error) {
      console.error('Error adding customer:', error);
      throw error;
    }
  },

  // Update customer
  async update(id, customerData) {
    try {
      const updatedCustomer = await updateRecord('customers', id, {
        ...customerData,
        updated_at: new Date().toISOString()
      });
      return updatedCustomer;
    } catch (error) {
      console.error('Error updating customer:', error);
      throw error;
    }
  },

  // Delete customer
  async delete(id) {
    try {
      await deleteRecord('customers', id);
      return true;
    } catch (error) {
      console.error('Error deleting customer:', error);
      throw error;
    }
  },

  // Get customers with their measurements
  async getWithMeasurements(id) {
    try {
      const customer = await this.getById(id);
      if (!customer) return null;

      const measurements = await db.measurements
        .where('customer_id')
        .equals(id)
        .and(record => record.sync_status !== 'deleted')
        .toArray();

      return { ...customer, measurements };
    } catch (error) {
      console.error('Error fetching customer with measurements:', error);
      return null;
    }
  }
};
