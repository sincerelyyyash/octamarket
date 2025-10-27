import { MyOrders } from '@/components/orders/MyOrders';
import { OrderForm } from '@/components/orders/OrderForm';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function OrdersPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">📋 My Orders</h1>
          <p className="text-gray-400 text-lg">
            View and manage your order history
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <MyOrders />
          </div>
          
          <div className="lg:col-span-1">
            <div className="sticky top-4">
              <OrderForm />
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}


