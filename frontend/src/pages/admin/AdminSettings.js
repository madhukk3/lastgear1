import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

const AdminSettings = () => {
    const [announcementsInput, setAnnouncementsInput] = useState('');
    const [announcementActive, setAnnouncementActive] = useState(true);
    const [globalDiscountPercentage, setGlobalDiscountPercentage] = useState(0);
    const [shippingCharge, setShippingCharge] = useState(99);
    const [freeShippingThreshold, setFreeShippingThreshold] = useState(1500);
    const [codEnabled, setCodEnabled] = useState(true);
    const [codMaxAmount, setCodMaxAmount] = useState(3000);
    const [codCharge, setCodCharge] = useState(50);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
    const API_URL = `${BACKEND_URL}/api`;

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const response = await axios.get(`${API_URL}/settings/announcement`);
            setAnnouncementsInput(response.data.announcements ? response.data.announcements.join('\n') : '');
            setAnnouncementActive(response.data.announcement_active);
            setGlobalDiscountPercentage(response.data.global_discount_percentage || 0);
            setShippingCharge(response.data.shipping_charge ?? 99);
            setFreeShippingThreshold(response.data.free_shipping_threshold ?? 1500);
            setCodEnabled(response.data.cod_enabled ?? true);
            setCodMaxAmount(response.data.cod_max_amount ?? 3000);
            setCodCharge(response.data.cod_charge ?? 50);
        } catch (error) {
            console.error('Failed to fetch settings', error);
            toast.error('Failed to load settings');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            setSaving(true);
            const token = localStorage.getItem('token');
            await axios.put(
                `${API_URL}/admin/settings/announcement`,
                {
                    announcements: announcementsInput.split('\n').filter(line => line.trim() !== ''),
                    announcement_active: announcementActive,
                    global_discount_percentage: globalDiscountPercentage,
                    shipping_charge: shippingCharge,
                    free_shipping_threshold: freeShippingThreshold,
                    cod_enabled: codEnabled,
                    cod_max_amount: codMaxAmount,
                    cod_charge: codCharge
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success('Settings saved successfully');
        } catch (error) {
            console.error('Failed to save settings', error);
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="text-center py-12">Loading settings...</div>;
    }

    return (
        <div>
            <h1 className="text-3xl font-bold mb-8">Site Settings</h1>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h2 className="text-xl font-bold mb-4">Top Announcement Banner</h2>

                <form onSubmit={handleSave} className="space-y-6">
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="announcementActive"
                            checked={announcementActive}
                            onChange={(e) => setAnnouncementActive(e.target.checked)}
                            className="w-4 h-4 text-black border-gray-300 rounded focus:ring-black"
                        />
                        <label htmlFor="announcementActive" className="ml-2 block text-sm font-medium text-gray-900">
                            Enable Announcement Banner
                        </label>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Announcement Messages (One per line)
                        </label>
                        <textarea
                            value={announcementsInput}
                            onChange={(e) => setAnnouncementsInput(e.target.value)}
                            rows={4}
                            placeholder="e.g. 🚚 FREE SHIPPING ON ORDERS OVER ₹1500&#10;✨ NEW IMPACT SERIES OUT NOW"
                            className="w-full border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-black rounded-md"
                            disabled={!announcementActive}
                        />
                        <p className="mt-1 text-sm text-gray-500">
                            These messages will rotate at the top of every page. Write one message per line.
                            <br />
                            <span className="font-semibold">Tip:</span> To add a clickable link, use the format: <code>[Link Text](https://url.com)</code>. For example: "SEND US A HI ON WHATSAPP [CLICK HERE](https://wa.me/12345)"
                        </p>
                    </div>

                    <div className="border-t pt-6 mt-6">
                        <h2 className="text-xl font-bold mb-4">Storewide Discount</h2>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Global Discount Percentage (%)
                        </label>
                        <input
                            type="number"
                            min="0"
                            max="100"
                            value={globalDiscountPercentage}
                            onChange={(e) => setGlobalDiscountPercentage(parseInt(e.target.value) || 0)}
                            className="w-full md:w-1/3 border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-black rounded-md text-lg"
                        />
                        <p className="mt-1 text-sm text-gray-500">
                            Set this to any value greater than 0 to apply a storewide markdown on top of the cart subtotal for all customers.
                        </p>
                    </div>

                    <div className="border-t pt-6 mt-6">
                        <h2 className="text-xl font-bold mb-4">Shipping Configuration</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Standard Shipping Charge (₹)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={shippingCharge}
                                    onChange={(e) => setShippingCharge(parseInt(e.target.value) || 0)}
                                    className="w-full border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-black rounded-md text-lg"
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    The default shipping fee applied to orders below the free shipping threshold.
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Free Shipping Threshold (₹)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={freeShippingThreshold}
                                    onChange={(e) => setFreeShippingThreshold(parseInt(e.target.value) || 0)}
                                    className="w-full border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-black rounded-md text-lg"
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    Orders with a subtotal equal to or exceeding this amount will automatically qualify for free shipping.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="border-t pt-6 mt-6">
                        <h2 className="text-xl font-bold mb-4">Cash on Delivery (COD) Settings</h2>

                        <div className="mb-6">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={codEnabled}
                                        onChange={(e) => setCodEnabled(e.target.checked)}
                                    />
                                    <div className={`block w-14 h-8 rounded-full transition-colors ${codEnabled ? 'bg-black' : 'bg-gray-300'}`}></div>
                                    <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${codEnabled ? 'transform translate-x-6' : ''}`}></div>
                                </div>
                                <span className="text-lg font-medium text-gray-900">
                                    Enable Cash on Delivery Checkouts
                                </span>
                            </label>
                            <p className="mt-2 text-sm text-gray-500">
                                Toggle this off to globally restrict all customers from using COD across the store.
                            </p>
                        </div>

                        {codEnabled && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-4 rounded-lg">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Maximum Order Limit for COD (₹)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={codMaxAmount}
                                        onChange={(e) => setCodMaxAmount(parseInt(e.target.value) || 0)}
                                        className="w-full border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-black rounded-md text-lg"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">
                                        Orders above this subtotal cannot use Cash on Delivery.
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        COD Extra Charge (₹)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={codCharge}
                                        onChange={(e) => setCodCharge(parseInt(e.target.value) || 0)}
                                        className="w-full border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-black rounded-md text-lg"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">
                                        Additional fee applied when the user selects COD at checkout.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={saving}
                        className="bg-black text-white px-6 py-2 rounded-md font-bold hover:bg-gray-800 disabled:opacity-50"
                    >
                        {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AdminSettings;
