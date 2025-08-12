/**
 * Utility function to format customer name with their post/designation
 * @param {Object} customer - Customer object
 * @param {string} customer.name - Customer name
 * @param {string} customer.post - Customer post/designation (optional)
 * @returns {string} Formatted name with post in brackets if available
 */
export const formatCustomerName = (customer) => {
  if (!customer) return 'Unknown Customer';
  
  const name = customer.name || 'Unknown Customer';
  const post = customer.post;
  
  // If post exists and is not empty, add it in brackets
  if (post && post.trim()) {
    return `${name} (${post.trim()})`;
  }
  
  return name;
};

/**
 * Utility function to format customer name from individual parameters
 * @param {string} name - Customer name
 * @param {string} post - Customer post/designation (optional)
 * @returns {string} Formatted name with post in brackets if available
 */
export const formatCustomerNameFromParams = (name, post) => {
  const customerName = name || 'Unknown Customer';
  
  // If post exists and is not empty, add it in brackets
  if (post && post.trim()) {
    return `${customerName} (${post.trim()})`;
  }
  
  return customerName;
};
