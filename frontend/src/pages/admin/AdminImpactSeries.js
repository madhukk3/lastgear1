import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, CheckCircle, XCircle } from 'lucide-react';
import ImageUpload from '../../components/ImageUpload';

const AdminImpactSeries = () => {
    const [seriesList, setSeriesList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSeries, setEditingSeries] = useState(null);

    const [formData, setFormData] = useState({
        edition: '',
        title: '',
        subtitle: '',
        description: '',
        image: '',
        link: '',
        is_active: false
    });

    const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
    const API = `${BACKEND_URL}/api`;

    useEffect(() => {
        fetchSeries();
    }, []);

    const fetchSeries = async () => {
        try {
            const response = await axios.get(`${API}/admin/impact-series`, {
                withCredentials: true
            });
            setSeriesList(response.data);
        } catch (error) {
            toast.error('Failed to fetch Impact Series');
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
            if (editingSeries) {
                await axios.put(`${API}/admin/impact-series/${editingSeries.id}`, formData, {
                    withCredentials: true
                });
                toast.success('Series updated successfully');
            } else {
                await axios.post(`${API}/admin/impact-series`, formData, {
                    withCredentials: true
                });
                toast.success('Series created successfully');
            }
            setIsModalOpen(false);
            fetchSeries();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Operation failed');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this series?')) {
            try {
                await axios.delete(`${API}/admin/impact-series/${id}`, {
                    withCredentials: true
                });
                toast.success('Series deleted');
                fetchSeries();
            } catch (error) {
                toast.error('Failed to delete series');
            }
        }
    };

    const handleActivate = async (id) => {
        try {
            await axios.post(`${API}/admin/impact-series/${id}/activate`, {}, {
                withCredentials: true
            });
            toast.success('Series activated successfully');
            fetchSeries();
        } catch (error) {
            toast.error('Failed to activate series');
        }
    };

    const openModal = (series = null) => {
        if (series) {
            setEditingSeries(series);
            setFormData({
                edition: series.edition,
                title: series.title,
                subtitle: series.subtitle,
                description: series.description,
                image: series.image,
                link: series.link,
                is_active: series.is_active
            });
        } else {
            setEditingSeries(null);
            setFormData({
                edition: '',
                title: '',
                subtitle: 'IMPACT SERIES',
                description: '',
                image: '',
                link: '/products',
                is_active: false
            });
        }
        setIsModalOpen(true);
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold font-puma">Impact Series Management</h1>
                <button
                    onClick={() => openModal()}
                    className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
                >
                    <Plus size={20} />
                    <span>New Series</span>
                </button>
            </div>

            {loading ? (
                <div className="text-center py-12">Loading...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {seriesList.map((series) => (
                        <div key={series.id} className={`bg-white rounded-xl shadow-sm border ${series.is_active ? 'border-green-500' : 'border-gray-200'} overflow-hidden`}>
                            <div className="h-48 relative">
                                <img src={series.image} alt={series.title} className="w-full h-full object-cover" />
                                {series.is_active && (
                                    <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                                        <CheckCircle size={14} /> ACTIVE
                                    </div>
                                )}
                            </div>
                            <div className="p-5">
                                <div className="text-xs text-gray-500 font-bold tracking-wider mb-1">EDITION {series.edition}</div>
                                <h3 className="text-xl font-bold mb-2 truncate">{series.title}</h3>
                                <p className="text-gray-600 text-sm line-clamp-2 mb-4">{series.description}</p>

                                <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                                    {!series.is_active ? (
                                        <button
                                            onClick={() => handleActivate(series.id)}
                                            className="text-sm font-medium text-green-600 hover:text-green-800"
                                        >
                                            Set as Active
                                        </button>
                                    ) : (
                                        <span className="text-sm text-gray-400">Currently Displaying</span>
                                    )}

                                    <div className="flex gap-2">
                                        <button onClick={() => openModal(series)} className="p-2 text-gray-500 hover:text-blue-600 transition-colors">
                                            <Edit2 size={18} />
                                        </button>
                                        <button onClick={() => handleDelete(series.id)} className="p-2 text-gray-500 hover:text-red-600 transition-colors">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}

                    {seriesList.length === 0 && (
                        <div className="col-span-full text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
                            <p className="text-gray-500">No impact series found. Create one to display on the homepage.</p>
                        </div>
                    )}
                </div>
            )}

            {/* Modal / Slide-over for Create/Edit could go here. For brevity, using standard conditional rendering */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white">
                            <h2 className="text-2xl font-bold font-puma">{editingSeries ? 'Edit Series' : 'New Series'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-black">
                                <XCircle size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Edition (e.g. 01)</label>
                                    <input
                                        type="text"
                                        name="edition"
                                        value={formData.edition}
                                        onChange={handleInputChange}
                                        required
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                                    />
                                </div>
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
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                                <input
                                    type="text"
                                    name="title"
                                    value={formData.title}
                                    onChange={handleInputChange}
                                    required
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description (Supports multiple lines)</label>
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleInputChange}
                                    required
                                    rows="3"
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                                ></textarea>
                            </div>

                            <div>
                                <ImageUpload
                                    label="Image (High-resolution recommended)"
                                    value={formData.image}
                                    onChange={(url) => setFormData(prev => ({ ...prev, image: url }))}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Button Link (e.g. /products?category=t-shirts)</label>
                                <input
                                    type="text"
                                    name="link"
                                    value={formData.link}
                                    onChange={handleInputChange}
                                    required
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                                />
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
                                    Set as Active Series (will automatically deactivate the current one)
                                </label>
                            </div>

                            <div className="pt-6 flex justify-end gap-3 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 tracking-wide font-medium"
                                >
                                    {editingSeries ? 'Update Series' : 'Create Series'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminImpactSeries;
