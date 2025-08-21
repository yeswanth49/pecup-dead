import { ResourceType } from '@/lib/types'

/**
 * Determines the resource_type filter based on the resource category
 * @param category - The resource category (notes, assignments, papers, records)
 * @returns The corresponding ResourceType or null for no filtering
 */
export function getResourceTypeForCategory(category: string): ResourceType | null {
  switch (category.toLowerCase()) {
    case 'records':
      return 'records' // Lab/Laboratory subjects for weekly records
    case 'notes':
    case 'assignments': 
    case 'papers':
      return 'resources' // Regular subjects for notes, assignments, papers
    default:
      return null // Show all subjects if category doesn't match
  }
}

/**
 * Gets a user-friendly description of what subjects are shown for a category
 * @param category - The resource category
 * @returns Description string
 */
export function getSubjectFilterDescription(category: string): string {
  const resourceType = getResourceTypeForCategory(category)
  
  switch (resourceType) {
    case 'records':
      return 'Showing laboratory and workshop subjects for record submissions'
    case 'resources':
      return 'Showing theory subjects for notes, assignments, and papers'
    default:
      return 'Showing all subjects'
  }
}

/**
 * Builds the query parameters for subjects API call with resource_type filtering
 * @param searchParams - URLSearchParams object with year, semester, branch
 * @param category - Resource category to determine filtering
 * @returns URLSearchParams with resource_type filter added if applicable
 */
export function buildSubjectsQuery(searchParams: URLSearchParams, category: string): URLSearchParams {
  const qp = new URLSearchParams()
  
  // Copy existing params
  const year = searchParams.get('year')
  const semester = searchParams.get('semester')  
  const branch = searchParams.get('branch')
  
  if (year) qp.set('year', year)
  if (semester) qp.set('semester', semester)
  if (branch) qp.set('branch', branch)
  
  // Add resource_type filter based on category
  const resourceType = getResourceTypeForCategory(category)
  if (resourceType) {
    qp.set('resource_type', resourceType)
  }
  
  return qp
}
