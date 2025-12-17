import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Upload, Loader } from 'lucide-react';
import { Button } from '@/components/common/Button';
const EMOJI_AVATARS = [
    '😀', '😎', '🤓', '😍', '🥳', '🤔',
    '😴', '🤬', '😤', '🥶', '🤩', '😇',
    '🐶', '🐱', '🦁', '🐼', '🐻', '🦊',
    '🐸', '🐢', '🐧', '🦆', '🦅', '🐢',
];
const UNSPLASH_KEYWORDS = [
    'avatar',
    'portrait',
    'person',
    'profile',
    'headshot',
];
export function AvatarSelector({ onSelect, loading = false }) {
    const [tab, setTab] = useState('emoji');
    const [stockImages, setStockImages] = useState([]);
    const [loadingImages, setLoadingImages] = useState(false);
    const [selectedEmoji, setSelectedEmoji] = useState(EMOJI_AVATARS[0]);
    useEffect(() => {
        if (tab === 'stock') {
            loadStockImages();
        }
    }, [tab]);
    const loadStockImages = async () => {
        setLoadingImages(true);
        try {
            const keyword = UNSPLASH_KEYWORDS[Math.floor(Math.random() * UNSPLASH_KEYWORDS.length)];
            const response = await fetch(`https://api.unsplash.com/search/photos?query=${keyword}&per_page=12&client_id=${import.meta.env.VITE_UNSPLASH_KEY || 'demo'}`);
            const data = await response.json();
            const urls = data.results?.map((img) => img.urls.small) || [];
            setStockImages(urls);
        }
        catch (error) {
            console.error('Failed to load stock images:', error);
        }
        finally {
            setLoadingImages(false);
        }
    };
    const handleEmojiSelect = (emoji) => {
        setSelectedEmoji(emoji);
        onSelect(emoji, 'emoji');
    };
    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        // File upload will be handled by parent component through API
        onSelect(URL.createObjectURL(file), 'custom');
    };
    return (_jsxs("div", { className: "w-full", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3", children: "Choose your avatar *" }), _jsx("div", { className: "flex gap-2 mb-4", children: ['emoji', 'stock', 'upload'].map((t) => (_jsxs("button", { onClick: () => setTab(t), className: `px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t
                        ? 'bg-accent-cyan text-dark-900'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'}`, children: [t === 'emoji' && '😀 Emoji', t === 'stock' && '🖼️ Stock', t === 'upload' && '📁 Upload'] }, t))) }), tab === 'emoji' && (_jsx("div", { className: "grid grid-cols-6 gap-2", children: EMOJI_AVATARS.map((emoji) => (_jsx("button", { onClick: () => handleEmojiSelect(emoji), className: `text-3xl p-2 rounded-lg transition-all ${selectedEmoji === emoji
                        ? 'bg-accent-cyan scale-110'
                        : 'bg-gray-100 dark:bg-gray-700 hover:scale-105'}`, children: emoji }, emoji))) })), tab === 'stock' && (_jsxs("div", { children: [loadingImages ? (_jsx("div", { className: "flex justify-center py-8", children: _jsx(Loader, { className: "animate-spin" }) })) : (_jsx("div", { className: "grid grid-cols-3 gap-2", children: stockImages.map((url, idx) => (_jsx("button", { onClick: () => onSelect(url, 'preset'), className: "aspect-square rounded-lg overflow-hidden hover:ring-2 hover:ring-accent-cyan transition-all", children: _jsx("img", { src: url, alt: "avatar", className: "w-full h-full object-cover" }) }, idx))) })), _jsx(Button, { onClick: loadStockImages, variant: "secondary", size: "sm", className: "mt-4 w-full", disabled: loadingImages, children: "Load more" })] })), tab === 'upload' && (_jsxs("label", { className: "block", children: [_jsxs("div", { className: "border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-accent-cyan cursor-pointer transition-colors", children: [_jsx(Upload, { className: "mx-auto mb-2" }), _jsx("p", { className: "text-sm text-gray-600 dark:text-gray-400", children: "Click to upload or drag and drop" })] }), _jsx("input", { type: "file", accept: "image/*", onChange: handleFileUpload, className: "hidden", disabled: loading })] }))] }));
}
