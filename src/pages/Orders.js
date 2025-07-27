import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars
import { FaSearch, FaEdit, FaTrash, FaReceipt, FaPrint, FaTimes, FaSpinner, FaPlus, FaEye } from 'react-icons/fa';
import { orderService } from '../services/orderService';

const Orders = () => {
  const { id: orderId } = useParams(); // Get order ID from URL if present
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load orders from database
  const loadOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const ordersData = await orderService.getAll();
      setOrders(ordersData);
    } catch (err) {
      console.error('Error loading orders:', err);
      setError('Failed to load orders. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  // Auto-open order details if order ID is provided in URL
  useEffect(() => {
    if (orderId && orders.length > 0) {
      const order = orders.find(o => o.id === orderId);
      if (order) {
        setSelectedOrder(order);
        setIsReceiptModalOpen(true);
      }
    }
  }, [orderId, orders]);

  const handleReceiptClick = (order) => {
    setSelectedOrder(order);
    setIsReceiptModalOpen(true);
  };

  const handleOrderUpdate = (updatedOrder) => {
    // Update the order in the local state
    setOrders(prevOrders => 
      prevOrders.map(order => 
        order.id === updatedOrder.id ? updatedOrder : order
      )
    );
    // Update the selected order as well
    setSelectedOrder(updatedOrder);
  };

  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
  const [orderToPrint, setOrderToPrint] = useState(null);

  const handlePrintPreview = (order) => {
    setOrderToPrint(order);
    setIsPrintPreviewOpen(true);
  };

  const handlePrint = (order) => {
    // Create a new window with the receipt format
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    
    const formatDate = (dateString) => {
      if (!dateString) return 'N/A';
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    };

    const receiptHTML = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Receipt - Order #${order.id || 'N/A'}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&family=Tinos:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
          <style>
              body {
                  font-family: 'Roboto', Arial, sans-serif;
                  margin: 0;
                  padding: 0;
                  background-color: #f0f2f5;
              }
              .receipt-container {
                  border: 5px double #800000;
                  padding: 25px;
                  max-width: 800px;
                  margin: 20px auto;
                  background: #fff;
                  box-shadow: 0 10px 25px rgba(0,0,0,0.1);
              }
              @media print {
                  @page {
                      size: auto;
                      margin: 0mm;
                  }
                  body {
                      margin: 0;
                      padding: 0;
                      background-color: #fff;
                  }
                  .receipt-container {
                      margin: 0;
                      border: 5px double #800000 !important;
                      max-width: 100%;
                      box-shadow: none;
                  }
              }
              h1, h2, h3, p, td, th {
                  color: #333;
              }
              table {
                  width: 100%;
                  border-collapse: collapse;
              }
              .text-center { text-align: center; }
              .text-right { text-align: right; }
              .text-left { text-align: left; }
              .font-bold { font-weight: bold; }
              .font-italic { font-style: italic; }
              .header {
                  border-bottom: 2px solid #800000;
                  padding-bottom: 15px;
                  margin-bottom: 20px;
              }
              .header-logo {
                  width: 15%;
                  vertical-align: top;
              }
              .header-logo img {
                  height: 70px;
                  border: 1px solid #ccc;
                  border-radius: 4px;
              }
              .header-details {
                  width: 65%;
                  vertical-align: middle;
              }
              .header-details h1 {
                  color: #800000;
                  margin: 0;
                  font-family: 'Tinos', serif;
                  font-size: 2.4em;
              }
              .header-details .since {
                  font-size: 0.5em;
                  font-weight: normal;
                  vertical-align: middle;
              }
              .header-details .slogan {
                  margin: 2px 0;
                  font-size: 1.1em;
                  font-family: 'Tinos', serif;
              }
              .header-details .address {
                  margin: 5px 0 0 0;
                  font-size: 0.9em;
                  line-height: 1.4;
              }
              .header-contact {
                  width: 20%;
                  vertical-align: top;
              }
              .header-contact .phone {
                  font-weight: bold;
                  margin: 0;
              }
              .header-contact .notice {
                  background: #800000;
                  color: #fff;
                  padding: 5px;
                  margin-top: 5px;
                  font-weight: bold;
                  border-radius: 3px;
              }
              .customer-info {
                  font-size: 1.1em;
              }
              .customer-info td {
                  width: 50%;
                  padding: 8px 0;
              }
              .customer-info .detail-value {
                  border-bottom: 1px dotted #000;
                  padding-left: 10px;
              }
              .items-table {
                  margin-top: 20px;
                  border: 1px solid #800000;
              }
              .items-table th {
                  border: 1px solid #800000;
                  padding: 10px;
                  background: #f2f2f2;
              }
              .items-table td {
                  border: 1px solid #800000;
                  padding: 10px;
                  vertical-align: top;
              }
              .items-table .description-cell {
                  height: 200px;
                  line-height: 1.6;
              }
              .items-table tfoot td {
                  background: #f2f2f2;
                  font-weight: bold;
              }
              .footer {
                  margin-top: 20px;
              }
              .footer-notes {
                  width: 65%;
                  vertical-align: top;
              }
              .footer-notes .sign-line {
                  border-bottom: 1px dotted #000;
                  width: 200px;
                  display: inline-block;
              }
              .footer-notes ul {
                  font-size: 0.8em;
                  padding-left: 20px;
                  margin-top: 10px;
                  list-style-type: disc;
              }
              .footer-signature {
                  width: 35%;
                  vertical-align: bottom;
              }
              .footer-signature .proprietor-sign {
                  margin-top: 40px;
                  border-bottom: 1px dotted #000;
              }
              .footer-signature p {
                  margin: 0;
              }
          </style>
      </head>
      <body onload="window.print(); window.close();">
          <div class="receipt-container">
              <!-- Header -->
              <table class="header">
                  <tr>
                      <td class="header-logo">
                          <img src="https://placehold.co/140x140/800000/FFFFFF?text=MT&font=serif" alt="Logo">
                      </td>
                      <td class="header-details text-center">
                          <h1>MILIN TAILOR <span class="since">Since 1965</span></h1>
                          <p class="slogan font-italic font-bold">We Will Make You Sew Happy !</p>
                          <p class="address">Shop No. 2, Shiv Sai Complex, Opp. Triveni Resi.,<br>Near S.R.P. Group No. 1 (East Gate), Navapura, Vadodara.</p>
                      </td>
                      <td class="header-contact text-right">
                          <p class="phone">M. 94263 69847</p>
                          <div class="notice text-center">SUNDAY CLOSED</div>
                      </td>
                  </tr>
              </table>

              <!-- Customer Details -->
              <table class="customer-info">
                  <tr>
                      <td><strong>Name:</strong><span class="detail-value">${order.customer || 'Unknown Customer'}</span></td>
                      <td><strong>Bill No.:</strong><span class="detail-value">${order.id ? order.id.substring(0, 5) : 'N/A'}</span></td>
                  </tr>
                  <tr>
                      <td><strong>Delivery Date:</strong><span class="detail-value">${formatDate(order.delivery_date)}</span></td>
                      <td><strong>Order Date:</strong><span class="detail-value">${formatDate(order.order_date)}</span></td>
                  </tr>
              </table>

              <!-- Order Items Table -->
              <table class="items-table">
                  <thead>
                      <tr>
                          <th class="text-center" style="width: 10%;">Nos.</th>
                          <th class="text-left">Details</th>
                          <th class="text-center" style="width: 10%;">Qty</th>
                          <th class="text-right" style="width: 20%;">Rate</th>
                          <th class="text-right" style="width: 20%;">Amount</th>
                      </tr>
                  </thead>
                  <tbody>
                      ${order.items && order.items.length > 0 ? 
                        order.items.map((item, index) => {
                          const quantity = item.quantity || 1;
                          const rate = item.price || 0;
                          const amount = quantity * rate;
                          return `
                            <tr>
                                <td class="text-center">${index + 1}</td>
                                <td>${item.product_name || item.name || 'N/A'}</td>
                                <td class="text-center">${quantity}</td>
                                <td class="text-right">₹ ${rate.toLocaleString()}</td>
                                <td class="text-right">₹ ${amount.toLocaleString()}</td>
                            </tr>
                          `;
                        }).join('') : 
                        `<tr>
                            <td class="text-center">1</td>
                            <td colspan="4" class="text-center">No items specified</td>
                        </tr>`
                      }
                  </tbody>
                  <tfoot>
                      <tr>
                          <td colspan="4" class="text-center">Thanks !!! Visit Again</td>
                          <td class="text-right">TOTAL: ₹ ${(order.total_amount || 0).toLocaleString()}</td>
                      </tr>
                  </tfoot>
              </table>

              <!-- Footer -->
              <table class="footer">
                  <tr>
                      <td class="footer-notes">
                          <p class="font-bold">Receiver Sign: <span class="sign-line"></span></p>
                          <ul>
                              <li>No complain will be entertained in any hazardous situations.</li>
                              <li>Plz. check fitting of your clothes at the time of Delivery.</li>
                              <li>No Complain will be fulfilled after 90 days from Delivery date.</li>
                              <li>Subject to Vadodara Jurisdiction only.</li>
                          </ul>
                      </td>
                      <td class="footer-signature text-center">
                          <p style="margin-top: 40px;">For MILIN TAILOR</p>
                          <p class="proprietor-sign">&nbsp;</p>
                          <p class="font-bold">Proprietor</p>
                      </td>
                  </tr>
              </table>
          </div>
      </body>
      </html>
    `;
    
    printWindow.document.write(receiptHTML);
    printWindow.document.close();
  };

  // eslint-disable-next-line no-unused-vars
  const handleDeleteOrder = async (orderId) => {
    if (window.confirm('Are you sure you want to delete this order? This action cannot be undone.')) {
      try {
        await orderService.delete(orderId);
        await loadOrders(); // Refresh the orders list
        alert('Order deleted successfully!');
      } catch (err) {
        console.error('Error deleting order:', err);
        alert('Failed to delete order. Please try again.');
      }
    }
  };

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      await orderService.updateStatus(orderId, newStatus);
      // Update the order status in the local state immediately for better UX
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === orderId 
            ? { ...order, status: newStatus }
            : order
        )
      );
      // Show success message
      alert(`Order status updated to ${newStatus} successfully!`);
    } catch (err) {
      console.error('Error updating order status:', err);
      alert('Failed to update order status. Please try again.');
      // Refresh orders to ensure data consistency on error
      await loadOrders();
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const filteredOrders = orders.filter(order => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      (order.id && order.id.toLowerCase().includes(searchLower)) ||
      (order.customer && order.customer.toLowerCase().includes(searchLower)) ||
      (order.customer_phone && order.customer_phone.includes(searchTerm));
    const matchesStatus = filterStatus === 'All' || order.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'Completed':
        return 'bg-green-200 text-green-800';
      case 'In-Progress':
        return 'bg-yellow-200 text-yellow-800';
      case 'Pending':
        return 'bg-red-200 text-red-800';
      default:
        return 'bg-gray-200 text-gray-800';
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Orders</h1>

      {/* Header with Search, Filter, and Create Button */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 space-y-4 md:space-y-0 md:space-x-4">
        <div className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-4 w-full md:w-auto">
          <div className="relative w-full md:w-80">
            <input
              type="text"
              placeholder="Search by Order ID or Customer Name..."
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          </div>
          <div className="w-full md:w-48">
            <select
              className="block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="Completed">Completed</option>
              <option value="In-Progress">In-Progress</option>
              <option value="Pending">Pending</option>
            </select>
          </div>
        </div>
        <Link to="/orders/new" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition duration-200 flex items-center">
          <FaPlus className="mr-2" /> Create New Order
        </Link>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
          <button 
            onClick={loadOrders} 
            className="ml-4 text-red-800 underline hover:text-red-900"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="bg-white p-12 rounded-lg shadow-md text-center">
          <FaSpinner className="animate-spin text-4xl text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading orders...</p>
        </div>
      ) : (
/* Orders Card Grid */
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-800">
              Orders ({filteredOrders.length})
            </h2>
            <button 
              onClick={loadOrders}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              Refresh
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredOrders.length > 0 ? (
              filteredOrders.map((order) => (
                <div key={order.id} className="border border-gray-200 p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-gray-800">{order.customer || 'Unknown Customer'}</h3>
                      <p className="text-sm text-blue-600 font-medium">Order ID: {order.id ? order.id.substring(0, 5) : 'N/A'}</p>
                    </div>
                    <div className="min-w-[120px]">
                      <select
                        value={order.status || 'Pending'}
                        onChange={(e) => handleStatusUpdate(order.id, e.target.value)}
                        className={`w-full px-2 py-1 text-xs font-medium rounded border focus:outline-none focus:ring-2 focus:ring-blue-500 ${getStatusBadgeColor(order.status)} border-transparent`}
                      >
                        <option value="Pending">Pending</option>
                        <option value="In-Progress">In-Progress</option>
                        <option value="Completed">Completed</option>
                        <option value="Delivered">Delivered</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1 mb-4">
                    <p className="text-gray-600 text-sm">Order Date: {formatDate(order.order_date)}</p>
                    <p className="text-gray-800 font-semibold">Total: ₹{(order.total_amount || 0).toLocaleString()}</p>
                  </div>
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => handleReceiptClick(order)}
                      className="flex-1 flex items-center justify-center px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                    >
                      <FaEye className="mr-1" />View/Edit
                    </button>
                    <button 
                      onClick={() => handlePrintPreview(order)}
                      className="flex-1 flex items-center justify-center px-3 py-2 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors"
                    >
                      <FaPrint className="mr-1" />Print Receipt
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full flex flex-col justify-center items-center py-12">
                <p className="text-lg text-gray-500 mb-4">No orders found</p>
                <p className="text-sm text-gray-400 mb-6">
                  {searchTerm || filterStatus !== 'All' 
                    ? 'Try adjusting your search or filter criteria' 
                    : 'Start by creating your first order'}
                </p>
                <Link to="/orders/new" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition duration-200 flex items-center">
                  <FaPlus className="mr-2" /> Create New Order
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pagination (Placeholder) */}
      <div className="flex justify-center mt-6">
        {/* Pagination components will go here */}
      </div>

      {isReceiptModalOpen && selectedOrder && (
        <ReceiptModal 
          order={selectedOrder} 
          onClose={() => setIsReceiptModalOpen(false)}
          onPrint={handlePrint}
          onOrderUpdate={handleOrderUpdate}
        />
      )}

      {isPrintPreviewOpen && orderToPrint && (
        <PrintPreviewModal 
          order={orderToPrint}
          onClose={() => setIsPrintPreviewOpen(false)}
          onPrint={() => {
            handlePrint(orderToPrint);
            setIsPrintPreviewOpen(false);
          }}
        />
      )}
    </div>
  );
};

const ReceiptModal = ({ order, onClose, onPrint, onOrderUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedOrder, setEditedOrder] = useState({
    ...order,
    customer_name: order.customer || '',
    customer_phone: order.customer_phone || '',
    customer_email: order.customer_email || '',
    customer_address: order.customer_address || '',
    items: order.items || [],
    measurements: order.measurements || []
  });
  const [loading, setSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update order using orderService
      await orderService.update(editedOrder.id, editedOrder);
      
      // Call parent update function if provided
      if (onOrderUpdate) {
        onOrderUpdate(editedOrder);
      }
      
      setIsEditing(false);
      alert('Order updated successfully!');
    } catch (error) {
      console.error('Error updating order:', error);
      alert('Failed to update order. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field, value) => {
    setEditedOrder(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...editedOrder.items];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value
    };
    setEditedOrder(prev => ({
      ...prev,
      items: updatedItems
    }));
  };

  const addItem = () => {
    setEditedOrder(prev => ({
      ...prev,
      items: [...prev.items, { product_name: '', quantity: 1, price: 0 }]
    }));
  };

  const removeItem = (index) => {
    setEditedOrder(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const calculateTotal = () => {
    return editedOrder.items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
  };

  const handleDeleteOrder = async () => {
    if (window.confirm('⚠️ Are you sure you want to delete this order?\n\nThis action will permanently remove the order and all its associated data from the database.\n\nThis cannot be undone!')) {
      setIsDeleting(true);
      try {
        await orderService.delete(order.id);
        alert('Order deleted successfully! ✅');
        onClose(); // Close the modal
        // The parent component should handle refreshing the orders list
        window.location.reload(); // Refresh the page to update the orders list
      } catch (error) {
        console.error('Error deleting order:', error);
        alert('❌ Failed to delete order. Please try again.');
        setIsDeleting(false);
      }
    }
  };

  const currentOrder = isEditing ? editedOrder : order;
  const dueAmount = (currentOrder.total_amount || 0) - (currentOrder.advance_payment || 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto print-area">
        {/* Header - Hidden on Print */}
        <div className="flex justify-between items-center p-6 border-b print-hide">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-gray-800">Order Details</h2>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              currentOrder.status === 'Completed' ? 'bg-green-200 text-green-800' :
              currentOrder.status === 'In-Progress' ? 'bg-yellow-200 text-yellow-800' :
              'bg-red-200 text-red-800'
            }`}>
              {currentOrder.status || 'Pending'}
            </span>
          </div>
          <div className="flex gap-3">
            {isEditing ? (
              <>
                <button 
                  onClick={handleSave}
                  disabled={loading}
                  className="bg-green-600 text-white font-bold py-2 px-6 rounded hover:bg-green-700 transition duration-300 ease-in-out flex items-center"
                >
                  {loading ? <FaSpinner className="animate-spin mr-2" /> : <FaEdit className="mr-2" />}
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
                <button 
                  onClick={() => {
                    setIsEditing(false);
                    setEditedOrder({ ...order, customer_name: order.customer || '' });
                  }}
                  className="bg-gray-600 text-white font-bold py-2 px-6 rounded hover:bg-gray-700 transition duration-300 ease-in-out"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button 
                  onClick={() => setIsEditing(true)}
                  className="bg-blue-600 text-white font-bold py-2 px-6 rounded hover:bg-blue-700 transition duration-300 ease-in-out flex items-center"
                >
                  <FaEdit className="mr-2" /> Edit Order
                </button>
                <button 
                  onClick={() => onPrint(currentOrder)}
                  className="bg-gray-600 text-white font-bold py-2 px-6 rounded hover:bg-gray-700 transition duration-300 ease-in-out flex items-center"
                >
                  <FaPrint className="mr-2" /> Print Receipt
                </button>
                <button 
                  onClick={handleDeleteOrder}
                  disabled={isDeleting}
                  className="bg-red-600 text-white font-bold py-2 px-6 rounded hover:bg-red-700 transition duration-300 ease-in-out flex items-center"
                >
                  {isDeleting ? <FaSpinner className="animate-spin mr-2" /> : <FaTrash className="mr-2" />}
                  {isDeleting ? 'Deleting...' : 'Delete Order'}
                </button>
              </>
            )}
            <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
              <FaTimes size={24} />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-6">
          <div className={`grid ${isEditing ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'} gap-8`}>
            
            {/* Customer Information */}
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">Customer Information</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedOrder.customer_name}
                      onChange={(e) => handleInputChange('customer_name', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900 font-medium">{currentOrder.customer || 'Unknown Customer'}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  {isEditing ? (
                    <input
                      type="tel"
                      value={editedOrder.customer_phone}
                      onChange={(e) => handleInputChange('customer_phone', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900">{currentOrder.customer_phone || 'N/A'}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  {isEditing ? (
                    <input
                      type="email"
                      value={editedOrder.customer_email}
                      onChange={(e) => handleInputChange('customer_email', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900">{currentOrder.customer_email || 'N/A'}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  {isEditing ? (
                    <textarea
                      value={editedOrder.customer_address}
                      onChange={(e) => handleInputChange('customer_address', e.target.value)}
                      rows="3"
                      className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900">{currentOrder.customer_address || 'N/A'}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Order Information */}
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">Order Information</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Order ID</label>
                  <p className="text-gray-900 font-mono">{currentOrder.id || 'N/A'}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Order Date</label>
                  {isEditing ? (
                    <input
                      type="date"
                      value={formatDateForInput(editedOrder.order_date)}
                      onChange={(e) => handleInputChange('order_date', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900">{formatDate(currentOrder.order_date)}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Date</label>
                  {isEditing ? (
                    <input
                      type="date"
                      value={formatDateForInput(editedOrder.delivery_date)}
                      onChange={(e) => handleInputChange('delivery_date', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900">{formatDate(currentOrder.delivery_date)}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  {isEditing ? (
                    <select
                      value={editedOrder.status || 'Pending'}
                      onChange={(e) => handleInputChange('status', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Pending">Pending</option>
                      <option value="In-Progress">In-Progress</option>
                      <option value="Completed">Completed</option>
                      <option value="Delivered">Delivered</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  ) : (
                    <p className="text-gray-900">{currentOrder.status || 'Pending'}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Order Items */}
          <div className="mt-8 bg-gray-50 p-6 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-gray-800">Order Items</h3>
              {isEditing && (
                <button
                  onClick={addItem}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors flex items-center"
                >
                  <FaPlus className="mr-2" /> Add Item
                </button>
              )}
            </div>
            
            <div className="space-y-4">
              {(currentOrder.items || []).map((item, index) => (
                <div key={index} className="bg-white p-4 rounded-lg border border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={item.product_name || item.name || ''}
                          onChange={(e) => handleItemChange(index, 'product_name', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <p className="text-gray-900">{item.product_name || item.name || 'N/A'}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                      {isEditing ? (
                        <input
                          type="number"
                          min="1"
                          value={item.quantity || 1}
                          onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value))}
                          className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <p className="text-gray-900">{item.quantity || 1}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹)</label>
                      {isEditing ? (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.price || 0}
                          onChange={(e) => handleItemChange(index, 'price', parseFloat(e.target.value))}
                          className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <p className="text-gray-900">₹{(item.price || 0).toLocaleString()}</p>
                      )}
                    </div>
                    
                    {isEditing && (
                      <div className="flex justify-center">
                        <button
                          onClick={() => removeItem(index)}
                          className="bg-red-600 text-white p-2 rounded hover:bg-red-700 transition-colors"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Total Calculation */}
            <div className="mt-6 bg-white p-4 rounded-lg border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount</label>
                  <p className="text-xl font-bold text-gray-900">₹{(isEditing ? calculateTotal() : currentOrder.total_amount || 0).toLocaleString()}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Advance Paid</label>
                  {isEditing ? (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editedOrder.advance_payment || 0}
                      onChange={(e) => handleInputChange('advance_payment', parseFloat(e.target.value))}
                      className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-lg font-semibold text-gray-900">₹{(currentOrder.advance_payment || 0).toLocaleString()}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount Due</label>
                  <p className="text-xl font-bold text-red-600">₹{dueAmount.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Customer Measurements */}
          {(currentOrder.measurements || currentOrder.customer_measurements) && (currentOrder.measurements || currentOrder.customer_measurements).length > 0 && (
            <div className="mt-8 bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">Customer Measurements</h3>
              <div className="space-y-6">
                {(currentOrder.measurements || currentOrder.customer_measurements || []).map((measurement, index) => (
                  <div key={index} className="bg-white p-4 rounded-lg border border-gray-200">
                    <h4 className="font-semibold text-lg text-gray-800 mb-3">
                      {measurement.template_name || `Measurement Set ${index + 1}`}
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {measurement.data && typeof measurement.data === 'object' && 
                        Object.entries(measurement.data).map(([key, value]) => {
                          let displayValue = 'N/A';
                          
                          if (value !== null && value !== undefined) {
                            if (typeof value === 'object') {
                              const val = value.value || '';
                              const unit = value.unit || '';
                              displayValue = `${val} ${unit}`.trim() || 'N/A';
                            } else {
                              displayValue = String(value);
                            }
                          }
                          
                          return (
                            <div key={key} className="bg-gray-50 p-3 rounded">
                              <span className="block text-sm font-medium text-gray-700 capitalize">
                                {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                              </span>
                              <span className="text-lg font-semibold text-gray-900">
                                {displayValue}
                              </span>
                            </div>
                          );
                        })
                      }
                    </div>
                    {measurement.notes && (
                      <div className="mt-3 p-3 bg-yellow-50 rounded">
                        <span className="font-medium text-gray-700">Notes:</span>
                        <p className="text-gray-600 mt-1">{measurement.notes}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const PrintPreviewModal = ({ order, onClose, onPrint }) => {
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b bg-gray-50">
          <h2 className="text-2xl font-bold text-gray-800">Print Preview</h2>
          <div className="flex gap-3">
            <button 
              onClick={onPrint}
              className="bg-blue-600 text-white font-bold py-2 px-6 rounded hover:bg-blue-700 transition duration-300 ease-in-out flex items-center"
            >
              <FaPrint className="mr-2" /> Print Receipt
            </button>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
              <FaTimes size={24} />
            </button>
          </div>
        </div>

        {/* Receipt Preview */}
        <div className="p-6">
          <div className="border-4 border-double border-red-900 p-6 bg-white" style={{ fontFamily: 'Arial, sans-serif' }}>
            {/* Header */}
            <div className="border-b-2 border-red-900 pb-4 mb-5">
              <div className="flex items-center">
                <div className="w-16 h-16 bg-red-900 text-white flex items-center justify-center text-2xl font-bold mr-4 rounded">
                  MT
                </div>
                <div className="flex-1 text-center">
                  <h1 className="text-3xl font-bold text-red-900" style={{ fontFamily: 'serif' }}>
                    MILIN TAILOR <span className="text-sm font-normal">Since 1965</span>
                  </h1>
                  <p className="italic font-bold text-lg mt-1" style={{ fontFamily: 'serif' }}>
                    We Will Make You Sew Happy !
                  </p>
                  <p className="text-sm mt-2">
                    Shop No. 2, Shiv Sai Complex, Opp. Triveni Resi.,<br/>
                    Near S.R.P. Group No. 1 (East Gate), Navapura, Vadodara.
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold">M. 94263 69847</p>
                  <div className="bg-red-900 text-white px-2 py-1 mt-2 font-bold text-sm rounded">
                    SUNDAY CLOSED
                  </div>
                </div>
              </div>
            </div>

            {/* Customer Details */}
            <div className="grid grid-cols-2 gap-4 mb-5 text-lg">
              <div>
                <strong>Name:</strong>
                <span className="border-b border-dotted border-black ml-2 px-2">
                  {order.customer || 'Unknown Customer'}
                </span>
              </div>
              <div>
                <strong>Bill No.:</strong>
                <span className="border-b border-dotted border-black ml-2 px-2">
                  {order.id ? order.id.substring(0, 5) : 'N/A'}
                </span>
              </div>
              <div>
                <strong>Delivery Date:</strong>
                <span className="border-b border-dotted border-black ml-2 px-2">
                  {formatDate(order.delivery_date)}
                </span>
              </div>
              <div>
                <strong>Order Date:</strong>
                <span className="border-b border-dotted border-black ml-2 px-2">
                  {formatDate(order.order_date)}
                </span>
              </div>
            </div>

            {/* Order Items Table */}
            <table className="w-full border border-red-900 mt-5">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-red-900 p-2 text-center w-12">Nos.</th>
                  <th className="border border-red-900 p-2 text-left">Details</th>
                  <th className="border border-red-900 p-2 text-center w-16">Qty</th>
                  <th className="border border-red-900 p-2 text-right w-24">Rate</th>
                  <th className="border border-red-900 p-2 text-right w-24">Amount</th>
                </tr>
              </thead>
              <tbody>
                {order.items && order.items.length > 0 ? (
                  order.items.map((item, index) => {
                    const quantity = item.quantity || 1;
                    const rate = item.price || 0;
                    const amount = quantity * rate;
                    return (
                      <tr key={index}>
                        <td className="border border-red-900 p-2 text-center">{index + 1}</td>
                        <td className="border border-red-900 p-2">{item.product_name || item.name || 'N/A'}</td>
                        <td className="border border-red-900 p-2 text-center">{quantity}</td>
                        <td className="border border-red-900 p-2 text-right">₹ {rate.toLocaleString()}</td>
                        <td className="border border-red-900 p-2 text-right">₹ {amount.toLocaleString()}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="border border-red-900 p-2 text-center">1</td>
                    <td className="border border-red-900 p-2 text-center" colSpan="4">No items specified</td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-gray-100 font-bold">
                <tr>
                  <td className="border border-red-900 p-2 text-center" colSpan="4">
                    Thanks !!! Visit Again
                  </td>
                  <td className="border border-red-900 p-2 text-right">
                    TOTAL: ₹ {(order.total_amount || 0).toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* Footer */}
            <div className="flex mt-5">
              <div className="flex-1">
                <p className="font-bold mb-2">
                  Receiver Sign: <span className="border-b border-dotted border-black inline-block w-48"></span>
                </p>
                <ul className="text-sm space-y-1 mt-3">
                  <li>• No complain will be entertained in any hazardous situations.</li>
                  <li>• Plz. check fitting of your clothes at the time of Delivery.</li>
                  <li>• No Complain will be fulfilled after 90 days from Delivery date.</li>
                  <li>• Subject to Vadodara Jurisdiction only.</li>
                </ul>
              </div>
              <div className="w-1/3 text-center">
                <p className="mt-10">For MILIN TAILOR</p>
                <div className="border-b border-dotted border-black mt-10 mb-2"></div>
                <p className="font-bold">Proprietor</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


export default Orders;
