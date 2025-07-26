import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  IconButton,
  Menu,
  MenuItem
} from '@mui/material';
import {
  Dashboard,
  People,
  AttachMoney,
  BarChart,
  Settings,
  AccountCircle,
  ExitToApp
} from '@mui/icons-material';

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [anchorEl, setAnchorEl] = React.useState(null);
  
  const isAuthenticated = localStorage.getItem('agentToken');
  const agentInfo = JSON.parse(localStorage.getItem('agentInfo') || '{}');

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    localStorage.removeItem('agentToken');
    localStorage.removeItem('agentInfo');
    navigate('/login');
    handleClose();
  };

  const menuItems = [
    { path: '/dashboard', label: '数据面板', icon: <Dashboard /> },
    { path: '/users', label: '用户管理', icon: <People /> },
    { path: '/commission', label: '佣金管理', icon: <AttachMoney /> },
    { path: '/statistics', label: '数据统计', icon: <BarChart /> },
    { path: '/settings', label: '设置', icon: <Settings /> },
  ];

  if (location.pathname === '/login') {
    return null;
  }

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          代理后台管理系统
        </Typography>
        
        {isAuthenticated && (
          <>
            <Box sx={{ display: 'flex', gap: 2 }}>
              {menuItems.map((item) => (
                <Button
                  key={item.path}
                  color="inherit"
                  startIcon={item.icon}
                  onClick={() => navigate(item.path)}
                  sx={{
                    backgroundColor: location.pathname === item.path ? 'rgba(255,255,255,0.1)' : 'transparent'
                  }}
                >
                  {item.label}
                </Button>
              ))}
            </Box>
            
            <IconButton
              size="large"
              onClick={handleMenu}
              color="inherit"
            >
              <AccountCircle />
            </IconButton>
            
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleClose}
            >
              <MenuItem onClick={handleClose}>
                <Typography>{agentInfo.name || '代理商'}</Typography>
              </MenuItem>
              <MenuItem onClick={handleLogout}>
                <ExitToApp sx={{ mr: 1 }} />
                退出登录
              </MenuItem>
            </Menu>
          </>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default Header;