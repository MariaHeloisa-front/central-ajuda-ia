import { BrowserRouter, Route, Routes } from 'react-router-dom'
import AskPage from './pages/AskPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AskPage />} />
      </Routes>
    </BrowserRouter>
  )
}
