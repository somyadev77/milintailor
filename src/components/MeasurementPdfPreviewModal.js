import React from 'react';
import { FaTimes, FaFilePdf } from 'react-icons/fa';

const MeasurementPdfPreviewModal = ({ pdfData, onClose, onDownload }) => {
  if (!pdfData) return null;

  const { slipHTML, customerName, orderId } = pdfData;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex flex-col space-y-4 p-4 sm:p-6 border-b bg-gray-50">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-2xl font-bold text-gray-800">Measurement PDF Preview</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-800 p-2">
              <FaTimes size={20} />
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button 
              className="bg-green-600 text-white font-bold py-2 px-6 rounded hover:bg-green-700 transition duration-300 ease-in-out flex items-center justify-center"
              onClick={onDownload}
            >
              <FaFilePdf className="mr-2" /> Download PDF
            </button>
          </div>
        </div>

        {/* Preview Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)] p-2 sm:p-4">
          <div className="border border-gray-300 bg-white overflow-x-auto">
            <div 
              dangerouslySetInnerHTML={{ __html: slipHTML }} 
              className="transform scale-50 sm:scale-75 origin-top w-fit"
              style={{ transformOrigin: 'top left', minWidth: '400px' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeasurementPdfPreviewModal;
