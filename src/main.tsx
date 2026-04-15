import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import App from './App.tsx'
import { PersonalDataInput } from './components/simulator/PersonalDataInput'
import RangeScreen from './pages/RangeScreen'
import { CustomCourseEditorScreen } from './components/simulator/CustomCourseEditorScreen'
import AdminClubs from './pages/AdminClubs'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/course-editor" element={<CustomCourseEditorScreen />} />
          <Route path="/personal-data" element={<PersonalDataInput />} />
          <Route path="/range" element={<RangeScreen />} />
          <Route path="/admin/clubs" element={<AdminClubs />} />
        </Routes>
      </BrowserRouter>
    </HelmetProvider>
  </StrictMode>,
)
