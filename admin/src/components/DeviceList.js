import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Container, Typography, List, ListItem, ListItemText, ListItemSecondaryAction,
  Button, Paper, Divider, Chip, Box, CircularProgress, Alert, Grid,
  Card, CardContent, CardActions, IconButton, Tooltip
} from '@mui/material';
import {
  Devices as DevicesIcon,
  Videocam as VideocamIcon,
  Folder as FolderIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  PhoneAndroid as PhoneAndroidIcon,
  SignalWifi4Bar as OnlineIcon,
  SignalWifiOff as OfflineIcon
} from '@mui/icons-material';
import ApiService from '../services/api';

const DeviceList = () => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await ApiService.getDevices();
      setDevices(data.data || []);
    } catch (error) {
      console.error('Error fetching devices:', error);
      setError(error.message || '获取设备列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleControlDevice = (deviceId) => {
    navigate(`/control/${deviceId}`);
  };

  const handleViewFiles = (deviceId) => {
    navigate(`/device/${deviceId}/files`);
  };

  const getStatusColor = (isOnline) => {
    return isOnline ? 'success' : 'error';
  };

  const getStatusIcon = (isOnline) => {
    return isOnline ? <OnlineIcon /> : <OfflineIcon />;
  };

  const formatLastSeen = (lastSeen) => {
    if (!lastSeen) return '从未连接';
    const date = new Date(lastSeen);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    return `${days}天前`;
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress size={60} />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1" gutterBottom>
          <DevicesIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          设备管理
        </Typography>
        <Tooltip title="刷新设备列表">
          <IconButton onClick={fetchDevices} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {devices.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <PhoneAndroidIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            暂无设备
          </Typography>
          <Typography variant="body2" color="text.secondary">
            请确保Android客户端已连接到服务器
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {devices.map((device) => (
            <Grid item xs={12} sm={6} md={4} key={device.device_id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Typography variant="h6" component="h2" noWrap>
                      {device.device_name || device.device_model || '未知设备'}
                    </Typography>
                    <Chip
                      icon={getStatusIcon(device.is_online)}
                      label={device.is_online ? '在线' : '离线'}
                      color={getStatusColor(device.is_online)}
                      size="small"
                    />
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <strong>设备ID:</strong> {device.device_unique_id || 'N/A'}
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <strong>型号:</strong> {device.device_model || 'N/A'}
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <strong>Android版本:</strong> {device.android_version || 'N/A'}
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <strong>屏幕:</strong> {device.screen_width && device.screen_height 
                      ? `${device.screen_width}x${device.screen_height}` 
                      : 'N/A'}
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary">
                    <strong>最后连接:</strong> {formatLastSeen(device.last_seen)}
                  </Typography>
                </CardContent>
                
                <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<VideocamIcon />}
                    onClick={() => handleControlDevice(device.device_id)}
                    disabled={!device.is_online}
                  >
                    远程控制
                  </Button>
                  
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<FolderIcon />}
                    onClick={() => handleViewFiles(device.device_id)}
                    disabled={!device.is_online}
                  >
                    文件管理
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
};

export default DeviceList;