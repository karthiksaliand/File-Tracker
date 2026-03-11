import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, Redirect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { Colors, Spacing, Radius } from '../constants/theme';

const TAHSILDAR_LOCATIONS = [
  'Mangaluru', 'Bantwal', 'Mulki', 'Moodabidri',
  'Puttur', 'Sulya', 'Kadaba', 'Ullala', 'Belthangady',
];

const ROLE_CATEGORIES = [
  {
    id: 'case_worker', title: 'Case Worker', icon: 'clipboard-text-outline' as const,
    roles: [{ role: 'case_worker', label: 'Case Worker', username: 'caseworker' }],
  },
  {
    id: 'tahsildar', title: 'Tahsildar', icon: 'office-building' as const,
    roles: TAHSILDAR_LOCATIONS.map(loc => ({
      role: 'tahsildar', label: `Tahsildar - ${loc}`, username: `tah_${loc.toLowerCase()}`,
    })),
  },
  {
    id: 'dept_officers', title: 'Department Officers', icon: 'shield-account' as const,
    roles: [
      { role: 'sp', label: 'Superintendent of Police', username: 'sp' },
      { role: 'forest_officer', label: 'Forest Officer (DFO/DCF)', username: 'forest' },
    ],
  },
  {
    id: 'senior', title: 'Senior Officers & Admin', icon: 'account-tie' as const,
    roles: [
      { role: 'adc', label: 'Assistant Commissioner (ADC)', username: 'adc' },
      { role: 'dc', label: 'Deputy Commissioner (DC)', username: 'dc' },
      { role: 'admin', label: 'System Admin', username: 'admin' },
    ],
  },
];

type Step = 'category' | 'subrole' | 'login';

export default function LoginScreen() {
  const router = useRouter();
  const { user, isLoading, login } = useAuth();
  const [step, setStep] = useState<Step>('category');
  const [selectedCategory, setSelectedCategory] = useState<typeof ROLE_CATEGORIES[0] | null>(null);
  const [selectedRole, setSelectedRole] = useState<{ role: string; label: string; username: string } | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  if (!isLoading && user) {
    return <Redirect href="/(tabs)" />;
  }

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const handleCategorySelect = (cat: typeof ROLE_CATEGORIES[0]) => {
    setSelectedCategory(cat);
    if (cat.roles.length === 1) {
      setSelectedRole(cat.roles[0]);
      setUsername(cat.roles[0].username);
      setStep('login');
    } else {
      setStep('subrole');
    }
  };

  const handleRoleSelect = (role: { role: string; label: string; username: string }) => {
    setSelectedRole(role);
    setUsername(role.username);
    setStep('login');
  };

  const handleBack = () => {
    if (step === 'login' && selectedCategory && selectedCategory.roles.length > 1) {
      setStep('subrole');
      setPassword('');
    } else {
      setStep('category');
      setSelectedCategory(null);
      setSelectedRole(null);
      setUsername('');
      setPassword('');
    }
  };

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter username and password');
      return;
    }
    setLoggingIn(true);
    try {
      await login(username.trim(), password.trim());
    } catch (e: any) {
      Alert.alert('Login Failed', e.message || 'Invalid credentials');
    } finally {
      setLoggingIn(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.emblem}>
              <MaterialCommunityIcons name="shield-check" size={40} color={Colors.primaryForeground} />
            </View>
            <Text style={styles.title}>DK FILE TRACKER</Text>
            <Text style={styles.subtitle}>Government File Tracking System</Text>
            <Text style={styles.district}>Dakshina Kannada District</Text>
          </View>

          {/* Step indicator */}
          {step !== 'category' && (
            <TouchableOpacity testID="back-btn" style={styles.backBtn} onPress={handleBack}>
              <MaterialCommunityIcons name="arrow-left" size={20} color={Colors.primary} />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
          )}

          {/* Category Selection */}
          {step === 'category' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>SELECT YOUR ROLE</Text>
              {ROLE_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  testID={`role-category-${cat.id}`}
                  style={styles.categoryCard}
                  onPress={() => handleCategorySelect(cat)}
                  activeOpacity={0.7}
                >
                  <View style={styles.categoryIcon}>
                    <MaterialCommunityIcons name={cat.icon} size={28} color={Colors.primary} />
                  </View>
                  <View style={styles.categoryInfo}>
                    <Text style={styles.categoryTitle}>{cat.title}</Text>
                    <Text style={styles.categoryCount}>
                      {cat.roles.length === 1 ? '1 role' : `${cat.roles.length} roles`}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={24} color={Colors.mutedForeground} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Sub-role Selection */}
          {step === 'subrole' && selectedCategory && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{selectedCategory.title.toUpperCase()}</Text>
              {selectedCategory.roles.map((role) => (
                <TouchableOpacity
                  key={role.username}
                  testID={`role-option-${role.username}`}
                  style={styles.roleCard}
                  onPress={() => handleRoleSelect(role)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.roleLabel}>{role.label}</Text>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.mutedForeground} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Login Form */}
          {step === 'login' && selectedRole && (
            <View style={styles.section}>
              <View style={styles.roleTag}>
                <Text style={styles.roleTagText}>{selectedRole.label}</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>USERNAME</Text>
                <TextInput
                  testID="username-input"
                  style={styles.input}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="Enter username"
                  placeholderTextColor={Colors.mutedForeground}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>PASSWORD</Text>
                <TextInput
                  testID="password-input"
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder="Enter password"
                  placeholderTextColor={Colors.mutedForeground}
                />
              </View>

              <TouchableOpacity
                testID="login-btn"
                style={[styles.loginBtn, loggingIn && styles.loginBtnDisabled]}
                onPress={handleLogin}
                disabled={loggingIn}
                activeOpacity={0.8}
              >
                {loggingIn ? (
                  <ActivityIndicator color={Colors.primaryForeground} />
                ) : (
                  <Text style={styles.loginBtnText}>SIGN IN</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: 40 },
  header: {
    backgroundColor: Colors.primary,
    paddingVertical: 40,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
  },
  emblem: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md,
  },
  title: { fontSize: 28, fontWeight: '800', color: Colors.primaryForeground, letterSpacing: 1 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: Spacing.xs },
  district: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2, letterSpacing: 0.5 },
  backBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md,
  },
  backText: { fontSize: 14, color: Colors.primary, marginLeft: 4, fontWeight: '600' },
  section: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: Colors.mutedForeground,
    letterSpacing: 1.5, marginBottom: Spacing.md,
  },
  categoryCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  categoryIcon: {
    width: 48, height: 48, borderRadius: Radius.md,
    backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center',
  },
  categoryInfo: { flex: 1, marginLeft: Spacing.md },
  categoryTitle: { fontSize: 16, fontWeight: '600', color: Colors.secondaryForeground },
  categoryCount: { fontSize: 12, color: Colors.mutedForeground, marginTop: 2 },
  roleCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  roleLabel: { fontSize: 15, fontWeight: '500', color: Colors.secondaryForeground },
  roleTag: {
    backgroundColor: Colors.primary, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    alignSelf: 'flex-start', marginBottom: Spacing.lg,
  },
  roleTagText: { fontSize: 12, fontWeight: '700', color: Colors.primaryForeground, letterSpacing: 0.5 },
  inputGroup: { marginBottom: Spacing.md },
  inputLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.mutedForeground,
    letterSpacing: 1, marginBottom: 6,
  },
  input: {
    height: 48, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: Spacing.md,
    fontSize: 16, color: Colors.secondaryForeground, backgroundColor: Colors.surface,
  },
  loginBtn: {
    height: 52, backgroundColor: Colors.primary, borderRadius: Radius.md,
    justifyContent: 'center', alignItems: 'center', marginTop: Spacing.md,
  },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText: { fontSize: 16, fontWeight: '700', color: Colors.primaryForeground, letterSpacing: 1 },
});
