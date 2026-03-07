import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle, Loader } from 'lucide-react';

const OrderSuccess = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [orderStatus, setOrderStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(true);
  const [attempts, setAttempts] = useState(0);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  const API = `${BACKEND_URL}/api`;

  useEffect(() => {
    if (sessionId) {
      pollPaymentStatus();
    } else {
      setLoading(false);
      setChecking(false);
    }
  }, [sessionId]);

  const pollPaymentStatus = async (attemptCount = 0) => {
    const maxAttempts = 5;
    const pollInterval = 2000;

    if (attemptCount >= maxAttempts) {
      setChecking(false);
      setLoading(false);
      return;
    }

    try {
      const response = await axios.get(`${API}/checkout/status/${sessionId}`);
      setOrderStatus(response.data);

      if (response.data.payment_status === 'paid') {
        setChecking(false);
        setLoading(false);
        return;
      } else if (response.data.status === 'expired') {
        setChecking(false);
        setLoading(false);
        return;
      }

      // Continue polling
      setAttempts(attemptCount + 1);
      setTimeout(() => pollPaymentStatus(attemptCount + 1), pollInterval);
    } catch (error) {
      console.error('Error checking payment status:', error);
      setChecking(false);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="loading-status">
        <div className="text-center">
          <Loader className="animate-spin mx-auto mb-4" size={48} />
          <p className="text-xl">Verifying your payment...</p>
        </div>
      </div>
    );
  }

  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-600 mb-6">Invalid order</p>
          <Link to="/" className="bg-black text-white px-8 py-3 font-bold uppercase tracking-wider hover:bg-gray-800">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader className="animate-spin mx-auto mb-4" size={48} />
          <p className="text-xl">Processing payment... (Attempt {attempts + 1}/5)</p>
        </div>
      </div>
    );
  }

  const isSuccess = orderStatus?.payment_status === 'paid';

  return (
    <div className="min-h-screen flex items-center justify-center px-4" data-testid="order-success-page">
      <div className="max-w-2xl w-full text-center">
        {isSuccess ? (
          <>
            <CheckCircle className="mx-auto mb-6 text-green-600" size={80} strokeWidth={1.5} data-testid="success-icon" />
            <h1 className="text-4xl font-bold mb-4">ORDER CONFIRMED!</h1>
            <p className="text-xl text-gray-600 mb-8">
              Thank you for your purchase. Your order has been successfully placed.
            </p>
            <div className="bg-gray-50 p-8 mb-8">
              <p className="text-sm text-gray-600 mb-2">Order ID</p>
              <p className="text-lg font-bold" data-testid="order-id">{orderStatus.order_id}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/account"
                className="bg-black text-white px-8 py-4 font-bold uppercase tracking-wider hover:bg-gray-800"
                data-testid="view-orders-button"
              >
                View My Orders
              </Link>
              <Link
                to="/products"
                className="border-2 border-black text-black px-8 py-4 font-bold uppercase tracking-wider hover:bg-black hover:text-white"
                data-testid="continue-shopping-button"
              >
                Continue Shopping
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="mb-6">
              <div className="inline-block p-4 bg-red-100 rounded-full">
                <div className="text-red-600 text-4xl">✕</div>
              </div>
            </div>
            <h1 className="text-4xl font-bold mb-4">PAYMENT PROCESSING</h1>
            <p className="text-xl text-gray-600 mb-8">
              {orderStatus?.status === 'expired'
                ? 'Your payment session has expired. Please try again.'
                : 'Payment is still being processed. Please check your email for confirmation or view your order history.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/account"
                className="bg-black text-white px-8 py-4 font-bold uppercase tracking-wider hover:bg-gray-800"
              >
                View My Orders
              </Link>
              <Link
                to="/"
                className="border-2 border-black text-black px-8 py-4 font-bold uppercase tracking-wider hover:bg-black hover:text-white"
              >
                Go Home
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default OrderSuccess;