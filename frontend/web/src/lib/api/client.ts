import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from "axios";
import { ApiResponse, ApiError } from "../../types/api";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";
const API_TIMEOUT = parseInt(
  process.env.NEXT_PUBLIC_API_TIMEOUT || "30000",
  10
);

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor - Add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle responses and errors
apiClient.interceptors.response.use(
  (response) => {
    // Return the data directly for successful responses
    return response.data;
  },
  (error: AxiosError<ApiResponse>) => {
    // Handle specific error cases
    if (error.response) {
      const apiError: ApiError = error.response.data?.error || {
        message: error.response.statusText || "An error occurred",
        code: `HTTP_${error.response.status}`,
      };

      // Handle 401 - Unauthorized
      if (error.response.status === 401) {
        localStorage.removeItem("auth_token");
        // Dispatch logout event
        window.dispatchEvent(new CustomEvent("auth:logout"));
      }

      // Handle 429 - Rate limit
      if (error.response.status === 429) {
        const retryAfter = error.response.headers["x-ratelimit-reset"];
        apiError.details = { retryAfter };
      }

      return Promise.reject(apiError);
    } else if (error.request) {
      // Request made but no response
      return Promise.reject({
        message: "No response from server. Please check your connection.",
        code: "NETWORK_ERROR",
      });
    } else {
      // Request setup error
      return Promise.reject({
        message: error.message || "Failed to make request",
        code: "REQUEST_ERROR",
      });
    }
  }
);

export default apiClient;

// Helper function for GET requests
export const get = <T = any>(
  url: string,
  config?: AxiosRequestConfig
): Promise<ApiResponse<T>> => {
  return apiClient.get(url, config);
};

// Helper function for POST requests
export const post = <T = any>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig
): Promise<ApiResponse<T>> => {
  return apiClient.post(url, data, config);
};

// Helper function for PUT requests
export const put = <T = any>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig
): Promise<ApiResponse<T>> => {
  return apiClient.put(url, data, config);
};

// Helper function for PATCH requests
export const patch = <T = any>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig
): Promise<ApiResponse<T>> => {
  return apiClient.patch(url, data, config);
};

// Helper function for DELETE requests
export const del = <T = any>(
  url: string,
  config?: AxiosRequestConfig
): Promise<ApiResponse<T>> => {
  return apiClient.delete(url, config);
};

// Set auth token
export const setAuthToken = (token: string) => {
  localStorage.setItem("auth_token", token);
};

// Clear auth token
export const clearAuthToken = () => {
  localStorage.removeItem("auth_token");
};

// Get auth token
export const getAuthToken = (): string | null => {
  return localStorage.getItem("auth_token");
};
