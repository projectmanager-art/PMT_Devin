import { useState } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { AppProvider } from './store'
import { Sidebar } from './components/Sidebar'
import { Topbar } from './components/Topbar'
import { Dashboard } from './pages/Dashboard'
import { Login } from './pages/Login'
import { Projects } from './pages/Projects'
import { ProjectDetail } from './pages/ProjectDetail'
import { Tasks } from './pages/Tasks'
import { TaskDetail } from './pages/TaskDetail'
import { Timeline } from './pages/Timeline'
import { CalendarPage } from './pages/CalendarPage'
import { Clients } from './pages/Clients'
import { Team } from './pages/Team'
import { Reports } from './pages/Reports'
import { Risks } from './pages/Risks'
import { Meetings } from './pages/Meetings'
import { Documents } from './pages/Documents'
import { Settings } from './pages/Settings'
import { SprintIQ } from './pages/SprintIQ'
import { SprintProvider } from './lib/sprintStore'

const AUTH_KEY = 'nexora-auth'

function Layout({ onLogout }: { onLogout: () => void }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-[29] bg-ink/20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <div className="flex min-h-screen w-full flex-col lg:ml-[245px] lg:w-[calc(100%-245px)]">
        <Topbar onLogout={onLogout} onMenuClick={() => setSidebarOpen((v) => !v)} />
        <main className="min-w-0 flex-1">
          <div key={location.pathname} className="page-enter">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

function AppContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(AUTH_KEY) === 'true'
  })

  const handleLogin = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(AUTH_KEY, 'true')
    }
    setIsAuthenticated(true)
  }

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(AUTH_KEY)
    }
    setIsAuthenticated(false)
  }

  return isAuthenticated ? (
    <Routes>
      <Route element={<Layout onLogout={handleLogout} />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:projectId" element={<ProjectDetail />} />
        <Route path="/projects/:projectId/tasks/:taskId" element={<TaskDetail />} />
        <Route path="/tasks" element={<SprintProvider><Tasks /></SprintProvider>} />
        <Route path="/tasks/:taskId" element={<TaskDetail />} />
        <Route path="/timeline" element={<Timeline />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/team" element={<Team />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/sprintiq" element={<SprintIQ />} />
        <Route path="/reports/sprintiq" element={<Navigate to="/sprintiq" replace />} />
        <Route path="/sprints" element={<Navigate to="/tasks?view=sprints" replace />} />
        <Route path="/risks" element={<Risks />} />
        <Route path="/meetings" element={<Meetings />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  ) : (
    <Login onLogin={handleLogin} />
  )
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AppProvider>
  )
}
