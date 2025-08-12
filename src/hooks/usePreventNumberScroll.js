import { useEffect } from 'react';

/**
 * Custom hook to prevent mouse wheel scrolling on number input fields
 * This prevents accidental value changes when scrolling over number inputs
 */
export const usePreventNumberScroll = () => {
  useEffect(() => {
    const preventWheelOnNumberInputs = (e) => {
      // Check if the target is a number input
      if (e.target.type === 'number') {
        // Prevent the wheel event only if the input is focused
        if (document.activeElement === e.target) {
          e.preventDefault();
        }
      }
    };

    // Add event listener to the document
    document.addEventListener('wheel', preventWheelOnNumberInputs, { passive: false });

    // Cleanup function to remove event listener
    return () => {
      document.removeEventListener('wheel', preventWheelOnNumberInputs);
    };
  }, []);
};

/**
 * Alternative hook that can be applied to specific refs
 * Usage: const inputRef = usePreventNumberScrollRef();
 */
export const usePreventNumberScrollRef = () => {
  const handleWheel = (e) => {
    if (e.target.type === 'number' && document.activeElement === e.target) {
      e.preventDefault();
    }
  };

  const ref = (element) => {
    if (element) {
      element.addEventListener('wheel', handleWheel, { passive: false });
      
      // Cleanup when element is unmounted
      return () => {
        element.removeEventListener('wheel', handleWheel);
      };
    }
  };

  return ref;
};

/**
 * Helper function to add no-scroll class to number inputs
 * Can be used as className for number inputs
 */
export const getNumberInputProps = (additionalProps = {}) => {
  return {
    className: `no-scroll-input ${additionalProps.className || ''}`,
    onWheel: (e) => {
      if (document.activeElement === e.target) {
        e.preventDefault();
      }
      if (additionalProps.onWheel) {
        additionalProps.onWheel(e);
      }
    },
    ...additionalProps
  };
};
