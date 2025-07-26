import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert
} from '@mui/material';
import {
  Search,
  Edit,
  Block,
  CheckCircle,
  Visibility
} from '@mui/icons-material';
import { format } from 'date-fns';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://114.215.211.109:3000/api';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchUsers();
  }, [page, rowsPerPage, searchTerm]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('agentToken');
      const response = await fetch(
        `${API_BASE_URL}/agents/users?page=${page + 1}&limit=${rowsPerPage}&search=${searchTerm}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const data = await response.json();
      if (data.success) {
        setUsers(data.data.users || []);
      } else {
        setError(data.message || '获取用户列表失败');
      }
    } catch (error) {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleUserAction = async (userId, action) => {
    try {
      const token = localStorage.getItem('agentToken');
      const response = await fetch(`${API_BASE_URL}/agents/users/${userId}/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      if (data.success) {
        setSuccess(`用户${action === 'block' ? '禁用' : '启用'}成功`);
        fetchUsers();
      } else {
        setError(data.message || '操作失败');
      }
    } catch (error) {
      setError('网络错误，请稍后重试');
    }
  };

  const handleViewUser = (user) => {
    setSelectedUser(user);
    setDialogOpen(true);
  };

  const getMembershipLabel = (type) => {
    const types = {
      0: '免费用户',
      1: '月费会员',
      2: '季费会员',
      3: '半年会员',
      4: '年费会员',
      5: '永久会员'
    };
    return types[type] || '未知';
  };

  const getMembershipColor = (type) => {
    const colors = {
      0: 'default',
      1: 'primary',
      2: 'secondary',
      3: 'warning',
      4: 'success',
      5: 'error'
    };
    return colors[type] || 'default';
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        用户管理
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
      
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box display="flex" gap={2} alignItems="center">
          <TextField
            label="搜索用户"
            variant="outlined"
            size="small"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: <Search sx={{ mr: 1, color: 'action.active' }} />,
            }}
            sx={{ minWidth: 300 }}
          />
          <Button variant="contained" onClick={fetchUsers}>
            搜索
          </Button>
        </Box>
      </Paper>
      
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>用户ID</TableCell>
              <TableCell>手机号</TableCell>
              <TableCell>昵称</TableCell>
              <TableCell>会员类型</TableCell>
              <TableCell>注册时间</TableCell>
              <TableCell>状态</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.id}</TableCell>
                <TableCell>{user.phone}</TableCell>
                <TableCell>{user.nickname || '-'}</TableCell>
                <TableCell>
                  <Chip
                    label={getMembershipLabel(user.membership_type)}
                    color={getMembershipColor(user.membership_type)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {user.created_at ? format(new Date(user.created_at), 'yyyy-MM-dd HH:mm') : '-'}
                </TableCell>
                <TableCell>
                  <Chip
                    label={user.status === 1 ? '正常' : '禁用'}
                    color={user.status === 1 ? 'success' : 'error'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <IconButton
                    size="small"
                    onClick={() => handleViewUser(user)}
                    title="查看详情"
                  >
                    <Visibility />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleUserAction(user.id, user.status === 1 ? 'block' : 'unblock')}
                    title={user.status === 1 ? '禁用用户' : '启用用户'}
                    color={user.status === 1 ? 'error' : 'success'}
                  >
                    {user.status === 1 ? <Block /> : <CheckCircle />}
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        <TablePagination
          component="div"
          count={-1}
          page={page}
          onPageChange={(event, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(parseInt(event.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[5, 10, 25, 50]}
        />
      </TableContainer>
      
      {/* 用户详情对话框 */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>用户详情</DialogTitle>
        <DialogContent>
          {selectedUser && (
            <Box sx={{ pt: 2 }}>
              <Typography variant="h6" gutterBottom>基本信息</Typography>
              <Box sx={{ mb: 2 }}>
                <Typography><strong>用户ID:</strong> {selectedUser.id}</Typography>
                <Typography><strong>手机号:</strong> {selectedUser.phone}</Typography>
                <Typography><strong>昵称:</strong> {selectedUser.nickname || '-'}</Typography>
                <Typography><strong>邀请码:</strong> {selectedUser.invite_code || '-'}</Typography>
                <Typography><strong>会员类型:</strong> {getMembershipLabel(selectedUser.membership_type)}</Typography>
                <Typography><strong>会员到期:</strong> {selectedUser.membership_expire ? format(new Date(selectedUser.membership_expire), 'yyyy-MM-dd HH:mm') : '-'}</Typography>
                <Typography><strong>注册时间:</strong> {selectedUser.created_at ? format(new Date(selectedUser.created_at), 'yyyy-MM-dd HH:mm') : '-'}</Typography>
                <Typography><strong>最后登录:</strong> {selectedUser.last_login ? format(new Date(selectedUser.last_login), 'yyyy-MM-dd HH:mm') : '-'}</Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>关闭</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default UserManagement;