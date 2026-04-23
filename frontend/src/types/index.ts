/**
 * Type definitions for Hybrid Job Agent
 */

export enum ApplicationStatus {
  DISCOVERED = "DISCOVERED",
  BOOKMARKED = "BOOKMARKED",
  APPLIED = "APPLIED",
  SCREENING = "SCREENING",
  INTERVIEW = "INTERVIEW",
  OFFERED = "OFFERED",
  HIRED = "HIRED",
  REJECTED = "REJECTED",
  CLOSED = "CLOSED",
  SKIPPED = "SKIPPED",
}

/** Ordered pipeline stages for display */
export const PIPELINE_STAGES: ApplicationStatus[] = [
  ApplicationStatus.DISCOVERED,
  ApplicationStatus.BOOKMARKED,
  ApplicationStatus.APPLIED,
  ApplicationStatus.SCREENING,
  ApplicationStatus.INTERVIEW,
  ApplicationStatus.OFFERED,
  ApplicationStatus.HIRED,
];

/** Terminal / negative statuses */
export const TERMINAL_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.REJECTED,
  ApplicationStatus.CLOSED,
  ApplicationStatus.SKIPPED,
];

export interface User {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
  is_admin: boolean;
  can_fetch_jobs: boolean;
  can_run_saved_search: boolean;
  can_create_resume: boolean;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: number;
  title: string;
  company: string;
  location: string | null;
  url: string;
  provider: string;
  source_job_id: string | null;
  status: ApplicationStatus;
  description: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  job_type: string | null;
  remote_type: string | null;
  posted_date: string | null;
  easy_apply: boolean;
  resume_path: string | null;
  error_message: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  applied_at: string | null;
}

export interface JobListResponse {
  total: number;
  page: number;
  page_size: number;
  jobs: Job[];
}

export interface JobProvider {
  name: string;
  display_name: string;
  is_active: boolean;
}

export interface FetchJobsRequest {
  providers: string[];
  query: string;
  location: string;
  locality?: string;
  remote_only: boolean;
  limit: number;
  max_age_days?: number;
}

export interface DashboardStats {
  total_jobs: number;
  jobs_by_status: Record<ApplicationStatus, number>;
  jobs_by_provider: Record<string, number>;
  jobs_fetched_today: number;
  recent_jobs: Array<{
    id: number;
    title: string;
    company: string;
    provider: string;
    status: ApplicationStatus;
    location: string | null;
    description: string | null;
    salary_min: number | null;
    salary_max: number | null;
    salary_currency: string;
    job_type: string | null;
    remote_type: string | null;
    posted_date: string | null;
    easy_apply: boolean;
    url: string;
    created_at: string;
  }>;
}

export interface Summary {
  total_jobs: number;
  discovered: number;
  applied: number;
  interview: number;
  offered: number;
  hired: number;
  skipped: number;
  remote_jobs: number;
  remote_percentage: number;
  avg_salary_min: number | null;
  avg_salary_max: number | null;
}

export interface LoginRequest {
  identifier: string;  // username or email
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface LoginResponse {
  message: string;
  user: User;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  confirm_password: string;
}

export interface RegisterResponse {
  message: string;
  username: string;
}

// ── Profile types ─────────────────────────────────────────────────────────────

export interface ResumeExperience {
  title: string;
  company: string;
  location?: string;
  start_date: string;
  end_date: string;
  bullets: string[];
}

export interface ResumeEducation {
  degree: string;
  institution: string;
  location?: string;
  start_date?: string;
  graduation: string;
}

export interface ResumeLanguage {
  name: string;
  level: string;
  proficiency: number; // 1-5
}

export interface ResumeProject {
  name: string;
  start_date?: string;
  end_date?: string;
  description?: string;
  bullets: string[];
}

export interface ResumeData {
  name: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  photo?: string;
  summary: string;
  experience: ResumeExperience[];
  education: ResumeEducation[];
  skills: Record<string, string[]>;
  key_achievements?: string[];
  languages?: ResumeLanguage[];
  projects?: ResumeProject[];
}

export interface ProfileData {
  personal?: Record<string, string | boolean>;
  work_authorization?: Record<string, string | boolean>;
  experience?: Record<string, number | string>;
  education?: Record<string, string | number>;
  salary?: Record<string, number | string | boolean>;
  availability?: Record<string, string | boolean | number>;
  screening_defaults?: Record<string, string | boolean>;
}

export interface Profile {
  id: number;
  name: string;
  is_default: boolean;
  profile_data: ProfileData | null;
  resume_data: ResumeData | null;
  created_at: string;
  updated_at: string;
}

// ── SavedSearch types ─────────────────────────────────────────────────────────

export interface SavedSearch {
  id: number;
  name: string;
  query: string;
  location: string;
  locality: string;
  providers: string[];
  remote_only: boolean;
  limit: number;
  is_active: boolean;
  interval_hours: number;
  max_age_days: number | null;
  last_run_at: string | null;
  last_new_jobs: number;
  last_error: string | null;
  created_at: string;
}

export interface RecentJob {
  id: number;
  title: string;
  company: string;
  provider: string;
  url: string;
  location: string | null;
  posted_date: string | null;
  created_at: string;
}

export interface SavedSearchCreate {
  name: string;
  query: string;
  location: string;
  locality: string;
  providers: string[];
  remote_only: boolean;
  limit: number;
  interval_hours: number;
  is_active: boolean;
  max_age_days?: number | null;
}

// ── Tailoring types ───────────────────────────────────────────────────────────

export interface TailoredApplication {
  id: number;
  job_id: number;
  profile_id: number;
  profile_name: string;
  tailored_resume_text: string | null;
  tailored_resume_data: Record<string, any> | null;
  cover_letter: string | null;
  fit_score: number | null;
  keywords_matched: string[];
  keywords_missing: string[];
  template_id: number | null;
  created_at: string;
  updated_at: string;
}
