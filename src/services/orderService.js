import { db, addRecord, updateRecord, deleteRecord } from '../db';
import supabase from '../supabaseClient';
import { measurementService } from './measurementService';

export const orderService = {
  // Get all orders with customer details
  async getAll() {
    try {
      const localOrders = await db.orders.where('sync_status').notEqual('deleted').toArray();
      
      // Log diagnostic info
      console.log(`📦 Found ${localOrders.length} orders in local database`);
      
      // Enrich orders with customer details, items, and measurements
      const enrichedOrders = await Promise.all(
        localOrders.map(async (order) => {
          let customer = null;
          let measurements = [];
          
          // Check if order has customer_id
          if (!order.customer_id) {
            console.warn(`⚠️ Order ${order.id} has no customer_id`);
          } else {
            try {
              customer = await db.customers.get(order.customer_id);
              if (!customer) {
                console.warn(`⚠️ Order ${order.id} references non-existent customer ${order.customer_id}`);
              }
            } catch (error) {
              console.error(`Error fetching customer ${order.customer_id} for order ${order.id}:`, error);
            }
          }
          
          // Get order items
          let items = [];
          try {
            items = await db.order_items
              .where('order_id')
              .equals(order.id)
              .and(item => item.sync_status !== 'deleted')
              .toArray();
          } catch (error) {
            console.error(`Error fetching items for order ${order.id}:`, error);
          }
          
          // Fetch customer measurements if customer exists
          if (customer) {
            try {
              measurements = await measurementService.getByCustomer(customer.id);
            } catch (error) {
              console.warn('Error fetching measurements for customer', customer.id, error);
            }
          }
          
          // Create enriched order object
          const enrichedOrder = {
            ...order,
            customer: customer || {
              id: order.customer_id || 'unknown',
              name: 'Unknown Customer',
              phone: '',
              email: '',
              address: ''
            },
            customer_phone: customer ? customer.phone : '',
            customer_email: customer ? customer.email : '',
            customer_address: customer ? customer.address : '',
            customer_measurements: measurements,
            items: items,
            // Add flags for debugging
            _has_valid_customer: !!customer,
            _items_count: items.length
          };
          
          return enrichedOrder;
        })
      );
      
      console.log(`✅ Successfully enriched ${enrichedOrders.length} orders with customer data`);
      
      // Log summary statistics
      const ordersWithCustomers = enrichedOrders.filter(o => o._has_valid_customer).length;
      const ordersWithItems = enrichedOrders.filter(o => o._items_count > 0).length;
      console.log(`📊 Orders with valid customers: ${ordersWithCustomers}/${enrichedOrders.length}`);
      console.log(`📊 Orders with items: ${ordersWithItems}/${enrichedOrders.length}`);
      
      // Remove debug flags before returning
      const cleanedOrders = enrichedOrders.map(order => {
        const { _has_valid_customer, _items_count, ...cleanOrder } = order;
        return cleanOrder;
      });

      // Store initial local orders for deduplication
      let finalOrders = cleanedOrders;

      // If online, sync with Supabase (only if tables exist)
      if (navigator.onLine) {
        try {
          // First check if the orders table exists
          const { error: tableCheckError } = await supabase.from('orders').select('count').limit(1);
          
          if (!tableCheckError) {
            console.log('📡 Syncing with Supabase...');
            
            // First, sync customers to ensure we have customer data
            const { data: remoteCustomers, error: customersError } = await supabase
              .from('customers')
              .select('*');
            
            if (!customersError && remoteCustomers) {
              console.log(`📥 Found ${remoteCustomers.length} customers in Supabase`);
              for (const customer of remoteCustomers) {
                const existingCustomer = await db.customers.get(customer.id);
                if (!existingCustomer) {
                  await db.customers.add({ ...customer, sync_status: 'synced' });
                  console.log(`✅ Synced customer: ${customer.name}`);
                }
              }
            }
            
            // Fetch orders separately (without joins to avoid foreign key issues)
            const { data: remoteOrders, error } = await supabase
              .from('orders')
              .select('*');
              
            if (!error && remoteOrders) {
              console.log(`📥 Found ${remoteOrders.length} orders in Supabase`);
              
              // Merge remote orders into local database
              for (const order of remoteOrders) {
                const existingOrder = await db.orders.get(order.id);
                if (!existingOrder) {
                  await db.orders.add({ ...order, sync_status: 'synced' });
                  console.log(`✅ Synced order: ${order.id}`);
                }
              }
              
              // Separately fetch order_items
              const { data: remoteOrderItems, error: itemsError } = await supabase
                .from('order_items')
                .select('*');
              
              if (!itemsError && remoteOrderItems) {
                console.log(`📥 Found ${remoteOrderItems.length} order items in Supabase`);
                
                // Merge remote order items into local database
                for (const item of remoteOrderItems) {
                  const existingItem = await db.order_items.get(item.id);
                  if (!existingItem) {
                    await db.order_items.add({ ...item, sync_status: 'synced' });
                    console.log(`✅ Synced order item: ${item.item_name || 'Unnamed Item'}`);
                  }
                }
              } else if (itemsError) {
                console.warn('Error fetching order_items from Supabase:', itemsError);
              }
              
              // After merging, get the updated local orders and deduplicate
              const updatedLocalOrders = await db.orders.where('sync_status').notEqual('deleted').toArray();
              
              // Enrich updated orders with customer details
              const updatedEnrichedOrders = await Promise.all(
                updatedLocalOrders.map(async (order) => {
                  let customer = null;
                  let measurements = [];
                  
                  if (order.customer_id) {
                    try {
                      customer = await db.customers.get(order.customer_id);
                    } catch (error) {
                      console.error(`Error fetching customer ${order.customer_id}:`, error);
                    }
                  }
                  
                  // Get order items
                  let items = [];
                  try {
                    items = await db.order_items
                      .where('order_id')
                      .equals(order.id)
                      .and(item => item.sync_status !== 'deleted')
                      .toArray();
                  } catch (error) {
                    console.error(`Error fetching items for order ${order.id}:`, error);
                  }
                  
                  // Fetch measurements if customer exists
                  if (customer) {
                    try {
                      measurements = await measurementService.getByCustomer(customer.id);
                    } catch (error) {
                      console.warn('Error fetching measurements for customer', customer.id, error);
                    }
                  }
                  
                  return {
                    ...order,
                    customer: customer || {
                      id: order.customer_id || 'unknown',
                      name: 'Unknown Customer',
                      phone: '',
                      email: '',
                      address: ''
                    },
                    customer_phone: customer ? customer.phone : '',
                    customer_email: customer ? customer.email : '',
                    customer_address: customer ? customer.address : '',
                    customer_measurements: measurements,
                    items: items
                  };
                })
              );
              
              // DEDUPLICATION: Use Map to ensure unique orders by ID
              console.log(`🔍 Before deduplication: ${updatedEnrichedOrders.length} orders`);
              const uniqueOrdersMap = new Map();
              updatedEnrichedOrders.forEach(order => {
                // Use order ID as the unique key
                uniqueOrdersMap.set(order.id, order);
              });
              
              // Get deduplicated orders
              finalOrders = Array.from(uniqueOrdersMap.values());
              console.log(`✅ After deduplication: ${finalOrders.length} unique orders`);
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
      
      return finalOrders.sort((a, b) => new Date(b.order_date) - new Date(a.order_date));
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
        customer: customer || null,
        customer_measurements: measurements,
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
      
      // Validate required fields
      if (!orderData.customer_id) {
        throw new Error('Customer ID is required for order creation');
      }
      
      // Ensure proper data types and handle null values
      const sanitizedOrderData = {
        customer_id: orderData.customer_id,
        order_date: orderData.order_date || now,
        delivery_date: orderData.delivery_date || null,
        remind_date: orderData.remind_date || null,
        total_amount: Number(orderData.total_amount) || 0,
        advance_payment: Number(orderData.advance_payment) || 0,
        status: orderData.status || 'Pending',
        is_urgent: Boolean(orderData.is_urgent),
        notes: orderData.notes || null,
        receipt_data: orderData.receipt_data ? JSON.stringify(orderData.receipt_data) : null,
        created_at: now,
        updated_at: now
      };
      
      // Create the order
      const order = await addRecord('orders', sanitizedOrderData);

      // Create order items
      const createdItems = [];
      console.log(`📦 Creating ${items.length} order items for order ${order.id}:`, items);
      for (const item of items) {
        const itemData = {
          ...item,
          order_id: order.id,
          created_at: now,
          updated_at: now
        };
        console.log(`📦 Creating order item:`, itemData);
        const orderItem = await addRecord('order_items', itemData);
        console.log(`✅ Created order item:`, orderItem);
        createdItems.push(orderItem);
      }
      console.log(`✅ Created ${createdItems.length} order items successfully`);
      console.log(`📦 All created order items:`, createdItems);
      
      // Verify items were actually saved by querying the database
      const savedItems = await db.order_items
        .where('order_id')
        .equals(order.id)
        .toArray();
      console.log(`🔍 Verification: Found ${savedItems.length} items in database for order ${order.id}:`, savedItems);

      return { ...order, items: createdItems };
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  },

  // Update order
  async update(id, orderData, items = null) {
    try {
      // Sanitize update data
      const sanitizedUpdateData = {
        ...orderData,
        receipt_data: orderData.receipt_data ? JSON.stringify(orderData.receipt_data) : null,
        updated_at: new Date().toISOString()
      };
      
      // Remove undefined values
      Object.keys(sanitizedUpdateData).forEach(key => {
        if (sanitizedUpdateData[key] === undefined) {
          delete sanitizedUpdateData[key];
        }
      });
      
      const updatedOrder = await updateRecord('orders', id, sanitizedUpdateData);

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
      console.log(`🔍 Getting orders for customer: ${customerId}`);
      
      // First, ensure we have synced data by calling getAll() which handles sync
      await this.getAll();
      
      // Now query the local database for orders by this customer
      const orders = await db.orders
        .where('customer_id')
        .equals(customerId)
        .and(order => order.sync_status !== 'deleted')
        .toArray();
      
      console.log(`📦 Found ${orders.length} orders for customer ${customerId} in local database`);

      // Enrich with items
      const enrichedOrders = await Promise.all(
        orders.map(async (order) => {
          const items = await db.order_items
            .where('order_id')
            .equals(order.id)
            .and(item => item.sync_status !== 'deleted')
            .toArray();
          console.log(`📦 Order ${order.id} has ${items.length} items`);
          return { ...order, items };
        })
      );
      
      console.log(`✅ Returning ${enrichedOrders.length} enriched orders for customer ${customerId}`);
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