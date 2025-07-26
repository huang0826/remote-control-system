import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Divider
} from '@mui/material';
import {
  AttachMoney,
  TrendingUp,
  AccountBalance,
  History
} from '@mui/icons-material';
import { format } from 'date-fns';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://114.215.211.109:3000/api';

const CommissionManagement = () => {
  const [commissionData, setCommissionData] = useState({
    totalCommission: 0,
    availableCommission: 0,
    withdrawnCommission: 0,
    pendingCommission: 0
  });
  const [commissionRecords, setCommissionRecords] = useState([]);
  const [withdrawRecords, setWithdrawRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchCommissionData();
    fetchCommissionRecords();
    fetchWithdrawRecords();
  }, [page, rowsPerPage]);

  const fetchCommissionData = async () => {
    try {
      const token = localStorage.getItem('agentToken');
      const response = await fetch(`${API_BASE_URL}/agents/commission/summary`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      if (data.success) {
        setCommissionData(data.data);
      }
    } catch (error) {
      console.error('获取佣金数据失败:', error);
    }
  };

  const fetchCommissionRecords = async () => {
    try {
      const token = localStorage.getItem('agentToken');
      const response = await fetch(
        `${API_BASE_URL}/agents/commission/records?page=${page + 1}&limit=${rowsPerPage}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const data = await response.json();
      if (data.success) {
        setCommissionRecords(data.data.records || []);
      }
    } catch (error) {
      console.error('获取佣金记录失败:', error);
    }
  };

  const fetchWithdrawRecords = async () => {
    try {
      const token = localStorage.getItem('agentToken');
      const response = await fetch(`${API_BASE_URL}/agents/withdraw/records`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      if (data.success) {
        setWithdrawRecords(data.data.records || []);
      }
    } catch (error) {
      console.error('获取提现记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    try {
      const amount = parseFloat(withdrawAmount);
      if (amount <= 0 || amount > commissionData.availableCommission) {
        setError('提现金额无效');
        return;
      }

      const token = localStorage.getItem('agentToken');
      const response = await fetch(`${API_BASE_URL}/agents/withdraw`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ amount })
      });
      
      const data = await response.json();
      if (data.success) {
        setSuccess('提现申请提交成功');
        setWithdrawDialogOpen(false);
        setWithdrawAmount('');
        fetchCommissionData();
        fetchWithdrawRecords();
      } else {
        setError(data.message || '提现申请失败');
      }
    } catch (error) {
      setError('网络错误，请稍后重试');
    }
  };

  const StatCard = ({ title, value, icon, color }) => (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography color="textSecondary" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h5" component="div">
              ¥{value.toFixed(2)}
            </Typography>
          </Box>
          <Box sx={{ color: color }}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        佣金管理
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
      
      {/* 佣金统计卡片 */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="总佣金"
            value={commissionData.totalCommission}
            icon={<AttachMoney fontSize="large" />}
            color="#2196f3"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="可提现佣金"
            value={commissionData.availableCommission}
            icon={<AccountBalance fontSize="large" />}
            color="#4caf50"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="已提现佣金"
            value={commissionData.withdrawnCommission}
            icon={<TrendingUp fontSize="large" />}
            color="#ff9800"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="待结算佣金"
            value={commissionData.pendingCommission}
            icon={<History fontSize="large" />}
            color="#9c27b0"
          />
        </Grid>
      </Grid>
      
      {/* 提现按钮 */}
      <Box sx={{ mb: 3 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={() => setWithdrawDialogOpen(true)}
          disabled={commissionData.availableCommission <= 0}
        >
          申请提现
        </Button>
      </Box>
      
      {/* 佣金记录表格 */}
      <Paper sx={{ mb: 4 }}>
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            佣金记录
          </Typography>
        </Box>
        <Divider />
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>记录ID</TableCell>
                <TableCell>用户</TableCell>
                <TableCell>佣金类型</TableCell>
                <TableCell>佣金金额</TableCell>
                <TableCell>获得时间</TableCell>
                <TableCell>状态</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {commissionRecords.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>{record.id}</TableCell>
                  <TableCell>{record.user_phone}</TableCell>
                  <TableCell>{record.commission_type}</TableCell>
                  <TableCell>¥{record.amount.toFixed(2)}</TableCell>
                  <TableCell>
                    {record.created_at ? format(new Date(record.created_at), 'yyyy-MM-dd HH:mm') : '-'}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={record.status === 1 ? '已结算' : '待结算'}
                      color={record.status === 1 ? 'success' : 'warning'}
                      size="small"
                    />
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
      </Paper>
      
      {/* 提现记录 */}
      <Paper>
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            提现记录
          </Typography>
        </Box>
        <Divider />
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>提现ID</TableCell>
                <TableCell>提现金额</TableCell>
                <TableCell>申请时间</TableCell>
                <TableCell>处理时间</TableCell>
                <TableCell>状态</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {withdrawRecords.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>{record.id}</TableCell>
                  <TableCell>¥{record.amount.toFixed(2)}</TableCell>
                  <TableCell>
                    {record.created_at ? format(new Date(record.created_at), 'yyyy-MM-dd HH:mm') : '-'}
                  </TableCell>
                  <TableCell>
                    {record.processed_at ? format(new Date(record.processed_at), 'yyyy-MM-dd HH:mm') : '-'}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={record.status === 0 ? '待处理' : record.status === 1 ? '已完成' : '已拒绝'}
                      color={record.status === 0 ? 'warning' : record.status === 1 ? 'success' : 'error'}
                      size="small"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      
      {/* 提现对话框 */}
      <Dialog open={withdrawDialogOpen} onClose={() => setWithdrawDialogOpen(false)}>
        <DialogTitle>申请提现</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Typography gutterBottom>
              可提现金额: ¥{commissionData.availableCommission.toFixed(2)}
            </Typography>
            <TextField
              fullWidth
              label="提现金额"
              type="number"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              inputProps={{ min: 0, max: commissionData.availableCommission, step: 0.01 }}
              sx={{ mt: 2 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWithdrawDialogOpen(false)}>取消</Button>
          <Button onClick={handleWithdraw} variant="contained">确认提现</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default CommissionManagement;