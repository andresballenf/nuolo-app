import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
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
import { logger } from '../lib/logger';
import { TelemetryService } from '../services/TelemetryService';

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
  signIn: (email: string, password: string) => Promise<{ error?: AuthError | null; biometricSaved?: boolean }>;
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

// Secure storage keys (for sensitive data)
const SECURE_STORE_KEYS = {
  BIOMETRIC_ACCESS_TOKEN: 'biometric_access_token',
  BIOMETRIC_REFRESH_TOKEN: 'biometric_refresh_token',
  TOKEN_TIMESTAMP: 'token_timestamp',
  // Legacy keys from password-based biometric login (cleanup only)
  LEGACY_BIOMETRIC_EMAIL: 'biometric_email',
  LEGACY_BIOMETRIC_PASSWORD: 'biometric_password',
};

// AsyncStorage keys (for metadata backup - more reliable on simulator)
const ASYNC_STORAGE_KEYS = {
  HAS_BIOMETRIC_CREDENTIALS: 'hasBiometricCredentials',
  BIOMETRIC_TIMESTAMP_BACKUP: 'biometric_timestamp_backup',
};

// Token expiration time (7 days)
const TOKEN_EXPIRATION_TIME = 7 * 24 * 60 * 60 * 1000;
const PROFILE_FETCH_TIMEOUT = 5000;

const isRefreshTokenError = (message: string | undefined): boolean => {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return normalized.includes('refresh token');
};

// Secure storage utilities
const secureStorage = {
  async setItem(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      logger.error('Error storing secure item', error, { key });
      throw error;
    }
  },

  async getItem(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      logger.error('Error retrieving secure item', error, { key });
      return null;
    }
  },

  async deleteItem(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      logger.error('Error deleting secure item', error, { key });
    }
  },

  async isTokenValid(): Promise<boolean> {
    try {
      // Try AsyncStorage first (more reliable on simulator)
      let timestamp = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.BIOMETRIC_TIMESTAMP_BACKUP);
      logger.debug('Checked biometric timestamp backup in AsyncStorage', {
        found: Boolean(timestamp),
      });

      // Fallback to SecureStore if AsyncStorage is empty
      if (!timestamp) {
        timestamp = await this.getItem(SECURE_STORE_KEYS.TOKEN_TIMESTAMP);
        logger.debug('Checked biometric timestamp in SecureStore', {
          found: Boolean(timestamp),
        });
      }

      if (!timestamp) {
        logger.warn('No biometric token timestamp found in secure storage');
        return false;
      }

      const parsedTimestamp = Number.parseInt(timestamp, 10);
      if (!Number.isFinite(parsedTimestamp)) {
        logger.warn('Invalid biometric token timestamp format');
        return false;
      }

      const tokenAge = Date.now() - parsedTimestamp;
      const isValid = tokenAge < TOKEN_EXPIRATION_TIME;
      logger.info('Evaluated biometric token validity', { isValid });
      return isValid;
    } catch (error) {
      logger.error('Error checking biometric token validity', error);
      return false;
    }
  }
};

const clearBiometricCredentials = async () => {
  try {
    logger.info('Clearing biometric credentials');
    // Clear SecureStore
    await Promise.all([
      secureStorage.deleteItem(SECURE_STORE_KEYS.BIOMETRIC_ACCESS_TOKEN),
      secureStorage.deleteItem(SECURE_STORE_KEYS.BIOMETRIC_REFRESH_TOKEN),
      secureStorage.deleteItem(SECURE_STORE_KEYS.TOKEN_TIMESTAMP),
      secureStorage.deleteItem(SECURE_STORE_KEYS.LEGACY_BIOMETRIC_EMAIL),
      secureStorage.deleteItem(SECURE_STORE_KEYS.LEGACY_BIOMETRIC_PASSWORD),
    ]);
    // Clear AsyncStorage backups
    await AsyncStorage.multiRemove([
      ASYNC_STORAGE_KEYS.HAS_BIOMETRIC_CREDENTIALS,
      ASYNC_STORAGE_KEYS.BIOMETRIC_TIMESTAMP_BACKUP,
    ]);
    logger.info('Biometric credentials cleared');
  } catch (error) {
    logger.error('Error clearing biometric credentials', error);
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
  const biometricSignInInProgress = useRef(false);

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
      logger.error('Biometric check failed', error);
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
    logger.info('Initializing auth state');
    
    try {
      // Check for existing session
      const { data: { session }, error } = await supabase.auth.getSession();
      logger.info('Auth session check completed', {
        hasSession: Boolean(session),
        hasError: Boolean(error),
      });
      
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
            logger.error('Error loading user profile after session set', profileError);
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
      logger.error('Auth initialization error', error);
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
        logger.info('Auth state changed', { event, hasSession: Boolean(session) });

        // Handle token refresh errors specifically
        if (event === 'TOKEN_REFRESHED' && !session) {
          logger.warn('Token refresh failed; clearing session');
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

        // Don't clear credentials on SIGNED_OUT if it's from setSession failure
        if (event === 'SIGNED_OUT') {
          logger.info('SIGNED_OUT event received');
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
              logger.error('Error refreshing user profile after auth event', profileError);
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
            // Note: Biometric credentials (email + password) are saved in signIn function
            // We don't save them here because we don't have access to the password
            break;
          case 'TOKEN_REFRESHED':
            if (session) {
              setLastActivity(new Date());
              // Update timestamp to keep credentials fresh if they exist
              const hasCredentials = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.HAS_BIOMETRIC_CREDENTIALS);
              if (hasCredentials === 'true') {
                await AsyncStorage.setItem(ASYNC_STORAGE_KEYS.BIOMETRIC_TIMESTAMP_BACKUP, Date.now().toString());
                await secureStorage.setItem(SECURE_STORE_KEYS.TOKEN_TIMESTAMP, Date.now().toString());
              }
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
                  logger.error('Error updating user profile after USER_UPDATED event', profileError);
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
        logger.error('Error loading profile', error);
      }

      if (data) {
        userData.profile = {
          fullName: data.full_name ?? undefined,
          avatar: data.avatar_url ?? undefined,
          preferences: data.preferences ? (data.preferences as Record<string, any>) : undefined,
        };
      }
    } catch (error) {
      logger.error('Error loading user profile', error);
    }

    if (!userData.email) {
      try {
        const { data: authData, error: authError } = await withTimeout(
          () => supabase.auth.getUser(),
          PROFILE_FETCH_TIMEOUT,
          'Auth user fetch timed out'
        );

        if (authError) {
          logger.error('Error loading user from auth', authError);
        }

        if (authData?.user) {
          userData.email = authData.user.email || '';
          userData.emailVerified = !!authData.user.email_confirmed_at;
        }
      } catch (fallbackError) {
        logger.error('Error loading auth user fallback', fallbackError);
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
    logger.info('Sign-in requested', { biometricAvailable: authState.biometricAvailable });
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
          biometricSaved: false,
        };
      }

      // Validate email
      if (!validateEmail(email)) {
        return {
          error: {
            message: 'Please enter a valid email address',
            status: 400,
          } as AuthError,
          biometricSaved: false,
        };
      }

      // Validate password
      if (!password || password.length < 6) {
        return {
          error: {
            message: 'Password is required',
            status: 400,
          } as AuthError,
          biometricSaved: false,
        };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      await handleLoginAttempt(!error);
      setLastActivity(new Date());
      if (error) {
        TelemetryService.increment('auth_sign_in_error');
      } else {
        TelemetryService.increment('auth_sign_in_success');
      }

      let biometricSaved = false;
      if (!error && data?.session) {
        logger.info('Sign-in succeeded; saving biometric credentials');
        // Wait for biometric credentials to be saved before returning
        biometricSaved = await saveBiometricCredentials(data.session);
        logger.info('Biometric credential save completed', { biometricSaved });
      } else if (error) {
        logger.warn('Sign-in failed', { reason: error.message });
      }

      return { error, biometricSaved };
    } catch (error) {
      await handleLoginAttempt(false);
      TelemetryService.increment('auth_sign_in_exception');
      return {
        error: error as AuthError,
        biometricSaved: false,
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
          logger.error('Error creating profile', profileError);
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
                logger.warn('Failed to update user metadata after Apple sign-in', metadataError);
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
      logger.error('OAuth error', error);
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
    logger.info('Biometric sign-in requested');
    try {
      if (biometricSignInInProgress.current) {
        TelemetryService.increment('auth_biometric_sign_in_blocked_in_progress');
        return {
          error: new Error('Biometric sign-in already in progress'),
        };
      }

      if (!authState.biometricAvailable) {
        TelemetryService.increment('auth_biometric_sign_in_unavailable');
        logger.warn('Biometric sign-in rejected: biometrics unavailable');
        return {
          error: new Error('Biometric authentication not available'),
        };
      }

      biometricSignInInProgress.current = true;

      // Check AsyncStorage flag first (quick check)
      const hasCredentials = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.HAS_BIOMETRIC_CREDENTIALS);
      logger.info('Biometric credential availability checked', {
        hasCredentials: hasCredentials === 'true',
      });

      if (!hasCredentials || hasCredentials !== 'true') {
        TelemetryService.increment('auth_biometric_sign_in_no_credentials');
        logger.warn('Biometric sign-in rejected: no stored credentials');
        return {
          error: new Error('No stored credentials found. Please sign in with email and password first.'),
        };
      }

      // Check if stored credentials are still valid
      const isTokenValid = await secureStorage.isTokenValid();
      logger.info('Biometric token validity checked', { isTokenValid });

      if (!isTokenValid) {
        TelemetryService.increment('auth_biometric_sign_in_expired_credentials');
        logger.warn('Biometric tokens expired; clearing credentials');
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
        logger.info('Biometric authentication passed');
        const storedAccessToken = await secureStorage.getItem(SECURE_STORE_KEYS.BIOMETRIC_ACCESS_TOKEN);
        const storedRefreshToken = await secureStorage.getItem(SECURE_STORE_KEYS.BIOMETRIC_REFRESH_TOKEN);

        logger.info('Loaded stored biometric session tokens', {
          hasAccessToken: !!storedAccessToken,
          hasRefreshToken: !!storedRefreshToken,
        });

        if (storedAccessToken && storedRefreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: storedAccessToken,
            refresh_token: storedRefreshToken,
          });

          logger.info('Biometric setSession result', {
            hasSession: !!data?.session,
            hasUser: !!data?.session?.user,
            hasError: Boolean(error),
          });

          if (!error && data?.session) {
            TelemetryService.increment('auth_biometric_sign_in_success');
            logger.info('Biometric sign-in succeeded');
            setLastActivity(new Date());
            // Update timestamp to keep credentials fresh
            const refreshedAccessToken = data.session.access_token;
            const refreshedRefreshToken = data.session.refresh_token;
            await secureStorage.setItem(SECURE_STORE_KEYS.BIOMETRIC_ACCESS_TOKEN, refreshedAccessToken);
            await secureStorage.setItem(SECURE_STORE_KEYS.BIOMETRIC_REFRESH_TOKEN, refreshedRefreshToken);
            await AsyncStorage.setItem(ASYNC_STORAGE_KEYS.BIOMETRIC_TIMESTAMP_BACKUP, Date.now().toString());
            await secureStorage.setItem(SECURE_STORE_KEYS.TOKEN_TIMESTAMP, Date.now().toString());
          } else {
            TelemetryService.increment('auth_biometric_sign_in_set_session_error');
            logger.error('Biometric sign-in failed during setSession', error);
            // Clear credentials if session tokens are no longer valid
            await clearBiometricCredentials();
          }

          return { error };
        } else {
          TelemetryService.increment('auth_biometric_sign_in_missing_tokens');
          logger.error('Missing stored session credentials for biometric sign-in');
          await clearBiometricCredentials();
          return {
            error: new Error('No stored biometric session found. Please sign in again with email and password.'),
          };
        }
      } else {
        TelemetryService.increment('auth_biometric_prompt_cancelled_or_failed');
        logger.info('Biometric authentication cancelled or failed', { reason: result.error });
        return {
          error: new Error(result.error || 'Biometric authentication failed'),
        };
      }
    } catch (error) {
      TelemetryService.increment('auth_biometric_sign_in_exception');
      await clearBiometricCredentials();
      logger.error('Biometric sign-in encountered an unrecoverable error', error);
      return {
        error: error as Error,
      };
    } finally {
      biometricSignInInProgress.current = false;
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();

      // Clear login attempt data from AsyncStorage
      await AsyncStorage.multiRemove([
        'loginAttempts',
        'lockoutUntil',
      ]);

      // NOTE: Biometric credentials are intentionally NOT cleared here
      // This allows users to use biometric login after signing out,
      // which is standard behavior in most apps (banking, social media, etc.)
      // Users can manually clear biometric data from device settings if desired

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
      logger.error('Sign out error', error);
    }
  };
  
  // Save biometric credentials after successful authentication
  const saveBiometricCredentials = async (session: Session): Promise<boolean> => {
    try {
      if (!authState.biometricAvailable) {
        logger.info('Biometric unavailable; skipping credential save');
        return false;
      }

      if (!session.access_token || !session.refresh_token) {
        logger.error('Missing session tokens; cannot save biometric credentials');
        return false;
      }

      logger.info('Saving biometric session tokens');
      const timestamp = Date.now().toString();

      // Save sensitive session tokens to SecureStore
      await Promise.all([
        secureStorage.setItem(SECURE_STORE_KEYS.BIOMETRIC_ACCESS_TOKEN, session.access_token),
        secureStorage.setItem(SECURE_STORE_KEYS.BIOMETRIC_REFRESH_TOKEN, session.refresh_token),
        secureStorage.setItem(SECURE_STORE_KEYS.TOKEN_TIMESTAMP, timestamp),
      ]);

      // Save metadata to AsyncStorage (more reliable on simulator)
      await AsyncStorage.multiSet([
        [ASYNC_STORAGE_KEYS.HAS_BIOMETRIC_CREDENTIALS, 'true'],
        [ASYNC_STORAGE_KEYS.BIOMETRIC_TIMESTAMP_BACKUP, timestamp],
      ]);

      // Verify data was actually saved
      const verifyTimestamp = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.BIOMETRIC_TIMESTAMP_BACKUP);
      const verifyFlag = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.HAS_BIOMETRIC_CREDENTIALS);

      if (!verifyTimestamp || !verifyFlag) {
        throw new Error('Failed to verify saved credentials in AsyncStorage');
      }

      logger.info('Biometric credentials saved successfully');
      return true;
    } catch (error) {
      logger.error('Error saving biometric credentials', error);
      // Clean up partial saves on error
      try {
        await clearBiometricCredentials();
      } catch (cleanupError) {
        logger.error('Error cleaning up failed biometric save', cleanupError);
      }
      return false;
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
        TelemetryService.increment('auth_refresh_session_error');
        logger.error('Session refresh error', error);
        
        // If refresh token is invalid, clear session
        if (isRefreshTokenError(error.message)) {
          TelemetryService.increment('auth_refresh_session_invalid_refresh_token');
          logger.warn('Invalid refresh token; clearing session');
          
          // Clear all auth data
          await AsyncStorage.multiRemove([
            'supabase.auth.token',
            'loginAttempts',
            'lockoutUntil'
          ]);
          
          // Clear stored biometric credentials and metadata
          await clearBiometricCredentials();
          
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
        TelemetryService.increment('auth_refresh_session_success');
        setLastActivity(new Date());
        setAuthState(prev => ({
          ...prev,
          session: data.session,
        }));
      }
    } catch (error) {
      TelemetryService.increment('auth_refresh_session_exception');
      logger.error('Session refresh error', error);
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
