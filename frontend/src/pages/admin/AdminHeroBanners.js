import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, CheckCircle, XCircle } from 'lucide-react';
import ImageUpload from '../../components/ImageUpload';

const AdminHeroBanners = () => {
    const [banners, setBanners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBanner, setEditingBanner] = useState(null);

    const [formData, setFormData] = useState({
        title: '',
        subtitle: '',
        image: '',
        link: '',
        button_text: 'EXPLORE',
        is_active: true,
        order: 0
    });

    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
    const API = `${BACKEND_URL}/api`;

    useEffect(() => {
        fetchBanners();
    }, []);

    const fetchBanners = async () => {
        try {
            const response = await axios.get(`${API}/admin/hero-banners`, {
                withCredentials: true
            });
            setBanners(response.data);
        } catch (error) {
            toast.error('Failed to fetch Hero Banners');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingBanner) {
                await axios.put(`${API}/admin/hero-banners/${editingBanner.id}`, formData, {
                    withCredentials: true
                });
                toast.success('Banner updated successfully');
            } else {
                await axios.post(`${API}/admin/hero-banners`, formData, {
                    withCredentials: true
                });
                toast.success('Banner created successfully');
            }
            setIsModalOpen(false);
            fetchBanners();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Operation failed');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this banner?')) {
            try {
                await axios.delete(`${API}/admin/hero-banners/${id}`, {
                    withCredentials: true
                });
                toast.success('Banner deleted');
                fetchBanners();
            } catch (error) {
                toast.error('Failed to delete banner');
            }
        }
    };

    const handleToggleActive = async (id) => {
        try {
            await axios.post(`${API}/admin/hero-banners/${id}/toggle-active`, {}, {
                withCredentials: true
            });
            toast.success('Banner status updated');
            fetchBanners();
        } catch (error) {
            toast.error('Failed to update banner status');
        }
    };

    const openModal = (banner = null) => {
        if (banner) {
            setEditingBanner(banner);
            setFormData({
                title: banner.title,
                subtitle: banner.subtitle,
                image: banner.image,
                link: banner.link,
                button_text: banner.button_text,
                is_active: banner.is_active,
                order: banner.order
            });
        } else {
            setEditingBanner(null);
            setFormData({
                title: '',
                subtitle: '',
                image: '',
                link: '/products',
                button_text: 'EXPLORE',
                is_active: true,
                order: banners.length
            });
        }
        setIsModalOpen(true);
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold font-puma">Hero Banners Management</h1>
                <button
                    onClick={() => openModal()}
                    className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
                >
                    <Plus size={20} />
                    <span>New Banner</span>
                </button>
            </div>

            {loading ? (
                <div className="text-center py-12">Loading...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {banners.map((banner) => (
                        <div key={banner.id} className={`bg-white rounded-xl shadow-sm border ${banner.is_active ? 'border-blue-500' : 'border-gray-200'} overflow-hidden`}>
                            <div className="h-48 relative bg-gray-900 flex items-center justify-center">
                                {banner.image ? (
                                    <img src={banner.image} alt={banner.title} className="w-full h-full object-cover opacity-80" />
                                ) : (
                                    <span className="text-gray-500">No Image</span>
                                )}
                                {banner.is_active && (
                                    <div className="absolute top-4 right-4 bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                                        <CheckCircle size={14} /> ACTIVE
                                    </div>
                                )}
                                <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                                    <div className="text-white text-sm font-bold tracking-widest">{banner.subtitle}</div>
                                    <div className="text-white text-2xl font-black italic uppercase leading-none">{banner.title}</div>
                                </div>
                            </div>
                            <div className="p-4 bg-gray-50 flex justify-between items-center">
                                <button
                                    onClick={() => handleToggleActive(banner.id)}
                                    className={`text-sm font-medium ${banner.is_active ? 'text-gray-500 hover:text-gray-700' : 'text-blue-600 hover:text-blue-800'}`}
                                >
                                    {banner.is_active ? 'Deactivate' : 'Activate'}
                                </button>

                                <div className="flex gap-2">
                                    <button onClick={() => openModal(banner)} className="p-2 text-gray-500 hover:text-blue-600 transition-colors">
                                        <Edit2 size={18} />
                                    </button>
                                    <button onClick={() => handleDelete(banner.id)} className="p-2 text-gray-500 hover:text-red-600 transition-colors">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {banners.length === 0 && (
                        <div className="col-span-full text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
                            <p className="text-gray-500">No hero banners found. Create one to display on the homepage.</p>
                        </div>
                    )}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
                            <h2 className="text-2xl font-bold font-puma">{editingBanner ? 'Edit Banner' : 'New Banner'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-black">
                                <XCircle size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Subtitle</label>
                                    <input
                                        type="text"
                                        name="subtitle"
                                        value={formData.subtitle}
                                        onChange={handleInputChange}
                                        required
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Display Order (0 is first)</label>
                                    <input
                                        type="number"
                                        name="order"
                                        value={formData.order}
                                        onChange={handleInputChange}
                                        required
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Main Title</label>
                                <input
                                    type="text"
                                    name="title"
                                    value={formData.title}
                                    onChange={handleInputChange}
                                    required
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-black focus:border-transparent font-bold uppercase"
                                />
                            </div>

                            <div>
                                <ImageUpload
                                    label="Banner Background Image (16:9 Desktop Ratio Recommended)"
                                    value={formData.image}
                                    onChange={(url) => setFormData(prev => ({ ...prev, image: url }))}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Button Link</label>
                                    <input
                                        type="text"
                                        name="link"
                                        value={formData.link}
                                        onChange={handleInputChange}
                                        required
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Button Text</label>
                                    <input
                                        type="text"
                                        name="button_text"
                                        value={formData.button_text}
                                        onChange={handleInputChange}
                                        required
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-black focus:border-transparent uppercase"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="is_active"
                                    name="is_active"
                                    checked={formData.is_active}
                                    onChange={handleInputChange}
                                    className="w-4 h-4 text-black focus:ring-black border-gray-300 rounded"
                                />
                                <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                                    Active (Visible on homepage)
                                </label>
                            </div>

                            <div className="pt-6 flex justify-end gap-3 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 font-medium"
                                >
                                    {editingBanner ? 'Update Banner' : 'Create Banner'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminHeroBanners;
