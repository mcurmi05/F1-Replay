import { Navigate, Route, Routes } from 'react-router-dom'
import CacheGate from './components/CacheGate'
import Layout from './components/Layout'
import Home from './pages/Home'
import Live from './pages/Live'
import Replay from './pages/Replay'

function App() {
  return (
    <CacheGate>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/home" replace />} />
          <Route path="home" element={<Home />} />
          <Route path="live" element={<Live />} />
          <Route path="replay/:year/:event/:session" element={<Replay />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Route>
      </Routes>
    </CacheGate>
  )
}

export default App
