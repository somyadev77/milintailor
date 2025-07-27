import { db, addRecord, updateRecord, deleteRecord } from '../db';
import supabase from '../supabaseClient';
import { measurementService } from './measurementService';

export const orderService = {
  // Get all orders with customer details
  async getAll() {
    try {
      const localOrders = await db.orders.where('sync_status').notEqual('deleted').toArray();
      
      // Enrich orders with customer details, items, and measurements
      const enrichedOrders = await Promise.all(
        localOrders.map(async (order) => {
          const customer = await db.customers.get(order.customer_id);
          const items = await db.order_items
            .where('order_id')
            .equals(order.id)
            .and(item => item.sync_status !== 'deleted')
            .toArray();
          
          // Fetch customer measurements
          let measurements = [];
          if (customer) {
            try {
measurements = await measurementService.getByCustomer(customer.id);
            } catch (error) {
              console.warn('Error fetching measurements for customer', customer.id, error);
            }
          }
          
          return {
            ...order,
            customer: customer ? customer.name : 'Unknown Customer',
            customer_phone: customer ? customer.phone : '',
            customer_email: customer ? customer.email : '',
            customer_address: customer ? customer.address : '',
            customer_measurements: measurements,
            items: items
          };
        })
      );

      // If online, sync with Supabase (only if tables exist)
      if (navigator.onLine) {
        try {
          // First check if the orders table exists
          const { error: tableCheckError } = await supabase.from('orders').select('count').limit(1);
          
          if (!tableCheckError) {
            // Table exists, try to fetch with joins
            const { data: remoteOrders, error } = await supabase
              .from('orders')
              .select(`
                *,
                customers(name, phone),
                order_items(*)
              `);
              
            if (!error && remoteOrders) {
              // Merge remote data into local database
              for (const order of remoteOrders) {
                const existingOrder = await db.orders.get(order.id);
                if (!existingOrder) {
                  await db.orders.add({ ...order, sync_status: 'synced' });
                  
                  // Add order items
                  if (order.order_items) {
                    for (const item of order.order_items) {
                      await db.order_items.add({ ...item, sync_status: 'synced' });
                    }
                  }
                }
              }
            } else if (error) {
              console.warn('Error fetching orders from Supabase, using local data only:', error);
            }
          } else {
            console.warn('Orders table does not exist in Supabase, using local data only');
          }
        } catch (syncError) {
          console.warn('Supabase sync failed, using local data only:', syncError);
        }
      }
      
      return enrichedOrders.sort((a, b) => new Date(b.order_date) - new Date(a.order_date));
    } catch (error) {
      console.error('Error fetching orders:', error);
      return [];
    }
  },

  // Get order by ID with full details
  async getById(id) {
    try {
      const order = await db.orders.get(id);
      if (!order) return null;

      const customer = await db.customers.get(order.customer_id);
      const items = await db.order_items
        .where('order_id')
        .equals(id)
        .and(item => item.sync_status !== 'deleted')
        .toArray();

      return {
        ...order,
        customer: customer,
        items: items
      };
    } catch (error) {
      console.error('Error fetching order:', error);
      return null;
    }
  },

  // Create new order with items
  async create(orderData, items = []) {
    try {
      const now = new Date().toISOString();
      // Create the order
      const order = await addRecord('orders', {
        ...orderData,
        receipt_data: orderData.receipt_data ? JSON.stringify(orderData.receipt_data) : null,
        order_date: orderData.order_date || now,
        created_at: now,
        updated_at: now
      });

      // Create order items
      const createdItems = [];
      for (const item of items) {
        const orderItem = await addRecord('order_items', {
          ...item,
          order_id: order.id,
          created_at: now,
          updated_at: now
        });
        createdItems.push(orderItem);
      }

      return { ...order, items: createdItems };
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  },

  // Update order
  async update(id, orderData, items = null) {
    try {
      const updatedOrder = await updateRecord('orders', id, {
        ...orderData,
        receipt_data: JSON.stringify(orderData.receipt_data || {})
        // Note: updated_at field doesn't exist in Supabase orders table
      });

      // Update items if provided
      if (items !== null) {
        // Remove existing items
        const existingItems = await db.order_items.where('order_id').equals(id).toArray();
        for (const item of existingItems) {
          await deleteRecord('order_items', item.id);
        }

        // Add new items
        const updatedItems = [];
        for (const item of items) {
          const orderItem = await addRecord('order_items', {
            ...item,
            order_id: id,
            created_at: new Date().toISOString()
          });
          updatedItems.push(orderItem);
        }

        return { ...updatedOrder, items: updatedItems };
      }

      return updatedOrder;
    } catch (error) {
      console.error('Error updating order:', error);
      throw error;
    }
  },

  // Delete order
  async delete(id) {
    try {
      // Delete order items first
      const items = await db.order_items.where('order_id').equals(id).toArray();
      for (const item of items) {
        await deleteRecord('order_items', item.id);
      }

      // Delete the order
      await deleteRecord('orders', id);
      return true;
    } catch (error) {
      console.error('Error deleting order:', error);
      throw error;
    }
  },

  // Get orders by status
  async getByStatus(status) {
    try {
      const allOrders = await this.getAll();
      return allOrders.filter(order => order.status === status);
    } catch (error) {
      console.error('Error fetching orders by status:', error);
      return [];
    }
  },

  // Get orders by customer
  async getByCustomer(customerId) {
    try {
      const orders = await db.orders
        .where('customer_id')
        .equals(customerId)
        .and(order => order.sync_status !== 'deleted')
        .toArray();

      // Enrich with items
      const enrichedOrders = await Promise.all(
        orders.map(async (order) => {
          const items = await db.order_items
            .where('order_id')
            .equals(order.id)
            .and(item => item.sync_status !== 'deleted')
            .toArray();
          return { ...order, items };
        })
      );

      return enrichedOrders;
    } catch (error) {
      console.error('Error fetching orders by customer:', error);
      return [];
    }
  },

  // Update order status
  async updateStatus(id, status) {
    try {
      return await updateRecord('orders', id, {
        status
        // Note: updated_at field doesn't exist in Supabase orders table
      });
    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
  },

  // Get dashboard metrics
  async getDashboardMetrics() {
    try {
      const orders = await this.getAll();
      const customers = await db.customers.where('sync_status').notEqual('deleted').toArray();

      const totalOrders = orders.length;
      const totalCustomers = customers.length;
      const pendingOrders = orders.filter(order => order.status === 'Pending').length;
      const totalRevenue = orders
        .filter(order => order.status === 'Completed')
        .reduce((sum, order) => sum + (order.total_amount || 0), 0);

      return {
        totalCustomers,
        totalOrders,
        pendingOrders,
        totalRevenue
      };
    } catch (error) {
      console.error('Error fetching dashboard metrics:', error);
      return {
        totalCustomers: 0,
        totalOrders: 0,
        pendingOrders: 0,
        totalRevenue: 0
      };
    }
  }
};
