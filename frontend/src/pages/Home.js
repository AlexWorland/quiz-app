import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/common/Button';
import { useNavigate } from 'react-router-dom';
export function HomePage() {
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();
    const handleLogout = () => {
        logout();
        navigate('/login');
    };
    return (_jsx("div", { className: "min-h-screen bg-gradient-to-br from-dark-950 to-dark-900 p-8", children: _jsxs("div", { className: "max-w-6xl mx-auto", children: [_jsxs("div", { className: "flex justify-between items-center mb-12", children: [_jsx("h1", { className: "text-4xl font-bold text-white", children: "Quiz App" }), _jsxs("div", { className: "flex items-center gap-4", children: [_jsxs("span", { className: "text-gray-300", children: [user?.avatar_type === 'emoji' ? user.avatar_url : '👤', " ", user?.username] }), _jsx(Button, { onClick: handleLogout, variant: "secondary", children: "Logout" })] })] }), _jsxs("div", { className: "bg-dark-900 rounded-lg shadow-xl p-8", children: [_jsxs("h2", { className: "text-2xl font-bold text-white mb-4", children: ["Welcome, ", user?.username, "!"] }), _jsxs("p", { className: "text-gray-400 mb-6", children: ["You're logged in as a ", user?.role, ". More features coming soon..."] }), user?.role === 'participant' && (_jsxs("div", { className: "space-y-3", children: [_jsx("h3", { className: "text-xl font-semibold text-white", children: "Participant Features" }), _jsxs("ul", { className: "text-gray-400 space-y-2", children: [_jsx("li", { children: "\u2713 Join quiz events via QR code or join code" }), _jsx("li", { children: "\u2713 Participate in segment quizzes" }), _jsx("li", { children: "\u2713 Draw in the collaborative canvas while waiting" }), _jsx("li", { children: "\u2713 View your scores and leaderboards" })] })] })), user?.role === 'presenter' && (_jsxs("div", { className: "space-y-3", children: [_jsx("h3", { className: "text-xl font-semibold text-white", children: "Presenter Features" }), _jsxs("ul", { className: "text-gray-400 space-y-2", children: [_jsx("li", { children: "\u2713 Create events with multiple segments" }), _jsx("li", { children: "\u2713 Enable audio recording and AI question generation" }), _jsx("li", { children: "\u2713 Mark presentation segments" }), _jsx("li", { children: "\u2713 Control quiz flow and view real-time results" }), _jsx("li", { children: "\u2713 Generate QR code for participants to join" })] })] }))] })] }) }));
}
