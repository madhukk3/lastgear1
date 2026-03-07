import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import AdminLayout from '../../components/AdminLayout';
import { toast } from 'sonner';

const AdminLogs = () => {
  const [adminLogs, setAdminLogs] = useState([]);
  const [securityLogs, setSecurityLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('admin');
  const [loading, setLoading] = useState(true);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  const API = `${BACKEND_URL}/api`;

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const [adminRes, securityRes] = await Promise.all([
        axios.get(`${API}/admin/logs/admin-actions`),
        axios.get(`${API}/admin/logs/security`)
      ]);
      setAdminLogs(adminRes.data);
      setSecurityLogs(securityRes.data);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      toast.error('Failed to load logs');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div data-testid="admin-logs">
        <h1 className="text-3xl font-bold mb-8">Audit Logs</h1>

        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab('admin')}
            className={`px-6 py-2 rounded-lg font-medium ${
              activeTab === 'admin' ? 'bg-black text-white' : 'bg-gray-200'
            }`}
          >
            Admin Actions ({adminLogs.length})
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`px-6 py-2 rounded-lg font-medium ${
              activeTab === 'security' ? 'bg-black text-white' : 'bg-gray-200'
            }`}
          >
            Security Events ({securityLogs.length})
          </button>
        </div>

        {/* Logs Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {activeTab === 'admin' ? 'Admin' : 'Event Type'}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {activeTab === 'admin' ? 'Action' : 'User'}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {activeTab === 'admin' ? (
                adminLogs.map((log, idx) => (
                  <tr key={idx}>
                    <td className="px-6 py-4 text-sm">{format(new Date(log.timestamp), 'MMM dd, yyyy HH:mm:ss')}</td>
                    <td className="px-6 py-4 text-sm">{log.admin_email}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{log.target || 'N/A'}</td>
                  </tr>
                ))
              ) : (
                securityLogs.map((log, idx) => (
                  <tr key={idx}>
                    <td className="px-6 py-4 text-sm">{format(new Date(log.timestamp), 'MMM dd, yyyy HH:mm:ss')}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">
                        {log.event_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">{log.user_id || 'Anonymous'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {JSON.stringify(log.details).slice(0, 50)}...
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminLogs;