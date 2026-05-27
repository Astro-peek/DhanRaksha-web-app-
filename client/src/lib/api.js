import axios from 'axios';
import { supabase } from './supabase';
import { toast } from 'react-hot-toast';
import useAuthStore from '../store/authStore';
import { getErrorMessage } from './utils';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach JWT Token from authStore
api.interceptors.request.use(
  (config) => {
    const session = useAuthStore.getState().session;
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Global Error Handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const message = getErrorMessage(error, 'A critical server error occurred. Please try again later.');

    if (status === 401) {
      console.warn('Unauthorized access (401). Redirecting to login.');
      // Safely sign out the user locally and clear authStore
      useAuthStore.getState().clearAuth();
      await supabase.auth.signOut();
      
      // Prevent infinite redirect loops if we are already on /login
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    } else if (status === 429) {
      toast.error('Too many requests. Please slow down and try again.', {
        id: 'api-rate-limit',
        duration: 4000,
      });
    } else if (status >= 500) {
      toast.error(message, {
        id: 'api-server-error',
        duration: 5000,
      });
    }

    return Promise.reject(error);
  }
);

export default api;
