import apiClient from './client.js';

export const authAPI = {
  /**
   * Register a new user
   */
  register: async (userData) => {
    return apiClient.post('/auth/register', userData);
  },

  /**
   * Login user
   */
  login: async (credentials) => {
    return apiClient.post('/auth/login', credentials);
  },

  /**
   * Get current user profile
   */
  getCurrentUser: async () => {
    return apiClient.get('/auth/me');
  },
};
