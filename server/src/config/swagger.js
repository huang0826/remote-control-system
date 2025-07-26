const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const config = require('./config');

// Swagger配置选项
const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '设备管理系统 API',
      version: '1.0.0',
      description: '设备管理系统后端API文档',
      contact: {
        name: 'API Support',
        email: 'support@devicemanagement.com',
        url: 'https://devicemanagement.com/support'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: `http://localhost:${config.port}/api`,
        description: '开发环境'
      },
      {
        url: 'https://api.devicemanagement.com/api',
        description: '生产环境'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT认证令牌'
        },
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API密钥'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              example: '错误信息'
            },
            code: {
              type: 'string',
              example: 'ERROR_CODE'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2023-12-01T10:00:00.000Z'
            }
          }
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              example: '操作成功'
            },
            data: {
              type: 'object',
              description: '返回的数据'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2023-12-01T10:00:00.000Z'
            }
          }
        },
        Pagination: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              example: 1,
              description: '当前页码'
            },
            limit: {
              type: 'integer',
              example: 10,
              description: '每页数量'
            },
            total: {
              type: 'integer',
              example: 100,
              description: '总记录数'
            },
            totalPages: {
              type: 'integer',
              example: 10,
              description: '总页数'
            },
            hasNext: {
              type: 'boolean',
              example: true,
              description: '是否有下一页'
            },
            hasPrev: {
              type: 'boolean',
              example: false,
              description: '是否有上一页'
            }
          }
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1
            },
            username: {
              type: 'string',
              example: 'user123'
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com'
            },
            phone: {
              type: 'string',
              example: '+86 138 0013 8000'
            },
            avatar: {
              type: 'string',
              example: 'https://example.com/avatar.jpg'
            },
            status: {
              type: 'string',
              enum: ['active', 'inactive', 'banned'],
              example: 'active'
            },
            membershipType: {
              type: 'string',
              enum: ['free', 'basic', 'premium', 'enterprise'],
              example: 'basic'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Device: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1
            },
            deviceId: {
              type: 'string',
              example: 'device_123456'
            },
            name: {
              type: 'string',
              example: '我的手机'
            },
            model: {
              type: 'string',
              example: 'iPhone 14 Pro'
            },
            os: {
              type: 'string',
              example: 'iOS 16.0'
            },
            status: {
              type: 'string',
              enum: ['online', 'offline', 'busy'],
              example: 'online'
            },
            lastSeen: {
              type: 'string',
              format: 'date-time'
            },
            location: {
              type: 'object',
              properties: {
                latitude: {
                  type: 'number',
                  example: 39.9042
                },
                longitude: {
                  type: 'number',
                  example: 116.4074
                },
                address: {
                  type: 'string',
                  example: '北京市朝阳区'
                }
              }
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        LoginRequest: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: {
              type: 'string',
              example: 'user123'
            },
            password: {
              type: 'string',
              example: 'password123'
            },
            rememberMe: {
              type: 'boolean',
              example: false
            }
          }
        },
        LoginResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              example: '登录成功'
            },
            data: {
              type: 'object',
              properties: {
                token: {
                  type: 'string',
                  example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
                },
                refreshToken: {
                  type: 'string',
                  example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
                },
                user: {
                  $ref: '#/components/schemas/User'
                },
                expiresIn: {
                  type: 'integer',
                  example: 604800
                }
              }
            }
          }
        }
      },
      responses: {
        UnauthorizedError: {
          description: '认证失败',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                message: '认证失败，请重新登录',
                code: 'UNAUTHORIZED',
                timestamp: '2023-12-01T10:00:00.000Z'
              }
            }
          }
        },
        ForbiddenError: {
          description: '权限不足',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                message: '权限不足',
                code: 'FORBIDDEN',
                timestamp: '2023-12-01T10:00:00.000Z'
              }
            }
          }
        },
        NotFoundError: {
          description: '资源不存在',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                message: '请求的资源不存在',
                code: 'NOT_FOUND',
                timestamp: '2023-12-01T10:00:00.000Z'
              }
            }
          }
        },
        ValidationError: {
          description: '参数验证失败',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                message: '参数验证失败',
                code: 'VALIDATION_ERROR',
                errors: [
                  {
                    field: 'email',
                    message: '邮箱格式不正确'
                  }
                ],
                timestamp: '2023-12-01T10:00:00.000Z'
              }
            }
          }
        },
        ServerError: {
          description: '服务器内部错误',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                message: '服务器内部错误',
                code: 'INTERNAL_SERVER_ERROR',
                timestamp: '2023-12-01T10:00:00.000Z'
              }
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ],
    tags: [
      {
        name: 'Auth',
        description: '认证相关接口'
      },
      {
        name: 'Users',
        description: '用户管理接口'
      },
      {
        name: 'Devices',
        description: '设备管理接口'
      },
      {
        name: 'Control',
        description: '设备控制接口'
      },
      {
        name: 'Files',
        description: '文件管理接口'
      },
      {
        name: 'Location',
        description: '位置追踪接口'
      },
      {
        name: 'Apps',
        description: '应用管理接口'
      },
      {
        name: 'Membership',
        description: '会员管理接口'
      },
      {
        name: 'Agents',
        description: '代理管理接口'
      },
      {
        name: 'Admin',
        description: '管理员接口'
      },
      {
        name: 'Payment',
        description: '支付管理接口'
      },
      {
        name: 'Notifications',
        description: '通知管理接口'
      },
      {
        name: 'System',
        description: '系统管理接口'
      }
    ]
  },
  apis: [
    './src/routes/*.js',
    './src/controllers/*.js',
    './src/models/*.js'
  ]
};

// 生成Swagger规范
const specs = swaggerJsdoc(options);

// Swagger UI配置
const swaggerUiOptions = {
  explorer: true,
  swaggerOptions: {
    docExpansion: 'none',
    filter: true,
    showRequestDuration: true,
    tryItOutEnabled: true,
    requestSnippetsEnabled: true,
    syntaxHighlight: {
      activate: true,
      theme: 'agate'
    }
  },
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info { margin: 20px 0 }
    .swagger-ui .scheme-container { margin: 20px 0 }
  `,
  customSiteTitle: '设备管理系统 API 文档',
  customfavIcon: '/favicon.ico'
};

module.exports = {
  specs,
  swaggerUi,
  swaggerUiOptions
};