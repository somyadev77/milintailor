import React from 'react';

const NewOrder = () => {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Create New Order</h1>
      <form>
        {/* Add form fields here */}
        <button type="submit" className="bg-green-600 text-white py-2 px-4 rounded">Create Order</button>
      </form>
    </div>
  );
};

export default NewOrder;