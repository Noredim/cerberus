import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { api } from '../services/api';

interface User {
    id: string;
    name: string;
    email: string;
    roles: string[];
}

export interface UserCompany {
    id: string;
    company_id: string;
    is_default: boolean;
    company_name: string;
    company_cnpj: string;
}

interface AuthContextData {
    user: User | null;
    isAuthenticated: boolean;
    login: (token: string, userData: User) => void;
    logout: () => void;
    isLoading: boolean;
    userCompanies: UserCompany[];
    activeCompanyId: string | null;
    setActiveCompany: (companyId: string) => void;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [userCompanies, setUserCompanies] = useState<UserCompany[]>([]);
    const [activeCompanyId, setActiveCompanyIdState] = useState<string | null>(null);

    const fetchCompanies = async () => {
        try {
            const { data } = await api.get<UserCompany[]>('/users/me/companies');
            setUserCompanies(data);
            
            // Check if there's a saved company preference in localStorage
            const savedCompanyId = localStorage.getItem('@Cerberus:companyId');
            
            if (savedCompanyId && data.some(c => c.company_id === savedCompanyId)) {
                setActiveCompanyIdState(savedCompanyId);
            } else if (data.length === 1) {
                // If the user only has 1 company, auto-select it
                setActiveCompanyIdState(data[0].company_id);
                localStorage.setItem('@Cerberus:companyId', data[0].company_id);
            } else {
                // Force user to explicitly choose on next screen
                setActiveCompanyIdState(null);
                localStorage.removeItem('@Cerberus:companyId');
            }
        } catch (error) {
            console.error('Failed to fetch user companies', error);
        }
    };

    useEffect(() => {
        const storedToken = localStorage.getItem('@Cerberus:token');
        const storedUser = localStorage.getItem('@Cerberus:user');

        if (storedToken && storedUser) {
            try {
                setUser(JSON.parse(storedUser));
                fetchCompanies().finally(() => setIsLoading(false));
            } catch (e) {
                console.error('Failed to parse user session', e);
                setIsLoading(false);
            }
        } else {
            setIsLoading(false);
        }
    }, []);

    const login = (token: string, userData: User) => {
        setIsLoading(true);
        localStorage.setItem('@Cerberus:token', token);
        localStorage.setItem('@Cerberus:user', JSON.stringify(userData));
        setUser(userData);
        fetchCompanies().finally(() => setIsLoading(false)); // load context immediately upon login
    };

    const logout = () => {
        localStorage.removeItem('@Cerberus:token');
        localStorage.removeItem('@Cerberus:user');
        localStorage.removeItem('@Cerberus:companyId');
        setUser(null);
        setUserCompanies([]);
        setActiveCompanyIdState(null);
    };
    
    const setActiveCompany = (companyId: string) => {
        localStorage.setItem('@Cerberus:companyId', companyId);
        setActiveCompanyIdState(companyId);
        // Force a page window reload or heavily rely on React Query cache invalidation. 
        // For simplicity and to ensure total clean state, reload is safest
        window.location.reload();
    };

    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated: !!user,
            login,
            logout,
            isLoading,
            userCompanies,
            activeCompanyId,
            setActiveCompany
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    return useContext(AuthContext);
};
