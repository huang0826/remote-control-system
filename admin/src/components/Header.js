import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import DevicesIcon from '@mui/icons-material/Devices';

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const isLoggedIn = localStorage.getItem('token') !== null;
  
  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };
  
  return (
    <AppBar position="static">
      <Toolbar>
        <Box display="flex" alignItems="center" sx={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
          <DevicesIcon sx={{ mr: 1 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            远程控制系统
          </Typography>
        </Box>
        
        <Box sx={{ flexGrow: 1 }} />
        
        {isLoggedIn ? (
          <>
            <Button 
              color="inherit" 
              onClick={() => navigate('/devices')}
              sx={{ mx: 1, fontWeight: location.pathname.includes('/devices') ? 'bold' : 'normal' }}
            >
              设备管理
            </Button>
            <Button color="inherit" onClick={handleLogout}>退出登录</Button>
          </>
        ) : (
          <Button color="inherit" onClick={() => navigate('/login')}>登录</Button>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default Header;