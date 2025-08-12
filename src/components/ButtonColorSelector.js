import React, { useState, useRef, useEffect } from 'react';

const ButtonColorSelector = ({ value, onChange, name, label, options }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const selectedOption = options?.find(opt => opt.value === value);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelect = (option) => {
    // Create a synthetic event to match the expected onChange format
    const syntheticEvent = {
      target: {
        name: name,
        value: option.value
      }
    };
    onChange(syntheticEvent);
    setIsOpen(false);
  };

  return (
    <div className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
      <label className="block text-lg font-semibold text-gray-800 mb-4">
        🎨 {label}
      </label>
      
      <div className="relative" ref={dropdownRef}>
        {/* Custom Dropdown Button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-4 py-3 text-left bg-white border-2 border-gray-300 rounded-lg shadow-sm hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {selectedOption ? (
                <>
                  <div 
                    className="w-6 h-6 rounded-full border-2 shadow-sm flex-shrink-0"
                    style={{ 
                      backgroundColor: selectedOption.colorCode,
                      border: selectedOption.value === 'white' ? '2px solid #D1D5DB' : '2px solid #374151'
                    }}
                  />
                  <span className="font-medium text-gray-900">{selectedOption.label}</span>
                </>
              ) : (
                <span className="text-gray-500">Choose button color...</span>
              )}
            </div>
            <svg 
              className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                isOpen ? 'transform rotate-180' : ''
              }`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {/* Custom Dropdown Menu */}
        {isOpen && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
            {/* Clear selection option */}
            <button
              type="button"
              onClick={() => handleSelect({ value: '', label: '' })}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center space-x-3 border-b border-gray-100"
            >
              <div className="w-6 h-6 rounded-full border-2 border-dashed border-gray-300 flex-shrink-0 flex items-center justify-center">
                <span className="text-xs text-gray-400">✕</span>
              </div>
              <span className="text-gray-500">No color selected</span>
            </button>
            
            {/* Color options */}
            {options?.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option)}
                className={`w-full px-4 py-3 text-left hover:bg-blue-50 flex items-center space-x-3 transition-colors duration-150 ${
                  value === option.value ? 'bg-blue-100 border-l-4 border-blue-500' : ''
                }`}
              >
                <div 
                  className="w-6 h-6 rounded-full border-2 shadow-sm flex-shrink-0"
                  style={{ 
                    backgroundColor: option.colorCode,
                    border: option.value === 'white' ? '2px solid #D1D5DB' : '2px solid #374151'
                  }}
                />
                <div className="flex-1">
                  <span className="font-medium text-gray-900">{option.label}</span>
                  <div className="text-xs text-gray-500 font-mono">{option.colorCode}</div>
                </div>
                {value === option.value && (
                  <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      
      {/* Selected color display */}
      {selectedOption && value && (
        <div className="mt-4 p-3 bg-white rounded-lg border border-gray-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-sm font-medium text-gray-600">Selected Color:</span>
            <div className="flex items-center space-x-2">
              <div 
                className="w-6 h-6 rounded-full border-2 shadow-sm"
                style={{ 
                  backgroundColor: selectedOption.colorCode,
                  border: selectedOption.value === 'white' ? '2px solid #D1D5DB' : '2px solid #374151'
                }}
              />
              <span className="font-semibold text-gray-800 text-lg">{selectedOption.label}</span>
            </div>
          </div>
          <div className="text-xs text-gray-500 font-mono">
            {selectedOption.colorCode}
          </div>
        </div>
      )}
    </div>
  );
};

export default ButtonColorSelector;
