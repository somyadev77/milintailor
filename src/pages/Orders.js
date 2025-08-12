import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars
import { FaSearch, FaEdit, FaTrash, FaReceipt, FaPrint, FaTimes, FaSpinner, FaPlus, FaEye, FaFilePdf } from 'react-icons/fa';
import { orderService } from '../services/orderService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { formatCustomerName } from '../utils/customerNameFormatter';
import MeasurementPreviewModal from '../components/MeasurementPreviewModal';
import MeasurementPdfPreviewModal from '../components/MeasurementPdfPreviewModal';
import { getAllMeasurementFields } from '../config/measurementFields';

// Helper function to extract items from order data
function getOrderItems(order) {
  // Prioritize order.items if available (populated by orderService.getAll from receipt_data)
  if (order.items && order.items.length > 0) {
    return order.items;
  }

  // Fallback to parsing receipt_data if order.items is empty or not available
  if (order.receipt_data) {
    try {
      const receiptData = typeof order.receipt_data === 'string'
        ? JSON.parse(order.receipt_data)
        : order.receipt_data;

      if (receiptData && receiptData.items && Array.isArray(receiptData.items)) {
        return receiptData.items;
      }

      // This case (Array.isArray(receiptData)) seems like a legacy format,
      // but keeping it for robustness if it's still in use.
      if (Array.isArray(receiptData)) {
        return receiptData;
      }
    } catch (error) {
      console.error('Error parsing receipt_data:', error);
    }
  }
  
  // Fallback to order.items if available
  if (order.items && order.items.length > 0) {
    return order.items;
  }
  
  // Return empty array if no items are found
  return [];
}

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
      
      console.log('🔄 Fetching fresh data from Supabase...');
      const ordersData = await orderService.getAll();
      setOrders(ordersData);
      console.log('✅ Data synchronized from Supabase!');
    } catch (err) {
      console.error('Error loading orders:', err);
      setError('Failed to load orders. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    
    // Listen for app sync completion to refresh data
    const handleAppSyncComplete = () => {
      console.log('📱 App sync completed - refreshing orders data...');
      loadOrders();
    };
    
    window.addEventListener('appSyncComplete', handleAppSyncComplete);
    
    return () => {
      window.removeEventListener('appSyncComplete', handleAppSyncComplete);
    };
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
  const [isMeasurementPreviewOpen, setIsMeasurementPreviewOpen] = useState(false);
  const [orderToMeasure, setOrderToMeasure] = useState(null);
  const [isMeasurementPdfPreviewOpen, setIsMeasurementPdfPreviewOpen] = useState(false);
  const [measurementPdfData, setMeasurementPdfData] = useState(null);

  const handlePrintPreview = (order) => {
    setOrderToPrint(order);
    setIsPrintPreviewOpen(true);
  };

  const handleViewReceipt = (order) => {
    setOrderToPrint(order);
    setIsPrintPreviewOpen(true);
  };

  const handleMeasurementPreview = (order) => {
    setOrderToMeasure(order);
    setIsMeasurementPreviewOpen(true);
  };

  const handleMeasurementPdfPreview = async (order) => {
    try {
      const pdfData = await generateMeasurementPdfData(order);
      if (pdfData) {
        setMeasurementPdfData(pdfData);
        setIsMeasurementPdfPreviewOpen(true);
      }
    } catch (error) {
      console.error('Error generating measurement PDF preview:', error);
      alert('Failed to generate measurement PDF preview. Please try again.');
    }
  };

  const generateMeasurementPdfData = async (order) => {
    try {
      // Get measurement data from receipt_data or customer_measurements
      let measurements = null;
      
      // First try to get from receipt_data (new format)
      if (order.receipt_data) {
        const receiptData = typeof order.receipt_data === 'string' ? JSON.parse(order.receipt_data) : order.receipt_data;
        if (receiptData.measurements) {
          measurements = receiptData.measurements;
        }
      }
      
      // Fallback to old format
      if (!measurements && order.customer_measurements?.[0]?.data) {
        measurements = { universal: order.customer_measurements[0].data, include_shirt: true, include_pant: true };
      }
      
      if (!measurements) {
        alert('No measurement data found for this customer.');
        return;
      }

      const includeShirt = measurements.include_shirt !== false;
      const includePant = measurements.include_pant !== false;

      // --- Define Measurement Keys ---
      const PANT_KEYS = ['pant_length', 'waist', 'seat', 'thigh_loose', 'knee_loose', 'bottom'];
      const SHIRT_KEYS = ['shirt_length', 'shoulder', 'sleeve', 'sleeve_loose', 'chest', 'shirt_waist', 'collar'];
      const BUTTON_KEYS = ['button_color'];

      // --- Process measurements by category ---
      const processedMeasurements = {
        shirt: [],
        pant: [],
        button: [],
        custom: []
      };

      // Function to process measurement value
      const formatMeasurementValue = (value) => {
        if (value === null || value === undefined || value === '') return null;
        if (typeof value === 'object') {
          if (!value.value || value.value === '') return null;
          return `${value.value} ${value.unit || ''}`.trim();
        }
        return String(value);
      };

      // Special function for button color (no units)
      const formatButtonColor = (value) => {
        if (value === null || value === undefined || value === '') return null;
        if (typeof value === 'object') {
          if (!value.value || value.value === '') return null;
          return String(value.value); // Only return the value, no unit
        }
        return String(value);
      };

      // Function to format key name using bilingual labels from config
      const formatKeyName = (key) => {
        const measurementFields = getAllMeasurementFields();
        const field = measurementFields.find(f => f.name === key);
        if (field && field.label) {
          // Split the bilingual label and return as separate lines
          const parts = field.label.split(' - ');
          if (parts.length === 2) {
            return {
              gujarati: parts[0].trim(),
              english: parts[1].trim()
            };
          }
          return {
            gujarati: field.label,
            english: field.label
          };
        }
        // Fallback to formatted key name
        const formatted = key.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
        return {
          gujarati: formatted,
          english: formatted
        };
      };

      // Process shirt measurements
      if (measurements.shirt && includeShirt) {
        Object.entries(measurements.shirt).forEach(([key, value]) => {
          const formattedValue = formatMeasurementValue(value);
          if (formattedValue) {
            processedMeasurements.shirt.push({
              key: formatKeyName(key),
              value: formattedValue
            });
          }
        });
      }

      // Process pant measurements
      if (measurements.pant && includePant) {
        Object.entries(measurements.pant).forEach(([key, value]) => {
          const formattedValue = formatMeasurementValue(value);
          if (formattedValue) {
            processedMeasurements.pant.push({
              key: formatKeyName(key),
              value: formattedValue
            });
          }
        });
      }

      // Process button measurements
      if (measurements.button && includeShirt) {
        Object.entries(measurements.button).forEach(([key, value]) => {
          // Use special formatting for button color (no units)
          const formattedValue = key.toLowerCase().includes('color') ? formatButtonColor(value) : formatMeasurementValue(value);
          if (formattedValue) {
            processedMeasurements.button.push({
              key: formatKeyName(key),
              value: formattedValue
            });
          }
        });
      }

      // Process custom measurements
      if (measurements.custom && Array.isArray(measurements.custom)) {
        measurements.custom.forEach(custom => {
          if (custom.name && custom.value) {
            processedMeasurements.custom.push({
              key: custom.name,
              value: `${custom.value} ${custom.unit || ''}`.trim()
            });
          }
        });
      }

      // Handle legacy universal measurements
      if (measurements.universal) {
        Object.entries(measurements.universal)
          .filter(([key, _]) => isNaN(parseInt(key, 10))) // Ignore numeric keys
          .forEach(([key, value]) => {
            const formattedValue = formatMeasurementValue(value);
            if (formattedValue) {
              const measurement = {
                key: formatKeyName(key),
                value: formattedValue
              };
              
              if (SHIRT_KEYS.includes(key) && includeShirt) {
                processedMeasurements.shirt.push(measurement);
              } else if (PANT_KEYS.includes(key) && includePant) {
                processedMeasurements.pant.push(measurement);
              } else if (BUTTON_KEYS.includes(key) && includeShirt) {
                // Use special formatting for button measurements
                const buttonMeasurement = {
                  key: formatKeyName(key),
                  value: key.toLowerCase().includes('color') ? formatButtonColor(value) : formattedValue
                };
                processedMeasurements.button.push(buttonMeasurement);
              } else {
                processedMeasurements.custom.push(measurement);
              }
            }
          });
      }

      // Add button measurements to shirt measurements
      if (includeShirt) {
        processedMeasurements.shirt.push(...processedMeasurements.button);
      }

      // Distribute custom measurements to the strip with fewer measurements
      const shirtCount = processedMeasurements.shirt.length;
      const pantCount = processedMeasurements.pant.length;
      
      if (processedMeasurements.custom.length > 0) {
        if (includeShirt && !includePant) {
            processedMeasurements.shirt.push(...processedMeasurements.custom);
        } else if (!includeShirt && includePant) {
            processedMeasurements.pant.push(...processedMeasurements.custom);
        } else { // both included or neither (though caught earlier)
            if (shirtCount <= pantCount) {
                processedMeasurements.shirt.push(...processedMeasurements.custom);
            } else {
                processedMeasurements.pant.push(...processedMeasurements.custom);
            }
        }
      }

      // Check if we have any measurements to print
      const totalMeasurements = processedMeasurements.shirt.length + processedMeasurements.pant.length;
      if (totalMeasurements === 0) {
        alert('No valid measurements found to print.');
        return;
      }

      // Generate HTML for two strips
      const generateStripHTML = (title, measurements, stripClass) => {
        if (measurements.length === 0) return '';
        
        const keysHTML = measurements.map(item => {
          if (typeof item.key === 'object') {
            return `<th><div class="gujarati-text">${item.key.gujarati}</div><div class="english-text">${item.key.english}</div></th>`;
          }
          return `<th>${item.key}</th>`;
        }).join('');
        const valuesHTML = measurements.map(item => `<td>${item.value}</td>`).join('');
        
        return `
          <div class="strip-container ${stripClass}">
            <div class="strip-title">${title}</div>
            <div style="overflow-x: auto;">
              <table class="measurements-table">
                <tbody>
                  <tr>${keysHTML}</tr>
                  <tr>${valuesHTML}</tr>
                </tbody>
              </table>
            </div>
          </div>
        `;
      };

      const shirtStripHTML = includeShirt ? generateStripHTML('Shirt Measurements', processedMeasurements.shirt, 'shirt-strip') : '';
      const pantStripHTML = includePant ? generateStripHTML('Pant Measurements', processedMeasurements.pant, 'pant-strip') : '';

      const slipHTML = `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; font-size: 8pt; margin: 0; padding: 0; }
              .slip-container { 
                min-width: 400px;
                max-width: 500px;
                padding: 6px; 
                border: 1px solid #000; 
                margin: 4px; 
                break-inside: avoid; 
              }
              .header {
                border-bottom: 1px solid #ccc;
                padding-bottom: 2px;
                margin-bottom: 3px;
              }
              .header-line {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 8pt;
                font-weight: bold;
              }
              .shop-name { flex: 1; text-align: center; font-size: 10pt; }
              .customer-info { flex: 1; text-align: left; }
              .order-info { flex: 1; text-align: right; }
              .strip-container {
                margin-bottom: 8px;
                border: 1px solid #ddd;
                border-radius: 3px;
              }
              .shirt-strip {
                background-color: #e3f2fd;
              }
              .pant-strip {
                background-color: #e8f5e8;
              }
              .strip-title { 
                text-align: center; 
                font-weight: bold; 
                font-size: 9pt; 
                margin-bottom: 4px;
                padding: 4px;
                background-color: rgba(0,0,0,0.1);
              }
              .measurements-table { 
                width: 100%; 
                border-collapse: collapse; 
                font-size: 8pt; 
                table-layout: fixed; 
              }
              .measurements-table th, .measurements-table td { 
                border: 1px solid #ccc; 
                padding: 2px 1px; 
                text-align: center; 
                vertical-align: middle;
                word-wrap: break-word;
                overflow-wrap: break-word;
                overflow: hidden;
              }
              .measurements-table th { 
                background-color: #f2f2f2; 
                font-weight: bold;
                line-height: 1.3;
                height: auto;
                min-height: 40px;
                max-width: 120px;
                width: auto;
                padding: 6px 4px;
                vertical-align: top;
                text-align: center;
              }
              .measurements-table td { 
                font-weight: bold;
                font-size: 9pt;
                max-width: 120px;
                width: auto;
                padding: 4px 4px;
                line-height: 1.2;
                text-align: center;
                vertical-align: middle;
              }
              .gujarati-text {
                font-size: 9pt;
                font-weight: bold;
                line-height: 1.2;
                margin-bottom: 3px;
                color: #333;
                white-space: nowrap;
                overflow: visible;
                text-overflow: clip;
                display: block;
                height: auto;
              }
              .english-text {
                font-size: 8pt;
                font-weight: normal;
                line-height: 1.2;
                color: #666;
                white-space: nowrap;
                overflow: visible;
                text-overflow: clip;
                display: block;
                height: auto;
              }
            </style>
          </head>
          <body>
            <div class="slip-container">
              <div class="header">
                <div class="header-line">
                  <div class="customer-info">Customer: ${formatCustomerName(order.customer)}</div>
                  <div class="shop-name">MILIN TAILOR</div>
                  <div class="order-info">Order ID: ${order.sequence_id || order.id || 'N/A'}</div>
                </div>
              </div>
              ${shirtStripHTML}
              ${pantStripHTML}
            </div>
          </body>
        </html>
      `;

      // --- Generate PDF ---
      const element = document.createElement('div');
      element.style.position = 'absolute';
      element.style.left = '-9999px';
      element.style.width = '820px'; // Match max-width
      element.innerHTML = slipHTML;
      document.body.appendChild(element);

      const slipContainer = element.querySelector('.slip-container');
      const canvas = await html2canvas(slipContainer, { scale: 2 });
      
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvas.width + 20, canvas.height + 20]
      });

      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 10, 10, canvas.width, canvas.height);

      document.body.removeChild(element);
      
      return {
        pdf,
        slipHTML,
        customerName: formatCustomerName(order.customer),
        orderId: order.sequence_id || (order.id ? order.id.substring(0, 8) : 'N_A')
      };
      
    } catch (error) {
      console.error('Error generating measurement PDF:', error);
      alert('Failed to generate measurement PDF. Please try again.');
      return null;
    }
  };

  const handlePrintMeasurement = async (order) => {
    try {
      const pdfData = await generateMeasurementPdfData(order);
      if (pdfData) {
        const { pdf, customerName, orderId } = pdfData;
        pdf.save(`${customerName.replace(/[^a-zA-Z0-9]/g, '_')}_${orderId}_measurements.pdf`);
      }
    } catch (error) {
      console.error('Error downloading measurement PDF:', error);
      alert('Failed to download measurement PDF. Please try again.');
    }
  };

const handlePrintReceipt = async (order) => {
    // Debug: Log order data to console
    console.log('🖨️ Printing receipt for order:', order);
    console.log('📦 Order items:', order.items);
    console.log('📄 Receipt data:', order.receipt_data);
    
    // Get items using the helper function
    const orderItems = getOrderItems(order);
    console.log('✅ Final order items:', orderItems);
    
    // Create a styled receipt element for printing
    const receiptHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt - ${formatCustomerName(order.customer)}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: 'Roboto', Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #fff;
          }
          .receipt-container {
            border: 5px double #800000;
            padding: 25px;
            background: #fff;
            max-width: 800px;
            margin: 0 auto;
          }
          .header {
            border-bottom: 2px solid #800000;
            padding-bottom: 15px;
            margin-bottom: 20px;
            display: table;
            width: 100%;
          }
          .header-logo, .header-details, .header-contact {
            display: table-cell;
            vertical-align: top;
          }
          .header-logo { width: 15%; }
          .header-logo img {
            height: 70px;
            border: 1px solid #ccc;
            border-radius: 4px;
          }
          .header-details {
            width: 65%;
            text-align: center;
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
            font-style: italic;
            font-weight: bold;
          }
          .header-details .address {
            margin: 5px 0 0 0;
            font-size: 0.9em;
            line-height: 1.4;
            padding-bottom: 8px;
          }
          .header-contact {
            width: 20%;
            text-align: right;
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
            text-align: center;
          }
          .customer-info {
            font-size: 1.1em;
            width: 100%;
            border-collapse: collapse;
          }
          .customer-info td {
            width: 50%;
            padding: 8px 0;
          }
          .customer-info .detail-value {
            border-bottom: 1px dotted #000;
            padding-left: 10px;
            padding-bottom: 6px;
            display: inline-block;
            min-width: 200px;
          }
          .items-table {
            margin-top: 20px;
            border: 1px solid #800000;
            border-collapse: collapse;
            width: 100%;
          }
          .items-table th, .items-table td {
            border: 1px solid #800000;
            padding: 10px;
            vertical-align: top;
          }
          .items-table th {
            background: #f2f2f2;
          }
          .items-table tfoot td {
            background: #f2f2f2;
            font-weight: bold;
          }
          .footer {
            margin-top: 20px;
            display: table;
            width: 100%;
          }
          .footer-notes, .footer-signature {
            display: table-cell;
            vertical-align: top;
          }
          .footer-notes {
            width: 65%;
          }
          .footer-notes .sign-line {
            border-bottom: 1px dotted #000;
            width: 200px;
            display: inline-block;
            height: 25px;
          }
          .footer-notes ul {
            font-size: 0.8em;
            padding-left: 20px;
            margin-top: 10px;
            list-style-type: disc;
          }
          .footer-signature {
            width: 35%;
            text-align: center;
            vertical-align: bottom;
          }
          .footer-signature .proprietor-sign {
            margin-top: 40px;
            border-bottom: 1px dotted #000;
            height: 25px;
          }
          .footer-signature p {
            margin: 0;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .text-left { text-align: left; }
          .font-bold { font-weight: bold; }
          .font-italic { font-style: italic; }
          @media print {
            body { margin: 0; padding: 10px; }
            .receipt-container { border: 3px double #800000; }
          }
        </style>
      </head>
      <body>
        <div class="receipt-container">
          <table class="header">
            <tr>
              <td class="header-logo">
                <img src="/logo.jpg" alt="Milin Tailor Logo">
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

          <table class="customer-info">
            <tr>
              <td><strong>Name:</strong><span class="detail-value">${formatCustomerName(order.customer)}</span></td>
              <td><strong>Bill No.:</strong><span class="detail-value">${order.sequence_id || order.id || 'N/A'}</span></td>
            </tr>
            <tr>
              <td><strong>Delivery Date:</strong><span class="detail-value">${order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('en-IN', {day: '2-digit', month: '2-digit', year: 'numeric'}) : 'N/A'}</span></td>
              <td><strong>Order Date:</strong><span class="detail-value" style="padding-left: 28px;">${order.order_date ? new Date(order.order_date).toLocaleDateString('en-IN', {day: '2-digit', month: '2-digit', year: 'numeric'}) : 'N/A'}</span></td>
            </tr>
          </table>

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
              ${orderItems && orderItems.length > 0 ?
              orderItems.map((item, index) => {
                const quantity = item.item_quantity || item.quantity || 1;
                const rate = item.price || 0;
                const amount = rate;
                return `
                  <tr>
                      <td class="text-center">${index + 1}</td>
                      <td>${item.item_name || item.product_name || item.name || 'N/A'}</td>
                      <td class="text-center">${quantity}</td>
                      <td class="text-right">₹ ${rate.toLocaleString()}</td>
                      <td class="text-right">₹ ${amount.toLocaleString()}</td>
                  </tr>
                `;
              }).join('') :
              `<tr>
                  <td class="text-center">1</td>
                  <td colspan="4" class="text-center">No specific item added</td>
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

          <table class="footer">
            <tr>
              <td class="footer-notes">
                <p class="font-bold">Receiver Sign:</p>
                <div class="sign-line"></div>
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

    const receiptElement = document.createElement('div');
    receiptElement.style.position = 'absolute';
    receiptElement.style.left = '-9999px';
    receiptElement.innerHTML = receiptHTML;
    document.body.appendChild(receiptElement);

    const receiptContent = receiptElement.querySelector('.receipt-container');

    if (receiptContent) {
      try {
        const canvas = await html2canvas(receiptContent, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');

        const pdf = new jsPDF();
        pdf.addImage(imgData, 'PNG', 10, 10, 180, 0);
        const customerName = formatCustomerName(order.customer).replace(/[^a-zA-Z0-9]/g, '_');
        const orderId = order.id ? order.id.substring(0, 8) : 'N_A';
        pdf.save(`${customerName}_${orderId}.pdf`);
      } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Failed to generate PDF. Please check the console for details.');
      }
    } else {
      console.error('Could not find .receipt-container element to print.');
      alert('Failed to generate PDF: receipt content not found.');
    }

    document.body.removeChild(receiptElement);
  };

  const handleDownloadPDF = async (order) => {
    await handlePrintReceipt(order);
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
    const customerName = order.customer?.name || order.customer || '';
    const customerPhone = order.customer?.phone || order.customer_phone || '';
    const matchesSearch = 
      (order.id && order.id.toLowerCase().includes(searchLower)) ||
      (customerName && customerName.toLowerCase().includes(searchLower)) ||
      (customerPhone && customerPhone.includes(searchTerm));
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
    <div className="p-4 sm:p-6">
      <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 text-gray-800">Orders</h1>

      {/* Header with Search, Filter, and Create Button */}
      <div className="flex flex-col space-y-4 mb-6">
        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search by Order ID or Customer Name..."
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          </div>
          <div className="w-full sm:w-48">
            <select
              className="block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
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
        <Link to="/orders/new" className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition duration-200 flex items-center justify-center w-full sm:w-auto sm:self-start">
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
                      <h3 className="text-lg font-bold text-gray-800">{formatCustomerName(order.customer)}</h3>
                      <p className="text-sm text-blue-600 font-medium">Order ID: {order.sequence_id || order.id || 'N/A'}</p>
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
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-2">
                    <button 
                      onClick={() => handleReceiptClick(order)}
                      className="flex items-center justify-center px-2 py-2 bg-green-600 text-white text-xs sm:text-sm rounded hover:bg-green-700 transition-colors"
                    >
                      <FaEye className="mr-1" />View/Edit
                    </button>
                    <button 
                      onClick={() => handleViewReceipt(order)}
                      className="flex items-center justify-center px-2 py-2 bg-red-600 text-white text-xs sm:text-sm rounded hover:bg-red-700 transition-colors"
                    >
                      <FaReceipt className="mr-1" />View Receipt
                    </button>
                    <button 
                      onClick={() => handleMeasurementPdfPreview(order)}
                      className="flex items-center justify-center px-2 py-2 bg-blue-600 text-white text-xs sm:text-sm rounded hover:bg-blue-700 transition-colors"
                    >
                      <FaPrint className="mr-1" />Print Size
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
          onPrint={handleDownloadPDF}
          onOrderUpdate={handleOrderUpdate}
        />
      )}

      {isPrintPreviewOpen && orderToPrint && (
        <PrintPreviewModal 
          order={orderToPrint}
          onClose={() => setIsPrintPreviewOpen(false)}
          onPrint={() => {
            handlePrintReceipt(orderToPrint);
            setIsPrintPreviewOpen(false);
          }}
          onDownloadPDF={handleDownloadPDF}
        />
      )}

      {isMeasurementPreviewOpen && orderToMeasure && (
        <MeasurementPreviewModal 
          order={orderToMeasure}
          onClose={() => setIsMeasurementPreviewOpen(false)}
          onPrint={() => {
            handlePrintMeasurement(orderToMeasure);
            setIsMeasurementPreviewOpen(false);
          }}
        />
      )}

      {isMeasurementPdfPreviewOpen && measurementPdfData && (
        <MeasurementPdfPreviewModal 
          pdfData={measurementPdfData}
          onClose={() => {
            setIsMeasurementPdfPreviewOpen(false);
            setMeasurementPdfData(null);
          }}
          onDownload={() => {
            const { pdf, customerName, orderId } = measurementPdfData;
            pdf.save(`${customerName.replace(/[^a-zA-Z0-9]/g, '_')}_${orderId}_measurements.pdf`);
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
    customer_name: order.customer?.name || order.customer || '',
    customer_phone: order.customer?.phone || order.customer_phone || '',
    customer_email: order.customer?.email || order.customer_email || '',
    customer_address: order.customer?.address || order.customer_address || '',
receipt_data: typeof order.receipt_data === 'string' ? JSON.parse(order.receipt_data) : order.receipt_data || [],
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
      items: [...prev.items, { item_name: '', item_quantity: 1, price: 0 }]
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
        {/* Header - Mobile Responsive */}
        <div className="flex flex-col space-y-4 p-4 sm:p-6 border-b print-hide">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4">
              <h2 className="text-lg sm:text-2xl font-bold text-gray-800">Order Details</h2>
              <span className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${
                currentOrder.status === 'Completed' ? 'bg-green-200 text-green-800' :
                currentOrder.status === 'In-Progress' ? 'bg-yellow-200 text-yellow-800' :
                'bg-red-200 text-red-800'
              }`}>
                {currentOrder.status || 'Pending'}
              </span>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-800 p-2">
              <FaTimes size={20} />
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
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
                    setEditedOrder({ ...order, customer_name: order.customer?.name || order.customer || '' });
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
          </div>
        </div>

        {/* Main Content */}
        <div className="p-6">
          <div className={`grid ${isEditing ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'} gap-8`}>
            
            {/* Customer Information - Mobile & PC Responsive */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 sm:p-6 rounded-xl shadow-sm border border-blue-100">
              <div className="flex items-center mb-4 sm:mb-6">
                <div className="bg-blue-500 p-2 rounded-lg mr-3">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-800">Customer Information</h3>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Customer Name</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedOrder.customer_name}
                      onChange={(e) => handleInputChange('customer_name', e.target.value)}
                      className="w-full p-3 sm:p-4 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base font-medium bg-white shadow-sm hover:shadow-md"
                      placeholder="Enter customer name"
                    />
                  ) : (
                    <div className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200 shadow-sm">
                      <p className="text-gray-900 font-semibold text-sm sm:text-base">{formatCustomerName(currentOrder.customer)}</p>
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number</label>
                  {isEditing ? (
                    <input
                      type="tel"
                      value={editedOrder.customer_phone}
                      onChange={(e) => handleInputChange('customer_phone', e.target.value)}
                      className="w-full p-3 sm:p-4 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base font-medium bg-white shadow-sm hover:shadow-md"
                      placeholder="Enter phone number"
                    />
                  ) : (
                    <div className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200 shadow-sm">
                      <p className="text-gray-900 font-medium text-sm sm:text-base break-all">{currentOrder.customer?.phone || currentOrder.customer_phone || 'N/A'}</p>
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                  {isEditing ? (
                    <input
                      type="email"
                      value={editedOrder.customer_email}
                      onChange={(e) => handleInputChange('customer_email', e.target.value)}
                      className="w-full p-3 sm:p-4 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base font-medium bg-white shadow-sm hover:shadow-md"
                      placeholder="Enter email address"
                    />
                  ) : (
                    <div className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200 shadow-sm">
                      <p className="text-gray-900 font-medium text-sm sm:text-base break-all">{currentOrder.customer?.email || currentOrder.customer_email || 'N/A'}</p>
                    </div>
                  )}
                </div>
                
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Address</label>
                  {isEditing ? (
                    <textarea
                      value={editedOrder.customer_address}
                      onChange={(e) => handleInputChange('customer_address', e.target.value)}
                      rows="4"
                      className="w-full p-3 sm:p-4 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base font-medium bg-white shadow-sm hover:shadow-md resize-none"
                      placeholder="Enter customer address"
                    />
                  ) : (
                    <div className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200 shadow-sm min-h-[100px]">
                      <p className="text-gray-900 font-medium text-sm sm:text-base leading-relaxed">{currentOrder.customer?.address || currentOrder.customer_address || 'N/A'}</p>
                    </div>
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
                  <p className="text-gray-900 font-mono">${currentOrder.sequence_id || currentOrder.id || 'N/A'}</p>
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
                          value={item.item_name || item.product_name || item.name || ''}
                          onChange={(e) => handleItemChange(index, 'item_name', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <p className="text-gray-900">{item.item_name || item.product_name || item.name || 'N/A'}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                      {isEditing ? (
                        <input
                          type="number"
                          min="1"
                          value={item.item_quantity || item.quantity || 1}
                          onChange={(e) => handleItemChange(index, 'item_quantity', parseInt(e.target.value))}
                          className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <p className="text-gray-900">{item.item_quantity || item.quantity || 1}</p>
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

const PrintPreviewModal = ({ order, onClose, onPrint, onDownloadPDF }) => {
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Get items using the helper function
  const orderItems = getOrderItems(order);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header - Mobile Responsive */}
        <div className="flex flex-col space-y-4 p-4 sm:p-6 border-b bg-gray-50">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-2xl font-bold text-gray-800">Print Preview</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-800 p-2">
              <FaTimes size={20} />
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button 
              className="bg-blue-600 text-white font-bold py-2 px-6 rounded hover:bg-blue-700 transition duration-300 ease-in-out flex items-center justify-center"
              onClick={onPrint}
            >
              <FaPrint className="mr-2" /> Print Receipt
            </button>
            <button 
              className="bg-green-600 text-white font-bold py-2 px-6 rounded hover:bg-green-700 transition duration-300 ease-in-out flex items-center justify-center"
              onClick={() => onDownloadPDF(order)}
            >
              <FaFilePdf className="mr-2" /> Download PDF
            </button>
          </div>
        </div>

        {/* Receipt Preview */}
        <div className="p-3 sm:p-6">
          <div className="border-2 sm:border-4 border-double border-red-900 p-3 sm:p-6 bg-white overflow-x-auto" style={{ fontFamily: 'Arial, sans-serif' }}>
            {/* Header */}
            <div className="border-b-2 border-red-900 pb-4 mb-5">
              <div className="flex flex-col sm:flex-row items-center text-center sm:text-left">
                <div className="w-12 h-12 sm:w-16 sm:h-16 mb-2 sm:mb-0 sm:mr-4">
                  <img src="/logo.jpg" alt="Milin Tailor Logo" className="w-full h-full object-contain rounded" />
                </div>
                <div className="flex-1 text-center">
                  <h1 className="text-xl sm:text-3xl font-bold text-red-900" style={{ fontFamily: 'serif' }}>
                    MILIN TAILOR <span className="text-xs sm:text-sm font-normal">Since 1965</span>
                  </h1>
                  <p className="italic font-bold text-sm sm:text-lg mt-1" style={{ fontFamily: 'serif' }}>
                    We Will Make You Sew Happy !
                  </p>
                  <p className="text-xs sm:text-sm mt-2">
                    Shop No. 2, Shiv Sai Complex, Opp. Triveni Resi.,<br/>
                    Near S.R.P. Group No. 1 (East Gate), Navapura, Vadodara.
                  </p>
                </div>
                <div className="text-center sm:text-right mt-2 sm:mt-0">
                  <p className="font-bold text-sm sm:text-base">M. 94263 69847</p>
                  <div className="bg-red-900 text-white px-2 py-1 mt-2 font-bold text-xs sm:text-sm rounded">
                    SUNDAY CLOSED
                  </div>
                </div>
              </div>
            </div>

            {/* Customer Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 mb-5 text-sm sm:text-lg">
              <div className="mb-2">
                <strong>Name:</strong>
                <span className="ml-1 sm:ml-2 px-1 sm:px-2 pb-1 sm:pb-2 inline-block min-w-[120px] sm:min-w-[150px]" style={{borderBottom: '1px dotted black'}}>
                  {formatCustomerName(order.customer)}
                </span>
              </div>
              <div className="mb-2">
                <strong>Bill No.:</strong>
                <span className="ml-1 sm:ml-2 px-1 sm:px-2 pb-1 sm:pb-2 inline-block min-w-[120px] sm:min-w-[150px]" style={{borderBottom: '1px dotted black'}}>
                  {order.sequence_id || order.id || 'N/A'}
                </span>
              </div>
              <div className="mb-2">
                <strong>Delivery Date:</strong>
                <span className="ml-1 sm:ml-2 px-1 sm:px-2 pb-1 sm:pb-2 inline-block min-w-[140px] sm:min-w-[200px]" style={{borderBottom: '1px dotted black'}}>
                  {formatDate(order.delivery_date)}
                </span>
              </div>
              <div className="mb-2">
                <strong>Order Date:</strong>
                <span className="ml-1 sm:ml-2 px-1 sm:px-2 pb-1 sm:pb-2 inline-block min-w-[140px] sm:min-w-[200px]" style={{borderBottom: '1px dotted black'}}>
                  {formatDate(order.order_date)}
                </span>
              </div>
            </div>

            {/* Order Items - Responsive Design */}
            <div className="overflow-x-auto mt-5">
              {/* Mobile Card View (sm and below) */}
              <div className="block sm:hidden space-y-3">
                {orderItems && orderItems.length > 0 ? (
                  orderItems.map((item, index) => {
                    const quantity = item.item_quantity || item.quantity || 1;
                    const rate = item.price || 0;
                    const amount = rate; // Display the entered price directly
                    return (
                      <div key={index} className="border-2 border-red-900 rounded p-3 bg-gray-50">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-sm font-bold text-red-900">#${index + 1}</span>
                          <span className="text-lg font-bold text-red-900">₹ ${amount.toLocaleString()}</span>
                        </div>
                        <div className="text-base font-semibold mb-2">${item.item_name || item.product_name || item.name || 'N/A'}</div>
                        <div className="flex justify-between text-sm">
                          <div>
                            <span className="text-gray-600">Qty: </span>
                            <span className="font-medium">${quantity}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Rate: </span>
                            <span className="font-medium">₹ ${rate.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="border-2 border-red-900 rounded p-4 bg-gray-50 text-center">
                    <span className="text-gray-600">No items specified</span>
                  </div>
                )}
                {/* Mobile Total */}
                <div className="border-2 border-red-900 rounded p-4 bg-red-900 text-white text-center font-bold">
                  <div className="text-sm mb-1">Thanks !!! Visit Again</div>
                  <div className="text-lg">TOTAL: ₹ ${(order.total_amount || 0).toLocaleString()}</div>
                </div>
              </div>

              {/* Desktop Table View (sm and above) */}
              <table className="hidden sm:table w-full border border-red-900">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-red-900 p-2 text-center w-12 text-sm">Nos.</th>
                    <th className="border border-red-900 p-2 text-left text-sm">Details</th>
                    <th className="border border-red-900 p-2 text-center w-16 text-sm">Qty</th>
                    <th className="border border-red-900 p-2 text-right w-24 text-sm">Rate</th>
                    <th className="border border-red-900 p-2 text-right w-24 text-sm">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {orderItems && orderItems.length > 0 ? (
                    orderItems.map((item, index) => {
                      const quantity = item.item_quantity || item.quantity || 1;
                      const rate = item.price || 0;
                      const amount = rate;
                      return (
                        <tr key={index}>
                          <td className="border border-red-900 p-2 text-center">{index + 1}</td>
                          <td className="border border-red-900 p-2">{item.item_name || item.product_name || item.name || 'N/A'}</td>
                          <td className="border border-red-900 p-2 text-center">{quantity}</td>
                          <td className="border border-red-900 p-2 text-right">₹ {rate.toLocaleString()}</td>
                          <td className="border border-red-900 p-2 text-right">₹ {amount.toLocaleString()}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td className="border border-red-900 p-2 text-center">1</td>
                      <td className="border border-red-900 p-2" colSpan="4">No items specified</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100">
                    <td className="border border-red-900 p-2 text-center font-bold" colSpan="4">Thanks !!! Visit Again</td>
                    <td className="border border-red-900 p-2 text-right font-bold">TOTAL: ₹ {(order.total_amount || 0).toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Footer */}
            <div className="flex flex-col sm:flex-row justify-between mt-5 pt-5 border-t-2 border-red-900 text-xs sm:text-sm">
              <div className="mb-4 sm:mb-0">
                <p className="font-bold">Receiver Sign:</p>
                <div className="mt-10 border-b-2 border-dotted border-black w-40"></div>
              </div>
              <ul className="list-disc list-inside text-gray-700 space-y-1">
                <li>No complain will be entertained in any hazardous situations.</li>
                <li>Plz. check fitting of your clothes at the time of Delivery.</li>
                <li>No Complain will be fulfilled after 90 days from Delivery date.</li>
                <li>Subject to Vadodara Jurisdiction only.</li>
              </ul>
              <div className="text-center mt-4 sm:mt-0">
                <p className="mt-10 font-bold">For MILIN TAILOR</p>
                <div className="mt-10 border-b-2 border-dotted border-black w-40"></div>
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
