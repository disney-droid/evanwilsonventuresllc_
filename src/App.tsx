import React, { useState, useEffect, useRef } from "react";
import {
  Clock,
  Briefcase,
  Coffee,
  Calendar as CalendarIcon,
  FileSpreadsheet,
  Lock,
  Unlock,
  AlertTriangle,
  UserCheck,
  TrendingUp,
  FileText,
  Trash,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Plus,
  Bell,
  Check,
  X,
  Shield,
  Clock3,
  LogOut,
  Download,
  DollarSign,
  User,
  ExternalLink,
  Eye,
  EyeOff,
  Settings
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Server API Base URL
const API_URL = "";

// TypeScript Interfaces mirroring backend
interface LoggedUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "employee";
  hourlyRate: number;
  mustChangePassword: boolean;
  position?: string;
}

interface TimeLog {
  id: string;
  userId: string;
  employeeName: string;
  date: string; // YYYY-MM-DD
  clockIn: string | null;
  clockOut: string | null;
  breaks: Array<{ start: string; end: string | null }>;
  isSubmitted: boolean;
  totalHours: number;
}

interface LeaveRequest {
  id: string;
  userId: string;
  employeeName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  reason: string;
  status: "pending" | "approved" | "denied";
  adminComment?: string;
  createdAt: string;
}

interface Invoice {
  id: string;
  userId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  totalHours: number;
  hourlyRate: number;
  amountDue: number;
  issuedAt: string;
  dailyBreakdown: Array<{ date: string; hours: number }>;
}

interface SystemNotification {
  id: string;
  userId: string;
  message: string;
  read: boolean;
  createdAt: string;
}

interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
}

export default function App() {
  // --- SESSION STATE ---
  const [user, setUser] = useState<LoggedUser | null>(() => {
    const saved = localStorage.getItem("ew_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem("ew_token") || null;
  });

  // --- LOGIN FORM STATES ---
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // --- CHANGE PASSWORD STATE ---
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passError, setPassError] = useState("");
  const [passSuccess, setPassSuccess] = useState(false);

  // --- DATA STATES ---
  const [employees, setEmployees] = useState<LoggedUser[]>([]);
  const [allLogs, setAllLogs] = useState<TimeLog[]>([]);
  const [allLeaves, setAllLeaves] = useState<LeaveRequest[]>([]);
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // --- EMPLOYEE STATE ---
  const [personalLogs, setPersonalLogs] = useState<TimeLog[]>([]);
  const [personalLeaves, setPersonalLeaves] = useState<LeaveRequest[]>([]);
  const [personalInvoices, setPersonalInvoices] = useState<Invoice[]>([]);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  // --- ACTIVE LIVE TABS ---
  const [adminTab, setAdminTab] = useState<"overview" | "worklogs" | "leaves" | "calendar" | "billing" | "audit" | "settings">("overview");
  const [empTab, setEmpTab] = useState<"punch" | "leaves" | "calendar" | "invoices">("punch");

  // --- LEAVE APPLICATION STATE ---
  const [leaveStart, setLeaveStart] = useState("");
  const [leaveEnd, setLeaveEnd] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveSubmitMsg, setLeaveSubmitMsg] = useState("");

  // --- MANUAL WEEKLY BILLING FORM ---
  const [billEmployeeId, setBillEmployeeId] = useState("");
  const [billStart, setBillStart] = useState("");
  const [billEnd, setBillEnd] = useState("");
  const [billError, setBillError] = useState("");
  const [billSuccess, setBillSuccess] = useState("");

  // --- WORKFORCE SETTINGS STATE ---
  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);
  const [editingPosition, setEditingPosition] = useState("");
  const [editingRate, setEditingRate] = useState("");
  const [settingsStatusMsg, setSettingsStatusMsg] = useState("");

  // --- VIEW DETAILS MODALS ---
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [leaveActionId, setLeaveActionId] = useState<string | null>(null);
  const [leaveComment, setLeaveComment] = useState("");
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<{
    dateStr: string;
    logs: TimeLog[];
    leaves: LeaveRequest[];
  } | null>(null);

  // --- LIVE TIMER & STATUS CHECKS ---
  const [currentTime, setCurrentTime] = useState(new Date());
  const [sessionLoading, setSessionLoading] = useState(false);

  // Quick Account selector presets
  const demoAccounts = [
    { email: "evan@evanawilson.com", pass: "BCA12345678!", label: "Employer (Evan)" },
    { email: "trish@evanawilson.com", pass: "1234567890", label: "Employee 1 (Trisha)" },
    { email: "disney@evanawilson.com", pass: "abcdefghi", label: "Employee 2 (Disney)" }
  ];

  // Tick the clock & recalculate ongoing timer every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch updated records depending on user role
  const refreshData = async (userId: string, userRole: string) => {
    try {
      if (userRole === "admin") {
        const [empRes, logsRes, leavesRes, invoicesRes, notifsRes, auditRes] = await Promise.all([
          fetch(`${API_URL}/api/employees`),
          fetch(`${API_URL}/api/logs/all`),
          fetch(`${API_URL}/api/leaves/all`),
          fetch(`${API_URL}/api/invoices/all`),
          fetch(`${API_URL}/api/notifications/user/admin`),
          fetch(`${API_URL}/api/audit-logs`)
        ]);

        if (empRes.ok) setEmployees(await empRes.json());
        if (logsRes.ok) setAllLogs(await logsRes.json());
        if (leavesRes.ok) setAllLeaves(await leavesRes.json());
        if (invoicesRes.ok) setAllInvoices(await invoicesRes.json());
        if (notifsRes.ok) setNotifications(await notifsRes.json());
        if (auditRes.ok) setAuditLogs(await auditRes.json());
      } else {
        const [logsRes, leavesRes, invoicesRes, notifsRes] = await Promise.all([
          fetch(`${API_URL}/api/logs/employee/${userId}`),
          fetch(`${API_URL}/api/leaves/employee/${userId}`),
          fetch(`${API_URL}/api/invoices/employee/${userId}`),
          fetch(`${API_URL}/api/notifications/user/${userId}`)
        ]);

        if (logsRes.ok) setPersonalLogs(await logsRes.json());
        if (leavesRes.ok) setPersonalLeaves(await leavesRes.json());
        if (invoicesRes.ok) setPersonalInvoices(await invoicesRes.json());
        if (notifsRes.ok) setNotifications(await notifsRes.json());
      }
    } catch (e) {
      console.error("Failed to sync backend state:", e);
    }
  };

  // Run initial refresh
  useEffect(() => {
    if (user && token) {
      refreshData(user.id, user.role);
    }
  }, [user, token]);

  const handleLogin = async (e?: React.FormEvent, presetEmail?: string, presetPass?: string) => {
    if (e) e.preventDefault();
    const emailToUse = presetEmail || loginEmail;
    const passwordToUse = presetPass || loginPassword;

    if (!emailToUse || !passwordToUse) {
      setLoginError("Please fill out all credentials fields.");
      return;
    }

    setLoginError("");
    setAuthLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToUse, password: passwordToUse })
      });

      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || "Authentication failed");
      } else {
        localStorage.setItem("ew_user", JSON.stringify(data.user));
        localStorage.setItem("ew_token", data.token);
        setUser(data.user);
        setToken(data.token);
        // Clear login form
        setLoginEmail("");
        setLoginPassword("");
      }
    } catch (err) {
      setLoginError("Could not connect to Evan Wilson Ventures secure server.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("ew_user");
    localStorage.removeItem("ew_token");
    setUser(null);
    setToken(null);
    setPersonalLogs([]);
    setPersonalInvoices([]);
    setPersonalLeaves([]);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setPassError("Security standard requires at least 8 password characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassError("Confirmation credentials mismatch.");
      return;
    }

    setPassError("");
    try {
      const res = await fetch(`${API_URL}/api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id, newPassword })
      });

      if (!res.ok) {
        const d = await res.json();
        setPassError(d.error || "Password change rejected.");
      } else {
        setPassSuccess(true);
        // Update user state locally
        if (user) {
          const updated = { ...user, mustChangePassword: false };
          localStorage.setItem("ew_user", JSON.stringify(updated));
          setUser(updated);
        }
        setTimeout(() => {
          setPassSuccess(false);
          setNewPassword("");
          setConfirmPassword("");
        }, 3000);
      }
    } catch {
      setPassError("Server validation failed.");
    }
  };

  // --- TIME CLOCK OPERATIONS ---
  const triggerClockIn = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/api/logs/clock-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error);
      } else {
        refreshData(user.id, user.role);
      }
    } catch {
      alert("Clock In failed.");
    }
  };

  const triggerBreakStart = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/api/logs/break-start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error);
      } else {
        refreshData(user.id, user.role);
      }
    } catch {
      alert("Break Start failed.");
    }
  };

  const triggerBreakEnd = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/api/logs/break-end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error);
      } else {
        refreshData(user.id, user.role);
      }
    } catch {
      alert("Break End failed.");
    }
  };

  const triggerClockOut = async () => {
    if (!user) return;
    
    if (!showSubmitConfirm) {
      setShowSubmitConfirm(true);
      // Auto-reset after 5 seconds if not confirmed
      setTimeout(() => {
        setShowSubmitConfirm(false);
      }, 5000);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/logs/clock-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id })
      });
      const data = await res.json();
      setShowSubmitConfirm(false);
      if (!res.ok) {
        alert(data.error);
      } else {
        refreshData(user.id, user.role);
      }
    } catch {
      alert("Clock Out failed.");
      setShowSubmitConfirm(false);
    }
  };

  // Submit leaves
  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveStart || !leaveEnd || !leaveReason) {
      setLeaveSubmitMsg("Please fill in leave dates and reason.");
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/leaves/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id, startDate: leaveStart, endDate: leaveEnd, reason: leaveReason })
      });
      const data = await res.json();
      if (!res.ok) {
        setLeaveSubmitMsg(data.error || "Submission rejected.");
      } else {
        setLeaveSubmitMsg("Leave application transmitted successfully.");
        setLeaveStart("");
        setLeaveEnd("");
        setLeaveReason("");
        refreshData(user!.id, user!.role);
      }
    } catch {
      setLeaveSubmitMsg("Network connection error.");
    }
  };

  // Leave approval / denial (Admin)
  const processLeaveStatus = async (status: "approved" | "denied") => {
    if (!leaveActionId) return;
    try {
      const res = await fetch(`${API_URL}/api/leaves/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: leaveActionId, status, adminComment: leaveComment, adminUserId: user?.id })
      });
      if (res.ok) {
        setLeaveActionId(null);
        setLeaveComment("");
        refreshData(user!.id, user!.role);
      } else {
        const d = await res.json();
        alert(d.error);
      }
    } catch {
      alert("Network error.");
    }
  };

  // Generate Weekly billing invoice (Admin)
  const handleBillingGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBillError("");
    setBillSuccess("");

    if (!billEmployeeId || !billStart || !billEnd) {
      setBillError("Please select employee and provide date ranges.");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/invoices/generate-weekly`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: billEmployeeId, startDate: billStart, endDate: billEnd })
      });
      const data = await res.json();
      if (!res.ok) {
        setBillError(data.error || "Failed to compile billing invoice.");
      } else {
        setBillSuccess(`Weekly service invoice generated successfully! Total Amount: USD ${data.invoice.amountDue}`);
        setBillStart("");
        setBillEnd("");
        setBillEmployeeId("");
        refreshData(user!.id, user!.role);
      }
    } catch {
      setBillError("Server connection error.");
    }
  };

  // Update hourly rate (Admin)
  const updateHourlyRate = async (empId: string, rate: string) => {
    const val = Number(rate);
    if (isNaN(val) || val < 0) return;
    try {
      const res = await fetch(`${API_URL}/api/employees/update-rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: empId, hourlyRate: val })
      });
      if (res.ok) {
        refreshData(user!.id, user!.role);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Update both hourly rate and position settings (Admin)
  const updateEmployeeSettings = async (empId: string, rate: number, position: string) => {
    try {
      const res = await fetch(`${API_URL}/api/employees/update-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: empId, hourlyRate: rate, position: position })
      });
      if (res.ok) {
        refreshData(user!.id, user!.role);
        return true;
      }
      return false;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  // Mark notification read
  const markNotificationRead = async (id: string) => {
    try {
      await fetch(`${API_URL}/api/notifications/mark-read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifId: id })
      });
      refreshData(user!.id, user!.role);
    } catch (e) {
      console.error(e);
    }
  };

  // Calculated variables for currently logged in employee status check
  const todayStr = currentTime.toISOString().split("T")[0];
  const todayLogs = (user?.role === "employee" ? personalLogs : []).filter(l => l.date === todayStr);
  const activeTodayLog = todayLogs.find(l => !l.isSubmitted);
  const alreadySubmittedToday = todayLogs.some(l => l.isSubmitted);

  let currentWorkStatus: "Off Duty" | "On Work" | "On Break" = "Off Duty";
  let activeBreakObj: { start: string; end: string | null } | null = null;

  if (activeTodayLog && activeTodayLog.clockIn) {
    const lastBreak = activeTodayLog.breaks[activeTodayLog.breaks.length - 1];
    if (lastBreak && lastBreak.end === null) {
      currentWorkStatus = "On Break";
      activeBreakObj = lastBreak;
    } else {
      currentWorkStatus = "On Work";
    }
  }

  // Live Timer Count Calculations
  const calculateLiveCounters = () => {
    if (!activeTodayLog || !activeTodayLog.clockIn) {
      return { totalWorkedStr: "00:00:00", activeBreakStr: "00:00:00" };
    }

    const clockInTime = new Date(activeTodayLog.clockIn).getTime();
    const currTimeMs = currentTime.getTime();

    // Sum finalized breaks
    let completedBreaksMs = 0;
    activeTodayLog.breaks.forEach(b => {
      if (b.start && b.end) {
        completedBreaksMs += new Date(b.end).getTime() - new Date(b.start).getTime();
      }
    });

    let liveBreakMs = 0;
    if (activeBreakObj) {
      liveBreakMs = currTimeMs - new Date(activeBreakObj.start).getTime();
    }

    // Total worked live
    let currentTotalWorkedMs = currTimeMs - clockInTime - completedBreaksMs - liveBreakMs;
    if (currentTotalWorkedMs < 0) currentTotalWorkedMs = 0;

    const formatMs = (ms: number) => {
      const totSecs = Math.floor(ms / 1000);
      const hours = Math.floor(totSecs / 3600);
      const mins = Math.floor((totSecs % 3600) / 60);
      const secs = totSecs % 60;
      return [
        hours.toString().padStart(2, "0"),
        mins.toString().padStart(2, "0"),
        secs.toString().padStart(2, "0")
      ].join(":");
    };

    return {
      totalWorkedStr: formatMs(currentTotalWorkedMs),
      activeBreakStr: activeBreakObj ? formatMs(liveBreakMs) : "00:00:00"
    };
  };

  const { totalWorkedStr, activeBreakStr } = calculateLiveCounters();

  // --- INTERACTIVE MONTH CALENDAR LOGIC ---
  const [calendarYear, setCalendarYear] = useState(2026);
  const [calendarMonth, setCalendarMonth] = useState(4); // May (0-indexed represents May as 4)

  // --- PAST WEEKS FOR WORKSHEETS ---
  const pastWeeks = React.useMemo(() => {
    const weeksList: Array<{ startStr: string; endStr: string; label: string; startDate: Date; endDate: Date }> = [];
    const anchorDate = new Date(2026, 5, 5); // June 5, 2026 (Friday)
    for (let i = 0; i < 8; i++) {
      const mon = new Date(anchorDate);
      mon.setDate(anchorDate.getDate() - (i * 7) - 4); // Mon
      const fri = new Date(mon);
      fri.setDate(mon.getDate() + 4); // Fri
      
      const optionsMonth: Intl.DateTimeFormatOptions = { month: 'long' };
      const startMonth = mon.toLocaleDateString('en-US', optionsMonth);
      const endMonth = fri.toLocaleDateString('en-US', optionsMonth);
      const startDay = mon.getDate();
      const endDay = fri.getDate();
      const yr = mon.getFullYear();
      
      const label = startMonth === endMonth
        ? `${startMonth} ${startDay} to ${endDay}, ${yr}`
        : `${startMonth} ${startDay} to ${endMonth} ${endDay}, ${yr}`;
        
      const startStr = `${mon.getFullYear()}-${(mon.getMonth()+1).toString().padStart(2, '0')}-${mon.getDate().toString().padStart(2, '0')}`;
      const endStr = `${fri.getFullYear()}-${(fri.getMonth()+1).toString().padStart(2, '0')}-${fri.getDate().toString().padStart(2, '0')}`;
      
      weeksList.push({
        startStr,
        endStr,
        label,
        startDate: mon,
        endDate: fri
      });
    }
    return weeksList;
  }, []);

  const [selectedWeekIdx, setSelectedWeekIdx] = useState<number>(1); // Defaults to May 25 to 29, 2026

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const handlePrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear(y => y - 1);
    } else {
      setCalendarMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear(y => y + 1);
    } else {
      setCalendarMonth(m => m + 1);
    }
  };

  const generateDaysOfCalendar = () => {
    const startOfMonth = new Date(calendarYear, calendarMonth, 1);
    const endOfMonth = new Date(calendarYear, calendarMonth + 1, 0);

    const daysInMonth = endOfMonth.getDate();
    const startDayOfWeek = startOfMonth.getDay(); // 0 is Sunday, 1 is Monday ...

    const gridDays: Array<{ dateStr: string | null; dayNum: number | null }> = [];

    // Fill blank initial cells
    for (let i = 0; i < startDayOfWeek; i++) {
      gridDays.push({ dateStr: null, dayNum: null });
    }

    // Fill actual month days
    for (let day = 1; day <= daysInMonth; day++) {
      const formattedMonth = (calendarMonth + 1).toString().padStart(2, "0");
      const formattedDay = day.toString().padStart(2, "0");
      const dateStr = `${calendarYear}-${formattedMonth}-${formattedDay}`;
      gridDays.push({ dateStr, dayNum: day });
    }

    return gridDays;
  };

  const calendarDays = generateDaysOfCalendar();

  // Filter lists for currently selected year/month to render highlight indicators efficiently
  const currentLogsList = user?.role === "admin" ? allLogs : personalLogs;
  const currentLeavesList = user?.role === "admin" ? allLeaves : personalLeaves;

  // Render leave calendar cell indicator helper
  const getCellStatus = (dateStr: string) => {
    const dayLogs = currentLogsList.filter(l => l.date === dateStr);
    const dayLeaves = currentLeavesList.filter(l => l.startDate <= dateStr && l.endDate >= dateStr && l.status === "approved");
    const pendingLeaves = currentLeavesList.filter(l => l.startDate <= dateStr && l.endDate >= dateStr && l.status === "pending");

    return {
      hasLogs: dayLogs.length > 0,
      hoursLogged: dayLogs.reduce((acc, current) => acc + current.totalHours, 0),
      hasApprovedLeave: dayLeaves.length > 0,
      hasPendingLeave: pendingLeaves.length > 0,
      dayLogs,
      dayLeaves
    };
  };

  const handleDayClick = (dateStr: string | null) => {
    if (!dateStr) return;
    const dayLogs = currentLogsList.filter(l => l.date === dateStr);
    const dayLeaves = currentLeavesList.filter(l => l.startDate <= dateStr && l.endDate >= dateStr);
    setSelectedCalendarDay({
      dateStr,
      logs: dayLogs,
      leaves: dayLeaves
    });
  };

  // Automated computations
  const payrollTotalHours = (user?.role === "employee" ? personalLogs : allLogs)
    .filter(l => l.isSubmitted)
    .reduce((sum, current) => sum + current.totalHours, 0);

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] font-sans overflow-x-hidden selection:bg-white selection:text-black">

      {/* SECURE GATEWAYS / UN-AUTHENTICATED LOGIN BOARD */}
      {!user ? (
        <div className="flex flex-col items-center justify-center p-6 min-h-[calc(100vh-80px)]" id="login-section">
          {/* Logo Brand Header matching the screenshot */}
          <div className="flex flex-col items-center mb-8 text-center relative max-w-sm w-full">
            {/* Ambient Red Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-red-600/10 rounded-full blur-[40px] pointer-events-none -z-10" />
            
            <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center text-center text-white text-3xl font-black italic leading-none shadow-[0_0_35px_rgba(224,0,0,0.6)] border border-white/10 select-none animate-pulse">
              <span className="translate-x-[0.05em]">EW</span>
            </div>
            
            <h1 className="font-sans font-black italic tracking-wide text-3xl md:text-4xl text-white mt-5 uppercase leading-none select-none">
              EVAN WILSON
            </h1>
            
            <p className="text-[10px] text-red-500 font-bold tracking-[0.25em] md:tracking-[0.3em] uppercase mt-2.5 select-none font-mono">
              EMPLOYEE MANAGEMENT SYSTEM
            </p>
          </div>

          {/* Styled Secure Access Card Card matching screenshot */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-sm rounded-[2rem] bg-[#0c0c0e] border border-white/[0.06] shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative overflow-hidden"
          >
            {/* Inner top glow border */}
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />

            {/* SYSTEM ACCESS Header block */}
            <div className="py-5 border-b border-white/[0.05] text-center select-none bg-white/[0.01]">
              <h2 className="font-mono tracking-[0.3em] text-xs font-bold text-white uppercase text-center">
                System Access
              </h2>
            </div>

            <div className="p-7">
              <form onSubmit={handleLogin} className="space-y-6">
                <div>
                  <label className="block text-[9px] uppercase tracking-[0.2em] font-mono text-white/40 mb-2 font-semibold">
                    Email
                  </label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="user@evanwilson.com"
                    className="w-full bg-black border border-white/10 rounded-2xl px-4 py-3.5 text-xs text-white focus:outline-none focus:border-red-600 transition placeholder-white/20 font-mono tracking-wide"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[9px] uppercase tracking-[0.2em] font-mono text-white/40 mb-2 font-semibold">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-black border border-white/10 rounded-2xl px-4 py-3.5 pr-11 text-xs text-white focus:outline-none focus:border-red-600 transition placeholder-white/20 font-mono tracking-wide"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/45 hover:text-white transition cursor-pointer p-1"
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {loginError && (
                  <div className="p-3.5 text-xs bg-red-950/20 border border-red-500/20 text-red-400 rounded-xl flex gap-2 items-start animate-shake">
                    <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                    <span className="font-mono text-[10px] leading-relaxed">{loginError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-red-600 hover:bg-red-500 text-white font-extrabold uppercase tracking-[0.2em] text-[10px] py-3.5 rounded-2xl transition-all cursor-pointer flex justify-center items-center active:scale-98 shadow-md"
                >
                  {authLoading ? "Decrypting Credentials..." : "Log In"}
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      ) : (
        /* AUTHENTICATED REAL-TIME OPERATIONS GROUND */
        <main className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 py-8 relative z-10">

          {/* SESSIONS & LOGOUT inline control bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 bg-neutral-200 rounded-full animate-pulse shrink-0" />
              <div className="flex flex-col">
                <span className="text-xs text-white/90 font-bold uppercase tracking-wider leading-none">{user.name}</span>
                <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest mt-1">{user.role} Authorization Clearance</span>
              </div>
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              {/* Notification Badge drop inline */}
              <div className="relative group">
                <button className="p-2 border border-white/15 bg-[#0a0a0a] text-white/60 hover:text-white hover:bg-white/5 transition relative cursor-pointer flex items-center justify-center">
                  <Bell size={14} />
                  {notifications.some(n => !n.read) && (
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                  )}
                </button>

                {/* Float Dropdown Panel */}
                <div className="absolute right-0 mt-2 w-72 bg-[#0e0e0e] border border-white/10 rounded-none shadow-2xl p-4 hidden group-hover:block hover:block z-50">
                  <p className="text-[10px] font-mono uppercase text-white/40 border-b border-white/5 pb-2 mb-2 tracking-wider">System Broadcasts</p>
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {notifications.length === 0 ? (
                      <p className="text-[11px] text-white/30 py-4 text-center">No active notifications</p>
                    ) : (
                      notifications.map((n) => (
                        <div key={n.id} className={`p-2 rounded-none text-[11px] transition ${n.read ? "bg-white/[0.02]" : "bg-white/[0.05] border-l-2 border-white"}`}>
                          <div className="flex justify-between items-start gap-1">
                            <p className="text-white/80">{n.message}</p>
                            {!n.read && (
                              <button onClick={() => markNotificationRead(n.id)} className="text-white hover:text-white shrink-0">
                                <Check size={12} />
                              </button>
                            )}
                          </div>
                          <span className="text-[9px] text-white/40 font-mono block mt-1">{new Date(n.createdAt).toLocaleTimeString()}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-none border border-white/10 hover:border-white/20 hover:bg-white/5 text-white/75 hover:text-white transition cursor-pointer font-semibold uppercase tracking-wider"
              >
                <LogOut size={13} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>

          {/* DYNAMIC WELCOME BANNER WITH SERVER CLOCK */}
          <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6 items-center bg-[#0e0e0e] border border-white/5 rounded-none p-6">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">Welcome back, Team Member</span>
              <h2 className="text-2xl mt-1 font-light text-white tracking-tight">{user.name}</h2>
              <p className="text-xs text-white/50 mt-1 max-w-sm">
                Authorized with {user.role.toUpperCase()} security clearance metrics on Evan Wilson Ventures LLC framework.
              </p>
            </div>

            <div className="text-right flex flex-col items-end border-t md:border-t-0 border-white/5 pt-4 md:pt-0">
              <span className="text-[10px] font-mono tracking-widest text-white/30 uppercase">Interactive Server Clock</span>
              <span className="text-xl md:text-3xl font-mono text-white text-right font-light mt-1">
                {currentTime.toLocaleTimeString()}
              </span>
              <span className="text-[10px] font-mono text-white/40 mt-0.5 uppercase tracking-widest">
                {currentTime.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </span>
            </div>
          </div>

          {/* FORCE PASSWORD CHANGE ENFORCEMENT LAYER */}
          {user.mustChangePassword ? (
            <div className="bg-[#0e0e0e] border border-white/10 max-w-lg mx-auto rounded-none p-8 shadow-2xl my-10 relative">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-10 h-10 bg-white/5 border border-white/10 text-white rounded-none flex items-center justify-center shrink-0">
                  <Lock size={18} />
                </div>
                <div>
                  <h3 className="text-md font-semibold text-white uppercase tracking-tight">Temporary Password Replacement</h3>
                  <p className="text-xs text-white/45 mt-1">
                    First login detected. Our enterprise infrastructure requires a secure custom password change to unlock standard dashboard access.
                  </p>
                </div>
              </div>

              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-mono text-white/40 mb-1">New Secure Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    className="w-full bg-black border border-white/10 rounded-none px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 transition placeholder-white/20"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-mono text-white/40 mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Verify exactly"
                    className="w-full bg-black border border-white/10 rounded-none px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 transition placeholder-white/20"
                    required
                  />
                </div>

                {passError && (
                  <p className="text-xs text-red-400 font-mono italic">{passError}</p>
                )}

                {passSuccess && (
                  <p className="text-xs text-emerald-400 font-mono">Password updated successfully! Reloading dashboard parameters...</p>
                )}

                <button
                  type="submit"
                  className="w-full bg-white text-black font-semibold uppercase tracking-[0.15em] text-xs py-3 rounded-none hover:bg-white/90 transition cursor-pointer"
                >
                  Verify and Sync Credentials
                </button>
              </form>
            </div>
          ) : (
            /* DENSE SYSTEM CONTROLLER DASHBOARD PANELS */
            <div>
              {/* ADMIN DASHBOARD COMPONENT */}
              {user.role === "admin" ? (
                <div>
                  {/* ADMIN STATS SUMMARY LINE */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                    <div className="p-5 bg-[#0e0e0e] border border-white/5 rounded-none flex flex-col justify-between">
                      <span className="text-[10px] uppercase font-mono tracking-widest text-white/40">Tracked Staff</span>
                      <span className="text-3xl font-light text-white mt-1 font-mono">{employees.length}</span>
                      <div className="mt-4 h-1 w-full bg-white/5">
                        <div className="h-full bg-white w-[100%]"></div>
                      </div>
                      <span className="text-[9px] text-white/30 mt-2 uppercase font-mono tracking-wider">Active Contractors</span>
                    </div>

                    <div className="p-5 bg-[#0e0e0e] border border-white/5 rounded-none flex flex-col justify-between">
                      <span className="text-[10px] uppercase font-mono tracking-widest text-white/40">Cumulative Hours</span>
                      <span className="text-3xl font-light text-white mt-1 font-mono">
                        {allLogs.filter(l => l.isSubmitted).reduce((sum, l) => sum + l.totalHours, 0).toFixed(1)}
                      </span>
                      <div className="mt-4 h-1 w-full bg-white/5">
                        <div className="h-full bg-white/60 w-[75%]"></div>
                      </div>
                      <span className="text-[9px] text-white/30 mt-2 uppercase font-mono tracking-wider">Verified Invoices Pool</span>
                    </div>

                    <div className="p-5 bg-[#0e0e0e] border border-white/5 rounded-none flex flex-col justify-between">
                      <span className="text-[10px] uppercase font-mono tracking-widest text-white/40">Open Leaves Requests</span>
                      <span className="text-3xl font-light text-white mt-1 font-mono">
                        {allLeaves.filter(req => req.status === "pending").length}
                      </span>
                      <div className="mt-4 h-1 w-full bg-white/5">
                        <div className={`h-full ${allLeaves.filter(req => req.status === "pending").length > 0 ? "bg-red-500" : "bg-white/20"} w-[30%]`}></div>
                      </div>
                      <span className="text-[9px] text-white/30 mt-2 uppercase font-mono tracking-wider">Requires Prompt Review</span>
                    </div>

                    <div className="p-5 bg-[#0e0e0e] border border-white/5 rounded-none flex flex-col justify-between">
                      <span className="text-[10px] uppercase font-mono tracking-widest text-white/40">Est. Total Payroll</span>
                      <span className="text-3xl font-light text-white mt-1 font-mono">
                        ${allInvoices.reduce((sum, l) => sum + l.amountDue, 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </span>
                      <div className="mt-4 h-1 w-full bg-white/5">
                        <div className="h-full bg-white w-[85%]"></div>
                      </div>
                      <span className="text-[9px] text-white/30 mt-2 uppercase font-mono tracking-wider">Disbursed Invoices Pool</span>
                    </div>
                  </div>

                  {/* ADMIN NAVIGATION RAIL */}
                  <nav className="flex flex-wrap border-b border-white/10 gap-2 mb-8">
                    {[
                      { id: "overview", label: "Team Overview", icon: Shield },
                      { id: "worklogs", label: "Employee Worklogs", icon: Clock },
                      { id: "leaves", label: "Leaves Desk", icon: CalendarIcon },
                      { id: "calendar", label: "Staff Interactive Calendar", icon: CalendarIcon },
                      { id: "billing", label: "Weekly Payroll", icon: FileSpreadsheet },
                      { id: "audit", label: "Security Audit Logs", icon: Lock },
                      { id: "settings", label: "Workforce Settings", icon: Settings }
                    ].map((tab) => {
                      const IconComponent = tab.icon;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setAdminTab(tab.id as any)}
                          className={`flex items-center gap-2 px-4 py-3 text-xs uppercase font-mono tracking-[0.15em] border-b-2 transition cursor-pointer ${
                            adminTab === tab.id
                              ? "border-white text-white bg-white/[0.04]"
                              : "border-transparent text-white/40 hover:text-white"
                          }`}
                        >
                          <IconComponent size={13} />
                          {tab.label}
                        </button>
                      );
                    })}
                  </nav>

                  {/* TAB 1: ADMIN TEAM OVERVIEW */}
                  {adminTab === "overview" && (
                    <div className="space-y-6">
                      <div className="bg-[#0e0e0e] border border-white/5 rounded-none p-6">
                        <div className="flex justify-between items-end mb-6 pb-2 border-b border-white/5">
                          <h3 className="font-display tracking-[0.2em] text-xs text-white/80 font-bold uppercase">REGISTERED STAFF PROFILES</h3>
                          <span className="text-[10px] uppercase font-mono text-white/40 tracking-wider">Managed Rate Index</span>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-white/10 text-white/40 font-mono uppercase text-[9px] tracking-wider">
                                <th className="py-3 px-4">Worker ID</th>
                                <th className="py-3 px-4">Full Name</th>
                                <th className="py-3 px-4">Official Email</th>
                                <th className="py-3 px-4">Temporary Code Required</th>
                                <th className="py-3 px-4">Hourly Custom Rate (USD)</th>
                                <th className="py-3 px-4 text-right">Action Panel</th>
                              </tr>
                            </thead>
                            <tbody>
                              {employees.map((emp) => (
                                <tr key={emp.id} className="border-b border-white/5 hover:bg-white/[0.02] transition">
                                  <td className="py-3 px-4 font-mono text-white/40">{emp.id}</td>
                                  <td className="py-3 px-4 font-medium text-white">{emp.name}</td>
                                  <td className="py-3 px-4 text-white/70">{emp.email}</td>
                                  <td className="py-3 px-4 font-mono">
                                    {emp.mustChangePassword ? (
                                      <span className="text-white bg-white/10 border border-white/25 px-2 py-0.5 rounded-none text-[9px] font-bold tracking-widest uppercase">YES</span>
                                    ) : (
                                      <span className="text-white/40 bg-white/5 border border-white/5 px-2 py-0.5 rounded-none text-[9px] tracking-widest uppercase">NO</span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4 font-mono">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-white/30">$</span>
                                      <input
                                        type="number"
                                        defaultValue={emp.hourlyRate}
                                        onBlur={(e) => updateHourlyRate(emp.id, e.target.value)}
                                        className="w-16 bg-black border border-white/10 rounded-none px-1.5 py-0.5 text-white font-mono text-right focus:outline-none focus:border-white/30"
                                      />
                                      <span className="text-white/30">/hr</span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 text-right">
                                    <button
                                      onClick={() => {
                                        setBillEmployeeId(emp.id);
                                        setAdminTab("billing");
                                      }}
                                      className="text-[10px] uppercase tracking-widest text-white hover:underline cursor-pointer font-mono"
                                    >
                                      Compile Weekly Billing
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* LIVE FIELD ACTIVITY PULSE */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-[#0e0e0e] border border-white/5 rounded-none p-6">
                          <h4 className="font-display text-[10px] text-white/50 tracking-[0.2em] font-bold uppercase mb-4">Live Workforce Pulses</h4>
                          <div className="space-y-4">
                            {employees.map((emp) => {
                              const empLogs = allLogs.filter(l => l.userId === emp.id && l.date === todayStr);
                              const openLog = empLogs.find(l => !l.isSubmitted);
                              const isSubmitted = empLogs.some(l => l.isSubmitted);

                              let statusText = "Off Duty";
                              let pulseColor = "bg-neutral-800";

                              if (openLog) {
                                const lastBr = openLog.breaks[openLog.breaks.length - 1];
                                if (lastBr && lastBr.end === null) {
                                  statusText = "On Lunch Break";
                                  pulseColor = "bg-yellow-500 animate-pulse";
                                } else {
                                  statusText = "Clocked In & Active";
                                  pulseColor = "bg-green-500 animate-pulse";
                                }
                              } else if (isSubmitted) {
                                statusText = "Workday Complete (Locked)";
                                pulseColor = "bg-white/40";
                              }

                              return (
                                <div key={emp.id} className="flex items-center justify-between p-3 bg-[#050505] border border-white/5 rounded-none">
                                  <div className="flex items-center gap-3">
                                    <span className={`w-2 h-2 rounded-full ${pulseColor}`} />
                                    <div>
                                      <p className="text-xs font-medium text-white">{emp.name}</p>
                                      <p className="text-[10px] text-white/40 font-mono mt-0.5">{emp.email}</p>
                                    </div>
                                  </div>
                                  <span className="text-[10px] font-mono tracking-widest uppercase text-white/50">{statusText}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* LEAVE NOTIFICATION BLOCKS QUICK ACTION */}
                        <div className="bg-[#0e0e0e] border border-white/5 rounded-none p-6 flex flex-col justify-between">
                          <div>
                            <h4 className="font-display text-[10px] text-white/50 tracking-[0.2em] font-bold uppercase mb-4">Pending Leave Requests Review</h4>
                            <div className="space-y-3">
                              {allLeaves.filter(req => req.status === "pending").length === 0 ? (
                                <p className="text-xs text-white/40 italic py-6 text-center">No outstanding leave requests.</p>
                              ) : (
                                allLeaves.filter(req => req.status === "pending").slice(0, 3).map((leave) => (
                                  <div key={leave.id} className="p-4 bg-[#050505] border border-white/5 rounded-none text-xs">
                                    <div className="flex justify-between font-bold text-white uppercase tracking-wider">
                                      <span>{leave.employeeName}</span>
                                      <span className="font-mono text-[9px] text-white/40 tracking-wider">Pending Decision</span>
                                    </div>
                                    <p className="text-white/40 mt-1 font-mono text-[10px]">{leave.startDate} to {leave.endDate}</p>
                                    <p className="text-white/70 mt-2 italic">"{leave.reason}"</p>
                                    <div className="flex gap-2 mt-3">
                                      <button
                                        onClick={() => setLeaveActionId(leave.id)}
                                        className="h-8 px-4 bg-white text-black font-bold text-[9px] uppercase tracking-widest rounded-none transition hover:bg-white/90 cursor-pointer"
                                      >
                                        Inspect / Act
                                      </button>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: DETAILED WORKLOGS */}
                  {adminTab === "worklogs" && (
                    <div className="bg-[#0e0e0e] border border-white/5 rounded-none p-6">
                      <h3 className="font-display tracking-[0.2em] text-xs text-white/80 font-bold mb-6 pb-2 border-b border-white/5 uppercase">Work Ledger Reports Database</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-white/10 text-white/40 font-mono uppercase text-[9px] tracking-wider">
                              <th className="py-2.5 px-4">Date</th>
                              <th className="py-2.5 px-4">Employee</th>
                              <th className="py-2.5 px-4">Clocked In</th>
                              <th className="py-2.5 px-4">Clocked Out</th>
                              <th className="py-2.5 px-4">Break Sessions</th>
                              <th className="py-2.5 px-4 font-mono text-right">Sum Hours</th>
                              <th className="py-2.5 px-4 text-center">Log Submission</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allLogs.map((log) => (
                              <tr key={log.id} className="border-b border-white/5 hover:bg-white/[0.02] transition">
                                <td className="py-3 px-4 font-mono text-white">{log.date}</td>
                                <td className="py-3 px-4 font-bold text-white uppercase tracking-wider">{log.employeeName}</td>
                                <td className="py-3 px-4 font-mono text-white/70">
                                  {log.clockIn ? new Date(log.clockIn).toLocaleTimeString() : <span className="text-white/20">--</span>}
                                </td>
                                <td className="py-3 px-4 font-mono text-white/70">
                                  {log.clockOut ? new Date(log.clockOut).toLocaleTimeString() : <span className="text-white/20">--</span>}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="text-[10px] text-white/50 space-y-0.5">
                                    {log.breaks.length === 0 ? (
                                      <span className="text-white/20">None</span>
                                    ) : (
                                      log.breaks.map((b, i) => (
                                        <div key={i}>
                                          <span className="font-mono">{new Date(b.start).toLocaleTimeString()}</span>
                                          {" → "}
                                          <span className="font-mono">{b.end ? new Date(b.end).toLocaleTimeString() : "Ongoing"}</span>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-4 font-mono text-right font-semibold text-white">{log.totalHours.toFixed(2)}h</td>
                                <td className="py-3 px-4 text-center font-mono">
                                  {log.isSubmitted ? (
                                    <span className="text-white bg-white/10 border border-white/20 px-2.5 py-0.5 rounded-none text-[9px] font-bold tracking-widest uppercase">FINALIZED</span>
                                  ) : (
                                    <span className="text-white/50 bg-white/5 border border-white/5 px-2.5 py-0.5 rounded-none text-[9px] tracking-widest uppercase">DUTY ONGOING</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: LEAVES DESK */}
                  {adminTab === "leaves" && (
                    <div className="space-y-6">
                      <div className="bg-[#0e0e0e] border border-white/5 rounded-none p-6">
                        <h3 className="font-display tracking-[0.2em] text-xs text-white/80 font-bold mb-6 pb-2 border-b border-white/5 uppercase">Leaves Registration Board</h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-white/10 text-white/40 font-mono uppercase text-[9px] tracking-wider">
                                <th className="py-2.5 px-4">Employee</th>
                                <th className="py-2.5 px-4">Duration Date Range</th>
                                <th className="py-2.5 px-4">Reason Statement</th>
                                <th className="py-2.5 px-4">Decision Status</th>
                                <th className="py-2.5 px-4">Review notes</th>
                                <th className="py-2.5 px-4 text-right">Review desk</th>
                              </tr>
                            </thead>
                            <tbody>
                              {allLeaves.map((leave) => (
                                <tr key={leave.id} className="border-b border-white/5 hover:bg-white/[0.02] transition">
                                  <td className="py-3 px-4 font-bold text-white uppercase tracking-wider">{leave.employeeName}</td>
                                  <td className="py-3 px-4 font-mono text-white/70">{leave.startDate} to {leave.endDate}</td>
                                  <td className="py-3 px-4 text-white/60 italic">"{leave.reason}"</td>
                                  <td className="py-3 px-4 font-mono">
                                    {leave.status === "pending" && (
                                      <span className="text-white/60 bg-white/5 border border-white/10 px-2.5 py-1 rounded-none text-[9px] font-bold tracking-widest uppercase">PENDING</span>
                                    )}
                                    {leave.status === "approved" && (
                                      <span className="text-white bg-white/20 border border-white/25 px-2.5 py-1 rounded-none text-[9px] font-bold tracking-widest uppercase">APPROVED</span>
                                    )}
                                    {leave.status === "denied" && (
                                      <span className="text-red-400 bg-red-950/20 border border-red-500/20 px-2.5 py-1 rounded-none text-[9px] font-bold tracking-widest uppercase">DENIED</span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4 text-white/50 font-mono text-[11px]">
                                    {leave.adminComment || "--"}
                                  </td>
                                  <td className="py-3 px-4 text-right">
                                    {leave.status === "pending" ? (
                                      <button
                                        onClick={() => setLeaveActionId(leave.id)}
                                        className="text-[9px] bg-white text-black font-bold uppercase tracking-widest px-3 py-1.5 rounded-none hover:bg-white/90 transition cursor-pointer"
                                      >
                                        ACT
                                      </button>
                                    ) : (
                                      <span className="text-white/30 font-mono text-[10px] uppercase tracking-wider">Reviewed</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 4: INTERACTIVE CALENDAR BOARD */}
                  {adminTab === "calendar" && (
                    <div className="bg-[#0e0e0e] border border-white/5 rounded-none p-6">
                      <div className="flex justify-between items-center mb-6 pb-2 border-b border-white/5">
                        <h3 className="font-display tracking-[0.2em] text-xs text-white/80 font-bold uppercase">ENTERPRISE INTERACTIVE MONTH CALENDAR</h3>
                        <div className="flex items-center gap-2">
                          <button onClick={handlePrevMonth} className="p-1.5 border border-white/10 rounded-none hover:bg-white/5 transition cursor-pointer">
                            <ChevronLeft size={16} />
                          </button>
                          <span className="font-mono font-bold uppercase tracking-widest text-white w-36 text-center text-xs">
                            {monthNames[calendarMonth]} {calendarYear}
                          </span>
                          <button onClick={handleNextMonth} className="p-1.5 border border-white/10 rounded-none hover:bg-white/5 transition cursor-pointer">
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-7 gap-1 text-center font-mono text-[10px] uppercase text-white/40 pb-2 border-b border-white/5">
                        <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
                      </div>

                      <div className="grid grid-cols-7 gap-1.5 mt-2">
                        {calendarDays.map((day, ix) => {
                          if (!day.dateStr) {
                            return <div key={ix} className="h-20 bg-white/[0.01] rounded-none opacity-20 border border-transparent" />;
                          }

                          const { hasLogs, hoursLogged, hasApprovedLeave, hasPendingLeave, dayLogs, dayLeaves } = getCellStatus(day.dateStr);

                          return (
                            <div
                              key={day.dateStr}
                              onClick={() => handleDayClick(day.dateStr)}
                              className={`h-20 p-2 bg-[#050505] hover:bg-white/[0.03] border rounded-none transition flex flex-col justify-between items-start text-left cursor-pointer group ${
                                hasApprovedLeave
                                  ? "border-white/30 bg-white/[0.04]"
                                  : "border-white/5 hover:border-white/20"
                              }`}
                            >
                              <span className="text-xs font-mono font-semibold text-white/40 group-hover:text-white">{day.dayNum}</span>
                              <div className="w-full space-y-1">
                                {hasLogs && (
                                  <div className="text-[9px] bg-white/10 border border-white/20 text-white font-mono px-1 py-0.5 rounded-none flex justify-between">
                                    <span>Time</span>
                                    <span>{hoursLogged.toFixed(1)}h</span>
                                  </div>
                                )}
                                {hasApprovedLeave && (
                                  <span className="text-[8px] uppercase tracking-widest bg-white text-black px-1 py-0.5 font-mono block text-center truncate">
                                    LEAVE
                                  </span>
                                )}
                                {hasPendingLeave && (
                                  <span className="text-[8px] uppercase tracking-widest bg-white/5 text-white/40 border border-white/10 px-1 py-0.5 font-mono block text-center truncate italic">
                                    Pending
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* TAB 5: WEEKLY PYROLL BILLING & INVOICES */}
                  {adminTab === "billing" && (
                    <div className="space-y-8">
                      {/* INVOICE COMPILER GENERATOR FORM */}
                      <div className="bg-[#0e0e0e] border border-white/5 rounded-none p-6">
                        <div className="pb-3 border-b border-white/5 mb-5">
                          <h3 className="font-display tracking-[0.2em] text-xs text-white/80 font-bold uppercase">AUTOMATED WEEKLY PAYROLL GENERATOR</h3>
                          <p className="text-xs text-white/40 mt-1 font-mono uppercase tracking-wider">
                            Choose an active staff member and date boundary (Monday through Sunday) to compute worked times, deduct breaks, lock rates, and broadcast mutual invoices.
                          </p>
                        </div>

                        <form onSubmit={handleBillingGenerate} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                          <div>
                            <label className="block text-[10px] uppercase tracking-widest font-mono text-white/40 mb-1">Contractor Workforce</label>
                            <select
                              value={billEmployeeId}
                              onChange={(e) => setBillEmployeeId(e.target.value)}
                              className="w-full bg-black border border-white/10 rounded-none px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-white/30"
                              required
                            >
                              <option value="">-- Choose Employee --</option>
                              {employees.map(e => (
                                <option key={e.id} value={e.id}>{e.name} (${e.hourlyRate}/hr)</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] uppercase tracking-widest font-mono text-white/40 mb-1">Period Start (Mon)</label>
                            <input
                              type="date"
                              value={billStart}
                              onChange={(e) => setBillStart(e.target.value)}
                              className="w-full bg-black border border-white/10 rounded-none px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-white/30"
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] uppercase tracking-widest font-mono text-white/40 mb-1">Period End (Sun)</label>
                            <input
                              type="date"
                              value={billEnd}
                              onChange={(e) => setBillEnd(e.target.value)}
                              className="w-full bg-black border border-white/10 rounded-none px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-white/30"
                              required
                            />
                          </div>

                          <button
                            type="submit"
                            className="w-full bg-white text-black font-semibold uppercase tracking-[0.15em] text-xs py-2.5 px-3 rounded-none hover:bg-white/90 transition cursor-pointer"
                          >
                            Generate Ledger Invoice
                          </button>
                        </form>

                        {billError && <p className="text-xs text-red-400 font-mono mt-3 italic">{billError}</p>}
                        {billSuccess && <p className="text-xs text-emerald-400 font-mono mt-3">{billSuccess}</p>}
                      </div>

                      {/* ISSUED SERVICE INVOICES ARCHIVE */}
                      <div className="bg-[#0e0e0e] border border-white/5 rounded-none p-6">
                        <h3 className="font-display tracking-[0.2em] text-xs text-white/80 font-bold mb-6 uppercase">Issued Payroll Invoices Archive</h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-white/10 text-white/40 font-mono uppercase text-[9px] tracking-wider">
                                <th className="py-2.5 px-4">Invoice ID</th>
                                <th className="py-2.5 px-4">Contractor Name</th>
                                <th className="py-2.5 px-4">Ledger Date Range</th>
                                <th className="py-2.5 px-4 font-mono text-right">Hours Pool</th>
                                <th className="py-2.5 px-4 font-mono text-right">Locked Rate</th>
                                <th className="py-2.5 px-4 font-mono text-right">Amount Due</th>
                                <th className="py-2.5 px-4 text-right">Statement Act</th>
                              </tr>
                            </thead>
                            <tbody>
                              {allInvoices.map((inv) => (
                                <tr key={inv.id} className="border-b border-white/5 hover:bg-white/[0.02] transition">
                                  <td className="py-3 px-4 font-mono text-white/45">{inv.id}</td>
                                  <td className="py-3 px-4 font-bold text-white uppercase tracking-wider">{inv.employeeName}</td>
                                  <td className="py-3 px-4 font-mono text-white/50">{inv.startDate} to {inv.endDate}</td>
                                  <td className="py-3 px-4 font-mono text-right">{inv.totalHours.toFixed(2)} hrs</td>
                                  <td className="py-3 px-4 font-mono text-right">${inv.hourlyRate}/hr</td>
                                  <td className="py-3 px-4 font-mono text-right font-semibold text-white">${inv.amountDue.toFixed(2)}</td>
                                  <td className="py-3 px-4 text-right">
                                    <button
                                      onClick={() => setViewInvoice(inv)}
                                      className="text-[9px] text-white bg-white/5 hover:bg-white/15 px-2.5 py-1.5 rounded-none font-mono uppercase tracking-widest inline-flex items-center gap-1 cursor-pointer border border-white/10"
                                    >
                                      <FileText size={11} /> View Ledger Sheet
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 6: SECURITY AUDIT LOGS */}
                  {adminTab === "audit" && (
                    <div className="bg-[#0e0e0e] border border-white/5 rounded-none p-6">
                      <h3 className="font-display tracking-[0.2em] text-xs text-white/80 font-bold mb-6 uppercase">Enterprise Cyber Security Audit Log</h3>
                      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-white/10 text-white/40 font-mono uppercase text-[9px] tracking-wider">
                              <th className="py-2.5 px-4">Timestamp</th>
                              <th className="py-2.5 px-4">Security User</th>
                              <th className="py-2.5 px-4">Action Register</th>
                              <th className="py-2.5 px-4">Log Verification details</th>
                            </tr>
                          </thead>
                          <tbody>
                            {auditLogs.map((log) => (
                              <tr key={log.id} className="border-b border-white/5 font-mono text-[11px] hover:bg-white/[0.02] transition">
                                <td className="py-2.5 px-4 text-white/30">{new Date(log.timestamp).toLocaleString()}</td>
                                <td className="py-2.5 px-4 text-white font-semibold uppercase">{log.userName}</td>
                                <td className="py-2.5 px-4 text-white font-light">{log.action}</td>
                                <td className="py-2.5 px-4 text-white/50">{log.details}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* TAB 7: WORKFORCE SETTINGS */}
                  {adminTab === "settings" && (
                    <div className="bg-[#0e0e0e] border border-white/5 rounded-none p-6">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                        <div>
                          <h3 className="font-display tracking-[0.2em] text-xs text-white/85 font-bold uppercase">Workforce Personnel Settings</h3>
                          <p className="text-[10px] text-white/40 mt-1 uppercase font-mono tracking-wider">Configure corporate positions, active hourly roles, and payroll definitions</p>
                        </div>
                        {settingsStatusMsg && (
                          <div className="bg-white/10 border border-white/20 text-white text-[11px] font-mono py-1 px-3 uppercase tracking-wider">
                            {settingsStatusMsg}
                          </div>
                        )}
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-white/10 text-white/40 font-mono uppercase text-[9px] tracking-wider">
                              <th className="py-3 px-4 w-1/12">Worker ID</th>
                              <th className="py-3 px-4 w-3/12">Full Name</th>
                              <th className="py-3 px-4 w-4/12">Position in the Company</th>
                              <th className="py-3 px-4 w-2/12">Hourly custom Rate</th>
                              <th className="py-3 px-4 text-right w-2/12">Settings Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {employees.map((emp) => {
                              const isEditing = editingEmpId === emp.id;
                              return (
                                <tr key={emp.id} className="border-b border-white/5 hover:bg-white/[0.02] transition">
                                  <td className="py-4 px-4 font-mono text-white/40">{emp.id}</td>
                                  <td className="py-4 px-4 font-bold text-white select-none">
                                    {emp.name}
                                    <span className="block text-[10px] text-white/45 font-mono font-normal mt-0.5">{emp.email}</span>
                                  </td>
                                  <td className="py-4 px-4">
                                    {isEditing ? (
                                      <input
                                        type="text"
                                        value={editingPosition}
                                        onChange={(e) => setEditingPosition(e.target.value)}
                                        className="w-full bg-black border border-white/20 rounded-none px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-white/50 text-xs"
                                        placeholder="Enter position title..."
                                      />
                                    ) : (
                                      <span className="text-white/80 font-mono text-[11px] bg-white/[0.04] px-2 py-1 border border-white/15 uppercase tracking-wide">
                                        {emp.position || "Contractor Specialist"}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-4 px-4">
                                    {isEditing ? (
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-white/45 font-mono">$</span>
                                        <input
                                          type="number"
                                          value={editingRate}
                                          onChange={(e) => setEditingRate(e.target.value)}
                                          className="w-24 bg-black border border-white/20 rounded-none px-2 py-1.5 text-white font-mono text-right focus:outline-none focus:border-white/50 text-xs"
                                          min="0"
                                          step="1"
                                        />
                                        <span className="text-white/45 font-mono">/hr</span>
                                      </div>
                                    ) : (
                                      <span className="text-white font-mono font-bold">${emp.hourlyRate} / hr</span>
                                    )}
                                  </td>
                                  <td className="py-4 px-4 text-right font-mono">
                                    {isEditing ? (
                                      <div className="flex justify-end gap-2.5">
                                        <button
                                          onClick={async () => {
                                            const rateNum = Number(editingRate);
                                            if (isNaN(rateNum) || rateNum < 0) {
                                              setSettingsStatusMsg("Error: Invalid hourly rate input.");
                                              return;
                                            }
                                            const success = await updateEmployeeSettings(emp.id, rateNum, editingPosition);
                                            if (success) {
                                              setSettingsStatusMsg("Success: Profile settings updated.");
                                              setEditingEmpId(null);
                                              setTimeout(() => setSettingsStatusMsg(""), 4000);
                                            } else {
                                              setSettingsStatusMsg("Error: Failed to save changes.");
                                            }
                                          }}
                                          className="text-[10px] uppercase tracking-widest text-white hover:text-[#e0e0e0] bg-white/20 hover:bg-white/25 px-3 py-1.5 border border-white/10 transition cursor-pointer font-bold"
                                        >
                                          Save
                                        </button>
                                        <button
                                          onClick={() => {
                                            setEditingEmpId(null);
                                            setSettingsStatusMsg("");
                                          }}
                                          className="text-[10px] uppercase tracking-widest text-white/50 hover:text-white bg-transparent hover:bg-white/5 px-2.5 py-1.5 transition cursor-pointer"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => {
                                          setEditingEmpId(emp.id);
                                          setEditingPosition(emp.position || "Contractor Specialist");
                                          setEditingRate(String(emp.hourlyRate));
                                        }}
                                        className="text-[10px] uppercase tracking-widest text-white/80 hover:text-white border border-white/15 hover:border-white/35 px-3.5 py-1.5 hover:bg-white/5 transition cursor-pointer"
                                      >
                                        Edit Details
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* EMPLOYEE PERSONAL PORTAL DASHBOARD */
                <div>
                  {/* EMPLOYEE WORKER STATE SUMMARY CARD */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 bg-[#0e0e0e] border border-white/5 rounded-none p-6">
                    <div className="space-y-1">
                      <h3 className="text-white/40 text-[10px] font-mono uppercase tracking-[0.15em]">Active Verification Profile</h3>
                      <p className="text-lg font-light text-white mt-1">{user.name}</p>
                      <p className="text-xs text-white/50 font-mono">{user.email}</p>
                      <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 bg-white/5 border border-white/10 rounded-none font-mono text-[11px] text-white">
                        <DollarSign size={12} />
                        Personal Billing Rate: ${user.hourlyRate}/hr
                      </div>
                    </div>

                    <div className="lg:border-l lg:border-r border-white/5 lg:px-6 py-4 lg:py-0 flex flex-col justify-between">
                      <h3 className="text-white/40 text-[10px] font-mono uppercase tracking-[0.15em]">Subtotal Accumulations (This Period)</h3>
                      <div className="mt-2">
                        <p className="text-3xl font-light font-mono text-white">
                          {personalLogs.filter(l => l.isSubmitted).reduce((sum, current) => sum + current.totalHours, 0).toFixed(2)}h
                        </p>
                        <p className="text-[10px] tracking-widest text-white/50 font-mono uppercase mt-1">Est. Accrued Earnings: ${ (personalLogs.filter(l => l.isSubmitted).reduce((sum, current) => sum + current.totalHours, 0) * user.hourlyRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }</p>
                      </div>
                    </div>

                    <div className="flex flex-col justify-between">
                      <h3 className="text-white/40 text-[10px] font-mono uppercase tracking-[0.15em]">Active Working Status</h3>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`w-3.5 h-3.5 rounded-full ${
                          currentWorkStatus === "On Work"
                            ? "bg-green-500 animate-pulse"
                            : currentWorkStatus === "On Break"
                            ? "bg-yellow-500 animate-pulse"
                            : "bg-neutral-800"
                        }`} />
                        <span className="text-white font-semibold font-mono text-sm uppercase tracking-wider">{currentWorkStatus}</span>
                      </div>
                      <p className="text-[10px] text-white/30 mt-2">All times updated to the centralized local registry securely.</p>
                    </div>
                  </div>

                  {/* EMPLOYEE PORTAL TAB OPTIONS Nav */}
                  <nav className="flex flex-wrap border-b border-white/10 gap-2 mb-8">
                    {[
                      { id: "punch", label: "Workday Punch Station", icon: Clock },
                      { id: "leaves", label: "Leaves Desk", icon: CalendarIcon },
                      { id: "calendar", label: "Worksheets", icon: CalendarIcon },
                      { id: "invoices", label: "My Weekly Invoices", icon: FileText }
                    ].map((tab) => {
                      const IconComponent = tab.icon;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setEmpTab(tab.id as any)}
                          className={`flex items-center gap-2 px-4 py-3 text-xs uppercase font-mono tracking-[0.15em] border-b-2 transition cursor-pointer ${
                            empTab === tab.id
                              ? "border-white text-white bg-white/[0.04]"
                              : "border-transparent text-white/40 hover:text-white"
                          }`}
                        >
                          <IconComponent size={13} />
                          {tab.label}
                        </button>
                      );
                    })}
                  </nav>

                  {/* TAB 1: EMPLOYEE PUNCH STATION */}
                  {empTab === "punch" && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {/* LIVE PUNSH CLOCK CONSOLE */}
                      <div className="p-8 bg-[#0e0e0e] border border-white/5 rounded-none flex flex-col items-center justify-between text-center min-h-[350px]">
                        <div>
                          <span className="text-[10px] uppercase font-mono tracking-[0.15em] text-white/40">Centralized Logging Node</span>
                          <h3 className="text-sm font-display tracking-[0.2em] text-white font-bold uppercase mt-1">BIOMETRIC PUNCH STATION</h3>
                        </div>

                        {/* LIVE TIMER CLOCK LOG DISPLAY */}
                        <div className="my-6">
                          <span className="text-4xl lg:text-5xl font-mono text-white tracking-[0.1em] block font-light">
                            {totalWorkedStr}
                          </span>
                          <span className="text-[10px] uppercase font-mono text-white/40 tracking-wider block mt-2">
                            Total worked duration today (Deducted Breaks)
                          </span>
                        </div>

                        {/* SUB-COUNTERS (ON BREAK TIMER) */}
                        {currentWorkStatus === "On Break" && (
                          <div className="px-5 py-2.5 bg-yellow-500/10 border border-yellow-500/25 rounded-none text-yellow-500 font-mono text-xs mb-4">
                            <span>Lunch/Short Break Timer: {activeBreakStr}</span>
                          </div>
                        )}

                        {/* INTERACTIVE COMPOSITE BUTTON CONTROLS */}
                        <div className="w-full max-w-sm space-y-3">
                          {alreadySubmittedToday ? (
                            <div className="bg-emerald-950/20 border border-emerald-500/20 text-emerald-400 p-4 rounded-none text-xs">
                              <Check className="mx-auto mb-2" size={24} />
                              <p className="font-semibold uppercase tracking-wider font-mono">Workday Complete</p>
                              <p className="mt-1 text-white/55">Your log for today ({todayStr}) has been locked, saved, and submitted to Evan Wilson Ventures Ventures.</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {/* CLOCK IN PANEL */}
                              {!activeTodayLog ? (
                                <button
                                  onClick={triggerClockIn}
                                  className="sm:col-span-2 w-full bg-white text-black font-semibold uppercase tracking-[0.15em] text-xs py-3.5 rounded-none transition cursor-pointer flex justify-center items-center gap-1.5"
                                >
                                  <Clock size={15} /> Clock In / Start Workday
                                </button>
                              ) : (
                                <>
                                  {/* TOGGLING BREAKS BUTTON */}
                                  {currentWorkStatus === "On Work" ? (
                                    <button
                                      onClick={triggerBreakStart}
                                      className="w-full bg-transparent hover:bg-white/5 text-white border border-white/20 font-semibold uppercase tracking-[0.1em] text-xs py-3 rounded-none transition cursor-pointer flex justify-center items-center gap-1.5"
                                    >
                                      <Coffee size={15} /> Take Break
                                    </button>
                                  ) : (
                                    <button
                                      onClick={triggerBreakEnd}
                                      className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-semibold uppercase tracking-[0.1em] text-xs py-3 rounded-none transition cursor-pointer flex justify-center items-center gap-1.5"
                                    >
                                      <Clock3 size={15} /> End Break
                                    </button>
                                  )}

                                  {/* FINAL CLOCK OUT PORTAL */}
                                  <button
                                    onClick={triggerClockOut}
                                    className={`w-full font-semibold uppercase tracking-[0.1em] text-xs py-3 rounded-none transition cursor-pointer flex justify-center items-center gap-1.5 ${
                                      showSubmitConfirm 
                                        ? "bg-red-600 hover:bg-red-500 text-white border border-red-700 font-bold" 
                                        : "bg-red-950/20 hover:bg-red-900/40 text-red-400 border border-red-500/20"
                                    }`}
                                  >
                                    {showSubmitConfirm ? (
                                      <>
                                        <AlertTriangle size={15} className="animate-bounce" /> Confirm Submit?
                                      </>
                                    ) : (
                                      <>
                                        <Unlock size={14} /> Submit Workday
                                      </>
                                    )}
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* WORKER SHORT RECENT LEDGER HISTORY */}
                      <div className="bg-[#0e0e0e] border border-white/5 rounded-none p-6">
                        <h3 className="font-display tracking-[0.2em] text-[10px] text-white/50 uppercase mb-4">Pristine Recent Worksheets Logs</h3>
                        <div className="space-y-3 max-h-[290px] overflow-y-auto pr-1">
                          {personalLogs.length === 0 ? (
                            <p className="text-xs text-white/40 italic py-8 text-center">No hours logged yet.</p>
                          ) : (
                            personalLogs.map((log) => (
                              <div key={log.id} className="p-3 bg-[#050505] border border-white/5 rounded-none flex items-center justify-between text-xs">
                                <div>
                                  <p className="font-mono font-semibold text-white">{log.date} ({new Date(log.date).toLocaleDateString(undefined, { weekday: "short" })})</p>
                                  <div className="text-[10px] text-white/40 font-mono mt-1 space-x-2">
                                    <span>In: {log.clockIn ? new Date(log.clockIn).toLocaleTimeString() : "--"}</span>
                                    <span>Out: {log.clockOut ? new Date(log.clockOut).toLocaleTimeString() : "--"}</span>
                                  </div>
                                </div>
                                <div className="text-right font-mono">
                                  <span className="font-mono font-semibold text-white text-md block">{log.totalHours.toFixed(2)}h</span>
                                  {log.isSubmitted ? (
                                    <span className="inline-flex items-center gap-0.5 text-[9px] uppercase font-mono tracking-widest text-[#a0a0a0]">
                                      <Lock size={9} /> File Locked
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-0.5 text-[9px] uppercase font-mono tracking-widest text-white/40 italic animate-pulse">
                                      Active Duty
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: DETAILED LEAVES DESK */}
                  {empTab === "leaves" && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {/* LEAVE FILER REQUEST APPLICATION */}
                      <div className="bg-[#0e0e0e] border border-white/5 rounded-none p-6 h-fit">
                        <h3 className="font-display tracking-[0.2em] text-xs text-white/50 font-bold mb-6 pb-2 border-b border-white/5 uppercase">Apply for Leave Absence</h3>

                        <form onSubmit={handleLeaveSubmit} className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] uppercase tracking-widest font-mono text-white/40 mb-1">Start Date</label>
                              <input
                                type="date"
                                value={leaveStart}
                                onChange={(e) => setLeaveStart(e.target.value)}
                                className="w-full bg-black border border-white/10 rounded-none px-3 py-2 text-xs text-white focus:outline-none focus:border-white/30"
                                required
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] uppercase tracking-widest font-mono text-white/40 mb-1">End Date</label>
                              <input
                                type="date"
                                value={leaveEnd}
                                onChange={(e) => setLeaveEnd(e.target.value)}
                                className="w-full bg-black border border-white/10 rounded-none px-3 py-2 text-xs text-white focus:outline-none focus:border-white/30"
                                required
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] uppercase tracking-widest font-mono text-white/40 mb-1">Detailed Reason Statement</label>
                            <textarea
                              rows={3}
                              value={leaveReason}
                              onChange={(e) => setLeaveReason(e.target.value)}
                              placeholder="Describe reasoning..."
                              className="w-full bg-black border border-white/10 rounded-none px-3 py-2 text-xs text-white focus:outline-none focus:border-white/30"
                              required
                            />
                          </div>

                          {leaveSubmitMsg && (
                            <p className="text-xs font-mono text-yellow-500 italic mt-2">{leaveSubmitMsg}</p>
                          )}

                          <button
                            type="submit"
                            className="w-full bg-white text-black font-semibold uppercase tracking-[0.15em] text-xs py-2.5 px-4 rounded-none hover:bg-white/90 transition cursor-pointer font-sans"
                          >
                            Transmit Leave Application
                          </button>
                        </form>
                      </div>

                      {/* PERSONAL LEAVE REQUEST ARCHIVE LIST */}
                      <div className="bg-[#0e0e0e] border border-white/5 rounded-none p-6">
                        <h3 className="font-display tracking-[0.2em] text-xs text-white/55 font-bold mb-6 pb-2 border-b border-white/5 uppercase">Absence requests Ledger</h3>
                        <div className="space-y-3">
                          {personalLeaves.length === 0 ? (
                            <p className="text-xs text-white/40 italic py-12 text-center">No absences requested.</p>
                          ) : (
                            personalLeaves.map((leave) => (
                              <div key={leave.id} className="p-4 bg-[#050505] border border-white/5 rounded-none text-xs space-y-2">
                                <div className="flex justify-between items-center pb-1 border-b border-white/5">
                                  <span className="font-mono font-semibold text-white">{leave.startDate} to {leave.endDate}</span>
                                  {leave.status === "pending" && <span className="text-white bg-white/5 border border-white/10 px-2 py-0.5 rounded-none text-[9px] font-bold tracking-widest uppercase">PENDING</span>}
                                  {leave.status === "approved" && <span className="text-white bg-white/20 border border-white/25 px-2 py-0.5 rounded-none text-[9px] font-bold tracking-widest uppercase">APPROVED</span>}
                                  {leave.status === "denied" && <span className="text-red-400 bg-red-950/20 border border-red-500/20 px-2.5 py-1 rounded-none text-[9px] font-bold tracking-widest uppercase">DENIED</span>}
                                </div>
                                <p className="text-white/60 italic">"{leave.reason}"</p>
                                {leave.adminComment && (
                                  <div className="p-2 border border-white/10 bg-[#0a0a0a] rounded-none text-[11px] font-mono text-white/65">
                                    <span className="text-white block font-semibold text-[10px] uppercase tracking-widest">Decision comments:</span>
                                    <span>{leave.adminComment}</span>
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: PERSONAL WORKSHEETS */}
                  {empTab === "calendar" && (
                    <div className="space-y-8">
                      {/* Weekly Clickable times navigation row */}
                      <div className="bg-[#0e0e0e] border border-white/5 rounded-none p-6 animate-fadeIn">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-4 border-b border-white/5">
                          <div>
                            <h3 className="font-display tracking-[0.2em] text-xs text-white/90 font-bold uppercase">Worksheet Week Selector</h3>
                            <p className="text-[10px] text-white/40 font-mono tracking-wider uppercase mt-1">Select a weekly period to view detailed clock event recordings</p>
                          </div>
                          <span className="text-[10px] bg-red-950/30 border border-red-500/25 text-red-400 font-mono px-2 py-1 uppercase tracking-widest font-bold">
                            Central Audited Payroll Logs
                          </span>
                        </div>

                        {/* List of clickable weeks block */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
                          {pastWeeks.map((wk, idx) => {
                            const isSelected = selectedWeekIdx === idx;
                            return (
                              <button
                                key={wk.label}
                                type="button"
                                onClick={() => setSelectedWeekIdx(idx)}
                                className={`p-3 border rounded-none text-center transition cursor-pointer flex flex-col justify-center items-center h-20 ${
                                  isSelected
                                    ? "bg-red-950/15 border-red-500 text-white shadow-[0_0_15px_rgba(224,0,0,0.15)] animate-pulse"
                                    : "bg-[#050505] border-white/10 text-white/50 hover:border-white/20 hover:text-white"
                                }`}
                              >
                                <span className={`text-[9px] uppercase font-mono tracking-widest font-bold mb-1 ${isSelected ? "text-red-400" : "text-white/30"}`}>
                                  Week {8 - idx}
                                </span>
                                <span className="text-[10px] font-mono leading-tight max-w-full truncate font-bold">
                                  {(() => {
                                    const parsed = wk.label.split(",");
                                    return parsed[0] || wk.label;
                                  })()}
                                </span>
                                <span className="text-[8px] font-mono text-white/30 mt-0.5">
                                  {wk.startDate.getFullYear()}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* FILTERED DETAILED LOGS FOR THE WEEK */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Selected week overview & quick metrics */}
                        <div className="bg-[#0e0e0e] border border-white/5 rounded-none p-6 h-fit space-y-6 lg:col-span-1">
                          <div>
                            <span className="text-[9px] font-mono text-red-400 uppercase tracking-widest font-bold block mb-1">
                              Selected Worksheet Info
                            </span>
                            <h4 className="text-sm font-bold text-white uppercase tracking-wider font-display">
                              {pastWeeks[selectedWeekIdx]?.label}
                            </h4>
                          </div>

                          {/* Quick Calculations of total hours logged this week */}
                          {(() => {
                            const weekStart = pastWeeks[selectedWeekIdx]?.startDate;
                            const weekEnd = new Date(weekStart);
                            weekEnd.setDate(weekStart.getDate() + 6); // Sun
                            weekEnd.setHours(23, 59, 59, 999);

                            const logsThisWeek = personalLogs.filter(log => {
                              const d = new Date(log.date + "T00:00:00");
                              return d >= weekStart && d <= weekEnd;
                            });

                            const totalHours = logsThisWeek.reduce((sum, current) => sum + current.totalHours, 0);
                            const totalSubmittedHours = logsThisWeek.filter(l => l.isSubmitted).reduce((sum, current) => sum + current.totalHours, 0);
                            const estimatedEarnings = totalHours * user.hourlyRate;

                            return (
                              <div className="space-y-4">
                                <div className="p-4 bg-[#050505] border border-white/5 rounded-none space-y-1">
                                  <span className="text-[9px] font-mono uppercase tracking-widest text-white/40 block">Cumulative Work Hours</span>
                                  <div className="flex justify-between items-baseline">
                                    <span className="text-2xl font-mono font-bold text-white pr-2">
                                      {totalHours.toFixed(2)} Hrs
                                    </span>
                                    <span className="text-[10px] font-mono text-white/45">
                                      ({totalSubmittedHours.toFixed(2)} submitted)
                                    </span>
                                  </div>
                                </div>

                                <div className="p-4 bg-[#050505] border border-white/5 rounded-none space-y-1">
                                  <span className="text-[9px] font-mono uppercase tracking-widest text-white/40 block">Est. Weekly Gross Balance</span>
                                  <span className="text-2xl font-mono font-bold text-red-500 block">
                                    ${estimatedEarnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                  <span className="text-[9px] font-mono text-white/30 block uppercase tracking-wider">
                                    Based on standard rate of ${user.hourlyRate}/Hr
                                  </span>
                                </div>

                                <div className="rounded-none border border-white/10 p-4 bg-white/[0.01] space-y-2">
                                  <span className="text-[9px] font-mono uppercase tracking-wider text-white/45 block font-bold">Week Security Status</span>
                                  <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${logsThisWeek.some(l => !l.isSubmitted) ? "bg-amber-500 animate-pulse" : logsThisWeek.length > 0 ? "bg-green-500" : "bg-neutral-600"}`} />
                                    <span className="text-xs font-mono text-white/80 uppercase tracking-wide">
                                      {logsThisWeek.length === 0 
                                        ? "No active log sessions" 
                                        : logsThisWeek.some(l => !l.isSubmitted) 
                                        ? "Active logs in queue" 
                                        : "All worksheets compiled"
                                      }
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Timeline of daily events (log in, break, end break, log out) */}
                        <div className="bg-[#0e0e0e] border border-white/5 rounded-none p-6 lg:col-span-2">
                          <h3 className="font-display tracking-[0.2em] text-[10px] text-white/50 uppercase mb-5">AUDITED CLOCK ACTION RECORDS</h3>
                          
                          {(() => {
                            const weekStart = pastWeeks[selectedWeekIdx]?.startDate;
                            const daysOfWeek: Date[] = [];
                            for (let dIdx = 0; dIdx < 7; dIdx++) {
                              const dayOf = new Date(weekStart);
                              dayOf.setDate(weekStart.getDate() + dIdx);
                              daysOfWeek.push(dayOf);
                            }

                            return (
                              <div className="space-y-4">
                                {daysOfWeek.map((dayObj) => {
                                  const formattedDateStr = `${dayObj.getFullYear()}-${(dayObj.getMonth()+1).toString().padStart(2, '0')}-${dayObj.getDate().toString().padStart(2, '0')}`;
                                  
                                  const dayLog = personalLogs.find(l => l.date === formattedDateStr);
                                  const dayName = dayObj.toLocaleString('en-US', { weekday: 'long' });
                                  const compactDate = dayObj.toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

                                  return (
                                    <div key={formattedDateStr} className="border border-white/5 bg-[#050505] p-5 rounded-none flex flex-col md:flex-row md:items-center justify-between gap-4 transition hover:border-white/10">
                                      <div className="space-y-1.5 min-w-[140px]">
                                        <span className="text-[10px] font-mono text-white/40 block font-bold uppercase tracking-widest leading-none">
                                          {dayName}
                                        </span>
                                        <span className="text-xs font-bold text-white block">
                                          {compactDate}
                                        </span>
                                      </div>

                                      {dayLog ? (
                                        <div className="flex-1 space-y-3">
                                          {/* Status badge and metadata info */}
                                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2">
                                            <div className="flex items-center gap-1.5">
                                              {dayLog.isSubmitted ? (
                                                <span className="text-[9px] bg-[#0c0c0c] border border-white/10 text-white/50 px-2 py-0.5 uppercase tracking-widest font-mono select-none">
                                                  Locked & Submitted
                                                </span>
                                              ) : (
                                                <span className="text-[9px] bg-red-950/30 border border-red-500/30 text-red-500 px-2 py-0.5 uppercase tracking-widest font-mono font-bold animate-pulse">
                                                  Active Work Day
                                                </span>
                                              )}
                                            </div>
                                            <span className="font-mono text-xs font-bold text-white bg-white/5 px-2.5 py-1 border border-white/10">
                                              Hours: {dayLog.totalHours.toFixed(2)}h
                                            </span>
                                          </div>

                                          {/* Clock action events timeline */}
                                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#0a0a0a] border border-white/5 p-3 rounded-none">
                                            {/* LOG IN */}
                                            <div className="space-y-1">
                                              <span className="text-[8px] font-mono uppercase text-white/35 block tracking-widest font-bold">Log In</span>
                                              <span className="text-xs font-mono font-bold text-white block">
                                                {dayLog.clockIn ? new Date(dayLog.clockIn).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : "--"}
                                              </span>
                                            </div>

                                            {/* BREAKS START / END */}
                                            <div className="space-y-1 col-span-2">
                                              <span className="text-[8px] font-mono uppercase text-white/35 block tracking-widest font-bold">Breaks Taken</span>
                                              {dayLog.breaks.length === 0 ? (
                                                <span className="text-[10px] font-mono text-white/20 block italic">No breaks reported</span>
                                              ) : (
                                                <div className="space-y-1 max-h-16 overflow-y-auto pr-1">
                                                  {dayLog.breaks.map((b, bIdx) => {
                                                    const bStart = new Date(b.start).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                                                    const bEnd = b.end 
                                                      ? new Date(b.end).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) 
                                                      : "Ongoing";
                                                    return (
                                                      <div key={bIdx} className="text-[9px] font-mono text-white/60 flex items-center justify-between">
                                                        <span>Break {bIdx + 1}:</span>
                                                        <span className="text-white font-bold">{bStart} → {bEnd}</span>
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              )}
                                            </div>

                                            {/* LOG OUT */}
                                            <div className="space-y-1 text-right md:text-left">
                                              <span className="text-[8px] font-mono uppercase text-white/35 block tracking-widest font-bold">Log Out</span>
                                              <span className="text-xs font-mono font-bold text-white block">
                                                {dayLog.clockOut ? new Date(dayLog.clockOut).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : (
                                                  <span className="text-red-400 italic text-[11px] animate-pulse">In Progress...</span>
                                                )}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="flex-1 flex items-center justify-center p-4 border border-dashed border-white/10 bg-white/[0.01]">
                                          <p className="text-[10px] font-mono uppercase text-white/30 tracking-widest italic">
                                            No workday worksheet logged for this day.
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* MONTH REVIEWS FOOTNOTE CALENDAR COMPLEMENT */}
                      <div className="bg-[#0e0e0e] border border-white/5 rounded-none p-6 space-y-4">
                        <div className="flex justify-between items-center border-b border-white/5 pb-2">
                          <div>
                            <h4 className="font-display tracking-[0.2em] text-xs text-white/70 font-bold uppercase">Monthly Interactive Summary Map</h4>
                            <p className="text-[10px] text-white/40 font-mono tracking-wider uppercase mt-1">Interactive month-view chart to look back onto long records</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={handlePrevMonth} className="p-1.5 border border-white/10 rounded-none hover:bg-white/5 transition cursor-pointer">
                              <ChevronLeft size={16} />
                            </button>
                            <span className="font-mono font-bold uppercase tracking-widest text-white w-32 text-center text-xs">
                              {monthNames[calendarMonth]} {calendarYear}
                            </span>
                            <button onClick={handleNextMonth} className="p-1.5 border border-white/10 rounded-none hover:bg-white/5 transition cursor-pointer">
                              <ChevronRight size={16} />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-7 gap-1 text-center font-mono text-[10px] uppercase text-white/40 pb-2 border-b border-white/5">
                          <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
                        </div>

                        <div className="grid grid-cols-7 gap-1.5 mt-2">
                          {calendarDays.map((day, ix) => {
                            if (!day.dateStr) {
                              return <div key={ix} className="h-14 bg-white/[0.01] rounded-none opacity-20 border border-transparent" />;
                            }

                            const { hasLogs, hoursLogged, hasApprovedLeave, hasPendingLeave } = getCellStatus(day.dateStr);

                            return (
                              <div
                                key={day.dateStr}
                                onClick={() => handleDayClick(day.dateStr)}
                                className={`h-14 p-1 rounded-none border transition flex flex-col justify-between items-start text-left cursor-pointer group ${
                                  hasApprovedLeave
                                    ? "bg-white/[0.04] border-white/35 text-white"
                                    : hasLogs
                                    ? "bg-red-950/10 border-red-500/25 hover:border-red-500/60"
                                    : "bg-[#050505] border-white/5 hover:border-white/20"
                                }`}
                              >
                                <span className="text-[10px] font-mono font-semibold text-white/40 group-hover:text-white leading-none">{day.dayNum}</span>
                                <div className="w-full">
                                  {hasLogs && (
                                    <div className="text-[9px] text-white/80 font-mono font-bold px-0.5 py-0.5 rounded-none flex justify-between">
                                      <span>{hoursLogged.toFixed(1)}h</span>
                                    </div>
                                  )}
                                  {hasApprovedLeave && (
                                    <span className="text-[7.5px] uppercase bg-white text-black px-0.5 py-0.2 font-mono block text-center truncate font-extrabold leading-none">
                                      Leave
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 4: PERSONAL INVOICES */}
                  {empTab === "invoices" && (
                    <div className="bg-[#0e0e0e] border border-white/5 rounded-none p-6">
                      <h3 className="font-display tracking-[0.2em] text-xs text-white/55 font-bold mb-6 uppercase">My Service Invoices Archive</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-white/10 text-white/40 font-mono uppercase text-[9px] tracking-wider">
                              <th className="py-2.5 px-4">Invoice ID</th>
                              <th className="py-2.5 px-4">Billing Period</th>
                              <th className="py-2.5 px-4 font-mono text-right">Hours Pool</th>
                              <th className="py-2.5 px-4 font-mono text-right">Locked Rate</th>
                              <th className="py-2.5 px-4 font-mono text-right">Amount Due</th>
                              <th className="py-2.5 px-4 text-right font-mono">Invoice Ledger Sheet</th>
                            </tr>
                          </thead>
                          <tbody>
                            {personalInvoices.map((inv) => (
                              <tr key={inv.id} className="border-b border-white/5 hover:bg-white/[0.02] transition">
                                <td className="py-3 px-4 font-mono text-white/45">{inv.id}</td>
                                <td className="py-3 px-4 font-mono text-white/50">{inv.startDate} to {inv.endDate}</td>
                                <td className="py-3 px-4 font-mono text-right">{inv.totalHours.toFixed(2)} hrs</td>
                                <td className="py-3 px-4 font-mono text-right">${inv.hourlyRate}/hr</td>
                                <td className="py-3 px-4 font-mono text-right font-semibold text-white">${inv.amountDue.toFixed(2)}</td>
                                <td className="py-3 px-4 text-right">
                                  <button
                                    onClick={() => setViewInvoice(inv)}
                                    className="text-[9px] text-white bg-white/5 hover:bg-white/15 px-2.5 py-1.5 rounded-none font-mono uppercase tracking-widest inline-flex items-center gap-1 cursor-pointer border border-white/10"
                                  >
                                    <FileText size={11} /> View Ledger Sheet
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      )}

      {/* MODAL 1: VIEW DETAILED PRINTABLE HOURLY LEDGER / INVOICE */}
      <AnimatePresence>
        {viewInvoice && (
          <div className="fixed inset-0 bg-black/95 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0a0a0a] border border-white/15 w-full max-w-3xl rounded-none p-8 shadow-2xl space-y-6 relative text-white/90 print:p-0 print:border-none"
            >
              {/* PRINT AND CLOSE HEADER PANEL */}
              <div className="flex justify-between items-center pb-4 border-b border-white/10 print:hidden">
                <button
                  type="button"
                  onClick={() => setViewInvoice(null)}
                  className="flex items-center gap-2 text-xs text-white/60 hover:text-white font-mono uppercase tracking-[0.1em] font-bold transition cursor-pointer bg-transparent border border-white/10 hover:border-white/30 px-3 py-1.5 hover:bg-white/5"
                >
                  <ArrowLeft size={13} /> Back
                </button>
                <span className="hidden md:inline text-xs text-white/50 font-mono uppercase tracking-[0.2em] font-bold">Premium Service Invoice Ledger</span>
                <div className="flex gap-3">
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 bg-white hover:bg-white/90 text-black font-bold text-xs uppercase tracking-widest py-2 px-4 rounded-none cursor-pointer"
                  >
                    <Download size={13} /> Print/Save PDF
                  </button>
                  <button
                    onClick={() => setViewInvoice(null)}
                    className="p-1.5 border border-white/10 rounded-none hover:bg-white/5 text-white/50 hover:text-white transition cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* INVOICE CONTENT SHEET */}
              <div className="space-y-6 flex flex-col justify-between" id="printable-invoice">
                {/* INVOICE LETTERHEAD */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b border-white/10">
                  <div>
                    <h2 className="font-display tracking-[0.2em] text-lg text-white font-bold">EVAN WILSON VENTURES LLC</h2>
                    <p className="text-[9px] font-mono tracking-widest text-[#a0a0a0] uppercase mt-0.5">Enterprise Operations Ledger</p>
                    <p className="text-[10px] text-white/40 mt-1 font-mono">evan@evanawilson.com</p>
                  </div>
                  <div className="text-left sm:text-right font-mono">
                    <p className="text-xs font-bold text-white uppercase tracking-widest">Service Billing Statement</p>
                    <p className="text-[11px] text-white/70 mt-1">Invoice ID: {viewInvoice.id}</p>
                    <p className="text-[10px] text-white/40 mt-0.5">Issued At: {new Date(viewInvoice.issuedAt).toLocaleDateString()}</p>
                  </div>
                </div>

                {/* CLIENT & PROVIDER BLOCK */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs font-mono">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase text-white/40 tracking-widest font-bold">Client / Bill To</p>
                    <p className="text-white font-bold">Evan Wilson Ventures LLC</p>
                    <p className="text-white/50">Head of Operations</p>
                    <p className="text-white/50">Denver, USA</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase text-white/40 tracking-widest font-bold">Service Provider / Bill From</p>
                    <p className="text-white font-bold">{viewInvoice.employeeName}</p>
                    <p className="text-white/50">
                      {employees.find(e => e.id === viewInvoice.userId || e.name === viewInvoice.employeeName)?.position || "Contractor Specialist"}
                    </p>
                    <p className="text-white/50">Contractor Email ID: {viewInvoice.id.startsWith("emp-1") ? "trish@evanawilson.com" : "disney@evanawilson.com"}</p>
                  </div>
                </div>

                {/* PERIOD DESCRIPTION BAR */}
                <div className="bg-white/5 border border-white/10 p-3 rounded-none flex justify-between items-center text-xs font-mono">
                  <span className="text-white/50">Active Billing Period Statement:</span>
                  <span className="text-white font-bold">{viewInvoice.startDate} Through {viewInvoice.endDate}</span>
                </div>

                {/* DETAILED LEDGER ENTRIES */}
                <div className="space-y-2">
                  <p className="text-[10px] uppercase font-mono text-white/40 tracking-widest font-bold">Workday Ledger Breakdown</p>
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-white/10 text-white/40 text-[9px] uppercase tracking-wider">
                        <th className="py-2">Date Record</th>
                        <th className="py-2 text-right">Sum Hours Pool</th>
                        <th className="py-2 text-right">Static Hourly Rate</th>
                        <th className="py-2 text-right">Total Subtotal Due</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewInvoice.dailyBreakdown.map((row) => (
                        <tr key={row.date} className="border-b border-white/5 text-white/70">
                          <td className="py-2.5">{row.date} ({new Date(row.date).toLocaleDateString(undefined, { weekday: "short" })})</td>
                          <td className="py-2.5 text-right font-semibold text-white">{row.hours.toFixed(2)} hrs</td>
                          <td className="py-2.5 text-right">${viewInvoice.hourlyRate.toFixed(2)}</td>
                          <td className="py-2.5 text-right font-bold text-white">${(row.hours * viewInvoice.hourlyRate).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* TOTAL POOL DUE */}
                <div className="flex flex-col items-end pt-4 border-t border-white/10 pr-4 space-y-1">
                  <span className="text-[10px] uppercase font-mono tracking-widest text-white/40">Sum Total Amount Outstanding</span>
                  <span className="text-3xl font-mono text-white font-bold">${viewInvoice.amountDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>
                  <p className="text-[9px] text-white/30 font-mono uppercase tracking-wider">Payroll computed automatically based on biometric timesheet entries.</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: APPROVED / DENIED LEAVE REQUESTS ACTION PANEL */}
      <AnimatePresence>
        {leaveActionId && (
          <div className="fixed inset-0 bg-black/92 flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0a0a0a] border border-white/15 w-full max-w-md rounded-none p-6 shadow-2xl space-y-4"
            >
              <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <span className="text-xs uppercase font-mono text-white/70 tracking-widest font-bold">Act on Leave Request</span>
                <button onClick={() => setLeaveActionId(null)} className="text-white/55 hover:text-white transition cursor-pointer">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-mono text-white/40 mb-1">Administrative Notes / Review Comments</label>
                  <textarea
                    rows={4}
                    value={leaveComment}
                    onChange={(e) => setLeaveComment(e.target.value)}
                    placeholder="Provide specific notes regarding approval or denial statement..."
                    className="w-full bg-black border border-white/10 rounded-none px-3 py-2 text-xs text-white focus:outline-none focus:border-white/30"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => processLeaveStatus("approved")}
                    className="w-full bg-white text-black font-bold uppercase tracking-widest text-[10px] py-3 rounded-none transition cursor-pointer"
                  >
                    Approve Leave
                  </button>
                  <button
                    onClick={() => processLeaveStatus("denied")}
                    className="w-full bg-red-950/20 hover:bg-red-900/40 text-red-400 border border-red-500/20 font-bold uppercase tracking-widest text-[10px] py-3 rounded-none transition cursor-pointer"
                  >
                    Deny Leave
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: SELECT SPECIFIC DAY FROM CALENDAR GRID */}
      <AnimatePresence>
        {selectedCalendarDay && (
          <div className="fixed inset-0 bg-black/92 flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0a0a0a] border border-white/15 w-full max-w-md rounded-none p-6 shadow-2xl space-y-4 relative"
            >
              <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <div>
                  <span className="text-xs uppercase font-mono text-white/50 tracking-widest font-bold">Selected Day Details Ledger</span>
                  <h4 className="text-sm font-semibold font-mono text-white mt-1">{selectedCalendarDay.dateStr}</h4>
                </div>
                <button onClick={() => setSelectedCalendarDay(null)} className="p-1 border border-white/10 rounded-none hover:bg-white/5 text-white/50 hover:text-white transition cursor-pointer">
                  <X size={15} />
                </button>
              </div>

              <div className="space-y-4">
                {/* LOGS DATA ON DAY */}
                <div>
                  <h5 className="text-[10px] font-mono uppercase text-white/40 tracking-widest border-b border-white/5 pb-1 mb-2">Registered Workday Logs</h5>
                  {selectedCalendarDay.logs.length === 0 ? (
                    <p className="text-xs text-white/30 italic block py-2">No active workday hours reported on this calendar day.</p>
                  ) : (
                    selectedCalendarDay.logs.map(log => (
                      <div key={log.id} className="p-3 bg-black border border-white/10 rounded-none text-xs leading-relaxed">
                        <div className="flex justify-between font-bold text-white mb-2 pb-1 border-b border-white/5">
                          <span className="uppercase tracking-wider font-bold">{log.employeeName}</span>
                          <span className="font-mono text-white/70">{log.totalHours.toFixed(2)} Work Hours</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-white/50 font-mono text-[10px]">
                          <p>Clocked In: <span className="text-white font-semibold">{log.clockIn ? new Date(log.clockIn).toLocaleTimeString() : "--"}</span></p>
                          <p>Clocked Out: <span className="text-white font-semibold">{log.clockOut ? new Date(log.clockOut).toLocaleTimeString() : "--"}</span></p>
                        </div>
                        {log.breaks.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-white/5 text-[9px] text-white/40">
                            <span className="font-bold text-white bg-white/10 px-1 py-0.5 rounded-none border border-white/15 uppercase tracking-widest block mb-1 w-fit">Break Logs:</span>
                            {log.breaks.map((b, bIdx) => (
                              <p key={bIdx} className="font-mono">
                                Break {bIdx + 1}: {new Date(b.start).toLocaleTimeString()} → {b.end ? new Date(b.end).toLocaleTimeString() : "Ongoing"}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* LEAVES DATA ON DAY */}
                <div>
                  <h5 className="text-[10px] font-mono uppercase text-white/40 tracking-widest border-b border-white/5 pb-1 mb-2">Absence / Leave Registry</h5>
                  {selectedCalendarDay.leaves.length === 0 ? (
                    <p className="text-xs text-white/30 italic block py-2">No leave absence reported on this calendar day.</p>
                  ) : (
                    selectedCalendarDay.leaves.map(leave => (
                      <div key={leave.id} className="p-3 bg-[#0a0a0a] border border-white/10 rounded-none text-xs space-y-1">
                        <div className="flex justify-between font-bold text-white">
                          <span className="uppercase tracking-wider font-bold">{leave.employeeName}</span>
                          <span className="text-white/60 bg-white/5 border border-white/10 px-2 py-0.5 rounded-none text-[8px] tracking-widest uppercase font-bold font-mono">{leave.status}</span>
                        </div>
                        <p className="text-white/60 italic">Reason: "{leave.reason}"</p>
                        {leave.adminComment && <p className="text-white/40 text-xs font-mono">Comment: "{leave.adminComment}"</p>}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
