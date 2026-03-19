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
      setRecentFiles(files.slice(0, 10));
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

  const confirmLogout = async () => {
    setIsLoggingOut(true);
    setShowLogoutDialog(false);
    try { await logout(); } catch (e) { console.error(e); }
    router.replace('/');
  };

  const role = user?.role || '';
  const highPriorityFiles = recentFiles.filter(f => f.priority === 'high');
  const overdueFiles = recentFiles.filter(f => f.deadline && new Date(f.deadline) < new Date() && f.status === 'submitted');
  const pendingFiles = recentFiles.filter(f => {
    if (role === 'tahsildar' || role === 'sp' || role === 'forest_officer') {
      const dept = role === 'forest_officer' ? 'forest' : role;
      return f.approvals_summary && f.approvals_summary[dept] && f.approvals_summary[dept].decision === null;
    }
    return f.status === 'submitted';
  });

  const getDaysLeft = (deadline: string) => {
    const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 86400));
    return diff;
  };

  if (loading) {
    return <SafeAreaView style={s.container}><View style={s.center}><ActivityIndicator size="large" color={Colors.primary} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={s.container}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}>
        {/* Header */}
        <View style={s.topBar}>
          <View style={{ flex: 1 }}>
            <Text style={s.greeting}>Welcome, {user?.display_name}</Text>
            <Text style={s.roleText}>{user?.role?.replace(/_/g, ' ').toUpperCase()}</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(tabs)/notifications')} style={s.iconBtn}>
            <MaterialCommunityIcons name="bell-outline" size={22} color={Colors.foreground} />
            {unreadCount > 0 && <View style={s.badge}><Text style={s.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View>}
          </TouchableOpacity>
          <TouchableOpacity testID="logout-btn" onPress={() => setShowLogoutDialog(true)} style={s.iconBtn}>
            <MaterialCommunityIcons name="logout" size={22} color={Colors.destructive} />
          </TouchableOpacity>
        </View>

        <View style={s.content}>
          {/* Stats Cards */}
          {analytics && (role === 'admin' || role === 'case_worker' || role === 'adc' || role === 'dc') && (
            <View style={s.statsGrid}>
              <StatCard label="Total" value={analytics.total} color="#2563EB" icon="file-multiple" />
              <StatCard label="Submitted" value={analytics.submitted} color="#F59E0B" icon="clock-outline" />
              <StatCard label="Approved" value={analytics.approved} color="#059669" icon="check-circle" />
              <StatCard label="Rejected" value={analytics.rejected} color="#DC2626" icon="close-circle" />
              {analytics.high_priority > 0 && <StatCard label="High Priority" value={analytics.high_priority} color="#DC2626" icon="alert-circle" />}
              {analytics.overdue > 0 && <StatCard label="Overdue" value={analytics.overdue} color="#DC2626" icon="clock-alert" />}
            </View>
          )}

          {/* Department-specific stats */}
          {(role === 'tahsildar' || role === 'sp' || role === 'forest_officer') && analytics && (
            <View style={s.statsGrid}>
              <StatCard label="My Pending" value={pendingFiles.length} color="#F59E0B" icon="clock-outline" />
              <StatCard label="Total Files" value={recentFiles.length} color="#2563EB" icon="file-multiple" />
              {overdueFiles.length > 0 && <StatCard label="Overdue" value={overdueFiles.length} color="#DC2626" icon="clock-alert" />}
            </View>
          )}

          {/* Create File Button (Case Worker / Admin) */}
          {(role === 'case_worker' || role === 'admin') && (
            <TouchableOpacity style={s.createBtn} onPress={() => router.push('/create-file')} activeOpacity={0.7}>
              <MaterialCommunityIcons name="plus-circle" size={20} color="#FFF" />
              <Text style={s.createBtnText}>Create New File</Text>
            </TouchableOpacity>
          )}

          {/* High Priority Section */}
          {highPriorityFiles.length > 0 && (
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <MaterialCommunityIcons name="alert-circle" size={18} color="#DC2626" />
                <Text style={[s.sectionTitle, { color: '#DC2626' }]}>HIGH PRIORITY</Text>
              </View>
              {highPriorityFiles.map(f => <FileCard key={f.id} file={f} role={role} getDaysLeft={getDaysLeft} onPress={() => router.push({ pathname: '/file-detail', params: { id: f.id } })} />)}
            </View>
          )}

          {/* Overdue Section */}
          {overdueFiles.length > 0 && (
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <MaterialCommunityIcons name="clock-alert" size={18} color="#DC2626" />
                <Text style={[s.sectionTitle, { color: '#DC2626' }]}>OVERDUE FILES</Text>
              </View>
              {overdueFiles.map(f => <FileCard key={f.id} file={f} role={role} getDaysLeft={getDaysLeft} onPress={() => router.push({ pathname: '/file-detail', params: { id: f.id } })} />)}
            </View>
          )}

          {/* Pending Section (for departments) */}
          {(role === 'tahsildar' || role === 'sp' || role === 'forest_officer') && pendingFiles.length > 0 && (
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <MaterialCommunityIcons name="clock-fast" size={18} color="#F59E0B" />
                <Text style={s.sectionTitle}>PENDING YOUR ACTION</Text>
              </View>
              {pendingFiles.map(f => <FileCard key={f.id} file={f} role={role} getDaysLeft={getDaysLeft} onPress={() => router.push({ pathname: '/file-detail', params: { id: f.id } })} />)}
            </View>
          )}

          {/* Recent Files */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>RECENT FILES</Text>
            {recentFiles.length === 0 ? (
              <Text style={s.emptyText}>No files yet</Text>
            ) : (
              recentFiles.slice(0, 8).map(f => <FileCard key={f.id} file={f} role={role} getDaysLeft={getDaysLeft} onPress={() => router.push({ pathname: '/file-detail', params: { id: f.id } })} />)
            )}
          </View>

          {/* Admin: Dept Pending */}
          {(role === 'admin' || role === 'adc' || role === 'dc') && analytics?.department_pending && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>DEPARTMENT PENDING</Text>
              {Object.entries(analytics.department_pending).map(([dept, count]) => (
                <View key={dept} style={s.deptRow}>
                  <Text style={s.deptLabel}>{dept.charAt(0).toUpperCase() + dept.slice(1)}</Text>
                  <View style={[s.deptBadge, { backgroundColor: (count as number) > 0 ? '#FEF3C7' : '#D1FAE5' }]}>
                    <Text style={[s.deptCount, { color: (count as number) > 0 ? '#92400E' : '#065F46' }]}>{count as number}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

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

function StatCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <View style={[sc.card, { borderLeftColor: color }]}>
      <MaterialCommunityIcons name={icon as any} size={18} color={color} />
      <Text style={[sc.value, { color }]}>{value}</Text>
      <Text style={sc.label}>{label}</Text>
    </View>
  );
}

function FileCard({ file, role, getDaysLeft, onPress }: { file: any; role: string; getDaysLeft: (d: string) => number; onPress: () => void }) {
  const isHighPriority = file.priority === 'high';
  const daysLeft = file.deadline ? getDaysLeft(file.deadline) : null;
  const isOverdue = daysLeft !== null && daysLeft < 0;

  return (
    <TouchableOpacity style={[fc.card, isHighPriority && fc.highPriority]} onPress={onPress} activeOpacity={0.7}>
      <View style={fc.row}>
        <View style={{ flex: 1 }}>
          <View style={fc.topRow}>
            <Text style={fc.fileNo}>{file.file_number}</Text>
            {isHighPriority && (
              <View style={fc.priorityBadge}>
                <Text style={fc.priorityText}>HIGH</Text>
              </View>
            )}
          </View>
          <Text style={fc.desc} numberOfLines={1}>{file.description}</Text>
          <Text style={fc.meta}>{file.tahsildar_location}</Text>
        </View>
        <View style={fc.rightCol}>
          <View style={[fc.statusBadge, { backgroundColor: (StatusColors[file.status] || '#94A3B8') + '20' }]}>
            <Text style={[fc.statusText, { color: StatusColors[file.status] || '#94A3B8' }]}>{StatusLabels[file.status] || file.status}</Text>
          </View>
          {daysLeft !== null && file.status === 'submitted' && (
            <Text style={[fc.deadline, isOverdue && { color: '#DC2626' }]}>
              {isOverdue ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const sc = StyleSheet.create({
  card: {
    backgroundColor: Colors.card, borderRadius: Radius.sm, padding: 12,
    borderLeftWidth: 3, minWidth: '46%', flex: 1,
  },
  value: { fontSize: 22, fontWeight: '800', marginTop: 4 },
  label: { fontSize: 11, color: Colors.mutedForeground, fontWeight: '600', marginTop: 2 },
});

const fc = StyleSheet.create({
  card: {
    backgroundColor: Colors.card, borderRadius: Radius.sm, padding: 12,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 6,
  },
  highPriority: { borderColor: '#DC262640', borderLeftWidth: 3, borderLeftColor: '#DC2626' },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fileNo: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  priorityBadge: { backgroundColor: '#DC262620', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  priorityText: { fontSize: 9, fontWeight: '800', color: '#DC2626' },
  desc: { fontSize: 13, color: Colors.foreground, marginTop: 2 },
  meta: { fontSize: 11, color: Colors.mutedForeground, marginTop: 2 },
  rightCol: { alignItems: 'flex-end', gap: 4 },
  statusBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  statusText: { fontSize: 10, fontWeight: '700' },
  deadline: { fontSize: 10, color: Colors.mutedForeground, fontWeight: '600' },
});

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 12, gap: 8 },
  greeting: { fontSize: 17, fontWeight: '700', color: Colors.foreground },
  roleText: { fontSize: 11, color: Colors.mutedForeground, fontWeight: '600', letterSpacing: 0.5 },
  iconBtn: { padding: 8, position: 'relative' },
  badge: { position: 'absolute', top: 2, right: 2, backgroundColor: '#DC2626', borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  badgeText: { fontSize: 9, fontWeight: '800', color: '#FFF' },
  content: { paddingHorizontal: Spacing.md, paddingBottom: 40 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  createBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md, height: 48,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 16,
  },
  createBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: Colors.mutedForeground, letterSpacing: 0.5, marginBottom: 8 },
  emptyText: { fontSize: 13, color: Colors.mutedForeground, textAlign: 'center', paddingVertical: 20 },
  deptRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  deptLabel: { fontSize: 14, fontWeight: '600', color: Colors.foreground },
  deptBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  deptCount: { fontSize: 13, fontWeight: '700' },
});
