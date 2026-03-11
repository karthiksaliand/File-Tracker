import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { fetchAPI } from '../../constants/api';
import { Colors, Spacing, Radius, StatusColors, StatusLabels } from '../../constants/theme';
import { AppDialog } from '../../components/AppDialog';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [analytics, setAnalytics] = useState<any>(null);
  const [recentFiles, setRecentFiles] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const loadData = useCallback(async () => {
    if (isLoggingOut) return;
    try {
      const [stats, files, notifs] = await Promise.all([
        fetchAPI('/admin/analytics'),
        fetchAPI('/files'),
        fetchAPI('/notifications/unread-count'),
      ]);
      setAnalytics(stats);
      setRecentFiles(files.slice(0, 5));
      setUnreadCount(notifs.count);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isLoggingOut]);

  useFocusEffect(useCallback(() => {
    if (!isLoggingOut) {
      setLoading(true);
      loadData();
    }
  }, [loadData, isLoggingOut]));

  const handleLogout = () => {
    setShowLogoutDialog(true);
  };

  const confirmLogout = async () => {
    setIsLoggingOut(true);
    setShowLogoutDialog(false);
    try {
      await logout();
    } catch (e) {
      console.error('Logout error:', e);
    }
    router.replace('/');
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      </SafeAreaView>
    );
  }

  const statCards = [
    { label: 'Total', value: analytics?.total ?? 0, color: Colors.primary, icon: 'file-document-multiple-outline' },
    { label: 'Pending', value: analytics?.submitted ?? 0, color: Colors.warning, icon: 'clock-outline' },
    { label: 'Approved', value: analytics?.approved ?? 0, color: Colors.success, icon: 'check-circle-outline' },
    { label: 'Rejected', value: analytics?.rejected ?? 0, color: Colors.error, icon: 'close-circle-outline' },
    { label: 'Delayed', value: analytics?.delayed ?? 0, color: '#DC2626', icon: 'alert-outline' },
    { label: 'Draft', value: analytics?.draft ?? 0, color: '#94A3B8', icon: 'file-edit-outline' },
  ];

  return (
    <SafeAreaView style={s.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
      >
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>Welcome back,</Text>
            <Text style={s.userName}>{user?.display_name}</Text>
            <View style={s.roleTag}>
              <Text style={s.roleTagText}>{user?.role?.replace('_', ' ').toUpperCase()}</Text>
            </View>
          </View>
          <View style={s.headerActions}>
            {unreadCount > 0 && (
              <TouchableOpacity testID="notif-badge-btn" style={s.notifBtn} onPress={() => router.push('/(tabs)/notifications')}>
                <MaterialCommunityIcons name="bell-ring" size={22} color={Colors.accent} />
                <View style={s.badge}><Text style={s.badgeText}>{unreadCount}</Text></View>
              </TouchableOpacity>
            )}
            <TouchableOpacity testID="logout-btn" onPress={handleLogout} style={s.logoutBtn}>
              <MaterialCommunityIcons name="logout" size={22} color={Colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats */}
        <View style={s.statsGrid}>
          {statCards.map((stat) => (
            <View key={stat.label} style={s.statCard}>
              <MaterialCommunityIcons name={stat.icon as any} size={22} color={stat.color} />
              <Text style={[s.statValue, { color: stat.color }]}>{stat.value}</Text>
              <Text style={s.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Dept Pending */}
        {analytics?.department_pending && (
          <View style={s.sectionContainer}>
            <Text style={s.sectionTitle}>DEPARTMENT PENDING</Text>
            <View style={s.deptRow}>
              {Object.entries(analytics.department_pending).map(([dept, count]) => (
                <View key={dept} style={s.deptChip}>
                  <Text style={s.deptName}>{dept.toUpperCase()}</Text>
                  <Text style={s.deptCount}>{count as number}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Quick Actions */}
        {(user?.role === 'case_worker' || user?.role === 'admin') && (
          <View style={s.sectionContainer}>
            <TouchableOpacity
              testID="create-file-btn"
              style={s.createBtn}
              onPress={() => router.push('/create-file')}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="plus" size={22} color={Colors.primaryForeground} />
              <Text style={s.createBtnText}>Create New File</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Recent Files */}
        <View style={s.sectionContainer}>
          <Text style={s.sectionTitle}>RECENT FILES</Text>
          {recentFiles.length === 0 ? (
            <Text style={s.emptyText}>No files yet</Text>
          ) : (
            recentFiles.map((file) => (
              <TouchableOpacity
                key={file.id}
                testID={`recent-file-${file.id}`}
                style={s.fileCard}
                onPress={() => router.push({ pathname: '/file-detail', params: { id: file.id } })}
              >
                <View style={s.fileCardHeader}>
                  <Text style={s.fileNumber}>{file.file_number}</Text>
                  <View style={[s.statusBadge, { backgroundColor: StatusColors[file.status] || '#94A3B8' }]}>
                    <Text style={s.statusText}>{StatusLabels[file.status] || file.status}</Text>
                  </View>
                </View>
                <Text style={s.applicantName} numberOfLines={1}>{file.description}</Text>
                {file.deadline && file.status === 'submitted' && (
                  <Text style={s.deadlineText}>
                    Deadline: {Math.max(0, Math.ceil((new Date(file.deadline).getTime() - Date.now()) / 86400000))} days left
                  </Text>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Logout Dialog */}
      <AppDialog
        visible={showLogoutDialog}
        title="Logout"
        message="Are you sure you want to logout?"
        buttons={[
          { text: 'Cancel', style: 'cancel', onPress: () => setShowLogoutDialog(false) },
          { text: 'Logout', style: 'destructive', onPress: confirmLogout },
        ]}
        onDismiss={() => setShowLogoutDialog(false)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    backgroundColor: Colors.background, padding: Spacing.lg,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  greeting: { fontSize: 14, color: Colors.mutedForeground },
  userName: { fontSize: 22, fontWeight: '700', color: Colors.primary, marginTop: 2 },
  roleTag: {
    backgroundColor: Colors.secondary, borderRadius: Radius.sm,
    paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 6,
  },
  roleTagText: { fontSize: 10, fontWeight: '700', color: Colors.mutedForeground, letterSpacing: 0.8 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notifBtn: { position: 'relative', padding: 8 },
  badge: {
    position: 'absolute', top: 2, right: 2,
    backgroundColor: Colors.accent, borderRadius: 10, minWidth: 18,
    height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4,
  },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#FFF' },
  logoutBtn: { padding: 8 },
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    padding: Spacing.md, gap: Spacing.sm,
  },
  statCard: {
    width: '30%', flexGrow: 1,
    backgroundColor: Colors.background, borderRadius: Radius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center',
  },
  statValue: { fontSize: 28, fontWeight: '800', marginTop: 4 },
  statLabel: { fontSize: 11, color: Colors.mutedForeground, fontWeight: '600', marginTop: 2, letterSpacing: 0.3 },
  sectionContainer: { paddingHorizontal: Spacing.lg, marginTop: Spacing.md },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: Colors.mutedForeground,
    letterSpacing: 1.5, marginBottom: Spacing.sm,
  },
  deptRow: { flexDirection: 'row', gap: Spacing.sm },
  deptChip: {
    flex: 1, backgroundColor: Colors.background, borderRadius: Radius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  deptName: { fontSize: 10, fontWeight: '700', color: Colors.mutedForeground, letterSpacing: 0.5 },
  deptCount: { fontSize: 22, fontWeight: '800', color: Colors.warning, marginTop: 4 },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingVertical: 14, gap: 8,
  },
  createBtnText: { fontSize: 15, fontWeight: '700', color: Colors.primaryForeground, letterSpacing: 0.3 },
  fileCard: {
    backgroundColor: Colors.background, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  fileCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fileNumber: { fontSize: 14, fontWeight: '700', color: Colors.primary, letterSpacing: 0.3 },
  statusBadge: { borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 10, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 },
  applicantName: { fontSize: 14, color: Colors.secondaryForeground, marginTop: 4 },
  deadlineText: { fontSize: 12, color: Colors.warning, fontWeight: '600', marginTop: 4 },
  emptyText: { fontSize: 14, color: Colors.mutedForeground, textAlign: 'center', paddingVertical: 20 },
});
