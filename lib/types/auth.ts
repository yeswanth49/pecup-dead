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

export interface Representative {
  id: string;
  user_id: string;
  branch_id: string;
  year_id: string;
  assigned_by: string;
  assigned_at: string;
  active: boolean;
  branches?: {
    id: string;
    name: string;
    code: string;
  };
  years?: {
    id: string;
    batch_year: number;
    display_name: string;
  };
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
  branch?: Array<{
    id: string;
    name: string;
    code: string;
  }>;
  year?: Array<{
    id: string;
    batch_year: number;
    display_name: string;
  }>;
  semester?: Array<{
    id: string;
    semester_number: number;
  }>;
}

export interface RepresentativeWithRelations extends Representative {}

// Re-export types from main types file for convenience
export type { UserRole, UserPermissions } from '@/lib/types'
