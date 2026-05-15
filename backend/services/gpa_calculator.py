# services/gpa_calculator.py
from typing import List, Dict, Optional

GRADE_POINTS = {
    'A': 4.0,
    'B': 3.0,
    'C': 2.0,
    'D': 1.0,
    'F': 0.0,
    'IP': None  # In Progress - not counted
}

# ===== Grade points lookup ============================================================

def get_grade_points(grade: str) -> Optional[float]:
    """Get grade points for a letter grade"""
    return GRADE_POINTS.get(grade.upper())

# ===== GPA Calculation ============================================================

def calculate_gpa(grades: List[str]) -> Optional[float]:
    """Calculate GPA from a list of grades"""
    graded = [g for g in grades if g and g.upper() != 'IP' and g.upper() in GRADE_POINTS]
    if not graded:
        return None
    
    total_points = sum(GRADE_POINTS[g.upper()] for g in graded)
    return total_points / len(graded)

def calculate_gpa_from_enrollments(enrollments: List[Dict]) -> Optional[float]:
    """Calculate GPA from enrollment records"""
    grades = [e.get('grade') for e in enrollments if e.get('grade')]
    return calculate_gpa(grades)

def calculate_class_gpa(enrollments: List[Dict]) -> Optional[float]:
    """Calculate average GPA for a class"""
    grades = [e.get('grade') for e in enrollments if e.get('grade') and e.get('grade') != 'IP']
    return calculate_gpa(grades)

# ===== Academic standing evaluation ============================================================

def is_honor_roll_eligible(gpa: float, semester_number: int = 1, is_overall: bool = False) -> bool:
    """Check if a student is eligible for honor roll"""
    if is_overall:
        return semester_number > 1 and gpa > 3.5
    else:
        return gpa > 3.75

def is_academic_probation(gpa: float) -> bool:
    """Check if student is on academic probation"""
    return gpa < 2.0

def is_warning_zone(gpa: float) -> bool:
    """Check if GPA is in warning zone (2.0 - 2.25)"""
    return 2.0 <= gpa < 2.25