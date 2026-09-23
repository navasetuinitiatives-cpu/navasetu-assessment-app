import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ASSESSMENT_QUESTIONS = [
  // Wellness & Physical Health (5 questions)
  { id: 1, domain: 'wellness', text: 'I maintain a regular sleep schedule (7-8 hours per night)', scale: 5 },
  { id: 2, domain: 'wellness', text: 'I engage in regular physical exercise or movement', scale: 5 },
  { id: 3, domain: 'wellness', text: 'I eat healthy and balanced meals regularly', scale: 5 },
  { id: 4, domain: 'wellness', text: 'I manage stress through meditation, yoga, or mindfulness', scale: 5 },
  { id: 5, domain: 'wellness', text: 'I maintain work-life balance and have adequate personal time', scale: 5 },

  // Emotional Wellness (5 questions)
  { id: 6, domain: 'wellness', text: 'I feel satisfied and fulfilled in my role as an educator', scale: 5 },
  { id: 7, domain: 'wellness', text: 'I have strong emotional support from friends and family', scale: 5 },
  { id: 8, domain: 'wellness', text: 'I can manage difficult emotions effectively', scale: 5 },
  { id: 9, domain: 'wellness', text: 'I feel positive about my future in education', scale: 5 },
  { id: 10, domain: 'wellness', text: 'I engage in activities that bring me joy and relaxation', scale: 5 },

  // Burnout Risk Indicators (8 questions)
  { id: 11, domain: 'burnout', text: 'I feel emotionally exhausted by my teaching responsibilities', scale: 5, reverse: true },
  { id: 12, domain: 'burnout', text: 'I experience compassion fatigue when dealing with student problems', scale: 5, reverse: true },
  { id: 13, domain: 'burnout', text: 'I feel cynical or detached from my students or colleagues', scale: 5, reverse: true },
  { id: 14, domain: 'burnout', text: 'I frequently feel frustrated with administrative demands', scale: 5, reverse: true },
  { id: 15, domain: 'burnout', text: 'I have adequate resources and support to perform my job well', scale: 5 },
  { id: 16, domain: 'burnout', text: 'I feel overworked and overwhelmed by my responsibilities', scale: 5, reverse: true },
  { id: 17, domain: 'burnout', text: 'I have time to complete my work within school hours', scale: 5 },
  { id: 18, domain: 'burnout', text: 'My workload is reasonable and manageable', scale: 5 },

  // Professional Competency - Subject Mastery (4 questions)
  { id: 19, domain: 'professional', text: 'I have strong command over the subject(s) I teach', scale: 5 },
  { id: 20, domain: 'professional', text: 'I stay updated with recent developments in my subject area', scale: 5 },
  { id: 21, domain: 'professional', text: 'I can explain complex concepts clearly to students', scale: 5 },
  { id: 22, domain: 'professional', text: 'I use subject-specific resources and best practices effectively', scale: 5 },

  // Professional Competency - Pedagogical Skills (4 questions)
  { id: 23, domain: 'professional', text: 'I employ diverse teaching methods to engage different learners', scale: 5 },
  { id: 24, domain: 'professional', text: 'I can assess student learning effectively and provide feedback', scale: 5 },
  { id: 25, domain: 'professional', text: 'I create an inclusive and supportive classroom environment', scale: 5 },
  { id: 26, domain: 'professional', text: 'I integrate technology effectively in my teaching', scale: 5 },

  // Professional Competency - Student Relations (3 questions)
  { id: 27, domain: 'professional', text: 'I build positive relationships with my students', scale: 5 },
  { id: 28, domain: 'professional', text: 'I understand and support student social-emotional development', scale: 5 },
  { id: 29, domain: 'professional', text: 'I handle student behavioral issues with patience and empathy', scale: 5 },

  // Professional Competency - Collaboration & Growth (4 questions)
  { id: 30, domain: 'professional', text: 'I collaborate effectively with colleagues and administrators', scale: 5 },
  { id: 31, domain: 'professional', text: 'I actively seek professional development opportunities', scale: 5 },
  { id: 32, domain: 'professional', text: 'I reflect on my teaching practice and implement improvements', scale: 5 },
  { id: 33, domain: 'professional', text: 'I mentor newer teachers and contribute to school improvement', scale: 5 },
]

export default function AssessmentPage() {
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [responses, setResponses] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { API_URL, token } = useAuth()
  const navigate = useNavigate()

  const question = ASSESSMENT_QUESTIONS[currentQuestion]
  const progress = ((currentQuestion + 1) / ASSESSMENT_QUESTIONS.length) * 100

  const handleResponse = (value) => {
    setResponses({ ...responses, [question.id]: value })
    if (currentQuestion < ASSESSMENT_QUESTIONS.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    try {
      // Calculate scores
      const wellness = calculateScore('wellness', responses)
      const burnout = calculateScore('burnout', responses)
      const professional = calculateScore('professional', responses)

      const res = await fetch(`${API_URL}/api/assessments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          responses,
          scores: { wellness, burnout, professional }
        })
      })

      if (!res.ok) throw new Error('Failed to submit assessment')
      const data = await res.json()
      navigate(`/report/${data.reportId}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = Object.keys(responses).length === ASSESSMENT_QUESTIONS.length

  return (
    <div className="page">
      <div style={{ maxWidth: '800px', width: '100%' }}>
        <div className="card">
          <h2 className="card-title">Teacher Wellness & Professional Competency Assessment</h2>

          {error && <div className="alert alert-error">{error}</div>}

          {/* Progress Bar */}
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ color: '#6b7280' }}>Question {currentQuestion + 1} of {ASSESSMENT_QUESTIONS.length}</span>
              <span style={{ color: '#D4AF37', fontWeight: 'bold' }}>{Math.round(progress)}%</span>
            </div>
            <div style={{ height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #D4AF37, #f0e68c)',
                transition: 'width 0.3s ease'
              }}></div>
            </div>
          </div>

          {/* Question */}
          <div className="questions-container">
            <div className="question-block">
              <div className="question-number">{currentQuestion + 1}</div>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{
                  fontSize: '0.8rem',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '12px',
                  background: question.domain === 'wellness' ? '#dbeafe' : question.domain === 'burnout' ? '#fef3c7' : '#dcfce7',
                  color: question.domain === 'wellness' ? '#1e40af' : question.domain === 'burnout' ? '#92400e' : '#166534'
                }}>
                  {question.domain === 'wellness' ? '🌟 Wellness' : question.domain === 'burnout' ? '⚠️ Burnout' : '🎓 Professional'}
                </span>
              </div>
              <p className="question-text">{question.text}</p>

              <div className="options-group">
                <label className="radio-option">
                  <input
                    type="radio"
                    name={`q${question.id}`}
                    value="1"
                    checked={responses[question.id] == 1}
                    onChange={() => handleResponse(1)}
                  />
                  <span>Strongly Disagree</span>
                </label>
                <label className="radio-option">
                  <input
                    type="radio"
                    name={`q${question.id}`}
                    value="2"
                    checked={responses[question.id] == 2}
                    onChange={() => handleResponse(2)}
                  />
                  <span>Disagree</span>
                </label>
                <label className="radio-option">
                  <input
                    type="radio"
                    name={`q${question.id}`}
                    value="3"
                    checked={responses[question.id] == 3}
                    onChange={() => handleResponse(3)}
                  />
                  <span>Neutral</span>
                </label>
                <label className="radio-option">
                  <input
                    type="radio"
                    name={`q${question.id}`}
                    value="4"
                    checked={responses[question.id] == 4}
                    onChange={() => handleResponse(4)}
                  />
                  <span>Agree</span>
                </label>
                <label className="radio-option">
                  <input
                    type="radio"
                    name={`q${question.id}`}
                    value="5"
                    checked={responses[question.id] == 5}
                    onChange={() => handleResponse(5)}
                  />
                  <span>Strongly Agree</span>
                </label>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          {currentQuestion === ASSESSMENT_QUESTIONS.length - 1 && (
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || loading}
              className="btn btn-primary btn-block"
              style={{ marginTop: '2rem' }}
            >
              {loading ? <span className="loading"></span> : null}
              {loading ? 'Submitting Assessment...' : 'Submit Assessment'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function calculateScore(domain, responses) {
  const domainQuestions = ASSESSMENT_QUESTIONS.filter(q => q.domain === domain)
  let total = 0
  let count = 0

  domainQuestions.forEach(q => {
    if (responses[q.id]) {
      let value = parseInt(responses[q.id])
      if (q.reverse) value = 6 - value // Reverse score for negative statements
      total += value
      count++
    }
  })

  return count > 0 ? Math.round((total / (count * 5)) * 100) : 0
}
