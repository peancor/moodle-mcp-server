/**
 * Utility functions for processing Moodle API responses
 */

/**
 * Simplifies assignment data from Moodle API response
 * @param assignmentsData Raw data from Moodle API response
 * @returns Simplified assignment data with only essential information
 */
export function processAssignments(assignmentsData: any): any[] {
  if (!assignmentsData?.courses || !assignmentsData.courses.length) {
    return [];
  }

  // We only care about assignments from the configured course
  const courseAssignments = assignmentsData.courses[0]?.assignments || [];
  
  // Map to a simplified format with only essential fields
  return courseAssignments.map((assignment: any) => ({
    id: assignment.id,
    name: assignment.name,
    dueDate: assignment.duedate ? new Date(assignment.duedate * 1000).toISOString() : null,
    allowSubmissionsFromDate: assignment.allowsubmissionsfromdate ? 
      new Date(assignment.allowsubmissionsfromdate * 1000).toISOString() : null,
    cutoffDate: assignment.cutoffdate ? new Date(assignment.cutoffdate * 1000).toISOString() : null,
    gradingDueDate: assignment.gradingduedate ? new Date(assignment.gradingduedate * 1000).toISOString() : null,
    description: assignment.intro || null,
    grade: assignment.grade,
    status: getAssignmentStatus(assignment)
  }));
}

/**
 * Determines the status of an assignment based on dates
 * @param assignment Assignment data
 * @returns Status string
 */
function getAssignmentStatus(assignment: any): string {
  const now = Math.floor(Date.now() / 1000);
  
  if (assignment.duedate && now > assignment.duedate) {
    return 'closed';
  } else if (assignment.allowsubmissionsfromdate && now < assignment.allowsubmissionsfromdate) {
    return 'not_open';
  } else {
    return 'open';
  }
}