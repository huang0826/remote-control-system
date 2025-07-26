module.exports = {
  apps: [{
    name: 'device-management-system',
    script: './server.js',
    instances: 2,
    exec_mode: 'cluster',
    max_memory_restart: '1G',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    merge_logs: true,
    watch: false,
    ignore_watch: [
      'node_modules',
      'logs',
      'uploads',
      '.git',
      '.env'
    ],
    env: {
      NODE_ENV: 'production',
      SERVER_HOST: '0.0.0.0',
      SERVER_URL: 'http://114.215.211.109:3000'
    },
    env_production: {
      NODE_ENV: 'production',
      SERVER_HOST: '0.0.0.0',
      SERVER_URL: 'http://114.215.211.109:3000'
    },
    wait_ready: true,
    listen_timeout: 10000,
    kill_timeout: 5000,
    max_restarts: 10,
    restart_delay: 4000,
    autorestart: true,
    exp_backoff_restart_delay: 100
  }]
};