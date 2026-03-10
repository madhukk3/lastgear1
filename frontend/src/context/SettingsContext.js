import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const SettingsContext = createContext();

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider = ({ children }) => {
    const [globalDiscount, setGlobalDiscount] = useState(0);
    const [shippingCharge, setShippingCharge] = useState(99);
    const [freeShippingThreshold, setFreeShippingThreshold] = useState(1500);
    const [announcement, setAnnouncement] = useState({ items: [], active: false });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
                const response = await axios.get(`${BACKEND_URL}/api/settings/announcement`);
                if (response.data) {
                    setGlobalDiscount(response.data.global_discount_percentage || 0);
                    setShippingCharge(response.data.shipping_charge ?? 99);
                    setFreeShippingThreshold(response.data.free_shipping_threshold ?? 1500);
                    setAnnouncement({
                        items: response.data.announcements || [],
                        active: response.data.announcement_active || false
                    });
                }
            } catch (error) {
                console.error('Failed to fetch store settings:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    return (
        <SettingsContext.Provider value={{ globalDiscount, shippingCharge, freeShippingThreshold, announcement, loading }}>
            {children}
        </SettingsContext.Provider>
    );
};
