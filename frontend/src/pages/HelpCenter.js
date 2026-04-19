import React, { useState } from 'react';
import axios from 'axios';
import { ShieldCheck, Send, Loader, AlertTriangle, HelpCircle } from 'lucide-react';
import BackButton from '../components/BackButton';
import { toast } from 'sonner';

const HelpCenter = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        order_id: '',
        customer_name: '',
        customer_email: '',
        phone_number: '',
        product_name: '',
        size_purchased: '',
        size_requested: '',
        reason: 'Wrong Size',
    });
    const [imageFile, setImageFile] = useState(null);

    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
    const API = `${BACKEND_URL}/api`;

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setImageFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const payload = new FormData();
            Object.keys(formData).forEach(key => {
                payload.append(key, formData[key]);
            });
            if (imageFile) {
                payload.append('image', imageFile);
            }

            await axios.post(`${API}/help/request-exchange`, payload, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success("Exchange request submitted successfully!");
            setIsModalOpen(false);
            setFormData({
                order_id: '', customer_name: '', customer_email: '', phone_number: '',
                product_name: '', size_purchased: '', size_requested: '', reason: 'Wrong Size'
            });
            setImageFile(null);
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.detail || "Failed to submit exchange request");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-gray-300 font-sans p-4 sm:p-8 pt-24 pb-20 relative overflow-hidden">

            {/* Background Animations */}
            <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: 'radial-gradient(circle at top center, #ff003c 0%, transparent 40%)', top: '-20%' }}></div>

            <div className="max-w-4xl mx-auto relative z-10">
                <BackButton label="Back" className="mb-8 text-white" />
                <div className="text-center mb-16">
                    <HelpCircle size={48} className="mx-auto text-[#ff003c] mb-6 animate-pulse" />
                    <h1 className="text-4xl md:text-5xl font-black text-white italic uppercase tracking-tighter mb-4">
                        SUPPORT & <span className="text-[#ff003c]">HELP CENTER</span>
                    </h1>
                    <p className="text-gray-400 font-mono text-sm max-w-2xl mx-auto tracking-widest leading-relaxed">
                        SECURE PROTOCOLS FOR ORDER ASSISTANCE, EXCHANGES, AND TELEMETRY TROUBLESHOOTING.
                    </p>
                </div>

                {/* 7-DAY EXCHANGE POLICY TILE */}
                <div className="bg-[#111] border border-gray-800 p-8 md:p-12 mb-12 shadow-[0_0_50px_rgba(0,0,0,0.5)] group hover:border-[#ff003c]/50 transition-colors relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#ff003c]/5 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform"></div>

                    <div className="flex flex-col md:flex-row gap-8 items-start relative z-10">
                        <div className="p-4 bg-black border border-gray-800 text-[#ff003c]">
                            <ShieldCheck size={40} />
                        </div>

                        <div className="flex-1">
                            <h2 className="text-2xl font-black text-white italic uppercase tracking-wider mb-4">
                                7-DAY EXCHANGE POLICY
                            </h2>
                            <p className="text-gray-400 font-mono text-sm mb-6 leading-relaxed">
                                LAST GEAR offers a strict 7-day exchange window from the date of active delivery.
                                <br /><br />
                                If you received the wrong size, a damaged product, or an incorrect item, you can initiate a seamless exchange request below. Ensure your <span className="text-white font-bold">Order ID</span> and registered <span className="text-white font-bold">Email</span> match our telemetry records. We do not offer returns/refunds, only size/defect exchanges.
                            </p>

                            <button
                                onClick={() => setIsModalOpen(true)}
                                className="bg-[#ff003c] text-white px-8 py-4 font-black italic uppercase tracking-widest hover:bg-white hover:text-black transition-colors w-full sm:w-auto shadow-[0_0_20px_rgba(255,0,60,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.4)] flex items-center justify-center gap-3"
                            >
                                <Send size={18} /> INITIATE EXCHANGE
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* EXCHANGE MODAL OVERLAY */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-2 sm:p-4">
                    <div className="bg-[#111] border border-gray-700 w-full max-w-3xl max-h-[95vh] sm:max-h-[90vh] flex flex-col relative shadow-[0_0_100px_rgba(0,0,0,1)] overflow-hidden">

                        {/* Header */}
                        <div className="p-4 sm:p-6 border-b border-gray-800 flex justify-between items-center bg-black/50 shrink-0">
                            <h2 className="text-lg sm:text-xl font-black text-white italic uppercase tracking-wider flex items-center gap-2 sm:gap-3">
                                <AlertTriangle className="text-[#ff003c] shrink-0" size={24} /> <span className="truncate">PRODUCT EXCHANGE</span>
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-white transition-colors p-1 sm:p-2 shrink-0">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="p-4 sm:p-6 md:p-8 space-y-6 overflow-y-auto">

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] text-gray-500 font-mono tracking-widest uppercase mb-2">Order ID *</label>
                                    <input required type="text" name="order_id" value={formData.order_id} onChange={handleChange} placeholder="LG-XXXXX" className="w-full bg-black border border-gray-800 text-white px-4 py-3 font-mono focus:border-[#ff003c] outline-none transition-colors" />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-gray-500 font-mono tracking-widest uppercase mb-2">Registered Email *</label>
                                    <input required type="email" name="customer_email" value={formData.customer_email} onChange={handleChange} placeholder="user@example.com" className="w-full bg-black border border-gray-800 text-white px-4 py-3 font-mono focus:border-[#ff003c] outline-none transition-colors" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] text-gray-500 font-mono tracking-widest uppercase mb-2">Full Name *</label>
                                    <input required type="text" name="customer_name" value={formData.customer_name} onChange={handleChange} className="w-full bg-black border border-gray-800 text-white px-4 py-3 focus:border-[#ff003c] outline-none transition-colors" />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-gray-500 font-mono tracking-widest uppercase mb-2">Phone Number *</label>
                                    <input required type="tel" name="phone_number" value={formData.phone_number} onChange={handleChange} className="w-full bg-black border border-gray-800 text-white px-4 py-3 focus:border-[#ff003c] outline-none transition-colors" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-[10px] text-gray-500 font-mono tracking-widest uppercase mb-2">Product Name *</label>
                                    <input required type="text" name="product_name" value={formData.product_name} onChange={handleChange} className="w-full bg-black border border-gray-800 text-white px-4 py-3 focus:border-[#ff003c] outline-none transition-colors" />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-gray-500 font-mono tracking-widest uppercase mb-2">Size Purchased *</label>
                                    <select required name="size_purchased" value={formData.size_purchased} onChange={handleChange} className="w-full bg-black border border-gray-800 text-white px-4 py-3 focus:border-[#ff003c] outline-none transition-colors appearance-none">
                                        <option value="" disabled>Select Size</option>
                                        <option value="XS">XS</option>
                                        <option value="S">S</option>
                                        <option value="M">M</option>
                                        <option value="L">L</option>
                                        <option value="XL">XL</option>
                                        <option value="XXL">XXL</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] text-gray-500 font-mono tracking-widest uppercase mb-2">Size Needed *</label>
                                    <select required name="size_requested" value={formData.size_requested} onChange={handleChange} className="w-full bg-black border border-gray-800 text-white px-4 py-3 focus:border-[#ff003c] outline-none transition-colors appearance-none">
                                        <option value="" disabled>Select Size</option>
                                        <option value="XS">XS</option>
                                        <option value="S">S</option>
                                        <option value="M">M</option>
                                        <option value="L">L</option>
                                        <option value="XL">XL</option>
                                        <option value="XXL">XXL</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] text-gray-500 font-mono tracking-widest uppercase mb-2">Reason *</label>
                                    <select required name="reason" value={formData.reason} onChange={handleChange} className="w-full bg-black border border-gray-800 text-white px-4 py-3 focus:border-[#ff003c] outline-none transition-colors apperance-none">
                                        <option>Wrong Size</option>
                                        <option>Damaged Product</option>
                                        <option>Wrong Item Sent</option>
                                        <option>Quality Issue</option>
                                        <option>Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] text-gray-500 font-mono tracking-widest uppercase mb-2">Defect Image - Optional</label>
                                    <input type="file" accept="image/*" onChange={handleFileChange} className="w-full bg-black border border-gray-800 text-white px-4 py-[9px] focus:border-[#ff003c] outline-none transition-colors file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-[#ff003c] file:text-white hover:file:bg-white hover:file:text-black file:cursor-pointer" />
                                </div>
                            </div>

                            <div className="pt-6 flex gap-4 border-t border-gray-800">
                                <button type="button" onClick={() => setIsModalOpen(false)} disabled={loading} className="w-1/3 border border-gray-700 text-gray-400 py-4 font-bold uppercase tracking-widest hover:text-white hover:border-gray-500 transition-colors">
                                    CANCEL
                                </button>
                                <button type="submit" disabled={loading} className="w-2/3 bg-[#ff003c] text-white py-4 font-black italic uppercase tracking-widest hover:bg-white hover:text-black transition-colors flex justify-center items-center gap-2">
                                    {loading ? <Loader className="animate-spin" size={20} /> : 'TRANSMIT REQUEST'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HelpCenter;
