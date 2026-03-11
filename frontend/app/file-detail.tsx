import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { fetchAPI } from '../constants/api';
import { Colors, Spacing, Radius, StatusColors, StatusLabels } from '../constants/theme';

export default function FileDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [file, setFile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [remark, setRemark] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadFile();
  }, [id]);

  const loadFile = async () => {
    try {
      const data = await fetchAPI(`/files/${id}`);
      setFile(data);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const submitApproval = async (decision: string) => {
    setActionLoading(true);
    try {
      await fetchAPI(`/files/${id}/approval`, {
        method: 'POST',
        body: JSON.stringify({ decision, remark }),
      });
      Alert.alert('Success', 'Approval submitted');
      setRemark('');
      loadFile();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const submitADCRemark = async () => {
    if (!remark.trim()) { Alert.alert('Error', 'Please enter a remark'); return; }
    setActionLoading(true);
    try {
      await fetchAPI(`/files/${id}/adc-remark`, {
        method: 'POST',
        body: JSON.stringify({ remark }),
      });
      Alert.alert('Success', 'Remark added');
      setRemark('');
      loadFile();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const submitDCDecision = async (decision: string) => {
    Alert.alert(
      'Confirm Decision',
      `Are you sure you want to ${decision} this file?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: decision.charAt(0).toUpperCase() + decision.slice(1),
          onPress: async () => {
            setActionLoading(true);
            try {
              await fetchAPI(`/files/${id}/dc-decision`, {
                method: 'POST',
                body: JSON.stringify({ decision, remark }),
              });
              Alert.alert('Success', `File ${decision}ed`);
              setRemark('');
              loadFile();
            } catch (e: any) {
              Alert.alert('Error', e.message);
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  };

  const submitFile = async () => {
    Alert.alert('Submit File', 'This will lock the file and send it to departments. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Submit',
        onPress: async () => {
          setActionLoading(true);
          try {
            await fetchAPI(`/files/${id}/submit`, { method: 'POST' });
            Alert.alert('Success', 'File submitted');
            loadFile();
          } catch (e: any) {
            Alert.alert('Error', e.message);
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      </SafeAreaView>
    );
  }

  if (!file) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.center}><Text style={s.emptyText}>File not found</Text></View>
      </SafeAreaView>
    );
  }

  const daysLeft = file.deadline && file.status === 'submitted'
    ? Math.max(0, Math.ceil((new Date(file.deadline).getTime() - Date.now()) / 86400000))
    : null;

  const role = user?.role || '';
  const canApprove = ['tahsildar', 'sp', 'forest_officer'].includes(role);
  const myApproval = file.approvals?.find((a: any) => {
    if (role === 'tahsildar') return a.department === 'tahsildar' && a.department_detail === user?.department;
    if (role === 'sp') return a.department === 'sp';
    if (role === 'forest_officer') return a.department === 'forest';
    return false;
  });

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={s.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>File Detail</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {/* File Info */}
        <View style={s.fileHeader}>
          <Text style={s.fileNumber}>{file.file_number}</Text>
          <View style={[s.statusBadge, { backgroundColor: StatusColors[file.status] || '#94A3B8' }]}>
            <Text style={s.statusText}>{StatusLabels[file.status] || file.status}</Text>
          </View>
        </View>

        {daysLeft !== null && (
          <View style={[s.deadlineBanner, daysLeft <= 5 && { backgroundColor: '#FEF2F2', borderColor: Colors.error }]}>
            <MaterialCommunityIcons name="clock-alert-outline" size={18} color={daysLeft <= 5 ? Colors.error : Colors.warning} />
            <Text style={[s.deadlineText, daysLeft <= 5 && { color: Colors.error }]}>
              {daysLeft} days remaining until deadline
            </Text>
          </View>
        )}

        {file.status === 'delayed' && (
          <View style={[s.deadlineBanner, { backgroundColor: '#FEF2F2', borderColor: Colors.error }]}>
            <MaterialCommunityIcons name="alert" size={18} color={Colors.error} />
            <Text style={[s.deadlineText, { color: Colors.error }]}>DEADLINE CROSSED - ESCALATED</Text>
          </View>
        )}

        {/* Applicant Info */}
        <View style={s.card}>
          <Text style={s.cardTitle}>APPLICANT DETAILS</Text>
          <InfoRow label="Name" value={file.applicant_name} />
          <InfoRow label="Phone" value={file.applicant_phone || 'N/A'} />
          <InfoRow label="Address" value={file.applicant_address || 'N/A'} />
          <InfoRow label="Description" value={file.description} />
          <InfoRow label="Tahsildar" value={file.tahsildar_location} />
          <InfoRow label="Created By" value={file.created_by_name} />
          <InfoRow label="Created" value={new Date(file.created_at).toLocaleString()} />
        </View>

        {/* Submit button for draft files */}
        {file.status === 'draft' && (role === 'case_worker' || role === 'admin') && (
          <TouchableOpacity testID="submit-file-btn" style={s.submitBtn} onPress={submitFile} disabled={actionLoading}>
            {actionLoading ? <ActivityIndicator color="#FFF" /> : (
              <Text style={s.submitBtnText}>Submit to Departments</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Department Approvals */}
        {file.approvals && file.approvals.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>DEPARTMENT APPROVALS</Text>
            {file.approvals.map((appr: any) => (
              <View key={appr.id} style={s.approvalItem}>
                <View style={s.approvalHeader}>
                  <Text style={s.approvalDept}>
                    {appr.department.toUpperCase()}
                    {appr.department_detail ? ` - ${appr.department_detail}` : ''}
                  </Text>
                  <ApprovalBadge decision={appr.decision} />
                </View>
                {appr.remark ? <Text style={s.approvalRemark}>Remark: {appr.remark}</Text> : null}
                {appr.decided_at && (
                  <Text style={s.approvalDate}>Decided: {new Date(appr.decided_at).toLocaleString()}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Approval Action */}
        {canApprove && myApproval && !myApproval.is_locked && (
          <View style={s.card}>
            <Text style={s.cardTitle}>YOUR APPROVAL</Text>
            <TextInput
              testID="approval-remark-input"
              style={[s.input, s.textArea]}
              placeholder="Add remark (optional)"
              placeholderTextColor={Colors.mutedForeground}
              value={remark}
              onChangeText={setRemark}
              multiline
            />
            <View style={s.actionRow}>
              <TouchableOpacity
                testID="approve-yes-btn"
                style={[s.actionBtn, { backgroundColor: Colors.success }]}
                onPress={() => submitApproval('yes')}
                disabled={actionLoading}
              >
                <Text style={s.actionBtnText}>YES</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="approve-no-btn"
                style={[s.actionBtn, { backgroundColor: Colors.error }]}
                onPress={() => submitApproval('no')}
                disabled={actionLoading}
              >
                <Text style={s.actionBtnText}>NO</Text>
              </TouchableOpacity>
              {role === 'forest_officer' && (
                <TouchableOpacity
                  testID="approve-na-btn"
                  style={[s.actionBtn, { backgroundColor: Colors.mutedForeground }]}
                  onPress={() => submitApproval('na')}
                  disabled={actionLoading}
                >
                  <Text style={s.actionBtnText}>N/A</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* ADC Remark */}
        {file.adc_remark && (
          <View style={s.card}>
            <Text style={s.cardTitle}>ADC REMARK</Text>
            <Text style={s.remarkText}>{file.adc_remark}</Text>
            {file.adc_remark_at && (
              <Text style={s.remarkDate}>{new Date(file.adc_remark_at).toLocaleString()}</Text>
            )}
          </View>
        )}

        {role === 'adc' && file.status !== 'draft' && (
          <View style={s.card}>
            <Text style={s.cardTitle}>ADD YOUR REMARK</Text>
            <TextInput
              testID="adc-remark-input"
              style={[s.input, s.textArea]}
              placeholder="Enter your remark"
              placeholderTextColor={Colors.mutedForeground}
              value={remark}
              onChangeText={setRemark}
              multiline
            />
            <TouchableOpacity
              testID="adc-submit-remark-btn"
              style={s.primaryBtn}
              onPress={submitADCRemark}
              disabled={actionLoading}
            >
              {actionLoading ? <ActivityIndicator color="#FFF" /> : (
                <Text style={s.primaryBtnText}>Submit Remark</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* DC Decision */}
        {file.dc_decision && (
          <View style={s.card}>
            <Text style={s.cardTitle}>DC DECISION</Text>
            <View style={[s.dcBadge, { backgroundColor: file.dc_decision === 'accept' ? Colors.success : Colors.error }]}>
              <Text style={s.dcBadgeText}>{file.dc_decision.toUpperCase()}</Text>
            </View>
            {file.dc_remark ? <Text style={s.remarkText}>{file.dc_remark}</Text> : null}
            {file.dc_decided_at && (
              <Text style={s.remarkDate}>{new Date(file.dc_decided_at).toLocaleString()}</Text>
            )}
          </View>
        )}

        {role === 'dc' && file.status === 'submitted' && (
          <View style={s.card}>
            <Text style={s.cardTitle}>FINAL DECISION</Text>
            <TextInput
              testID="dc-remark-input"
              style={[s.input, s.textArea]}
              placeholder="Add remark (optional)"
              placeholderTextColor={Colors.mutedForeground}
              value={remark}
              onChangeText={setRemark}
              multiline
            />
            <View style={s.actionRow}>
              <TouchableOpacity
                testID="dc-accept-btn"
                style={[s.actionBtn, { backgroundColor: Colors.success, flex: 1 }]}
                onPress={() => submitDCDecision('accept')}
                disabled={actionLoading}
              >
                <Text style={s.actionBtnText}>ACCEPT</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="dc-reject-btn"
                style={[s.actionBtn, { backgroundColor: Colors.error, flex: 1 }]}
                onPress={() => submitDCDecision('reject')}
                disabled={actionLoading}
              >
                <Text style={s.actionBtnText}>REJECT</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Audit Log */}
        {file.audit_log && file.audit_log.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>AUDIT TRAIL</Text>
            {file.audit_log.map((log: any) => (
              <View key={log.id} style={s.auditItem}>
                <View style={s.auditDot} />
                <View style={s.auditContent}>
                  <Text style={s.auditAction}>{log.action}</Text>
                  <Text style={s.auditMeta}>{log.user_name} | {new Date(log.timestamp).toLocaleString()}</Text>
                  {log.details ? <Text style={s.auditDetails}>{log.details}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value}</Text>
    </View>
  );
}

function ApprovalBadge({ decision }: { decision: string | null }) {
  if (!decision) return (
    <View style={[s.appBadge, { backgroundColor: Colors.warning }]}>
      <Text style={s.appBadgeText}>PENDING</Text>
    </View>
  );
  const color = decision === 'yes' ? Colors.success : decision === 'no' ? Colors.error : Colors.mutedForeground;
  return (
    <View style={[s.appBadge, { backgroundColor: color }]}>
      <Text style={s.appBadgeText}>{decision.toUpperCase()}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 14, color: Colors.mutedForeground },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    backgroundColor: Colors.background, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.primary },
  content: { padding: Spacing.md, paddingBottom: 40 },
  fileHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.md,
  },
  fileNumber: { fontSize: 20, fontWeight: '800', color: Colors.primary, letterSpacing: 0.5 },
  statusBadge: { borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 },
  deadlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: Colors.warning,
    borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.md,
  },
  deadlineText: { fontSize: 13, fontWeight: '600', color: Colors.warning },
  card: {
    backgroundColor: Colors.background, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  cardTitle: {
    fontSize: 11, fontWeight: '700', color: Colors.mutedForeground,
    letterSpacing: 1.5, marginBottom: Spacing.sm,
  },
  infoRow: {
    flexDirection: 'row', paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: Colors.surface,
  },
  infoLabel: { width: 100, fontSize: 12, fontWeight: '600', color: Colors.mutedForeground },
  infoValue: { flex: 1, fontSize: 13, color: Colors.secondaryForeground },
  approvalItem: {
    paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.surface,
  },
  approvalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  approvalDept: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  appBadge: { borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  appBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 },
  approvalRemark: { fontSize: 12, color: Colors.secondaryForeground, marginTop: 4 },
  approvalDate: { fontSize: 11, color: Colors.mutedForeground, marginTop: 2 },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, height: 48,
    fontSize: 14, color: Colors.secondaryForeground, backgroundColor: Colors.surface,
  },
  textArea: { height: 80, paddingTop: Spacing.sm, textAlignVertical: 'top' },
  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  actionBtn: {
    height: 48, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 20,
  },
  actionBtnText: { fontSize: 14, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 },
  remarkText: { fontSize: 14, color: Colors.secondaryForeground, marginTop: 4 },
  remarkDate: { fontSize: 11, color: Colors.mutedForeground, marginTop: 4 },
  dcBadge: {
    borderRadius: Radius.sm, paddingHorizontal: 12, paddingVertical: 6,
    alignSelf: 'flex-start', marginBottom: 8,
  },
  dcBadgeText: { fontSize: 13, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 },
  primaryBtn: {
    height: 48, backgroundColor: Colors.primary, borderRadius: Radius.md,
    justifyContent: 'center', alignItems: 'center', marginTop: Spacing.md,
  },
  primaryBtnText: { fontSize: 14, fontWeight: '700', color: Colors.primaryForeground },
  submitBtn: {
    height: 52, backgroundColor: Colors.primary, borderRadius: Radius.md,
    justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md,
  },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: Colors.primaryForeground, letterSpacing: 0.3 },
  auditItem: { flexDirection: 'row', paddingVertical: 6 },
  auditDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.muted,
    marginTop: 5, marginRight: 10,
  },
  auditContent: { flex: 1 },
  auditAction: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  auditMeta: { fontSize: 11, color: Colors.mutedForeground, marginTop: 1 },
  auditDetails: { fontSize: 12, color: Colors.secondaryForeground, marginTop: 2 },
});
