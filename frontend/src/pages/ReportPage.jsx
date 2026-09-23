import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ReportPage() {
  const { reportId } = useParams()
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { API_URL, token } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const res = await fetch(`${API_URL}/api/reports/${reportId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (!res.ok) throw new Error('Failed to load report')
        const data = await res.json()
        setReport(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchReport()
  }, [reportId, API_URL, token])

  if (loading) return <div className="page"><div className="loading"></div></div>
  if (error) return <div className="page"><div className="alert alert-error">{error}</div></div>
  if (!report) return <div className="page"><div className="alert alert-error">Report not found</div></div>

  return (
    <div className="page">
      <div className="report-container">
        <div className="report-header">
          <h1>Your Assessment Report</h1>
          <p style={{ marginTop: '0.5rem', opacity: 0.9 }}>
            {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Plan Type Indicator */}
        <div className="report-section">
          <h2>📋 Your Selected Plan</h2>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div className={`plan-badge plan-${report.plan_type?.toLowerCase() || 'discover'}`} style={{ fontSize: '1rem', padding: '0.75rem 1.5rem' }}>
              {report.plan_type || 'Discover'}
            </div>
            <p style={{ color: '#6b7280', flex: 1 }}>
              {report.plan_type === 'Discover' && 'Foundational assessment with core insights'}
              {report.plan_type === 'Explore' && 'In-depth analysis with personalized recommendations'}
              {report.plan_type === 'Navigate' && 'Expert guidance with consultation support'}
            </p>
          </div>
        </div>

        {/* Core Scores */}
        <div className="report-section">
          <h2>📊 Your Assessment Scores</h2>
          <div className="score-grid">
            <div className="score-item">
              <h3>Wellness Score</h3>
              <div className="score-value">{report.wellness_score || 75}%</div>
              <div className="score-interpretation">
                {report.wellness_score >= 70 ? '✓ Strong' : report.wellness_score >= 50 ? '⚠️ Moderate' : '⚠️ Needs Attention'}
              </div>
            </div>
            <div className="score-item">
              <h3>Burnout Risk</h3>
              <div className="score-value" style={{ color: report.burnout_score >= 60 ? '#ef4444' : '#D4AF37' }}>
                {report.burnout_score || 45}%
              </div>
              <div className="score-interpretation">
                {report.burnout_score >= 60 ? '⚠️ High Risk' : report.burnout_score >= 40 ? '⚠️ Moderate' : '✓ Low Risk'}
              </div>
            </div>
            <div className="score-item">
              <h3>Professional Competency</h3>
              <div className="score-value">{report.professional_score || 78}%</div>
              <div className="score-interpretation">
                {report.professional_score >= 70 ? '✓ Strong' : report.professional_score >= 50 ? '⚠️ Developing' : '⚠️ Needs Support'}
              </div>
            </div>
          </div>
        </div>

        {/* Insights (All Plans) */}
        <div className="report-section">
          <h2>💡 Key Insights</h2>
          <ul className="recommendation-list">
            <li className="recommendation-item">
              <strong>Wellness Focus:</strong> Your wellness score indicates {report.wellness_score >= 70 ? 'good self-care practices' : 'opportunities to prioritize personal wellbeing'}. Consider dedicating time for stress management activities.
            </li>
            <li className="recommendation-item">
              <strong>Burnout Assessment:</strong> {report.burnout_score >= 60 ? 'You may be experiencing significant stress. Consider discussing support options with your school.' : 'Your burnout risk is manageable, but stay vigilant about work-life balance.'}
            </li>
            <li className="recommendation-item">
              <strong>Professional Growth:</strong> Your professional competency is {report.professional_score >= 70 ? 'strong' : 'developing'}. Identify specific areas for continued skill development and pursue targeted professional development.
            </li>
          </ul>
        </div>

        {/* Recommendations (Explore & Navigate Plans) */}
        {(report.plan_type === 'Explore' || report.plan_type === 'Navigate') && (
          <div className="report-section">
            <h2>🎯 Personalized Recommendations</h2>
            {report.recommendations && (
              <ul className="recommendation-list">
                {Array.isArray(report.recommendations) && report.recommendations.map((rec, idx) => (
                  <li key={idx} className="recommendation-item">{rec}</li>
                ))}
              </ul>
            )}
            {!report.recommendations && (
              <ul className="recommendation-list">
                <li className="recommendation-item"><strong>Wellness Strategy:</strong> Establish a consistent self-care routine including physical exercise, adequate sleep, and mindfulness practices.</li>
                <li className="recommendation-item"><strong>Stress Management:</strong> Identify and address key stressors. Consider peer support, mentorship, or counseling resources.</li>
                <li className="recommendation-item"><strong>Professional Development:</strong> Invest in targeted skill development in areas of interest or need.</li>
                <li className="recommendation-item"><strong>Work-Life Balance:</strong> Set clear boundaries between work and personal time to prevent burnout.</li>
              </ul>
            )}
          </div>
        )}

        {/* Consultation Option (Navigate Plan) */}
        {report.plan_type === 'Navigate' && (
          <div className="report-section">
            <h2>👥 Expert Consultation</h2>
            <p style={{ marginBottom: '1.5rem', color: '#6b7280' }}>
              Your Navigate plan includes a one-on-one consultation with an expert educator who can help you develop a personalized action plan based on your assessment results.
            </p>
            <Link to={`/consultation/${reportId}`} className="btn btn-primary btn-block">
              Schedule Expert Consultation
            </Link>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '2rem' }}>
          <Link to="/dashboard" className="btn btn-secondary btn-block">
            Back to Dashboard
          </Link>
          <button
            onClick={() => window.print()}
            className="btn btn-primary btn-block"
            style={{ background: '#0B1929', border: '2px solid #D4AF37' }}
          >
            Print Report
          </button>
        </div>
      </div>
    </div>
  )
}
