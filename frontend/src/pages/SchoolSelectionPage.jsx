import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function SchoolSelectionPage() {
  const [schools, setSchools] = useState([])
  const [newSchool, setNewSchool] = useState({
    name: '',
    district: '',
    state: '',
    school_type: 'private'
  })
  const [mode, setMode] = useState('join') // 'join' or 'create'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { API_URL, token } = useAuth()
  const navigate = useNavigate()

  const handleCreateSchool = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/schools`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newSchool)
      })
      if (!res.ok) throw new Error('Failed to create school')
      navigate('/assessment')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSkip = () => {
    navigate('/assessment')
  }

  return (
    <div className="page">
      <div className="card" style={{ maxWidth: '600px', width: '100%' }}>
        <h2 className="card-title">Join or Create a School</h2>
        
        {error && <div className="alert alert-error">{error}</div>}

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
          <button
            onClick={() => setMode('join')}
            className="btn"
            style={{
              flex: 1,
              background: mode === 'join' ? '#D4AF37' : '#e5e7eb',
              color: mode === 'join' ? '#0B1929' : '#6b7280',
              border: 'none'
            }}
          >
            Join Existing School
          </button>
          <button
            onClick={() => setMode('create')}
            className="btn"
            style={{
              flex: 1,
              background: mode === 'create' ? '#D4AF37' : '#e5e7eb',
              color: mode === 'create' ? '#0B1929' : '#6b7280',
              border: 'none'
            }}
          >
            Create New School
          </button>
        </div>

        {mode === 'join' && (
          <div>
            <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
              Ask your school administrator for the school code to join your school.
            </p>
            <div className="form-group">
              <label className="form-label">School Code</label>
              <input type="text" className="form-input" placeholder="Enter school code" />
            </div>
            <button className="btn btn-primary btn-block">Join School</button>
          </div>
        )}

        {mode === 'create' && (
          <form onSubmit={handleCreateSchool}>
            <div className="form-group">
              <label className="form-label">School Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g., Delhi Public School"
                value={newSchool.name}
                onChange={(e) => setNewSchool({ ...newSchool, name: e.target.value })}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">District</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="District"
                  value={newSchool.district}
                  onChange={(e) => setNewSchool({ ...newSchool, district: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">State</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="State"
                  value={newSchool.state}
                  onChange={(e) => setNewSchool({ ...newSchool, state: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">School Type</label>
              <select
                className="form-select"
                value={newSchool.school_type}
                onChange={(e) => setNewSchool({ ...newSchool, school_type: e.target.value })}
              >
                <option value="government">Government</option>
                <option value="private">Private</option>
                <option value="semi-private">Semi-Private</option>
              </select>
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Creating...' : 'Create School'}
            </button>
          </form>
        )}

        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <button onClick={handleSkip} className="btn btn-outline" style={{ width: '100%' }}>
            Skip for Now
          </button>
        </div>
      </div>
    </div>
  )
}
