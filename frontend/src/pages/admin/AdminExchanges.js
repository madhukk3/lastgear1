import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { RefreshCcw, CheckCircle, XCircle, Search, ExternalLink } from 'lucide-react';

const AdminExchanges = () => {
    const [exchanges, setExchanges] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('pending'); // pending, approved, completed, all

    const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
    const API = `${BACKEND_URL}/api`;

    useEffect(() => {
        fetchExchanges();
    }, []);

    const fetchExchanges = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${API}/admin/exchanges`);
            setExchanges(response.data);
        } catch (error) {
            console.error('Failed to fetch exchanges:', error);
            toast.error('Failed to load exchange requests');
        } finally {
            setLoading(false);
        }
    };

    const approveExchange = async (requestId) => {
        if (!window.confirm("Approve this exchange? The customer will be requested to ship the item back.")) return;
        try {
            await axios.patch(`${API}/admin/exchanges/${requestId}/approve`);
            toast.success('Exchange approved');
            fetchExchanges();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to approve exchange');
        }
    };

    const rejectExchange = async (requestId) => {
        if (!window.confirm("Reject this exchange request?")) return;
        try {
            await axios.patch(`${API}/admin/exchanges/${requestId}/reject`);
            toast.success('Exchange rejected');
            fetchExchanges();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to reject exchange');
        }
    };

    // The exchange 'Complete' capability is now intercepted organically via the chronological order state machine in AdminOrders

    const displayExchanges = exchanges.filter(exc => {
        // Tab filter
        if (activeTab !== 'all' && exc.status !== activeTab) return false;

        // Search filter
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return exc.order_id.toLowerCase().includes(q) ||
            exc.customer_name.toLowerCase().includes(q) ||
            exc.request_id.toLowerCase().includes(q);
    });

    return (
        <div data-testid="admin-exchanges">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-black italic uppercase tracking-wider flex items-center gap-3">
                    <RefreshCcw className="text-[#ff003c]" /> Exchange Hub
                </h1>
                <button onClick={fetchExchanges} className="text-sm font-bold bg-gray-200 hover:bg-gray-300 transition-colors px-4 py-2 rounded-lg flex items-center gap-2">
                    <RefreshCcw size={16} /> Refresh
                </button>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div className="flex flex-wrap gap-2">
                    {['pending', 'approved', 'completed', 'all'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 font-bold rounded-lg capitalize text-sm ${activeTab === tab ? 'bg-black text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                        >
                            {tab}
                            {tab === 'pending' && exchanges.filter(e => e.status === 'pending').length > 0 && (
                                <span className="ml-2 bg-red-600 text-white px-2 py-0.5 rounded-full text-xs">
                                    {exchanges.filter(e => e.status === 'pending').length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
                <div className="w-full md:w-80 relative">
                    <input
                        type="text"
                        placeholder="Search Order ID, Request ID, Name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 pl-10 outline-none focus:border-black transition-colors"
                    />
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                </div>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden overflow-x-auto border border-gray-200">
                <table className="w-full min-w-[1000px]">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Exchange ID</th>
                            <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Customer</th>
                            <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Product Info</th>
                            <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Reason</th>
                            <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? (
                            <tr><td colSpan="7" className="text-center py-8 text-gray-500 font-mono">Loading records...</td></tr>
                        ) : displayExchanges.length === 0 ? (
                            <tr><td colSpan="7" className="text-center py-12 text-gray-500 font-mono">No exchange requests found.</td></tr>
                        ) : displayExchanges.map((exc) => (
                            <tr key={exc.request_id} className={`hover:bg-gray-50 transition-colors ${exc.status === 'pending' ? 'bg-red-50/50' : ''}`}>
                                <td className="px-6 py-4 text-sm font-mono whitespace-nowrap">
                                    <div className="font-bold text-black">{exc.request_id}</div>
                                    <div className="text-gray-500 text-xs">Ord: {exc.order_id}</div>
                                </td>
                                <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-600">
                                    {format(new Date(exc.request_time), 'MMM dd, yyyy HH:mm')}
                                </td>
                                <td className="px-6 py-4 text-sm">
                                    <div className="font-bold">{exc.customer_name}</div>
                                    <div className="text-xs text-gray-500">{exc.customer_email}</div>
                                    <div className="text-xs text-gray-500">{exc.phone_number}</div>
                                </td>
                                <td className="px-6 py-4 text-sm">
                                    <div className="font-medium text-black max-w-[200px] truncate" title={exc.product_name}>{exc.product_name}</div>
                                    <div className="flex gap-2 items-center mt-1 text-xs font-mono">
                                        <span className="bg-gray-200 px-1.5 py-0.5 rounded text-gray-600 line-through decoration-red-500">Sz: {exc.size_purchased}</span>
                                        <span>→</span>
                                        <span className="bg-green-100 text-green-800 px-1.5 py-0.5 rounded font-bold border border-green-200">Sz: {exc.size_requested}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm max-w-[200px]">
                                    <div className="font-bold text-red-600 mb-1">{exc.reason}</div>
                                    {exc.image_url && (
                                        <a href={exc.image_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-blue-600 hover:underline uppercase font-bold tracking-wider">
                                            <ExternalLink size={12} /> View Defect Image
                                        </a>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${exc.status === 'pending' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                                        exc.status === 'approved' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                                            exc.status === 'completed' ? 'bg-green-100 text-green-800 border border-green-200' :
                                                'bg-red-100 text-red-800 border border-red-200'
                                        }`}>
                                        {exc.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex gap-3">
                                        {exc.status === 'pending' && (
                                            <>
                                                <button onClick={() => approveExchange(exc.request_id)} className="text-sm text-green-600 hover:text-green-800 font-bold uppercase tracking-wide flex items-center gap-1"><CheckCircle size={16} /> Approve</button>
                                                <button onClick={() => rejectExchange(exc.request_id)} className="text-sm text-red-600 hover:text-red-800 font-bold uppercase tracking-wide flex items-center gap-1"><XCircle size={16} /> Reject</button>
                                            </>
                                        )}
                                        {exc.status === 'approved' && (
                                            <span className="text-[10px] bg-gray-100 text-gray-500 font-bold uppercase tracking-widest px-2 py-1 rounded border border-gray-200">
                                                Update Flow in Orders Tab
                                            </span>
                                        )}
                                        {exc.status === 'completed' && <span className="text-xs text-gray-400 font-mono">ACTION FINISHED</span>}
                                        {exc.status === 'rejected' && <span className="text-xs text-red-400 font-mono">DENIED</span>}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminExchanges;
