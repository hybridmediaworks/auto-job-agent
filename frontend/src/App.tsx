import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import Layout from '@/components/layout/Layout'
import Login from '@/pages/Login'
import SignUp from '@/pages/SignUp'
import VerifyEmail from '@/pages/VerifyEmail'
import ForgotPassword from '@/pages/ForgotPassword'
import ResetPassword from '@/pages/ResetPassword'
import Dashboard from '@/pages/Dashboard'
import Jobs from '@/pages/Jobs'
import JobDetails from '@/pages/JobDetails'
import Settings from '@/pages/Settings'
import Profiles from '@/pages/Profiles'
import ProfileEditor from '@/pages/ProfileEditor'
import SavedSearches from '@/pages/SavedSearches'
import Admin from '@/pages/Admin'
import Applications from '@/pages/Applications'
import ManualTailor from '@/pages/ManualTailor'

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
})

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: 'var(--bg-body)' }}>
      <div className="w-10 h-10 border-4 rounded-full animate-spin mb-4" style={{ borderColor: 'rgba(125,194,66,0.3)', borderTopColor: '#7DC242' }} />
      <p className="text-sm" style={{ color: '#7DC242' }}>HYBRID MediaWorks</p>
    </div>
  )
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAuthenticated, loading } = useAuth()
  if (loading) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!user?.is_admin) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route index element={<Dashboard />} />
                <Route path="jobs" element={<Jobs />} />
                <Route path="jobs/:id" element={<JobDetails />} />
                <Route path="settings" element={<Settings />} />
                <Route path="profiles" element={<Profiles />} />
                <Route path="profiles/:id/edit" element={<ProfileEditor />} />
                <Route path="saved-searches" element={<SavedSearches />} />
                <Route path="applications" element={<Applications />} />
                <Route path="manual-tailor" element={<ManualTailor />} />
              </Route>
              <Route path="/admin" element={<AdminRoute><Layout /></AdminRoute>}>
                <Route index element={<Admin />} />
              </Route>
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
