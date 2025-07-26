import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Breadcrumbs,
  Link,
  CircularProgress,
  Button,
  IconButton,
  Divider,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Grid,
  Card,
  CardMedia,
  CardContent,
  Tooltip
} from '@mui/material';
import {
  Folder as FolderIcon,
  InsertDriveFile as FileIcon,
  ArrowBack as ArrowBackIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Image as ImageIcon,
  VideoFile as VideoIcon,
  AudioFile as AudioIcon,
  Description as DocumentIcon,
  Android as AndroidIcon,
  Delete as DeleteIcon,
  Home as HomeIcon,
  NavigateNext as NavigateNextIcon
} from '@mui/icons-material';
import ApiService from '../services/api';

const FileBrowser = () => {
  const { deviceId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPath, setCurrentPath] = useState('');
  const [files, setFiles] = useState([]);
  const [pathHistory, setPathHistory] = useState([]);
  const [accessMode, setAccessMode] = useState('media');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'
  const [deleteDialog, setDeleteDialog] = useState({ open: false, file: null });

  useEffect(() => {
    fetchFiles(currentPath);
  }, [deviceId, currentPath, accessMode]);

  const fetchFiles = async (path = '') => {
    try {
      setLoading(true);
      setError(null);
      const data = await ApiService.getFiles(deviceId, path);
      setFiles(data.data || []);
    } catch (error) {
      console.error('Error fetching files:', error);
      setError(error.message || '获取文件列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleFolderClick = (folderPath) => {
    setPathHistory([...pathHistory, currentPath]);
    setCurrentPath(folderPath);
  };

  const handleBackClick = () => {
    if (pathHistory.length > 0) {
      const previousPath = pathHistory[pathHistory.length - 1];
      setPathHistory(pathHistory.slice(0, -1));
      setCurrentPath(previousPath);
    }
  };

  const handleHomeClick = () => {
    setCurrentPath('');
    setPathHistory([]);
  };

  const handleDownload = async (file) => {
    try {
      const blob = await ApiService.downloadFile(deviceId, file.path);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      setError('文件下载失败: ' + error.message);
    }
  };

  const handleDelete = async () => {
    try {
      await ApiService.deleteFile(deviceId, deleteDialog.file.path);
      setDeleteDialog({ open: false, file: null });
      fetchFiles(currentPath); // 刷新文件列表
    } catch (error) {
      setError('文件删除失败: ' + error.message);
    }
  };

  const getFileIcon = (file) => {
    if (file.type === 'directory') return <FolderIcon />;
    
    const extension = file.name.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(extension)) {
      return <ImageIcon />;
    }
    if (['mp4', 'avi', 'mkv', 'mov', 'wmv', '3gp'].includes(extension)) {
      return <VideoIcon />;
    }
    if (['mp3', 'wav', 'flac', 'aac', 'm4a'].includes(extension)) {
      return <AudioIcon />;
    }
    if (['txt', 'doc', 'docx', 'pdf', 'rtf'].includes(extension)) {
      return <DocumentIcon />;
    }
    if (['apk'].includes(extension)) {
      return <AndroidIcon />;
    }
    return <FileIcon />;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('zh-CN');
  };

  const getBreadcrumbs = () => {
    if (!currentPath) return [];
    const parts = currentPath.split('/').filter(part => part);
    return parts.map((part, index) => {
      const path = parts.slice(0, index + 1).join('/');
      return { name: part, path };
    });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* 头部工具栏 */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          文件管理器
        </Typography>
        
        <Box display="flex" gap={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>访问模式</InputLabel>
            <Select
              value={accessMode}
              label="访问模式"
              onChange={(e) => setAccessMode(e.target.value)}
            >
              <MenuItem value="media">媒体文件</MenuItem>
              <MenuItem value="saf">SAF存储</MenuItem>
              <MenuItem value="manage">管理存储</MenuItem>
            </Select>
          </FormControl>
          
          <Tooltip title="刷新">
            <IconButton onClick={() => fetchFiles(currentPath)}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/devices')}
          >
            返回设备列表
          </Button>
        </Box>
      </Box>

      {/* 面包屑导航 */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box display="flex" alignItems="center" gap={1}>
          <IconButton size="small" onClick={handleHomeClick}>
            <HomeIcon />
          </IconButton>
          
          {pathHistory.length > 0 && (
            <IconButton size="small" onClick={handleBackClick}>
              <ArrowBackIcon />
            </IconButton>
          )}
          
          <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />}>
            <Link
              component="button"
              variant="body1"
              onClick={handleHomeClick}
              sx={{ textDecoration: 'none' }}
            >
              根目录
            </Link>
            {getBreadcrumbs().map((crumb, index) => (
              <Link
                key={index}
                component="button"
                variant="body1"
                onClick={() => {
                  setCurrentPath(crumb.path);
                  setPathHistory(pathHistory.slice(0, index));
                }}
                sx={{ textDecoration: 'none' }}
              >
                {crumb.name}
              </Link>
            ))}
          </Breadcrumbs>
        </Box>
      </Paper>

      {/* 错误提示 */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* 文件列表 */}
      <Paper>
        {files.length === 0 ? (
          <Box p={4} textAlign="center">
            <FolderIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              此目录为空
            </Typography>
          </Box>
        ) : (
          <List>
            {files.map((file, index) => (
              <React.Fragment key={index}>
                <ListItem
                  secondaryAction={
                    <Box>
                      {file.type !== 'directory' && (
                        <Tooltip title="下载">
                          <IconButton
                            edge="end"
                            onClick={() => handleDownload(file)}
                            sx={{ mr: 1 }}
                          >
                            <DownloadIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="删除">
                        <IconButton
                          edge="end"
                          onClick={() => setDeleteDialog({ open: true, file })}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  }
                >
                  <ListItemButton
                    onClick={() => {
                      if (file.type === 'directory') {
                        handleFolderClick(file.path);
                      }
                    }}
                    disabled={file.type !== 'directory'}
                  >
                    <ListItemIcon>
                      {getFileIcon(file)}
                    </ListItemIcon>
                    <ListItemText
                      primary={file.name}
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {file.type === 'directory' ? '文件夹' : formatFileSize(file.size)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatDate(file.modified)}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItemButton>
                </ListItem>
                {index < files.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}
      </Paper>

      {/* 删除确认对话框 */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, file: null })}
      >
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <Typography>
            确定要删除 "{deleteDialog.file?.name}" 吗？此操作不可撤销。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, file: null })}>
            取消
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            删除
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FileBrowser;