import React, { useState } from 'react';
import { api } from '../../../services/api';

export const ReportLogo = ({ url }: { url?: string | null }) => {
    const [error, setError] = useState(false);
    
    if (!url || error) {
        return (
            <div className="h-12 w-12 bg-gray-100 rounded flex items-center justify-center font-bold text-gray-400">
                LOGO
            </div>
        );
    }
    
    const fullUrl = url.startsWith('http') ? url : `${api.defaults.baseURL || 'http://localhost:8000'}${url}`;
    
    return (
        <img 
            src={fullUrl} 
            alt="Logo" 
            className="h-12 object-contain"
            onError={() => setError(true)}
        />
    );
};
