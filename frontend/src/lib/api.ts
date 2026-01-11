import axios from 'axios';

import Cookies from 'js-cookie';

const api = axios.create({
    baseURL: 'http://localhost:8000/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add a request interceptor
api.interceptors.request.use(
    (config) => {
        const token = Cookies.get('access_token');
        console.log("Debug - Token from Cookie:", token);

        if (token && token !== 'undefined' && token !== 'null') {
            config.headers.Authorization = `Token ${token}`;
            console.log("Debug - Header Set:", config.headers.Authorization);
        } else {
            console.log("Debug - No valid token, sending as Guest");
            delete config.headers.Authorization;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default api;
