import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'

function App() {
  return (
    <Router>
      <div className="app">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/assessment/:assessmentId" element={<AssessmentPage />} />
          <Route path="/report/:reportId" element={<ReportPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
        </Routes>
      </div>
    </Router>
  )
}

function HomePage() {
  return (
    <div>
      <h1>NavaSetu - Teacher Assessment Platform</h1>
      <p>Welcome to the teacher wellness and professional competence assessment platform.</p>
    </div>
  )
}

function RegisterPage() {
  return <div><h2>Register</h2></div>
}

function LoginPage() {
  return <div><h2>Login</h2></div>
}

function AssessmentPage() {
  return <div><h2>Assessment</h2></div>
}

function ReportPage() {
  return <div><h2>Report</h2></div>
}

function DashboardPage() {
  return <div><h2>Dashboard</h2></div>
}

export default App
