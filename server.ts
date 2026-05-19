import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import crypto from "crypto";

// Interfaces
interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
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
  clockIn: string | null; // ISO DateTime
  clockOut: string | null; // ISO DateTime
  breaks: Array<{ start: string; end: string | null }>; // ISO DateTimes
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
  createdAt: string; // ISO DateTime
}

interface Invoice {
  id: string;
  userId: string;
  employeeName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  totalHours: number;
  hourlyRate: number;
  amountDue: number; // in USD
  issuedAt: string; // ISO DateTime
  dailyBreakdown: Array<{ date: string; hours: number }>;
}

interface Notification {
  id: string;
  userId: string; // Recipient user ID, or "admin" for admins
  message: string;
  read: boolean;
  createdAt: string; // ISO DateTime
}

interface AuditLog {
  id: string;
  timestamp: string; // ISO DateTime
  userId: string;
  userName: string;
  action: string;
  details: string;
}

// Global DB definition
const DB_FILE = path.join(process.cwd(), "database.json");

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function initializeDB() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
      // Ensure fundamental properties exist
      if (data.users && data.logs && data.leaves && data.invoices && data.notifications) {
        return;
      }
    } catch (e) {
      console.error("Corrupted DB, creating a new one...");
    }
  }

  // Create initial beautiful dataset
  const initialUsers: User[] = [
    {
      id: "admin-1",
      name: "Evan Wilson",
      email: "evan@evanawilson.com",
      passwordHash: hashPassword("BCA12345678!"),
      role: "admin",
      hourlyRate: 0,
      mustChangePassword: false,
      position: "CEO & Founder",
    },
    {
      id: "emp-1",
      name: "Trisha Salvahan",
      email: "trish@evanawilson.com",
      passwordHash: hashPassword("1234567890"),
      role: "employee",
      hourlyRate: 45.00,
      mustChangePassword: true,
      position: "Senior Contractor Specialist",
    },
    {
      id: "emp-2",
      name: "Disney Montano",
      email: "disney@evanawilson.com",
      passwordHash: hashPassword("abcdefghi"),
      role: "employee",
      hourlyRate: 50.00,
      mustChangePassword: true,
      position: "Contractor Specialist",
    },
  ];

  // Helper date generators for past 6 days
  const today = new Date();
  const getPastDateStr = (offsetDays: number): string => {
    const d = new Date();
    d.setDate(today.getDate() - offsetDays);
    return d.toISOString().split("T")[0];
  };

  // Pre-load logs to show beautiful tables right away
  const mockLogs: TimeLog[] = [
    // Trisha's logged days
    {
      id: "log-t1",
      userId: "emp-1",
      employeeName: "Trisha Salvahan",
      date: getPastDateStr(4),
      clockIn: `${getPastDateStr(4)}T09:00:00.000Z`,
      clockOut: `${getPastDateStr(4)}T18:00:00.000Z`,
      breaks: [
        { start: `${getPastDateStr(4)}T12:00:00.000Z`, end: `${getPastDateStr(4)}T13:00:00.000Z` }
      ],
      isSubmitted: true,
      totalHours: 8.00,
    },
    {
      id: "log-t2",
      userId: "emp-1",
      employeeName: "Trisha Salvahan",
      date: getPastDateStr(3),
      clockIn: `${getPastDateStr(3)}T08:45:00.000Z`,
      clockOut: `${getPastDateStr(3)}T17:15:00.000Z`,
      breaks: [
        { start: `${getPastDateStr(3)}T13:00:00.000Z`, end: `${getPastDateStr(3)}T13:45:00.000Z` }
      ],
      isSubmitted: true,
      totalHours: 7.75,
    },
    {
      id: "log-t3",
      userId: "emp-1",
      employeeName: "Trisha Salvahan",
      date: getPastDateStr(2),
      clockIn: `${getPastDateStr(2)}T09:15:00.000Z`,
      clockOut: `${getPastDateStr(2)}T18:15:00.000Z`,
      breaks: [
        { start: `${getPastDateStr(2)}T12:30:00.000Z`, end: `${getPastDateStr(2)}T13:30:00.000Z` }
      ],
      isSubmitted: true,
      totalHours: 8.00,
    },
    // Disney's logged days
    {
      id: "log-d1",
      userId: "emp-2",
      employeeName: "Disney Montano",
      date: getPastDateStr(4),
      clockIn: `${getPastDateStr(4)}T08:30:00.000Z`,
      clockOut: `${getPastDateStr(4)}T17:30:00.000Z`,
      breaks: [
        { start: `${getPastDateStr(4)}T12:00:00.000Z`, end: `${getPastDateStr(4)}T13:15:00.000Z` }
      ],
      isSubmitted: true,
      totalHours: 7.75,
    },
    {
      id: "log-d2",
      userId: "emp-2",
      employeeName: "Disney Montano",
      date: getPastDateStr(3),
      clockIn: `${getPastDateStr(3)}T09:00:00.000Z`,
      clockOut: `${getPastDateStr(3)}T18:00:00.000Z`,
      breaks: [
        { start: `${getPastDateStr(3)}T12:00:00.000Z`, end: `${getPastDateStr(3)}T13:00:00.000Z` }
      ],
      isSubmitted: true,
      totalHours: 8.00,
    },
    {
      id: "log-d3",
      userId: "emp-2",
      employeeName: "Disney Montano",
      date: getPastDateStr(2),
      clockIn: `${getPastDateStr(2)}T08:50:00.000Z`,
      clockOut: `${getPastDateStr(2)}T17:50:00.000Z`,
      breaks: [
        { start: `${getPastDateStr(2)}T11:45:00.000Z`, end: `${getPastDateStr(2)}T12:45:00.000Z` }
      ],
      isSubmitted: true,
      totalHours: 8.00,
    },
  ];

  // Mock Leaves
  const mockLeaves: LeaveRequest[] = [
    {
      id: "leave-1",
      userId: "emp-1",
      employeeName: "Trisha Salvahan",
      startDate: getPastDateStr(1),
      endDate: getPastDateStr(1),
      reason: "Medical Checkup & Wisdom tooth recovery",
      status: "approved",
      adminComment: "Get well soon, Trisha! Approved.",
      createdAt: `${getPastDateStr(2)}T10:00:00.000Z`,
    },
    {
      id: "leave-2",
      userId: "emp-2",
      employeeName: "Disney Montano",
      startDate: getPastDateStr(-1), // tomorrow
      endDate: getPastDateStr(-2), // day after tomorrow
      reason: "Family Gathering & Vacation",
      status: "pending",
      createdAt: `${getPastDateStr(0)}T11:30:00.000Z`,
    }
  ];

  // Mock Invoices
  const mockInvoices: Invoice[] = [
    {
      id: "invoice-t1",
      userId: "emp-1",
      employeeName: "Trisha Salvahan",
      startDate: getPastDateStr(14),
      endDate: getPastDateStr(8),
      totalHours: 38.5,
      hourlyRate: 45.00,
      amountDue: 1732.50,
      issuedAt: `${getPastDateStr(7)}T18:00:00.000Z`,
      dailyBreakdown: [
        { date: getPastDateStr(14), hours: 8 },
        { date: getPastDateStr(13), hours: 7.5 },
        { date: getPastDateStr(12), hours: 8 },
        { date: getPastDateStr(11), hours: 8 },
        { date: getPastDateStr(10), hours: 7 },
      ]
    },
    {
      id: "invoice-d1",
      userId: "emp-2",
      employeeName: "Disney Montano",
      startDate: getPastDateStr(14),
      endDate: getPastDateStr(8),
      totalHours: 40.0,
      hourlyRate: 50.00,
      amountDue: 2000.00,
      issuedAt: `${getPastDateStr(7)}T18:00:00.000Z`,
      dailyBreakdown: [
        { date: getPastDateStr(14), hours: 8 },
        { date: getPastDateStr(13), hours: 8 },
        { date: getPastDateStr(12), hours: 8 },
        { date: getPastDateStr(11), hours: 8 },
        { date: getPastDateStr(10), hours: 8 },
      ]
    }
  ];

  // Public system announcements / messages
  const mockNotifications: Notification[] = [
    {
      id: "notif-1",
      userId: "emp-1",
      message: "Your leave request for dental checkup has been Approved by Evan Wilson Ventures LLC.",
      read: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: "notif-admin-1",
      userId: "admin",
      message: "New leave request submitted by Disney Montano.",
      read: false,
      createdAt: new Date().toISOString(),
    }
  ];

  const mockAudit: AuditLog[] = [
    {
      id: "audit-1",
      timestamp: new Date().toISOString(),
      userId: "system",
      userName: "System Engine",
      action: "DATABASE_INITIALIZATION",
      details: "Evan Wilson Ventures LLC core database initialized successfully."
    }
  ];

  const initialDBData = {
    users: initialUsers,
    logs: mockLogs,
    leaves: mockLeaves,
    invoices: mockInvoices,
    notifications: mockNotifications,
    auditLogs: mockAudit
  };

  fs.writeFileSync(DB_FILE, JSON.stringify(initialDBData, null, 2), "utf-8");
  console.log("Mock database written successfully!");
}

// Read / Write Database handlers
function getDB() {
  initializeDB();
  return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
}

function saveDB(data: any) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
}

function addAuditLog(userId: string, userName: string, action: string, details: string) {
  const db = getDB();
  const newLog: AuditLog = {
    id: "audit-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
    timestamp: new Date().toISOString(),
    userId,
    userName,
    action,
    details
  };
  db.auditLogs = db.auditLogs || [];
  db.auditLogs.unshift(newLog); // Put latest on top
  saveDB(db);
}

// Main server launcher
async function startServer() {
  initializeDB();
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Endpoints: Secure Authentication
  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const db = getDB();
    const user = db.users.find((u: User) => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const providedHash = hashPassword(password);
    if (user.passwordHash !== providedHash) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Authenticated successfully! Keep credentials out of payload
    const sessionToken = user.id; // High resilience token
    addAuditLog(user.id, user.name, "USER_LOGIN", `${user.name} logged into the system.`);

    res.json({
      token: sessionToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        hourlyRate: user.hourlyRate,
        mustChangePassword: user.mustChangePassword
      }
    });
  });

  // Change Password Endpoint
  app.post("/api/auth/change-password", (req, res) => {
    const { userId, newPassword } = req.body;
    if (!userId || !newPassword) {
      return res.status(400).json({ error: "userId and new password are required" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters long" });
    }

    const db = getDB();
    const userIndex = db.users.findIndex((u: User) => u.id === userId);

    if (userIndex === -1) {
      return res.status(404).json({ error: "User not found" });
    }

    db.users[userIndex].passwordHash = hashPassword(newPassword);
    db.users[userIndex].mustChangePassword = false;
    saveDB(db);

    addAuditLog(db.users[userIndex].id, db.users[userIndex].name, "PASSWORD_CHANGE", "Successfully changed password and cleared temporary flag.");

    res.json({ message: "Password updated successfully" });
  });

  // Clock In
  app.post("/api/logs/clock-in", (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const db = getDB();
    const user = db.users.find((u: User) => u.id === userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const todayStr = new Date().toISOString().split("T")[0];

    // Check if clocked out/submitted for today
    const existingSubmitted = db.logs.find((l: TimeLog) => l.userId === userId && l.date === todayStr && l.isSubmitted);
    if (existingSubmitted) {
      return res.status(400).json({ error: "You have already completed and submitted your workload logs for today." });
    }

    // Find if already clocked-in and active
    let activeLog = db.logs.find((l: TimeLog) => l.userId === userId && l.date === todayStr && !l.isSubmitted);

    if (activeLog && activeLog.clockIn) {
      return res.status(400).json({ error: "You are already Clocked-In today." });
    }

    if (!activeLog) {
      activeLog = {
        id: "log-" + Date.now(),
        userId,
        employeeName: user.name,
        date: todayStr,
        clockIn: new Date().toISOString(),
        clockOut: null,
        breaks: [],
        isSubmitted: false,
        totalHours: 0,
      };
      db.logs.push(activeLog);
    } else {
      activeLog.clockIn = new Date().toISOString();
    }

    saveDB(db);
    addAuditLog(user.id, user.name, "CLOCK_IN", `${user.name} clocked in at ${new Date().toLocaleTimeString()}`);
    res.json({ message: "Clocked in successfully", log: activeLog });
  });

  // Break Start
  app.post("/api/logs/break-start", (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const db = getDB();
    const user = db.users.find((u: User) => u.id === userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const todayStr = new Date().toISOString().split("T")[0];
    const activeLog = db.logs.find((l: TimeLog) => l.userId === userId && l.date === todayStr && !l.isSubmitted);

    if (!activeLog || !activeLog.clockIn) {
      return res.status(400).json({ error: "You must Clock-In before starting a break." });
    }

    // Check if already on break
    const lastBreak = activeLog.breaks[activeLog.breaks.length - 1];
    if (lastBreak && lastBreak.end === null) {
      return res.status(400).json({ error: "You are already on peak break." });
    }

    activeLog.breaks.push({
      start: new Date().toISOString(),
      end: null
    });

    saveDB(db);
    addAuditLog(user.id, user.name, "BREAK_START", `${user.name} started lunch/short break.`);
    res.json({ message: "Break started", log: activeLog });
  });

  // Break End
  app.post("/api/logs/break-end", (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const db = getDB();
    const user = db.users.find((u: User) => u.id === userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const todayStr = new Date().toISOString().split("T")[0];
    const activeLog = db.logs.find((l: TimeLog) => l.userId === userId && l.date === todayStr && !l.isSubmitted);

    if (!activeLog) {
      return res.status(400).json({ error: "No active time log found for today." });
    }

    const lastBreak = activeLog.breaks[activeLog.breaks.length - 1];
    if (!lastBreak || lastBreak.end !== null) {
      return res.status(400).json({ error: "You are not currently on a break." });
    }

    lastBreak.end = new Date().toISOString();

    saveDB(db);
    addAuditLog(user.id, user.name, "BREAK_END", `${user.name} ended break and resumed work.`);
    res.json({ message: "Break ended", log: activeLog });
  });

  // Clock Out
  app.post("/api/logs/clock-out", (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const db = getDB();
    const user = db.users.find((u: User) => u.id === userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const todayStr = new Date().toISOString().split("T")[0];
    const activeLog = db.logs.find((l: TimeLog) => l.userId === userId && l.date === todayStr && !l.isSubmitted);

    if (!activeLog || !activeLog.clockIn) {
      return res.status(400).json({ error: "You are not active or clocked-in today." });
    }

    // Force-end any active open breaks
    const lastBreakIdx = activeLog.breaks.length - 1;
    if (lastBreakIdx >= 0 && activeLog.breaks[lastBreakIdx].end === null) {
      activeLog.breaks[lastBreakIdx].end = new Date().toISOString();
    }

    const nowStr = new Date().toISOString();
    activeLog.clockOut = nowStr;
    activeLog.isSubmitted = true; // Submit block cannot be edited ever

    // Calculations of total actual worked hours
    const clockInMs = new Date(activeLog.clockIn).getTime();
    const clockOutMs = new Date(nowStr).getTime();
    let totalWorkedMs = clockOutMs - clockInMs;

    // Deduct total time spent on breaks
    let totalBreaksMs = 0;
    activeLog.breaks.forEach((b: { start: string; end: string | null }) => {
      if (b.start && b.end) {
        totalBreaksMs += new Date(b.end).getTime() - new Date(b.start).getTime();
      }
    });

    let finalWorkedMs = totalWorkedMs - totalBreaksMs;
    if (finalWorkedMs < 0) finalWorkedMs = 0;

    // Convert to floating point hours rounded to 2 decimals
    const hours = Number((finalWorkedMs / (1000 * 60 * 60)).toFixed(2));
    activeLog.totalHours = hours;

    saveDB(db);
    addAuditLog(user.id, user.name, "CLOCK_OUT", `${user.name} clocked out. Workday complete: ${hours} hrs.`);

    res.json({ message: "Clocked out successfully & Day Worklog finalized.", log: activeLog });
  });

  // Get Employee Logs
  app.get("/api/logs/employee/:userId", (req, res) => {
    const { userId } = req.params;
    const db = getDB();
    const user = db.users.find((u: User) => u.id === userId);
    if (!user) return res.status(404).json({ error: "Employee account not found" });

    const userLogs = db.logs.filter((l: TimeLog) => l.userId === userId);
    res.json(userLogs);
  });

  // Get All Logs (Admin function)
  app.get("/api/logs/all", (req, res) => {
    const db = getDB();
    res.json(db.logs);
  });

  // Submit Leave Request
  app.post("/api/leaves/request", (req, res) => {
    const { userId, startDate, endDate, reason } = req.body;
    if (!userId || !startDate || !endDate || !reason) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const db = getDB();
    const user = db.users.find((u: User) => u.id === userId);
    if (!user) return res.status(404).json({ error: "No user found" });

    const newLeave: LeaveRequest = {
      id: "leave-" + Date.now(),
      userId,
      employeeName: user.name,
      startDate,
      endDate,
      reason,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    db.leaves.push(newLeave);

    // Notify admins
    const newNotif: Notification = {
      id: "notif-req-" + Date.now(),
      userId: "admin",
      message: `Leave Request submitted by ${user.name} (${startDate} to ${endDate}).`,
      read: false,
      createdAt: new Date().toISOString()
    };
    db.notifications.push(newNotif);

    saveDB(db);
    addAuditLog(user.id, user.name, "LEAVE_SUBMIT", `${user.name} requested leave for dates: ${startDate} to ${endDate}.`);

    res.json({ message: "Leave request submitted successfully", leave: newLeave });
  });

  // Approve or Deny Leave
  app.post("/api/leaves/status", (req, res) => {
    const { id, status, adminComment, adminUserId } = req.body;
    if (!id || !status) {
      return res.status(400).json({ error: "Leave ID and Status are required" });
    }

    const db = getDB();
    const leaveIdx = db.leaves.findIndex((l: LeaveRequest) => l.id === id);
    if (leaveIdx === -1) return res.status(404).json({ error: "Leave request not found" });

    const leave = db.leaves[leaveIdx];
    leave.status = status;
    leave.adminComment = adminComment || "";

    // Send status notification directly to the employee
    const newNotif: Notification = {
      id: "notif-res-" + Date.now(),
      userId: leave.userId,
      message: `Your requested Leave (${leave.startDate} to ${leave.endDate}) has been ${status.toUpperCase()} by Evan Wilson Ventures. ${adminComment ? `Comment: "${adminComment}"` : ""}`,
      read: false,
      createdAt: new Date().toISOString()
    };
    db.notifications.push(newNotif);

    saveDB(db);
    addAuditLog("admin-1", "Evan Wilson", `LEAVE_${status.toUpperCase()}`, `Action on leave request ${id} for employee ${leave.employeeName}: ${status}`);

    res.json({ message: `Leave request status successfully updated to: ${status}`, leave });
  });

  // Get All Leaves (Admin)
  app.get("/api/leaves/all", (req, res) => {
    const db = getDB();
    res.json(db.leaves);
  });

  // Get Employee Leaves
  app.get("/api/leaves/employee/:userId", (req, res) => {
    const { userId } = req.params;
    const db = getDB();
    const userLeaves = db.leaves.filter((l: LeaveRequest) => l.userId === userId);
    res.json(userLeaves);
  });

  // Get Notifications
  app.get("/api/notifications/user/:userId", (req, res) => {
    const { userId } = req.params;
    const db = getDB();
    // Filter matching role/userId or general announcements
    const matchingNotifs = db.notifications.filter((n: Notification) => n.userId === userId || (userId === "admin" && n.userId === "admin"));
    res.json(matchingNotifs);
  });

  // Mark Read
  app.post("/api/notifications/mark-read", (req, res) => {
    const { notifId } = req.body;
    const db = getDB();
    const notifIdx = db.notifications.findIndex((n: Notification) => n.id === notifId);
    if (notifIdx !== -1) {
      db.notifications[notifIdx].read = true;
      saveDB(db);
    }
    res.json({ success: true });
  });

  // Fetch Employees List (Admin only or profile rates detail)
  app.get("/api/employees", (req, res) => {
    const db = getDB();
    const empDetails = db.users.filter((u: User) => u.role === "employee").map((u: User) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      hourlyRate: u.hourlyRate,
      mustChangePassword: u.mustChangePassword,
      position: u.position || "Contractor Specialist"
    }));
    res.json(empDetails);
  });

  // Update Hourly Rate & Profile settings
  app.post("/api/employees/update-settings", (req, res) => {
    const { id, hourlyRate, position } = req.body;
    if (!id) {
      return res.status(400).json({ error: "Missing ID parameter." });
    }

    const db = getDB();
    const userIdx = db.users.findIndex((u: User) => u.id === id);
    if (userIdx === -1) {
      return res.status(404).json({ error: "Employee profile not found" });
    }

    const auditChanges: string[] = [];
    if (hourlyRate !== undefined) {
      db.users[userIdx].hourlyRate = Number(hourlyRate);
      auditChanges.push(`hourly rate to USD ${hourlyRate}/hr`);
    }
    if (position !== undefined) {
      db.users[userIdx].position = String(position);
      auditChanges.push(`position to "${position}"`);
    }

    saveDB(db);

    if (auditChanges.length > 0) {
      addAuditLog("admin-1", "Evan Wilson", "SETTING_UPDATE", `Updated settings of ${db.users[userIdx].name}: changed ${auditChanges.join(" and ")}`);
    }

    res.json({ message: "Employee profile updated successfully", user: db.users[userIdx] });
  });

  // Keep compatibility for any existing calls
  app.post("/api/employees/update-rate", (req, res) => {
    const { id, hourlyRate } = req.body;
    if (!id || hourlyRate === undefined) {
      return res.status(400).json({ error: "Missing ID or hourlyRate parameter." });
    }

    const db = getDB();
    const userIdx = db.users.findIndex((u: User) => u.id === id);
    if (userIdx === -1) {
      return res.status(404).json({ error: "Employee profile not found" });
    }

    db.users[userIdx].hourlyRate = Number(hourlyRate);
    saveDB(db);

    addAuditLog("admin-1", "Evan Wilson", "RATE_UPDATE", `Updated hourly rate of ${db.users[userIdx].name} to USD ${hourlyRate}/hr`);
    res.json({ message: "Hourly rate updated successfully", user: db.users[userIdx] });
  });

  // Fetch Weekly Invoices list
  app.get("/api/invoices/all", (req, res) => {
    const db = getDB();
    res.json(db.invoices);
  });

  // Get My Invoices
  app.get("/api/invoices/employee/:userId", (req, res) => {
    const { userId } = req.params;
    const db = getDB();
    const clientInvoices = db.invoices.filter((i: Invoice) => i.userId === userId);
    res.json(clientInvoices);
  });

  // Generate a Weekly Premium Billing Invoice manually on demand/by trigger
  app.post("/api/invoices/generate-weekly", (req, res) => {
    const { userId, startDate, endDate } = req.body;
    if (!userId || !startDate || !endDate) {
      return res.status(400).json({ error: "Employee userId, startDate and endDate required." });
    }

    const db = getDB();
    const employee = db.users.find((u: User) => u.id === userId);
    if (!employee) return res.status(404).json({ error: "Employee not found." });

    // Find all submitted logs for this employee within range
    const matchingLogs = db.logs.filter((l: TimeLog) => {
      return l.userId === userId && l.isSubmitted && l.date >= startDate && l.date <= endDate;
    });

    if (matchingLogs.length === 0) {
      return res.status(400).json({ error: "No submitted time logs found in this date range. Invoices require submitted days to compute." });
    }

    // Calculate total hours
    const totalHours = matchingLogs.reduce((sum: number, l: TimeLog) => sum + l.totalHours, 0);
    const hourlyRate = employee.hourlyRate;
    const amountDue = Number((totalHours * hourlyRate).toFixed(2));

    // Daily hours breakdown
    const dailyBreakdown = matchingLogs.map((l: TimeLog) => ({
      date: l.date,
      hours: l.totalHours
    }));

    // Ensure no duplicate invoice for same period and employee is written
    const isDuplicate = db.invoices.some((inv: Invoice) => inv.userId === userId && inv.startDate === startDate && inv.endDate === endDate);
    if (isDuplicate) {
       return res.status(400).json({ error: "An invoice has already been compiled for this employee in this exact date range." });
    }

    const nInvoice: Invoice = {
      id: "invoice-" + Date.now() + "-" + Math.floor(Math.random() * 900),
      userId,
      employeeName: employee.name,
      startDate,
      endDate,
      totalHours,
      hourlyRate,
      amountDue,
      issuedAt: new Date().toISOString(),
      dailyBreakdown
    };

    db.invoices.unshift(nInvoice); // latest first
    saveDB(db);

    addAuditLog("admin-1", "Evan Wilson", "BILLING_GENERATED", `Issued Service Invoice for ${employee.name}. Over ${startDate} to ${endDate}. USD ${amountDue}`);

    res.json({ message: "Weekly invoice generated and distributed.", invoice: nInvoice });
  });

  // Fetch audit logs
  app.get("/api/audit-logs", (req, res) => {
    const db = getDB();
    res.json(db.auditLogs || []);
  });

  // Serve static UI layout in Production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Evan Wilson Ventures dynamic server operating on: http://localhost:${PORT}`);
  });
}

startServer();
