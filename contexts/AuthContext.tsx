import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Session, AuthError } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

interface User {
  id: string;
  email: string;
  emailVerified?: boolean;
  profile?: {
    fullName?: string;
    avatar?: string;
    preferences?: Record<string, any>;
  };
}

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  requiresVerification: boolean;
  biometricAvailable: boolean;
  loginAttempts: number;
  lockedUntil: Date | null;
}

interface AuthContextType extends AuthState {
  // Authentication methods
  signIn: (email: string, password: string) => Promise<{ error?: AuthError | null }>;
  signUp: (email: string, password: string, metadata?: Record<string, any>) => Promise<{ error?: AuthError | null }>;
  signInWithOAuth: (provider: 'google' | 'apple') => Promise<{ error?: AuthError | null }>;
  signInWithMagicLink: (email: string) => Promise<{ error?: AuthError | null }>;
  signInWithBiometric: () => Promise<{ error?: Error | null }>;
  signOut: () => Promise<void>;
  
  // Password management
  resetPassword: (email: string) => Promise<{ error?: AuthError | null }>;
  updatePassword: (newPassword: string) => Promise<{ error?: AuthError | null }>;
  
  // Session management
  refreshSession: () => Promise<void>;
  verifyEmail: (token: string) => Promise<{ error?: AuthError | null }>;
  
  // Security
  checkPasswordStrength: (password: string) => PasswordStrength;
  validateEmail: (email: string) => boolean;
  clearLoginAttempts: () => void;
}

interface PasswordStrength {
  score: number; // 0-4
  feedback: string[];
  isValid: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Security configuration
const SECURITY_CONFIG = {
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_REQUIRE_UPPERCASE: true,
  PASSWORD_REQUIRE_LOWERCASE: true,
  PASSWORD_REQUIRE_NUMBER: true,
  PASSWORD_REQUIRE_SPECIAL: true,
  BIOMETRIC_ENABLED: true,
};

// Development mode - set to false for production
const DEV_MODE = false;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    isAuthenticated: false,
    requiresVerification: false,
    biometricAvailable: false,
    loginAttempts: 0,
    lockedUntil: null,
  });
  
  const [lastActivity, setLastActivity] = useState<Date>(new Date());

  // Check for biometric availability
  useEffect(() => {
    checkBiometricAvailability();
  }, []);
  
  const checkBiometricAvailability = async () => {
    if (!SECURITY_CONFIG.BIOMETRIC_ENABLED) return;
    
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      
      setAuthState(prev => ({
        ...prev,
        biometricAvailable: hasHardware && isEnrolled,
      }));
    } catch (error) {
      console.error('Biometric check failed:', error);
    }
  };
  
  // Initialize authentication state
  useEffect(() => {
    initializeAuth();
  }, []);
  
  const initializeAuth = async () => {
    console.log('🔐 Initializing auth...');
    
    // Development mode bypass
    if (DEV_MODE) {
      console.log('🔧 Development mode: Bypassing authentication');
      setAuthState(prev => ({
        ...prev,
        user: {
          id: 'dev-user',
          email: 'dev@nuolo.com',
          emailVerified: true,
        },
        loading: false,
        isAuthenticated: true,
      }));
      return;
    }
    
    try {
      // Check for existing session
      const { data: { session }, error } = await supabase.auth.getSession();
      console.log('🔐 Session check:', { session: !!session, error });
      
      if (error) throw error;
      
      if (session) {
        // Load user profile
        const user = await loadUserProfile(session.user.id);
        
        setAuthState(prev => ({
          ...prev,
          user,
          session,
          loading: false,
          isAuthenticated: true,
          requiresVerification: !session.user.email_confirmed_at,
        }));
      } else {
        // No session - not authenticated
        setAuthState(prev => ({
          ...prev,
          loading: false,
          isAuthenticated: false,
          user: null,
          session: null,
        }));
      }
      
      // Load stored login attempts
      const storedAttempts = await AsyncStorage.getItem('loginAttempts');
      const storedLockout = await AsyncStorage.getItem('lockoutUntil');
      
      if (storedAttempts) {
        setAuthState(prev => ({
          ...prev,
          loginAttempts: parseInt(storedAttempts, 10),
        }));
      }
      
      if (storedLockout) {
        const lockoutDate = new Date(storedLockout);
        if (lockoutDate > new Date()) {
          setAuthState(prev => ({
            ...prev,
            lockedUntil: lockoutDate,
          }));
        } else {
          await AsyncStorage.removeItem('lockoutUntil');
        }
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      // Always set loading to false even on error
      setAuthState(prev => ({
        ...prev,
        loading: false,
        isAuthenticated: false,
        user: null,
        session: null,
      }));
    }
  };
  
  // Listen for auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event:', event);
        
        if (session) {
          const user = await loadUserProfile(session.user.id);
          
          setAuthState(prev => ({
            ...prev,
            user,
            session,
            isAuthenticated: true,
            requiresVerification: !session.user.email_confirmed_at,
            loading: false,
          }));
        } else {
          setAuthState(prev => ({
            ...prev,
            user: null,
            session: null,
            isAuthenticated: false,
            loading: false,
          }));
        }
        
        // Handle specific auth events
        switch (event) {
          case 'SIGNED_IN':
            await clearLoginAttempts();
            break;
          case 'TOKEN_REFRESHED':
            setLastActivity(new Date());
            break;
          case 'USER_UPDATED':
            if (session) {
              const user = await loadUserProfile(session.user.id);
              setAuthState(prev => ({ ...prev, user }));
            }
            break;
        }
      }
    );
    
    return () => subscription.unsubscribe();
  }, []);
  
  // Session timeout monitoring
  useEffect(() => {
    if (!authState.isAuthenticated) return;
    
    const checkSessionTimeout = setInterval(() => {
      const inactiveTime = Date.now() - lastActivity.getTime();
      
      if (inactiveTime > SECURITY_CONFIG.SESSION_TIMEOUT) {
        signOut();
      }
    }, 60000); // Check every minute
    
    return () => clearInterval(checkSessionTimeout);
  }, [authState.isAuthenticated, lastActivity]);
  
  const loadUserProfile = async (userId: string): Promise<User> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = row not found
        console.error('Error loading profile:', error);
      }
      
      const { data: { user } } = await supabase.auth.getUser();
      
      return {
        id: userId,
        email: user?.email || '',
        emailVerified: !!user?.email_confirmed_at,
        profile: data ? {
          fullName: data.full_name,
          avatar: data.avatar_url,
          preferences: data.preferences,
        } : undefined,
      };
    } catch (error) {
      console.error('Error loading user profile:', error);
      const { data: { user } } = await supabase.auth.getUser();
      return {
        id: userId,
        email: user?.email || '',
        emailVerified: !!user?.email_confirmed_at,
      };
    }
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };
  
  const checkPasswordStrength = (password: string): PasswordStrength => {
    const feedback: string[] = [];
    let score = 0;
    
    if (password.length >= SECURITY_CONFIG.PASSWORD_MIN_LENGTH) {
      score++;
    } else {
      feedback.push(`Password must be at least ${SECURITY_CONFIG.PASSWORD_MIN_LENGTH} characters`);
    }
    
    if (SECURITY_CONFIG.PASSWORD_REQUIRE_UPPERCASE && /[A-Z]/.test(password)) {
      score++;
    } else if (SECURITY_CONFIG.PASSWORD_REQUIRE_UPPERCASE) {
      feedback.push('Include at least one uppercase letter');
    }
    
    if (SECURITY_CONFIG.PASSWORD_REQUIRE_LOWERCASE && /[a-z]/.test(password)) {
      score++;
    } else if (SECURITY_CONFIG.PASSWORD_REQUIRE_LOWERCASE) {
      feedback.push('Include at least one lowercase letter');
    }
    
    if (SECURITY_CONFIG.PASSWORD_REQUIRE_NUMBER && /\d/.test(password)) {
      score++;
    } else if (SECURITY_CONFIG.PASSWORD_REQUIRE_NUMBER) {
      feedback.push('Include at least one number');
    }
    
    if (SECURITY_CONFIG.PASSWORD_REQUIRE_SPECIAL && /[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      score++;
    } else if (SECURITY_CONFIG.PASSWORD_REQUIRE_SPECIAL) {
      feedback.push('Include at least one special character');
    }
    
    return {
      score: Math.min(score, 4),
      feedback,
      isValid: feedback.length === 0,
    };
  };
  
  const handleLoginAttempt = async (success: boolean) => {
    if (success) {
      await clearLoginAttempts();
    } else {
      const newAttempts = authState.loginAttempts + 1;
      setAuthState(prev => ({ ...prev, loginAttempts: newAttempts }));
      await AsyncStorage.setItem('loginAttempts', newAttempts.toString());
      
      if (newAttempts >= SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS) {
        const lockoutUntil = new Date(Date.now() + SECURITY_CONFIG.LOCKOUT_DURATION);
        setAuthState(prev => ({ ...prev, lockedUntil: lockoutUntil }));
        await AsyncStorage.setItem('lockoutUntil', lockoutUntil.toISOString());
      }
    }
  };
  
  const clearLoginAttempts = async () => {
    setAuthState(prev => ({
      ...prev,
      loginAttempts: 0,
      lockedUntil: null,
    }));
    await AsyncStorage.removeItem('loginAttempts');
    await AsyncStorage.removeItem('lockoutUntil');
  };
  
  const signIn = async (email: string, password: string) => {
    try {
      // Check if account is locked
      if (authState.lockedUntil && authState.lockedUntil > new Date()) {
        const minutesLeft = Math.ceil(
          (authState.lockedUntil.getTime() - Date.now()) / 60000
        );
        return {
          error: {
            message: `Account locked. Try again in ${minutesLeft} minutes.`,
            status: 429,
          } as AuthError,
        };
      }
      
      // Validate email
      if (!validateEmail(email)) {
        return {
          error: {
            message: 'Please enter a valid email address',
            status: 400,
          } as AuthError,
        };
      }
      
      // Validate password
      if (!password || password.length < 6) {
        return {
          error: {
            message: 'Password is required',
            status: 400,
          } as AuthError,
        };
      }
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });
      
      await handleLoginAttempt(!error);
      setLastActivity(new Date());
      
      return { error };
    } catch (error) {
      await handleLoginAttempt(false);
      return {
        error: error as AuthError,
      };
    }
  };

  const signUp = async (email: string, password: string, metadata?: Record<string, any>) => {
    try {
      // Validate email
      if (!validateEmail(email)) {
        return {
          error: {
            message: 'Please enter a valid email address',
            status: 400,
          } as AuthError,
        };
      }
      
      // Check password strength
      const passwordStrength = checkPasswordStrength(password);
      if (!passwordStrength.isValid) {
        return {
          error: {
            message: passwordStrength.feedback.join('. '),
            status: 400,
          } as AuthError,
        };
      }
      
      const { data, error } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password,
        options: {
          data: metadata,
        },
      });
      
      if (data?.user && !error) {
        // Create user profile
        try {
          await supabase.from('profiles').insert({
            id: data.user.id,
            email: data.user.email,
            full_name: metadata?.fullName,
            created_at: new Date().toISOString(),
          });
        } catch (profileError) {
          console.error('Error creating profile:', profileError);
        }
      }
      
      return { error };
    } catch (error) {
      return {
        error: error as AuthError,
      };
    }
  };
  
  const signInWithOAuth = async (provider: 'google' | 'apple') => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          skipBrowserRedirect: true, // For React Native
        },
      });
      
      return { error };
    } catch (error) {
      return {
        error: error as AuthError,
      };
    }
  };
  
  const signInWithMagicLink = async (email: string) => {
    try {
      if (!validateEmail(email)) {
        return {
          error: {
            message: 'Please enter a valid email address',
            status: 400,
          } as AuthError,
        };
      }
      
      const { error } = await supabase.auth.signInWithOtp({
        email: email.toLowerCase().trim(),
      });
      
      return { error };
    } catch (error) {
      return {
        error: error as AuthError,
      };
    }
  };
  
  const signInWithBiometric = async () => {
    try {
      if (!authState.biometricAvailable) {
        return {
          error: new Error('Biometric authentication not available'),
        };
      }
      
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access Nuolo',
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use Password',
        disableDeviceFallback: false,
      });
      
      if (result.success) {
        // Retrieve stored credentials
        const storedEmail = await AsyncStorage.getItem('biometric_email');
        const storedToken = await AsyncStorage.getItem('biometric_token');
        
        if (storedEmail && storedToken) {
          // Use stored refresh token to sign in
          const { error } = await supabase.auth.setSession({
            access_token: storedToken,
            refresh_token: storedToken,
          });
          
          return { error };
        } else {
          return {
            error: new Error('No stored credentials found'),
          };
        }
      } else {
        return {
          error: new Error(result.error || 'Biometric authentication failed'),
        };
      }
    } catch (error) {
      return {
        error: error as Error,
      };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      await AsyncStorage.multiRemove([
        'biometric_email',
        'biometric_token',
        'loginAttempts',
        'lockoutUntil',
      ]);
      
      setAuthState({
        user: null,
        session: null,
        loading: false,
        isAuthenticated: false,
        requiresVerification: false,
        biometricAvailable: authState.biometricAvailable,
        loginAttempts: 0,
        lockedUntil: null,
      });
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };
  
  const resetPassword = async (email: string) => {
    try {
      if (!validateEmail(email)) {
        return {
          error: {
            message: 'Please enter a valid email address',
            status: 400,
          } as AuthError,
        };
      }
      
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.toLowerCase().trim()
      );
      
      return { error };
    } catch (error) {
      return {
        error: error as AuthError,
      };
    }
  };
  
  const updatePassword = async (newPassword: string) => {
    try {
      const passwordStrength = checkPasswordStrength(newPassword);
      if (!passwordStrength.isValid) {
        return {
          error: {
            message: passwordStrength.feedback.join('. '),
            status: 400,
          } as AuthError,
        };
      }
      
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      
      return { error };
    } catch (error) {
      return {
        error: error as AuthError,
      };
    }
  };
  
  const refreshSession = async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (!error && data.session) {
        setLastActivity(new Date());
      }
    } catch (error) {
      console.error('Session refresh error:', error);
    }
  };
  
  const verifyEmail = async (token: string) => {
    try {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: 'email',
      });
      
      if (!error) {
        setAuthState(prev => ({
          ...prev,
          requiresVerification: false,
        }));
      }
      
      return { error };
    } catch (error) {
      return {
        error: error as AuthError,
      };
    }
  };

  const contextValue: AuthContextType = {
    ...authState,
    signIn,
    signUp,
    signInWithOAuth,
    signInWithMagicLink,
    signInWithBiometric,
    signOut,
    resetPassword,
    updatePassword,
    refreshSession,
    verifyEmail,
    checkPasswordStrength,
    validateEmail,
    clearLoginAttempts,
  };
  
  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}