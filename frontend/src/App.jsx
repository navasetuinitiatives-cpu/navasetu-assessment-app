import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import './App.css'

// Pages
import HomePage from './pages/HomePage'
import RegisterPage from './pages/RegisterPage'
import LoginPage from './pages/LoginPage'
import SchoolSelectionPage from './pages/SchoolSelectionPage'
import AssessmentPage from './pages/AssessmentPage'
import ReportPage from './pages/ReportPage'
import DashboardPage from './pages/DashboardPage'
import ConsultationPage from './pages/ConsultationPage'

// Context for auth state
import { AuthProvider } from './context/AuthContext'

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/select-school" element={<SchoolSelectionPage />} />
            <Route path="/assessment" element={<AssessmentPage />} />
            <Route path="/report/:reportId" element={<ReportPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/consultation/:reportId" element={<ConsultationPage />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  )
}

export default App
