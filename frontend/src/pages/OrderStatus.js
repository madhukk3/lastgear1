import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { format } from 'date-fns';
import { Loader, Zap, Crosshair, Cpu, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const OrderStatusPage = () => {
    const { order_id } = useParams();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelLoading, setCancelLoading] = useState(false);
    const [cancelReason, setCancelReason] = useState('');

    const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
    const API = `${BACKEND_URL}/api`;

    useEffect(() => {
        fetchOrderDetails();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [order_id]);

    const fetchOrderDetails = async () => {
        try {
            const response = await axios.get(`${API}/orders/${order_id}`);
            setOrder(response.data);
            setLoading(false);
        } catch (err) {
            console.error('Error fetching order details:', err);
            setError('Could not establish connection to the order database.');
            setLoading(false);
        }
    };

    const requestCancellation = async () => {
        setCancelLoading(true);
        try {
            await axios.post(`${API}/orders/${order_id}/request-cancel`, { reason: cancelReason });
            toast.success('Cancellation request submitted successfully');
            setShowCancelModal(false);
            fetchOrderDetails();
        } catch (err) {
            console.error('Failed to request cancellation:', err);
            toast.error(err.response?.data?.detail || 'Failed to submit cancellation request');
        } finally {
            setCancelLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center font-mono pt-20">
                <div className="text-center space-y-4">
                    <div className="relative mx-auto w-24 h-24">
                        <div className="absolute inset-0 border-4 border-t-[#ff003c] border-gray-800 rounded-full animate-spin"></div>
                        <div className="absolute inset-2 border-4 border-b-[#00f3ff] border-gray-800 rounded-full animate-spin-reverse"></div>
                        <Loader className="absolute inset-0 m-auto text-[#ff003c] animate-pulse" size={32} />
                    </div>
                    <p className="text-[#ff003c] text-xl tracking-[0.2em] animate-pulse">
                        LOADING TELEMETRY...
                    </p>
                </div>
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center font-mono p-4 pt-20">
                <div className="text-center border border-red-500 p-8 shadow-[0_0_30px_rgba(255,0,0,0.2)] bg-black/50 backdrop-blur">
                    <Crosshair className="mx-auto mb-4 text-red-500" size={48} />
                    <p className="text-xl text-red-500 mb-6 uppercase tracking-widest">Signal Lost - {error || 'Order Not Found'}</p>
                    <Link to="/account" className="inline-block bg-red-600 text-white px-8 py-3 font-bold uppercase tracking-wider hover:bg-red-700 transition-colors">
                        Return to Orders
                    </Link>
                </div>
            </div>
        );
    }

    const timeline = order.order_timeline || [];
    const isCancelled = timeline.some(t => t.status === "cancelled");
    const isCancelRequested = order.cancel_requested === true;
    const isCancelRejected = order.cancel_rejected === true;
    const isExchangeApproved = timeline.some(t => t.status === "exchange_approved");
    const isExchangeCompleted = timeline.some(t => t.status === "exchange_completed");

    const statusLabels = {
        order_locked: "Order Locked",
        processing: "Processing in Garage",
        packed: "Packed & Ready",
        shipped: "Dispatched",
        out_for_delivery: "Out for Delivery",
        delivered: "Delivered",
        cancelled: "Order Cancelled",
        exchange_requested: "Exchange Requested",
        exchange_approved: "Exchange Approved",
        exchange_rejected: "Exchange Denied",
        return_received: "Return Received",
        replacement_processing: "Replacement Prep",
        replacement_shipped: "Replacement Shipped",
        exchange_completed: "Exchange Completed"
    };

    let steps = timeline.map((evt, idx) => ({
        status: evt.status,
        name: statusLabels[evt.status] || evt.status.replace(/_/g, ' '),
        time: evt.time,
        isCompleted: true,
        isCurrent: idx === timeline.length - 1,
        isErrorState: ['cancelled', 'exchange_rejected'].includes(evt.status)
    }));

    const lastEvent = timeline[timeline.length - 1]?.status;
    const isError = steps.some(s => s.isErrorState);

    if (!isError && !isCancelRequested) {
        const standardFlow = ["order_locked", "processing", "packed", "shipped", "out_for_delivery", "delivered"];
        const exchangeFlow = ["exchange_requested", "exchange_approved", "return_received", "replacement_processing", "replacement_shipped", "exchange_completed"];

        let path = standardFlow;
        const hasExchange = timeline.some(t => exchangeFlow.includes(t.status));

        if (hasExchange) {
            path = [...standardFlow, ...exchangeFlow];
        }

        const lastIndexInPath = path.indexOf(lastEvent);
        if (lastIndexInPath !== -1 && lastIndexInPath < path.length - 1) {
            const futureSteps = path.slice(lastIndexInPath + 1).map(status => ({
                status: status,
                name: statusLabels[status] || status.replace(/_/g, ' '),
                time: null,
                isCompleted: false,
                isCurrent: false,
                isErrorState: false
            }));
            steps = [...steps, ...futureSteps];
        }
    }

    if (isCancelRequested && !isCancelled) {
        steps.splice(timeline.length, 0, {
            status: 'cancel_requested',
            name: 'CANCELLATION REQUESTED',
            time: order.cancel_request_time || new Date().toISOString(),
            isCompleted: false,
            isCurrent: true,
            isErrorState: false,
            isCancelRequestedStep: true
        });
        if (timeline.length > 0) {
            steps[timeline.length - 1].isCurrent = false;
        }
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-gray-300 font-sans p-4 sm:p-8 pt-24 pb-20 relative overflow-hidden">

            {/* Background Stylings */}
            <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: 'radial-gradient(circle at center, #ff003c 0%, transparent 40%)', top: '-20%' }}></div>
            <div className="absolute left-0 top-0 bottom-0 w-24 border-r border-[#ff003c]/20 flex flex-col justify-between py-10 items-center opacity-30 hidden lg:flex mt-16">
                <div className="rotate-90 tracking-[0.5em] text-xs font-mono text-[#ff003c]">TELEMETRY</div>
                <div className="h-64 w-px bg-gradient-to-b from-transparent via-[#ff003c] to-transparent animate-pulse"></div>
                <div className="-rotate-90 tracking-[0.5em] text-xs font-mono text-[#ff003c]">STATUS: ON</div>
            </div>

            <div className="max-w-5xl w-full mx-auto relative z-10">
                <div className="bg-[#111] border rounded-sm border-gray-800 shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden relative mb-8">

                    {/* Top HUD Border Accent */}
                    <div className="h-1 w-full bg-gradient-to-r from-transparent via-[#ff003c] to-transparent"></div>

                    <div className="p-6 sm:p-10">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 border-b border-gray-800 pb-6 gap-6 md:gap-0">
                            <div>
                                <Link to="/account" className="text-gray-500 hover:text-white uppercase tracking-widest text-xs font-mono flex items-center gap-2 mb-4 transition-colors">
                                    &lt; BACK TO DASHBOARD
                                </Link>
                                {isCancelled ? (
                                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/30 text-red-500 font-mono text-sm tracking-widest uppercase mb-4 rounded-sm">
                                        <AlertTriangle size={14} /> ORDER CANCELLED
                                    </div>
                                ) : isCancelRequested ? (
                                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-500/10 border border-orange-500/30 text-orange-400 font-mono text-sm tracking-widest uppercase mb-4 rounded-sm animate-pulse">
                                        <AlertTriangle size={14} /> CANCELLATION REQUESTED
                                    </div>
                                ) : isExchangeCompleted ? (
                                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/30 text-green-400 font-mono text-sm tracking-widest uppercase mb-4 rounded-sm">
                                        <CheckCircle size={14} /> EXCHANGE COMPLETED
                                    </div>
                                ) : isExchangeApproved ? (
                                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-400 font-mono text-sm tracking-widest uppercase mb-4 rounded-sm animate-pulse">
                                        <Cpu size={14} /> EXCHANGE IN PROGRESS
                                    </div>
                                ) : isCancelRejected ? (
                                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-500/10 border border-gray-500/30 text-gray-400 font-mono text-sm tracking-widest uppercase mb-4 rounded-sm">
                                        <AlertTriangle size={14} /> CANCELLATION REJECTED
                                    </div>
                                ) : (
                                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-400 font-mono text-sm tracking-widest uppercase mb-4 rounded-sm">
                                        <Cpu size={14} /> ORDER PROTOCOL ACTIVE
                                    </div>
                                )}
                                <h1 className="text-2xl sm:text-4xl font-black text-white italic tracking-tighter uppercase drop-shadow-[0_0_15px_rgba(255,0,60,0.3)]">
                                    ORDER: <span className="text-[#ff003c]">{order.id}</span>
                                </h1>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0 drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                                <img src="/logo-white.png" alt="LAST GEAR Logo" className="h-[55px] md:h-[80px] w-auto object-contain" />
                                <span className="md:hidden text-2xl pt-1 font-puma tracking-widest text-[#222] opacity-80 select-none">
                                    LAST GEAR
                                </span>
                            </div>
                        </div>

                        {/* Order Summary Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                            <div className="bg-[#0f0f0f] border border-gray-800 p-4 rounded-sm relative group overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-0.5 bg-gray-700 group-hover:bg-white transition-colors"></div>
                                <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest mb-1">Date</p>
                                <p className="text-sm text-white font-bold">{new Date(order.created_at).toLocaleDateString()}</p>
                            </div>
                            <div className="bg-[#0f0f0f] border border-gray-800 p-4 rounded-sm relative group overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-0.5 bg-gray-700 group-hover:bg-[#00f3ff] transition-colors"></div>
                                <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest mb-1">Payment Method</p>
                                <p className="text-sm text-[#00f3ff] font-bold uppercase">{order.payment_method === 'cod' ? 'COD' : 'PREPAID'}</p>
                            </div>
                            <div className="bg-[#0f0f0f] border border-gray-800 p-4 rounded-sm relative group overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-0.5 bg-gray-700 group-hover:bg-green-500 transition-colors"></div>
                                <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest mb-1">Payment Status</p>
                                <p className={`text-sm font-bold uppercase ${order.payment_status === 'paid' ? 'text-green-400' : 'text-orange-400'}`}>
                                    {order.payment_status === 'pending_cod' ? 'UNPAID' : order.payment_status}
                                </p>
                            </div>
                            <div className="bg-[#0f0f0f] border border-gray-800 p-4 rounded-sm relative group overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-0.5 bg-gray-700 group-hover:bg-[#ff003c] transition-colors"></div>
                                <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest mb-1">Total Amount</p>
                                <p className="text-sm text-[#ff003c] font-bold font-mono text-lg">₹{order.total_amount}</p>
                            </div>
                        </div>

                        {/* Telemetry Progress Panel */}
                        <div className="mb-12 bg-[#0a0a0a] border border-gray-800 p-6 sm:p-8 rounded-sm">
                            <div className="flex justify-between items-center mb-8">
                                <h3 className="text-gray-400 font-mono tracking-widest text-sm uppercase flex items-center gap-2">
                                    <div className="w-2 h-2 bg-[#ff003c] rounded-full animate-ping"></div> Live Telemetry
                                </h3>
                                {order.tracking_number && (
                                    <div className="bg-white/10 px-3 py-1 rounded text-white text-xs font-mono border border-white/20">
                                        TRK PIND: {order.tracking_number}
                                    </div>
                                )}
                            </div>

                            <div className="relative">
                                <div className="absolute left-[15px] top-6 bottom-6 w-[2px] bg-gray-800 md:left-0 md:right-0 md:top-[15px] md:bottom-auto md:h-[2px] md:w-full"></div>

                                <div className="flex justify-start relative gap-12 md:gap-16 pb-4 overflow-x-auto min-w-full">
                                    {steps.map((step, idx) => {
                                        return (
                                            <div key={idx} className={`flex flex-col items-center gap-3 text-center z-10 min-w-[120px] ${(!step.isCompleted && !step.isErrorState && !step.isCancelRequestedStep) ? 'opacity-50' : ''}`}>
                                                <div className={`w-8 h-8 rounded-full border-4 border-[#111] flex flex-shrink-0 items-center justify-center transition-all ${step.isCurrent ?
                                                        (step.isErrorState ? 'bg-red-600 shadow-[0_0_20px_rgba(255,0,0,0.8)] scale-110' :
                                                            step.status && step.status.includes('exchange') ? 'bg-blue-500 shadow-[0_0_20px_rgba(0,100,255,0.8)] scale-110' :
                                                                step.isCancelRequestedStep ? 'bg-orange-500 shadow-[0_0_20px_rgba(255,165,0,0.8)] scale-110' :
                                                                    'bg-[#ff003c] shadow-[0_0_20px_rgba(255,0,60,0.8)] scale-110') :
                                                        step.isCompleted ? 'bg-gray-400' : 'bg-gray-800'
                                                    }`}>
                                                    {step.isCompleted ?
                                                        (step.isErrorState ? <div className="w-2 h-2 rounded-full bg-white"></div> : <CheckCircle size={14} className={step.isCurrent ? 'text-white' : 'text-[#111]'} />) :
                                                        <div className="w-2 h-2 rounded-full bg-gray-600"></div>
                                                    }
                                                </div>
                                                <div>
                                                    <p className={`font-bold text-xs uppercase ${step.isCurrent ?
                                                            (step.isErrorState ? 'text-red-500' :
                                                                step.status && step.status.includes('exchange') ? 'text-blue-400' :
                                                                    step.isCancelRequestedStep ? 'text-orange-400' :
                                                                        'text-white') :
                                                            'text-gray-400'
                                                        }`}>{step.name}</p>

                                                    <p className={`text-[10px] font-mono tracking-widest mt-1 ${step.isCurrent ?
                                                            (step.isErrorState ? 'text-red-600 animate-pulse' :
                                                                step.status && step.status.includes('exchange') ? 'text-blue-500 animate-pulse' :
                                                                    step.isCancelRequestedStep ? 'text-orange-500 animate-pulse' :
                                                                        'text-[#ff003c]') :
                                                            'text-gray-600'
                                                        }`}>
                                                        {step.time ? format(new Date(step.time), 'MMM dd, HH:mm') : 'PENDING'}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Items List */}
                            <div className="lg:col-span-2">
                                <h3 className="text-white font-bold italic uppercase border-b border-gray-800 pb-3 mb-4 flex items-center gap-2">
                                    <Crosshair className="text-[#ff003c]" size={18} /> Cargo Payload
                                </h3>
                                <div className="space-y-4">
                                    {order.items.map((item, index) => (
                                        <div key={index} className="flex gap-4 p-4 bg-[#0a0a0a] border border-gray-800 rounded-sm hover:border-gray-600 transition-colors">
                                            <div className="w-20 h-24 bg-[#111] flex-shrink-0 relative overflow-hidden group border border-gray-800">
                                                {item.image ? (
                                                    <img src={item.image} alt={item.name} className="w-full h-full object-cover grayscale mix-blend-luminosity group-hover:grayscale-0 transition-all duration-300" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-700">NA</div>
                                                )}
                                                <div className="absolute top-0 right-0 bg-[#ff003c] text-white text-[10px] font-bold px-1.5 py-0.5 font-mono">
                                                    x{item.quantity}
                                                </div>
                                            </div>
                                            <div className="flex-1 flex flex-col justify-between py-1">
                                                <div>
                                                    <p className="text-white font-bold uppercase tracking-wide">{item.name}</p>
                                                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 font-mono uppercase">
                                                        <span>S: {item.size}</span>
                                                        <span>C: {item.color}</span>
                                                    </div>
                                                </div>
                                                <p className="text-green-400 font-mono font-bold">₹{(item.price * item.quantity).toFixed(2)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Shipping & Support */}
                            <div>
                                <h3 className="text-white font-bold italic uppercase border-b border-gray-800 pb-3 mb-4 flex items-center gap-2">
                                    <Zap className="text-[#00f3ff]" size={18} /> Drop Zone
                                </h3>
                                <div className="bg-[#0a0a0a] border border-gray-800 p-5 rounded-sm mb-6">
                                    <p className="text-white font-bold uppercase mb-2 text-sm">{order.shipping_address?.full_name}</p>
                                    <p className="text-gray-400 text-sm leading-relaxed mb-4">
                                        {order.shipping_address?.address_line1}<br />
                                        {order.shipping_address?.address_line2 && <>{order.shipping_address.address_line2}<br /></>}
                                        {order.shipping_address?.city}, {order.shipping_address?.state} {order.shipping_address?.postal_code}<br />
                                        {order.shipping_address?.country}
                                    </p>
                                    <p className="text-xs text-gray-500 font-mono uppercase">COMMS: {order.shipping_address?.phone}</p>
                                </div>

                                <div className="space-y-3">
                                    <a href={`mailto:support@lastgear.in?subject=Order%20Inquiry%20${order.id}`} className="block w-full border border-gray-700 text-gray-300 px-6 py-4 font-black italic uppercase tracking-wider hover:border-white hover:text-white transition-all text-center text-sm">
                                        CONTACT SUPPORT
                                    </a>
                                    <Link to="/products" className="block w-full border-2 border-[#ff003c] bg-[#ff003c]/5 text-[#ff003c] px-6 py-4 font-black italic uppercase tracking-wider hover:bg-[#ff003c] hover:text-white transition-all text-center text-sm shadow-[0_0_15px_rgba(255,0,60,0.15)] hover:shadow-[0_0_30px_rgba(255,0,60,0.4)]">
                                        CONTINUE SHOPPING
                                    </Link>
                                    {(lastEvent === 'order_locked' || lastEvent === 'processing') && !isCancelRequested && !isCancelRejected && !isCancelled && (
                                        <button onClick={() => setShowCancelModal(true)} className="block w-full border border-red-900 bg-red-900/10 text-red-500 px-6 py-4 font-black italic uppercase tracking-wider hover:bg-red-900/30 transition-all text-center text-sm mt-4">
                                            REQUEST CANCELLATION
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            {/* Cancellation Modal */}
            {showCancelModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-[#111] border border-red-900 p-8 max-w-md w-full shadow-[0_0_50px_rgba(255,0,0,0.2)]">
                        <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase mb-4 flex items-center gap-2">
                            <AlertTriangle className="text-red-500" /> Confirm Request
                        </h2>
                        <p className="text-gray-400 mb-4 font-mono text-sm leading-relaxed">
                            Do you want to request cancellation for order <span className="text-white font-bold">{order.id}</span>?<br /><br />
                            This request will be sent to the admin team for approval.
                        </p>
                        <textarea
                            className="w-full bg-black border border-gray-800 text-white p-3 mb-6 font-mono text-sm outline-none focus:border-red-500 transition-colors placeholder-gray-700"
                            placeholder="Reason for cancellation (optional)..."
                            rows="3"
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                        ></textarea>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setShowCancelModal(false)}
                                disabled={cancelLoading}
                                className="flex-1 bg-gray-800 text-white font-bold uppercase py-3 hover:bg-gray-700 transition disabled:opacity-50"
                            >
                                Keep Order
                            </button>
                            <button
                                onClick={requestCancellation}
                                disabled={cancelLoading}
                                className="flex-1 bg-red-600 text-white font-bold uppercase py-3 hover:bg-red-700 transition flex justify-center items-center gap-2 disabled:opacity-50"
                            >
                                {cancelLoading ? <Loader size={18} className="animate-spin" /> : 'Yes, Cancel'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

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

export default OrderStatusPage;
