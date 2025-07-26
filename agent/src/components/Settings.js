import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  Grid,
  Divider,
  Alert,
  Card,
  CardContent,
  Switch,
  FormControlLabel
} from '@mui/material';
import { Save, Person, Security, Notifications } from '@mui/icons-material';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://114.215.211.109:3000/api';

const Settings = () => {
  const [agentInfo, setAgentInfo] = useState({
    name: '',
    phone: '',
    email: '',
    bank_account: '',
    bank_name: '',
    id_card: ''
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchAgentInfo();
  }, []);

  const fetchAgentInfo = async () => {
    try {
      const token = localStorage.getItem('agentToken');
      const response = await fetch(`${API_BASE_URL}/agents/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      if (data.success) {
        setAgentInfo(data.data.agent);
        setNotifications(data.data.notifications || notifications);
      }
    } catch (error) {
      console.error('获取代理信息失败:', error);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('agentToken');
      const response = await fetch(`${API_BASE_URL}/agents/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(agentInfo)
      });
      
      const data = await response.json();
      if (data.success) {
        setSuccess('个人信息更新成功');
      } else {
        setError(data.message || '更新失败');
      }
    } catch (error) {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    try {
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        setError('新密码和确认密码不匹配');
        return;
      }
      
      if (passwordData.newPassword.length < 6) {
        setError('新密码长度至少6位');
        return;
      }

      setLoading(true);
      const token = localStorage.getItem('agentToken');
      const response = await fetch(`${API_BASE_URL}/agents/change-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setSuccess('密码修改成功');
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        setError(data.message || '密码修改失败');
      }
    } catch (error) {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateNotifications = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('agentToken');
      const response = await fetch(`${API_BASE_URL}/agents/notifications`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(notifications)
      });
      
      const data = await response.json();
      if (data.success) {
        setSuccess('通知设置更新成功');
      } else {
        setError(data.message || '更新失败');
      }
    } catch (error) {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        设置
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}
      
      {/* 个人信息 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" mb={2}>
            <Person sx={{ mr: 1 }} />
            <Typography variant="h6">个人信息</Typography>
          </Box>
          
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="姓名"
                value={agentInfo.name}
                onChange={(e) => setAgentInfo({ ...agentInfo, name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="手机号"
                value={agentInfo.phone}
                onChange={(e) => setAgentInfo({ ...agentInfo, phone: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="邮箱"
                type="email"
                value={agentInfo.email}
                onChange={(e) => setAgentInfo({ ...agentInfo, email: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="银行账户"
                value={agentInfo.bank_account}
                onChange={(e) => setAgentInfo({ ...agentInfo, bank_account: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="开户银行"
                value={agentInfo.bank_name}
                onChange={(e) => setAgentInfo({ ...agentInfo, bank_name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="身份证号"
                value={agentInfo.id_card}
                onChange={(e) => setAgentInfo({ ...agentInfo, id_card: e.target.value })}
              />
            </Grid>
          </Grid>
          
          <Box mt={2}>
            <Button
              variant="contained"
              startIcon={<Save />}
              onClick={handleUpdateProfile}
              disabled={loading}
            >
              保存个人信息
            </Button>
          </Box>
        </CardContent>
      </Card>
      
      {/* 密码修改 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" mb={2}>
            <Security sx={{ mr: 1 }} />
            <Typography variant="h6">密码修改</Typography>
          </Box>
          
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="当前密码"
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="新密码"
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="确认新密码"
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
              />
            </Grid>
          </Grid>
          
          <Box mt={2}>
            <Button
              variant="contained"
              color="warning"
              onClick={handleChangePassword}
              disabled={loading}
            >
              修改密码
            </Button>
          </Box>
        </CardContent>
      </Card>
      
      {/* 通知设置 */}
      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" mb={2}>
            <Notifications sx={{ mr: 1 }} />
            <Typography variant="h6">通知设置</Typography>
          </Box>
          
          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={notifications.emailNotifications}
                  onChange={(e) => setNotifications({ ...notifications, emailNotifications: e.target.checked })}
                />
              }
              label="邮件通知"
            />
          </Box>
          
          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={notifications.smsNotifications}
                  onChange={(e) => setNotifications({ ...notifications, smsNotifications: e.target.checked })}
                />
              }
              label="短信通知"
            />
          </Box>
          
          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={notifications.pushNotifications}
                  onChange={(e) => setNotifications({ ...notifications, pushNotifications: e.target.checked })}
                />
              }
              label="推送通知"
            />
          </Box>
          
          <Box mt={2}>
            <Button
              variant="contained"
              onClick={handleUpdateNotifications}
              disabled={loading}
            >
              保存通知设置
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
};

export default Settings;