import { useState, useEffect } from 'react';
import { useAuth } from '../../auth.jsx';
import { PageTitle, Card, Btn, Tag, Alert, SectionTitle, Stars, Textarea } from '../../components/UI.jsx';

const API_BASE = 'http://localhost:8000';

export default function MyReviews({ navigate }) {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [myEnrollments, setMyEnrollments] = useState([]);
  const [classData, setClassData] = useState({});
  const [reviews, setReviews] = useState({});
  const [reviewForms, setReviewForms] = useState({});
  const [currentPeriod, setCurrentPeriod] = useState('');
  const [msg, setMsg] = useState({ text: '', type: 'info' });
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch all data from backend
  const fetchData = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);

      // Get current period
      const periodRes = await fetch(`${API_BASE}/api/semester/period`);
      const periodData = await periodRes.json();
      setCurrentPeriod(periodData.period);

      // Get student's enrollments
      const enrollRes = await fetch(`${API_BASE}/api/student/${currentUser.id}/enrollments`);
      const enrollData = await enrollRes.json();

      const enrolled = enrollData.enrolled || [];
      setMyEnrollments(enrolled);

      // Fetch data for each enrolled class
      const classInfo = {};
      const reviewsInfo = {};

      for (const enrollment of enrolled) {
        // Get class details
        const classRes = await fetch(`${API_BASE}/api/class/${enrollment.classId}`);
        const classData = await classRes.json();
        classInfo[enrollment.classId] = classData;

        // Get reviews for this class
        const reviewsRes = await fetch(`${API_BASE}/api/class/${enrollment.classId}/reviews`);
        const reviewsData = await reviewsRes.json();
        reviewsInfo[enrollment.classId] = reviewsData.reviews || [];

        // Get student's own review
        const myReviewRes = await fetch(`${API_BASE}/api/student/${currentUser.id}/review/${enrollment.classId}`);
        const myReviewData = await myReviewRes.json();
        if (myReviewData.review) {
          reviewsInfo[enrollment.classId].myReview = myReviewData.review;
        }
      }

      setClassData(classInfo);
      setReviews(reviewsInfo);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      setMsg({ text: 'Failed to load review data', type: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser, refreshTrigger]);

  const setForm = (classId, key, value) => {
    setReviewForms(f => ({ ...f, [classId]: { ...f[classId], [key]: value } }));
  };

  const submit = async (classId) => {
    const form = reviewForms[classId] || {};
    if (!form.stars) {
      setMsg({ text: 'Please select a star rating.', type: 'danger' });
      setTimeout(() => setMsg({ text: '', type: 'info' }), 3000);
      return;
    }
    if (!form.text?.trim()) {
      setMsg({ text: 'Please write a review.', type: 'danger' });
      setTimeout(() => setMsg({ text: '', type: 'info' }), 3000);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/review/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: currentUser.id,
          classId: classId,
          stars: form.stars,
          text: form.text
        })
      });

      const result = await response.json();

      setMsg({ text: result.message, type: result.success ? 'success' : 'danger' });

      if (result.success) {
        setReviewForms(f => ({ ...f, [classId]: {} }));
        setRefreshTrigger(prev => prev + 1);
      }

      setTimeout(() => setMsg({ text: '', type: 'info' }), 3000);
    } catch (error) {
      setMsg({ text: 'Failed to submit review', type: 'danger' });
      setTimeout(() => setMsg({ text: '', type: 'info' }), 3000);
    }
  };

  const canReview = currentPeriod === 'running' || currentPeriod === 'grading';

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div>Loading your reviews...</div>
      </div>
    );
  }

  return (
    <div>
      <PageTitle sub="Rate and review your enrolled courses">Course Reviews</PageTitle>

      {!canReview && <Alert type="warn">Reviews can only be submitted during the running or grading period.</Alert>}
      {msg.text && <Alert type={msg.type}>{msg.text}</Alert>}

      <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.75rem 1rem', marginBottom: '1.5rem', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted)' }}>
        ℹ Reviews are anonymous — only the registrar can see who wrote which review. Avoid taboo words: 1–2 occurrences = censored + warning; 3+ = review hidden + 2 warnings.
      </div>

      {myEnrollments.length === 0 && (
        <Card><p style={{ color: 'var(--muted)' }}>You are not enrolled in any courses this semester.</p></Card>
      )}

      {myEnrollments.map(enrollment => {
        const cls = classData[enrollment.classId];
        if (!cls) return null;

        const allReviews = reviews[enrollment.classId] || [];
        const myReview = allReviews.find(r => r.isMine) || reviews[enrollment.classId]?.myReview;
        const avgRating = allReviews.length ? allReviews.reduce((s, r) => s + r.stars, 0) / allReviews.length : null;
        const form = reviewForms[enrollment.classId] || {};
        const gradePosted = enrollment.grade && enrollment.grade !== 'IP';

        return (
          <Card key={enrollment.id} style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)' }}>{cls.code}</div>
                <div style={{ fontWeight: 600, fontSize: '1rem' }}>{cls.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{cls.instructorName} · {cls.class_time}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {avgRating !== null && (
                  <>
                    <Stars value={Math.round(avgRating)} />
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted)' }}>{avgRating.toFixed(1)} avg ({allReviews.length} reviews)</div>
                  </>
                )}
              </div>
            </div>

            {/* Existing reviews (anonymous) */}
            {allReviews.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                  Class Reviews ({allReviews.length})
                </div>
                {allReviews.filter(r => !r.isMine).map(r => (
                  <div key={r.id} style={{ borderLeft: '2px solid var(--border)', paddingLeft: '0.75rem', marginBottom: '0.5rem' }}>
                    <Stars value={r.stars} />
                    <div style={{ fontSize: '13px', color: 'var(--muted)', fontStyle: 'italic' }}>{r.text}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Write review */}
            {myReview ? (
              <div style={{ background: 'var(--surface2)', borderRadius: '4px', padding: '0.75rem' }}>
                <Tag color="var(--success)">✓ You reviewed this course</Tag>
                <div style={{ marginTop: '0.5rem' }}>
                  <Stars value={myReview.stars} />
                  <div style={{ fontSize: '13px', color: 'var(--muted)', fontStyle: 'italic', marginTop: '0.25rem' }}>{myReview.text}</div>
                  {!myReview.visible && <Tag color="var(--danger)" style={{ marginTop: '0.25rem' }}>Hidden (taboo content)</Tag>}
                </div>
              </div>
            ) : gradePosted ? (
              <Alert type="warn">Your grade has been posted — you can no longer submit a review.</Alert>
            ) : canReview ? (
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Write a Review</div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted)', marginBottom: '0.25rem' }}>RATING</div>
                  <Stars value={form.stars || 0} onChange={v => setForm(enrollment.classId, 'stars', v)} />
                </div>
                <Textarea
                  value={form.text || ''}
                  onChange={v => setForm(enrollment.classId, 'text', v)}
                  rows={3}
                  placeholder="Share your experience with this course..."
                />
                <Btn variant="primary" onClick={() => submit(enrollment.classId)} style={{ marginTop: '0.5rem' }}>Submit Review</Btn>
              </div>
            ) : (
              <p style={{ color: 'var(--muted)', fontSize: '13px' }}>Reviews not currently open.</p>
            )}
          </Card>
        );
      })}
    </div>
  );
}