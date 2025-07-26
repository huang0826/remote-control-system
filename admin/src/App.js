import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';

import Header from './components/Header';
import Login from './components/Login';
import DeviceList from './components/DeviceList';
import DeviceControl from './components/DeviceControl';

import FileBrowser from './components/FileBrowser';

// 创建主题
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

// 保护路由组件
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = localStorage.getItem('token') !== null;
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

// 在路由配置中添加
<Route path="/device/:deviceId/files" element={isAuthenticated ? <FileBrowser /> : <Navigate to="/login" />} />

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Header />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/devices" replace />} />
          <Route 
            path="/devices" 
            element={
              <ProtectedRoute>
                <DeviceList />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/control/:deviceId" 
            element={
              <ProtectedRoute>
                <DeviceControl />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/device/:deviceId/files" 
            element={
              <ProtectedRoute>
                <FileBrowser />
              </ProtectedRoute>
            } 
          />
          <Route path="*" element={<Navigate to="/devices" replace />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;