import axios from 'axios';

export const api = axios.create({
    baseURL: 'http://localhost:8000',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request Interceptor: Inject Authorization and Context Headers
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('@Cerberus:token');
        const companyId = localStorage.getItem('@Cerberus:companyId');
        
        if (config.headers) {
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            if (companyId) {
                config.headers['X-Company-Id'] = companyId;
            }
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response Interceptor: Handle 401 globally
api.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        if (error.response?.status === 401) {
            // Se não for a rota de login, limpa os dados e joga para /login
            if (!error.config.url?.endsWith('/auth/login')) {
                localStorage.removeItem('@Cerberus:token');
                localStorage.removeItem('@Cerberus:user');
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);
