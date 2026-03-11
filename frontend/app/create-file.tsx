import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { fetchAPI } from '../constants/api';
import { Colors, Spacing, Radius } from '../constants/theme';

const LOCATIONS = [
  'Mangaluru', 'Bantwal', 'Mulki', 'Moodabidri',
  'Puttur', 'Sulya', 'Kadaba', 'Ullala', 'Belthangady',
];

export default function CreateFileScreen() {
  const router = useRouter();
  const [applicantName, setApplicantName] = useState('');
  const [applicantPhone, setApplicantPhone] = useState('');
  const [applicantAddress, setApplicantAddress] = useState('');
  const [description, setDescription] = useState('');
  const [tahsildarLocation, setTahsildarLocation] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSaveDraft = async () => {
    if (!applicantName.trim() || !description.trim() || !tahsildarLocation) {
      Alert.alert('Validation', 'Please fill in applicant name, description, and select a Tahsildar');
      return;
    }
    setSaving(true);
    try {
      await fetchAPI('/files', {
        method: 'POST',
        body: JSON.stringify({
          applicant_name: applicantName.trim(),
          applicant_phone: applicantPhone.trim(),
          applicant_address: applicantAddress.trim(),
          description: description.trim(),
          tahsildar_location: tahsildarLocation,
        }),
      });
      Alert.alert('Success', 'File saved as draft', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAndSubmit = async () => {
    if (!applicantName.trim() || !description.trim() || !tahsildarLocation) {
      Alert.alert('Validation', 'Please fill in applicant name, description, and select a Tahsildar');
      return;
    }
    Alert.alert(
      'Submit File',
      'Once submitted, the file will be locked and sent to departments. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            setSubmitting(true);
            try {
              const file = await fetchAPI('/files', {
                method: 'POST',
                body: JSON.stringify({
                  applicant_name: applicantName.trim(),
                  applicant_phone: applicantPhone.trim(),
                  applicant_address: applicantAddress.trim(),
                  description: description.trim(),
                  tahsildar_location: tahsildarLocation,
                }),
              });
              await fetchAPI(`/files/${file.id}/submit`, { method: 'POST' });
              Alert.alert('Success', `File ${file.file_number} submitted!`, [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } catch (e: any) {
              Alert.alert('Error', e.message);
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={s.backBtn}>
            <MaterialCommunityIcons name="close" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>New File</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
          <View style={s.inputGroup}>
            <Text style={s.label}>APPLICANT NAME *</Text>
            <TextInput
              testID="applicant-name-input"
              style={s.input}
              value={applicantName}
              onChangeText={setApplicantName}
              placeholder="Full name of applicant"
              placeholderTextColor={Colors.mutedForeground}
            />
          </View>

          <View style={s.inputGroup}>
            <Text style={s.label}>PHONE NUMBER</Text>
            <TextInput
              testID="applicant-phone-input"
              style={s.input}
              value={applicantPhone}
              onChangeText={setApplicantPhone}
              placeholder="Phone number"
              placeholderTextColor={Colors.mutedForeground}
              keyboardType="phone-pad"
            />
          </View>

          <View style={s.inputGroup}>
            <Text style={s.label}>ADDRESS</Text>
            <TextInput
              testID="applicant-address-input"
              style={[s.input, s.textArea]}
              value={applicantAddress}
              onChangeText={setApplicantAddress}
              placeholder="Address"
              placeholderTextColor={Colors.mutedForeground}
              multiline
            />
          </View>

          <View style={s.inputGroup}>
            <Text style={s.label}>DESCRIPTION *</Text>
            <TextInput
              testID="description-input"
              style={[s.input, s.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="File description and details"
              placeholderTextColor={Colors.mutedForeground}
              multiline
            />
          </View>

          <View style={s.inputGroup}>
            <Text style={s.label}>TAHSILDAR ASSIGNMENT *</Text>
            <TouchableOpacity
              testID="tahsildar-picker"
              style={s.pickerBtn}
              onPress={() => setShowPicker(true)}
            >
              <Text style={tahsildarLocation ? s.pickerText : s.pickerPlaceholder}>
                {tahsildarLocation || 'Select Tahsildar location'}
              </Text>
              <MaterialCommunityIcons name="chevron-down" size={20} color={Colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <View style={s.buttonRow}>
            <TouchableOpacity
              testID="save-draft-btn"
              style={s.draftBtn}
              onPress={handleSaveDraft}
              disabled={saving}
            >
              {saving ? <ActivityIndicator size="small" color={Colors.primary} /> : (
                <Text style={s.draftBtnText}>Save Draft</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              testID="submit-file-btn"
              style={s.submitBtn}
              onPress={handleCreateAndSubmit}
              disabled={submitting}
            >
              {submitting ? <ActivityIndicator size="small" color={Colors.primaryForeground} /> : (
                <Text style={s.submitBtnText}>Submit File</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Location Picker Modal */}
      <Modal visible={showPicker} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Select Tahsildar</Text>
            <FlatList
              data={LOCATIONS}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  testID={`location-${item}`}
                  style={[s.locationItem, tahsildarLocation === item && s.locationSelected]}
                  onPress={() => { setTahsildarLocation(item); setShowPicker(false); }}
                >
                  <Text style={[s.locationText, tahsildarLocation === item && s.locationTextSelected]}>
                    {item}
                  </Text>
                  {tahsildarLocation === item && (
                    <MaterialCommunityIcons name="check" size={20} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity testID="close-picker-btn" style={s.closePickerBtn} onPress={() => setShowPicker(false)}>
              <Text style={s.closePickerText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.primary },
  form: { padding: Spacing.lg, paddingBottom: 40 },
  inputGroup: { marginBottom: Spacing.md },
  label: {
    fontSize: 11, fontWeight: '700', color: Colors.mutedForeground,
    letterSpacing: 1, marginBottom: 6,
  },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, height: 48,
    fontSize: 15, color: Colors.secondaryForeground, backgroundColor: Colors.surface,
  },
  textArea: { height: 96, paddingTop: Spacing.sm, textAlignVertical: 'top' },
  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, height: 48, backgroundColor: Colors.surface,
  },
  pickerText: { fontSize: 15, color: Colors.secondaryForeground },
  pickerPlaceholder: { fontSize: 15, color: Colors.mutedForeground },
  buttonRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  draftBtn: {
    flex: 1, height: 50, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center',
  },
  draftBtnText: { fontSize: 15, fontWeight: '600', color: Colors.primary },
  submitBtn: {
    flex: 1, height: 50, backgroundColor: Colors.primary,
    borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center',
  },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: Colors.primaryForeground },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: Colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingVertical: Spacing.lg, maxHeight: '60%',
  },
  modalTitle: {
    fontSize: 16, fontWeight: '700', color: Colors.primary,
    paddingHorizontal: Spacing.lg, marginBottom: Spacing.md,
  },
  locationItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  locationSelected: { backgroundColor: Colors.surface },
  locationText: { fontSize: 15, color: Colors.secondaryForeground },
  locationTextSelected: { fontWeight: '700', color: Colors.primary },
  closePickerBtn: { alignItems: 'center', paddingVertical: 16 },
  closePickerText: { fontSize: 14, fontWeight: '600', color: Colors.mutedForeground },
});
