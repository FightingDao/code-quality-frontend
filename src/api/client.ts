import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios';

// API 基础地址（动态获取当前 hostname）
const apiBaseUrl = `http://${window.location.hostname}:3000/api/v1`;
console.log('🔗 API Base URL:', apiBaseUrl);

// API 客户端配置
const config: AxiosRequestConfig = {
  baseURL: apiBaseUrl,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
};

// 创建 Axios 实例
const client: AxiosInstance = axios.create(config);

// 请求拦截器
client.interceptors.request.use(
  (config) => {
    // 从 localStorage 获取 token
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
client.interceptors.response.use(
  (response: AxiosResponse) => {
    return response.data;
  },
  (error) => {
    // 统一错误处理
    const message = error.response?.data?.error?.message || error.message || '请求失败';
    console.error('API Error:', message);

    // 处理 401 未授权错误
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

// 封装请求方法
export const request = {
  get: <T = any>(url: string, params?: any): Promise<T> =>
    client.get(url, { params }),

  post: <T = any>(url: string, data?: any): Promise<T> =>
    client.post(url, data),

  put: <T = any>(url: string, data?: any): Promise<T> =>
    client.put(url, data),

  delete: <T = any>(url: string): Promise<T> =>
    client.delete(url),
};

export default client;