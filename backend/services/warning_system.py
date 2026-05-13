# services/warning_system.py
from typing import Dict, Optional, Tuple

MAX_WARNINGS = 3

def issue_warning(current_warnings: int, user_role: str) -> Tuple[int, bool, str]:
    """
    Issue a warning to a user
    
    Returns:
        (new_warning_count, is_suspended, message)
    """
    new_count = current_warnings + 1
    is_suspended = False
    message = f"Warning issued. Total warnings: {new_count}"
    
    if new_count >= MAX_WARNINGS:
        is_suspended = True
        if user_role == 'instructor':
            message = f"Instructor suspended due to {new_count} warnings"
        else:
            message = f"Student suspended for 1 semester due to {new_count} warnings. A fine is required."
    
    return new_count, is_suspended, message

def remove_warning(current_warnings: int, honor_credits: int = 0) -> Tuple[int, int, bool, str]:
    """
    Remove a warning, possibly using honor credits
    
    Returns:
        (new_warning_count, new_honor_credits, success, message)
    """
    if current_warnings <= 0:
        return current_warnings, honor_credits, False, "No warnings to remove"
    
    new_warnings = current_warnings - 1
    
    if honor_credits > 0:
        return new_warnings, honor_credits - 1, True, "Warning removed using honor credit"
    else:
        return new_warnings, honor_credits, True, "Warning removed"
    
def check_suspension_status(
    warnings: int,
    user_role: str,
    is_suspended: bool,
    suspended_until_semester: Optional[int] = None,
    current_semester: int = 1
) -> Tuple[bool, Optional[int], str]:
    """
    Check and update suspension status
    
    Returns:
        (is_suspended, suspended_until_semester, message)
    """
    if is_suspended and suspended_until_semester and suspended_until_semester <= current_semester:
        # Suspension is over
        return False, None, "Suspension has ended"
    
    if warnings >= MAX_WARNINGS and not is_suspended:
        # New suspension
        if user_role == 'instructor':
            return True, None, "Instructor suspended due to warnings"
        else:
            return True, current_semester + 1, "Student suspended for next semester"
    
    return is_suspended, suspended_until_semester, ""

def can_register(student: Dict, current_period: str) -> Tuple[bool, str]:
    """Check if a student can register for courses"""
    if student.get('suspended'):
        return False, "Account is suspended. Cannot register."
    
    if student.get('terminated'):
        return False, "Account is terminated. Cannot register."
    
    if current_period not in ['registration', 'running']:
        return False, f"Registration not open. Current period: {current_period}"
    
    return True, "Can register"

def can_submit_review(
    has_grade: bool,
    current_period: str,
    has_existing_review: bool = False
) -> Tuple[bool, str]:
    """Check if a student can submit a review"""
    if has_existing_review:
        return False, "You have already reviewed this course"
    
    if has_grade:
        return False, "Cannot review after grades are posted"
    
    if current_period not in ['running', 'grading']:
        return False, f"Reviews can only be submitted during running or grading period"
    
    return True, "Can submit review"

def process_taboo_violation(taboo_count: int) -> Tuple[bool, int, str]:
    """
    Process taboo word violation
    
    Returns:
        (is_visible, warnings_to_add, message)
    """
    if taboo_count >= 3:
        return False, 2, "Review hidden due to 3+ taboo words. 2 warnings issued."
    elif taboo_count >= 1:
        return True, 1, "Review censored. Warning issued for taboo words."
    else:
        return True, 0, "Review submitted successfully."