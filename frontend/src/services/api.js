// src/services/api.js
const API_BASE = "http://localhost:8000";

// Helper for API calls
async function callAPI(endpoint, method = "GET", data = null) {
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, options);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`API call failed: ${endpoint}`, error);
    // Fallback to db.js if backend is not available
    return { error: true, message: error.message };
  }
}

// Student Operations
export async function enrollStudentAPI(studentId, classId) {
  return callAPI("/api/enroll", "POST", { studentId, classId });
}

export async function getStudentScheduleAPI(studentId) {
  return callAPI(`/api/student/${studentId}/schedule`);
}

export async function submitReviewAPI(studentId, classId, stars, text) {
  return callAPI("/api/review", "POST", { studentId, classId, stars, text });
}

export async function getStudentGPAAPI(studentId) {
  return callAPI(`/api/student/${studentId}/gpa`);
}

// Instructor Operations
export async function getClassRosterAPI(classId) {
  return callAPI(`/api/class/${classId}/roster`);
}

export async function postGradeAPI(enrollmentId, grade) {
  return callAPI("/api/grade", "POST", { enrollmentId, grade });
}

export async function admitFromWaitlistAPI(enrollmentId) {
  return callAPI("/api/waitlist/admit", "POST", { enrollmentId });
}

// Registrar Operations
export async function setPeriodAPI(period) {
  return callAPI("/api/semester/period", "POST", { period });
}

export async function getApplicationsAPI() {
  return callAPI("/api/applications");
}

export async function processApplicationAPI(appId, accept, note) {
  return callAPI("/api/application/process", "POST", { appId, accept, note });
}

export async function createClassAPI(classData) {
  return callAPI("/api/class/create", "POST", classData);
}

// Public Operations
export async function getClassesAPI() {
  return callAPI("/api/classes");
}

export async function getTopRatedClassesAPI() {
  return callAPI("/api/classes/top-rated");
}

export async function getTopStudentsAPI() {
  return callAPI("/api/students/top-gpa");
}

// Complaint Operations
export async function submitComplaintAPI(complaintData) {
  return callAPI("/api/complaint", "POST", complaintData);
}

// Graduation Operations
export async function applyForGraduationAPI(studentId) {
  return callAPI("/api/graduation/apply", "POST", { studentId });
}

// Check if backend is available
export async function checkBackendHealth() {
  try {
    const response = await fetch(`${API_BASE}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
