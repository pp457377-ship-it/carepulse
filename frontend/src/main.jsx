import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: { background: '#111827', color: '#e2e8f0', border: '1px solid #243049', fontSize: 13 },
          success: { iconTheme: { primary: '#10b981', secondary: '#07090f' } },
          error: { iconTheme: { primary: '#f43f5e', secondary: '#07090f' } },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>,
)
