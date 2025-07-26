import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container, Typography, Paper, Box, Button, Grid, Divider,
  FormControl, InputLabel, Select, MenuItem, Alert, CircularProgress,
  Card, CardContent, CardActions, IconButton, Tooltip, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Slider, Switch, FormControlLabel
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Videocam as VideocamIcon,
  VideocamOff as VideocamOffIcon,
  CameraFront as CameraFrontIcon,
  CameraRear as CameraRearIcon,
  Mic as MicIcon,
  MicOff as MicOffIcon,
  PhotoCamera as PhotoCameraIcon,
  ScreenShare as ScreenShareIcon,
  Stop as StopIcon,
  Settings as SettingsIcon,
  Fullscreen as FullscreenIcon,
  VolumeUp as VolumeUpIcon,
  Brightness6 as BrightnessIcon,
  TouchApp as TouchIcon,
  Keyboard as KeyboardIcon,
  Mouse as MouseIcon
} from '@mui/icons-material';

import socketService from '../services/socketService';
import webrtcService from '../services/webrtcService';
import ApiService from '../services/api';

const DeviceControl = () => {
  const { deviceId } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [device, setDevice] = useState(null);
  const [connected, setConnected] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState('back');
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [screenShare, setScreenShare] = useState(false);
  const [controlMode, setControlMode] = useState('touch'); // 'touch', 'mouse', 'keyboard'
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [videoQuality, setVideoQuality] = useState('medium');
  const [volume, setVolume] = useState(50);
  const [brightness, setBrightness] = useState(50);
  const [fullscreen, setFullscreen] = useState(false);

  // 初始化设备连接
  useEffect(() => {
    const initDevice = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // 获取设备信息
        const deviceData = await ApiService.getDevice(deviceId);
        setDevice(deviceData.data);
        
        // 连接到Socket服务器
        const SERVER_URL = process.env.REACT_APP_SOCKET_URL || 'http://114.215.211.109:3000';
        socketService.connect(SERVER_URL);
        
        // 添加Socket连接状态监听
        const handleConnect = () => {
          setConnected(true);
          console.log('Socket连接成功');
        };
        
        const handleDisconnect = () => {
          setConnected(false);
          setStreaming(false);
          console.log('Socket连接断开');
        };
        
        const handleError = (err) => {
          setError(`Socket连接错误: ${err.message}`);
          console.error('Socket错误:', err);
        };
        
        // 添加设备控制响应监听
        const handleControlResponse = (data) => {
          console.log('设备控制响应:', data);
          if (data.error) {
            setError(data.error);
          }
        };
        
        socketService.addListener('connect', handleConnect);
        socketService.addListener('disconnect', handleDisconnect);
        socketService.addListener('error', handleError);
        socketService.addListener('control-response', handleControlResponse);
        
        setLoading(false);
        
        return () => {
          socketService.removeListener('connect', handleConnect);
          socketService.removeListener('disconnect', handleDisconnect);
          socketService.removeListener('error', handleError);
          socketService.removeListener('control-response', handleControlResponse);
          socketService.disconnect();
          stopStreaming();
        };
      } catch (err) {
        console.error('初始化设备失败:', err);
        setError(`初始化设备失败: ${err.message}`);
        setLoading(false);
      }
    };
    
    initDevice();
  }, [deviceId]);

  // 开始视频流
  const startStreaming = async () => {
    try {
      setError(null);
      
      // 初始化WebRTC连接
      await webrtcService.initConnection(deviceId, (stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      });
      
      // 发送开始直播视频命令
      await ApiService.startLiveVideo(deviceId);
      
      setStreaming(true);
    } catch (err) {
      console.error('开始视频流失败:', err);
      setError(`开始视频流失败: ${err.message}`);
    }
  };
  
  // 停止视频流
  const stopStreaming = async () => {
    try {
      if (streaming) {
        await ApiService.stopLiveVideo(deviceId);
      }
      
      // 关闭WebRTC连接
      webrtcService.closeConnection();
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      
      setStreaming(false);
      setScreenShare(false);
    } catch (err) {
      console.error('停止视频流失败:', err);
      setError(`停止视频流失败: ${err.message}`);
    }
  };
  
  // 切换摄像头
  const switchCamera = async () => {
    try {
      const newCamera = selectedCamera === 'front' ? 'back' : 'front';
      setSelectedCamera(newCamera);
      
      await ApiService.sendControlCommand(deviceId, {
        type: 'switch_camera',
        camera: newCamera
      });
      
      // 如果正在流媒体，重新启动流媒体
      if (streaming) {
        await stopStreaming();
        setTimeout(() => startStreaming(), 1000);
      }
    } catch (err) {
      setError(`切换摄像头失败: ${err.message}`);
    }
  };
  
  // 切换音频
  const toggleAudio = async () => {
    try {
      const newAudioState = !audioEnabled;
      setAudioEnabled(newAudioState);
      
      await ApiService.sendControlCommand(deviceId, {
        type: 'toggle_audio',
        enabled: newAudioState
      });
    } catch (err) {
      setError(`切换音频失败: ${err.message}`);
    }
  };
  
  // 开始屏幕共享
  const toggleScreenShare = async () => {
    try {
      const newScreenShareState = !screenShare;
      setScreenShare(newScreenShareState);
      
      await ApiService.sendControlCommand(deviceId, {
        type: 'screen_share',
        enabled: newScreenShareState
      });
      
      if (newScreenShareState && !streaming) {
        await startStreaming();
      }
    } catch (err) {
      setError(`屏幕共享失败: ${err.message}`);
    }
  };
  
  // 拍照
  const takeScreenshot = async () => {
    try {
      await ApiService.sendControlCommand(deviceId, {
        type: 'screenshot'
      });
      
      // 这里可以添加下载截图的逻辑
      alert('截图已保存到设备');
    } catch (err) {
      setError(`截图失败: ${err.message}`);
    }
  };
  
  // 处理视频点击（触摸控制）
  const handleVideoClick = async (event) => {
    if (!streaming || controlMode !== 'touch') return;
    
    const rect = videoRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    
    try {
      await ApiService.sendControlCommand(deviceId, {
        type: 'touch',
        x: x,
        y: y,
        action: 'tap'
      });
    } catch (err) {
      setError(`触摸控制失败: ${err.message}`);
    }
  };
  
  // 调整音量
  const handleVolumeChange = async (newVolume) => {
    try {
      setVolume(newVolume);
      await ApiService.sendControlCommand(deviceId, {
        type: 'volume',
        level: newVolume
      });
    } catch (err) {
      setError(`调整音量失败: ${err.message}`);
    }
  };
  
  // 调整亮度
  const handleBrightnessChange = async (newBrightness) => {
    try {
      setBrightness(newBrightness);
      await ApiService.sendControlCommand(deviceId, {
        type: 'brightness',
        level: newBrightness
      });
    } catch (err) {
      setError(`调整亮度失败: ${err.message}`);
    }
  };
  
  // 切换全屏
  const toggleFullscreen = () => {
    if (!fullscreen) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    setFullscreen(!fullscreen);
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
    <Container maxWidth="lg" sx={{ mt: 2, mb: 4 }}>
      {/* 头部工具栏 */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/devices')}
          >
            返回设备列表
          </Button>
          
          <Typography variant="h5" component="h1">
            远程控制 - {device?.device_name || '未知设备'}
          </Typography>
          
          <Chip
            label={connected ? '已连接' : '未连接'}
            color={connected ? 'success' : 'error'}
            size="small"
          />
        </Box>
        
        <IconButton onClick={() => setSettingsOpen(true)}>
          <SettingsIcon />
        </IconButton>
      </Box>

      {/* 错误提示 */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* 视频显示区域 */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2, height: '600px', position: 'relative' }}>
            <Box
              sx={{
                width: '100%',
                height: '100%',
                backgroundColor: '#000',
                borderRadius: 1,
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {streaming ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  onClick={handleVideoClick}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    cursor: controlMode === 'touch' ? 'pointer' : 'default'
                  }}
                />
              ) : (
                <Box
                  display="flex"
                  flexDirection="column"
                  justifyContent="center"
                  alignItems="center"
                  height="100%"
                  color="white"
                >
                  <VideocamOffIcon sx={{ fontSize: 64, mb: 2 }} />
                  <Typography variant="h6">视频未开启</Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>点击开始按钮开始远程控制</Typography>
                </Box>
              )}
              
              {/* 全屏按钮 */}
              {streaming && (
                <IconButton
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    color: 'white',
                    '&:hover': {
                      backgroundColor: 'rgba(0,0,0,0.7)'
                    }
                  }}
                  onClick={toggleFullscreen}
                >
                  <FullscreenIcon />
                </IconButton>
              )}
            </Box>
          </Paper>
        </Grid>

        {/* 控制面板 */}
        <Grid item xs={12} md={4}>
          <Grid container spacing={2}>
            {/* 基本控制 */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    基本控制
                  </Typography>
                  
                  <Box display="flex" gap={1} mb={2}>
                    <Button
                      variant={streaming ? "outlined" : "contained"}
                      color={streaming ? "error" : "primary"}
                      startIcon={streaming ? <StopIcon /> : <VideocamIcon />}
                      onClick={streaming ? stopStreaming : startStreaming}
                      disabled={!connected}
                      fullWidth
                    >
                      {streaming ? '停止控制' : '开始控制'}
                    </Button>
                  </Box>
                  
                  <Box display="flex" gap={1} mb={2}>
                    <Tooltip title="切换摄像头">
                      <IconButton
                        onClick={switchCamera}
                        disabled={!connected}
                        color={selectedCamera === 'front' ? 'primary' : 'default'}
                      >
                        {selectedCamera === 'front' ? <CameraFrontIcon /> : <CameraRearIcon />}
                      </IconButton>
                    </Tooltip>
                    
                    <Tooltip title="切换音频">
                      <IconButton
                        onClick={toggleAudio}
                        disabled={!connected}
                        color={audioEnabled ? 'primary' : 'default'}
                      >
                        {audioEnabled ? <MicIcon /> : <MicOffIcon />}
                      </IconButton>
                    </Tooltip>
                    
                    <Tooltip title="屏幕共享">
                      <IconButton
                        onClick={toggleScreenShare}
                        disabled={!connected}
                        color={screenShare ? 'primary' : 'default'}
                      >
                        <ScreenShareIcon />
                      </IconButton>
                    </Tooltip>
                    
                    <Tooltip title="截图">
                      <IconButton
                        onClick={takeScreenshot}
                        disabled={!connected || !streaming}
                      >
                        <PhotoCameraIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  
                  <FormControl fullWidth size="small">
                    <InputLabel>控制模式</InputLabel>
                    <Select
                      value={controlMode}
                      label="控制模式"
                      onChange={(e) => setControlMode(e.target.value)}
                    >
                      <MenuItem value="touch">
                        <TouchIcon sx={{ mr: 1 }} /> 触摸控制
                      </MenuItem>
                      <MenuItem value="mouse">
                        <MouseIcon sx={{ mr: 1 }} /> 鼠标控制
                      </MenuItem>
                      <MenuItem value="keyboard">
                        <KeyboardIcon sx={{ mr: 1 }} /> 键盘控制
                      </MenuItem>
                    </Select>
                  </FormControl>
                </CardContent>
              </Card>
            </Grid>
            
            {/* 设备信息 */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    设备信息
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <strong>设备名称:</strong> {device?.device_name || 'N/A'}
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <strong>设备型号:</strong> {device?.device_model || 'N/A'}
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <strong>Android版本:</strong> {device?.android_version || 'N/A'}
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary">
                    <strong>屏幕分辨率:</strong> {device?.screen_width && device?.screen_height 
                      ? `${device.screen_width}x${device.screen_height}` 
                      : 'N/A'}
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary">
                    <strong>连接状态:</strong> 
                    <Chip
                      label={device?.is_online ? '在线' : '离线'}
                      color={device?.is_online ? 'success' : 'error'}
                      size="small"
                      sx={{ ml: 1 }}
                    />
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Grid>
      </Grid>

      {/* 设置对话框 */}
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>控制设置</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography gutterBottom>视频质量</Typography>
            <FormControl fullWidth size="small" sx={{ mb: 3 }}>
              <Select
                value={videoQuality}
                onChange={(e) => setVideoQuality(e.target.value)}
              >
                <MenuItem value="low">低质量 (省流量)</MenuItem>
                <MenuItem value="medium">中等质量</MenuItem>
                <MenuItem value="high">高质量</MenuItem>
              </Select>
            </FormControl>
            
            <Typography gutterBottom>
              <VolumeUpIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
              音量: {volume}%
            </Typography>
            <Slider
              value={volume}
              onChange={(e, newValue) => handleVolumeChange(newValue)}
              valueLabelDisplay="auto"
              sx={{ mb: 3 }}
            />
            
            <Typography gutterBottom>
              <BrightnessIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
              亮度: {brightness}%
            </Typography>
            <Slider
              value={brightness}
              onChange={(e, newValue) => handleBrightnessChange(newValue)}
              valueLabelDisplay="auto"
              sx={{ mb: 2 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>关闭</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default DeviceControl;