import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';
import { useOnboarding } from '../../contexts/OnboardingContext';

export const PrivacyStep: React.FC = () => {
  const { nextStep, previousStep } = useOnboarding();

  return (
    <SafeAreaView style={styles.container}>
      <Card variant="gradient" style={styles.card}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <Icon name="shield-checkmark" size={24} color="#ffffff" />
              </View>
              <Text style={styles.title}>Privacy & Data</Text>
            </View>
            
            <Text style={styles.subtitle}>
              We respect your privacy and are committed to protecting your personal data.
            </Text>
            
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>What We Collect</Text>
              <View style={styles.bulletPoint}>
                <Icon name="checkmark-circle" size={16} color="rgba(255, 255, 255, 0.9)" />
                <Text style={styles.bulletText}>Location data for nearby attractions</Text>
              </View>
              <View style={styles.bulletPoint}>
                <Icon name="checkmark-circle" size={16} color="rgba(255, 255, 255, 0.9)" />
                <Text style={styles.bulletText}>User preferences and settings</Text>
              </View>
              <View style={styles.bulletPoint}>
                <Icon name="checkmark-circle" size={16} color="rgba(255, 255, 255, 0.9)" />
                <Text style={styles.bulletText}>Audio tour usage analytics</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>How We Protect Your Data</Text>
              <View style={styles.bulletPoint}>
                <Icon name="lock-closed" size={16} color="rgba(255, 255, 255, 0.9)" />
                <Text style={styles.bulletText}>All data is encrypted in transit</Text>
              </View>
              <View style={styles.bulletPoint}>
                <Icon name="lock-closed" size={16} color="rgba(255, 255, 255, 0.9)" />
                <Text style={styles.bulletText}>Location data is never shared with third parties</Text>
              </View>
              <View style={styles.bulletPoint}>
                <Icon name="lock-closed" size={16} color="rgba(255, 255, 255, 0.9)" />
                <Text style={styles.bulletText}>You can delete your data at any time</Text>
              </View>
            </View>

            <View style={styles.privacyNote}>
              <Text style={styles.privacyText}>
                By continuing, you agree to our Privacy Policy and Terms of Service. 
                You can review and change your privacy settings at any time in the app.
              </Text>
            </View>
            
            <View style={styles.buttonContainer}>
              <Button
                title="Back"
                onPress={previousStep}
                variant="outline"
                size="md"
                style={styles.backButton}
                textStyle={styles.backButtonText}
              />
              <Button
                title="Continue"
                onPress={nextStep}
                variant="primary"
                size="md"
                style={styles.button}
              />
            </View>
          </View>
        </ScrollView>
      </Card>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(132, 204, 22, 0.1)',
    padding: 20,
  },
  card: {
    flex: 1,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    flex: 1,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 24,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  bulletPoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bulletText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },
  privacyNote: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  privacyText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 16,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  button: {
    flex: 1,
  },
  backButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 2,
  },
  backButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});