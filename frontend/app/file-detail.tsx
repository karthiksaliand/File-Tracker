import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { fetchAPI } from '../constants/api';
import { Colors, Spacing, Radius, StatusColors, StatusLabels } from '../constants/theme';

const LOCATIONS = [
  'Mangaluru', 'Bantwal', 'Mulki', 'Moodabidri',
  'Puttur', 'Sulya', 'Kadaba', 'Ullala', 'Belthangady',
];
const ALL_STATUSES = ['draft', 'submitted', 'delayed', 'dc_approved', 'dc_rejected'];

export default function FileDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [file, setFile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [remark, setRemark] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Admin Edit Modal state
  const [editModal, setEditModal] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [showLocPicker, setShowLocPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  useEffect(() => { loadFile(); }, [id]);

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

  const openEditModal = () => {
    setEditData({
      applicant_name: file.applicant_name,
      applicant_phone: file.applicant_phone || '',
      applicant_address: file.applicant_address || '',
      description: file.description,
      tahsildar_location: file.tahsildar_location,
      status: file.status,
      is_locked: file.is_locked,
      dc_decision: file.dc_decision || '',
      dc_remark: file.dc_remark || '',
      adc_remark: file.adc_remark || '',
    });
    setEditModal(true);
  };

  const saveAdminEdit = async () => {
    setActionLoading(true);
    try {
      await fetchAPI(`/admin/files/${id}`, {
        method: 'PUT',
        body: JSON.stringify(editData),
      });
      Alert.alert('Success', 'File updated by admin');
      setEditModal(false);
      loadFile();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const deleteFile = () => {
    Alert.alert(
      'Delete File',
      `Are you sure you want to permanently delete ${file.file_number}? This will also remove all approvals and notifications.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await fetchAPI(`/admin/files/${id}`, { method: 'DELETE' });
              Alert.alert('Deleted', 'File deleted successfully', [
                { text: 'OK', onPress: () => router.back() },
              ]);
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

  const overrideApproval = (approval: any) => {
    Alert.alert(
      `Override ${approval.department.toUpperCase()} Approval`,
      'Choose a new decision:',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'YES', onPress: () => doOverrideApproval(approval.id, 'yes') },
        { text: 'NO', onPress: () => doOverrideApproval(approval.id, 'no') },
        { text: 'N/A', onPress: () => doOverrideApproval(approval.id, 'na') },
      ],
    );
  };

  const doOverrideApproval = async (approvalId: string, decision: string) => {
    setActionLoading(true);
    try {
      await fetchAPI(`/admin/files/${id}/approval/${approvalId}`, {
        method: 'PUT',
        body: JSON.stringify({ decision, remark: 'Admin override' }),
      });
      Alert.alert('Success', 'Approval overridden');
      loadFile();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setActionLoading(false);
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
    Alert.alert('Confirm Decision', `Are you sure you want to ${decision} this file?`, [
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
    ]);
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
  const isAdmin = role === 'admin';
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
        {isAdmin ? (
          <View style={s.adminHeaderActions}>
            <TouchableOpacity testID="admin-edit-btn" onPress={openEditModal} style={s.headerIcon}>
              <MaterialCommunityIcons name="pencil" size={20} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity testID="admin-delete-btn" onPress={deleteFile} style={s.headerIcon}>
              <MaterialCommunityIcons name="delete" size={20} color={Colors.error} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ width: 40 }} />
        )}
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

        {/* Admin Quick Actions Bar */}
        {isAdmin && (
          <View style={s.adminBar}>
            <MaterialCommunityIcons name="shield-account" size={16} color={Colors.accent} />
            <Text style={s.adminBarText}>ADMIN CONTROLS</Text>
            <TouchableOpacity testID="admin-edit-full-btn" style={s.adminActionBtn} onPress={openEditModal}>
              <MaterialCommunityIcons name="file-edit-outline" size={16} color={Colors.primaryForeground} />
              <Text style={s.adminActionBtnText}>Edit All</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="admin-delete-full-btn" style={[s.adminActionBtn, { backgroundColor: Colors.error }]} onPress={deleteFile}>
              <MaterialCommunityIcons name="delete-outline" size={16} color={Colors.primaryForeground} />
              <Text style={s.adminActionBtnText}>Delete</Text>
            </TouchableOpacity>
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
          <InfoRow label="Status" value={StatusLabels[file.status] || file.status} />
          <InfoRow label="Locked" value={file.is_locked ? 'Yes' : 'No'} />
          <InfoRow label="Created By" value={file.created_by_name} />
          <InfoRow label="Created" value={new Date(file.created_at).toLocaleString()} />
        </View>

        {/* Submit button for draft files */}
        {file.status === 'draft' && (role === 'case_worker' || isAdmin) && (
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
                {/* Admin override button */}
                {isAdmin && (
                  <TouchableOpacity
                    testID={`admin-override-${appr.department}`}
                    style={s.overrideBtn}
                    onPress={() => overrideApproval(appr)}
                  >
                    <MaterialCommunityIcons name="shield-edit-outline" size={14} color={Colors.accent} />
                    <Text style={s.overrideBtnText}>Override</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Approval Action for department officers */}
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
              <TouchableOpacity testID="approve-yes-btn" style={[s.actionBtn, { backgroundColor: Colors.success }]} onPress={() => submitApproval('yes')} disabled={actionLoading}>
                <Text style={s.actionBtnText}>YES</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="approve-no-btn" style={[s.actionBtn, { backgroundColor: Colors.error }]} onPress={() => submitApproval('no')} disabled={actionLoading}>
                <Text style={s.actionBtnText}>NO</Text>
              </TouchableOpacity>
              {role === 'forest_officer' && (
                <TouchableOpacity testID="approve-na-btn" style={[s.actionBtn, { backgroundColor: Colors.mutedForeground }]} onPress={() => submitApproval('na')} disabled={actionLoading}>
                  <Text style={s.actionBtnText}>N/A</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* ADC Remark */}
        {file.adc_remark ? (
          <View style={s.card}>
            <Text style={s.cardTitle}>ADC REMARK</Text>
            <Text style={s.remarkText}>{file.adc_remark}</Text>
            {file.adc_remark_at && <Text style={s.remarkDate}>{new Date(file.adc_remark_at).toLocaleString()}</Text>}
          </View>
        ) : null}

        {role === 'adc' && file.status !== 'draft' && (
          <View style={s.card}>
            <Text style={s.cardTitle}>ADD YOUR REMARK</Text>
            <TextInput testID="adc-remark-input" style={[s.input, s.textArea]} placeholder="Enter your remark" placeholderTextColor={Colors.mutedForeground} value={remark} onChangeText={setRemark} multiline />
            <TouchableOpacity testID="adc-submit-remark-btn" style={s.primaryBtn} onPress={submitADCRemark} disabled={actionLoading}>
              {actionLoading ? <ActivityIndicator color="#FFF" /> : <Text style={s.primaryBtnText}>Submit Remark</Text>}
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
            {file.dc_decided_at && <Text style={s.remarkDate}>{new Date(file.dc_decided_at).toLocaleString()}</Text>}
          </View>
        )}

        {role === 'dc' && file.status === 'submitted' && (
          <View style={s.card}>
            <Text style={s.cardTitle}>FINAL DECISION</Text>
            <TextInput testID="dc-remark-input" style={[s.input, s.textArea]} placeholder="Add remark (optional)" placeholderTextColor={Colors.mutedForeground} value={remark} onChangeText={setRemark} multiline />
            <View style={s.actionRow}>
              <TouchableOpacity testID="dc-accept-btn" style={[s.actionBtn, { backgroundColor: Colors.success, flex: 1 }]} onPress={() => submitDCDecision('accept')} disabled={actionLoading}>
                <Text style={s.actionBtnText}>ACCEPT</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="dc-reject-btn" style={[s.actionBtn, { backgroundColor: Colors.error, flex: 1 }]} onPress={() => submitDCDecision('reject')} disabled={actionLoading}>
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

      {/* =========== ADMIN EDIT MODAL =========== */}
      <Modal visible={editModal} animationType="slide">
        <SafeAreaView style={s.modalContainer}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={s.modalHeader}>
              <TouchableOpacity testID="close-edit-modal" onPress={() => setEditModal(false)} style={s.backBtn}>
                <MaterialCommunityIcons name="close" size={24} color={Colors.primary} />
              </TouchableOpacity>
              <Text style={s.modalHeaderTitle}>Admin Edit File</Text>
              <TouchableOpacity testID="save-admin-edit" onPress={saveAdminEdit} disabled={actionLoading} style={s.saveBtn}>
                {actionLoading ? <ActivityIndicator size="small" color={Colors.primaryForeground} /> : (
                  <Text style={s.saveBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={s.editForm} keyboardShouldPersistTaps="handled">
              <Text style={s.editSectionTitle}>FILE PROPERTIES</Text>

              <View style={s.editField}>
                <Text style={s.editLabel}>APPLICANT NAME</Text>
                <TextInput testID="edit-name" style={s.editInput} value={editData.applicant_name} onChangeText={(v) => setEditData({ ...editData, applicant_name: v })} />
              </View>

              <View style={s.editField}>
                <Text style={s.editLabel}>PHONE</Text>
                <TextInput testID="edit-phone" style={s.editInput} value={editData.applicant_phone} onChangeText={(v) => setEditData({ ...editData, applicant_phone: v })} keyboardType="phone-pad" />
              </View>

              <View style={s.editField}>
                <Text style={s.editLabel}>ADDRESS</Text>
                <TextInput testID="edit-address" style={[s.editInput, { height: 72, textAlignVertical: 'top' }]} value={editData.applicant_address} onChangeText={(v) => setEditData({ ...editData, applicant_address: v })} multiline />
              </View>

              <View style={s.editField}>
                <Text style={s.editLabel}>DESCRIPTION</Text>
                <TextInput testID="edit-description" style={[s.editInput, { height: 96, textAlignVertical: 'top' }]} value={editData.description} onChangeText={(v) => setEditData({ ...editData, description: v })} multiline />
              </View>

              <View style={s.editField}>
                <Text style={s.editLabel}>TAHSILDAR LOCATION</Text>
                <TouchableOpacity testID="edit-location-picker" style={s.pickerBtn} onPress={() => setShowLocPicker(true)}>
                  <Text style={s.pickerBtnText}>{editData.tahsildar_location || 'Select'}</Text>
                  <MaterialCommunityIcons name="chevron-down" size={20} color={Colors.mutedForeground} />
                </TouchableOpacity>
              </View>

              <Text style={[s.editSectionTitle, { marginTop: Spacing.lg }]}>SYSTEM PROPERTIES</Text>

              <View style={s.editField}>
                <Text style={s.editLabel}>STATUS</Text>
                <TouchableOpacity testID="edit-status-picker" style={s.pickerBtn} onPress={() => setShowStatusPicker(true)}>
                  <View style={[s.statusDot, { backgroundColor: StatusColors[editData.status] || '#94A3B8' }]} />
                  <Text style={s.pickerBtnText}>{StatusLabels[editData.status] || editData.status}</Text>
                  <MaterialCommunityIcons name="chevron-down" size={20} color={Colors.mutedForeground} />
                </TouchableOpacity>
              </View>

              <View style={s.editField}>
                <Text style={s.editLabel}>FILE LOCKED</Text>
                <TouchableOpacity
                  testID="edit-locked-toggle"
                  style={[s.toggleBtn, editData.is_locked && s.toggleActive]}
                  onPress={() => setEditData({ ...editData, is_locked: !editData.is_locked })}
                >
                  <Text style={[s.toggleText, editData.is_locked && s.toggleTextActive]}>
                    {editData.is_locked ? 'LOCKED' : 'UNLOCKED'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={s.editField}>
                <Text style={s.editLabel}>DC DECISION</Text>
                <View style={s.editRow}>
                  {['', 'accept', 'reject'].map((d) => (
                    <TouchableOpacity
                      key={d || 'none'}
                      testID={`edit-dc-${d || 'none'}`}
                      style={[s.editChip, editData.dc_decision === d && s.editChipActive]}
                      onPress={() => setEditData({ ...editData, dc_decision: d })}
                    >
                      <Text style={[s.editChipText, editData.dc_decision === d && s.editChipTextActive]}>
                        {d ? d.toUpperCase() : 'NONE'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={s.editField}>
                <Text style={s.editLabel}>DC REMARK</Text>
                <TextInput testID="edit-dc-remark" style={[s.editInput, { height: 60, textAlignVertical: 'top' }]} value={editData.dc_remark} onChangeText={(v) => setEditData({ ...editData, dc_remark: v })} multiline />
              </View>

              <View style={s.editField}>
                <Text style={s.editLabel}>ADC REMARK</Text>
                <TextInput testID="edit-adc-remark" style={[s.editInput, { height: 60, textAlignVertical: 'top' }]} value={editData.adc_remark} onChangeText={(v) => setEditData({ ...editData, adc_remark: v })} multiline />
              </View>

              {/* Delete Section */}
              <View style={s.dangerZone}>
                <Text style={s.dangerTitle}>DANGER ZONE</Text>
                <Text style={s.dangerDesc}>Permanently delete this file and all its approvals, notifications, and audit trail.</Text>
                <TouchableOpacity testID="admin-delete-in-modal" style={s.deleteBtn} onPress={() => { setEditModal(false); setTimeout(deleteFile, 300); }}>
                  <MaterialCommunityIcons name="delete-forever" size={18} color="#FFF" />
                  <Text style={s.deleteBtnText}>Delete File Permanently</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>

        {/* Location Picker */}
        <Modal visible={showLocPicker} transparent animationType="slide">
          <View style={s.pickerOverlay}>
            <View style={s.pickerContent}>
              <Text style={s.pickerTitle}>Select Location</Text>
              <FlatList
                data={LOCATIONS}
                keyExtractor={(i) => i}
                renderItem={({ item }) => (
                  <TouchableOpacity style={s.pickerItem} onPress={() => { setEditData({ ...editData, tahsildar_location: item }); setShowLocPicker(false); }}>
                    <Text style={[s.pickerItemText, editData.tahsildar_location === item && { fontWeight: '700', color: Colors.primary }]}>{item}</Text>
                    {editData.tahsildar_location === item && <MaterialCommunityIcons name="check" size={18} color={Colors.primary} />}
                  </TouchableOpacity>
                )}
              />
              <TouchableOpacity style={s.pickerClose} onPress={() => setShowLocPicker(false)}>
                <Text style={s.pickerCloseText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Status Picker */}
        <Modal visible={showStatusPicker} transparent animationType="slide">
          <View style={s.pickerOverlay}>
            <View style={s.pickerContent}>
              <Text style={s.pickerTitle}>Select Status</Text>
              <FlatList
                data={ALL_STATUSES}
                keyExtractor={(i) => i}
                renderItem={({ item }) => (
                  <TouchableOpacity style={s.pickerItem} onPress={() => { setEditData({ ...editData, status: item }); setShowStatusPicker(false); }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={[s.statusDot, { backgroundColor: StatusColors[item] || '#94A3B8' }]} />
                      <Text style={[s.pickerItemText, editData.status === item && { fontWeight: '700', color: Colors.primary }]}>{StatusLabels[item] || item}</Text>
                    </View>
                    {editData.status === item && <MaterialCommunityIcons name="check" size={18} color={Colors.primary} />}
                  </TouchableOpacity>
                )}
              />
              <TouchableOpacity style={s.pickerClose} onPress={() => setShowStatusPicker(false)}>
                <Text style={s.pickerCloseText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </Modal>
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
    <View style={[s.appBadge, { backgroundColor: Colors.warning }]}><Text style={s.appBadgeText}>PENDING</Text></View>
  );
  const color = decision === 'yes' ? Colors.success : decision === 'no' ? Colors.error : Colors.mutedForeground;
  return (
    <View style={[s.appBadge, { backgroundColor: color }]}><Text style={s.appBadgeText}>{decision.toUpperCase()}</Text></View>
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
  adminHeaderActions: { flexDirection: 'row', gap: 4 },
  headerIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surface },
  content: { padding: Spacing.md, paddingBottom: 40 },
  fileHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  fileNumber: { fontSize: 20, fontWeight: '800', color: Colors.primary, letterSpacing: 0.5 },
  statusBadge: { borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 },
  deadlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: Colors.warning,
    borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.md,
  },
  deadlineText: { fontSize: 13, fontWeight: '600', color: Colors.warning },
  adminBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: Colors.accent,
    borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.md,
  },
  adminBarText: { fontSize: 10, fontWeight: '800', color: Colors.accent, letterSpacing: 1, flex: 1 },
  adminActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primary, borderRadius: Radius.sm,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  adminActionBtnText: { fontSize: 11, fontWeight: '700', color: Colors.primaryForeground },
  card: {
    backgroundColor: Colors.background, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  cardTitle: { fontSize: 11, fontWeight: '700', color: Colors.mutedForeground, letterSpacing: 1.5, marginBottom: Spacing.sm },
  infoRow: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.surface },
  infoLabel: { width: 100, fontSize: 12, fontWeight: '600', color: Colors.mutedForeground },
  infoValue: { flex: 1, fontSize: 13, color: Colors.secondaryForeground },
  approvalItem: { paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.surface },
  approvalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  approvalDept: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  appBadge: { borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  appBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 },
  approvalRemark: { fontSize: 12, color: Colors.secondaryForeground, marginTop: 4 },
  approvalDate: { fontSize: 11, color: Colors.mutedForeground, marginTop: 2 },
  overrideBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', marginTop: 6,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.accent, borderRadius: Radius.sm,
  },
  overrideBtnText: { fontSize: 11, fontWeight: '700', color: Colors.accent },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, height: 48,
    fontSize: 14, color: Colors.secondaryForeground, backgroundColor: Colors.surface,
  },
  textArea: { height: 80, paddingTop: Spacing.sm, textAlignVertical: 'top' },
  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  actionBtn: { height: 48, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  actionBtnText: { fontSize: 14, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 },
  remarkText: { fontSize: 14, color: Colors.secondaryForeground, marginTop: 4 },
  remarkDate: { fontSize: 11, color: Colors.mutedForeground, marginTop: 4 },
  dcBadge: { borderRadius: Radius.sm, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start', marginBottom: 8 },
  dcBadgeText: { fontSize: 13, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 },
  primaryBtn: { height: 48, backgroundColor: Colors.primary, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center', marginTop: Spacing.md },
  primaryBtnText: { fontSize: 14, fontWeight: '700', color: Colors.primaryForeground },
  submitBtn: { height: 52, backgroundColor: Colors.primary, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: Colors.primaryForeground, letterSpacing: 0.3 },
  auditItem: { flexDirection: 'row', paddingVertical: 6 },
  auditDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.muted, marginTop: 5, marginRight: 10 },
  auditContent: { flex: 1 },
  auditAction: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  auditMeta: { fontSize: 11, color: Colors.mutedForeground, marginTop: 1 },
  auditDetails: { fontSize: 12, color: Colors.secondaryForeground, marginTop: 2 },

  // Admin Edit Modal Styles
  modalContainer: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalHeaderTitle: { fontSize: 18, fontWeight: '700', color: Colors.primary },
  saveBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: Colors.primaryForeground },
  editForm: { padding: Spacing.lg, paddingBottom: 60 },
  editSectionTitle: {
    fontSize: 12, fontWeight: '800', color: Colors.accent,
    letterSpacing: 1.5, marginBottom: Spacing.md,
  },
  editField: { marginBottom: Spacing.md },
  editLabel: { fontSize: 11, fontWeight: '700', color: Colors.mutedForeground, letterSpacing: 1, marginBottom: 6 },
  editInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, height: 48,
    fontSize: 15, color: Colors.secondaryForeground, backgroundColor: Colors.surface,
  },
  editRow: { flexDirection: 'row', gap: 8 },
  editChip: {
    flex: 1, paddingVertical: 10, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  editChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  editChipText: { fontSize: 12, fontWeight: '700', color: Colors.mutedForeground },
  editChipTextActive: { color: Colors.primaryForeground },
  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, height: 48, backgroundColor: Colors.surface,
  },
  pickerBtnText: { fontSize: 15, color: Colors.secondaryForeground, flex: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  toggleBtn: {
    paddingVertical: 12, borderRadius: Radius.md,
    borderWidth: 2, borderColor: Colors.border, alignItems: 'center',
  },
  toggleActive: { backgroundColor: Colors.error, borderColor: Colors.error },
  toggleText: { fontSize: 13, fontWeight: '800', color: Colors.mutedForeground, letterSpacing: 1 },
  toggleTextActive: { color: '#FFF' },
  dangerZone: {
    marginTop: Spacing.xl, padding: Spacing.md,
    borderWidth: 2, borderColor: Colors.error, borderRadius: Radius.md,
    borderStyle: 'dashed',
  },
  dangerTitle: { fontSize: 12, fontWeight: '800', color: Colors.error, letterSpacing: 1.5 },
  dangerDesc: { fontSize: 12, color: Colors.mutedForeground, marginTop: 4, marginBottom: Spacing.md },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.error, borderRadius: Radius.md,
    paddingVertical: 14,
  },
  deleteBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },

  // Picker modals
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerContent: {
    backgroundColor: Colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingVertical: Spacing.lg, maxHeight: '60%',
  },
  pickerTitle: { fontSize: 16, fontWeight: '700', color: Colors.primary, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  pickerItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  pickerItemText: { fontSize: 15, color: Colors.secondaryForeground },
  pickerClose: { alignItems: 'center', paddingVertical: 16 },
  pickerCloseText: { fontSize: 14, fontWeight: '600', color: Colors.mutedForeground },
});
