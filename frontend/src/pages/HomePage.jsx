import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function HomePage() {
  const { user } = useAuth()

  return (
    <div className="page">
      <div className="container">
        <div style={{ textAlign: 'center', marginBottom: '4rem', color: 'white' }}>
          <h1 style={{ fontSize: '3.5rem', marginBottom: '1rem', color: '#D4AF37' }}>
            NavaSetu
          </h1>
          <p style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>
            Teacher Wellness & Professional Competency Assessment Platform
          </p>
          <p style={{ fontSize: '1rem', opacity: 0.9, maxWidth: '600px', margin: '0 auto' }}>
            Discover your strengths, explore growth opportunities, and navigate your professional journey with expert guidance.
          </p>
        </div>

        {!user ? (
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '4rem', flexWrap: 'wrap' }}>
            <Link to="/register" className="btn btn-primary">
              Get Started
            </Link>
            <Link to="/login" className="btn btn-outline">
              Already have an account? Sign In
            </Link>
          </div>
        ) : (
          <div style={{ textAlign: 'center', marginBottom: '2rem', color: 'white' }}>
            <p>Welcome back, {user.full_name}!</p>
            <Link to="/dashboard" className="btn btn-primary" style={{ marginTop: '1rem' }}>
              Go to Dashboard
            </Link>
          </div>
        )}

        {/* Plan Cards */}
        <div className="assessment-grid">
          <div className="assessment-card">
            <h3>🔍 Discover</h3>
            <p>Begin your assessment journey with a comprehensive evaluation of your wellness and professional competency.</p>
            <div className="plan-badge plan-discover">Foundational Assessment</div>
            <ul style={{ textAlign: 'left', color: '#6b7280', marginTop: '1rem', fontSize: '0.9rem' }}>
              <li>✓ Core wellness evaluation</li>
              <li>✓ Burnout risk assessment</li>
              <li>✓ Professional competency baseline</li>
              <li>✓ Initial insights report</li>
            </ul>
          </div>

          <div className="assessment-card">
            <h3>🌟 Explore</h3>
            <p>Go deeper with advanced analysis and personalized recommendations for growth and development.</p>
            <div className="plan-badge plan-explore">In-depth Analysis</div>
            <ul style={{ textAlign: 'left', color: '#6b7280', marginTop: '1rem', fontSize: '0.9rem' }}>
              <li>✓ Detailed psychometric analysis</li>
              <li>✓ Domain-specific scores</li>
              <li>✓ Personalized recommendations</li>
              <li>✓ Growth roadmap</li>
            </ul>
          </div>

          <div className="assessment-card">
            <h3>🧭 Navigate</h3>
            <p>Complete guidance with expert consultation to develop and implement your personalized action plan.</p>
            <div className="plan-badge plan-navigate">Expert Guidance</div>
            <ul style={{ textAlign: 'left', color: '#6b7280', marginTop: '1rem', fontSize: '0.9rem' }}>
              <li>✓ All Explore features</li>
              <li>✓ 1-on-1 expert consultation</li>
              <li>✓ Custom action plan</li>
              <li>✓ Follow-up support</li>
            </ul>
          </div>
        </div>

        {/* Key Features */}
        <div style={{ marginTop: '4rem', background: 'rgba(255, 255, 255, 0.05)', padding: '3rem', borderRadius: '12px', color: 'white', border: '1px solid #D4AF37' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '2rem', color: '#D4AF37' }}>Why Choose NavaSetu?</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem' }}>
            <div>
              <h4 style={{ color: '#D4AF37', marginBottom: '0.5rem' }}>🎯 Evidence-Based</h4>
              <p>Grounded in educational research and psychological science</p>
            </div>
            <div>
              <h4 style={{ color: '#D4AF37', marginBottom: '0.5rem' }}>🛡️ Confidential</h4>
              <p>Your data is secure and private. Assessment results are for you.</p>
            </div>
            <div>
              <h4 style={{ color: '#D4AF37', marginBottom: '0.5rem' }}>👥 Support Network</h4>
              <p>Connect with expert consultants and fellow educators</p>
            </div>
            <div>
              <h4 style={{ color: '#D4AF37', marginBottom: '0.5rem' }}>📊 Actionable Insights</h4>
              <p>Get clear, implementable recommendations for growth</p>
            </div>
            <div>
              <h4 style={{ color: '#D4AF37', marginBottom: '0.5rem' }}>🏫 School Dashboard</h4>
              <p>School admins can track aggregate wellness metrics</p>
            </div>
            <div>
              <h4 style={{ color: '#D4AF37', marginBottom: '0.5rem' }}>📈 Track Progress</h4>
              <p>Reassess periodically to monitor your growth journey</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
