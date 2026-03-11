import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { fetchAPI } from '../../constants/api';
import { Colors, Spacing, Radius, StatusColors, StatusLabels } from '../../constants/theme';

const FILTERS = ['all', 'draft', 'submitted', 'dc_approved', 'dc_rejected', 'delayed'];
const FILTER_LABELS: Record<string, string> = {
  all: 'All', draft: 'Draft', submitted: 'Pending',
  dc_approved: 'Approved', dc_rejected: 'Rejected', delayed: 'Delayed',
};

export default function FilesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const loadFiles = useCallback(async () => {
    try {
      let endpoint = '/files';
      const params: string[] = [];
      if (filter !== 'all') params.push(`status=${filter}`);
      if (search.trim()) params.push(`search=${encodeURIComponent(search.trim())}`);
      if (params.length) endpoint += '?' + params.join('&');

      const data = await fetchAPI(endpoint);
      setFiles(data);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, search]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    loadFiles();
  }, [loadFiles]));

  const canCreate = user?.role === 'case_worker' || user?.role === 'admin';

  const renderFile = ({ item }: { item: any }) => {
    const daysLeft = item.deadline && item.status === 'submitted'
      ? Math.max(0, Math.ceil((new Date(item.deadline).getTime() - Date.now()) / 86400000))
      : null;

    return (
      <TouchableOpacity
        testID={`file-item-${item.id}`}
        style={s.fileCard}
        onPress={() => router.push({ pathname: '/file-detail', params: { id: item.id } })}
        activeOpacity={0.7}
      >
        <View style={s.fileRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.fileNumber}>{item.file_number}</Text>
            <Text style={s.applicant} numberOfLines={1}>{item.description}</Text>
            <Text style={s.meta}>{item.tahsildar_location} | {new Date(item.created_at).toLocaleDateString()}</Text>
          </View>
          <View style={s.rightCol}>
            <View style={[s.badge, { backgroundColor: StatusColors[item.status] || '#94A3B8' }]}>
              <Text style={s.badgeText}>{StatusLabels[item.status] || item.status}</Text>
            </View>
            {daysLeft !== null && (
              <Text style={[s.daysLeft, daysLeft <= 5 && { color: Colors.error }]}>
                {daysLeft}d left
              </Text>
            )}
          </View>
        </View>

        {/* Approval summary */}
        {item.approvals_summary && Object.keys(item.approvals_summary).length > 0 && (
          <View style={s.approvalRow}>
            {['tahsildar', 'sp', 'forest'].map((dept) => {
              const appr = item.approvals_summary[dept];
              const decision = appr?.decision;
              const color = decision === 'yes' ? Colors.success : decision === 'no' ? Colors.error : decision === 'na' ? Colors.mutedForeground : Colors.warning;
              return (
                <View key={dept} style={[s.approvalChip, { borderColor: color }]}>
                  <View style={[s.approvalDot, { backgroundColor: color }]} />
                  <Text style={[s.approvalLabel, { color }]}>{dept.toUpperCase()}</Text>
                </View>
              );
            })}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={s.container}>
      {/* Search */}
      <View style={s.searchContainer}>
        <MaterialCommunityIcons name="magnify" size={20} color={Colors.mutedForeground} />
        <TextInput
          testID="search-input"
          style={s.searchInput}
          placeholder="Search by file number..."
          placeholderTextColor={Colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={loadFiles}
          returnKeyType="search"
        />
      </View>

      {/* Filters */}
      <View style={s.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            testID={`filter-${f}`}
            style={[s.filterChip, filter === f && s.filterActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[s.filterText, filter === f && s.filterTextActive]}>
              {FILTER_LABELS[f]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* File List */}
      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={files}
          keyExtractor={(item) => item.id}
          renderItem={renderFile}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadFiles(); }} />}
          ListEmptyComponent={<Text style={s.emptyText}>No files found</Text>}
        />
      )}

      {/* FAB */}
      {canCreate && (
        <TouchableOpacity
          testID="fab-create-file"
          style={s.fab}
          onPress={() => router.push('/create-file')}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="plus" size={28} color={Colors.primaryForeground} />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.background, margin: Spacing.md,
    borderRadius: Radius.md, paddingHorizontal: Spacing.md,
    borderWidth: 1, borderColor: Colors.border, height: 44,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: Colors.secondaryForeground },
  filterRow: {
    flexDirection: 'row', paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm, gap: 6,
  },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: Radius.full, backgroundColor: Colors.background,
    borderWidth: 1, borderColor: Colors.border,
  },
  filterActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: 12, fontWeight: '600', color: Colors.mutedForeground },
  filterTextActive: { color: Colors.primaryForeground },
  list: { paddingHorizontal: Spacing.md, paddingBottom: 100 },
  fileCard: {
    backgroundColor: Colors.background, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  fileRow: { flexDirection: 'row', justifyContent: 'space-between' },
  fileNumber: { fontSize: 14, fontWeight: '700', color: Colors.primary, letterSpacing: 0.3 },
  applicant: { fontSize: 14, color: Colors.secondaryForeground, marginTop: 2 },
  meta: { fontSize: 12, color: Colors.mutedForeground, marginTop: 2 },
  rightCol: { alignItems: 'flex-end' },
  badge: { borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 9, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 },
  daysLeft: { fontSize: 12, fontWeight: '600', color: Colors.warning, marginTop: 4 },
  approvalRow: { flexDirection: 'row', marginTop: Spacing.sm, gap: 6 },
  approvalChip: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: Radius.sm,
    paddingHorizontal: 8, paddingVertical: 3, gap: 4,
  },
  approvalDot: { width: 6, height: 6, borderRadius: 3 },
  approvalLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
    elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 4,
  },
  emptyText: { fontSize: 14, color: Colors.mutedForeground, textAlign: 'center', paddingVertical: 40 },
});
