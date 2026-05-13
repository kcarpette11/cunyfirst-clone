# services/graduation_checker.py
from typing import List, Dict, Tuple

REQUIRED_COURSES_COUNT = 8
MIN_GRADUATION_COURSES = 8

def check_graduation_eligibility(
    completed_courses: List[Dict],
    required_course_ids: List[int]
) -> Tuple[bool, List[str], int]:
    """
    Check if a student is eligible for graduation
    
    Returns:
        (is_eligible, missing_required_courses, completed_count)
    """
    completed_ids = [c.get('course_id') or c.get('class_id') for c in completed_courses]
    completed_count = len(completed_courses)
    
    missing_required = [
        rid for rid in required_course_ids
        if rid not in completed_ids
    ]
    
    is_eligible = (
        completed_count >= MIN_GRADUATION_COURSES and
        len(missing_required) == 0
    )
    
    return is_eligible, missing_required, completed_count

def get_required_courses_status(
    completed_courses: List[Dict],
    required_courses: List[Dict]
) -> Dict:
    """Get detailed status of required courses"""
    completed_ids = [c.get('course_id') or c.get('class_id') for c in completed_courses]
    
    status = {
        'completed': [],
        'missing': [],
        'completed_count': len(completed_courses),
        'required_count': len(required_courses),
        'is_eligible': False
    }
    
    for course in required_courses:
        course_id = course.get('id')
        if course_id in completed_ids:
            status['completed'].append(course)
        else:
            status['missing'].append(course)
    
    status['is_eligible'] = (
        len(completed_courses) >= MIN_GRADUATION_COURSES and
        len(status['missing']) == 0
    )
    
    return status

def calculate_progress_percentage(completed_count: int) -> float:
    """Calculate graduation progress percentage"""
    return min(100, (completed_count / MIN_GRADUATION_COURSES) * 100)

def can_apply_for_graduation(
    completed_count: int,
    missing_required_count: int,
    has_pending_application: bool,
    is_graduated: bool
) -> Tuple[bool, str]:
    """Check if a student can apply for graduation"""
    if is_graduated:
        return False, "Already graduated"
    
    if has_pending_application:
        return False, "Application already pending"
    
    if completed_count < MIN_GRADUATION_COURSES:
        return False, f"Need {MIN_GRADUATION_COURSES - completed_count} more courses"
    
    if missing_required_count > 0:
        return False, f"Missing {missing_required_count} required course(s)"
    
    return True, "Eligible to apply"