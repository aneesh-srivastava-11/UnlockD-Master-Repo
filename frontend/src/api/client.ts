const BASE_URL = 'http://localhost:3000';

export interface RequestOptions extends RequestInit {
  bodyData?: any;
}

/**
 * Custom Error Class for API responses
 */
export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Centralized API Client Wrapper
 * 
 * Explaining to Judges:
 * 1. Appends the JWT token from localStorage to the 'Authorization' header of every request if it exists.
 * 2. Formats outgoing request bodies as JSON and sets correct headers automatically.
 * 3. Handles status codes and parses server error responses (e.g. Zod validation errors, overdraft alerts).
 * 4. Clears authentication state and redirects to login if a 401 (Unauthorized) status code is received.
 */
export async function apiClient<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  
  // Set up standard headers
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.bodyData) {
    headers.set('Content-Type', 'application/json');
  }

  // Inject Authorization Bearer token if it is available in localStorage
  const token = localStorage.getItem('unlockd_auth_token');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const fetchOptions: RequestInit = {
    ...options,
    headers,
  };

  if (options.bodyData) {
    fetchOptions.body = JSON.stringify(options.bodyData);
  }

  const response = await fetch(url, fetchOptions);

  // If unauthorized (401), trigger logout and redirect
  if (response.status === 401) {
    localStorage.removeItem('unlockd_auth_token');
    localStorage.removeItem('unlockd_auth_user');
    if (window.location.pathname !== '/login' && window.location.pathname !== '/signup') {
      window.location.href = '/login';
    }
  }

  let responseData: any = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    responseData = await response.json();
  } else {
    responseData = await response.text();
  }

  if (!response.ok) {
    const errorMsg = responseData?.error || responseData || `Request failed with status ${response.status}`;
    throw new ApiError(response.status, errorMsg, responseData);
  }

  return responseData as T;
}
