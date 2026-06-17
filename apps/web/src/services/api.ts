import axios from 'axios';

export const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '/api'),
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request Interceptor: Inject Authorization and Context Headers
api.interceptors.request.use(
    (config) => {
        const token = sessionStorage.getItem('@Cerberus:token');
        const companyId = sessionStorage.getItem('@Cerberus:companyId');
        
        if (config.headers) {
            if (token && !config.headers.Authorization) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            // Add X-Company-Id for all non-login routes
            if (companyId && !(config.url?.startsWith('/auth/login'))) {
                config.headers['X-Company-Id'] = companyId;
            }
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

export const resolvePendingRequests = (token: string) => {
    isRefreshing = false;
    processQueue(null, token);
};

export const rejectPendingRequests = (error: any) => {
    isRefreshing = false;
    processQueue(error, null);
};

// Response Interceptor: Handle 401 globally by queuing and requesting re-auth
api.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
            // Se for a rota de login, rejeita para evitar loops
            if (originalRequest.url?.endsWith('/auth/login')) {
                return Promise.reject(error);
            }

            originalRequest._retry = true;

            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({
                        resolve: (token: string) => {
                            if (originalRequest.headers) {
                                originalRequest.headers.Authorization = `Bearer ${token}`;
                            }
                            resolve(api(originalRequest));
                        },
                        reject: (err: any) => {
                            reject(err);
                        }
                    });
                });
            }

            isRefreshing = true;

            // Dispara evento global de expiração de sessão
            const event = new CustomEvent('cerberus-session-expired');
            window.dispatchEvent(event);

            return new Promise((resolve, reject) => {
                failedQueue.push({
                    resolve: (token: string) => {
                        if (originalRequest.headers) {
                            originalRequest.headers.Authorization = `Bearer ${token}`;
                        }
                        resolve(api(originalRequest));
                    },
                    reject: (err: any) => {
                        reject(err);
                    }
                });
            });
        }

        return Promise.reject(error);
    }
);

