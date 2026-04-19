import React, { useState, useEffect, useCallback } from 'react';
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
    const [subscriberCount, setSubscriberCount] = useState(0);
    const [recentSubscribers, setRecentSubscribers] = useState([]);
    const [subscriberSendMode, setSubscriberSendMode] = useState('all');
    const [selectedSubscriberEmails, setSelectedSubscriberEmails] = useState([]);
    const [notificationSubject, setNotificationSubject] = useState('');
    const [notificationPreheader, setNotificationPreheader] = useState('');
    const [notificationMessage, setNotificationMessage] = useState('');
    const [notificationCtaLabel, setNotificationCtaLabel] = useState('');
    const [notificationCtaLink, setNotificationCtaLink] = useState('');
    const [sendingNotification, setSendingNotification] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
    const API_URL = `${BACKEND_URL}/api`;

    const fetchSettings = useCallback(async () => {
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
        }
    }, [API_URL]);

    const fetchSubscribers = useCallback(async () => {
        try {
            const response = await axios.get(`${API_URL}/admin/subscribers`, {
                withCredentials: true
            });
            setSubscriberCount(response.data.total || 0);
            setRecentSubscribers(response.data.subscribers || []);
            setSelectedSubscriberEmails([]);
        } catch (error) {
            console.error('Failed to fetch subscribers', error);
            toast.error('Failed to load subscribers');
        }
    }, [API_URL]);

    const fetchInitialData = useCallback(async () => {
        await Promise.allSettled([fetchSettings(), fetchSubscribers()]);
        setLoading(false);
    }, [fetchSettings, fetchSubscribers]);

    useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            setSaving(true);
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
                { withCredentials: true }
            );
            toast.success('Settings saved successfully');
        } catch (error) {
            console.error('Failed to save settings', error);
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const handleSendNotification = async (e) => {
        e.preventDefault();

        if (!notificationSubject.trim() || !notificationMessage.trim()) {
            toast.error('Add a subject and message first');
            return;
        }

        if (subscriberSendMode === 'selected' && selectedSubscriberEmails.length === 0) {
            toast.error('Select at least one subscriber');
            return;
        }

        try {
            setSendingNotification(true);
            const response = await axios.post(
                `${API_URL}/admin/subscribers/send-notification`,
                {
                    subject: notificationSubject,
                    preheader: notificationPreheader,
                    message: notificationMessage,
                    cta_label: notificationCtaLabel,
                    cta_link: notificationCtaLink,
                    recipient_emails: subscriberSendMode === 'selected' ? selectedSubscriberEmails : []
                },
                { withCredentials: true }
            );
            const failedCount = response.data.failed_count ?? 0;
            toast.success(response.data.message || 'Notification sent');
            if (failedCount > 0) {
                toast.warning(`${failedCount} subscriber email${failedCount === 1 ? '' : 's'} failed to send`);
            }
            setNotificationSubject('');
            setNotificationPreheader('');
            setNotificationMessage('');
            setNotificationCtaLabel('');
            setNotificationCtaLink('');
        } catch (error) {
            console.error('Failed to send subscriber notification', error);
            toast.error(error.response?.data?.detail || 'Failed to send notification');
        } finally {
            setSendingNotification(false);
        }
    };

    const toggleSubscriberSelection = (email) => {
        setSelectedSubscriberEmails((current) => (
            current.includes(email)
                ? current.filter((item) => item !== email)
                : [...current, email]
        ));
    };

    const toggleSelectAllSubscribers = () => {
        if (selectedSubscriberEmails.length === recentSubscribers.length) {
            setSelectedSubscriberEmails([]);
            return;
        }
        setSelectedSubscriberEmails(recentSubscribers.map((subscriber) => subscriber.email));
    };

    if (loading) {
        return <div className="text-center py-12">Loading settings...</div>;
    }

    return (
        <div>
            <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-[24px] border border-black/8 bg-white p-5 shadow-sm">
                    <p className="font-nav text-[11px] text-[#8d6a46]">Announcement</p>
                    <p className="mt-2 text-3xl font-bold text-[#16120d]">{announcementActive ? 'On' : 'Off'}</p>
                </div>
                <div className="rounded-[24px] border border-black/8 bg-white p-5 shadow-sm">
                    <p className="font-nav text-[11px] text-[#8d6a46]">Discount</p>
                    <p className="mt-2 text-3xl font-bold text-[#16120d]">{globalDiscountPercentage}%</p>
                </div>
                <div className="rounded-[24px] border border-black/8 bg-white p-5 shadow-sm">
                    <p className="font-nav text-[11px] text-[#8d6a46]">Free Shipping</p>
                    <p className="mt-2 text-3xl font-bold text-[#16120d]">₹{freeShippingThreshold}</p>
                </div>
                <div className="rounded-[24px] border border-black/8 bg-white p-5 shadow-sm">
                    <p className="font-nav text-[11px] text-[#8d6a46]">COD</p>
                    <p className="mt-2 text-3xl font-bold text-[#16120d]">{codEnabled ? 'On' : 'Off'}</p>
                </div>
            </div>

            <form onSubmit={handleSave} className="mt-6 space-y-6">
                <div className="rounded-[28px] border border-black/8 bg-white p-6 shadow-sm">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                            <h2 className="font-nav text-2xl text-[#16120d]">Announcement Banner</h2>
                            <p className="mt-1 text-sm text-black/52">Control the line that rotates at the top of the storefront.</p>
                        </div>
                        <label className="inline-flex items-center gap-3 rounded-2xl bg-[#f4f1eb] px-4 py-3 cursor-pointer">
                            <input
                                type="checkbox"
                                id="announcementActive"
                                checked={announcementActive}
                                onChange={(e) => setAnnouncementActive(e.target.checked)}
                                className="w-4 h-4 text-black border-gray-300 rounded focus:ring-black"
                            />
                            <span className="font-nav text-sm text-gray-900">Enable Banner</span>
                        </label>
                    </div>

                    <div className="mt-5">
                        <label className="mb-2 block font-nav text-sm text-gray-700">
                            Announcement Messages (One per line)
                        </label>
                        <textarea
                            value={announcementsInput}
                            onChange={(e) => setAnnouncementsInput(e.target.value)}
                            rows={4}
                            placeholder="e.g. FREE SHIPPING ON ORDERS OVER ₹1500"
                            className="w-full border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black rounded-2xl"
                            disabled={!announcementActive}
                        />
                        <p className="mt-2 text-sm text-gray-500">
                            One message per line. Use `[Link Text](https://url.com)` to add clickable text.
                        </p>
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                    <div className="rounded-[28px] border border-black/8 bg-white p-6 shadow-sm">
                        <h2 className="font-nav text-2xl text-[#16120d]">Pricing Rules</h2>
                        <p className="mt-1 text-sm text-black/52">Keep discounts and shipping simple and predictable.</p>

                        <div className="mt-5 space-y-5">
                            <div>
                                <label className="mb-2 block font-nav text-sm text-gray-700">
                                    Global Discount Percentage (%)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={globalDiscountPercentage}
                                    onChange={(e) => setGlobalDiscountPercentage(parseInt(e.target.value) || 0)}
                                    className="w-full border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black rounded-2xl text-lg"
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-5">
                                <div>
                                    <label className="mb-2 block font-nav text-sm text-gray-700">
                                        Standard Shipping Charge (₹)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={shippingCharge}
                                        onChange={(e) => setShippingCharge(parseInt(e.target.value) || 0)}
                                        className="w-full border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black rounded-2xl text-lg"
                                    />
                                </div>
                                <div>
                                    <label className="mb-2 block font-nav text-sm text-gray-700">
                                        Free Shipping Threshold (₹)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={freeShippingThreshold}
                                        onChange={(e) => setFreeShippingThreshold(parseInt(e.target.value) || 0)}
                                        className="w-full border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black rounded-2xl text-lg"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-[28px] border border-black/8 bg-white p-6 shadow-sm">
                        <h2 className="font-nav text-2xl text-[#16120d]">Cash On Delivery</h2>
                        <p className="mt-1 text-sm text-black/52">Set clear COD rules for admins and customers.</p>

                        <div className="mt-5">
                            <label className="flex items-center justify-between gap-3 rounded-2xl bg-[#f4f1eb] px-4 py-4 cursor-pointer">
                                <div>
                                    <p className="font-nav text-gray-900">Enable Cash on Delivery</p>
                                    <p className="mt-1 text-sm text-gray-500">Turn COD on or off storewide.</p>
                                </div>
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
                            </label>
                        </div>

                        {codEnabled && (
                            <div className="mt-5 grid grid-cols-1 gap-5">
                                <div>
                                    <label className="mb-2 block font-nav text-sm text-gray-700">
                                        Maximum Order Limit for COD (₹)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={codMaxAmount}
                                        onChange={(e) => setCodMaxAmount(parseInt(e.target.value) || 0)}
                                        className="w-full border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black rounded-2xl text-lg"
                                    />
                                </div>
                                <div>
                                    <label className="mb-2 block font-nav text-sm text-gray-700">
                                        COD Extra Charge (₹)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={codCharge}
                                        onChange={(e) => setCodCharge(parseInt(e.target.value) || 0)}
                                        className="w-full border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black rounded-2xl text-lg"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={saving}
                        className="rounded-2xl bg-black px-6 py-3 font-nav text-white hover:bg-gray-800 disabled:opacity-50"
                    >
                        {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </form>

            <div className="mt-8 grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
                <div className="bg-white p-6 rounded-[28px] shadow-sm border border-black/8">
                    <h2 className="font-nav text-2xl text-gray-900">Subscribers</h2>
                    <p className="mt-2 text-sm text-gray-500">Only clean accepted subscriber records appear here.</p>

                    <div className="mt-6 rounded-2xl bg-gray-900 px-5 py-6 text-white">
                        <p className="font-nav text-xs text-white/60">Active Subscribers</p>
                        <p className="mt-3 text-4xl font-bold">{subscriberCount}</p>
                    </div>

                    <div className="mt-6">
                        <div className="flex items-center justify-between">
                            <h3 className="font-nav text-sm text-gray-500">Recent Emails</h3>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={toggleSelectAllSubscribers}
                                    className="font-nav text-sm text-gray-700 hover:text-black"
                                >
                                    {selectedSubscriberEmails.length === recentSubscribers.length && recentSubscribers.length > 0 ? 'Clear' : 'Select All'}
                                </button>
                                <button
                                    type="button"
                                    onClick={fetchSubscribers}
                                    className="font-nav text-sm text-gray-700 hover:text-black"
                                >
                                    Refresh
                                </button>
                            </div>
                        </div>
                        <div className="mt-4 space-y-3">
                            {recentSubscribers.slice(0, 8).map((subscriber) => (
                                <div key={subscriber.id || subscriber.email} className="rounded-2xl border border-black/8 bg-[#fbf8f3] px-4 py-3">
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={selectedSubscriberEmails.includes(subscriber.email)}
                                            onChange={() => toggleSubscriberSelection(subscriber.email)}
                                            className="mt-1 h-4 w-4 rounded border-gray-300 text-black focus:ring-black"
                                        />
                                        <div>
                                            <p className="font-nav break-all text-gray-900">{subscriber.email}</p>
                                            <p className="mt-1 text-xs text-gray-500">
                                                Joined {subscriber.subscribed_at ? new Date(subscriber.subscribed_at).toLocaleString() : 'recently'}
                                            </p>
                                        </div>
                                    </label>
                                </div>
                            ))}
                            {recentSubscribers.length === 0 && (
                                <div className="rounded-xl border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500">
                                    No subscribers yet.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-[28px] shadow-sm border border-black/8">
                    <h2 className="font-nav text-2xl text-gray-900">Send Subscriber Notification</h2>
                    <p className="mt-2 text-sm text-gray-500">Send a launch update, drop alert, or early-access message from the admin panel.</p>

                    <form onSubmit={handleSendNotification} className="mt-6 space-y-5">
                        <div>
                            <label className="mb-2 block font-nav text-sm text-gray-700">Send To</label>
                            <div className="grid gap-3 md:grid-cols-2">
                                <button
                                    type="button"
                                    onClick={() => setSubscriberSendMode('all')}
                                    className={`rounded-2xl border px-4 py-3 text-left transition ${subscriberSendMode === 'all' ? 'border-black bg-[#f4f1eb]' : 'border-gray-300 bg-white'}`}
                                >
                                    <p className="font-nav text-gray-900">All Subscribers</p>
                                    <p className="mt-1 text-sm text-gray-500">Send to everyone in the clean list.</p>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSubscriberSendMode('selected')}
                                    className={`rounded-2xl border px-4 py-3 text-left transition ${subscriberSendMode === 'selected' ? 'border-black bg-[#f4f1eb]' : 'border-gray-300 bg-white'}`}
                                >
                                    <p className="font-nav text-gray-900">Selected Subscribers</p>
                                    <p className="mt-1 text-sm text-gray-500">{selectedSubscriberEmails.length} selected right now.</p>
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="mb-2 block font-nav text-sm text-gray-700">Email Subject</label>
                            <input
                                type="text"
                                value={notificationSubject}
                                onChange={(e) => setNotificationSubject(e.target.value)}
                                placeholder="Next Drop Is Live"
                                className="w-full border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black rounded-2xl"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block font-nav text-sm text-gray-700">Short Line</label>
                            <input
                                type="text"
                                value={notificationPreheader}
                                onChange={(e) => setNotificationPreheader(e.target.value)}
                                placeholder="New fits. First access."
                                className="w-full border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black rounded-2xl"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block font-nav text-sm text-gray-700">Message</label>
                            <textarea
                                value={notificationMessage}
                                onChange={(e) => setNotificationMessage(e.target.value)}
                                rows={6}
                                placeholder="The new LAST GEAR drop is now live. Limited stock. Move early."
                                className="w-full border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black rounded-2xl"
                            />
                        </div>

                        <div className="grid gap-5 md:grid-cols-2">
                            <div>
                                <label className="mb-2 block font-nav text-sm text-gray-700">Button Label</label>
                                <input
                                    type="text"
                                    value={notificationCtaLabel}
                                    onChange={(e) => setNotificationCtaLabel(e.target.value)}
                                    placeholder="Shop The Drop"
                                    className="w-full border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black rounded-2xl"
                                />
                            </div>
                            <div>
                                <label className="mb-2 block font-nav text-sm text-gray-700">Button Link</label>
                                <input
                                    type="url"
                                    value={notificationCtaLink}
                                    onChange={(e) => setNotificationCtaLink(e.target.value)}
                                    placeholder="https://lastgear.in/products"
                                    className="w-full border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black rounded-2xl"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={sendingNotification || subscriberCount === 0}
                            className="rounded-2xl bg-black px-6 py-3 font-nav text-white hover:bg-gray-800 disabled:opacity-50"
                        >
                            {sendingNotification ? 'Sending...' : `Send To ${subscriberSendMode === 'selected' ? selectedSubscriberEmails.length : subscriberCount} Subscriber${(subscriberSendMode === 'selected' ? selectedSubscriberEmails.length : subscriberCount) === 1 ? '' : 's'}`}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default AdminSettings;
