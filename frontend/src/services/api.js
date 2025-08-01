import axios from 'axios';
import { getToken, logout } from '../utils/auth';

// Create axios instance with environment-based URL
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      logout();
    }
    return Promise.reject(error);
  }
);

// Auth API calls
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  googleLogin: (token) => axios.post(`${process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:5000'}/auth/google/verify`, { token }),
  getCurrentUser: () => api.get('/auth/me'),
};

// Agent API calls
export const agentAPI = {
  create: (agentData) => api.post('/agents', agentData),
  getAll: () => api.get('/agents'),
  delete: (id) => api.delete(`/agents/${id}`),
};

// Upload API calls
export const uploadAPI = {
  uploadFile: (formData) => api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: 120000,
  }),
  getDistributions: () => api.get('/upload/distributions'),
};

export default api;
