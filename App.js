import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Pressable,
  TextInput,
  Modal,
  Alert,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
  StatusBar,
  SafeAreaView,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const triggerLayoutAnimation = () => {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
};

// ==========================================
// 1. FIREBASE CONFIGURATION (JSM-APP-CDE22)
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyBLbRyy9q5jwfuHlxi06DBiiWNtTK_koe8",
  authDomain: "jsm-app-cde22.firebaseapp.com",
  projectId: "jsm-app-cde22",
  storageBucket: "jsm-app-cde22.firebasestorage.app",
  messagingSenderId: "78588387738",
  appId: "1:78588387738:web:f07509bb2e37a751b0da23"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

// ==========================================
// 2. THEME & PALETTE
// ==========================================
const COLORS = {
  navy: '#0C2D57',
  gold: '#D4B978',
  cream: '#EFE7D3',
  silver: '#8E9399',
  ivory: '#FAF8F5',
  white: '#FFFFFF',
  danger: '#9E2A2B',
  success: '#2D6A4F',
  charcoal: '#1D242B',
};

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const ATTENDANCE_STATUSES = ['Present', 'Absent', 'Tardy', 'Rescheduled'];
const FEE_TYPES = ['Monthly Fee', 'Admission Fee', 'Exam Fee', 'Instrument / Book'];
const PAYMENT_MODES = ['UPI', 'Cash', 'Bank Transfer', 'Card'];
const FEE_STATUSES = ['Paid', 'Partial', 'Unpaid'];

// ==========================================
// 3. LOCAL TIMEZONE DATE UTILITIES (NO UTC)
// ==========================================
const getTodayISO = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getLocalCurrentMonthLabel = () => {
  const now = new Date();
  return `${MONTHS_FULL[now.getMonth()]} ${now.getFullYear()}`;
};

const getGreetingByLocalTime = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const formatReadableLocalDate = (isoDateStr) => {
  if (!isoDateStr || typeof isoDateStr !== 'string') return '';
  const parts = isoDateStr.split('-');
  if (parts.length !== 3) return isoDateStr;
  const year = parseInt(parts[0], 10);
  const monthIndex = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(monthIndex) || isNaN(day)) return isoDateStr;
  return `${day} ${MONTHS_SHORT[monthIndex] || ''} ${year}`;
};

const getMonthYearFromISO = (isoDateStr) => {
  if (!isoDateStr || typeof isoDateStr !== 'string') return 'Unknown Month';
  const parts = isoDateStr.split('-');
  if (parts.length < 2) return 'Unknown Month';
  const year = parseInt(parts[0], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;
  if (isNaN(year) || isNaN(monthIdx) || monthIdx < 0 || monthIdx > 11) return 'Unknown Month';
  return `${MONTHS_FULL[monthIdx]} ${year}`;
};

const isWithinLastTwoLocalMonths = (isoDateStr) => {
  if (!isoDateStr) return false;
  const parts = isoDateStr.split('-');
  if (parts.length < 2) return false;
  const recordYear = parseInt(parts[0], 10);
  const recordMonth = parseInt(parts[1], 10) - 1;
  const now = new Date();
  const currentTotalMonths = now.getFullYear() * 12 + now.getMonth();
  const recordTotalMonths = recordYear * 12 + recordMonth;
  const diff = currentTotalMonths - recordTotalMonths;
  return diff >= 0 && diff <= 1;
};

const getDaysRemainingInTrash = (deletedAtMs) => {
  if (!deletedAtMs) return 30;
  const elapsedMs = Date.now() - Number(deletedAtMs);
  const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
  return Math.max(0, 30 - elapsedDays);
};

// ==========================================
// 4. ANIMATED ENTRANCE SCREEN WRAPPER
// ==========================================
const AnimatedScreen = ({ children, triggerKey }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(18);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();
  }, [triggerKey]);

  return (
    <Animated.View
      style={{
        flex: 1,
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }}
    >
      {children}
    </Animated.View>
  );
};

// ==========================================
// 5. MAIN APPLICATION COMPONENT
// ==========================================
export default function App() {
  const [activeTab, setActiveTab] = useState('Home');
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [profileTab, setProfileTab] = useState('Classes');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [subjects, setSubjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [fees, setFees] = useState([]);
  const [activities, setActivities] = useState([]);
  const [noticeText, setNoticeText] = useState('');
  const [noticeUpdatedAt, setNoticeUpdatedAt] = useState('');

  const [contextMenu, setContextMenu] = useState({
    visible: false,
    entityType: null,
    item: null,
    title: '',
  });

  const [noticeReadModal, setNoticeReadModal] = useState(false);
  const [noticeEditModal, setNoticeEditModal] = useState(false);
  const [noticeInput, setNoticeInput] = useState('');

  const [todayLogModal, setTodayLogModal] = useState(false);
  const [subjectsModal, setSubjectsModal] = useState(false);
  const [subjectForm, setSubjectForm] = useState({ id: null, name: '' });

  const [studentModal, setStudentModal] = useState(false);
  const [studentForm, setStudentForm] = useState({
    id: null,
    name: '',
    subjectId: '',
    phone: '',
    guardian: '',
    joinedDate: getTodayISO(),
  });

  const [lessonEditModal, setLessonEditModal] = useState(false);
  const [lessonForm, setLessonForm] = useState({
    id: null,
    studentId: '',
    date: getTodayISO(),
    technique: '',
    repertoire: '',
    assignment: '',
  });

  const [attendanceModal, setAttendanceModal] = useState(false);
  const [attendanceFilterAllMonths, setAttendanceFilterAllMonths] = useState(false);
  const [attendanceForm, setAttendanceForm] = useState({
    id: null,
    studentId: '',
    date: getTodayISO(),
    status: 'Present',
    remarks: '',
  });

  const [feeModal, setFeeModal] = useState(false);
  const [feeForm, setFeeForm] = useState({
    id: null,
    studentId: '',
    feeType: 'Monthly Fee',
    monthPaidFor: getLocalCurrentMonthLabel(),
    date: getTodayISO(),
    mode: 'UPI',
    status: 'Paid',
    amountPaid: '',
    balanceDue: '0',
    remarks: '',
  });

  const [noteDraft, setNoteDraft] = useState('');
  const [priorityDraft, setPriorityDraft] = useState(false);
  const [CheckingOTA, setCheckingOTA] = useState(false);

  // ==========================================
  // 6. FIRESTORE LISTENERS & 30-DAY AUTO-PURGE
  // ==========================================
  useEffect(() => {
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

    const handleSnapshotWithAutoPurge = (colName, snapshot, setter) => {
      const records = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.isDeleted && data.deletedAt && Date.now() - Number(data.deletedAt) > THIRTY_DAYS_MS) {
          deleteDoc(doc(db, colName, docSnap.id)).catch(() => {});
        } else {
          records.push({ id: docSnap.id, ...data });
        }
      });
      triggerLayoutAnimation();
      setter(records);
    };

    const unsubSubjects = onSnapshot(collection(db, 'subjects'), (snap) =>
      handleSnapshotWithAutoPurge('subjects', snap, setSubjects)
    );
    const unsubStudents = onSnapshot(collection(db, 'students'), (snap) =>
      handleSnapshotWithAutoPurge('students', snap, setStudents)
    );
    const unsubLessons = onSnapshot(collection(db, 'lessons'), (snap) =>
      handleSnapshotWithAutoPurge('lessons', snap, setLessons)
    );
    const unsubAttendance = onSnapshot(collection(db, 'attendance'), (snap) =>
      handleSnapshotWithAutoPurge('attendance', snap, setAttendance)
    );
    const unsubFees = onSnapshot(collection(db, 'fees'), (snap) =>
      handleSnapshotWithAutoPurge('fees', snap, setFees)
    );
    const unsubActivities = onSnapshot(collection(db, 'activities'), (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setActivities(list);
    });
    const unsubNotice = onSnapshot(doc(db, 'settings', 'noticeBoard'), (docSnap) => {
      if (docSnap.exists()) {
        const d = docSnap.data();
        setNoticeText(d.text || '');
        setNoticeUpdatedAt(d.updatedDate || '');
      }
    });

    return () => {
      unsubSubjects();
      unsubStudents();
      unsubLessons();
      unsubAttendance();
      unsubFees();
      unsubActivities();
      unsubNotice();
    };
  }, []);

  const logActivity = async (actionTitle, subtitle) => {
    try {
      await addDoc(collection(db, 'activities'), {
        title: actionTitle,
        subtitle: subtitle || '',
        dateISO: getTodayISO(),
        timestamp: Date.now(),
      });
    } catch (e) {}
  };

  // ==========================================
  // 7. DERIVED & SORTED STATE
  // ==========================================
  const activeSubjects = useMemo(() => {
    return subjects
      .filter((s) => !s.isDeleted)
      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  }, [subjects]);

  const subjectMap = useMemo(() => {
    const map = {};
    subjects.forEach((s) => {
      map[s.id] = s;
    });
    return map;
  }, [subjects]);

  const activeStudents = useMemo(() => {
    return students
      .filter((st) => !st.isDeleted)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [students]);

  const studentMap = useMemo(() => {
    const map = {};
    students.forEach((s) => {
      map[s.id] = s;
    });
    return map;
  }, [students]);

  const activeLessons = useMemo(
    () => lessons.filter((l) => !l.isDeleted).sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [lessons]
  );

  const activeAttendance = useMemo(
    () => attendance.filter((a) => !a.isDeleted).sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [attendance]
  );

  const activeFees = useMemo(
    () => fees.filter((f) => !f.isDeleted).sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [fees]
  );

  const trashItems = useMemo(() => {
    const allDeleted = [
      ...subjects.filter((x) => x.isDeleted).map((x) => ({ ...x, _col: 'subjects', _label: `Subject: ${x.name}` })),
      ...students.filter((x) => x.isDeleted).map((x) => ({ ...x, _col: 'students', _label: `Student: ${x.name}` })),
      ...lessons
        .filter((x) => x.isDeleted)
        .map((x) => ({
          ...x,
          _col: 'lessons',
          _label: `Lesson: ${studentMap[x.studentId]?.name || 'Student'} (${x.date})`,
        })),
      ...attendance
        .filter((x) => x.isDeleted)
        .map((x) => ({
          ...x,
          _col: 'attendance',
          _label: `Attendance: ${studentMap[x.studentId]?.name || 'Student'} - ${x.status} (${x.date})`,
        })),
      ...fees
        .filter((x) => x.isDeleted)
        .map((x) => ({
          ...x,
          _col: 'fees',
          _label: `Fee: ${studentMap[x.studentId]?.name || 'Student'} - ₹${x.amountPaid} (${x.date})`,
        })),
    ];
    return allDeleted.sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));
  }, [subjects, students, lessons, attendance, fees, studentMap]);

  const selectedStudent = useMemo(
    () => activeStudents.find((s) => s.id === selectedStudentId) || null,
    [activeStudents, selectedStudentId]
  );

  useEffect(() => {
    if (selectedStudent) {
      setNoteDraft(selectedStudent.notes || '');
      setPriorityDraft(Boolean(selectedStudent.priorityNote));
    }
  }, [selectedStudentId, selectedStudent?.notes, selectedStudent?.priorityNote]);

  // ==========================================
  // 8. STRICT MATHEMATICAL & FEE LOGIC
  // ==========================================
  const getStudentMetrics = useCallback(
    (studentId) => {
      const stLessons = activeLessons.filter((l) => l.studentId === studentId);
      const stAttendance = activeAttendance.filter((a) => a.studentId === studentId);
      const stFees = activeFees.filter((f) => f.studentId === studentId);

      let attendancePct = 'N/A';
      if (stAttendance.length > 0) {
        const attendedCount = stAttendance.filter(
          (a) => a.status === 'Present' || a.status === 'Tardy'
        ).length;
        attendancePct = `${Math.round((attendedCount / stAttendance.length) * 100)}%`;
      }

      let feeStatus = 'No Records';
      if (stFees.length > 0) {
        const hasUnpaidOrBalance = stFees.some(
          (f) => f.status === 'Unpaid' || Number(f.balanceDue || 0) > 0
        );
        feeStatus = hasUnpaidOrBalance ? 'Due / Unpaid' : 'Paid';
      }

      return {
        classesTaken: stLessons.length,
        attendancePct,
        feeStatus,
        stLessons,
        stAttendance,
        stFees,
      };
    },
    [activeLessons, activeAttendance, activeFees]
  );

  // ==========================================
  // 9. OTA UPDATES & PDF RECEIPT GENERATOR
  // ==========================================
  const handleCheckOTA = async () => {
    try {
      setCheckingOTA(true);
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        await Updates.fetchUpdateAsync();
        Alert.alert('Update Ready', 'Restarting JSM APP with the latest version.', [
          { text: 'Restart Now', onPress: () => Updates.reloadAsync() },
        ]);
      } else {
        Alert.alert('Up to Date', 'You are running the latest JSM APP build.');
      }
    } catch (e) {
      Alert.alert('OTA Notice', 'OTA check requires a production/preview Expo Updates build.');
    } finally {
      setCheckingOTA(false);
    }
  };

  const generateAndShareReceiptPDF = async (feeRecord) => {
    const st = studentMap[feeRecord.studentId];
    const studentName = st?.name || 'JSM Student';
    const subjectName = subjectMap[st?.subjectId]?.name || 'Music Studies';

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: 'Georgia', serif; background: #FAF8F5; padding: 32px; color: #0C2D57; }
            .card { background: #0C2D57; color: #FAF8F5; border: 3px solid #D4B978; border-radius: 14px; padding: 32px; }
            .crest { color: #D4B978; text-align: center; letter-spacing: 3px; font-size: 12px; font-weight: bold; }
            .title { text-align: center; font-size: 26px; margin: 8px 0 4px; color: #FFFFFF; }
            .subtitle { text-align: center; color: #EFE7D3; font-size: 13px; margin-bottom: 24px; }
            .divider { height: 1px; background: #D4B978; margin: 20px 0; opacity: 0.5; }
            .row { display: flex; justify-content: space-between; margin: 12px 0; font-size: 15px; }
            .label { color: #EFE7D3; }
            .val { color: #D4B978; font-weight: bold; }
            .total-box { background: rgba(212, 185, 120, 0.14); border: 1px solid #D4B978; padding: 16px; border-radius: 8px; margin-top: 20px; }
            .footer { text-align: center; margin-top: 28px; font-size: 11px; color: #8E9399; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="crest">★ EST. 2022 ★</div>
            <div class="title">JSM APP</div>
            <div class="subtitle">OFFICIAL TUITION & FEE RECEIPT</div>
            <div class="divider"></div>
            <div class="row"><span class="label">Student Name:</span><span class="val">${studentName}</span></div>
            <div class="row"><span class="label">Instrument / Subject:</span><span class="val">${subjectName}</span></div>
            <div class="row"><span class="label">Date of Transaction:</span><span class="val">${formatReadableLocalDate(feeRecord.date)}</span></div>
            <div class="row"><span class="label">Fee Category:</span><span class="val">${feeRecord.feeType}</span></div>
            ${
              feeRecord.feeType === 'Monthly Fee'
                ? `<div class="row"><span class="label">Month Paid For:</span><span class="val">${feeRecord.monthPaidFor || '-'}</span></div>`
                : ''
            }
            <div class="row"><span class="label">Payment Mode:</span><span class="val">${feeRecord.mode}</span></div>
            <div class="row"><span class="label">Payment Status:</span><span class="val">${feeRecord.status}</span></div>
            <div class="total-box">
              <div class="row"><span class="label">Amount Paid:</span><span class="val">₹${Number(feeRecord.amountPaid || 0).toFixed(2)}</span></div>
              <div class="row"><span class="label">Balance Due:</span><span class="val">₹${Number(feeRecord.balanceDue || 0).toFixed(2)}</span></div>
            </div>
            ${
              feeRecord.remarks
                ? `<div class="row" style="margin-top:16px;"><span class="label">Remarks:</span><span class="val">${feeRecord.remarks}</span></div>`
                : ''
            }
            <div class="footer">Generated by JSM Administration • Est. 2022</div>
          </div>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Share Receipt via WhatsApp - ${studentName}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('PDF Created', `Saved to: ${uri}`);
      }
    } catch (err) {
      Alert.alert('Receipt Error', 'Could not generate or share the PDF receipt.');
    }
  };

  // ==========================================
  // 10. CRUD & LONG-PRESS HANDLERS
  // ==========================================
  const openLongPressMenu = (entityType, item, title) => {
    setContextMenu({
      visible: true,
      entityType,
      item,
      title,
    });
  };

  const closeContextMenu = () => {
    setContextMenu({ visible: false, entityType: null, item: null, title: '' });
  };

  const handleSoftDelete = async (collectionName, item, label) => {
    try {
      triggerLayoutAnimation();
      await updateDoc(doc(db, collectionName, item.id), {
        isDeleted: true,
        deletedAt: Date.now(),
      });
      await logActivity(`Moved to Trash`, label);
      if (collectionName === 'students' && selectedStudentId === item.id) {
        setSelectedStudentId(null);
      }
    } catch (e) {
      Alert.alert('Error', 'Unable to move item to Trash.');
    }
  };

  const handleContextAction = async (action) => {
    const { entityType, item, title } = contextMenu;
    closeContextMenu();
    if (!item) return;

    if (action === 'delete') {
      const colMap = {
        subject: 'subjects',
        student: 'students',
        lesson: 'lessons',
        attendance: 'attendance',
        fee: 'fees',
      };
      await handleSoftDelete(colMap[entityType], item, title);
      return;
    }

    if (action === 'moveUp' || action === 'moveDown') {
      if (entityType !== 'subject') return;
      const idx = activeSubjects.findIndex((s) => s.id === item.id);
      const targetIdx = action === 'moveUp' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= activeSubjects.length) return;

      const reordered = [...activeSubjects];
      const [moved] = reordered.splice(idx, 1);
      reordered.splice(targetIdx, 0, moved);

      triggerLayoutAnimation();
      const batch = writeBatch(db);
      reordered.forEach((subj, index) => {
        batch.update(doc(db, 'subjects', subj.id), { order: index });
      });
      await batch.commit();
      await logActivity('Reordered Subject', `${item.name} moved ${action === 'moveUp' ? 'up' : 'down'}`);
      return;
    }

    if (action === 'edit') {
      if (entityType === 'subject') {
        setSubjectForm({ id: item.id, name: item.name });
        setSubjectsModal(true);
      } else if (entityType === 'student') {
        setStudentForm({
          id: item.id,
          name: item.name || '',
          subjectId: item.subjectId || activeSubjects[0]?.id || '',
          phone: item.phone || '',
          guardian: item.guardian || '',
          joinedDate: item.joinedDate || getTodayISO(),
        });
        setStudentModal(true);
      } else if (entityType === 'lesson') {
        setLessonForm({
          id: item.id,
          studentId: item.studentId,
          date: item.date || getTodayISO(),
          technique: item.technique || '',
          repertoire: item.repertoire || '',
          assignment: item.assignment || '',
        });
        setLessonEditModal(true);
      } else if (entityType === 'attendance') {
        setAttendanceForm({
          id: item.id,
          studentId: item.studentId,
          date: item.date || getTodayISO(),
          status: item.status || 'Present',
          remarks: item.remarks || '',
        });
        setAttendanceModal(true);
      } else if (entityType === 'fee') {
        setFeeForm({
          id: item.id,
          studentId: item.studentId,
          feeType: item.feeType || 'Monthly Fee',
          monthPaidFor: item.monthPaidFor || getLocalCurrentMonthLabel(),
          date: item.date || getTodayISO(),
          mode: item.mode || 'UPI',
          status: item.status || 'Paid',
          amountPaid: String(item.amountPaid ?? '0'),
          balanceDue: String(item.balanceDue ?? '0'),
          remarks: item.remarks || '',
        });
        setFeeModal(true);
      }
    }
  };

  const handleSaveSubject = async () => {
    const trimmed = subjectForm.name.trim();
    if (!trimmed) {
      Alert.alert('Validation', 'Please enter a subject/instrument name.');
      return;
    }
    triggerLayoutAnimation();
    if (subjectForm.id) {
      await updateDoc(doc(db, 'subjects', subjectForm.id), { name: trimmed });
      await logActivity('Updated Subject', trimmed);
    } else {
      await addDoc(collection(db, 'subjects'), {
        name: trimmed,
        order: activeSubjects.length,
        isDeleted: false,
        deletedAt: null,
      });
      await logActivity('Added Subject', trimmed);
    }
    setSubjectForm({ id: null, name: '' });
  };

  const handleSaveStudent = async () => {
    if (!studentForm.name.trim() || !studentForm.subjectId) {
      Alert.alert('Validation', 'Student Name and Subject are required.');
      return;
    }
    triggerLayoutAnimation();
    const payload = {
      name: studentForm.name.trim(),
      subjectId: studentForm.subjectId,
      phone: studentForm.phone.trim(),
      guardian: studentForm.guardian.trim(),
      joinedDate: studentForm.joinedDate || getTodayISO(),
    };

    if (studentForm.id) {
      await updateDoc(doc(db, 'students', studentForm.id), payload);
      await logActivity('Updated Student', payload.name);
    } else {
      await addDoc(collection(db, 'students'), {
        ...payload,
        notes: '',
        priorityNote: false,
        isDeleted: false,
        deletedAt: null,
      });
      await logActivity('Enrolled Student', `${payload.name} (${subjectMap[payload.subjectId]?.name || ''})`);
    }
    setStudentModal(false);
    setStudentForm({
      id: null,
      name: '',
      subjectId: activeSubjects[0]?.id || '',
      phone: '',
      guardian: '',
      joinedDate: getTodayISO(),
    });
  };

  const handleSaveLesson = async (isFromProfileInline = false) => {
    const targetStudentId = isFromProfileInline ? selectedStudentId : lessonForm.studentId;
    if (!targetStudentId || !lessonForm.date.trim()) {
      Alert.alert('Validation', 'Date and Student are required.');
      return;
    }
    if (!lessonForm.technique.trim() && !lessonForm.repertoire.trim() && !lessonForm.assignment.trim()) {
      Alert.alert('Validation', 'Enter at least one lesson detail (Technique, Repertoire, or Assignment).');
      return;
    }
    triggerLayoutAnimation();
    const payload = {
      studentId: targetStudentId,
      date: lessonForm.date.trim(),
      technique: lessonForm.technique.trim(),
      repertoire: lessonForm.repertoire.trim(),
      assignment: lessonForm.assignment.trim(),
    };

    if (lessonForm.id) {
      await updateDoc(doc(db, 'lessons', lessonForm.id), payload);
      await logActivity('Updated Lesson', `${studentMap[targetStudentId]?.name || 'Student'} (${payload.date})`);
      setLessonEditModal(false);
    } else {
      await addDoc(collection(db, 'lessons'), {
        ...payload,
        isDeleted: false,
        deletedAt: null,
      });
      await logActivity('Logged Lesson', `${studentMap[targetStudentId]?.name || 'Student'} (${payload.date})`);
    }
    setLessonForm({
      id: null,
      studentId: targetStudentId,
      date: getTodayISO(),
      technique: '',
      repertoire: '',
      assignment: '',
    });
  };

  const handleSaveAttendance = async (isFromProfileInline = false) => {
    const targetStudentId = isFromProfileInline ? selectedStudentId : attendanceForm.studentId;
    if (!targetStudentId || !attendanceForm.date.trim()) {
      Alert.alert('Validation', 'Please select a Student and Date.');
      return;
    }
    triggerLayoutAnimation();
    const payload = {
      studentId: targetStudentId,
      date: attendanceForm.date.trim(),
      status: attendanceForm.status,
      remarks: attendanceForm.remarks.trim(),
    };

    if (attendanceForm.id) {
      await updateDoc(doc(db, 'attendance', attendanceForm.id), payload);
      await logActivity(
        'Updated Attendance',
        `${studentMap[targetStudentId]?.name || 'Student'} • ${payload.status}`
      );
    } else {
      await addDoc(collection(db, 'attendance'), {
        ...payload,
        isDeleted: false,
        deletedAt: null,
      });
      await logActivity(
        'Marked Attendance',
        `${studentMap[targetStudentId]?.name || 'Student'} • ${payload.status}`
      );
    }
    setAttendanceModal(false);
    setAttendanceForm({
      id: null,
      studentId: activeStudents[0]?.id || '',
      date: getTodayISO(),
      status: 'Present',
      remarks: '',
    });
  };

  const handleSaveStudentNotes = async () => {
    if (!selectedStudentId) return;
    await updateDoc(doc(db, 'students', selectedStudentId), {
      notes: noteDraft,
      priorityNote: priorityDraft,
    });
    await logActivity('Updated Student Notes', studentMap[selectedStudentId]?.name || '');
    Alert.alert('Saved', 'Student notes updated.');
  };

  const handleSaveFee = async (shouldSharePDF = false) => {
    if (!feeForm.studentId) {
      Alert.alert('Validation', 'Please select a Student.');
      return;
    }
    if (feeForm.feeType === 'Monthly Fee' && !feeForm.monthPaidFor.trim()) {
      Alert.alert('Validation', '"Month Paid For" is required for Monthly Fees.');
      return;
    }

    const numericPaid = feeForm.status === 'Unpaid' ? 0 : Number(feeForm.amountPaid || 0);
    const numericBalance = feeForm.status === 'Paid' ? 0 : Number(feeForm.balanceDue || 0);

    if (feeForm.status === 'Unpaid' && numericBalance <= 0) {
      Alert.alert('Validation', 'Unpaid records require a Balance Due greater than 0.');
      return;
    }
    if (feeForm.status === 'Paid' && numericPaid <= 0) {
      Alert.alert('Validation', 'Paid records require an Amount Paid greater than 0.');
      return;
    }

    triggerLayoutAnimation();
    const payload = {
      studentId: feeForm.studentId,
      feeType: feeForm.feeType,
      monthPaidFor: feeForm.feeType === 'Monthly Fee' ? feeForm.monthPaidFor.trim() : '',
      date: feeForm.date.trim() || getTodayISO(),
      mode: feeForm.mode,
      status: feeForm.status,
      amountPaid: numericPaid,
      balanceDue: numericBalance,
      remarks: feeForm.remarks.trim(),
    };

    if (feeForm.id) {
      await updateDoc(doc(db, 'fees', feeForm.id), payload);
      await logActivity(
        'Updated Fee Record',
        `${studentMap[payload.studentId]?.name || 'Student'} • ₹${numericPaid}`
      );
    } else {
      await addDoc(collection(db, 'fees'), {
        ...payload,
        isDeleted: false,
        deletedAt: null,
      });
      await logActivity(
        'Recorded Fee',
        `${studentMap[payload.studentId]?.name || 'Student'} • ₹${numericPaid} (${payload.status})`
      );
    }

    setFeeModal(false);
    if (shouldSharePDF) {
      await generateAndShareReceiptPDF(payload);
    }
  };

  const handleUpdateNotice = async () => {
    const today = getTodayISO();
    await setDoc(doc(db, 'settings', 'noticeBoard'), {
      text: noticeInput.trim(),
      updatedDate: today,
    });
    await logActivity('Updated Notice Board', formatReadableLocalDate(today));
    setNoticeInput('');
    setNoticeEditModal(false);
  };

  const handleRestoreTrashItem = async (item) => {
    triggerLayoutAnimation();
    await updateDoc(doc(db, item._col, item.id), {
      isDeleted: false,
      deletedAt: null,
    });
    await logActivity('Restored from Trash', item._label);
  };

  const handlePermanentDeleteItem = async (item) => {
    triggerLayoutAnimation();
    await deleteDoc(doc(db, item._col, item.id));
    await logActivity('Permanently Deleted', item._label);
  };

  const handleEmptyTrash = () => {
    if (trashItems.length === 0) return;
    Alert.alert(
      'Empty Trash Permanently?',
      `This will permanently erase ${trashItems.length} item(s). This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Empty Trash',
          style: 'destructive',
          onPress: async () => {
            triggerLayoutAnimation();
            const batch = writeBatch(db);
            trashItems.forEach((item) => {
              batch.delete(doc(db, item._col, item.id));
            });
            await batch.commit();
            await logActivity('Emptied Trash Archive', `${trashItems.length} items removed`);
          },
        },
      ]
    );
  };

  const groupRecordsBySubjectAndMonth = useCallback(
    (records) => {
      const grouped = [];
      activeSubjects.forEach((subj) => {
        const subjectRecords = records.filter(
          (r) => studentMap[r.studentId]?.subjectId === subj.id
        );
        if (subjectRecords.length > 0) {
          const monthsMap = {};
          subjectRecords.forEach((rec) => {
            const mLabel = getMonthYearFromISO(rec.date);
            if (!monthsMap[mLabel]) monthsMap[mLabel] = [];
            monthsMap[mLabel].push(rec);
          });
          grouped.push({
            subject: subj,
            months: Object.entries(monthsMap).map(([monthName, items]) => ({
              monthName,
              items,
            })),
          });
        }
      });
      return grouped;
    },
    [activeSubjects, studentMap]
  );

  // ==========================================
  // 11. RENDER SECTIONS (TABS 1 - 5)
  // ==========================================
  const renderHomeTab = () => {
    const recentFourActivities = activities.slice(0, 4);
    const todayISO = getTodayISO();

    return (
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.crestBadge}>
            <Text style={styles.crestBadgeText}>★ JSM APP • EST. 2022 ★</Text>
          </View>
          <Text style={styles.heroGreeting}>{getGreetingByLocalTime()}, Maestro</Text>
          <Text style={styles.heroDate}>{formatReadableLocalDate(todayISO)}</Text>
          <View style={styles.heroDivider} />
          <View style={styles.heroStatRow}>
            <View>
              <Text style={styles.heroStatLabel}>ACTIVE ENROLLMENT</Text>
              <Text style={styles.heroStatValue}>{activeStudents.length} Students</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.heroStatLabel}>DEPARTMENTS</Text>
              <Text style={styles.heroStatValue}>{activeSubjects.length} Instruments</Text>
            </View>
          </View>
        </View>

        <View style={styles.creamCard}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.sectionTitle}>JSM APP NOTICE BOARD</Text>
            {noticeUpdatedAt ? (
              <Text style={styles.silverMeta}>{formatReadableLocalDate(noticeUpdatedAt)}</Text>
            ) : null}
          </View>
          <Text style={styles.noticePreviewText} numberOfLines={2}>
            {noticeText ? noticeText : 'No active announcements posted.'}
          </Text>
          <View style={styles.noticeActionRow}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setNoticeReadModal(true)}
            >
              <Text style={styles.secondaryButtonText}>Read More</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.primaryNavyButton}
              onPress={() => {
                setNoticeInput('');
                setNoticeEditModal(true);
              }}
            >
              <Text style={styles.primaryNavyButtonText}>Update Notice</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.bentoRow}>
          <TouchableOpacity
            style={[styles.bentoCard, { backgroundColor: COLORS.navy }]}
            onPress={() => {
              if (activeSubjects.length === 0) {
                Alert.alert(
                  'Create Subject First',
                  'Please add at least one instrument in Manage Subjects before registering a student.'
                );
                return;
              }
              setStudentForm({
                id: null,
                name: '',
                subjectId: activeSubjects[0]?.id || '',
                phone: '',
                guardian: '',
                joinedDate: getTodayISO(),
              });
              setStudentModal(true);
            }}
          >
            <MaterialCommunityIcons name="account-music-outline" size={28} color={COLORS.gold} />
            <Text style={styles.bentoTitleGold}>Add Student</Text>
            <Text style={styles.bentoSubCream}>New Registration</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.bentoCard, { backgroundColor: COLORS.cream, borderColor: COLORS.gold, borderWidth: 1 }]}
            onPress={() => {
              setSubjectForm({ id: null, name: '' });
              setSubjectsModal(true);
            }}
          >
            <MaterialCommunityIcons name="piano" size={28} color={COLORS.navy} />
            <Text style={styles.bentoTitleNavy}>Manage Subjects</Text>
            <Text style={styles.bentoSubSilver}>{activeSubjects.length} Active</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.whiteCard}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.sectionTitle}>RECENT ACTIVITY AUDIT</Text>
            <TouchableOpacity
              style={styles.pillGoldBtn}
              onPress={() => setTodayLogModal(true)}
            >
              <Text style={styles.pillGoldBtnText}>Today</Text>
            </TouchableOpacity>
          </View>
          {recentFourActivities.length === 0 ? (
            <Text style={styles.emptyText}>No recent actions recorded yet.</Text>
          ) : (
            recentFourActivities.map((act) => (
              <View key={act.id} style={styles.activityItem}>
                <View style={styles.activityDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.activityTitle}>{act.title}</Text>
                  <Text style={styles.activitySub}>{act.subtitle}</Text>
                </View>
                <Text style={styles.silverMeta}>{formatReadableLocalDate(act.dateISO)}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    );
  };

  const renderStudentsTab = () => {
    if (selectedStudent) {
      return renderStudentProfile(selectedStudent);
    }

    return (
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.tabTopBar}>
          <View>
            <Text style={styles.pageHeading}>Student Directory</Text>
            <Text style={styles.silverMeta}>Long-press any student card to edit or remove</Text>
          </View>
          <TouchableOpacity
            style={styles.primaryNavyButton}
            onPress={() => {
              if (activeSubjects.length === 0) {
                Alert.alert('Subject Required', 'Add an instrument in Manage Subjects first.');
                return;
              }
              setStudentForm({
                id: null,
                name: '',
                subjectId: activeSubjects[0]?.id || '',
                phone: '',
                guardian: '',
                joinedDate: getTodayISO(),
              });
              setStudentModal(true);
            }}
          >
            <Text style={styles.primaryNavyButtonText}>+ Student</Text>
          </TouchableOpacity>
        </View>

        {activeSubjects.length === 0 ? (
          <View style={styles.whiteCard}>
            <Text style={styles.emptyText}>
              No subjects configured. Open "Manage Subjects" on the Home Dashboard to add instruments.
            </Text>
          </View>
        ) : (
          activeSubjects.map((subj) => {
            const subjStudents = activeStudents.filter((s) => s.subjectId === subj.id);
            return (
              <View key={subj.id} style={styles.groupBlock}>
                <View style={styles.groupHeaderBar}>
                  <Text style={styles.groupHeaderTitle}>{subj.name.toUpperCase()}</Text>
                  <Text style={styles.groupHeaderCount}>{subjStudents.length}</Text>
                </View>
                {subjStudents.length === 0 ? (
                  <Text style={styles.emptyGroupText}>No students enrolled in {subj.name}</Text>
                ) : (
                  subjStudents.map((st) => {
                    const metrics = getStudentMetrics(st.id);
                    return (
                      <Pressable
                        key={st.id}
                        style={({ pressed }) => [
                          styles.cleanRecordCard,
                          pressed && styles.cardPressed,
                        ]}
                        onPress={() => {
                          setSelectedStudentId(st.id);
                          setProfileTab('Classes');
                        }}
                        onLongPress={() => openLongPressMenu('student', st, st.name)}
                        delayLongPress={320}
                      >
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={styles.recordPrimaryTitle}>{st.name}</Text>
                            {st.priorityNote ? (
                              <View style={styles.priorityBadge}>
                                <Text style={styles.priorityBadgeText}>★ NOTE</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={styles.recordSecondarySub}>
                            Joined {formatReadableLocalDate(st.joinedDate)} • Attendance: {metrics.attendancePct}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.feeBadge,
                            metrics.feeStatus === 'Paid'
                              ? styles.feeBadgePaid
                              : metrics.feeStatus === 'Due / Unpaid'
                              ? styles.feeBadgeDue
                              : styles.feeBadgeNeutral,
                          ]}
                        >
                          <Text style={styles.feeBadgeText}>{metrics.feeStatus}</Text>
                        </View>
                      </Pressable>
                    );
                  })
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    );
  };

  const renderStudentProfile = (student) => {
    const metrics = getStudentMetrics(student.id);
    const subjName = subjectMap[student.subjectId]?.name || 'Unassigned';

    return (
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.backButtonRow}
          onPress={() => setSelectedStudentId(null)}
        >
          <Ionicons name="arrow-back" size={18} color={COLORS.navy} />
          <Text style={styles.backButtonText}>Back to Directory</Text>
        </TouchableOpacity>

        <View style={styles.heroCard}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.crestBadgeText}>{subjName.toUpperCase()} DEPARTMENT</Text>
              <Text style={styles.heroGreeting}>{student.name}</Text>
              {student.phone ? (
                <Text style={styles.heroDate}>Contact: {student.phone}</Text>
              ) : null}
            </View>
            {student.priorityNote ? (
              <View style={styles.priorityBadge}>
                <Text style={styles.priorityBadgeText}>★ NOTE</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.profileStatsGrid}>
            <View style={styles.profileStatBox}>
              <Text style={styles.profileStatLabel}>ATTENDANCE</Text>
              <Text style={styles.profileStatVal}>{metrics.attendancePct}</Text>
            </View>
            <View style={styles.profileStatBox}>
              <Text style={styles.profileStatLabel}>CLASSES TAKEN</Text>
              <Text style={styles.profileStatVal}>{metrics.classesTaken}</Text>
            </View>
            <View style={styles.profileStatBox}>
              <Text style={styles.profileStatLabel}>FEE STATUS</Text>
              <Text
                style={[
                  styles.profileStatVal,
                  {
                    fontSize: 13,
                    color:
                      metrics.feeStatus === 'Due / Unpaid'
                        ? '#FFB4A2'
                        : COLORS.gold,
                  },
                ]}
              >
                {metrics.feeStatus}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.pillNavContainer}>
          {['Classes', 'Attendance', 'Notes', 'Fees'].map((tab) => {
            const active = profileTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.pillNavItem, active && styles.pillNavItemActive]}
                onPress={() => setProfileTab(tab)}
              >
                <Text style={[styles.pillNavText, active && styles.pillNavTextActive]}>
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {profileTab === 'Classes' && (
          <View>
            <View style={styles.whiteCard}>
              <Text style={styles.sectionTitle}>LOG NEW LESSON</Text>
              <Text style={styles.inputLabel}>Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={lessonForm.date}
                onChangeText={(t) => setLessonForm({ ...lessonForm, date: t })}
                placeholder="YYYY-MM-DD"
              />
              <Text style={styles.inputLabel}>Technique</Text>
              <TextInput
                style={styles.input}
                value={lessonForm.technique}
                onChangeText={(t) => setLessonForm({ ...lessonForm, technique: t })}
                placeholder="Scales, arpeggios, posture..."
              />
              <Text style={styles.inputLabel}>Repertoire</Text>
              <TextInput
                style={styles.input}
                value={lessonForm.repertoire}
                onChangeText={(t) => setLessonForm({ ...lessonForm, repertoire: t })}
                placeholder="Sonatina in C, Etude Op. 10..."
              />
              <Text style={styles.inputLabel}>Assignment</Text>
              <TextInput
                style={styles.input}
                value={lessonForm.assignment}
                onChangeText={(t) => setLessonForm({ ...lessonForm, assignment: t })}
                placeholder="Practice measures 16-32 at 80 BPM"
              />
              <TouchableOpacity
                style={[styles.primaryNavyButton, { marginTop: 10 }]}
                onPress={() => handleSaveLesson(true)}
              >
                <Text style={styles.primaryNavyButtonText}>Save Lesson Entry</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.sectionTitle, { marginVertical: 10 }]}>
              LESSON HISTORY (LONG-PRESS TO EDIT/DELETE)
            </Text>
            {metrics.stLessons.length === 0 ? (
              <Text style={styles.emptyText}>No lessons logged for this student yet.</Text>
            ) : (
              metrics.stLessons.map((les) => (
                <Pressable
                  key={les.id}
                  style={styles.cleanRecordCard}
                  onLongPress={() =>
                    openLongPressMenu('lesson', les, `Lesson on ${formatReadableLocalDate(les.date)}`)
                  }
                  delayLongPress={320}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recordPrimaryTitle}>
                      {formatReadableLocalDate(les.date)}
                    </Text>
                    {les.technique ? (
                      <Text style={styles.recordDetailLine}>
                        <Text style={styles.boldLabel}>Technique: </Text>
                        {les.technique}
                      </Text>
                    ) : null}
                    {les.repertoire ? (
                      <Text style={styles.recordDetailLine}>
                        <Text style={styles.boldLabel}>Repertoire: </Text>
                        {les.repertoire}
                      </Text>
                    ) : null}
                    {les.assignment ? (
                      <Text style={styles.recordDetailLine}>
                        <Text style={styles.boldLabel}>Assignment: </Text>
                        {les.assignment}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              ))
            )}
          </View>
        )}

        {profileTab === 'Attendance' && (
          <View>
            <View style={styles.whiteCard}>
              <Text style={styles.sectionTitle}>MARK STUDENT ATTENDANCE</Text>
              <Text style={styles.inputLabel}>Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={attendanceForm.date}
                onChangeText={(t) => setAttendanceForm({ ...attendanceForm, date: t })}
              />
              <Text style={styles.inputLabel}>Status</Text>
              <View style={styles.chipRow}>
                {ATTENDANCE_STATUSES.map((st) => (
                  <TouchableOpacity
                    key={st}
                    style={[
                      styles.choiceChip,
                      attendanceForm.status === st && styles.choiceChipSelected,
                    ]}
                    onPress={() => setAttendanceForm({ ...attendanceForm, status: st })}
                  >
                    <Text
                      style={[
                        styles.choiceChipText,
                        attendanceForm.status === st && styles.choiceChipTextSelected,
                      ]}
                    >
                      {st}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.inputLabel}>Remarks</Text>
              <TextInput
                style={styles.input}
                value={attendanceForm.remarks}
                onChangeText={(t) => setAttendanceForm({ ...attendanceForm, remarks: t })}
                placeholder="Optional attendance notes"
              />
              <TouchableOpacity
                style={[styles.primaryNavyButton, { marginTop: 10 }]}
                onPress={() => handleSaveAttendance(true)}
              >
                <Text style={styles.primaryNavyButtonText}>Record Attendance</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.sectionTitle, { marginVertical: 10 }]}>
              ATTENDANCE LOG (LONG-PRESS TO EDIT/DELETE)
            </Text>
            {metrics.stAttendance.length === 0 ? (
              <Text style={styles.emptyText}>No attendance records found.</Text>
            ) : (
              metrics.stAttendance.map((att) => (
                <Pressable
                  key={att.id}
                  style={styles.cleanRecordCard}
                  onLongPress={() =>
                    openLongPressMenu(
                      'attendance',
                      att,
                      `${att.status} (${formatReadableLocalDate(att.date)})`
                    )
                  }
                  delayLongPress={320}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recordPrimaryTitle}>
                      {formatReadableLocalDate(att.date)}
                    </Text>
                    {att.remarks ? (
                      <Text style={styles.recordSecondarySub}>{att.remarks}</Text>
                    ) : null}
                  </View>
                  <View style={styles.statusPill}>
                    <Text style={styles.statusPillText}>{att.status}</Text>
                  </View>
                </Pressable>
              ))
            )}
          </View>
        )}

        {profileTab === 'Notes' && (
          <View style={styles.whiteCard}>
            <Text style={styles.sectionTitle}>FACULTY STUDENT NOTES</Text>
            <View style={styles.prioritySwitchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.recordPrimaryTitle}>Priority "★ NOTE" Indicator</Text>
                <Text style={styles.silverMeta}>
                  Highlights student card in the main Student Directory
                </Text>
              </View>
              <Switch
                value={priorityDraft}
                onValueChange={setPriorityDraft}
                trackColor={{ false: COLORS.silver, true: COLORS.navy }}
                thumbColor={priorityDraft ? COLORS.gold : COLORS.white}
              />
            </View>
            <TextInput
              style={[styles.input, { height: 130, textAlignVertical: 'top', marginTop: 12 }]}
              multiline
              value={noteDraft}
              onChangeText={setNoteDraft}
              placeholder="Enter examination goals, recital readiness, or parent communication notes..."
            />
            <TouchableOpacity
              style={[styles.primaryNavyButton, { marginTop: 12 }]}
              onPress={handleSaveStudentNotes}
            >
              <Text style={styles.primaryNavyButtonText}>Save Notes</Text>
            </TouchableOpacity>
          </View>
        )}

        {profileTab === 'Fees' && (
          <View>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.sectionTitle}>LOCALIZED FEE LEDGER</Text>
              <TouchableOpacity
                style={styles.primaryNavyButton}
                onPress={() => {
                  setFeeForm({
                    id: null,
                    studentId: student.id,
                    feeType: 'Monthly Fee',
                    monthPaidFor: getLocalCurrentMonthLabel(),
                    date: getTodayISO(),
                    mode: 'UPI',
                    status: 'Paid',
                    amountPaid: '',
                    balanceDue: '0',
                    remarks: '',
                  });
                  setFeeModal(true);
                }}
              >
                <Text style={styles.primaryNavyButtonText}>+ Record Fee</Text>
              </TouchableOpacity>
            </View>

            {metrics.stFees.length === 0 ? (
              <View style={styles.whiteCard}>
                <Text style={styles.emptyText}>No fee records logged for this student.</Text>
              </View>
            ) : (
              metrics.stFees.map((fee) => (
                <Pressable
                  key={fee.id}
                  style={styles.cleanRecordCard}
                  onLongPress={() =>
                    openLongPressMenu(
                      'fee',
                      fee,
                      `${fee.feeType} - ₹${fee.amountPaid} (${formatReadableLocalDate(fee.date)})`
                    )
                  }
                  delayLongPress={320}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recordPrimaryTitle}>
                      {fee.feeType}{' '}
                      {fee.feeType === 'Monthly Fee' && fee.monthPaidFor
                        ? `• ${fee.monthPaidFor}`
                        : ''}
                    </Text>
                    <Text style={styles.recordSecondarySub}>
                      {formatReadableLocalDate(fee.date)} • {fee.mode} • Status: {fee.status}
                    </Text>
                    <Text style={styles.recordDetailLine}>
                      Paid: ₹{fee.amountPaid} | Balance Due: ₹{fee.balanceDue}
                    </Text>
                    {fee.remarks ? (
                      <Text style={styles.silverMeta}>Note: {fee.remarks}</Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    style={styles.pdfShareBtn}
                    onPress={() => generateAndShareReceiptPDF(fee)}
                  >
                    <Text style={styles.pdfShareBtnText}>PDF Receipt</Text>
                  </TouchableOpacity>
                </Pressable>
              ))
            )}
          </View>
        )}
      </ScrollView>
    );
  };

  const renderAttendanceTab = () => {
    const filteredRecords = attendanceFilterAllMonths
      ? activeAttendance
      : activeAttendance.filter((a) => isWithinLastTwoLocalMonths(a.date));

    const groupedAttendance = groupRecordsBySubjectAndMonth(filteredRecords);

    return (
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.tabTopBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pageHeading}>Attendance Register</Text>
            <Text style={styles.silverMeta}>
              {attendanceFilterAllMonths ? 'Showing complete history' : 'Showing last 2 months'} • Long-press to edit/delete
            </Text>
          </View>
          <TouchableOpacity
            style={styles.primaryNavyButton}
            onPress={() => {
              if (activeStudents.length === 0) {
                Alert.alert('No Students', 'Add a student before marking attendance.');
                return;
              }
              setAttendanceForm({
                id: null,
                studentId: activeStudents[0]?.id || '',
                date: getTodayISO(),
                status: 'Present',
                remarks: '',
              });
              setAttendanceModal(true);
            }}
          >
            <Text style={styles.primaryNavyButtonText}>+ Mark</Text>
          </TouchableOpacity>
        </View>

        <View style={{ marginBottom: 12, flexDirection: 'row', justifyContent: 'flex-end' }}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setAttendanceFilterAllMonths(!attendanceFilterAllMonths)}
          >
            <Text style={styles.secondaryButtonText}>
              {attendanceFilterAllMonths ? 'Show Last 2 Months' : 'View All Months'}
            </Text>
          </TouchableOpacity>
        </View>

        {groupedAttendance.length === 0 ? (
          <View style={styles.whiteCard}>
            <Text style={styles.emptyText}>No attendance records in this timeframe.</Text>
          </View>
        ) : (
          groupedAttendance.map((group) => (
            <View key={group.subject.id} style={styles.groupBlock}>
              <View style={styles.groupHeaderBar}>
                <Text style={styles.groupHeaderTitle}>{group.subject.name.toUpperCase()}</Text>
              </View>
              {group.months.map((mGroup) => (
                <View key={mGroup.monthName} style={{ marginTop: 8 }}>
                  <Text style={styles.monthSubHeader}>{mGroup.monthName}</Text>
                  {mGroup.items.map((att) => {
                    const st = studentMap[att.studentId];
                    return (
                      <Pressable
                        key={att.id}
                        style={styles.cleanRecordCard}
                        onLongPress={() =>
                          openLongPressMenu(
                            'attendance',
                            att,
                            `${st?.name || 'Student'} - ${att.status} (${formatReadableLocalDate(att.date)})`
                          )
                        }
                        delayLongPress={320}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.recordPrimaryTitle}>{st?.name || 'Unknown'}</Text>
                          <Text style={styles.recordSecondarySub}>
                            {formatReadableLocalDate(att.date)}
                            {att.remarks ? ` • ${att.remarks}` : ''}
                          </Text>
                        </View>
                        <View style={styles.statusPill}>
                          <Text style={styles.statusPillText}>{att.status}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    );
  };

  const renderFeesTab = () => {
    const groupedFees = groupRecordsBySubjectAndMonth(activeFees);

    return (
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.tabTopBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pageHeading}>Global Fee Ledger</Text>
            <Text style={styles.silverMeta}>Grouped by Subject & Month • Long-press to edit/delete</Text>
          </View>
          <TouchableOpacity
            style={styles.primaryNavyButton}
            onPress={() => {
              if (activeStudents.length === 0) {
                Alert.alert('No Students', 'Enroll a student before recording fees.');
                return;
              }
              setFeeForm({
                id: null,
                studentId: activeStudents[0]?.id || '',
                feeType: 'Monthly Fee',
                monthPaidFor: getLocalCurrentMonthLabel(),
                date: getTodayISO(),
                mode: 'UPI',
                status: 'Paid',
                amountPaid: '',
                balanceDue: '0',
                remarks: '',
              });
              setFeeModal(true);
            }}
          >
            <Text style={styles.primaryNavyButtonText}>+ Record Fee</Text>
          </TouchableOpacity>
        </View>

        {groupedFees.length === 0 ? (
          <View style={styles.whiteCard}>
            <Text style={styles.emptyText}>No fee transactions recorded yet.</Text>
          </View>
        ) : (
          groupedFees.map((group) => (
            <View key={group.subject.id} style={styles.groupBlock}>
              <View style={styles.groupHeaderBar}>
                <Text style={styles.groupHeaderTitle}>{group.subject.name.toUpperCase()}</Text>
              </View>
              {group.months.map((mGroup) => (
                <View key={mGroup.monthName} style={{ marginTop: 8 }}>
                  <Text style={styles.monthSubHeader}>{mGroup.monthName}</Text>
                  {mGroup.items.map((fee) => {
                    const st = studentMap[fee.studentId];
                    return (
                      <Pressable
                        key={fee.id}
                        style={styles.cleanRecordCard}
                        onLongPress={() =>
                          openLongPressMenu(
                            'fee',
                            fee,
                            `${st?.name || 'Student'} - ₹${fee.amountPaid}`
                          )
                        }
                        delayLongPress={320}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.recordPrimaryTitle}>
                            {st?.name || 'Unknown'} • {fee.feeType}
                          </Text>
                          <Text style={styles.recordSecondarySub}>
                            {formatReadableLocalDate(fee.date)} • {fee.mode}
                            {fee.feeType === 'Monthly Fee' && fee.monthPaidFor
                              ? ` • For ${fee.monthPaidFor}`
                              : ''}
                          </Text>
                          <Text style={styles.recordDetailLine}>
                            Paid: ₹{fee.amountPaid} | Balance: ₹{fee.balanceDue}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 6 }}>
                          <View
                            style={[
                              styles.feeBadge,
                              fee.status === 'Paid' && Number(fee.balanceDue) === 0
                                ? styles.feeBadgePaid
                                : styles.feeBadgeDue,
                            ]}
                          >
                            <Text style={styles.feeBadgeText}>{fee.status}</Text>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    );
  };

  const renderTrashTab = () => {
    return (
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.tabTopBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pageHeading}>Trash Archive</Text>
            <Text style={styles.silverMeta}>
              Items are auto-purged after 30 days. Tap any item to Restore or Delete Permanently.
            </Text>
          </View>
          {trashItems.length > 0 && (
            <TouchableOpacity style={styles.dangerButton} onPress={handleEmptyTrash}>
              <Text style={styles.dangerButtonText}>Empty Trash</Text>
            </TouchableOpacity>
          )}
        </View>

        {trashItems.length === 0 ? (
          <View style={styles.whiteCard}>
            <Text style={styles.emptyText}>Trash archive is completely clean.</Text>
          </View>
        ) : (
          trashItems.map((item) => {
            const daysLeft = getDaysRemainingInTrash(item.deletedAt);
            return (
              <TouchableOpacity
                key={`${item._col}-${item.id}`}
                style={styles.cleanRecordCard}
                onPress={() => {
                  Alert.alert(item._label, `${daysLeft} days remaining before permanent purge.`, [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Restore',
                      onPress: () => handleRestoreTrashItem(item),
                    },
                    {
                      text: 'Delete Permanently',
                      style: 'destructive',
                      onPress: () => handlePermanentDeleteItem(item),
                    },
                  ]);
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.recordPrimaryTitle}>{item._label}</Text>
                  <Text style={styles.recordSecondarySub}>
                    Collection: {item._col.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.daysRemainingBadge}>
                  <Text style={styles.daysRemainingText}>{daysLeft}d left</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      <View style={styles.topHeader}>
        <TouchableOpacity
          onPress={() => setDrawerOpen(true)}
          style={styles.hamburgerBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="menu" size={26} color={COLORS.gold} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>JSM APP</Text>
          <Text style={styles.headerCrest}>EST. 2022</Text>
        </View>
        <View style={{ width: 28 }} />
      </View>

      <AnimatedScreen triggerKey={`${activeTab}-${selectedStudentId || 'list'}`}>
        {activeTab === 'Home' && renderHomeTab()}
        {activeTab === 'Students' && renderStudentsTab()}
        {activeTab === 'Attendance' && renderAttendanceTab()}
        {activeTab === 'Fees' && renderFeesTab()}
        {activeTab === 'Trash' && renderTrashTab()}
      </AnimatedScreen>

      <View style={styles.bottomTabBar}>
        {[
          { key: 'Home', icon: 'grid-outline', label: 'Home' },
          { key: 'Students', icon: 'people-outline', label: 'Students' },
          { key: 'Attendance', icon: 'calendar-check-outline', label: 'Attendance', mci: true },
          { key: 'Fees', icon: 'card-outline', label: 'Fees' },
          { key: 'Trash', icon: 'trash-outline', label: 'Trash' },
        ].map((tab) => {
          const isFocused = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.bottomTabItem}
              onPress={() => {
                if (tab.key !== 'Students') setSelectedStudentId(null);
                setActiveTab(tab.key);
              }}
            >
              <View>
                {tab.mci ? (
                  <MaterialCommunityIcons
                    name={tab.icon}
                    size={22}
                    color={isFocused ? COLORS.gold : COLORS.silver}
                  />
                ) : (
                  <Ionicons
                    name={tab.icon}
                    size={22}
                    color={isFocused ? COLORS.gold : COLORS.silver}
                  />
                )}
                {tab.key === 'Trash' && trashItems.length > 0 && (
                  <View style={styles.trashTabBadge}>
                    <Text style={styles.trashTabBadgeText}>{trashItems.length}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.bottomTabLabel, isFocused && styles.bottomTabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Modal visible={drawerOpen} transparent animationType="fade">
        <View style={styles.drawerOverlay}>
          <View style={styles.drawerContainer}>
            <View style={styles.drawerHeader}>
              <Text style={styles.crestBadgeText}>★ JSM APP ★</Text>
              <Text style={styles.drawerTitle}>Music School Portal</Text>
              <Text style={styles.drawerSub}>Est. 2022 • Official Edition</Text>
            </View>

            <View style={{ padding: 16, gap: 10 }}>
              {[
                { label: 'Home Dashboard', tab: 'Home' },
                { label: 'Student Directory', tab: 'Students' },
                { label: 'Global Attendance', tab: 'Attendance' },
                { label: 'Global Fee Register', tab: 'Fees' },
                { label: `Trash Archive (${trashItems.length})`, tab: 'Trash' },
              ].map((nav) => (
                <TouchableOpacity
                  key={nav.tab}
                  style={styles.drawerNavItem}
                  onPress={() => {
                    setSelectedStudentId(null);
                    setActiveTab(nav.tab);
                    setDrawerOpen(false);
                  }}
                >
                  <Text style={styles.drawerNavText}>{nav.label}</Text>
                </TouchableOpacity>
              ))}

              <View style={styles.drawerDivider} />

              <TouchableOpacity
                style={styles.drawerNavItem}
                onPress={() => {
                  setDrawerOpen(false);
                  setSubjectsModal(true);
                }}
              >
                <Text style={styles.drawerNavText}>Manage Instruments & Order</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerNavItem}
                onPress={handleCheckOTA}
                disabled={CheckingOTA}
              >
                {CheckingOTA ? (
                  <ActivityIndicator size="small" color={COLORS.navy} />
                ) : (
                  <Text style={styles.drawerNavText}>Check for OTA Update</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
          <Pressable style={{ flex: 1 }} onPress={() => setDrawerOpen(false)} />
        </View>
      </Modal>

      <Modal visible={contextMenu.visible} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={closeContextMenu}>
          <View style={styles.contextSheet}>
            <Text style={styles.contextSheetHeader}>{contextMenu.title}</Text>
            <View style={styles.contextDivider} />

            <TouchableOpacity
              style={styles.contextOptionBtn}
              onPress={() => handleContextAction('edit')}
            >
              <Text style={styles.contextOptionText}>Edit Record</Text>
            </TouchableOpacity>

            {contextMenu.entityType === 'subject' && (
              <>
                <TouchableOpacity
                  style={styles.contextOptionBtn}
                  onPress={() => handleContextAction('moveUp')}
                >
                  <Text style={styles.contextOptionText}>Reorder: Move Up</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.contextOptionBtn}
                  onPress={() => handleContextAction('moveDown')}
                >
                  <Text style={styles.contextOptionText}>Reorder: Move Down</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={styles.contextOptionBtn}
              onPress={() => handleContextAction('delete')}
            >
              <Text style={[styles.contextOptionText, { color: COLORS.danger }]}>
                Delete (Move to Trash)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryButton, { marginTop: 10, alignSelf: 'stretch', alignItems: 'center' }]}
              onPress={closeContextMenu}
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={noticeReadModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>JSM APP OFFICIAL NOTICE</Text>
            {noticeUpdatedAt ? (
              <Text style={styles.silverMeta}>Posted {formatReadableLocalDate(noticeUpdatedAt)}</Text>
            ) : null}
            <ScrollView style={{ maxHeight: 260, marginVertical: 14 }}>
              <Text style={styles.noticeFullText}>
                {noticeText || 'No active notice has been posted.'}
              </Text>
            </ScrollView>
            <TouchableOpacity
              style={styles.primaryNavyButton}
              onPress={() => setNoticeReadModal(false)}
            >
              <Text style={styles.primaryNavyButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={noticeEditModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>UPDATE NOTICE BOARD</Text>
            <TextInput
              style={[styles.input, { height: 120, textAlignVertical: 'top', marginTop: 10 }]}
              multiline
              value={noticeInput}
              onChangeText={setNoticeInput}
              placeholder="Type new JSM announcement..."
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setNoticeEditModal(false)}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryNavyButton} onPress={handleUpdateNotice}>
                <Text style={styles.primaryNavyButtonText}>Publish Notice</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={todayLogModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>
              TODAY'S AUDIT LOG ({formatReadableLocalDate(getTodayISO())})
            </Text>
            <ScrollView style={{ maxHeight: 320, marginVertical: 12 }}>
              {activities.filter((a) => a.dateISO === getTodayISO()).length === 0 ? (
                <Text style={styles.emptyText}>No actions logged today.</Text>
              ) : (
                activities
                  .filter((a) => a.dateISO === getTodayISO())
                  .map((act) => (
                    <View key={act.id} style={styles.activityItem}>
                      <View style={styles.activityDot} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.activityTitle}>{act.title}</Text>
                        <Text style={styles.activitySub}>{act.subtitle}</Text>
                      </View>
                    </View>
                  ))
              )}
            </ScrollView>
            <TouchableOpacity
              style={styles.primaryNavyButton}
              onPress={() => setTodayLogModal(false)}
            >
              <Text style={styles.primaryNavyButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={subjectsModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>MANAGE INSTRUMENTS & SUBJECTS</Text>
            <Text style={styles.silverMeta}>
              Long-press any subject below to Edit, Delete, Move Up, or Move Down.
            </Text>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                value={subjectForm.name}
                onChangeText={(t) => setSubjectForm({ ...subjectForm, name: t })}
                placeholder="e.g., Piano, Violin, Classical Guitar"
              />
              <TouchableOpacity style={styles.primaryNavyButton} onPress={handleSaveSubject}>
                <Text style={styles.primaryNavyButtonText}>
                  {subjectForm.id ? 'Update' : 'Add'}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 260, marginVertical: 14 }}>
              {activeSubjects.length === 0 ? (
                <Text style={styles.emptyText}>No subjects added yet.</Text>
              ) : (
                activeSubjects.map((subj, idx) => (
                  <Pressable
                    key={subj.id}
                    style={styles.cleanRecordCard}
                    onLongPress={() => {
                      setSubjectsModal(false);
                      setTimeout(() => openLongPressMenu('subject', subj, subj.name), 200);
                    }}
                    delayLongPress={300}
                  >
                    <Text style={styles.recordPrimaryTitle}>
                      {idx + 1}. {subj.name}
                    </Text>
                    <Text style={styles.silverMeta}>Hold for options</Text>
                  </Pressable>
                ))
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                setSubjectForm({ id: null, name: '' });
                setSubjectsModal(false);
              }}
            >
              <Text style={styles.secondaryButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={studentModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>
              {studentForm.id ? 'EDIT STUDENT DETAILS' : 'REGISTER NEW STUDENT'}
            </Text>
            <ScrollView style={{ maxHeight: 380 }}>
              <Text style={styles.inputLabel}>Full Name *</Text>
              <TextInput
                style={styles.input}
                value={studentForm.name}
                onChangeText={(t) => setStudentForm({ ...studentForm, name: t })}
                placeholder="Student Full Name"
              />

              <Text style={styles.inputLabel}>Select Subject / Instrument *</Text>
              <View style={styles.chipRow}>
                {activeSubjects.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[
                      styles.choiceChip,
                      studentForm.subjectId === s.id && styles.choiceChipSelected,
                    ]}
                    onPress={() => setStudentForm({ ...studentForm, subjectId: s.id })}
                  >
                    <Text
                      style={[
                        styles.choiceChipText,
                        studentForm.subjectId === s.id && styles.choiceChipTextSelected,
                      ]}
                    >
                      {s.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Phone / WhatsApp</Text>
              <TextInput
                style={styles.input}
                value={studentForm.phone}
                onChangeText={(t) => setStudentForm({ ...studentForm, phone: t })}
                keyboardType="phone-pad"
                placeholder="+91 98765 43210"
              />

              <Text style={styles.inputLabel}>Parent / Guardian Name</Text>
              <TextInput
                style={styles.input}
                value={studentForm.guardian}
                onChangeText={(t) => setStudentForm({ ...studentForm, guardian: t })}
                placeholder="Optional"
              />

              <Text style={styles.inputLabel}>Enrollment Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={studentForm.joinedDate}
                onChangeText={(t) => setStudentForm({ ...studentForm, joinedDate: t })}
              />
            </ScrollView>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setStudentModal(false)}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryNavyButton} onPress={handleSaveStudent}>
                <Text style={styles.primaryNavyButtonText}>Save Student</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={lessonEditModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>EDIT LESSON RECORD</Text>
            <Text style={styles.inputLabel}>Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={lessonForm.date}
              onChangeText={(t) => setLessonForm({ ...lessonForm, date: t })}
            />
            <Text style={styles.inputLabel}>Technique</Text>
            <TextInput
              style={styles.input}
              value={lessonForm.technique}
              onChangeText={(t) => setLessonForm({ ...lessonForm, technique: t })}
            />
            <Text style={styles.inputLabel}>Repertoire</Text>
            <TextInput
              style={styles.input}
              value={lessonForm.repertoire}
              onChangeText={(t) => setLessonForm({ ...lessonForm, repertoire: t })}
            />
            <Text style={styles.inputLabel}>Assignment</Text>
            <TextInput
              style={styles.input}
              value={lessonForm.assignment}
              onChangeText={(t) => setLessonForm({ ...lessonForm, assignment: t })}
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setLessonEditModal(false)}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryNavyButton}
                onPress={() => handleSaveLesson(false)}
              >
                <Text style={styles.primaryNavyButtonText}>Update Lesson</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={attendanceModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>
              {attendanceForm.id ? 'EDIT ATTENDANCE' : 'MARK GLOBAL ATTENDANCE'}
            </Text>
            <ScrollView style={{ maxHeight: 360 }}>
              <Text style={styles.inputLabel}>Select Student *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {activeStudents.map((st) => (
                    <TouchableOpacity
                      key={st.id}
                      style={[
                        styles.choiceChip,
                        attendanceForm.studentId === st.id && styles.choiceChipSelected,
                      ]}
                      onPress={() => setAttendanceForm({ ...attendanceForm, studentId: st.id })}
                    >
                      <Text
                        style={[
                          styles.choiceChipText,
                          attendanceForm.studentId === st.id && styles.choiceChipTextSelected,
                        ]}
                      >
                        {st.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Text style={styles.inputLabel}>Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={attendanceForm.date}
                onChangeText={(t) => setAttendanceForm({ ...attendanceForm, date: t })}
              />

              <Text style={styles.inputLabel}>Attendance Status</Text>
              <View style={styles.chipRow}>
                {ATTENDANCE_STATUSES.map((st) => (
                  <TouchableOpacity
                    key={st}
                    style={[
                      styles.choiceChip,
                      attendanceForm.status === st && styles.choiceChipSelected,
                    ]}
                    onPress={() => setAttendanceForm({ ...attendanceForm, status: st })}
                  >
                    <Text
                      style={[
                        styles.choiceChipText,
                        attendanceForm.status === st && styles.choiceChipTextSelected,
                      ]}
                    >
                      {st}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Remarks</Text>
              <TextInput
                style={styles.input}
                value={attendanceForm.remarks}
                onChangeText={(t) => setAttendanceForm({ ...attendanceForm, remarks: t })}
                placeholder="Optional remarks"
              />
            </ScrollView>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setAttendanceModal(false)}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryNavyButton}
                onPress={() => handleSaveAttendance(false)}
              >
                <Text style={styles.primaryNavyButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={feeModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>
              {feeForm.id ? 'EDIT FEE TRANSACTION' : 'RECORD FEE'}
            </Text>
            <ScrollView style={{ maxHeight: 420 }}>
              <Text style={styles.inputLabel}>Select Student *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {activeStudents.map((st) => (
                    <TouchableOpacity
                      key={st.id}
                      style={[
                        styles.choiceChip,
                        feeForm.studentId === st.id && styles.choiceChipSelected,
                      ]}
                      onPress={() => setFeeForm({ ...feeForm, studentId: st.id })}
                    >
                      <Text
                        style={[
                          styles.choiceChipText,
                          feeForm.studentId === st.id && styles.choiceChipTextSelected,
                        ]}
                      >
                        {st.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Text style={styles.inputLabel}>Fee Type</Text>
              <View style={styles.chipRow}>
                {FEE_TYPES.map((ft) => (
                  <TouchableOpacity
                    key={ft}
                    style={[
                      styles.choiceChip,
                      feeForm.feeType === ft && styles.choiceChipSelected,
                    ]}
                    onPress={() => setFeeForm({ ...feeForm, feeType: ft })}
                  >
                    <Text
                      style={[
                        styles.choiceChipText,
                        feeForm.feeType === ft && styles.choiceChipTextSelected,
                      ]}
                    >
                      {ft}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {feeForm.feeType === 'Monthly Fee' && (
                <>
                  <Text style={styles.inputLabel}>Month Paid For * (Required for Monthly Fee)</Text>
                  <TextInput
                    style={styles.input}
                    value={feeForm.monthPaidFor}
                    onChangeText={(t) => setFeeForm({ ...feeForm, monthPaidFor: t })}
                    placeholder="e.g., October 2026"
                  />
                </>
              )}

              <Text style={styles.inputLabel}>Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={feeForm.date}
                onChangeText={(t) => setFeeForm({ ...feeForm, date: t })}
              />

              <Text style={styles.inputLabel}>Payment Mode</Text>
              <View style={styles.chipRow}>
                {PAYMENT_MODES.map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.choiceChip,
                      feeForm.mode === m && styles.choiceChipSelected,
                    ]}
                    onPress={() => setFeeForm({ ...feeForm, mode: m })}
                  >
                    <Text
                      style={[
                        styles.choiceChipText,
                        feeForm.mode === m && styles.choiceChipTextSelected,
                      ]}
                    >
                      {m}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Fee Status</Text>
              <View style={styles.chipRow}>
                {FEE_STATUSES.map((st) => (
                  <TouchableOpacity
                    key={st}
                    style={[
                      styles.choiceChip,
                      feeForm.status === st && styles.choiceChipSelected,
                    ]}
                    onPress={() => {
                      if (st === 'Unpaid') {
                        setFeeForm({ ...feeForm, status: st, amountPaid: '0' });
                      } else if (st === 'Paid') {
                        setFeeForm({ ...feeForm, status: st, balanceDue: '0' });
                      } else {
                        setFeeForm({ ...feeForm, status: st });
                      }
                    }}
                  >
                    <Text
                      style={[
                        styles.choiceChipText,
                        feeForm.status === st && styles.choiceChipTextSelected,
                      ]}
                    >
                      {st}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>
                Amount Paid (₹) {feeForm.status === 'Unpaid' ? '(Auto-locked to 0)' : '*'}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  feeForm.status === 'Unpaid' && { backgroundColor: '#E5E5E5', color: COLORS.silver },
                ]}
                editable={feeForm.status !== 'Unpaid'}
                keyboardType="numeric"
                value={feeForm.status === 'Unpaid' ? '0' : feeForm.amountPaid}
                onChangeText={(t) => setFeeForm({ ...feeForm, amountPaid: t })}
                placeholder="0"
              />

              <Text style={styles.inputLabel}>
                Balance Due (₹) {feeForm.status === 'Paid' ? '(Auto-locked to 0)' : '*'}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  feeForm.status === 'Paid' && { backgroundColor: '#E5E5E5', color: COLORS.silver },
                ]}
                editable={feeForm.status !== 'Paid'}
                keyboardType="numeric"
                value={feeForm.status === 'Paid' ? '0' : feeForm.balanceDue}
                onChangeText={(t) => setFeeForm({ ...feeForm, balanceDue: t })}
                placeholder="0"
              />

              <Text style={styles.inputLabel}>Remarks</Text>
              <TextInput
                style={styles.input}
                value={feeForm.remarks}
                onChangeText={(t) => setFeeForm({ ...feeForm, remarks: t })}
                placeholder="Optional receipt notes"
              />
            </ScrollView>

            <View style={[styles.modalBtnRow, { flexWrap: 'wrap', gap: 8 }]}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setFeeModal(false)}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryNavyButton}
                onPress={() => handleSaveFee(false)}
              >
                <Text style={styles.primaryNavyButtonText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.goldAccentButton}
                onPress={() => handleSaveFee(true)}
              >
                <Text style={styles.goldAccentButtonText}>Save & Share Receipt</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.ivory },
  topHeader: {
    backgroundColor: COLORS.navy,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 2,
    borderBottomColor: COLORS.gold,
  },
  hamburgerBtn: { padding: 4 },
  headerTitle: { color: COLORS.white, fontSize: 16, fontWeight: '700', letterSpacing: 2 },
  headerCrest: { color: COLORS.gold, fontSize: 10, letterSpacing: 3, fontWeight: '600', marginTop: 2 },
  scrollContent: { padding: 16, paddingBottom: 36 },
  heroCard: {
    backgroundColor: COLORS.navy,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1.5,
    borderColor: COLORS.gold,
    marginBottom: 16,
  },
  crestBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(212, 185, 120, 0.16)',
    borderColor: COLORS.gold,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 10,
  },
  crestBadgeText: { color: COLORS.gold, fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  heroGreeting: { color: COLORS.white, fontSize: 22, fontWeight: '700' },
  heroDate: { color: COLORS.cream, fontSize: 13, marginTop: 4 },
  heroDivider: { height: 1, backgroundColor: COLORS.gold, opacity: 0.35, marginVertical: 14 },
  heroStatRow: { flexDirection: 'row', justifyContent: 'space-between' },
  heroStatLabel: { color: COLORS.silver, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  heroStatValue: { color: COLORS.gold, fontSize: 18, fontWeight: '700', marginTop: 2 },
  creamCard: {
    backgroundColor: COLORS.cream,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  whiteCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E6E1D6',
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { color: COLORS.navy, fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  silverMeta: { color: COLORS.silver, fontSize: 12 },
  noticePreviewText: { color: COLORS.charcoal, fontSize: 14, lineHeight: 20, marginVertical: 6 },
  noticeFullText: { color: COLORS.charcoal, fontSize: 15, lineHeight: 22 },
  noticeActionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  bentoRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  bentoCard: { flex: 1, borderRadius: 14, padding: 18, justifyContent: 'space-between', minHeight: 115 },
  bentoTitleGold: { color: COLORS.gold, fontSize: 16, fontWeight: '700', marginTop: 10 },
  bentoSubCream: { color: COLORS.cream, fontSize: 12, marginTop: 2 },
  bentoTitleNavy: { color: COLORS.navy, fontSize: 16, fontWeight: '700', marginTop: 10 },
  bentoSubSilver: { color: COLORS.silver, fontSize: 12, marginTop: 2 },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0ECE1',
    gap: 10,
  },
  activityDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.gold },
  activityTitle: { color: COLORS.navy, fontSize: 14, fontWeight: '600' },
  activitySub: { color: COLORS.silver, fontSize: 12 },
  pillGoldBtn: {
    backgroundColor: COLORS.navy,
    borderColor: COLORS.gold,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
  },
  pillGoldBtnText: { color: COLORS.gold, fontSize: 11, fontWeight: '700' },
  tabTopBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10 },
  pageHeading: { color: COLORS.navy, fontSize: 20, fontWeight: '800' },
  groupBlock: { marginBottom: 18 },
  groupHeaderBar: {
    backgroundColor: COLORS.navy,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.gold,
  },
  groupHeaderTitle: { color: COLORS.gold, fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  groupHeaderCount: { color: COLORS.cream, fontSize: 12, fontWeight: '700' },
  monthSubHeader: { color: COLORS.navy, fontSize: 13, fontWeight: '700', marginVertical: 6, paddingLeft: 4 },
  cleanRecordCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E6E1D6',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  cardPressed: { backgroundColor: COLORS.cream },
  recordPrimaryTitle: { color: COLORS.navy, fontSize: 15, fontWeight: '700' },
  recordSecondarySub: { color: COLORS.silver, fontSize: 12, marginTop: 3 },
  recordDetailLine: { color: COLORS.charcoal, fontSize: 13, marginTop: 4 },
  boldLabel: { fontWeight: '700', color: COLORS.navy },
  priorityBadge: {
    backgroundColor: COLORS.navy,
    borderColor: COLORS.gold,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  priorityBadgeText: { color: COLORS.gold, fontSize: 10, fontWeight: '800' },
  feeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  feeBadgePaid: { backgroundColor: '#E6F4EA' },
  feeBadgeDue: { backgroundColor: '#FDE8E8' },
  feeBadgeNeutral: { backgroundColor: COLORS.cream },
  feeBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.navy },
  statusPill: {
    backgroundColor: COLORS.cream,
    borderColor: COLORS.gold,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusPillText: { color: COLORS.navy, fontSize: 11, fontWeight: '700' },
  backButtonRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  backButtonText: { color: COLORS.navy, fontSize: 14, fontWeight: '700' },
  profileStatsGrid: { flexDirection: 'row', gap: 8, marginTop: 16 },
  profileStatBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(212, 185, 120, 0.4)',
    alignItems: 'center',
  },
  profileStatLabel: { color: COLORS.cream, fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },
  profileStatVal: { color: COLORS.gold, fontSize: 16, fontWeight: '800', marginTop: 4 },
  pillNavContainer: { flexDirection: 'row', backgroundColor: COLORS.cream, borderRadius: 12, padding: 4, marginBottom: 16 },
  pillNavItem: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 9 },
  pillNavItemActive: { backgroundColor: COLORS.navy },
  pillNavText: { color: COLORS.navy, fontSize: 12, fontWeight: '700' },
  pillNavTextActive: { color: COLORS.gold },
  inputLabel: { color: COLORS.navy, fontSize: 12, fontWeight: '700', marginTop: 8, marginBottom: 4 },
  input: {
    backgroundColor: COLORS.ivory,
    borderWidth: 1,
    borderColor: '#D8D2C5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.charcoal,
    marginBottom: 6,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 6 },
  choiceChip: {
    backgroundColor: COLORS.cream,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D8D2C5',
  },
  choiceChipSelected: { backgroundColor: COLORS.navy, borderColor: COLORS.gold },
  choiceChipText: { color: COLORS.navy, fontSize: 12, fontWeight: '600' },
  choiceChipTextSelected: { color: COLORS.gold, fontWeight: '700' },
  prioritySwitchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  pdfShareBtn: {
    backgroundColor: COLORS.navy,
    borderColor: COLORS.gold,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  pdfShareBtnText: { color: COLORS.gold, fontSize: 11, fontWeight: '700' },
  primaryNavyButton: {
    backgroundColor: COLORS.navy,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryNavyButtonText: { color: COLORS.gold, fontSize: 13, fontWeight: '700' },
  goldAccentButton: {
    backgroundColor: COLORS.gold,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goldAccentButtonText: { color: COLORS.navy, fontSize: 13, fontWeight: '800' },
  secondaryButton: {
    backgroundColor: COLORS.cream,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: COLORS.silver,
  },
  secondaryButtonText: { color: COLORS.navy, fontSize: 13, fontWeight: '700' },
  dangerButton: { backgroundColor: COLORS.danger, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 9 },
  dangerButtonText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },
  daysRemainingBadge: {
    backgroundColor: COLORS.cream,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  daysRemainingText: { color: COLORS.navy, fontSize: 11, fontWeight: '700' },
  emptyText: { color: COLORS.silver, fontSize: 13, textAlign: 'center', paddingVertical: 16 },
  emptyGroupText: { color: COLORS.silver, fontSize: 12, fontStyle: 'italic', paddingLeft: 8, paddingTop: 6 },
  bottomTabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.navy,
    borderTopWidth: 2,
    borderTopColor: COLORS.gold,
    paddingVertical: 8,
  },
  bottomTabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bottomTabLabel: { color: COLORS.silver, fontSize: 10, marginTop: 3, fontWeight: '600' },
  bottomTabLabelActive: { color: COLORS.gold, fontWeight: '800' },
  trashTabBadge: {
    position: 'absolute',
    right: -10,
    top: -4,
    backgroundColor: COLORS.gold,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trashTabBadgeText: { color: COLORS.navy, fontSize: 10, fontWeight: '800' },
  drawerOverlay: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(12, 45, 87, 0.55)' },
  drawerContainer: {
    width: 280,
    backgroundColor: COLORS.ivory,
    height: '100%',
    borderRightWidth: 2,
    borderRightColor: COLORS.gold,
  },
  drawerHeader: {
    backgroundColor: COLORS.navy,
    padding: 22,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.gold,
  },
  drawerTitle: { color: COLORS.white, fontSize: 18, fontWeight: '800', marginTop: 6 },
  drawerSub: { color: COLORS.cream, fontSize: 12, marginTop: 2 },
  drawerNavItem: { paddingVertical: 12, paddingHorizontal: 12, borderRadius: 8, backgroundColor: COLORS.cream },
  drawerNavText: { color: COLORS.navy, fontSize: 14, fontWeight: '700' },
  drawerDivider: { height: 1, backgroundColor: '#D8D2C5', marginVertical: 8 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(12, 45, 87, 0.6)', justifyContent: 'center', padding: 18 },
  modalCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 20, borderWidth: 2, borderColor: COLORS.gold },
  modalBtnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 },
  contextSheet: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: COLORS.gold,
    alignItems: 'center',
  },
  contextSheetHeader: { color: COLORS.navy, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  contextDivider: { height: 1, backgroundColor: COLORS.cream, width: '100%', marginVertical: 12 },
  contextOptionBtn: { width: '100%', paddingVertical: 12, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F2EFE9' },
  contextOptionText: { color: COLORS.navy, fontSize: 15, fontWeight: '700' },
});
