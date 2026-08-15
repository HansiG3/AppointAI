import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add JWT token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('appointai_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    // Handle 401 (unauthorized) - clear auth and redirect to login
    if (error.response?.status === 401) {
      localStorage.removeItem('appointai_token');
      localStorage.removeItem('appointai_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    // Extract error message from response
    const errorMessage =
      error.response?.data?.message ||
      error.message ||
      'An unexpected error occurred';

    return Promise.reject({
      message: errorMessage,
      status: error.response?.status,
      errorCode: error.response?.data?.errorCode,
      errors: error.response?.data?.errors,
    });
  }
);

export default apiClient;
