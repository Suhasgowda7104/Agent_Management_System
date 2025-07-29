import React, { useState, useEffect } from 'react';
import { uploadAPI } from '../services/api';

const DistributedLists = () => {
  const [distributions, setDistributions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedItems, setExpandedItems] = useState({});

  useEffect(() => {
    fetchDistributions();
  }, []);

  const fetchDistributions = async () => {
    try {
      setLoading(true);
      const response = await uploadAPI.getDistributions();
      setDistributions(response.data.distributions || []);
      setError('');
    } catch (error) {
      console.error('Error fetching distributions:', error);
      setError('Failed to fetch distributed lists');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (distributionId) => {
    setExpandedItems(prev => ({
      ...prev,
      [distributionId]: !prev[distributionId]
    }));
  };

  // Helper function to safely get agent name
  const getAgentName = (agent) => {
    return agent?.name || 'Unknown Agent';
  };

  // Helper function to safely get agent email
  const getAgentEmail = (agent) => {
    return agent?.email || 'Unknown Email';
  };

  const groupedDistributions = distributions.reduce((acc, dist) => {
    const key = `${dist.fileName}-${new Date(dist.uploadDate).toDateString()}`;
    if (!acc[key]) {
      acc[key] = {
        fileName: dist.fileName,
        uploadDate: dist.uploadDate,
        distributions: []
      };
    }
    acc[key].distributions.push(dist);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">Loading distributed lists...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="text-center">
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              <p>{error}</p>
            </div>
            <button
              onClick={fetchDistributions}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Distributed Lists
          </h3>
          
          {Object.keys(groupedDistributions).length === 0 ? (
            <div className="text-center py-8">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No distributions found</h3>
              <p className="mt-1 text-sm text-gray-500">
                Upload a CSV/Excel file to see distributed lists here.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedDistributions).map(([key, group]) => (
                <div key={key} className="border border-gray-200 rounded-lg p-4">
                  <div className="mb-4">
                    <h4 className="text-md font-medium text-gray-900">
                      {group.fileName || 'Unknown File'}
                    </h4>
                    <p className="text-sm text-gray-500">
                      Uploaded on {new Date(group.uploadDate).toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-500">
                      Total agents: {group.distributions?.length || 0} | 
                      Total items: {group.distributions?.reduce((sum, d) => sum + (d.items?.length || 0), 0) || 0}
                    </p>
                  </div>
                  
                  <div className="space-y-4">
                    {group.distributions?.map((distribution) => (
                      <div key={distribution._id} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-2">
                          <div>
                            <h5 className="font-medium text-gray-900">
                              {getAgentName(distribution.agent)}
                            </h5>
                            <p className="text-sm text-gray-600">
                              {getAgentEmail(distribution.agent)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {distribution.items?.length || 0} items assigned
                            </p>
                          </div>
                          <button
                            onClick={() => toggleExpanded(distribution._id)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            {expandedItems[distribution._id] ? 'Hide Items' : 'View Items'}
                          </button>
                        </div>
                        
                        {expandedItems[distribution._id] && (
                          <div className="mt-4">
                            {distribution.items?.length > 0 ? (
                              <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                  <thead className="bg-gray-100">
                                    <tr>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        #
                                      </th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        First Name
                                      </th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Phone
                                      </th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Notes
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-gray-200">
                                    {distribution.items.map((item, index) => (
                                      <tr key={index}>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                          {index + 1}
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                                          {item?.firstName || 'N/A'}
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                          {item?.phone || 'N/A'}
                                        </td>
                                        <td className="px-4 py-2 text-sm text-gray-500">
                                          {item?.notes || '-'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500 text-center py-4">
                                No items found for this agent
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )) || (
                      <p className="text-sm text-gray-500 text-center py-4">
                        No distributions found
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DistributedLists;
