import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ConsultationPage() {
  const { reportId } = useParams()
  const [formData, setFormData] = useState({
    date: '',
    time: '',
    notes: ''
  })
  const [consultants, setConsultants] = useState([])
  const [selectedConsultant, setSelectedConsultant] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const { API_URL, token } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const fetchConsultants = async () => {
      try {
        const res = await fetch(`${API_URL}/api/consultants`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (res.ok) {
          const data = await res.json()
          setConsultants(data)
          if (data.length > 0) setSelectedConsultant(data[0].id)
        }
      } catch (err) {
        console.error('Failed to fetch consultants:', err)
      }
    }
    fetchConsultants()
  }, [API_URL, token])

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`${API_URL}/api/consultation-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          reportId,
          consultant_id: selectedConsultant,
          scheduled_at: `${formData.date}T${formData.time}`,
          notes: formData.notes
        })
      })

      if (!res.ok) throw new Error('Failed to schedule consultation')
      setSuccess(true)
      setTimeout(() => navigate('/dashboard'), 2000)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <div className="card" style={{ maxWidth: '700px', width: '100%' }}>
        <h2 className="card-title">Schedule Expert Consultation</h2>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">✓ Consultation scheduled successfully! Redirecting...</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Select Expert Consultant</label>
            <select
              className="form-select"
              value={selectedConsultant || ''}
              onChange={(e) => setSelectedConsultant(e.target.value)}
              required
            >
              <option value="">Choose a consultant...</option>
              {consultants.map(consultant => (
                <option key={consultant.id} value={consultant.id}>
                  {consultant.user?.full_name} - {consultant.specialization}
                </option>
              ))}
            </select>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '0.5rem' }}>
              Our consultants specialize in educator wellness and professional development
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Consultation Date</label>
            <input
              type="date"
              name="date"
              className="form-input"
              value={formData.date}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Preferred Time</label>
            <input
              type="time"
              name="time"
              className="form-input"
              value={formData.time}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Discussion Topics / Notes (Optional)</label>
            <textarea
              name="notes"
              className="form-textarea"
              placeholder="What would you like to focus on during your consultation?"
              value={formData.notes}
              onChange={handleChange}
            ></textarea>
          </div>

          <div className="alert alert-info">
            <p style={{ margin: 0 }}>
              💡 <strong>Tip:</strong> One-on-one consultations are conducted via Zoom. A confirmation link will be sent to your email.
            </p>
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? <span className="loading"></span> : null}
            {loading ? 'Scheduling...' : 'Schedule Consultation'}
          </button>
        </form>

        <p style={{ marginTop: '1.5rem', textAlign: 'center', color: '#6b7280', fontSize: '0.9rem' }}>
          Duration: 30 minutes | Rate: ₹500/session
        </p>
      </div>
    </div>
  )
}
