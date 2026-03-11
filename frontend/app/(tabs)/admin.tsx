import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, Modal, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { fetchAPI } from '../../constants/api';
import { Colors, Spacing, Radius } from '../../constants/theme';

type Tab = 'users' | 'analytics' | 'audit';

export default function AdminScreen() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('users');
  const [users, setUsers] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resetModal, setResetModal] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');

  const loadData = useCallback(async () => {
    try {
      if (tab === 'users') {
        setUsers(await fetchAPI('/admin/users'));
      } else if (tab === 'analytics') {
        setAnalytics(await fetchAPI('/admin/analytics'));
      } else {
        setAuditLogs(await fetchAPI('/admin/audit-logs?limit=100'));
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    loadData();
  }, [loadData]));

  const toggleUser = async (userId: string) => {
    try {
      const res = await fetchAPI(`/admin/users/${userId}/toggle-active`, { method: 'POST' });
      Alert.alert('Success', res.message);
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const resetPassword = async () => {
    if (!newPassword.trim()) return;
    try {
      await fetchAPI(`/admin/users/${resetModal.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ new_password: newPassword }),
      });
      Alert.alert('Success', 'Password reset successfully');
      setResetModal(null);
      setNewPassword('');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.center}>
          <Text style={s.emptyText}>Admin access only</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      {/* Tabs */}
      <View style={s.tabBar}>
        {(['users', 'analytics', 'audit'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            testID={`admin-tab-${t}`}
            style={[s.tabItem, tab === t && s.tabActive]}
            onPress={() => { setTab(t); setLoading(true); }}
          >
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
          contentContainerStyle={s.content}
        >
          {tab === 'users' && (
            <>
              <Text style={s.sectionTitle}>ALL USERS ({users.length})</Text>
              {users.map((u) => (
                <View key={u.id} style={s.userCard}>
                  <View style={s.userInfo}>
                    <Text style={s.userDisplay}>{u.display_name}</Text>
                    <Text style={s.userMeta}>@{u.username} | {u.role} | {u.department}</Text>
                  </View>
                  <View style={s.userActions}>
                    <TouchableOpacity
                      testID={`reset-pwd-${u.id}`}
                      style={s.actionBtn}
                      onPress={() => { setResetModal(u); setNewPassword(''); }}
                    >
                      <MaterialCommunityIcons name="lock-reset" size={18} color={Colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      testID={`toggle-user-${u.id}`}
                      style={s.actionBtn}
                      onPress={() => toggleUser(u.id)}
                    >
                      <MaterialCommunityIcons
                        name={u.is_active ? 'account-check' : 'account-off'}
                        size={18}
                        color={u.is_active ? Colors.success : Colors.error}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </>
          )}

          {tab === 'analytics' && analytics && (
            <>
              <Text style={s.sectionTitle}>FILE ANALYTICS</Text>
              <View style={s.analyticsGrid}>
                {[
                  { label: 'Total', value: analytics.total, color: Colors.primary },
                  { label: 'Draft', value: analytics.draft, color: '#94A3B8' },
                  { label: 'Pending', value: analytics.submitted, color: Colors.warning },
                  { label: 'Approved', value: analytics.approved, color: Colors.success },
                  { label: 'Rejected', value: analytics.rejected, color: Colors.error },
                  { label: 'Delayed', value: analytics.delayed, color: '#DC2626' },
                ].map((item) => (
                  <View key={item.label} style={s.analyticsCard}>
                    <Text style={[s.analyticsValue, { color: item.color }]}>{item.value}</Text>
                    <Text style={s.analyticsLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>

              <Text style={[s.sectionTitle, { marginTop: Spacing.lg }]}>DEPARTMENT PENDING</Text>
              {Object.entries(analytics.department_pending || {}).map(([dept, count]) => (
                <View key={dept} style={s.deptPendingRow}>
                  <Text style={s.deptLabel}>{dept.toUpperCase()}</Text>
                  <Text style={s.deptValue}>{count as number} pending</Text>
                </View>
              ))}

              <Text style={[s.sectionTitle, { marginTop: Spacing.lg }]}>DEFAULT CREDENTIALS</Text>
              <View style={s.credCard}>
                <Text style={s.credText}>admin / admin123</Text>
                <Text style={s.credText}>caseworker / case123</Text>
                <Text style={s.credText}>tah_[location] / tah123</Text>
                <Text style={s.credText}>forest / forest123</Text>
                <Text style={s.credText}>sp / sp123</Text>
                <Text style={s.credText}>adc / adc123 | dc / dc123</Text>
              </View>
            </>
          )}

          {tab === 'audit' && (
            <>
              <Text style={s.sectionTitle}>AUDIT LOG ({auditLogs.length})</Text>
              {auditLogs.map((log) => (
                <View key={log.id} style={s.auditCard}>
                  <View style={s.auditHeader}>
                    <Text style={s.auditAction}>{log.action}</Text>
                    <Text style={s.auditTime}>{new Date(log.timestamp).toLocaleString()}</Text>
                  </View>
                  <Text style={s.auditUser}>{log.user_name} ({log.user_role})</Text>
                  {log.file_number ? <Text style={s.auditFile}>{log.file_number}</Text> : null}
                  {log.details ? <Text style={s.auditDetails}>{log.details}</Text> : null}
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}

      {/* Reset Password Modal */}
      <Modal visible={!!resetModal} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Reset Password</Text>
            <Text style={s.modalSub}>{resetModal?.display_name} (@{resetModal?.username})</Text>
            <TextInput
              testID="new-password-input"
              style={s.modalInput}
              placeholder="New password"
              placeholderTextColor={Colors.mutedForeground}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
            <View style={s.modalActions}>
              <TouchableOpacity testID="cancel-reset-btn" style={s.modalCancel} onPress={() => setResetModal(null)}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="confirm-reset-btn" style={s.modalConfirm} onPress={resetPassword}>
                <Text style={s.modalConfirmText}>Reset</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabBar: {
    flexDirection: 'row', backgroundColor: Colors.background,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  tabItem: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: Colors.mutedForeground },
  tabTextActive: { color: Colors.primary },
  content: { padding: Spacing.md },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: Colors.mutedForeground,
    letterSpacing: 1.5, marginBottom: Spacing.sm,
  },
  emptyText: { fontSize: 14, color: Colors.mutedForeground },
  userCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.background, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  userInfo: { flex: 1 },
  userDisplay: { fontSize: 14, fontWeight: '600', color: Colors.secondaryForeground },
  userMeta: { fontSize: 11, color: Colors.mutedForeground, marginTop: 2 },
  userActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center',
  },
  analyticsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  analyticsCard: {
    width: '30%', flexGrow: 1,
    backgroundColor: Colors.background, borderRadius: Radius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center',
  },
  analyticsValue: { fontSize: 28, fontWeight: '800' },
  analyticsLabel: { fontSize: 10, fontWeight: '700', color: Colors.mutedForeground, marginTop: 2, letterSpacing: 0.5 },
  deptPendingRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: Colors.background, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  deptLabel: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  deptValue: { fontSize: 13, fontWeight: '600', color: Colors.warning },
  credCard: {
    backgroundColor: Colors.background, borderRadius: Radius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  credText: { fontSize: 13, color: Colors.secondaryForeground, marginBottom: 4, fontFamily: 'monospace' },
  auditCard: {
    backgroundColor: Colors.background, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  auditHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  auditAction: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  auditTime: { fontSize: 10, color: Colors.mutedForeground },
  auditUser: { fontSize: 12, color: Colors.mutedForeground, marginTop: 2 },
  auditFile: { fontSize: 11, fontWeight: '600', color: Colors.primary, marginTop: 2 },
  auditDetails: { fontSize: 12, color: Colors.secondaryForeground, marginTop: 2 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalContent: {
    width: '85%', backgroundColor: Colors.background,
    borderRadius: Radius.lg, padding: Spacing.lg,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.primary },
  modalSub: { fontSize: 13, color: Colors.mutedForeground, marginTop: 4, marginBottom: Spacing.md },
  modalInput: {
    height: 48, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: Spacing.md,
    fontSize: 16, color: Colors.secondaryForeground, backgroundColor: Colors.surface,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: Spacing.lg },
  modalCancel: { paddingHorizontal: 16, paddingVertical: 10 },
  modalCancelText: { fontSize: 14, fontWeight: '600', color: Colors.mutedForeground },
  modalConfirm: {
    paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: Colors.primary, borderRadius: Radius.md,
  },
  modalConfirmText: { fontSize: 14, fontWeight: '700', color: Colors.primaryForeground },
});
