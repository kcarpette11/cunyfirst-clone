import { useState, useEffect } from 'react';
import { useAuth } from '../auth.jsx';
import { Card, Btn, Textarea, Alert } from './UI.jsx';

const API_BASE = 'http://localhost:8000';

export default function AIChat() {
  const { currentUser } = useAuth();
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hello! I\'m the CunyZero AI assistant. Ask me about classes, requirements, policies, or anything about this system.' }
  ]);
  const [loading, setLoading] = useState(false);
  const [contextData, setContextData] = useState(null);

  // Fetch context data from backend
  const fetchContextData = async () => {
    if (!currentUser) return;

    try {
      const response = await fetch(`${API_BASE}/ai/context/${currentUser.id}`);
      const data = await response.json();
      setContextData(data);
    } catch (error) {
      console.error('Failed to fetch context data:', error);
    }
  };

  useEffect(() => {
    fetchContextData();
  }, [currentUser]);

  const ask = async () => {
    if (!question.trim()) return;
    const q = question.trim();
    setQuestion('');
    setMessages(m => [...m, { role: 'user', text: q }]);
    setLoading(true);

    try {
      // Get current period and semester from backend
      const periodRes = await fetch(`${API_BASE}/api/semester/period`);
      const periodData = await periodRes.json();

      // Get classes from backend
      const classesRes = await fetch(`${API_BASE}/api/classes?semester=${periodData.semester || 1}`);
      const classesData = await classesRes.json();

      // Get student data if user is student
      let studentData = null;
      if (currentUser?.role === 'student') {
        const studentRes = await fetch(`${API_BASE}/api/student/${currentUser.id}/dashboard`);
        studentData = await studentRes.json();

        const enrollRes = await fetch(`${API_BASE}/api/student/${currentUser.id}/enrollments`);
        const enrollData = await enrollRes.json();
        studentData.enrollments = enrollData.enrolled || [];
      }

      // Get instructor data if user is instructor
      let instructorData = null;
      if (currentUser?.role === 'instructor') {
        const instructorRes = await fetch(`${API_BASE}/api/instructor/${currentUser.id}/classes`);
        instructorData = await instructorRes.json();
      }

      // Get taboo words
      const tabooRes = await fetch(`${API_BASE}/api/taboo-words`);
      const tabooData = await tabooRes.json();

      // Call YOUR backend instead of Anthropic directly
      const res = await fetch(`${API_BASE}/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: q,
          history: messages.filter(m => m.role !== 'system').map(m => ({
            role: m.role,
            content: m.text
          })),
          user_role: currentUser?.role || 'visitor',
          user_context: {
            currentPeriod: periodData.period,
            programQuota: 100,
            tabooWords: tabooData.words || [],
            classes: (classesData.classes || []).map(cls => ({
              id: cls.id,
              code: cls.code,
              name: cls.name,
              time: cls.class_time,
              maxSize: cls.capacity,
              cancelled: cls.cancelled || false,
              instructorName: cls.instructor_name,
              avgRating: cls.avg_rating,
            })),
            student: currentUser?.role === 'student' && studentData ? {
              id: currentUser.id,
              name: currentUser.name,
              studentId: currentUser.studentId,
              gpa: studentData.overallGPA,
              warnings: studentData.warnings,
              honorCount: studentData.honorCount,
              enrollments: (studentData.enrollments || []).map(e => ({
                code: e.code,
                name: e.name,
                grade: e.grade
              }))
            } : null,
            instructorClasses: currentUser?.role === 'instructor' && instructorData ?
              (instructorData.classes || []).map(cls => ({
                code: cls.code,
                enrolledCount: cls.enrolled_count,
                students: (cls.students || []).map(s => ({
                  name: s.name,
                  studentId: s.student_code,
                  grade: s.grade,
                  gpa: s.gpa
                }))
              })) : []
          }
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();

      // Add the response to chat
      setMessages(m => [...m, {
        role: 'assistant',
        text: data.answer,
        source: data.source,
        hallucination_warning: data.hallucination_warning
      }]);

    } catch (err) {
      console.error('Error calling AI assistant:', err);
      setMessages(m => [...m, {
        role: 'assistant',
        text: 'Error connecting to AI service. Please make sure the backend server is running on port 8000.',
        source: 'error'
      }]);
    }
    setLoading(false);
  };

  return (
    <Card style={{ marginTop: '2rem' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--accent)', marginBottom: '1rem', fontWeight: 700 }}>
        ✦ AI Assistant
      </div>
      <div style={{ minHeight: '180px', maxHeight: '300px', overflowY: 'auto', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '80%', padding: '0.6rem 0.9rem', borderRadius: '8px',
              background: m.role === 'user' ? 'var(--accent2)' : 'var(--surface2)',
              color: m.role === 'user' ? '#fff' : 'var(--text)',
              fontSize: '13px', fontFamily: 'var(--font-body)',
              border: m.role !== 'user' ? '1px solid var(--border)' : 'none',
            }}>
              {m.text}
              {m.hallucination_warning && (
                <div style={{ marginTop: '0.4rem', fontSize: '10px', color: 'var(--warn)', fontFamily: 'var(--font-mono)' }}>
                  ⚠ Answer from general LLM — may not reflect CunyZero specifics. Verify with registrar.
                </div>
              )}
              {m.source === 'local' && (
                <div style={{ marginTop: '0.4rem', fontSize: '10px', color: 'var(--success)', fontFamily: 'var(--font-mono)' }}>
                  ✓ From local knowledge base
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: '12px', padding: '0.5rem' }}>Thinking...</div>
        )}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          value={question} onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && ask()}
          placeholder="Ask about classes, requirements, policies..."
          style={{
            flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)',
            color: 'var(--text)', borderRadius: '4px', padding: '0.5rem 0.75rem',
            fontFamily: 'var(--font-body)', fontSize: '14px', outline: 'none',
          }}
        />
        <Btn variant="primary" onClick={ask} disabled={loading || !question.trim()}>Ask</Btn>
      </div>
      <div style={{ marginTop: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--muted)' }}>
        Answers are drawn from local CunyZero data first. Unknown queries are sent to the LLM with a hallucination warning.
      </div>
    </Card>
  );
}