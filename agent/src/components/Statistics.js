import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://114.215.211.109:3000/api';

const Statistics = () => {
  const [timeRange, setTimeRange] = useState('30');
  const [userGrowthData, setUserGrowthData] = useState([]);
  const [commissionData, setCommissionData] = useState([]);
  const [membershipData, setMembershipData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatistics();
  }, [timeRange]);

  const fetchStatistics = async () => {
    try {
      const token = localStorage.getItem('agentToken');
      const response = await fetch(
        `${API_BASE_URL}/agents/statistics?days=${timeRange}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const data = await response.json();
      if (data.success) {
        setUserGrowthData(data.data.userGrowth || []);
        setCommissionData(data.data.commission || []);
        setMembershipData(data.data.membership || []);
      }
    } catch (error) {
      console.error('获取统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          数据统计
        </Typography>
        
        <FormControl sx={{ minWidth: 120 }}>
          <InputLabel>时间范围</InputLabel>
          <Select
            value={timeRange}
            label="时间范围"
            onChange={(e) => setTimeRange(e.target.value)}
          >
            <MenuItem value="7">最近7天</MenuItem>
            <MenuItem value="30">最近30天</MenuItem>
            <MenuItem value="90">最近90天</MenuItem>
            <MenuItem value="365">最近一年</MenuItem>
          </Select>
        </FormControl>
      </Box>
      
      <Grid container spacing={3}>
        {/* 用户增长趋势 */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              用户增长趋势
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={userGrowthData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="newUsers" stroke="#2196f3" strokeWidth={2} name="新增用户" />
                <Line type="monotone" dataKey="totalUsers" stroke="#4caf50" strokeWidth={2} name="总用户" />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
        
        {/* 会员类型分布 */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              会员类型分布
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={membershipData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {membershipData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
        
        {/* 佣金收入趋势 */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              佣金收入趋势
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={commissionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="commission" fill="#ff9800" name="佣金收入" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Statistics;