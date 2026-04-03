import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Loader, Zap, Crosshair, Cpu, CheckCircle } from 'lucide-react';

const OrderSuccess = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const directOrderId = searchParams.get('order_id');
  const [orderStatus, setOrderStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(true);
  const [attempts, setAttempts] = useState(0);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  const API = `${BACKEND_URL}/api`;

  useEffect(() => {
    if (sessionId) {
      pollPaymentStatus();
    } else if (directOrderId) {
      fetchDirectOrderStatus();
    } else {
      setLoading(false);
      setChecking(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, directOrderId]);

  const fetchDirectOrderStatus = async () => {
    try {
      const response = await axios.get(`${API}/orders/${directOrderId}`);
      setOrderStatus({
        order_id: response.data.id,
        payment_status: response.data.payment_status,
        status: response.data.status,
        total_amount: response.data.total_amount
      });
      setChecking(false);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching direct order status:', error);
      setChecking(false);
      setLoading(false);
    }
  };

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

      if (response.data.payment_status === 'paid' || response.data.payment_status === 'pending_cod') {
        setChecking(false);
        setLoading(false);
        return;
      } else if (response.data.status === 'expired') {
        setChecking(false);
        setLoading(false);
        return;
      }

      setAttempts(attemptCount + 1);
      setTimeout(() => pollPaymentStatus(attemptCount + 1), pollInterval);
    } catch (error) {
      console.error('Error checking payment status:', error);
      setChecking(false);
      setLoading(false);
    }
  };

  if (loading || checking) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center font-mono">
        <div className="text-center space-y-4">
          <div className="relative mx-auto w-24 h-24">
            <div className="absolute inset-0 border-4 border-t-[#ff003c] border-gray-800 rounded-full animate-spin"></div>
            <div className="absolute inset-2 border-4 border-b-[#00f3ff] border-gray-800 rounded-full animate-spin-reverse"></div>
            <Loader className="absolute inset-0 m-auto text-[#ff003c] animate-pulse" size={32} />
          </div>
          <p className="text-[#ff003c] text-xl tracking-[0.2em] animate-pulse">
            {checking ? `ESTABLISHING TELEMETRY... [0${attempts + 1}]` : "IGNITION SEQUENCE START..."}
          </p>
        </div>
      </div>
    );
  }

  if (!sessionId && !directOrderId) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center font-mono p-4">
        <div className="text-center border border-red-500 p-8 shadow-[0_0_30px_rgba(255,0,0,0.2)] bg-black/50 backdrop-blur">
          <Crosshair className="mx-auto mb-4 text-red-500" size={48} />
          <p className="text-xl text-red-500 mb-6 uppercase tracking-widest">Signal Lost - Invalid Order</p>
          <Link to="/" className="inline-block bg-red-600 text-white px-8 py-3 font-bold uppercase tracking-wider hover:bg-red-700 transition-colors">
            Return to Base
          </Link>
        </div>
      </div>
    );
  }

  const isSuccess = orderStatus?.payment_status === 'paid' || orderStatus?.payment_status === 'pending_cod';
  const displayAmount = orderStatus?.total_amount || orderStatus?.amount || '---';

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-300 font-sans p-4 sm:p-8 flex justify-center items-start pt-20 relative overflow-hidden">

      {/* Background Stylings */}
      <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: 'radial-gradient(circle at center, #ff003c 0%, transparent 40%)' }}></div>
      <div className="absolute left-0 top-0 bottom-0 w-24 border-r border-[#ff003c]/20 flex flex-col justify-between py-10 items-center opacity-30 hidden lg:flex">
        <div className="rotate-90 tracking-[0.5em] text-xs font-mono text-[#ff003c]">TELEMETRY</div>
        <div className="h-64 w-px bg-gradient-to-b from-transparent via-[#ff003c] to-transparent animate-pulse"></div>
        <div className="-rotate-90 tracking-[0.5em] text-xs font-mono text-[#ff003c]">STATUS: ON</div>
      </div>

      <div className="max-w-4xl w-full relative z-10">
        {isSuccess ? (
          <div className="bg-[#111] border rounded-sm border-gray-800 shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden relative">

            {/* Top HUD Border Accent */}
            <div className="h-1 w-full bg-gradient-to-r from-transparent via-[#ff003c] to-transparent"></div>

            <div className="p-8 sm:p-12 text-center md:text-left">

              <div className="flex flex-col md:flex-row justify-between items-center md:items-start mb-12 gap-6">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/30 text-green-400 font-mono text-sm tracking-widest uppercase mb-4 rounded-sm animate-pulse">
                    <Zap size={14} /> System Verified
                  </div>
                  <h1 className="text-4xl sm:text-5xl font-black italic uppercase tracking-tight leading-[0.95] text-white drop-shadow-[0_0_15px_rgba(255,0,60,0.3)]">
                    <span className="block">ENGINE IGNITED</span>
                    <span className="mt-3 block text-[#ff003c] sm:mt-4">YOUR ORDER IS LOCKED IN</span>
                  </h1>
                </div>
                <div className="hidden md:block">
                  <Cpu className="text-gray-700 w-24 h-24" strokeWidth={1} />
                </div>
              </div>

              {/* Order Summary Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
                <div className="bg-[#0f0f0f] border border-gray-800 p-5 rounded-sm relative group overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-0.5 bg-gray-700 group-hover:bg-[#ff003c] transition-colors"></div>
                  <p className="text-xs text-gray-500 font-mono uppercase tracking-wider mb-1">Order ID</p>
                  <p className="text-lg text-white font-bold font-mono truncate" title={orderStatus.order_id}>{orderStatus.order_id}</p>
                </div>
                <div className="bg-[#0f0f0f] border border-gray-800 p-5 rounded-sm relative group overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-0.5 bg-gray-700 group-hover:bg-[#ff003c] transition-colors"></div>
                  <p className="text-xs text-gray-500 font-mono uppercase tracking-wider mb-1">Payment</p>
                  <p className={`text-lg font-bold uppercase ${orderStatus.payment_status === 'paid' ? 'text-green-400' : 'text-orange-400'}`}>
                    {orderStatus.payment_status === 'pending_cod' ? 'UNPAID (COD)' : orderStatus.payment_status}
                  </p>
                </div>
                <div className="bg-[#0f0f0f] border border-gray-800 p-5 rounded-sm relative group overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-0.5 bg-gray-700 group-hover:bg-green-500 transition-colors"></div>
                  <p className="text-xs text-gray-500 font-mono uppercase tracking-wider mb-1">Total</p>
                  <p className="text-lg text-green-400 font-bold font-mono">₹{displayAmount}</p>
                </div>
                <div className="bg-[#0f0f0f] border border-gray-800 p-5 rounded-sm relative group overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-0.5 bg-gray-700 group-hover:bg-[#00f3ff] transition-colors"></div>
                  <p className="text-xs text-gray-500 font-mono uppercase tracking-wider mb-1">ETA</p>
                  <p className="text-lg text-[#00f3ff] font-bold uppercase">3-7 Business Days</p>
                </div>
              </div>

              {/* Telemetry Progress Panel */}
              <div className="mb-12">
                <h3 className="text-gray-400 font-mono tracking-widest text-sm uppercase mb-6 flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#ff003c] rounded-full animate-ping"></div> Live Telemetry
                </h3>

                <div className="relative">
                  <div className="absolute left-[15px] top-6 bottom-6 w-0.5 bg-gray-800 md:left-0 md:right-0 md:top-[15px] md:bottom-auto md:h-0.5 md:w-full"></div>

                  <div className="flex flex-col md:flex-row justify-between relative gap-8 md:gap-0">
                    {/* Step 1 */}
                    <div className="flex md:flex-col items-center gap-4 md:gap-3 text-left md:text-center z-10">
                      <div className="w-8 h-8 rounded-full bg-[#ff003c] border-4 border-[#111] shadow-[0_0_15px_rgba(255,0,60,0.5)] flex items-center justify-center">
                        <CheckCircle size={14} className="text-white" />
                      </div>
                      <div>
                        <p className="text-white font-bold text-sm uppercase">Order Locked</p>
                        <p className="text-gray-500 text-xs font-mono">ACTIVE</p>
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div className="flex md:flex-col items-center gap-4 md:gap-3 text-left md:text-center z-10 w-full md:w-auto">
                      <div className="w-8 h-8 rounded-full bg-gray-800 border-4 border-[#111] flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-gray-600"></div>
                      </div>
                      <div>
                        <p className="text-gray-400 font-bold text-sm uppercase">Packing in Garage</p>
                        <p className="text-gray-600 text-xs font-mono">PENDING</p>
                      </div>
                    </div>

                    {/* Step 3 */}
                    <div className="flex md:flex-col items-center gap-4 md:gap-3 text-left md:text-center z-10 w-full md:w-auto">
                      <div className="w-8 h-8 rounded-full bg-gray-800 border-4 border-[#111] flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-gray-600"></div>
                      </div>
                      <div>
                        <p className="text-gray-400 font-bold text-sm uppercase">Ready for Dispatch</p>
                        <p className="text-gray-600 text-xs font-mono">PENDING</p>
                      </div>
                    </div>

                    {/* Step 4 */}
                    <div className="flex md:flex-col items-center gap-4 md:gap-3 text-left md:text-center z-10 w-full md:w-auto">
                      <div className="w-8 h-8 rounded-full bg-gray-800 border-4 border-[#111] flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-gray-600"></div>
                      </div>
                      <div>
                        <p className="text-gray-400 font-bold text-sm uppercase">Delivery Complete</p>
                        <p className="text-gray-600 text-xs font-mono">PENDING</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-800">
                <Link
                  to="/account"
                  className="flex-1 bg-white text-black px-6 py-4 font-black italic uppercase tracking-wider hover:bg-gray-200 transition-colors text-center shadow-[inset_0_-3px_0_rgba(0,0,0,0.2)]"
                >
                  TRACK ORDER
                </Link>
                <Link
                  to="/products"
                  className="flex-1 border-2 border-gray-700 text-white px-6 py-4 font-black italic uppercase tracking-wider hover:border-[#ff003c] hover:text-[#ff003c] hover:bg-[#ff003c]/5 transition-all text-center"
                >
                  CONTINUE SHOPPING
                </Link>
              </div>

            </div>
          </div>
        ) : (
          <div className="bg-[#111] border border-red-900 shadow-[0_0_50px_rgba(255,0,0,0.1)] p-8 sm:p-12 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-red-600 animate-pulse"></div>
            <div className="inline-block p-4 bg-red-900/30 rounded-full mb-6 border border-red-900">
              <Crosshair size={40} className="text-red-500" />
            </div>
            <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase mb-4">SYSTEM STALL - PAYMENT FAILED</h1>
            <p className="text-gray-400 mb-8 font-mono max-w-lg mx-auto">
              {orderStatus?.status === 'expired'
                ? 'CRITICAL ERROR: Checkout session expired. Ignition aborted.'
                : 'Payment diagnostic failed. Please check your transmission email or view order history.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/account" className="bg-white text-black px-8 py-3 font-bold uppercase tracking-wider hover:bg-gray-200">
                View Orders
              </Link>
              <Link to="/" className="border border-white text-white px-8 py-3 font-bold uppercase tracking-wider hover:bg-white hover:text-black transition-colors">
                Return to Base
              </Link>
            </div>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes spin-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        .animate-spin-reverse {
          animation: spin-reverse 2s linear infinite;
        }
      `}} />
    </div>
  );
};

export default OrderSuccess;
