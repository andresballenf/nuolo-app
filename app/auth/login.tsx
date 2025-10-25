import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
  Keyboard,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LoginScreen() {
  const {
    signIn,
    signInWithOAuth,
    signInWithBiometric,
    biometricAvailable,
    loginAttempts,
    lockedUntil,
    validateEmail,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Feature flag for OAuth providers
  const oauthEnabled = process.env.EXPO_PUBLIC_ENABLE_OAUTH_PROVIDERS === 'true';
  
  // Check if account is locked
  const isLocked = lockedUntil && new Date(lockedUntil) > new Date();
  const remainingLockTime = isLocked 
    ? Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 60000)
    : 0;
  
  useEffect(() => {
    // Show biometric prompt if available and user has used it before
    const checkAndPromptBiometric = async () => {
      if (biometricAvailable) {
        // Check if user has stored credentials
        const hasStoredCredentials = await AsyncStorage.getItem('hasBiometricCredentials');
        if (hasStoredCredentials === 'true') {
          // Small delay to ensure screen is fully rendered
          setTimeout(() => {
            handleBiometricLogin();
          }, 500);
        }
      }
    };
    
    checkAndPromptBiometric();
  }, [biometricAvailable]);
  
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(email)) {
      newErrors.email = 'Please enter a valid email';
    }
    
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleLogin = async () => {
    if (isLocked) {
      Alert.alert(
        'Account Locked',
        `Too many failed attempts. Try again in ${remainingLockTime} minutes.`,
        [{ text: 'OK' }]
      );
      return;
    }
    
    if (!validateForm()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    
    setLoading(true);
    Keyboard.dismiss();
    
    try {
      const { error } = await signIn(email.trim(), password);
      
      if (error) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        
        if (error.message?.includes('Invalid login credentials')) {
          setErrors({ password: 'Invalid email or password' });
          
          if (loginAttempts >= 3) {
            Alert.alert(
              'Multiple Failed Attempts',
              `You have ${5 - loginAttempts} attempts remaining before your account is locked.`,
              [{ text: 'OK' }]
            );
          }
        } else {
          Alert.alert('Login Error', error.message || 'Failed to sign in');
        }
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace('/map');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };
  
  const handleOAuthLogin = async (provider: 'google' | 'apple') => {
    setLoading(true);
    
    try {
      const { error } = await signInWithOAuth(provider);
      
      if (error) {
        Alert.alert('Login Error', error.message || `Failed to sign in with ${provider}`);
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };
  
  const handleBiometricLogin = async (showErrors = false) => {
    try {
      const { error } = await signInWithBiometric();
      
      if (!error) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Mark that user has successfully used biometric
        await AsyncStorage.setItem('hasBiometricCredentials', 'true');
        router.replace('/map');
      } else if (showErrors) {
        // Only show errors when manually triggered
        if (error.message.includes('expired') || error.message.includes('No stored credentials')) {
          Alert.alert(
            'Biometric Setup Required',
            'Please sign in with your email and password first to enable biometric authentication.',
            [{ text: 'OK' }]
          );
        } else if (!error.message.includes('cancelled')) {
          // Don't show error if user cancelled
          Alert.alert('Authentication Failed', error.message, [{ text: 'OK' }]);
        }
      }
    } catch (error) {
      if (showErrors) {
        Alert.alert('Error', 'Unable to authenticate with biometrics', [{ text: 'OK' }]);
      }
    }
  };
  
  const handleFieldBlur = (field: string) => {
    setTouched({ ...touched, [field]: true });
    validateForm();
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="arrow-back" size={24} color="#1f2937" />
            </TouchableOpacity>
            
            <View style={styles.logoContainer}>
              <Image
                source={require('../../assets/images/nuolo-logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
          </View>
          
          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to continue your audio journey</Text>
            
            {/* Account Lock Warning */}
            {isLocked && (
              <View style={styles.lockWarning}>
                <Icon name="lock-closed" size={20} color="#dc2626" />
                <Text style={styles.lockText}>
                  Account locked for {remainingLockTime} more minutes
                </Text>
              </View>
            )}
            
            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <View style={[
                styles.inputWrapper,
                touched.email && errors.email && styles.inputError
              ]}>
                <Icon name="mail" size={20} color="#9ca3af" />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor="#9ca3af"
                  value={email}
                  onChangeText={setEmail}
                  onBlur={() => handleFieldBlur('email')}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading && !isLocked}
                />
              </View>
              {touched.email && errors.email && (
                <Text style={styles.errorText}>{errors.email}</Text>
              )}
            </View>
            
            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <View style={[
                styles.inputWrapper,
                touched.password && errors.password && styles.inputError
              ]}>
                <View style={styles.iconContainer}>
                  <Icon name="lock-closed" size={20} color="#9ca3af" />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor="#9ca3af"
                  value={password}
                  onChangeText={setPassword}
                  onBlur={() => handleFieldBlur('password')}
                  secureTextEntry={!showPassword}
                  editable={!loading && !isLocked}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Icon
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color="#9ca3af"
                  />
                </TouchableOpacity>
              </View>
              {touched.password && errors.password && (
                <Text style={styles.errorText}>{errors.password}</Text>
              )}
            </View>
            
            {/* Forgot Password */}
            <TouchableOpacity
              onPress={() => router.push('/auth/reset-password')}
              style={styles.forgotPassword}
              disabled={loading || !!isLocked}
            >
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </TouchableOpacity>
            
            {/* Login Button */}
            <Button
              title={loading ? 'Signing in...' : 'Sign In'}
              onPress={handleLogin}
              variant="primary"
              size="lg"
              style={styles.loginButton}
              disabled={loading || !!isLocked}
              loading={loading}
            />
            
            {/* Biometric Login */}
            {biometricAvailable && !isLocked && (
              <TouchableOpacity
                onPress={() => handleBiometricLogin(true)}
                style={styles.biometricButton}
                disabled={loading}
              >
                <Icon name="finger-print" size={24} color="#84cc16" />
                <Text style={styles.biometricText}>Use Biometric Login</Text>
              </TouchableOpacity>
            )}
            
            {/* OAuth Section - Only shown when enabled */}
            {oauthEnabled && (
              <>
                {/* Divider */}
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or continue with</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* OAuth Buttons */}
                <View style={styles.oauthContainer}>
                  <TouchableOpacity
                    style={styles.oauthButton}
                    onPress={() => handleOAuthLogin('google')}
                    disabled={loading || !!isLocked}
                  >
                    <Icon name="logo-google" size={24} color="#4285f4" />
                    <Text style={styles.oauthText}>Google</Text>
                  </TouchableOpacity>

                  {Platform.OS === 'ios' && (
                    <TouchableOpacity
                      style={styles.oauthButton}
                      onPress={() => handleOAuthLogin('apple')}
                      disabled={loading || !!isLocked}
                    >
                      <Icon name="logo-apple" size={24} color="#000000" />
                      <Text style={styles.oauthText}>Apple</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
            
            {/* Sign Up Link */}
            <View style={styles.signupContainer}>
              <Text style={styles.signupText}>Don't have an account? </Text>
              <TouchableOpacity
                onPress={() => router.push('/auth/signup')}
                disabled={loading}
              >
                <Text style={styles.signupLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 32,
  },
  backButton: {
    position: 'absolute',
    left: 0,
    zIndex: 1,
  },
  logoContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 120,
    height: 40,
  },
  form: {
    flex: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 32,
  },
  lockWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  lockText: {
    marginLeft: 8,
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '500',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f9fafb',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  iconContainer: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: '#1f2937',
    marginLeft: 12,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    color: '#84cc16',
    fontSize: 14,
    fontWeight: '600',
  },
  loginButton: {
    marginBottom: 20,
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    marginBottom: 24,
  },
  biometricText: {
    marginLeft: 8,
    color: '#84cc16',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#9ca3af',
    fontSize: 14,
  },
  oauthContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 32,
  },
  oauthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  oauthText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
  },
  signupContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 24,
  },
  signupText: {
    color: '#6b7280',
    fontSize: 14,
  },
  signupLink: {
    color: '#84cc16',
    fontSize: 14,
    fontWeight: '600',
  },
});