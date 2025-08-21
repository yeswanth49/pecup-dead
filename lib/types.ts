// Database entity types for the refactored schema
// These types match the new normalized lookup table design

export interface Branch {
  id: string;
  name: string;
  code: string;
  created_at: string;
}

export interface Year {
  id: string;
  batch_year: number;
  display_name: string;
  created_at: string;
}

export interface Semester {
  id: string;
  semester_number: number;
  year_id: string;
  created_at: string;
  year?: Year;
}

export interface Student {
  id: string;
  roll_number: string;
  name: string;
  email: string;
  branch_id: string;
  year_id: string;
  semester_id: string;
  section?: string;
  created_at: string;
  updated_at: string;
  branch?: Branch;
  year?: Year;
  semester?: Semester;
}

export interface Resource {
  id: string;
  title: string;
  description?: string;
  drive_link: string;
  file_type: string;
  branch_id: string;
  year_id: string;
  semester_id: string;
  uploader_id?: string;
  created_at: string;
  // Legacy fields that might still exist during transition
  category?: string;
  subject?: string;
  unit?: number;
  date?: string;
  is_pdf?: boolean;
  regulation?: string;
  archived?: boolean;
  deleted_at?: string;
  updated_at?: string;
  // Joined relations
  branch?: Branch;
  year?: Year;
  semester?: Semester;
  uploader?: Student;
}

export interface AcademicCalendar {
  id: string;
  current_year_id: string;
  current_semester_id: string;
  last_updated: string;
  updated_by?: string;
  current_year?: Year;
  current_semester?: Semester;
}

// API response types
export interface ResourcesResponse {
  resources: Resource[];
  total?: number;
  page?: number;
  limit?: number;
}

export interface StudentsResponse {
  students: Student[];
  total?: number;
  page?: number;
  limit?: number;
}

export interface BranchesResponse {
  branches: Branch[];
}

export interface YearsResponse {
  years: Year[];
}

export interface SemestersResponse {
  semesters: Semester[];
}

export interface SubjectsResponse {
  subjects: Subject[];
}

export interface AcademicCalendarResponse {
  calendar: AcademicCalendar;
}

// Form data types
export interface ResourceCreateInput {
  title: string;
  description?: string;
  drive_link: string;
  file_type: string;
  branch_id: string;
  year_id: string;
  semester_id: string;
  // Legacy fields for backward compatibility
  category?: string;
  subject?: string;
  unit?: number;
}

export interface ResourceUpdateInput extends Partial<ResourceCreateInput> {
  id: string;
}

export interface StudentCreateInput {
  roll_number: string;
  name: string;
  email: string;
  branch_id: string;
  year_id: string;
  semester_id: string;
  section?: string;
}

export interface StudentUpdateInput extends Partial<StudentCreateInput> {
  id: string;
}

// Legacy types for backward compatibility during migration
export interface LegacyResource {
  id: string;
  category: string;
  subject: string;
  unit: number;
  name: string;
  description?: string;
  date: string;
  type?: string;
  url: string;
  is_pdf: boolean;
  year?: number;
  branch?: string;
  semester?: number;
  created_at?: string;
  updated_at?: string;
}

export interface LegacyProfile {
  id: string;
  email: string;
  name: string;
  year: number;
  branch: string;
  roll_number: string;
  role: 'student' | 'admin' | 'superadmin';
  created_at: string;
  updated_at: string;
}

// Subject types
export type ResourceType = 'resources' | 'records';

export interface Subject {
  id: string;
  code: string;
  name: string;
  full_name?: string;
  default_units: number;
  resource_type: ResourceType;
  created_at: string;
  updated_at: string;
}

export interface SubjectOffering {
  id: string;
  regulation: string;
  branch: string;
  year: number;
  semester: number;
  subject_id: string;
  display_order?: number;
  active: boolean;
  created_at: string;
  updated_at: string;
  subject?: Subject;
}

// Utility types
export type BranchCode = 'CSE' | 'AIML' | 'DS' | 'AI' | 'ECE' | 'EEE' | 'MEC' | 'CE';
export type SemesterNumber = 1 | 2;
export type AdminRole = 'admin' | 'superadmin';
export type UserRole = 'student' | 'admin' | 'superadmin';

// Database query types
export interface ResourceFilters {
  branch_id?: string;
  year_id?: string;
  semester_id?: string;
  uploader_id?: string;
  category?: string;
  subject?: string;
  unit?: number;
  file_type?: string;
  archived?: boolean;
}

export interface StudentFilters {
  branch_id?: string;
  year_id?: string;
  semester_id?: string;
  section?: string;
}

// Migration helper types
export interface MigrationStatus {
  phase: string;
  completed: boolean;
  errors?: string[];
  warnings?: string[];
}

export interface SchemaValidation {
  table: string;
  valid: boolean;
  missing_columns?: string[];
  orphaned_references?: number;
  null_required_fields?: number;
}
