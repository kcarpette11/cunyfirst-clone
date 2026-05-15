import { useState, useEffect } from 'react';
import { PageTitle, Card, Grid, SectionTitle, Tag, Table } from '../../components/UI.jsx';
import AIChat from '../../components/AIChat.jsx';

const API_BASE = 'http://localhost:8000';

export default function RegistrarHome({ navigate }) {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState({
    students: [],
    instructors: [],
    pendingApps: [],
    pendingComplaints: [],
    pendingGrad: [],
    currentPeriod: 'registration',
    semesterNumber: 1,
    programQuota: 20,
    periodColors: { setup: 'var(--accent2)', registration: 'var(--success)', running: 'var(--accent)', grading: 'var(--warn)', closed: 'var(--muted)' },
    periodLabels: { setup: 'Class Set-Up', registration: 'Course Registration', running: 'Class Running', grading: 'Grading', closed: 'Closed' }
  });
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchData = async () => {
    try {
      setLoading(true);

      const periodRes = await fetch(`${API_BASE}/api/semester/period`);
      const periodData = await periodRes.json();

      const studentsRes = await fetch(`${API_BASE}/api/students/all`);
      const studentsData = await studentsRes.json();

      const instructorsRes = await fetch(`${API_BASE}/api/instructors/all`);
      const instructorsData = await instructorsRes.json();

      const appsRes = await fetch(`${API_BASE}/api/applications/pending`);
      const appsData = await appsRes.json();

      const complaintsRes = await fetch(`${API_BASE}/api/complaints/pending`);
      const complaintsData = await complaintsRes.json();

      const gradRes = await fetch(`${API_BASE}/api/graduation/pending`);
      const gradData = await gradRes.json();

      setDashboardData({
        students: studentsData.students || [],
        instructors: instructorsData.instructors || [],
        pendingApps: appsData.applications || [],
        pendingComplaints: complaintsData.complaints || [],
        pendingGrad: gradData.applications || [],
        currentPeriod: periodData.period || 'registration',
        semesterNumber: periodData.semester || 1,
        programQuota: periodData.quota || 20,
        periodColors: { setup: 'var(--accent2)', registration: 'var(--success)', running: 'var(--accent)', grading: 'var(--warn)', closed: 'var(--muted)' },
        periodLabels: { setup: 'Class Set-Up', registration: 'Course Registration', running: 'Class Running', grading: 'Grading', closed: 'Closed' }
      });

    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [refreshTrigger]);

  // ===== Derived State =================================================================

  const { students, instructors, pendingApps, pendingComplaints, pendingGrad, currentPeriod, semesterNumber, programQuota, periodColors, periodLabels } = dashboardData;

  const activeStudents = students.filter(s => !s.terminated);
  const activeInstructors = instructors.filter(i => !i.fired && !i.terminated);

  // ===== Status Tag Functions =========================================================

  // Function to get student status tag
  const getStudentStatusTag = (student) => {
    if (student.terminated) {
      return student.graduated ? <Tag color="var(--danger)">Graduated</Tag> : <Tag color="var(--danger)">Terminated</Tag>;
    }
    if (student.suspended) {
      return <Tag color="var(--warn)">Suspended</Tag>;
    }
    if (student.honor_roll) {
      return <Tag color="var(--accent)">Honor Roll</Tag>;
    }
    return <Tag color="var(--success)">Active</Tag>;
  };

  // Function to get instructor status tag
  const getInstructorStatusTag = (instructor) => {
    if (instructor.fired || instructor.terminated) {
      return <Tag color="var(--danger)">Fired</Tag>;
    }
    if (instructor.suspended) {
      return <Tag color="var(--warn)">Suspended</Tag>;
    }
    return <Tag color="var(--success)">Active</Tag>;
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div>Loading registrar dashboard...</div>
      </div>
    );
  }

  return (
    <div>
      <PageTitle sub="Registrar Control Panel">Dashboard</PageTitle>

      {/* ── Quick Stats Row ──────────────────────────────────────────────────── */}
      {/* Clickable cards for applications and complaints navigate to their pages */}
      <Grid cols={4} style={{ marginBottom: '1.5rem' }}>
        {[
          { label: 'Students', value: activeStudents.length, color: 'var(--success)' },
          { label: 'Instructors', value: activeInstructors.length, color: 'var(--accent2)' },
          { label: 'Pending Applications', value: pendingApps.length, color: 'var(--warn)', action: () => navigate('applications') },
          { label: 'Pending Complaints', value: pendingComplaints.length, color: 'var(--danger)', action: () => navigate('complaints') },
        ].map(stat => (
          <Card key={stat.label} style={{ textAlign: 'center', cursor: stat.action ? 'pointer' : 'default', transition: 'border-color 0.2s' }}
            onClick={stat.action}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 700, color: stat.color }}>{stat.value}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</div>
          </Card>
        ))}
      </Grid>

      {/* ── Semester Status + Graduation Queue ──────────────────────────────── */}
      <Grid cols={2}>
        <Card>
          <SectionTitle>Semester Status</SectionTitle>
          <div style={{ marginBottom: '0.75rem' }}>
            <Tag color={periodColors[currentPeriod]}>Semester {semesterNumber}</Tag>
            {' '}
            <Tag color={periodColors[currentPeriod]}>{periodLabels[currentPeriod]}</Tag>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--muted)', marginBottom: '1rem' }}>
            Quota: {activeStudents.length} / {programQuota} students
          </div>
          <button style={{ background: 'var(--accent2)', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.5rem 1rem', fontFamily: 'var(--font-mono)', fontSize: '12px', cursor: 'pointer' }} onClick={() => navigate('semester')}>
            Manage Semester →
          </button>
        </Card>

        <Card>
          <SectionTitle>Graduation Queue</SectionTitle>
          {pendingGrad.length === 0 ? <p style={{ color: 'var(--muted)', fontSize: '13px' }}>No pending graduation applications.</p> : (
            pendingGrad.map(g => {
              const stu = students.find(s => s.id === g.student_id);
              return (
                <div key={g.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{stu?.name || g.student_id}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted)' }}>{g.completed_classes || 0} classes completed</div>
                  </div>
                  <Tag color="var(--warn)">Pending</Tag>
                </div>
              );
            })
          )}
        </Card>
      </Grid>

      {/* ── All Students Table ───────────────────────────────────────────────── */}
      <Card style={{ marginTop: '1.5rem' }}>
        <SectionTitle>All Students</SectionTitle>
        <Table
          headers={['ID', 'Name', 'GPA', 'Warnings', 'Status']}
          rows={students.map(stu => [
            stu.student_code || stu.id,
            stu.name,
            stu.gpa !== null ? stu.gpa.toFixed(2) : '—',
            <Tag key="w" color={stu.warnings > 0 ? 'var(--warn)' : 'var(--border)'}>{stu.warnings || 0}</Tag>,
            getStudentStatusTag(stu)
          ])}
          emptyMsg="No students found."
        />
      </Card>

      {/* ── All Instructors Table ────────────────────────────────────────────── */}
      <Card style={{ marginTop: '1.5rem' }}>
        <SectionTitle>All Instructors</SectionTitle>
        <Table
          headers={['Name', 'Classes', 'Warnings', 'Status']}
          rows={instructors.map(ins => [
            ins.name,
            ins.assigned_classes || '—',
            <Tag key="w" color={ins.warnings > 0 ? 'var(--warn)' : 'var(--border)'}>{ins.warnings || 0}</Tag>,
            getInstructorStatusTag(ins)
          ])}
          emptyMsg="No instructors found."
        />
      </Card>

      <AIChat />
    </div>
  );
}