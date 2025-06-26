/**
 * REPOSITORIES INDEX - Centralized access to all repositories
 *
 * ARCHITECTURE PRINCIPLE: Single point of access, clean imports
 * Provides unified interface to all domain repositories
 */

// ============================================================================
// REPOSITORY EXPORTS
// ============================================================================

export { BaseRepository } from './base';
export { CoursesRepository, coursesRepository } from './courses';
export { StudentsRepository, studentsRepository } from './students';

// Import instances
import { coursesRepository } from './courses';
import { studentsRepository } from './students';

// ============================================================================
// UNIFIED REPOSITORY INTERFACE
// ============================================================================

export const repositories = {
	courses: coursesRepository,
	students: studentsRepository
} as const;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type { Course, NewCourse, CourseUpdate } from './courses';
export type { Student, NewStudent, StudentUpdate, StudentWithRegister } from './students';
