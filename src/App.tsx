import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import RequireAuth from './auth/RequireAuth'
import AskPage from './pages/AskPage'
import LoginPage from './pages/LoginPage'
import AdminLayout from './pages/admin/AdminLayout'
import ArticleFormPage from './pages/admin/ArticleFormPage'
import ArticleListPage from './pages/admin/ArticleListPage'
import UnansweredPage from './pages/admin/UnansweredPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AskPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/admin"
            element={
              <RequireAuth>
                <AdminLayout />
              </RequireAuth>
            }
          >
            <Route index element={<ArticleListPage />} />
            <Route path="artigos/novo" element={<ArticleFormPage />} />
            <Route path="artigos/:id" element={<ArticleFormPage />} />
            <Route path="sem-resposta" element={<UnansweredPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
