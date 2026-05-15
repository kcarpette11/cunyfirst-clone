import { useState, useEffect } from 'react';
import { PageTitle, Card, Input, Select, Btn, Table, Tag, Alert, SectionTitle, Grid } from '../../components/UI.jsx';

const API_BASE = 'http://localhost:8000';

// Registrar-only page to create and manage classes for the current semester
export default function ClassSetup({ navigate }) {
  const [loading, setLoading] = useState(true);
  const [instructors, setInstructors] = useState([]);
  const [currentClasses, setCurrentClasses] = useState([]);
  const [semesterNumber, setSemesterNumber] = useState(1);
  const [form, setForm] = useState({
    code: '',
    name: '',
    instructorId: '',
    time: '',
    maxSize: '5',
    required: 'true'
  });
  const [msg, setMsg] = useState('');
  const [editId, setEditId] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch data from backend
  // Like current semester, instructors, and existing classes to populate form options and list of classes   
  const fetchData = async () => {
    try {
      setLoading(true);

      const periodRes = await fetch(`${API_BASE}/api/semester/period`);
      const periodData = await periodRes.json();
      setSemesterNumber(periodData.semester || 1);

      const instructorsRes = await fetch(`${API_BASE}/api/instructors`);
      const instructorsData = await instructorsRes.json();
      setInstructors(instructorsData.instructors || []);

      if (instructorsData.instructors?.length > 0 && !form.instructorId) {
        setForm(f => ({ ...f, instructorId: instructorsData.instructors[0].id }));
      }

      const classesRes = await fetch(`${API_BASE}/api/classes?semester=${periodData.semester || 1}`);
      const classesData = await classesRes.json();
      setCurrentClasses(classesData.classes || []);

    } catch (error) {
      console.error('Failed to fetch data:', error);
      setMsg('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [refreshTrigger]);

  const createClass = async (classData) => {
    const response = await fetch(`${API_BASE}/api/class/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(classData)
    });
    return response.json();
  };

  const updateClass = async (classId, classData) => {
    const response = await fetch(`${API_BASE}/api/class/${classId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(classData)
    });
    return response.json();
  };

  const getEnrollmentCount = async (classId) => {
    try {
      const response = await fetch(`${API_BASE}/api/class/${classId}/enrollment-count`);
      const data = await response.json();
      return data.count || 0;
    } catch (error) {
      return 0;
    }
  };

  const save = async () => {
    if (!form.code || !form.name || !form.instructorId || !form.time) {
      setMsg('All fields required.');
      setTimeout(() => setMsg(''), 2000);
      return;
    }

    try {
      const classData = {
        ...form,
        maxSize: parseInt(form.maxSize),
        required: form.required === 'true',
        semester: semesterNumber
      };

      if (editId) {
        await updateClass(editId, classData);
        setMsg('Class updated.');
      } else {
        await createClass(classData);
        setMsg('Class created.');
      }

      setForm({
        code: '',
        name: '',
        instructorId: instructors[0]?.id || '',
        time: '',
        maxSize: '5',
        required: 'true'
      });
      setEditId(null);
      setRefreshTrigger(prev => prev + 1);

    } catch (error) {
      console.error('Failed to save class:', error);
      setMsg('Failed to save class');
    }

    setTimeout(() => setMsg(''), 2000);
  };

  const startEdit = (cls) => {
    setEditId(cls.id);
    setForm({
      code: cls.code,
      name: cls.name,
      instructorId: cls.instructor_id,
      time: cls.class_time,
      maxSize: String(cls.capacity),
      required: String(cls.required)
    });
  };

  const cancelEdit = () => {
    setEditId(null);
    setForm({
      code: '',
      name: '',
      instructorId: instructors[0]?.id || '',
      time: '',
      maxSize: '5',
      required: 'true'
    });
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div>Loading class setup...</div>
      </div>
    );
  }

  {/* Main content with form to create/edit classes and list of current classes */ }
  return (
    <div>
      <PageTitle sub="Create and manage classes for the current semester">Class Setup</PageTitle>
      {msg && <Alert type={msg.includes('required') ? 'danger' : 'success'}>{msg}</Alert>}

      <Grid cols={2}>
        <Card>
          <SectionTitle>{editId ? '✏️ Edit Class' : '+ New Class'}</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Input label="Course Code" value={form.code} onChange={v => setForm(f => ({ ...f, code: v }))} placeholder="CS101" />
            <Input label="Course Name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="Introduction to Computing" />
            <Select
              label="Instructor"
              value={form.instructorId}
              onChange={v => setForm(f => ({ ...f, instructorId: v }))}
              options={instructors.map(i => ({ value: i.id, label: i.name }))}
            />
            <Input label="Time Slot" value={form.time} onChange={v => setForm(f => ({ ...f, time: v }))} placeholder="Mon/Wed 9–10:30am" />
            <Input label="Max Students" type="number" value={form.maxSize} onChange={v => setForm(f => ({ ...f, maxSize: v }))} />
            <Select
              label="Required Course"
              value={form.required}
              onChange={v => setForm(f => ({ ...f, required: v }))}
              options={[
                { value: 'true', label: 'Yes — Required' },
                { value: 'false', label: 'No — Elective' }
              ]}
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Btn variant="primary" onClick={save}>{editId ? 'Save Changes' : 'Create Class'}</Btn>
              {editId && <Btn onClick={cancelEdit}>Cancel</Btn>}
            </div>
          </div>
        </Card>

        <Card>
          <SectionTitle>Semester {semesterNumber} Classes</SectionTitle>
          {currentClasses.length === 0 && <p style={{ color: 'var(--muted)', fontSize: '13px' }}>No classes set up yet.</p>}
          {currentClasses.map(cls => {
            const ins = instructors.find(i => i.id === cls.instructor_id);
            const isFull = cls.enrolled_count >= cls.capacity;

            return (
              <div key={cls.id} style={{
                border: `1px solid ${cls.cancelled ? 'var(--danger)' : 'var(--border)'}`,
                borderRadius: '6px', padding: '0.75rem', marginBottom: '0.75rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)' }}>{cls.code}</span>
                    {' '}
                    <strong>{cls.name}</strong>
                    {cls.cancelled && <Tag color="var(--danger)" style={{ marginLeft: '0.5rem' }}>Cancelled</Tag>}
                    {isFull && !cls.cancelled && <Tag color="var(--warn)" style={{ marginLeft: '0.5rem' }}>Full</Tag>}
                  </div>
                  <Btn onClick={() => startEdit(cls)} style={{ fontSize: '11px', padding: '0.2rem 0.5rem' }}>Edit</Btn>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted)', marginTop: '0.3rem' }}>
                  {ins?.name} · {cls.class_time} · {cls.enrolled_count || 0}/{cls.capacity} students
                  {cls.avg_rating ? ` · ★ ${cls.avg_rating.toFixed(1)}` : ''}
                  {cls.required ? ' · Required' : ' · Elective'}
                </div>
              </div>
            );
          })}
        </Card>
      </Grid>
    </div>
  );
}