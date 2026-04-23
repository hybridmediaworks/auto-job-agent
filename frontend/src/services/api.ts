/**
 * API client for Auto Job Agent backend
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  User,
  Job,
  JobListResponse,
  JobProvider,
  FetchJobsRequest,
  DashboardStats,
  Summary,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  Profile,
  ResumeData,
  TailoredApplication,
  SavedSearch,
  SavedSearchCreate,
} from '@/types';

// Base API URL - defaults to proxy in dev, can be configured for production
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Axios instance with default configuration.
 *
 * withCredentials: true — required so the browser sends the HttpOnly auth
 * cookie on every request and the backend can set/clear it via Set-Cookie.
 * Without this flag, cookies are silently dropped on cross-origin requests.
 */
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,
  withCredentials: true,  // send & receive HttpOnly cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Response interceptor — redirect to /login only after confirming the session
 * is truly gone via /auth/me. This prevents false logouts caused by:
 *   - Transient 401s during backend restarts/deploys
 *   - Individual endpoints returning 401 for non-auth reasons
 */
let _redirecting = false

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (
      error.response?.status === 401 &&
      !_redirecting &&
      !window.location.pathname.startsWith('/login') &&
      !window.location.pathname.startsWith('/signup') &&
      !window.location.pathname.startsWith('/forgot-password') &&
      !window.location.pathname.startsWith('/reset-password') &&
      !window.location.pathname.startsWith('/verify-email')
    ) {
      // Don't re-check if the failing request was already /auth/me
      const url = (error.config?.url ?? '')
      if (url.includes('/auth/me') || url.includes('/auth/login')) {
        // /auth/me itself returned 401 — session is definitely gone
        _redirecting = true
        window.history.replaceState(null, '', '/login')
        window.dispatchEvent(new PopStateEvent('popstate'))
        setTimeout(() => { _redirecting = false }, 3000)
      } else {
        // Some other endpoint returned 401 — verify session is actually dead
        try {
          await apiClient.get('/auth/me')
          // Session still valid — ignore this 401 (transient error)
        } catch (meError: any) {
          if (meError?.response?.status === 401) {
            // Confirmed: session is gone
            _redirecting = true
            window.history.replaceState(null, '', '/login')
            window.dispatchEvent(new PopStateEvent('popstate'))
            setTimeout(() => { _redirecting = false }, 3000)
          }
        }
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Authentication API
 */
export const authApi = {
  /**
   * Login — backend sets HttpOnly cookie; response body contains user info.
   */
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>('/auth/login-json', credentials);
    return response.data;
  },

  /**
   * Register a new account. Email verification required before login.
   */
  register: async (data: RegisterRequest): Promise<RegisterResponse> => {
    const response = await apiClient.post<RegisterResponse>('/auth/register', data);
    return response.data;
  },

  /**
   * Verify email using the token from the link in the verification email.
   */
  verifyEmail: async (token: string): Promise<{ message: string }> => {
    const response = await apiClient.get<{ message: string }>(`/auth/verify-email?token=${token}`);
    return response.data;
  },

  /**
   * Resend verification email.
   */
  resendVerification: async (email: string): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>('/auth/resend-verification', { email });
    return response.data;
  },

  /**
   * Logout — clears the HttpOnly cookie on the backend.
   */
  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await apiClient.get<User>('/auth/me');
    return response.data;
  },

  /**
   * Request a password reset email. Always returns the same message
   * regardless of whether the email is registered.
   */
  forgotPassword: async (email: string): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>('/auth/forgot-password', { email });
    return response.data;
  },

  /**
   * Set a new password using the token from the reset email.
   */
  resetPassword: async (token: string, new_password: string, confirm_password: string): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>('/auth/reset-password', { token, new_password, confirm_password });
    return response.data;
  },
};

/**
 * Jobs API
 */
export const jobsApi = {
  list: async (params?: {
    page?: number;
    page_size?: number;
    provider?: string;
    status?: string;
    remote_type?: string;
    location?: string;
    search?: string;
    today_only?: boolean;
    date_from?: string;
    date_to?: string;
  }): Promise<JobListResponse> => {
    const response = await apiClient.get<JobListResponse>('/jobs', { params });
    return response.data;
  },

  get: async (id: number): Promise<Job> => {
    const response = await apiClient.get<Job>(`/jobs/${id}`);
    return response.data;
  },

  update: async (id: number, data: Partial<Job>): Promise<Job> => {
    const response = await apiClient.patch<Job>(`/jobs/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/jobs/${id}`);
  },

  deleteMultiple: async (ids: number[]): Promise<void> => {
    await apiClient.delete('/jobs', { data: { job_ids: ids } });
  },
};

/**
 * Providers API
 */
export const providersApi = {
  list: async (): Promise<{ providers: JobProvider[] }> => {
    const response = await apiClient.get<{ providers: JobProvider[] }>('/providers/list');
    return response.data;
  },

  fetchJobs: async (request: FetchJobsRequest, signal?: AbortSignal): Promise<{
    message: string;
    new_jobs: number;
    duplicate_jobs: number;
    total_fetched: number;
    provider_errors: Array<{ provider: string; error_type: string; message: string }>;
  }> => {
    const response = await apiClient.post('/providers/fetch', request, { signal });
    return response.data;
  },
};

/**
 * Statistics API
 */
export const statsApi = {
  dashboard: async (): Promise<DashboardStats> => {
    const response = await apiClient.get<DashboardStats>('/stats/dashboard');
    return response.data;
  },

  trends: async (days: number = 30): Promise<any> => {
    const response = await apiClient.get('/stats/trends', { params: { days } });
    return response.data;
  },

  summary: async (): Promise<Summary> => {
    const response = await apiClient.get<Summary>('/stats/summary');
    return response.data;
  },
};

/**
 * Settings API
 */
export interface AppSetting {
  key: string;
  value: string | null;
  has_value: boolean;
  description: string;
  source: 'database' | 'env' | 'not_set';
}

export const settingsApi = {
  list: async (): Promise<AppSetting[]> => {
    const response = await apiClient.get<AppSetting[]>('/settings');
    return response.data;
  },

  update: async (key: string, value: string): Promise<AppSetting> => {
    const response = await apiClient.put<AppSetting>(`/settings/${key}`, { value });
    return response.data;
  },
};

/**
 * Profiles API
 */
export const profilesApi = {
  list: async (): Promise<Profile[]> => {
    const response = await apiClient.get<Profile[]>('/profiles');
    return response.data;
  },

  get: async (id: number): Promise<Profile> => {
    const response = await apiClient.get<Profile>(`/profiles/${id}`);
    return response.data;
  },

  create: async (data: { name: string; is_default?: boolean; profile_data?: object; resume_data?: object }): Promise<Profile> => {
    const response = await apiClient.post<Profile>('/profiles', data);
    return response.data;
  },

  update: async (id: number, data: Partial<{ name: string; is_default: boolean; profile_data: object; resume_data: object }>): Promise<Profile> => {
    const response = await apiClient.put<Profile>(`/profiles/${id}`, data);
    return response.data;
  },

  setDefault: async (id: number): Promise<Profile> => {
    const response = await apiClient.post<Profile>(`/profiles/${id}/set-default`);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/profiles/${id}`);
  },

  parseResume: async (file: File): Promise<ResumeData> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post<ResumeData>('/profiles/parse-resume', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};

/**
 * Tailor API
 */
export const tailorApi = {
  generate: async (jobId: number, profileId?: number, customPrompt?: string, templateId?: number): Promise<TailoredApplication> => {
    const response = await apiClient.post<TailoredApplication>(`/jobs/${jobId}/tailor`, {
      profile_id: profileId ?? null,
      custom_prompt: customPrompt || null,
      template_id: templateId ?? null,
    });
    return response.data;
  },

  generatePreview: async (jobId: number, profileId?: number, customPrompt?: string, templateId?: number): Promise<TailoredApplication> => {
    const response = await apiClient.post<TailoredApplication>(`/jobs/${jobId}/tailor`, {
      profile_id: profileId ?? null,
      custom_prompt: customPrompt || null,
      template_id: templateId ?? null,
    }, { params: { preview: true } });
    return response.data;
  },

  save: async (jobId: number, data: TailoredApplication): Promise<TailoredApplication> => {
    const response = await apiClient.post<TailoredApplication>(`/jobs/${jobId}/tailor/save`, {
      profile_id: data.profile_id,
      tailored_resume_text: data.tailored_resume_text,
      tailored_resume_data: data.tailored_resume_data,
      cover_letter: data.cover_letter,
      fit_score: data.fit_score,
      keywords_matched: data.keywords_matched,
      keywords_missing: data.keywords_missing,
      template_id: data.template_id,
    });
    return response.data;
  },

  getLast: async (jobId: number, profileId?: number): Promise<TailoredApplication | null> => {
    const params = profileId ? { profile_id: profileId } : {};
    const response = await apiClient.get<TailoredApplication | null>(`/jobs/${jobId}/tailor`, { params });
    return response.data;
  },
};

/**
 * Saved Searches API
 */
export const savedSearchesApi = {
  list: async (): Promise<SavedSearch[]> => {
    const response = await apiClient.get<SavedSearch[]>('/saved-searches');
    return response.data;
  },

  create: async (data: SavedSearchCreate): Promise<SavedSearch> => {
    const response = await apiClient.post<SavedSearch>('/saved-searches', data);
    return response.data;
  },

  update: async (id: number, data: Partial<SavedSearchCreate>): Promise<SavedSearch> => {
    const response = await apiClient.put<SavedSearch>(`/saved-searches/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/saved-searches/${id}`);
  },

  runNow: async (id: number): Promise<{ message: string; new_jobs: number; total_fetched: number }> => {
    const response = await apiClient.post<{ message: string; new_jobs: number; total_fetched: number }>(`/saved-searches/${id}/run`);
    return response.data;
  },

  recentJobs: async (id: number) => {
    const response = await apiClient.get(`/saved-searches/${id}/recent-jobs`);
    return response.data as import('@/types').RecentJob[];
  },
};

/**
 * Admin API
 */
export interface AdminUserUpdate {
  is_admin?: boolean;
  can_fetch_jobs?: boolean;
  can_run_saved_search?: boolean;
  can_create_resume?: boolean;
  is_active?: boolean;
}

export const adminApi = {
  listUsers: async (): Promise<User[]> => {
    const response = await apiClient.get<User[]>('/admin/users');
    return response.data;
  },

  updateUser: async (userId: number, data: AdminUserUpdate): Promise<User> => {
    const response = await apiClient.patch<User>(`/admin/users/${userId}`, data);
    return response.data;
  },
};

export default apiClient;
