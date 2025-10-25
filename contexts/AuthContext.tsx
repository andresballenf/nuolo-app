import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Session, AuthError, PostgrestSingleResponse } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import * as AppleAuthentication from 'expo-apple-authentication';

// OAuth features are enabled in development build
const isExpoGo = false;

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
};

const getErrorCode = (error: unknown): string | undefined => {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
};

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

// Secure storage keys
const SECURE_STORE_KEYS = {
  BIOMETRIC_EMAIL: 'biometric_email',
  BIOMETRIC_TOKEN: 'biometric_token',
  BIOMETRIC_REFRESH_TOKEN: 'biometric_refresh_token',
  TOKEN_TIMESTAMP: 'token_timestamp'
};

// Token expiration time (7 days)
const TOKEN_EXPIRATION_TIME = 7 * 24 * 60 * 60 * 1000;
const PROFILE_FETCH_TIMEOUT = 5000;

// Secure storage utilities
const secureStorage = {
  async setItem(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error('Error storing secure item:', error);
      throw error;
    }
  },

  async getItem(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error('Error retrieving secure item:', error);
      return null;
    }
  },

  async deleteItem(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error('Error deleting secure item:', error);
    }
  },

  async isTokenValid(): Promise<boolean> {
    try {
      const timestamp = await this.getItem(SECURE_STORE_KEYS.TOKEN_TIMESTAMP);
      if (!timestamp) return false;
      
      const tokenAge = Date.now() - parseInt(timestamp, 10);
      return tokenAge < TOKEN_EXPIRATION_TIME;
    } catch (error) {
      console.error('Error checking token validity:', error);
      return false;
    }
  }
};

const clearBiometricCredentials = async () => {
  try {
    await Promise.all([
      secureStorage.deleteItem(SECURE_STORE_KEYS.BIOMETRIC_EMAIL),
      secureStorage.deleteItem(SECURE_STORE_KEYS.BIOMETRIC_TOKEN),
      secureStorage.deleteItem(SECURE_STORE_KEYS.BIOMETRIC_REFRESH_TOKEN),
      secureStorage.deleteItem(SECURE_STORE_KEYS.TOKEN_TIMESTAMP),
    ]);
    await AsyncStorage.removeItem('hasBiometricCredentials');
  } catch (error) {
    console.error('Error clearing biometric credentials:', error);
  }
};

async function withTimeout<T>(
  operation: () => PromiseLike<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation(), timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

const buildUserFromSession = (sessionUser: Session['user']): User => ({
  id: sessionUser.id,
  email: sessionUser.email || '',
  emailVerified: !!sessionUser.email_confirmed_at,
});


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
    // Delay initialization to ensure all contexts are ready
    const timer = setTimeout(() => {
      initializeAuth();
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);
  
  const initializeAuth = async () => {
    console.log('🔐 Initializing auth...');
    
    try {
      // Check for existing session
      const { data: { session }, error } = await supabase.auth.getSession();
      console.log('🔐 Session check:', { session: !!session, error });
      
      if (error) throw error;
      
      if (session) {
        const baseUser = buildUserFromSession(session.user);

        setAuthState(prev => ({
          ...prev,
          user: baseUser,
          session,
          loading: false,
          isAuthenticated: true,
          requiresVerification: !session.user.email_confirmed_at,
        }));

        loadUserProfile(session.user.id, session.user)
          .then(userWithProfile => {
            setAuthState(prev => {
              if (!prev.session || prev.session.user.id !== session.user.id) {
                return prev;
              }

              return {
                ...prev,
                user: userWithProfile,
              };
            });
          })
          .catch(profileError => {
            console.error('Error loading user profile after session set:', profileError);
          });
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
        
        // Handle token refresh errors specifically
        if (event === 'TOKEN_REFRESHED' && !session) {
          console.log('Token refresh failed - clearing session');
          // Clear invalid session data
          await AsyncStorage.removeItem('supabase.auth.token');
          setAuthState(prev => ({
            ...prev,
            user: null,
            session: null,
            isAuthenticated: false,
            loading: false,
          }));
          return;
        }
        
        if (session) {
          const baseUser = buildUserFromSession(session.user);

          setAuthState(prev => ({
            ...prev,
            user: baseUser,
            session,
            isAuthenticated: true,
            requiresVerification: !session.user.email_confirmed_at,
            loading: false,
          }));

          loadUserProfile(session.user.id, session.user)
            .then(userWithProfile => {
              setAuthState(prev => {
                if (!prev.session || prev.session.user.id !== session.user.id) {
                  return prev;
                }

                return {
                  ...prev,
                  user: userWithProfile,
                };
              });
            })
            .catch(profileError => {
              console.error('Error refreshing user profile after auth event:', profileError);
            });
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
            // Save credentials for biometric auth if available
            if (session) {
              await saveBiometricCredentials(session);
            }
            break;
          case 'TOKEN_REFRESHED':
            if (session) {
              setLastActivity(new Date());
              // Update stored tokens when refreshed
              await saveBiometricCredentials(session);
            }
            break;
          case 'USER_UPDATED':
            if (session) {
              loadUserProfile(session.user.id, session.user)
                .then(updatedUser => {
                  setAuthState(prev => {
                    if (!prev.session || prev.session.user.id !== session.user.id) {
                      return prev;
                    }
                    return { ...prev, user: updatedUser };
                  });
                })
                .catch(profileError => {
                  console.error('Error updating user profile after USER_UPDATED event:', profileError);
                });
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
  
  const loadUserProfile = async (userId: string, sessionUser?: Session['user']): Promise<User> => {
    const userData: User = {
      id: userId,
      email: sessionUser?.email || '',
      emailVerified: !!sessionUser?.email_confirmed_at,
    };

    type ProfileRow = {
      full_name?: string | null;
      avatar_url?: string | null;
      preferences?: Record<string, unknown> | null;
    };

    try {
      const { data, error } = await withTimeout<PostgrestSingleResponse<ProfileRow>>(
        () =>
          supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single(),
        PROFILE_FETCH_TIMEOUT,
        'Profile fetch timed out'
      );

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading profile:', error);
      }

      if (data) {
        userData.profile = {
          fullName: data.full_name ?? undefined,
          avatar: data.avatar_url ?? undefined,
          preferences: data.preferences ? (data.preferences as Record<string, any>) : undefined,
        };
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }

    if (!userData.email) {
      try {
        const { data: authData, error: authError } = await withTimeout(
          () => supabase.auth.getUser(),
          PROFILE_FETCH_TIMEOUT,
          'Auth user fetch timed out'
        );

        if (authError) {
          console.error('Error loading user from auth:', authError);
        }

        if (authData?.user) {
          userData.email = authData.user.email || '';
          userData.emailVerified = !!authData.user.email_confirmed_at;
        }
      } catch (fallbackError) {
        console.error('Error loading auth user fallback:', fallbackError);
      }
    }

    return userData;
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

      if (!error && data?.session) {
        await saveBiometricCredentials(data.session);
      }

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
          emailRedirectTo: 'nuolo://auth/confirm',
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
      // Handle Apple Sign-In natively on iOS
      if (provider === 'apple' && Platform.OS === 'ios' && AppleAuthentication) {
        // Check if Apple Authentication is available
        const isAvailable = await AppleAuthentication.isAvailableAsync();
        if (!isAvailable) {
          return {
            error: {
              message: 'Apple Sign-In is not available on this device',
              status: 400
            } as AuthError
          };
        }

        try {
          // Request Apple authentication
          const credential = await AppleAuthentication.signInAsync({
            requestedScopes: [
              AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
              AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
          });

          // Extract the identity token
          const { identityToken, email, fullName, user: appleUserId } = credential;
          
          if (!identityToken) {
            throw new Error('No identity token received from Apple');
          }

          // Sign in with Supabase using the Apple ID token
          const { data, error } = await supabase.auth.signInWithIdToken({
            provider: 'apple',
            token: identityToken,
          });

          if (!error && data.user) {
            const fullNameString = fullName ? `${fullName.givenName || ''} ${fullName.familyName || ''}`.trim() : undefined;

            if (fullNameString || email) {
              try {
                await supabase.auth.updateUser({
                  data: {
                    full_name: fullNameString,
                    email: email || undefined,
                    apple_user_id: appleUserId,
                  },
                });
              } catch (metadataError) {
                console.warn('Failed to update user metadata after Apple sign-in:', metadataError);
              }
            }

            // Check if profile exists, create if not
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', data.user.id)
              .single();

            if (!profile) {
              // Create profile for Apple user
              await supabase.from('profiles').insert({
                id: data.user.id,
                email: email || data.user.email,
                full_name: fullNameString || data.user.user_metadata?.full_name,
                created_at: new Date().toISOString(),
              });
            }
          }

          return { error };
        } catch (appleError: unknown) {
          // Handle Apple-specific errors
          const errorCode = getErrorCode(appleError);
          if (errorCode === 'ERR_CANCELED') {
            return {
              error: {
                message: 'Sign in with Apple was cancelled',
                status: 400
              } as AuthError
            };
          }
          const fallbackError = appleError instanceof Error ? appleError : new Error(getErrorMessage(appleError));
          throw fallbackError;
        }
      }

      // For Google, use Supabase's OAuth method
      // For React Native, we need to use a simpler approach
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider as 'google',
        options: {
          redirectTo: 'nuolo://auth/callback',
          skipBrowserRedirect: false, // Allow browser redirect for mobile
        }
      });

      if (error) {
        return { error };
      }

      // The OAuth flow will handle the redirect back to the app
      // Supabase will automatically manage the session
      return { error: null };
    } catch (error: unknown) {
      console.error('OAuth error:', error);
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
    } catch (error: unknown) {
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
      
      // Check if stored credentials are still valid
      const isTokenValid = await secureStorage.isTokenValid();
      if (!isTokenValid) {
        await clearBiometricCredentials();
        return {
          error: new Error('Stored credentials have expired. Please sign in again.'),
        };
      }
      
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access Nuolo',
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use Password',
        disableDeviceFallback: false,
      });
      
      if (result.success) {
        // Retrieve stored credentials from secure storage
        const storedEmail = await secureStorage.getItem(SECURE_STORE_KEYS.BIOMETRIC_EMAIL);
        const storedAccessToken = await secureStorage.getItem(SECURE_STORE_KEYS.BIOMETRIC_TOKEN);
        const storedRefreshToken = await secureStorage.getItem(SECURE_STORE_KEYS.BIOMETRIC_REFRESH_TOKEN);
        
        if (storedEmail && storedAccessToken && storedRefreshToken) {
          // Use stored tokens to restore session
          const { error } = await supabase.auth.setSession({
            access_token: storedAccessToken,
            refresh_token: storedRefreshToken,
          });

          if (!error) {
            setLastActivity(new Date());
          } else {
            await clearBiometricCredentials();
          }

          return { error };
        } else {
          await clearBiometricCredentials();
          return {
            error: new Error('No stored credentials found. Please sign in with email and password first.'),
          };
        }
      } else {
        return {
          error: new Error(result.error || 'Biometric authentication failed'),
        };
      }
    } catch (error) {
      await clearBiometricCredentials();
      return {
        error: error as Error,
      };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      
      // Clear both AsyncStorage and SecureStore
      await AsyncStorage.multiRemove([
        'loginAttempts',
        'lockoutUntil',
      ]);

      await clearBiometricCredentials();
      
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
  
  // Save biometric credentials after successful authentication
  const saveBiometricCredentials = async (session: Session) => {
    try {
      if (authState.biometricAvailable && session.access_token && session.refresh_token) {
        await Promise.all([
          secureStorage.setItem(SECURE_STORE_KEYS.BIOMETRIC_EMAIL, session.user.email || ''),
          secureStorage.setItem(SECURE_STORE_KEYS.BIOMETRIC_TOKEN, session.access_token),
          secureStorage.setItem(SECURE_STORE_KEYS.BIOMETRIC_REFRESH_TOKEN, session.refresh_token),
          secureStorage.setItem(SECURE_STORE_KEYS.TOKEN_TIMESTAMP, Date.now().toString()),
        ]);
        await AsyncStorage.setItem('hasBiometricCredentials', 'true');
        console.log('Biometric credentials saved securely');
      }
    } catch (error) {
      console.error('Error saving biometric credentials:', error);
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
        email.toLowerCase().trim(),
        {
          redirectTo: 'nuolo://auth/update-password',
        }
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
      
      if (error) {
        console.error('Session refresh error:', error);
        
        // If refresh token is invalid, clear session
        if (error.message?.includes('Refresh Token') || 
            error.message?.includes('Invalid Refresh Token') ||
            error.message?.includes('Refresh Token Not Found')) {
          console.log('Invalid refresh token - clearing session');
          
          // Clear all auth data
          await AsyncStorage.multiRemove([
            'supabase.auth.token',
            'loginAttempts',
            'lockoutUntil'
          ]);
          
          // Clear secure store
          try {
            await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.BIOMETRIC_TOKEN);
            await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.BIOMETRIC_REFRESH_TOKEN);
          } catch (e) {
            // Ignore secure store errors
          }
          
          // Reset auth state
          setAuthState(prev => ({
            ...prev,
            user: null,
            session: null,
            isAuthenticated: false,
            loading: false,
          }));
          
          return;
        }
      }
      
      if (data?.session) {
        setLastActivity(new Date());
        setAuthState(prev => ({
          ...prev,
          session: data.session,
        }));
      }
    } catch (error) {
      console.error('Session refresh error:', error);
      // Don't throw - just log the error
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
