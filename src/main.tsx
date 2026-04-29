/* eslint-disable react-refresh/only-export-components */
import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import App from './App.tsx'

// Lazy load heavy components
const PersonalDataInput = lazy(() => import('./components/simulator/PersonalDataInput'))
const RangeScreen = lazy(() => import('./pages/RangeScreen'))
const CustomCourseEditorScreen = lazy(() => import('./components/simulator/CustomCourseEditorScreen'))
const RoundHistoryScreen = lazy(() => import('./components/simulator/RoundHistoryScreen'))
const AdminClubs = lazy(() => import('./pages/AdminClubs'))
const SimulatorScreen = lazy(() => import('./pages/SimulatorScreen'))

// Simple loading fallback
const PageLoadingFallback = () => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '100vh',
    fontFamily: 'system-ui, sans-serif'
  }}>
    読み込み中...
  </div>
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoadingFallback />}>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/simulator" element={<SimulatorScreen />} />
            <Route path="/course-editor" element={<CustomCourseEditorScreen />} />
            <Route path="/personal-data" element={<PersonalDataInput />} />
            <Route path="/range" element={<RangeScreen />} />
            <Route path="/round-history" element={<RoundHistoryScreen />} />
            <Route path="/admin/clubs" element={<AdminClubs />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </HelmetProvider>
  </StrictMode>,
)
