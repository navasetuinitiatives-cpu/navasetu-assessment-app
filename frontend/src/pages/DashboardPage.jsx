import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function DashboardPage() {
  const { user, token, logout, API_URL } = useAuth()
  const [assessments, setAssessments] = useState([])
  const [schoolData, setSchoolData] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }

    const fetchData = async () => {
      try {
        const res = await fetch(`${API_URL}/api/assessments`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (res.ok) {
          const data = await res.json()
          setAssessments(data)
        }

        // If school admin, fetch school analytics
        if (user.role === 'school_admin') {
          const schoolRes = await fetch(`${API_URL}/api/schools/analytics`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
          if (schoolRes.ok) {
            const schoolAnalytics = await schoolRes.json()
            setSchoolData(schoolAnalytics)
          }
        }
      } catch (err) {
        console.error('Failed to fetch data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user, token, API_URL, navigate])

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: '1200px', color: 'white' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem', color: '#D4AF37' }}>Dashboard</h1>
            <p style={{ fontSize: '1.1rem' }}>Welcome back, {user?.full_name}</p>
          </div>
          <button onClick={handleLogout} className="btn btn-secondary">
            Logout
          </button>
        </div>

        {/* Individual Teacher Dashboard */}
        {user?.role === 'individual' && (
          <>
            {/* Quick Action */}
            <div className="card" style={{ marginBottom: '2rem', textAlign: 'center', background: 'linear-gradient(135deg, #D4AF37, #f0e68c)' }}>
              <h2 style={{ color: '#0B1929', marginBottom: '1rem' }}>Start a New Assessment</h2>
              <p style={{ color: '#0B1929', marginBottom: '1.5rem', maxWidth: '500px', margin: '0 auto 1.5rem' }}>
                Take a fresh assessment to track your wellness and professional growth over time.
              </p>
              <Link to="/assessment" className="btn btn-primary">
                Begin New Assessment
              </Link>
            </div>

            {/* Assessment History */}
            <div className="card">
              <h2 className="card-title">Your Assessment History</h2>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}><div className="loading"></div></div>
              ) : assessments.length === 0 ? (
                <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>
                  No assessments yet. Start your first assessment to see your results here.
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                        <th style={{ padding: '1rem', textAlign: 'left', color: '#D4AF37' }}>Date</th>
                        <th style={{ padding: '1rem', textAlign: 'left', color: '#D4AF37' }}>Wellness</th>
                        <th style={{ padding: '1rem', textAlign: 'left', color: '#D4AF37' }}>Burnout Risk</th>
                        <th style={{ padding: '1rem', textAlign: 'left', color: '#D4AF37' }}>Professional</th>
                        <th style={{ padding: '1rem', textAlign: 'left', color: '#D4AF37' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assessments.map((assessment) => (
                        <tr key={assessment.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '1rem', color: '#6b7280' }}>{new Date(assessment.created_at).toLocaleDateString()}</td>
                          <td style={{ padding: '1rem', color: '#10b981' }}>{assessment.scores?.wellness || '--'}%</td>
                          <td style={{ padding: '1rem', color: assessment.scores?.burnout > 60 ? '#ef4444' : '#D4AF37' }}>{assessment.scores?.burnout || '--'}%</td>
                          <td style={{ padding: '1rem', color: '#D4AF37' }}>{assessment.scores?.professional || '--'}%</td>
                          <td style={{ padding: '1rem' }}>
                            {assessment.reportId ? (
                              <Link to={`/report/${assessment.reportId}`} style={{ color: '#D4AF37', textDecoration: 'underline' }}>
                                View Report
                              </Link>
                            ) : (
                              <span style={{ color: '#6b7280' }}>Pending</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* School Admin Dashboard */}
        {user?.role === 'school_admin' && (
          <>
            {/* School Analytics Overview */}
            {schoolData && (
              <div className="assessment-grid" style={{ marginBottom: '2rem' }}>
                <div className="assessment-card" style={{ background: '#0B1929', border: '2px solid #D4AF37' }}>
                  <h3 style={{ color: '#D4AF37' }}>Total Teachers</h3>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#D4AF37', margin: '1rem 0' }}>
                    {schoolData.total_teachers || 0}
                  </div>
                </div>
                <div className="assessment-card" style={{ background: '#0B1929', border: '2px solid #D4AF37' }}>
                  <h3 style={{ color: '#D4AF37' }}>Completed Assessments</h3>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#D4AF37', margin: '1rem 0' }}>
                    {schoolData.completed_assessments || 0}
                  </div>
                </div>
                <div className="assessment-card" style={{ background: '#0B1929', border: '2px solid #ef4444' }}>
                  <h3 style={{ color: '#ef4444' }}>High Burnout Risk</h3>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#ef4444', margin: '1rem 0' }}>
                    {schoolData.high_burnout_count || 0}
                  </div>
                </div>
              </div>
            )}

            {/* School Admin Actions */}
            <div className="card">
              <h2 className="card-title">School Management</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <Link to="/dashboard" className="btn btn-secondary btn-block">
                  View All Teachers
                </Link>
                <Link to="/dashboard" className="btn btn-secondary btn-block">
                  Download Report
                </Link>
                <Link to="/dashboard" className="btn btn-secondary btn-block">
                  School Settings
                </Link>
                <Link to="/dashboard" className="btn btn-secondary btn-block">
                  Invite Teachers
                </Link>
              </div>
            </div>

            {/* Aggregate Wellness Trends */}
            {schoolData && (
              <div className="card" style={{ marginTop: '2rem' }}>
                <h2 className="card-title">School Wellness Overview</h2>
                <div className="score-grid">
                  <div className="score-item">
                    <h3>Avg Wellness Score</h3>
                    <div className="score-value">{schoolData.avg_wellness_score || '--'}%</div>
                  </div>
                  <div className="score-item">
                    <h3>Avg Burnout Risk</h3>
                    <div className="score-value" style={{ color: schoolData.avg_burnout_score >= 60 ? '#ef4444' : '#D4AF37' }}>
                      {schoolData.avg_burnout_score || '--'}%
                    </div>
                  </div>
                  <div className="score-item">
                    <h3>Avg Professional Score</h3>
                    <div className="score-value">{schoolData.avg_professional_score || '--'}%</div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
