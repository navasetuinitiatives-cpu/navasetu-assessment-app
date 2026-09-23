import { createContext, useState, useContext } from 'react'

const AuthContext = createContext()

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [loading, setLoading] = useState(false)

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

  const register = async (userData) => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Registration failed')
      setUser(data.user)
      setToken(data.token)
      localStorage.setItem('token', data.token)
      return data
    } catch (error) {
      throw error
    } finally {
      setLoading(false)
    }
  }

  const login = async (email, password) => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Login failed')
      setUser(data.user)
      setToken(data.token)
      localStorage.setItem('token', data.token)
      return data
    } catch (error) {
      throw error
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    setUser(null)
    setToken(null)
    localStorage.removeItem('token')
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, register, login, logout, API_URL }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
