-- Drop existing tables if they exist (be careful - this will delete all data!)
DROP TABLE IF EXISTS public.order_items CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;

-- Create orders table with proper structure based on the app's requirements
CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    order_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
    delivery_date DATE,
    remind_date DATE,
    total_amount DECIMAL(10,2) DEFAULT 0,
    advance_payment DECIMAL(10,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'In-Progress', 'Completed', 'Delivered', 'Cancelled')),
    is_urgent BOOLEAN DEFAULT false,
    notes TEXT,
    receipt_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create order_items table
CREATE TABLE public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    product_name VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) DEFAULT 0,
    quantity INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_order_date ON public.orders(order_date);
CREATE INDEX idx_orders_delivery_date ON public.orders(delivery_date);
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for orders
CREATE POLICY "Enable read access for all users" ON public.orders
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON public.orders
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON public.orders
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete access for all users" ON public.orders
    FOR DELETE USING (true);

-- Create RLS policies for order_items
CREATE POLICY "Enable read access for all users" ON public.order_items
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON public.order_items
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON public.order_items
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete access for all users" ON public.order_items
    FOR DELETE USING (true);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.order_items
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Grant permissions
GRANT ALL ON public.orders TO anon, authenticated;
GRANT ALL ON public.order_items TO anon, authenticated;

-- Add comments for documentation
COMMENT ON TABLE public.orders IS 'Orders table storing customer order information';
COMMENT ON TABLE public.order_items IS 'Order items table storing individual products within orders';
COMMENT ON COLUMN public.orders.receipt_data IS 'JSON data containing receipt information and order details';
COMMENT ON COLUMN public.orders.status IS 'Order status: Pending, In-Progress, Completed, Delivered, or Cancelled';
