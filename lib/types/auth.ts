import { UserRole, UserPermissions } from '@/lib/types'

export interface UserContext {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  year?: number;
  branch?: string;
  branchId?: string;
  yearId?: string;
  semesterId?: string;
  representatives?: Representative[];
  representativeAssignments?: Array<{
    branch_id: string;
    year_id: string;
    branch_code: string;
    admission_year: number;
  }>;
}

export interface AdminContext {
  email: string;
  role: 'admin' | 'superadmin';
}

// Relation types for reuse
export interface Branch {
  id: string;
  name: string;
  code: string;
}

export interface Year {
  id: string;
  batch_year: number;
  display_name: string;
}

export interface Semester {
  id: string;
  semester_number: number;
}

export interface RepresentativeBase {
  id: string;
  user_id: string;
  branch_id: string;
  year_id: string;
  assigned_by: string;
  assigned_at: string;
  active: boolean;
}

export interface RepresentativeWithRelations extends RepresentativeBase {
  branch?: Branch;
  year?: Year;
}

// Keep for backward compatibility - represents the expanded graph
export interface Representative extends RepresentativeBase {
  branches?: Branch;
  years?: Year;
}

export interface StudentWithRelations {
  id: string;
  roll_number: string;
  name: string;
  email: string;
  branch_id: string;
  year_id: string;
  semester_id: string;
  section: string;
  branch?: Branch;
  year?: Year;
  semester?: Semester;
}

// Re-export types from main types file for convenience
export type { UserRole, UserPermissions } from '@/lib/types'
