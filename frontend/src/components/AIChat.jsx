import { useState, useEffect } from 'react';
import { useAuth } from '../auth.jsx';
import { Card, Btn, Textarea, Alert } from './UI.jsx';


// ===== Simple markdown renderer here for headings, lists, bold/italics, and inline code. Not full markdown spec, 
// just basic formatting for AI responses. ========
function MarkdownText({ text }) {
  const lines = text.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Heading ###
    if (line.startsWith('### ')) {
      elements.push(<div key={i} style={{ fontWeight: 700, fontSize: '13px', marginTop: '0.6rem', marginBottom: '0.2rem' }}>{renderInline(line.slice(4))}</div>);
    } else if (line.startsWith('## ')) {
      elements.push(<div key={i} style={{ fontWeight: 700, fontSize: '14px', marginTop: '0.7rem', marginBottom: '0.3rem', borderBottom: '1px solid var(--border)', paddingBottom: '2px' }}>{renderInline(line.slice(3))}</div>);
    } else if (line.startsWith('# ')) {
      elements.push(<div key={i} style={{ fontWeight: 700, fontSize: '15px', marginTop: '0.8rem', marginBottom: '0.3rem' }}>{renderInline(line.slice(2))}</div>);
      // Horizontal rule 
    } else if (/^---+$/.test(line.trim())) {
      elements.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0.5rem 0' }} />);
      // Bullet point  
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <div key={i} style={{ display: 'flex', gap: '0.4rem', marginTop: '2px' }}>
          <span style={{ color: 'var(--accent)', flexShrink: 0 }}>•</span>
          <span>{renderInline(line.slice(2))}</span>
        </div>
      );
      // Numbered list
    } else if (/^\d+\.\s/.test(line)) {
      const match = line.match(/^(\d+)\.\s(.*)/);
      elements.push(
        <div key={i} style={{ display: 'flex', gap: '0.4rem', marginTop: '2px' }}>
          <span style={{ color: 'var(--accent)', flexShrink: 0, minWidth: '16px' }}>{match[1]}.</span>
          <span>{renderInline(match[2])}</span>
        </div>
      );
      // Empty line = spacing
    } else if (line.trim() === '') {
      elements.push(<div key={i} style={{ height: '0.4rem' }} />);
      // Normal text
    } else {
      elements.push(<div key={i}>{renderInline(line)}</div>);
    }
    i++;
  }
  return <div style={{ lineHeight: '1.6' }}>{elements}</div>;
}

// ===== Inlite markdown renderer for bold, italics, and inline code within a line of text. Used by MarkdownText component.
function renderInline(text) {
  // Bold **text** and *text*, inline code `code`
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    } else if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    } else if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} style={{ background: 'var(--surface)', padding: '1px 4px', borderRadius: '3px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

const API_BASE = 'http://localhost:8000';

export default function AIChat() {

  const { currentUser } = useAuth();
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hello! I\'m the CunyZero AI assistant. Ask me about classes, requirements, policies, or anything about this system.' }
  ]);
  const [loading, setLoading] = useState(false);
  const [contextData, setContextData] = useState(null);

  // ====================== Fetch Context Data on Mount ====================
  // Like current semester, enrolled classes, GPA, warnings, etc. to provide more informed answers and reduce hallucinations. 
  // This is fetched once on component mount and when user changes.
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

  // ===== Chat Functionality =================================================================
  const ask = async () => {
    if (!question.trim()) return;
    const q = question.trim();
    setQuestion('');
    setMessages(m => [...m, { role: 'user', text: q }]);
    setLoading(true);

    try {
      // Fetch semester period
      const periodRes = await fetch(`${API_BASE}/api/semester/period`);
      const periodData = await periodRes.json();

      // Fetch available classes
      const classesRes = await fetch(`${API_BASE}/api/classes?semester=${periodData.semester || 1}`);
      const classesData = await classesRes.json();

      // Fetch student-specific data if applicable
      let studentData = null;
      if (currentUser?.role === 'student') {
        const studentRes = await fetch(`${API_BASE}/api/student/${currentUser.id}/dashboard`);
        studentData = await studentRes.json();

        const enrollRes = await fetch(`${API_BASE}/api/student/${currentUser.id}/enrollments`);
        const enrollData = await enrollRes.json();
        studentData.enrollments = enrollData.enrolled || [];
      }

      // Fetch instructor-specific data if applicable
      let instructorData = null;
      if (currentUser?.role === 'instructor') {
        const instructorRes = await fetch(`${API_BASE}/api/instructor/${currentUser.id}/classes`);
        instructorData = await instructorRes.json();
      }

      // Fetch taboo words
      const tabooRes = await fetch(`${API_BASE}/api/taboo-words`);
      const tabooData = await tabooRes.json();

      // Send request to AI backend
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
      {/* Header */}
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--accent)', marginBottom: '1rem', fontWeight: 700 }}>
        ✦ AI Assistant
      </div>

      {/* Messages Container */}
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
              {m.role === 'assistant' ? <MarkdownText text={m.text} /> : m.text}
              {/* Hallucination Warning Badge */}
              {m.hallucination_warning && (
                <div style={{ marginTop: '0.4rem', fontSize: '10px', color: 'var(--warn)', fontFamily: 'var(--font-mono)' }}>
                  ⚠ Answer from general LLM — may not reflect CunyZero specifics. Verify with registrar.
                </div>
              )}
              {/* Local Source Badge */}
              {m.source === 'local' && (
                <div style={{ marginTop: '0.4rem', fontSize: '10px', color: 'var(--success)', fontFamily: 'var(--font-mono)' }}>
                  ✓ From local knowledge base
                </div>
              )}
            </div>
          </div>
        ))}
        {/* Loading Indicator */}
        {loading && (
          <div style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: '12px', padding: '0.5rem' }}>Thinking...</div>
        )}
      </div>

      {/* Input Area */}
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

      {/* Footer Info */}
      <div style={{ marginTop: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--muted)' }}>
        Answers are drawn from local CunyZero data first. Unknown queries are sent to the LLM with a hallucination warning.
      </div>
    </Card>
  );
}