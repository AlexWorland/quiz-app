import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { authAPI } from '@/api/endpoints';
import { useAuthStore } from '@/store/authStore';
export function LoginPage() {
    const navigate = useNavigate();
    const login = useAuthStore((state) => state.login);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
    });
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const validateForm = () => {
        const newErrors = {};
        if (!formData.username.trim())
            newErrors.username = 'Username is required';
        if (!formData.password.trim())
            newErrors.password = 'Password is required';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm())
            return;
        setLoading(true);
        try {
            const response = await authAPI.login({
                username: formData.username,
                password: formData.password,
            });
            login(response.data.user, response.data.token);
            navigate('/');
        }
        catch (error) {
            const message = error.response?.data?.error || 'Login failed';
            setErrors({ submit: message });
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsx("div", { className: "min-h-screen bg-gradient-to-br from-dark-950 to-dark-900 flex items-center justify-center p-4", children: _jsxs("div", { className: "w-full max-w-md bg-dark-900 rounded-lg shadow-xl p-8", children: [_jsx("h1", { className: "text-3xl font-bold text-white mb-2", children: "Welcome Back" }), _jsx("p", { className: "text-gray-400 mb-6", children: "Login to your Quiz App account" }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsx(Input, { label: "Username", type: "text", placeholder: "Enter your username", value: formData.username, onChange: (e) => setFormData({ ...formData, username: e.target.value }), error: errors.username, disabled: loading }), _jsx(Input, { label: "Password", type: "password", placeholder: "Enter your password", value: formData.password, onChange: (e) => setFormData({ ...formData, password: e.target.value }), error: errors.password, disabled: loading }), errors.submit && (_jsx("div", { className: "bg-red-500/10 border border-red-500 text-red-500 p-3 rounded-lg text-sm", children: errors.submit })), _jsx(Button, { type: "submit", variant: "primary", size: "lg", className: "w-full", loading: loading, children: "Login" })] }), _jsxs("p", { className: "text-center text-gray-400 mt-6", children: ["Don't have an account?", ' ', _jsx(Link, { to: "/register", className: "text-accent-cyan hover:underline", children: "Register here" })] })] }) }));
}
