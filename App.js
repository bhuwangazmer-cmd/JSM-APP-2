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
  Easing,
  LayoutAnimation,
  Platform,
  UIManager,
  StatusBar,
  Switch,
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
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
  navyLight: '#163E73',
  gold: '#D4B978',
  goldLight: 'rgba(212, 185, 120, 0.18)',
  cream: '#EFE7D3',
  silver: '#8E9399',
  ivory: '#FAF8F5',
  white: '#FFFFFF',
  danger: '#9E2A2B',
  dangerBg: '#FDE8E8',
  success: '#2D6A4F',
  successBg: '#E6F4EA',
  warning: '#B45309',
  warningBg: '#FEF3C7',
  charcoal: '#1D242B',
  border: '#E6E1D6',
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
// 3. LOCAL TIMEZONE DATE & STRING UTILITIES
// ==========================================
const getOffsetDateISO = (daysOffset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getTodayISO = () => getOffsetDateISO(0);
const getYesterdayISO = () => getOffsetDateISO(-1);

const normalizeISODate = (rawStr) => {
  if (!rawStr || typeof rawStr !== 'string') return null;
  const trimmed = rawStr.trim();
  const match = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const checkDate = new Date(year, month - 1, day);
  if (
    checkDate.getFullYear() !== year ||
    checkDate.getMonth() !== month - 1 ||
    checkDate.getDate() !== day
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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
  const normalized = normalizeISODate(isoDateStr) || isoDateStr;
  const parts = normalized.split('-');
  if (parts.length !== 3) return isoDateStr;
  const year = parseInt(parts[0], 10);
  const monthIndex = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(monthIndex) || isNaN(day) || !MONTHS_SHORT[monthIndex]) {
    return isoDateStr;
  }
  return `${day} ${MONTHS_SHORT[monthIndex]} ${year}`;
};

const getMonthYearFromISO = (isoDateStr) => {
  const normalized = normalizeISODate(isoDateStr) || isoDateStr;
  if (!normalized || typeof normalized !== 'string') return 'Unknown Month';
  const parts = normalized.split('-');
  if (parts.length < 2) return 'Unknown Month';
  const year = parseInt(parts[0], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;
  if (isNaN(year) || isNaN(monthIdx) || monthIdx < 0 || monthIdx > 11) return 'Unknown Month';
  return `${MONTHS_FULL[monthIdx]} ${year}`;
};

const isWithinLastTwoLocalMonths = (isoDateStr) => {
  const normalized = normalizeISODate(isoDateStr) || isoDateStr;
  if (!normalized) return false;
  const parts = normalized.split('-');
  if (parts.length < 2) return false;
  const recordYear = parseInt(parts[0], 10);
  const recordMonth = parseInt(parts[1], 10) - 1;
  if (isNaN(recordYear) || isNaN(recordMonth)) return false;
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

const escapeHtml = (unsafe) => {
  return String(unsafe ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const sanitizeCurrency = (val) => {
  const cleaned = String(val ?? '').replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length <= 1) return cleaned;
  return `${parts[0]}.${parts.slice(1).join('').slice(0, 2)}`;
};

// ==========================================
// 4. ANIMATED ENTRANCE SCREEN WRAPPER
// ==========================================
const AnimatedScreen = ({ children, triggerKey }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(14);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [triggerKey, fadeAnim, slideAnim]);

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

const QuickDateRow = ({ currentDate, onSelectDate }) => {
  const today = getTodayISO();
  const yesterday = getYesterdayISO();
  return (
    <View style={styles.quickDateRow}>
      <TouchableOpacity
        style={[styles.quickDateChip, currentDate === today && styles.quickDateChipActive]}
        onPress={() => onSelectDate(today)}
      >
        <Text style={[styles.quickDateChipText, currentDate === today && styles.quickDateChipTextActive]}>
          Today ({today})
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.quickDateChip, currentDate === yesterday && styles.quickDateChipActive]}
        onPress={() => onSelectDate(yesterday)}
      >
        <Text style={[styles.quickDateChipText, currentDate === yesterday && styles.quickDateChipTextActive]}>
          Yesterday
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// ==========================================
// 5. MAIN APPLICATION COMPONENT
// ==========================================
export default function App() {
  const [activeTab, setActiveTab] = useState('Home');
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [profileTab, setProfileTab] = useState('Classes');

  // Animated Drawer State
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerSlideAnim = useRef(new Animated.Value(-290)).current;

  const openDrawer = () => {
    setDrawerOpen(true);
    drawerSlideAnim.setValue(-290);
    Animated.timing(drawerSlideAnim, {
      toValue: 0,
      duration: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const closeDrawer = (callback) => {
    Animated.timing(drawerSlideAnim, {
      toValue: -290,
      duration: 200,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setDrawerOpen(false);
      if (typeof callback === 'function') callback();
    });
  };

  // Firestore Collections
  const [subjects, setSubjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [fees, setFees] = useState([]);
  const [activities, setActivities] = useState([]);
  const [noticeText, setNoticeText] = useState('');
  const [noticeUpdatedAt, setNoticeUpdatedAt] = useState('');

  // Search & Directory Filters
  const [studentSearch, setStudentSearch] = useState('');
  const [studentFilter, setStudentFilter] = useState('All'); // 'All' | 'Due' | 'Priority'

  // Long-Press Context Menu
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    entityType: null,
    item: null,
    title: '',
    reopenSubjectsModal: false,
  });

  // Modals & Forms
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

  // Separate Inline Profile Forms vs Modal Edit Forms
  const [inlineLessonForm, setInlineLessonForm] = useState({
    date: getTodayISO(),
    technique: '',
    repertoire: '',
    assignment: '',
  });

  const [lessonEditModal, setLessonEditModal] = useState(false);
  const [lessonEditForm, setLessonEditForm] = useState({
    id: null,
    studentId: '',
    date: getTodayISO(),
    technique: '',
    repertoire: '',
    assignment: '',
  });

  const [inlineAttendanceForm, setInlineAttendanceForm] = useState({
    date: getTodayISO(),
    status: 'Present',
    remarks: '',
  });

  const [attendanceModal, setAttendanceModal] = useState(false);
  const [attendanceFilterAllMonths, setAttendanceFilterAllMonths] = useState(false);
  const [attendanceModalForm, setAttendanceModalForm] = useState({
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
  const [checkingOTA, setCheckingOTA] = useState(false);

  // ==========================================
  // 6. FIRESTORE LISTENERS & 30-DAY AUTO-PURGE
  // ==========================================
  const initialLoadDone = useRef(false);

  useEffect(() => {
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const timer = setTimeout(() => {
      initialLoadDone.current = true;
    }, 1200);

    const handleSnapshotWithAutoPurge = (colName, snapshot, setter) => {
      const records = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (
          data.isDeleted &&
          data.deletedAt &&
          Date.now() - Number(data.deletedAt) > THIRTY_DAYS_MS
        ) {
          deleteDoc(doc(db, colName, docSnap.id)).catch(() => {});
        } else {
          records.push({ id: docSnap.id, ...data });
        }
      });
      if (initialLoadDone.current) {
        triggerLayoutAnimation();
      }
      setter(records);
    };

    const unsubSubjects = onSnapshot(
      collection(db, 'subjects'),
      (snap) => handleSnapshotWithAutoPurge('subjects', snap, setSubjects),
      () => {}
    );
    const unsubStudents = onSnapshot(
      collection(db, 'students'),
      (snap) => handleSnapshotWithAutoPurge('students', snap, setStudents),
      () => {}
    );
    const unsubLessons = onSnapshot(
      collection(db, 'lessons'),
      (snap) => handleSnapshotWithAutoPurge('lessons', snap, setLessons),
      () => {}
    );
    const unsubAttendance = onSnapshot(
      collection(db, 'attendance'),
      (snap) => handleSnapshotWithAutoPurge('attendance', snap, setAttendance),
      () => {}
    );
    const unsubFees = onSnapshot(
      collection(db, 'fees'),
      (snap) => handleSnapshotWithAutoPurge('fees', snap, setFees),
      () => {}
    );
    const unsubActivities = onSnapshot(
      collection(db, 'activities'),
      (snap) => {
        const list = [];
        snap.forEach((d) => {
          const data = d.data();
          if (data.timestamp && Date.now() - Number(data.timestamp) > THIRTY_DAYS_MS) {
            deleteDoc(doc(db, 'activities', d.id)).catch(() => {});
          } else {
            list.push({ id: d.id, ...data });
          }
        });
        list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setActivities(list);
      },
      () => {}
    );
    const unsubNotice = onSnapshot(
      doc(db, 'settings', 'noticeBoard'),
      (docSnap) => {
        if (docSnap.exists()) {
          const d = docSnap.data();
          setNoticeText(d.text || '');
          setNoticeUpdatedAt(d.updatedDate || '');
        }
      },
      () => {}
    );

    return () => {
      clearTimeout(timer);
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
    () =>
      lessons
        .filter((l) => !l.isDeleted && studentMap[l.studentId] && !studentMap[l.studentId].isDeleted)
        .sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [lessons, studentMap]
  );

  const activeAttendance = useMemo(
    () =>
      attendance
        .filter((a) => !a.isDeleted && studentMap[a.studentId] && !studentMap[a.studentId].isDeleted)
        .sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [attendance, studentMap]
  );

  const activeFees = useMemo(
    () =>
      fees
        .filter((f) => !f.isDeleted && studentMap[f.studentId] && !studentMap[f.studentId].isDeleted)
        .sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [fees, studentMap]
  );

  const globalFeeTotals = useMemo(() => {
    let collected = 0;
    let pending = 0;
    activeFees.forEach((f) => {
      collected += Number(f.amountPaid || 0);
      pending += Number(f.balanceDue || 0);
    });
    return { collected, pending };
  }, [activeFees]);

  const trashItems = useMemo(() => {
    const allDeleted = [
      ...subjects
        .filter((x) => x.isDeleted)
        .map((x) => ({ ...x, _col: 'subjects', _label: `Subject: ${x.name}` })),
      ...students
        .filter((x) => x.isDeleted)
        .map((x) => ({ ...x, _col: 'students', _label: `Student: ${x.name}` })),
      ...lessons
        .filter((x) => x.isDeleted)
        .map((x) => ({
          ...x,
          _col: 'lessons',
          _label: `Lesson: ${studentMap[x.studentId]?.name || 'Student'} (${formatReadableLocalDate(x.date)})`,
        })),
      ...attendance
        .filter((x) => x.isDeleted)
        .map((x) => ({
          ...x,
          _col: 'attendance',
          _label: `Attendance: ${studentMap[x.studentId]?.name || 'Student'} - ${x.status} (${formatReadableLocalDate(x.date)})`,
        })),
      ...fees
        .filter((x) => x.isDeleted)
        .map((x) => ({
          ...x,
          _col: 'fees',
          _label: `Fee: ${studentMap[x.studentId]?.name || 'Student'} - ₹${x.amountPaid} (${formatReadableLocalDate(x.date)})`,
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
  }, [selectedStudentId, selectedStudent]);

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
      let totalDue = 0;
      if (stFees.length > 0) {
        stFees.forEach((f) => {
          totalDue += Number(f.balanceDue || 0);
        });
        const hasUnpaidOrBalance = stFees.some(
          (f) =>
            f.status === 'Unpaid' ||
            f.status === 'Partial' ||
            Number(f.balanceDue || 0) > 0
        );
        feeStatus = hasUnpaidOrBalance ? 'Due / Unpaid' : 'Paid';
      }

      return {
        classesTaken: stLessons.length,
        attendancePct,
        feeStatus,
        totalDue,
        stLessons,
        stAttendance,
        stFees,
      };
    },
    [activeLessons, activeAttendance, activeFees]
  );

  // ==========================================
  // 9. OTA UPDATES, CALL/WHATSAPP & PDF RECEIPT
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

  const handlePhoneCall = (phoneStr) => {
    const cleaned = String(phoneStr || '').replace(/[^\d+]/g, '');
    if (!cleaned) return;
    Linking.openURL(`tel:${cleaned}`).catch(() =>
      Alert.alert('Action Unavailable', 'Could not open phone dialer.')
    );
  };

  const handleOpenWhatsApp = (phoneStr, studentName) => {
    const digits = String(phoneStr || '').replace(/[^\d]/g, '');
    if (!digits) return;
    const formatted = digits.length === 10 ? `91${digits}` : digits;
    const text = encodeURIComponent(`Hello from JSM APP regarding ${studentName || 'your music classes'}.`);
    Linking.openURL(`https://wa.me/${formatted}?text=${text}`).catch(() =>
      Alert.alert('WhatsApp Unavailable', 'Could not open WhatsApp.')
    );
  };

  const generateAndShareReceiptPDF = async (feeRecord) => {
    const st = studentMap[feeRecord.studentId];
    const studentName = escapeHtml(st?.name || 'JSM Student');
    const subjectName = escapeHtml(subjectMap[st?.subjectId]?.name || 'Music Studies');
    const feeType = escapeHtml(feeRecord.feeType || 'Tuition Fee');
    const monthPaidFor = escapeHtml(feeRecord.monthPaidFor || '-');
    const paymentMode = escapeHtml(feeRecord.mode || 'UPI');
    const status = escapeHtml(feeRecord.status || 'Paid');
    const remarks = escapeHtml(feeRecord.remarks || '');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: 'Georgia', serif; background: #FAF8F5; padding: 32px; color: #0C2D57; }
            .card { background: #0C2D57; color: #FAF8F5; border: 3px solid #D4B978; border-radius: 14px; padding: 32px; }
            .crest { color: #D4B978; text-align: center; letter-spacing: 3px; font-size: 12px; font-weight: bold; }
            .title { text-align: center; font-size: 26px; margin: 8px 0 4px; color: #FFFFFF; letter-spacing: 1px; }
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
            <div class="subtitle">OFFICIAL TUITION &amp; FEE RECEIPT</div>
            <div class="divider"></div>
            <div class="row"><span class="label">Student Name:</span><span class="val">${studentName}</span></div>
            <div class="row"><span class="label">Instrument / Subject:</span><span class="val">${subjectName}</span></div>
            <div class="row"><span class="label">Date of Transaction:</span><span class="val">${formatReadableLocalDate(feeRecord.date)}</span></div>
            <div class="row"><span class="label">Fee Category:</span><span class="val">${feeType}</span></div>
            ${
              feeRecord.feeType === 'Monthly Fee'
                ? `<div class="row"><span class="label">Month Paid For:</span><span class="val">${monthPaidFor}</span></div>`
                : ''
            }
            <div class="row"><span class="label">Payment Mode:</span><span class="val">${paymentMode}</span></div>
            <div class="row"><span class="label">Payment Status:</span><span class="val">${status}</span></div>
            <div class="total-box">
              <div class="row"><span class="label">Amount Paid:</span><span class="val">₹${Number(feeRecord.amountPaid || 0).toFixed(2)}</span></div>
              <div class="row"><span class="label">Balance Due:</span><span class="val">₹${Number(feeRecord.balanceDue || 0).toFixed(2)}</span></div>
            </div>
            ${
              remarks
                ? `<div class="row" style="margin-top:16px;"><span class="label">Remarks:</span><span class="val">${remarks}</span></div>`
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
          dialogTitle: `Share Receipt - ${st?.name || 'Student'}`,
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
  const openLongPressMenu = (entityType, item, title, reopenSubjectsModal = false) => {
    setContextMenu({
      visible: true,
      entityType,
      item,
      title,
      reopenSubjectsModal,
    });
  };

  const closeContextMenu = () => {
    setContextMenu({
      visible: false,
      entityType: null,
      item: null,
      title: '',
      reopenSubjectsModal: false,
    });
  };

  const handleSoftDelete = async (collectionName, item, label) => {
    try {
      triggerLayoutAnimation();
      await updateDoc(doc(db, collectionName, item.id), {
        isDeleted: true,
        deletedAt: Date.now(),
      });
      await logActivity('Moved to Trash', label);
      if (collectionName === 'students' && selectedStudentId === item.id) {
        setSelectedStudentId(null);
      }
    } catch (e) {
      Alert.alert('Error', 'Unable to move item to Trash.');
    }
  };

  const handleMoveSubjectOrder = async (subjectItem, direction) => {
    try {
      const idx = activeSubjects.findIndex((s) => s.id === subjectItem.id);
      const targetIdx = direction === 'moveUp' ? idx - 1 : idx + 1;
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
      await logActivity(
        'Reordered Subject',
        `${subjectItem.name} moved ${direction === 'moveUp' ? 'up' : 'down'}`
      );
    } catch (e) {
      Alert.alert('Error', 'Could not reorder subject.');
    }
  };

  const handleContextAction = async (action) => {
    const { entityType, item, title, reopenSubjectsModal } = contextMenu;
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
      if (reopenSubjectsModal) setSubjectsModal(true);
      return;
    }

    if (action === 'moveUp' || action === 'moveDown') {
      if (entityType !== 'subject') return;
      await handleMoveSubjectOrder(item, action);
      if (reopenSubjectsModal) setSubjectsModal(true);
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
        setLessonEditForm({
          id: item.id,
          studentId: item.studentId,
          date: item.date || getTodayISO(),
          technique: item.technique || '',
          repertoire: item.repertoire || '',
          assignment: item.assignment || '',
        });
        setLessonEditModal(true);
      } else if (entityType === 'attendance') {
        setAttendanceModalForm({
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
    try {
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
    } catch (e) {
      Alert.alert('Error', 'Could not save subject.');
    }
  };

  const handleSaveStudent = async () => {
    if (!studentForm.name.trim() || !studentForm.subjectId) {
      Alert.alert('Validation', 'Student Name and Subject are required.');
      return;
    }
    const validDate = normalizeISODate(studentForm.joinedDate);
    if (!validDate) {
      Alert.alert('Validation', 'Please enter a valid enrollment date in YYYY-MM-DD format.');
      return;
    }
    try {
      triggerLayoutAnimation();
      const payload = {
        name: studentForm.name.trim(),
        subjectId: studentForm.subjectId,
        phone: studentForm.phone.trim(),
        guardian: studentForm.guardian.trim(),
        joinedDate: validDate,
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
        await logActivity(
          'Enrolled Student',
          `${payload.name} (${subjectMap[payload.subjectId]?.name || ''})`
        );
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
    } catch (e) {
      Alert.alert('Error', 'Could not save student record.');
    }
  };

  const handleSaveInlineLesson = async () => {
    if (!selectedStudentId) return;
    const validDate = normalizeISODate(inlineLessonForm.date);
    if (!validDate) {
      Alert.alert('Validation', 'Please enter a valid date in YYYY-MM-DD format.');
      return;
    }
    if (
      !inlineLessonForm.technique.trim() &&
      !inlineLessonForm.repertoire.trim() &&
      !inlineLessonForm.assignment.trim()
    ) {
      Alert.alert(
        'Validation',
        'Enter at least one lesson detail (Technique, Repertoire, or Assignment).'
      );
      return;
    }
    try {
      triggerLayoutAnimation();
      const payload = {
        studentId: selectedStudentId,
        date: validDate,
        technique: inlineLessonForm.technique.trim(),
        repertoire: inlineLessonForm.repertoire.trim(),
        assignment: inlineLessonForm.assignment.trim(),
        isDeleted: false,
        deletedAt: null,
      };
      await addDoc(collection(db, 'lessons'), payload);
      await logActivity(
        'Logged Lesson',
        `${studentMap[selectedStudentId]?.name || 'Student'} (${formatReadableLocalDate(validDate)})`
      );
      setInlineLessonForm({
        date: getTodayISO(),
        technique: '',
        repertoire: '',
        assignment: '',
      });
    } catch (e) {
      Alert.alert('Error', 'Could not log lesson.');
    }
  };

  const handleSaveEditedLesson = async () => {
    if (!lessonEditForm.id || !lessonEditForm.studentId) return;
    const validDate = normalizeISODate(lessonEditForm.date);
    if (!validDate) {
      Alert.alert('Validation', 'Please enter a valid date in YYYY-MM-DD format.');
      return;
    }
    if (
      !lessonEditForm.technique.trim() &&
      !lessonEditForm.repertoire.trim() &&
      !lessonEditForm.assignment.trim()
    ) {
      Alert.alert(
        'Validation',
        'Enter at least one lesson detail (Technique, Repertoire, or Assignment).'
      );
      return;
    }
    try {
      triggerLayoutAnimation();
      const payload = {
        studentId: lessonEditForm.studentId,
        date: validDate,
        technique: lessonEditForm.technique.trim(),
        repertoire: lessonEditForm.repertoire.trim(),
        assignment: lessonEditForm.assignment.trim(),
      };
      await updateDoc(doc(db, 'lessons', lessonEditForm.id), payload);
      await logActivity(
        'Updated Lesson',
        `${studentMap[lessonEditForm.studentId]?.name || 'Student'} (${formatReadableLocalDate(validDate)})`
      );
      setLessonEditModal(false);
    } catch (e) {
      Alert.alert('Error', 'Could not update lesson.');
    }
  };

  const handleSaveInlineAttendance = async () => {
    if (!selectedStudentId) return;
    const validDate = normalizeISODate(inlineAttendanceForm.date);
    if (!validDate) {
      Alert.alert('Validation', 'Please enter a valid date in YYYY-MM-DD format.');
      return;
    }
    try {
      triggerLayoutAnimation();
      const existingRecord = activeAttendance.find(
        (a) => a.studentId === selectedStudentId && a.date === validDate
      );

      if (existingRecord) {
        await updateDoc(doc(db, 'attendance', existingRecord.id), {
          status: inlineAttendanceForm.status,
          remarks: inlineAttendanceForm.remarks.trim(),
        });
        await logActivity(
          'Updated Attendance',
          `${studentMap[selectedStudentId]?.name || 'Student'} • ${inlineAttendanceForm.status}`
        );
      } else {
        const payload = {
          studentId: selectedStudentId,
          date: validDate,
          status: inlineAttendanceForm.status,
          remarks: inlineAttendanceForm.remarks.trim(),
          isDeleted: false,
          deletedAt: null,
        };
        await addDoc(collection(db, 'attendance'), payload);
        await logActivity(
          'Marked Attendance',
          `${studentMap[selectedStudentId]?.name || 'Student'} • ${payload.status}`
        );
      }

      setInlineAttendanceForm({
        date: getTodayISO(),
        status: 'Present',
        remarks: '',
      });
    } catch (e) {
      Alert.alert('Error', 'Could not save attendance.');
    }
  };

  const handleSaveModalAttendance = async () => {
    if (!attendanceModalForm.studentId) {
      Alert.alert('Validation', 'Please select a Student.');
      return;
    }
    const validDate = normalizeISODate(attendanceModalForm.date);
    if (!validDate) {
      Alert.alert('Validation', 'Please enter a valid date in YYYY-MM-DD format.');
      return;
    }
    try {
      triggerLayoutAnimation();
      const payload = {
        studentId: attendanceModalForm.studentId,
        date: validDate,
        status: attendanceModalForm.status,
        remarks: attendanceModalForm.remarks.trim(),
      };

      const duplicateRecord = activeAttendance.find(
        (a) =>
          a.studentId === payload.studentId &&
          a.date === validDate &&
          a.id !== attendanceModalForm.id
      );

      if (attendanceModalForm.id) {
        if (duplicateRecord) {
          Alert.alert(
            'Duplicate Date',
            'An attendance entry already exists for this student on that date.'
          );
          return;
        }
        await updateDoc(doc(db, 'attendance', attendanceModalForm.id), payload);
        await logActivity(
          'Updated Attendance',
          `${studentMap[payload.studentId]?.name || 'Student'} • ${payload.status}`
        );
      } else if (duplicateRecord) {
        await updateDoc(doc(db, 'attendance', duplicateRecord.id), payload);
        await logActivity(
          'Updated Attendance',
          `${studentMap[payload.studentId]?.name || 'Student'} • ${payload.status}`
        );
      } else {
        await addDoc(collection(db, 'attendance'), {
          ...payload,
          isDeleted: false,
          deletedAt: null,
        });
        await logActivity(
          'Marked Attendance',
          `${studentMap[payload.studentId]?.name || 'Student'} • ${payload.status}`
        );
      }
      setAttendanceModal(false);
    } catch (e) {
      Alert.alert('Error', 'Could not save attendance.');
    }
  };

  const handleSaveStudentNotes = async () => {
    if (!selectedStudentId) return;
    try {
      await updateDoc(doc(db, 'students', selectedStudentId), {
        notes: noteDraft,
        priorityNote: priorityDraft,
      });
      await logActivity('Updated Student Notes', studentMap[selectedStudentId]?.name || '');
      Alert.alert('Saved', 'Student notes updated.');
    } catch (e) {
      Alert.alert('Error', 'Could not update student notes.');
    }
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
    const validDate = normalizeISODate(feeForm.date);
    if (!validDate) {
      Alert.alert('Validation', 'Please enter a valid date in YYYY-MM-DD format.');
      return;
    }

    const numericPaid =
      feeForm.status === 'Unpaid' ? 0 : parseFloat(sanitizeCurrency(feeForm.amountPaid)) || 0;
    const numericBalance =
      feeForm.status === 'Paid' ? 0 : parseFloat(sanitizeCurrency(feeForm.balanceDue)) || 0;

    if (feeForm.status === 'Unpaid' && numericBalance <= 0) {
      Alert.alert('Validation', 'Unpaid records require a Balance Due greater than ₹0.');
      return;
    }
    if (feeForm.status === 'Paid' && numericPaid <= 0) {
      Alert.alert('Validation', 'Paid records require an Amount Paid greater than ₹0.');
      return;
    }
    if (feeForm.status === 'Partial' && (numericPaid <= 0 || numericBalance <= 0)) {
      Alert.alert(
        'Validation',
        'Partial payments require both Amount Paid and Balance Due to be greater than ₹0.'
      );
      return;
    }

    try {
      triggerLayoutAnimation();
      const payload = {
        studentId: feeForm.studentId,
        feeType: feeForm.feeType,
        monthPaidFor: feeForm.feeType === 'Monthly Fee' ? feeForm.monthPaidFor.trim() : '',
        date: validDate,
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
    } catch (e) {
      Alert.alert('Error', 'Could not save fee record.');
    }
  };

  const handleUpdateNotice = async () => {
    try {
      const today = getTodayISO();
      await setDoc(doc(db, 'settings', 'noticeBoard'), {
        text: noticeInput.trim(),
        updatedDate: today,
      });
      await logActivity('Updated Notice Board', formatReadableLocalDate(today));
      setNoticeEditModal(false);
    } catch (e) {
      Alert.alert('Error', 'Could not update notice board.');
    }
  };

  const handleRestoreTrashItem = async (item) => {
    try {
      triggerLayoutAnimation();
      await updateDoc(doc(db, item._col, item.id), {
        isDeleted: false,
        deletedAt: null,
      });
      await logActivity('Restored from Trash', item._label);
    } catch (e) {
      Alert.alert('Error', 'Could not restore item.');
    }
  };

  const handlePermanentDeleteItem = async (item) => {
    try {
      triggerLayoutAnimation();
      const batch = writeBatch(db);
      batch.delete(doc(db, item._col, item.id));

      if (item._col === 'students') {
        lessons
          .filter((l) => l.studentId === item.id)
          .forEach((l) => batch.delete(doc(db, 'lessons', l.id)));
        attendance
          .filter((a) => a.studentId === item.id)
          .forEach((a) => batch.delete(doc(db, 'attendance', a.id)));
        fees
          .filter((f) => f.studentId === item.id)
          .forEach((f) => batch.delete(doc(db, 'fees', f.id)));
      }

      await batch.commit();
      await logActivity('Permanently Deleted', item._label);
    } catch (e) {
      Alert.alert('Error', 'Could not delete item.');
    }
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
            try {
              triggerLayoutAnimation();
              const batch = writeBatch(db);
              const deletedStudentIds = new Set(
                trashItems.filter((i) => i._col === 'students').map((i) => i.id)
              );

              const docsToDelete = new Map();
              trashItems.forEach((item) => {
                docsToDelete.set(`${item._col}/${item.id}`, { col: item._col, id: item.id });
              });

              if (deletedStudentIds.size > 0) {
                lessons
                  .filter((l) => deletedStudentIds.has(l.studentId))
                  .forEach((l) => docsToDelete.set(`lessons/${l.id}`, { col: 'lessons', id: l.id }));
                attendance
                  .filter((a) => deletedStudentIds.has(a.studentId))
                  .forEach((a) =>
                    docsToDelete.set(`attendance/${a.id}`, { col: 'attendance', id: a.id })
                  );
                fees
                  .filter((f) => deletedStudentIds.has(f.studentId))
                  .forEach((f) => docsToDelete.set(`fees/${f.id}`, { col: 'fees', id: f.id }));
              }

              Array.from(docsToDelete.values())
                .slice(0, 450)
                .forEach((entry) => {
                  batch.delete(doc(db, entry.col, entry.id));
                });

              await batch.commit();
              await logActivity('Emptied Trash Archive', `${trashItems.length} items removed`);
            } catch (e) {
              Alert.alert('Error', 'Failed to empty trash.');
            }
          },
        },
      ]
    );
  };

  // Includes fallback grouping so records with deleted/unassigned subjects never vanish
  const groupRecordsBySubjectAndMonth = useCallback(
    (records) => {
      const grouped = [];
      const activeSubjectIds = new Set(activeSubjects.map((s) => s.id));

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

      const unassignedRecords = records.filter(
        (r) => !activeSubjectIds.has(studentMap[r.studentId]?.subjectId)
      );
      if (unassignedRecords.length > 0) {
        const monthsMap = {};
        unassignedRecords.forEach((rec) => {
          const mLabel = getMonthYearFromISO(rec.date);
          if (!monthsMap[mLabel]) monthsMap[mLabel] = [];
          monthsMap[mLabel].push(rec);
        });
        grouped.push({
          subject: { id: '_unassigned', name: 'Unassigned / Other' },
          months: Object.entries(monthsMap).map(([monthName, items]) => ({
            monthName,
            items,
          })),
        });
      }

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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="megaphone-outline" size={16} color={COLORS.navy} />
              <Text style={styles.sectionTitle}>JSM APP NOTICE BOARD</Text>
            </View>
            {noticeUpdatedAt ? (
              <Text style={styles.silverMeta}>{formatReadableLocalDate(noticeUpdatedAt)}</Text>
            ) : null}
          </View>
          <Text style={styles.noticePreviewText} numberOfLines={3}>
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
                setNoticeInput(noticeText);
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
            style={[
              styles.bentoCard,
              { backgroundColor: COLORS.cream, borderColor: COLORS.gold, borderWidth: 1.2 },
            ]}
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
              <Text style={styles.pillGoldBtnText}>Today's Log</Text>
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
                  {act.subtitle ? <Text style={styles.activitySub}>{act.subtitle}</Text> : null}
                </View>
                <Text style={styles.silverMeta}>{formatReadableLocalDate(act.dateISO)}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    );
  };

  const renderStudentCard = (st) => {
    const metrics = getStudentMetrics(st.id);
    return (
      <Pressable
        key={st.id}
        style={({ pressed }) => [styles.cleanRecordCard, pressed && styles.cardPressed]}
        onPress={() => {
          setSelectedStudentId(st.id);
          setProfileTab('Classes');
        }}
        onLongPress={() => openLongPressMenu('student', st, st.name)}
        delayLongPress={300}
      >
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
  };

  const renderStudentsTab = () => {
    if (selectedStudent) {
      return renderStudentProfile(selectedStudent);
    }

    const query = studentSearch.trim().toLowerCase();
    const filteredStudents = activeStudents.filter((st) => {
      const subjName = (subjectMap[st.subjectId]?.name || '').toLowerCase();
      const matchesQuery =
        !query ||
        (st.name || '').toLowerCase().includes(query) ||
        (st.phone || '').toLowerCase().includes(query) ||
        subjName.includes(query);

      if (!matchesQuery) return false;
      if (studentFilter === 'Priority') return Boolean(st.priorityNote);
      if (studentFilter === 'Due') {
        const m = getStudentMetrics(st.id);
        return m.feeStatus === 'Due / Unpaid';
      }
      return true;
    });

    const activeSubjectIds = new Set(activeSubjects.map((s) => s.id));
    const unassignedStudents = filteredStudents.filter(
      (st) => !activeSubjectIds.has(st.subjectId)
    );

    return (
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.tabTopBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pageHeading}>Student Directory</Text>
            <Text style={styles.silverMeta}>Tap to open profile • Hold card to edit/delete</Text>
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

        <View style={styles.searchBarContainer}>
          <Ionicons name="search" size={18} color={COLORS.silver} />
          <TextInput
            style={styles.searchInput}
            value={studentSearch}
            onChangeText={setStudentSearch}
            placeholder="Search student, instrument, or phone..."
            placeholderTextColor={COLORS.silver}
          />
          {studentSearch.length > 0 && (
            <TouchableOpacity onPress={() => setStudentSearch('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.silver} />
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.chipRow, { marginBottom: 14 }]}>
          {[
            { key: 'All', label: `All (${activeStudents.length})` },
            { key: 'Due', label: 'Due / Unpaid' },
            { key: 'Priority', label: '★ Priority Notes' },
          ].map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.choiceChip, studentFilter === f.key && styles.choiceChipSelected]}
              onPress={() => setStudentFilter(f.key)}
            >
              <Text
                style={[
                  styles.choiceChipText,
                  studentFilter === f.key && styles.choiceChipTextSelected,
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeSubjects.length === 0 && unassignedStudents.length === 0 ? (
          <View style={styles.whiteCard}>
            <Text style={styles.emptyText}>
              No subjects configured. Open "Manage Subjects" on the Home Dashboard to add instruments.
            </Text>
          </View>
        ) : (
          <>
            {activeSubjects.map((subj) => {
              const subjStudents = filteredStudents.filter((s) => s.subjectId === subj.id);
              if ((query || studentFilter !== 'All') && subjStudents.length === 0) return null;
              return (
                <View key={subj.id} style={styles.groupBlock}>
                  <View style={styles.groupHeaderBar}>
                    <Text style={styles.groupHeaderTitle}>{subj.name.toUpperCase()}</Text>
                    <Text style={styles.groupHeaderCount}>{subjStudents.length}</Text>
                  </View>
                  {subjStudents.length === 0 ? (
                    <Text style={styles.emptyGroupText}>No students enrolled in {subj.name}</Text>
                  ) : (
                    subjStudents.map(renderStudentCard)
                  )}
                </View>
              );
            })}

            {unassignedStudents.length > 0 && (
              <View style={styles.groupBlock}>
                <View style={styles.groupHeaderBar}>
                  <Text style={styles.groupHeaderTitle}>UNASSIGNED / OTHER</Text>
                  <Text style={styles.groupHeaderCount}>{unassignedStudents.length}</Text>
                </View>
                {unassignedStudents.map(renderStudentCard)}
              </View>
            )}
          </>
        )}
      </ScrollView>
    );
  };

  const renderStudentProfile = (student) => {
    const metrics = getStudentMetrics(student.id);
    const subjName = subjectMap[student.subjectId]?.name || 'Unassigned';

    return (
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.cardHeaderRow}>
          <TouchableOpacity
            style={styles.backButtonRow}
            onPress={() => setSelectedStudentId(null)}
          >
            <Ionicons name="arrow-back" size={18} color={COLORS.navy} />
            <Text style={styles.backButtonText}>Back to Directory</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButtonSmall}
            onPress={() => openLongPressMenu('student', student, student.name)}
          >
            <Ionicons name="create-outline" size={15} color={COLORS.navy} />
            <Text style={styles.secondaryButtonSmallText}>Edit Student</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.crestBadgeText}>{subjName.toUpperCase()} DEPARTMENT</Text>
              <Text style={styles.heroGreeting}>{student.name}</Text>
              {student.guardian ? (
                <Text style={styles.heroDate}>Guardian: {student.guardian}</Text>
              ) : null}
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

          {student.phone ? (
            <View style={styles.contactActionRow}>
              <TouchableOpacity
                style={styles.contactActionBtn}
                onPress={() => handlePhoneCall(student.phone)}
              >
                <Ionicons name="call-outline" size={15} color={COLORS.gold} />
                <Text style={styles.contactActionText}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.contactActionBtn}
                onPress={() => handleOpenWhatsApp(student.phone, student.name)}
              >
                <Ionicons name="logo-whatsapp" size={15} color={COLORS.gold} />
                <Text style={styles.contactActionText}>WhatsApp</Text>
              </TouchableOpacity>
            </View>
          ) : null}

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
                    color: metrics.feeStatus === 'Due / Unpaid' ? '#FFB4A2' : COLORS.gold,
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
                onPress={() => {
                  triggerLayoutAnimation();
                  setProfileTab(tab);
                }}
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
              <QuickDateRow
                currentDate={inlineLessonForm.date}
                onSelectDate={(d) => setInlineLessonForm({ ...inlineLessonForm, date: d })}
              />
              <TextInput
                style={styles.input}
                value={inlineLessonForm.date}
                onChangeText={(t) => setInlineLessonForm({ ...inlineLessonForm, date: t })}
                placeholder="YYYY-MM-DD"
              />
              <Text style={styles.inputLabel}>Technique</Text>
              <TextInput
                style={styles.input}
                value={inlineLessonForm.technique}
                onChangeText={(t) => setInlineLessonForm({ ...inlineLessonForm, technique: t })}
                placeholder="Scales, arpeggios, posture..."
              />
              <Text style={styles.inputLabel}>Repertoire</Text>
              <TextInput
                style={styles.input}
                value={inlineLessonForm.repertoire}
                onChangeText={(t) => setInlineLessonForm({ ...inlineLessonForm, repertoire: t })}
                placeholder="Sonatina in C, Etude Op. 10..."
              />
              <Text style={styles.inputLabel}>Assignment</Text>
              <TextInput
                style={styles.input}
                value={inlineLessonForm.assignment}
                onChangeText={(t) => setInlineLessonForm({ ...inlineLessonForm, assignment: t })}
                placeholder="Practice measures 16-32 at 80 BPM"
              />
              <TouchableOpacity
                style={[styles.primaryNavyButton, { marginTop: 10 }]}
                onPress={handleSaveInlineLesson}
              >
                <Text style={styles.primaryNavyButtonText}>Save Lesson Entry</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.sectionTitle, { marginVertical: 10 }]}>
              LESSON HISTORY (HOLD CARD TO EDIT/DELETE)
            </Text>
            {metrics.stLessons.length === 0 ? (
              <Text style={styles.emptyText}>No lessons logged for this student yet.</Text>
            ) : (
              metrics.stLessons.map((les) => (
                <Pressable
                  key={les.id}
                  style={({ pressed }) => [
                    styles.cleanRecordCard,
                    pressed && styles.cardPressed,
                  ]}
                  onLongPress={() =>
                    openLongPressMenu(
                      'lesson',
                      les,
                      `Lesson on ${formatReadableLocalDate(les.date)}`
                    )
                  }
                  delayLongPress={300}
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
              <QuickDateRow
                currentDate={inlineAttendanceForm.date}
                onSelectDate={(d) =>
                  setInlineAttendanceForm({ ...inlineAttendanceForm, date: d })
                }
              />
              <TextInput
                style={styles.input}
                value={inlineAttendanceForm.date}
                onChangeText={(t) =>
                  setInlineAttendanceForm({ ...inlineAttendanceForm, date: t })
                }
              />
              <Text style={styles.inputLabel}>Status</Text>
              <View style={styles.chipRow}>
                {ATTENDANCE_STATUSES.map((st) => (
                  <TouchableOpacity
                    key={st}
                    style={[
                      styles.choiceChip,
                      inlineAttendanceForm.status === st && styles.choiceChipSelected,
                    ]}
                    onPress={() =>
                      setInlineAttendanceForm({ ...inlineAttendanceForm, status: st })
                    }
                  >
                    <Text
                      style={[
                        styles.choiceChipText,
                        inlineAttendanceForm.status === st && styles.choiceChipTextSelected,
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
                value={inlineAttendanceForm.remarks}
                onChangeText={(t) =>
                  setInlineAttendanceForm({ ...inlineAttendanceForm, remarks: t })
                }
                placeholder="Optional attendance notes"
              />
              <TouchableOpacity
                style={[styles.primaryNavyButton, { marginTop: 10 }]}
                onPress={handleSaveInlineAttendance}
              >
                <Text style={styles.primaryNavyButtonText}>Record Attendance</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.sectionTitle, { marginVertical: 10 }]}>
              ATTENDANCE LOG (HOLD CARD TO EDIT/DELETE)
            </Text>
            {metrics.stAttendance.length === 0 ? (
              <Text style={styles.emptyText}>No attendance records found.</Text>
            ) : (
              metrics.stAttendance.map((att) => (
                <Pressable
                  key={att.id}
                  style={({ pressed }) => [
                    styles.cleanRecordCard,
                    pressed && styles.cardPressed,
                  ]}
                  onLongPress={() =>
                    openLongPressMenu(
                      'attendance',
                      att,
                      `${att.status} (${formatReadableLocalDate(att.date)})`
                    )
                  }
                  delayLongPress={300}
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
                  style={({ pressed }) => [
                    styles.cleanRecordCard,
                    pressed && styles.cardPressed,
                  ]}
                  onLongPress={() =>
                    openLongPressMenu(
                      'fee',
                      fee,
                      `${fee.feeType} - ₹${fee.amountPaid} (${formatReadableLocalDate(fee.date)})`
                    )
                  }
                  delayLongPress={300}
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
                    <Ionicons name="share-social-outline" size={13} color={COLORS.gold} />
                    <Text style={styles.pdfShareBtnText}>Receipt</Text>
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
              {attendanceFilterAllMonths ? 'Showing complete history' : 'Showing last 2 months'} • Hold card to edit/delete
            </Text>
          </View>
          <TouchableOpacity
            style={styles.primaryNavyButton}
            onPress={() => {
              if (activeStudents.length === 0) {
                Alert.alert('No Students', 'Add a student before marking attendance.');
                return;
              }
              setAttendanceModalForm({
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
            onPress={() => {
              triggerLayoutAnimation();
              setAttendanceFilterAllMonths(!attendanceFilterAllMonths);
            }}
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
                        style={({ pressed }) => [
                          styles.cleanRecordCard,
                          pressed && styles.cardPressed,
                        ]}
                        onLongPress={() =>
                          openLongPressMenu(
                            'attendance',
                            att,
                            `${st?.name || 'Student'} - ${att.status} (${formatReadableLocalDate(att.date)})`
                          )
                        }
                        delayLongPress={300}
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
            <Text style={styles.silverMeta}>Grouped by Subject & Month • Hold card to edit/delete</Text>
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

        <View style={styles.ledgerSummaryRow}>
          <View style={[styles.ledgerSummaryBox, { backgroundColor: COLORS.navy }]}>
            <Text style={styles.ledgerSummaryLabel}>TOTAL COLLECTED</Text>
            <Text style={styles.ledgerSummaryValGold}>₹{globalFeeTotals.collected.toFixed(0)}</Text>
          </View>
          <View
            style={[
              styles.ledgerSummaryBox,
              { backgroundColor: COLORS.cream, borderColor: COLORS.gold, borderWidth: 1 },
            ]}
          >
            <Text style={[styles.ledgerSummaryLabel, { color: COLORS.navy }]}>PENDING BALANCE</Text>
            <Text style={[styles.ledgerSummaryValGold, { color: COLORS.danger }]}>
              ₹{globalFeeTotals.pending.toFixed(0)}
            </Text>
          </View>
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
                    const isFullyPaid =
                      fee.status === 'Paid' && Number(fee.balanceDue || 0) === 0;
                    return (
                      <Pressable
                        key={fee.id}
                        style={({ pressed }) => [
                          styles.cleanRecordCard,
                          pressed && styles.cardPressed,
                        ]}
                        onLongPress={() =>
                          openLongPressMenu(
                            'fee',
                            fee,
                            `${st?.name || 'Student'} - ₹${fee.amountPaid}`
                          )
                        }
                        delayLongPress={300}
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
                              isFullyPaid ? styles.feeBadgePaid : styles.feeBadgeDue,
                            ]}
                          >
                            <Text style={styles.feeBadgeText}>{fee.status}</Text>
                          </View>
                          <TouchableOpacity
                            style={styles.pdfShareBtnSmall}
                            onPress={() => generateAndShareReceiptPDF(fee)}
                          >
                            <Ionicons name="document-text-outline" size={12} color={COLORS.gold} />
                            <Text style={styles.pdfShareBtnText}>PDF</Text>
                          </TouchableOpacity>
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
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

        <View style={styles.topHeader}>
          <TouchableOpacity
            onPress={openDrawer}
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

        {/* ANIMATED SLIDE DRAWER */}
        <Modal visible={drawerOpen} transparent animationType="none" onRequestClose={() => closeDrawer()}>
          <View style={styles.drawerOverlay}>
            <Animated.View
              style={[
                styles.drawerContainer,
                { transform: [{ translateX: drawerSlideAnim }] },
              ]}
            >
              <View style={styles.drawerHeader}>
                <Text style={styles.crestBadgeText}>★ JSM APP ★</Text>
                <Text style={styles.drawerTitle}>Music School Portal</Text>
                <Text style={styles.drawerSub}>Est. 2022 • Official Edition</Text>
              </View>

              <View style={{ padding: 16, gap: 10 }}>
                {[
                  { label: 'Home Dashboard', tab: 'Home', icon: 'grid-outline' },
                  { label: 'Student Directory', tab: 'Students', icon: 'people-outline' },
                  { label: 'Global Attendance', tab: 'Attendance', icon: 'calendar-outline' },
                  { label: 'Global Fee Register', tab: 'Fees', icon: 'card-outline' },
                  { label: `Trash Archive (${trashItems.length})`, tab: 'Trash', icon: 'trash-outline' },
                ].map((nav) => (
                  <TouchableOpacity
                    key={nav.tab}
                    style={[
                      styles.drawerNavItem,
                      activeTab === nav.tab && styles.drawerNavItemActive,
                    ]}
                    onPress={() => {
                      closeDrawer(() => {
                        setSelectedStudentId(null);
                        setActiveTab(nav.tab);
                      });
                    }}
                  >
                    <Ionicons
                      name={nav.icon}
                      size={18}
                      color={activeTab === nav.tab ? COLORS.gold : COLORS.navy}
                    />
                    <Text
                      style={[
                        styles.drawerNavText,
                        activeTab === nav.tab && styles.drawerNavTextActive,
                      ]}
                    >
                      {nav.label}
                    </Text>
                  </TouchableOpacity>
                ))}

                <View style={styles.drawerDivider} />

                <TouchableOpacity
                  style={styles.drawerNavItem}
                  onPress={() => {
                    closeDrawer(() => {
                      setSubjectForm({ id: null, name: '' });
                      setSubjectsModal(true);
                    });
                  }}
                >
                  <Ionicons name="musical-notes-outline" size={18} color={COLORS.navy} />
                  <Text style={styles.drawerNavText}>Manage Instruments & Order</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.drawerNavItem}
                  onPress={handleCheckOTA}
                  disabled={checkingOTA}
                >
                  {checkingOTA ? (
                    <ActivityIndicator size="small" color={COLORS.navy} />
                  ) : (
                    <>
                      <Ionicons name="cloud-download-outline" size={18} color={COLORS.navy} />
                      <Text style={styles.drawerNavText}>Check for OTA Update</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </Animated.View>
            <Pressable style={{ flex: 1 }} onPress={() => closeDrawer()} />
          </View>
        </Modal>

        {/* LONG-PRESS CONTEXT MENU */}
        <Modal visible={contextMenu.visible} transparent animationType="fade" onRequestClose={closeContextMenu}>
          <Pressable style={styles.modalBackdrop} onPress={closeContextMenu}>
            <Pressable style={styles.contextSheet} onPress={(e) => e.stopPropagation()}>
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
                style={[
                  styles.secondaryButton,
                  { marginTop: 10, alignSelf: 'stretch', alignItems: 'center' },
                ]}
                onPress={() => {
                  const shouldReopen = contextMenu.reopenSubjectsModal;
                  closeContextMenu();
                  if (shouldReopen) setSubjectsModal(true);
                }}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>

        {/* NOTICE READ MODAL */}
        <Modal visible={noticeReadModal} transparent animationType="slide" onRequestClose={() => setNoticeReadModal(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.sectionTitle}>JSM APP OFFICIAL NOTICE</Text>
              {noticeUpdatedAt ? (
                <Text style={styles.silverMeta}>
                  Posted {formatReadableLocalDate(noticeUpdatedAt)}
                </Text>
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

        {/* NOTICE EDIT MODAL */}
        <Modal visible={noticeEditModal} transparent animationType="slide" onRequestClose={() => setNoticeEditModal(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalBackdrop}
          >
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
          </KeyboardAvoidingView>
        </Modal>

        {/* TODAY'S AUDIT LOG MODAL */}
        <Modal visible={todayLogModal} transparent animationType="slide" onRequestClose={() => setTodayLogModal(false)}>
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

        {/* MANAGE SUBJECTS MODAL */}
        <Modal visible={subjectsModal} transparent animationType="slide" onRequestClose={() => setSubjectsModal(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalBackdrop}
          >
            <View style={styles.modalCard}>
              <Text style={styles.sectionTitle}>MANAGE INSTRUMENTS & SUBJECTS</Text>
              <Text style={styles.silverMeta}>
                Use the action buttons or long-press any subject to reorder, edit, or delete.
              </Text>

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={subjectForm.name}
                  onChangeText={(t) => setSubjectForm({ ...subjectForm, name: t })}
                  placeholder="e.g., Piano, Violin, Guitar"
                />
                <TouchableOpacity style={styles.primaryNavyButton} onPress={handleSaveSubject}>
                  <Text style={styles.primaryNavyButtonText}>
                    {subjectForm.id ? 'Update' : 'Add'}
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 280, marginVertical: 14 }}>
                {activeSubjects.length === 0 ? (
                  <Text style={styles.emptyText}>No subjects added yet.</Text>
                ) : (
                  activeSubjects.map((subj, idx) => (
                    <Pressable
                      key={subj.id}
                      style={styles.cleanRecordCard}
                      onLongPress={() => {
                        setSubjectsModal(false);
                        setTimeout(() => openLongPressMenu('subject', subj, subj.name, true), 200);
                      }}
                      delayLongPress={300}
                    >
                      <Text style={[styles.recordPrimaryTitle, { flex: 1 }]}>
                        {idx + 1}. {subj.name}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <TouchableOpacity
                          style={styles.iconActionBtn}
                          disabled={idx === 0}
                          onPress={() => handleMoveSubjectOrder(subj, 'moveUp')}
                        >
                          <Ionicons
                            name="arrow-up"
                            size={15}
                            color={idx === 0 ? COLORS.silver : COLORS.navy}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.iconActionBtn}
                          disabled={idx === activeSubjects.length - 1}
                          onPress={() => handleMoveSubjectOrder(subj, 'moveDown')}
                        >
                          <Ionicons
                            name="arrow-down"
                            size={15}
                            color={idx === activeSubjects.length - 1 ? COLORS.silver : COLORS.navy}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.iconActionBtn}
                          onPress={() => setSubjectForm({ id: subj.id, name: subj.name })}
                        >
                          <Ionicons name="pencil" size={15} color={COLORS.navy} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.iconActionBtn}
                          onPress={() => handleSoftDelete('subjects', subj, `Subject: ${subj.name}`)}
                        >
                          <Ionicons name="trash-outline" size={15} color={COLORS.danger} />
                        </TouchableOpacity>
                      </View>
                    </Pressable>
                  ))
                )}
              </ScrollView>

              <TouchableOpacity
                style={[styles.secondaryButton, { alignSelf: 'flex-end' }]}
                onPress={() => {
                  setSubjectForm({ id: null, name: '' });
                  setSubjectsModal(false);
                }}
              >
                <Text style={styles.secondaryButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* REGISTER / EDIT STUDENT MODAL */}
        <Modal visible={studentModal} transparent animationType="slide" onRequestClose={() => setStudentModal(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalBackdrop}
          >
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
                <QuickDateRow
                  currentDate={studentForm.joinedDate}
                  onSelectDate={(d) => setStudentForm({ ...studentForm, joinedDate: d })}
                />
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
          </KeyboardAvoidingView>
        </Modal>

        {/* EDIT LESSON MODAL */}
        <Modal visible={lessonEditModal} transparent animationType="slide" onRequestClose={() => setLessonEditModal(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalBackdrop}
          >
            <View style={styles.modalCard}>
              <Text style={styles.sectionTitle}>EDIT LESSON RECORD</Text>
              <Text style={styles.inputLabel}>Date (YYYY-MM-DD)</Text>
              <QuickDateRow
                currentDate={lessonEditForm.date}
                onSelectDate={(d) => setLessonEditForm({ ...lessonEditForm, date: d })}
              />
              <TextInput
                style={styles.input}
                value={lessonEditForm.date}
                onChangeText={(t) => setLessonEditForm({ ...lessonEditForm, date: t })}
              />
              <Text style={styles.inputLabel}>Technique</Text>
              <TextInput
                style={styles.input}
                value={lessonEditForm.technique}
                onChangeText={(t) => setLessonEditForm({ ...lessonEditForm, technique: t })}
              />
              <Text style={styles.inputLabel}>Repertoire</Text>
              <TextInput
                style={styles.input}
                value={lessonEditForm.repertoire}
                onChangeText={(t) => setLessonEditForm({ ...lessonEditForm, repertoire: t })}
              />
              <Text style={styles.inputLabel}>Assignment</Text>
              <TextInput
                style={styles.input}
                value={lessonEditForm.assignment}
                onChangeText={(t) => setLessonEditForm({ ...lessonEditForm, assignment: t })}
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
                  onPress={handleSaveEditedLesson}
                >
                  <Text style={styles.primaryNavyButtonText}>Update Lesson</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* MARK / EDIT ATTENDANCE MODAL */}
        <Modal visible={attendanceModal} transparent animationType="slide" onRequestClose={() => setAttendanceModal(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalBackdrop}
          >
            <View style={styles.modalCard}>
              <Text style={styles.sectionTitle}>
                {attendanceModalForm.id ? 'EDIT ATTENDANCE' : 'MARK GLOBAL ATTENDANCE'}
              </Text>
              <ScrollView style={{ maxHeight: 360 }}>
                <Text style={styles.inputLabel}>Select Student *</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginBottom: 8 }}
                >
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {activeStudents.map((st) => (
                      <TouchableOpacity
                        key={st.id}
                        style={[
                          styles.choiceChip,
                          attendanceModalForm.studentId === st.id && styles.choiceChipSelected,
                        ]}
                        onPress={() =>
                          setAttendanceModalForm({ ...attendanceModalForm, studentId: st.id })
                        }
                      >
                        <Text
                          style={[
                            styles.choiceChipText,
                            attendanceModalForm.studentId === st.id &&
                              styles.choiceChipTextSelected,
                          ]}
                        >
                          {st.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                <Text style={styles.inputLabel}>Date (YYYY-MM-DD)</Text>
                <QuickDateRow
                  currentDate={attendanceModalForm.date}
                  onSelectDate={(d) =>
                    setAttendanceModalForm({ ...attendanceModalForm, date: d })
                  }
                />
                <TextInput
                  style={styles.input}
                  value={attendanceModalForm.date}
                  onChangeText={(t) =>
                    setAttendanceModalForm({ ...attendanceModalForm, date: t })
                  }
                />

                <Text style={styles.inputLabel}>Attendance Status</Text>
                <View style={styles.chipRow}>
                  {ATTENDANCE_STATUSES.map((st) => (
                    <TouchableOpacity
                      key={st}
                      style={[
                        styles.choiceChip,
                        attendanceModalForm.status === st && styles.choiceChipSelected,
                      ]}
                      onPress={() =>
                        setAttendanceModalForm({ ...attendanceModalForm, status: st })
                      }
                    >
                      <Text
                        style={[
                          styles.choiceChipText,
                          attendanceModalForm.status === st && styles.choiceChipTextSelected,
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
                  value={attendanceModalForm.remarks}
                  onChangeText={(t) =>
                    setAttendanceModalForm({ ...attendanceModalForm, remarks: t })
                  }
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
                  onPress={handleSaveModalAttendance}
                >
                  <Text style={styles.primaryNavyButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* RECORD / EDIT FEE MODAL */}
        <Modal visible={feeModal} transparent animationType="slide" onRequestClose={() => setFeeModal(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalBackdrop}
          >
            <View style={styles.modalCard}>
              <Text style={styles.sectionTitle}>
                {feeForm.id ? 'EDIT FEE TRANSACTION' : 'RECORD FEE'}
              </Text>
              <ScrollView style={{ maxHeight: 420 }}>
                <Text style={styles.inputLabel}>Select Student *</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginBottom: 8 }}
                >
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
                <QuickDateRow
                  currentDate={feeForm.date}
                  onSelectDate={(d) => setFeeForm({ ...feeForm, date: d })}
                />
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
                    feeForm.status === 'Unpaid' && {
                      backgroundColor: '#E5E5E5',
                      color: COLORS.silver,
                    },
                  ]}
                  editable={feeForm.status !== 'Unpaid'}
                  keyboardType="numeric"
                  value={feeForm.status === 'Unpaid' ? '0' : feeForm.amountPaid}
                  onChangeText={(t) => setFeeForm({ ...feeForm, amountPaid: sanitizeCurrency(t) })}
                  placeholder="0"
                />

                <Text style={styles.inputLabel}>
                  Balance Due (₹) {feeForm.status === 'Paid' ? '(Auto-locked to 0)' : '*'}
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    feeForm.status === 'Paid' && {
                      backgroundColor: '#E5E5E5',
                      color: COLORS.silver,
                    },
                  ]}
                  editable={feeForm.status !== 'Paid'}
                  keyboardType="numeric"
                  value={feeForm.status === 'Paid' ? '0' : feeForm.balanceDue}
                  onChangeText={(t) => setFeeForm({ ...feeForm, balanceDue: sanitizeCurrency(t) })}
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
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.ivory,
  },
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  crestBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.goldLight,
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
  contactActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  contactActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(212, 185, 120, 0.16)',
    borderWidth: 1,
    borderColor: COLORS.gold,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  contactActionText: { color: COLORS.gold, fontSize: 12, fontWeight: '700' },
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
    borderColor: COLORS.border,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: { color: COLORS.navy, fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  silverMeta: { color: COLORS.silver, fontSize: 12 },
  noticePreviewText: { color: COLORS.charcoal, fontSize: 14, lineHeight: 20, marginVertical: 6 },
  noticeFullText: { color: COLORS.charcoal, fontSize: 15, lineHeight: 22 },
  noticeActionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  bentoRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  bentoCard: {
    flex: 1,
    borderRadius: 14,
    padding: 18,
    justifyContent: 'space-between',
    minHeight: 115,
  },
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
  tabTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  pageHeading: { color: COLORS.navy, fontSize: 20, fontWeight: '800' },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#D8D2C5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.charcoal,
    paddingVertical: 2,
  },
  ledgerSummaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  ledgerSummaryBox: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
  },
  ledgerSummaryLabel: {
    color: COLORS.cream,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  ledgerSummaryValGold: {
    color: COLORS.gold,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
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
  monthSubHeader: {
    color: COLORS.navy,
    fontSize: 13,
    fontWeight: '700',
    marginVertical: 6,
    paddingLeft: 4,
  },
  cleanRecordCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
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
  feeBadgePaid: { backgroundColor: COLORS.successBg },
  feeBadgeDue: { backgroundColor: COLORS.dangerBg },
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
  backButtonRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backButtonText: { color: COLORS.navy, fontSize: 14, fontWeight: '700' },
  secondaryButtonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.cream,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  secondaryButtonSmallText: { color: COLORS.navy, fontSize: 12, fontWeight: '700' },
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
  pillNavContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.cream,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
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
  quickDateRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  quickDateChip: {
    backgroundColor: COLORS.cream,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D8D2C5',
  },
  quickDateChipActive: {
    backgroundColor: COLORS.navy,
    borderColor: COLORS.gold,
  },
  quickDateChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.navy,
  },
  quickDateChipTextActive: {
    color: COLORS.gold,
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
  prioritySwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  pdfShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.navy,
    borderColor: COLORS.gold,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  pdfShareBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.navy,
    borderColor: COLORS.gold,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pdfShareBtnText: { color: COLORS.gold, fontSize: 11, fontWeight: '700' },
  iconActionBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: COLORS.ivory,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
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
  dangerButton: {
    backgroundColor: COLORS.danger,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 9,
  },
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
  emptyGroupText: {
    color: COLORS.silver,
    fontSize: 12,
    fontStyle: 'italic',
    paddingLeft: 8,
    paddingTop: 6,
  },
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
  drawerNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: COLORS.cream,
  },
  drawerNavItemActive: {
    backgroundColor: COLORS.navy,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  drawerNavText: { color: COLORS.navy, fontSize: 14, fontWeight: '700' },
  drawerNavTextActive: { color: COLORS.gold },
  drawerDivider: { height: 1, backgroundColor: '#D8D2C5', marginVertical: 8 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(12, 45, 87, 0.6)',
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: COLORS.gold,
  },
  modalBtnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 },
  contextSheet: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: COLORS.gold,
    alignItems: 'center',
    width: '100%',
  },
  contextSheetHeader: { color: COLORS.navy, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  contextDivider: { height: 1, backgroundColor: COLORS.cream, width: '100%', marginVertical: 12 },
  contextOptionBtn: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F2EFE9',
  },
  contextOptionText: { color: COLORS.navy, fontSize: 15, fontWeight: '700' },
});
