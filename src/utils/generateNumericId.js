import { db } from '../db';

// Function to get the last order ID and increment it
export const generateNumericId = async () => {
  try {
    // Get all orders and find the highest numeric ID from sequence_id
    const allOrders = await db.orders.toArray();
    console.log('All orders for ID generation:', allOrders);
    
    let maxId = 0;
    
    // Find the highest numeric ID from sequence_id
    allOrders.forEach(order => {
      console.log('Processing order for ID generation:', order);
      // Use sequence_id as the source of truth for sequential IDs.
      // This avoids confusion with UUIDs in the main id field.
      if (order.sequence_id) {
        const sequenceId = parseInt(order.sequence_id, 10);
        if (!isNaN(sequenceId)) {
          console.log(`Found sequence_id: ${sequenceId}`);
          if (sequenceId > maxId) {
            maxId = sequenceId;
            console.log(`New maxId from sequence_id: ${maxId}`);
          }
        }
      }
    });
    
    console.log(`Final maxId: ${maxId}`);
    // Return the next sequential number as a string
    const newId = maxId + 1;
    console.log(`Generated new ID: ${newId}`);
    return newId.toString();
  } catch (error) {
    console.error('Error generating numeric ID:', error);
    // Fallback to a timestamp-based random number to avoid collisions
    const fallbackId = Date.now().toString();
    console.log(`Error! Using fallback ID: ${fallbackId}`);
    return fallbackId;
  }
};
