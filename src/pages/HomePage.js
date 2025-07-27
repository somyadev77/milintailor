import React from 'react';
import Button from '../components/Button';
import Card from '../components/Card';
import Input from '../components/Input';

const HomePage = () => {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <Card title="Total Customers">
          <p className="text-2xl font-semibold">1,234</p>
        </Card>
        <Card title="Pending Orders">
          <p className="text-2xl font-semibold">56</p>
        </Card>
        <Card title="Revenue This Month">
          <p className="text-2xl font-semibold">$12,345</p>
        </Card>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-4">
          <Button>Add New Order</Button>
          <Button variant="secondary">Manage Customers</Button>
          <Button variant="danger">View Reports</Button>
        </div>
      </div>

      <div className="mt-8 bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Search Orders</h2>
        <Input type="text" placeholder="Search by order ID or customer name" className="w-full" />
      </div>
    </div>
  );
};

export default HomePage;