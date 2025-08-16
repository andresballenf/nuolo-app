import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { storage } from '../lib/utils';

type OnboardingStep = 
  | 'welcome'
  | 'personalization'
  | 'permissions';

interface OnboardingContextType {
  currentStep: OnboardingStep;
  currentStepIndex: number;
  totalSteps: number;
  hasCompletedOnboarding: boolean;
  loading: boolean;
  nextStep: () => void;
  previousStep: () => void;
  goToStep: (step: OnboardingStep) => void;
  goToStepIndex: (index: number) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void; // Development helper
  getStepLabels: () => string[];
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

const steps: OnboardingStep[] = [
  'welcome',
  'personalization',
  'permissions'
];

const stepLabels: Record<OnboardingStep, string> = {
  'welcome': 'Welcome',
  'personalization': 'Personalize',
  'permissions': 'Get Started'
};

const ONBOARDING_KEY = 'hasCompletedOnboarding';

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOnboardingStatus();
  }, []);

  const loadOnboardingStatus = async () => {
    try {
      const completed = await storage.getItem(ONBOARDING_KEY);
      setHasCompletedOnboarding(completed === 'true');
    } catch (error) {
      console.error('Error loading onboarding status:', error);
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  const previousStep = () => {
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  const completeOnboarding = async () => {
    try {
      await storage.setItem(ONBOARDING_KEY, 'true');
      setHasCompletedOnboarding(true);
      // Reset to welcome for next time (though it won't show)
      setCurrentStep('welcome');
    } catch (error) {
      console.error('Error saving onboarding completion:', error);
    }
  };

  const resetOnboarding = async () => {
    try {
      await storage.removeItem(ONBOARDING_KEY);
      setHasCompletedOnboarding(false);
      setCurrentStep('welcome');
      console.log('🔧 Development: Onboarding reset');
    } catch (error) {
      console.error('Error resetting onboarding:', error);
    }
  };

  const goToStep = (step: OnboardingStep) => {
    if (steps.includes(step)) {
      setCurrentStep(step);
    }
  };

  const goToStepIndex = (index: number) => {
    if (index >= 0 && index < steps.length) {
      setCurrentStep(steps[index]);
    }
  };

  const getStepLabels = () => {
    return steps.map(step => stepLabels[step]);
  };

  const currentStepIndex = steps.indexOf(currentStep);
  const totalSteps = steps.length;

  return (
    <OnboardingContext.Provider
      value={{
        currentStep,
        currentStepIndex,
        totalSteps,
        hasCompletedOnboarding,
        loading,
        nextStep,
        previousStep,
        goToStep,
        goToStepIndex,
        completeOnboarding,
        resetOnboarding,
        getStepLabels,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}