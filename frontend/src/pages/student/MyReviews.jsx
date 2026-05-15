import { useState, useEffect } from 'react';
import { useAuth } from '../../auth.jsx';
import { PageTitle, Card, Btn, Alert, SectionTitle, Stars } from '../../components/UI.jsx';

const API_BASE = 'http://localhost:8000';

export default function MyReviews({ navigate }) {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [enrolledClasses, setEnrolledClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [existingReview, setExistingReview] = useState(null);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [msg, setMsg] = useState({ text: '', type: 'info' });
  const [submitting, setSubmitting] = useState(false);

  // Fetch enrolled classes for the student
  const fetchEnrolledClasses = async () => {
    try {
      const studentId = currentUser?.user_id || currentUser?.id;
      if (!studentId) {
        console.log('No student ID available');
        setLoading(false);
        return;
      }

      console.log('Fetching enrollments for student:', studentId);
      const response = await fetch(`${API_BASE}/api/student/${studentId}/enrollments`);

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }

      const data = await response.json();
      console.log('Enrolled classes data:', data);

      // Normalize each enrollment to a consistent shape for the class selector
      const classes = (data.enrolled || []).map(cls => ({
        id: cls.class_id,
        class_id: cls.class_id,
        code: cls.code,
        name: cls.name,
        class_time: cls.class_time,
        instructor_name: cls.instructor_name,
        enrollment_id: cls.enrollment_id
      }));

      console.log('Processed enrolled classes:', classes);
      setEnrolledClasses(classes);
    } catch (error) {
      console.error('Error fetching enrolled classes:', error);
      setMsg({ text: 'Failed to load your enrolled classes', type: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  // Fetch existing review for selected class; resets form fields if none found
  const fetchExistingReview = async (classId) => {
    if (!classId) {
      console.log('No class ID provided to fetchExistingReview');
      return;
    }

    try {
      const studentId = currentUser?.user_id || currentUser?.id;
      if (!studentId) {
        console.log('No student ID available');
        return;
      }

      console.log(`Fetching review for student ${studentId}, class ${classId}`);
      const response = await fetch(`${API_BASE}/api/student/${studentId}/review/${classId}`);

      if (!response.ok) {
        // 404 means no review yet — reset the form to a blank state
        if (response.status === 404) {
          console.log('No existing review found');
          setExistingReview(null);
          setRating(0);
          setReviewText('');
          return;
        }
        throw new Error(`Failed to fetch review: ${response.status}`);
      }

      const data = await response.json();
      console.log('Review data received:', data);

      // Populate form fields with the existing review, or blank out if missing
      if (data.review) {
        setExistingReview(data.review);
        setRating(data.review.stars || 0);
        setReviewText(data.review.text || '');
      } else {
        setExistingReview(null);
        setRating(0);
        setReviewText('');
      }
    } catch (error) {
      console.error('Error fetching review:', error);
      setExistingReview(null);
      setRating(0);
      setReviewText('');
    }
  };

  // ===== Actions ================================================================

  // Handle class selection — sets active class and loads any existing review
  const handleClassSelect = (classObj) => {
    console.log('Selected class:', classObj);
    setSelectedClass(classObj);
    const classId = classObj.class_id || classObj.id;
    if (classId) {
      fetchExistingReview(classId);
    }
  };

  const submitReview = async () => {
    // Guard: require a class, a star rating, and non-empty review text
    if (!selectedClass) {
      setMsg({ text: 'Please select a class first', type: 'danger' });
      setTimeout(() => setMsg({ text: '', type: 'info' }), 3000);
      return;
    }

    if (rating === 0) {
      setMsg({ text: 'Please select a star rating', type: 'danger' });
      setTimeout(() => setMsg({ text: '', type: 'info' }), 3000);
      return;
    }

    if (!reviewText.trim()) {
      setMsg({ text: 'Please write a review', type: 'danger' });
      setTimeout(() => setMsg({ text: '', type: 'info' }), 3000);
      return;
    }

    setSubmitting(true);

    try {
      const studentId = currentUser?.user_id || currentUser?.id;
      const classId = selectedClass.class_id || selectedClass.id;

      console.log('Submitting review:', {
        studentId: String(studentId),
        classId: parseInt(classId),
        stars: rating,
        text: reviewText
      });

      const response = await fetch(`${API_BASE}/api/review/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: String(studentId),
          classId: parseInt(classId),
          stars: rating,
          text: reviewText
        })
      });

      const result = await response.json();
      console.log('Submit review result:', result);

      if (result.success) {
        setMsg({ text: result.message || 'Review submitted successfully!', type: 'success' });

        // Refresh the existing review
        await fetchExistingReview(classId);

        // Clear form if it was a new review (not an update)
        if (!existingReview) {
          setRating(0);
          setReviewText('');
        }
      } else {
        setMsg({ text: result.message || 'Failed to submit review', type: 'danger' });
      }

      setTimeout(() => setMsg({ text: '', type: 'info' }), 3000);
    } catch (error) {
      console.error('Error submitting review:', error);
      setMsg({ text: 'Failed to submit review. Please try again.', type: 'danger' });
      setTimeout(() => setMsg({ text: '', type: 'info' }), 3000);
    } finally {
      setSubmitting(false);
    }
  };

  // ===== Effects ================================================================

  useEffect(() => {
    if (currentUser) {
      fetchEnrolledClasses();
    } else {
      setLoading(false);
    }
  }, [currentUser]);


  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div>Loading...</div>
      </div>
    );
  }

  // ===== Main Content =============================================================

  return (
    <div>
      <PageTitle sub="Share your feedback about the courses you've taken">
        My Reviews
      </PageTitle>

      {msg.text && <Alert type={msg.type}>{msg.text}</Alert>}

      {/* Two-column layout: class selector on the left, review form on the right */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>

        {/* ── Left Column: Class Selector ───────────────────────────────────── */}
        <Card>
          <SectionTitle>Select a Class</SectionTitle>
          {enrolledClasses.length === 0 && (
            <p style={{ color: 'var(--muted)', fontSize: '13px' }}>
              You haven't completed any classes yet. Once you complete a class, you'll be able to review it here.
            </p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {enrolledClasses.map(cls => {
              const classId = cls.class_id || cls.id;
              // Highlight the currently selected class
              const isSelected = selectedClass && (selectedClass.class_id === classId || selectedClass.id === classId);

              return (
                <div
                  key={classId}
                  onClick={() => handleClassSelect(cls)}
                  style={{
                    padding: '1rem',
                    border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{cls.code}</div>
                  <div style={{ fontSize: '13px', color: 'var(--muted)' }}>{cls.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{cls.instructor_name || 'TBA'}</div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* ── Right Column: Review Form ──────────────────────────────────────── */}
        <Card>
          <SectionTitle>
            {existingReview ? 'Edit Your Review' : 'Write a Review'}
          </SectionTitle>

          {/* Prompt user to pick a class if none is selected yet */}
          {!selectedClass ? (
            <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '2rem' }}>
              Select a class from the left to write a review
            </p>
          ) : (
            <>
              {/* Selected class summary */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                  {selectedClass.code} - {selectedClass.name}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                  Instructor: {selectedClass.instructor_name || 'TBA'}
                </div>
              </div>

              {/* Star rating input */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  Rating
                </label>
                <Stars
                  value={rating}
                  editable={true}
                  onChange={(newRating) => setRating(newRating)}
                />
              </div>

              {/* Review text input */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  Your Review
                </label>
                <textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Share your experience with this course..."
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--surface)',
                    color: 'var(--foreground)',
                    fontFamily: 'inherit',
                    fontSize: '14px',
                    minHeight: '120px',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Submit button — label changes between new and edit mode */}
              <Btn
                onClick={submitReview}
                disabled={submitting || rating === 0 || !reviewText.trim()}
                style={{ width: '100%' }}
              >
                {submitting ? 'Submitting...' : (existingReview ? 'Update Review' : 'Submit Review')}
              </Btn>

              {/* Reminder that submitting will overwrite the previous review */}
              {existingReview && (
                <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '1rem', textAlign: 'center' }}>
                  You've already reviewed this class. Submitting will update your existing review.
                </p>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}