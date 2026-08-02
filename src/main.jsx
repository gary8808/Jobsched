
// AIM CG v43a - persistent tool register and full-page tool view
import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Plus, Search, Trash2, Pencil, X, Users, ChevronLeft, ChevronRight,
  PanelLeft, Phone, Mail, MessageSquare, Inbox, Share2, Upload,
  Play, Square, Clock, Paperclip, Package, History, CheckCircle2, UserCog,
  AlertCircle, CalendarX, Plane, Wrench, RotateCcw, UserMinus, Settings, ZoomIn, ZoomOut, Copy, Download, BookOpen, ChevronUp, ChevronDown, Printer, Tractor, Hammer, Ban, ClipboardList, SlidersHorizontal
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import * as XLSX from "xlsx";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "./styles.css";
import { supabase, supabaseConfig } from "./supabaseClient";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const STORAGE_KEY = "aim-cg-v43a-tools";
const CURRENT_USER = "Demo User";

const CATEGORIES = [
  "To be scheduled",
  "Awaiting parts",
  "To be rescheduled",
  "Scheduled",
  "Completed",
  "Cancelled"
];

const JOB_STATUS_OPTIONS = [
  "To be scheduled",
  "Awaiting parts",
  "To be rescheduled",
  "Scheduled",
  "Completed",
  "Call back - Defects",
  "Cancelled"
];

const TRADES = ["Plumber", "Carpenter", "TA", "Electrician", "Refrigeration", "Boilermaker", "Concreter", "Supervisor"];
const BASE_SITES = ["Paraburdoo", "Brockman", "Busselton", "Karratha", "Tom Price", "Perth", "Other"];
const LEAVE_TYPES = ["Sick leave", "Annual leave", "Other leave"];
const MATERIAL_STATUSES = ["No parts required", "Parts from stock", "Awaiting supplier quote", "Ordered", "Partially arrived", "All parts arrived"];
const SAFETY_PERMIT_OPTIONS = [
  "Electrical isolations",
  "Transit accommodation required",
  "Excavation permit",
  "Level 2 risk assessment",
  "Notification to worksafe",
  "Penetration permit",
  "Restricted tool use approval"
];
const JOB_SITES = BASE_SITES;
const ROSTER_PATTERNS = [
  { id: "NONE", label: "No roster pattern", onDays: 0, offDays: 0 },
  { id: "5_ON_2_OFF", label: "5 days on / 2 off", onDays: 5, offDays: 2 },
  { id: "8_ON_6_OFF", label: "8 days on / 6 off", onDays: 8, offDays: 6 },
  { id: "14_ON_7_OFF", label: "2 weeks on / 1 off", onDays: 14, offDays: 7 },
  { id: "14_ON_14_OFF", label: "2 weeks on / 2 off", onDays: 14, offDays: 14 },
  { id: "CUSTOM", label: "Custom roster", onDays: 0, offDays: 0 }
];

const STATUS_META = {
  notStarted: { label: "Not started", icon: "○" },
  running: { label: "Onsite", icon: "▶" },
  paused: { label: "Paused", icon: "Ⅱ" },
  stopped: { label: "Offsite", icon: "■" },
  completed: { label: "Completed", icon: "✓" }
};

const initialData = {
  teamMembers: [
    { id: "gary", name: "Gary", trade: "Supervisor", baseSite: "Paraburdoo", phone: "0400 000 000", email: "gary@example.com", birthday: "", sapNumber: "SAP001", rosterPattern: "5_ON_2_OFF", rosterStartDate: getIsoDate(new Date()), inactive: false },
    { id: "mick", name: "Mick", trade: "Carpenter", baseSite: "Busselton", phone: "", email: "", birthday: "", sapNumber: "SAP002", rosterPattern: "8_ON_6_OFF", rosterStartDate: getIsoDate(new Date()), inactive: false },
    { id: "drew", name: "Drew", trade: "Plumber", baseSite: "Paraburdoo", phone: "", email: "", birthday: "", sapNumber: "SAP003", rosterPattern: "14_ON_7_OFF", rosterStartDate: getIsoDate(new Date()), inactive: false },
    { id: "gaz", name: "Gaz", trade: "Electrician", baseSite: "Brockman", phone: "", email: "", birthday: "", sapNumber: "SAP004", rosterPattern: "14_ON_14_OFF", rosterStartDate: getIsoDate(new Date()), inactive: false }
  ],
  jobs: [
    normaliseJob({
      id: createId(),
      title: "790 larnook pool fence panel replacement WO5879466",
      client: "Sodexo Remote Sites Australia Pty Ltd.",
      site: "Paraburdoo",
      requiredTrade: "Carpenter",
      materialsStatus: "Parts from stock",
      jobNumber: "JB04953",
      quoteNumber: "QUO 10574",
      workOrderNumber: "WO 5879466",
      poNumber: "PO D087307",
      address: "247 Balcatta Road, Balcatta, Western Australia 6021, Australia",
      clientContact: "Sodexo Remote Sites",
      clientPhone: "0400 000 000",
      category: "To be scheduled",
      assignedTo: [],
      notes: "Mobilise to site with personnel, materials and equipment\nCarry out paperwork\nInstall barricading and signage\nReplace pool fence panels\nTidy site and demobilise",
      materials: [{ id: createId(), text: "Pool fencing clips", status: "Required" }],
      noteHistory: [{ id: createId(), date: new Date().toISOString(), user: CURRENT_USER, text: "Job imported after PO received." }],
      jobHistory: [{ id: createId(), date: new Date().toISOString(), user: CURRENT_USER, action: "Created", details: "Demo job created." }]
    })
  ],
  leaveRecords: [],
  messages: []
};

function App() {
  const [data, setData] = useState(loadData);
  const [view, setView] = useState("admin");
  const [adminTab, setAdminTab] = useState("schedule");
  const [dashboardTab, setDashboardTab] = useState("Action needed");
  const [employeeId, setEmployeeId] = useState("");
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("To be scheduled");
  const [clientFilter, setClientFilter] = useState("All");
  const [tradeFilter, setTradeFilter] = useState("All");
  const [siteFilter, setSiteFilter] = useState("All");
  const [hideUnavailable, setHideUnavailable] = useState(false);
  const [weekStart, setWeekStart] = useState(getStartOfWeek(new Date()));
  const [calendarDayCount, setCalendarDayCount] = useState(7);
  const [editingJob, setEditingJob] = useState(null);
  const [jobHistoryJob, setJobHistoryJob] = useState(null);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [shareHubOpen, setShareHubOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [runSheetOpen, setRunSheetOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [machinery, setMachinery] = useState([]);
  const [machineryBookings, setMachineryBookings] = useState([]);
  const [machinerySettingsOpen, setMachinerySettingsOpen] = useState(false);
  const [machineryBookingOpen, setMachineryBookingOpen] = useState(null);
  const [tools, setTools] = useState([]);
  const [toolHistory, setToolHistory] = useState([]);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [selectedMachineId, setSelectedMachineId] = useState("");
  const [bucketsCollapsed, setBucketsCollapsed] = useState(false);
  const [calendarPopup, setCalendarPopup] = useState(null);
  const [draggedJobId, setDraggedJobId] = useState(null);
  const [selectedBucketJobId, setSelectedBucketJobId] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [copiedBooking, setCopiedBooking] = useState(null);
  const [jobMessagesJob, setJobMessagesJob] = useState(null);
  const [session, setSession] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentProfile, setCurrentProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [supabaseCheck, setSupabaseCheck] = useState({
    status: "checking",
    workers: [],
    message: "Checking Supabase connection..."
  });
  const [backendWorkers, setBackendWorkers] = useState([]);
  const [workersLoading, setWorkersLoading] = useState(false);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsSyncMessage, setJobsSyncMessage] = useState("Local demo jobs active until Supabase jobs are loaded.");
  const [passwordSetupMode, setPasswordSetupMode] = useState(() => getAuthReturnType());
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalledPwa, setIsInstalledPwa] = useState(() => window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true);

  useEffect(() => {
    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      setInstallPrompt(event);
    }
    function handleInstalled() {
      setIsInstalledPwa(true);
      setInstallPrompt(null);
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  async function installJobsched() {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice?.outcome === "accepted") setIsInstalledPwa(true);
      setInstallPrompt(null);
      return;
    }
    alert("On iPhone/iPad, tap Share then Add to Home Screen. On Android/desktop, open the browser menu and choose Install app or Add to Home screen.");
  }

  useEffect(() => {
    let alive = true;

    async function loadSession() {
      if (!supabase) {
        if (alive) setAuthLoading(false);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (!alive) return;
      setSession(sessionData.session || null);
      setCurrentUser(sessionData.session?.user || null);
      const returnType = getAuthReturnType();
      if (sessionData.session && ["invite", "recovery", "signup"].includes(returnType)) {
        setPasswordSetupMode(returnType);
      }
      setAuthLoading(false);
    }

    loadSession();

    if (!supabase) return () => { alive = false; };

    const { data: authListener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession || null);
      setCurrentUser(nextSession?.user || null);
      if (event === "PASSWORD_RECOVERY") {
        setPasswordSetupMode("recovery");
      } else if (nextSession && ["invite", "recovery", "signup"].includes(getAuthReturnType())) {
        setPasswordSetupMode(getAuthReturnType());
      }
    });

    return () => {
      alive = false;
      authListener?.subscription?.unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    let alive = true;

    async function checkSupabase() {
      if (!supabase) {
        if (!alive) return;
        setSupabaseCheck({
          status: "error",
          workers: [],
          message: supabaseConfig.hasUrl || supabaseConfig.hasKey
            ? "Supabase setup is incomplete. Check both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
            : "Supabase variables are missing from the build. Check GitHub Actions variables and deploy.yml."
        });
        return;
      }

      if (!session) {
        if (!alive) return;
        setBackendWorkers([]);
        setSupabaseCheck({
          status: authLoading ? "checking" : "error",
          workers: [],
          message: authLoading
            ? "Checking Supabase session..."
            : "Not signed in. Sign in to run the authenticated workers test."
        });
        return;
      }

      setWorkersLoading(true);
      try {
        const workers = await fetchWorkersFromSupabase();
        if (!alive) return;

        setBackendWorkers(workers);
        let remoteJobs = [];
        let remoteMessages = [];
        let remoteMachinery = [];
        let remoteMachineryBookings = [];
        let remoteTools = [];
        let remoteToolHistory = [];
        try {
          setJobsLoading(true);
          remoteJobs = await fetchJobsFromSupabase();
          remoteMessages = await fetchMessagesFromSupabase();
          if (currentProfile?.role === "admin") {
            [remoteMachinery, remoteMachineryBookings] = await Promise.all([fetchMachineryFromSupabase(), fetchMachineryBookingsFromSupabase()]);
          } else {
            [remoteMachinery, remoteMachineryBookings] = await Promise.all([fetchMachineryFromSupabase(), fetchMachineryBookingsFromSupabase()]);
          }
        } finally {
          setJobsLoading(false);
        }

        try { [remoteTools, remoteToolHistory] = await Promise.all([fetchToolsFromSupabase(), fetchToolHistoryFromSupabase()]); } catch (toolError) { console.warn("Tool register not available yet", toolError); }
        setMachinery(remoteMachinery);
        setMachineryBookings(remoteMachineryBookings);
        setTools(remoteTools);
        setToolHistory(remoteToolHistory);
        if (!selectedMachineId && remoteMachinery.length) setSelectedMachineId(remoteMachinery[0].id);
        if (workers.length || remoteJobs.length || remoteMessages.length) {
          setData(current => ({
            ...current,
            // Once authenticated, Supabase is the source of truth. Do not
            // repopulate deleted demo workers/jobs from localStorage.
            teamMembers: workers,
            jobs: remoteJobs,
            messages: remoteMessages
          }));
        }
        setJobsSyncMessage(remoteJobs.length ? `Loaded ${remoteJobs.length} job(s) and ${remoteMessages.length} message(s) from Supabase.` : "No Supabase jobs found yet. New/edited jobs will save to Supabase.");

        setSupabaseCheck({
          status: "connected",
          workers,
          message: `Authenticated as ${session.user?.email || "user"}. Workers found: ${workers.length}. Jobs found: ${remoteJobs.length}. Messages found: ${remoteMessages.length}`
        });
      } catch (error) {
        if (!alive) return;
        setSupabaseCheck({
          status: "error",
          workers: [],
          message: error?.message || "Unknown Supabase connection error"
        });
      } finally {
        if (alive) setWorkersLoading(false);
      }
    }

    checkSupabase();
    return () => { alive = false; };
  }, [session, authLoading]);

  useEffect(() => {
    if (!supabase || !session) return;

    let alive = true;

    async function refreshMessages() {
      try {
        const freshMessages = await fetchMessagesFromSupabase();
        if (!alive) return;
        setData(current => ({
          ...current,
          messages: freshMessages
        }));
      } catch (err) {
        console.error("Could not refresh messages", err);
      }
    }

    refreshMessages();

    const channel = supabase
      .channel("jobsched-messages")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        refreshMessages();
      })
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!supabase || !session) return;

    let alive = true;
    let refreshTimer = null;
    let refreshSequence = 0;

    function refreshJobsAndBookings() {
      // Saving a schedule replaces booking rows (delete then insert). Debounce
      // the realtime events so the temporary no-bookings state cannot overwrite
      // the calendar after a successful reschedule.
      if (refreshTimer) clearTimeout(refreshTimer);
      const sequence = ++refreshSequence;
      refreshTimer = setTimeout(async () => {
        try {
          const freshJobs = await fetchJobsFromSupabase();
          if (!alive || sequence !== refreshSequence) return;
          setData(current => ({ ...current, jobs: freshJobs }));
        } catch (err) {
          console.error("Could not refresh jobs/bookings", err);
        }
      }, 350);
    }

    const channel = supabase
      .channel(`jobsched-jobs-bookings-${session.user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, refreshJobsAndBookings)
      .on("postgres_changes", { event: "*", schema: "public", table: "job_bookings" }, refreshJobsAndBookings)
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);


  useEffect(() => {
    if (!supabase || !session) return;
    let alive = true;
    async function refreshMachinery() {
      try {
        const [machines, bookings] = await Promise.all([fetchMachineryFromSupabase(), fetchMachineryBookingsFromSupabase()]);
        if (!alive) return;
        setMachinery(machines);
        setMachineryBookings(bookings);
      } catch (err) {
        console.error("Could not refresh machinery", err);
      }
    }
    const channel = supabase.channel(`aimcg-machinery-${session.user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "machinery" }, refreshMachinery)
      .on("postgres_changes", { event: "*", schema: "public", table: "machinery_bookings" }, refreshMachinery)
      .subscribe();
    return () => { alive = false; supabase.removeChannel(channel); };
  }, [session?.user?.id]);


  useEffect(() => {
    if (!supabase || !session) return;
    let alive = true;
    async function refreshTools() {
      try {
        const [freshTools, freshHistory] = await Promise.all([fetchToolsFromSupabase(), fetchToolHistoryFromSupabase()]);
        if (!alive) return;
        setTools(freshTools);
        setToolHistory(freshHistory);
      } catch (err) { console.error("Could not refresh tool register", err); }
    }
    const channel = supabase.channel(`aimcg-tools-${session.user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tools" }, refreshTools)
      .on("postgres_changes", { event: "*", schema: "public", table: "tool_transactions" }, refreshTools)
      .subscribe();
    return () => { alive = false; supabase.removeChannel(channel); };
  }, [session?.user?.id]);


  useEffect(() => {
    let alive = true;

    async function loadCurrentProfile() {
      if (!supabase || !currentUser?.id) {
        if (alive) setCurrentProfile(null);
        return;
      }

      setProfileLoading(true);
      try {
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("id, full_name, role, active")
          .eq("id", currentUser.id)
          .maybeSingle();

        if (!alive) return;
        if (error) throw error;

        setCurrentProfile(profile || {
          id: currentUser.id,
          full_name: currentUser.email || "User",
          role: currentUser.user_metadata?.role || "employee",
          active: true
        });
      } catch (error) {
        console.error("Could not load current user profile", error);
        if (alive) {
          setCurrentProfile({
            id: currentUser.id,
            full_name: currentUser.email || "User",
            role: "employee",
            active: true,
            profileError: error?.message || "Could not load profile"
          });
        }
      } finally {
        if (alive) setProfileLoading(false);
      }
    }

    loadCurrentProfile();
    return () => { alive = false; };
  }, [currentUser?.id]);

  const currentRole = currentProfile?.role === "admin" ? "admin" : "employee";
  const isAdminUser = currentRole === "admin" && currentProfile?.active !== false;
  const activeView = isAdminUser ? view : "employee";

  useEffect(() => {
    if (!currentUser || profileLoading) return;
    if (isAdminUser) {
      setView("admin");
    } else if (view !== "employee") {
      setView("employee");
    }
  }, [currentUser?.id, profileLoading, isAdminUser]);

  useEffect(() => {
    if (!session || !supabase || !isAdminUser) return;
    let active = true;
    Promise.all([fetchEmployeeCostsFromSupabase(), fetchJobFinancialsFromSupabase()])
      .then(([costs, financials]) => {
        if (!active) return;
        setData(current => ({
          ...current,
          teamMembers: current.teamMembers.map(worker => ({ ...worker, internalHourlyCost: costs[worker.id] ?? "" })),
          jobs: current.jobs.map(job => ({ ...job, jobValue: financials[job.id] ?? "" }))
        }));
      })
      .catch(error => console.error("Could not load admin financial data", error));
    return () => { active = false; };
  }, [session?.user?.id, isAdminUser]);

  useEffect(() => {
    if (!currentUser || isAdminUser || !data.teamMembers.length) return;
    const email = String(currentUser.email || "").toLowerCase();
    const linkedWorker = data.teamMembers.find(worker => worker.profileId === currentUser.id);
    const emailWorker = data.teamMembers.find(worker =>
      !worker.profileId && worker.email && worker.email.toLowerCase() === email
    );
    const ownWorker = linkedWorker || emailWorker;
    if (ownWorker && ownWorker.id !== employeeId) setEmployeeId(ownWorker.id);
    if (!ownWorker && employeeId) setEmployeeId("");
  }, [currentUser?.id, currentUser?.email, isAdminUser, data.teamMembers, employeeId]);

  useEffect(() => {
    if (!isAdminUser || !data.teamMembers.length) return;
    if (!data.teamMembers.some(worker => worker.id === employeeId && !worker.inactive)) {
      const firstActive = data.teamMembers.find(worker => !worker.inactive);
      setEmployeeId(firstActive?.id || "");
    }
  }, [isAdminUser, data.teamMembers, employeeId]);

  const days = useMemo(() => Array.from({ length: calendarDayCount }, (_, i) => addDays(weekStart, i)), [weekStart, calendarDayCount]);
  const employeeDays = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(new Date(), i)), []);

  const clientOptions = useMemo(() => Array.from(new Set(data.jobs.map(j => j.client).filter(Boolean))).sort(), [data.jobs]);
  const unreadMessages = data.messages.filter(m => m.unread).length;
  const calendarDayMin = calendarDayCount >= 14 ? "118px" : calendarDayCount >= 10 ? "150px" : calendarDayCount <= 5 ? "280px" : "220px";

  const visibleWorkers = useMemo(() => {
    return data.teamMembers.filter(worker => {
      if (worker.inactive) return false;
      const matchesTrade = tradeFilter === "All" || worker.trade === tradeFilter;
      const matchesSite = siteFilter === "All" || worker.baseSite === siteFilter;
      const unavailableAllWeek = days.every(day => getWorkerAvailability(worker, getIsoDate(day), data.leaveRecords).status !== "Onsite");
      return matchesTrade && matchesSite && (!hideUnavailable || !unavailableAllWeek);
    });
  }, [data.teamMembers, data.leaveRecords, days, tradeFilter, siteFilter, hideUnavailable]);

  const bucketJobs = useMemo(() => data.jobs.filter(job => !job.isAdHoc && !job.isTravelComment), [data.jobs]);

  const filteredJobs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bucketJobs.filter(job => {
      const matchesCategory = activeCategory === "All" || job.category === activeCategory;
      const matchesClient = clientFilter === "All" || job.client === clientFilter;
      const matchesQuery = !q || [job.title, job.client, job.jobNumber, job.quoteNumber, job.workOrderNumber, job.poNumber, job.address, job.clientContact, job.notes].join(" ").toLowerCase().includes(q);
      return matchesCategory && matchesClient && matchesQuery;
    });
  }, [bucketJobs, query, activeCategory, clientFilter]);

  const scheduledJobs = data.jobs.filter(job => job.category !== "Cancelled" && jobHasAnyBooking(job));

  function updateData(next) { setData(next); saveData(next); }
  function updateJobs(mutator, options = {}) {
    const before = data.jobs;
    const nextJobs = before.map(mutator);
    updateData({ ...data, jobs: nextJobs });
    if (options.persist !== false && isAdminUser && session && supabase) {
      const changed = nextJobs.filter((job, index) => JSON.stringify(job) !== JSON.stringify(before[index]));
      changed.forEach(job => persistJobToSupabase(job).catch(err => {
        console.error("Could not sync job to Supabase", err);
        setJobsSyncMessage(err?.message ? `Supabase job sync failed: ${err.message}` : "Supabase job sync failed.");
      }));
      if (changed.length) setJobsSyncMessage(`Saving ${changed.length} job update(s) to Supabase...`);
    }
  }
  function logJob(job, action, details) {
    return { ...job, jobHistory: [{ id: createId(), date: new Date().toISOString(), user: CURRENT_USER, action, details }, ...(job.jobHistory || [])] };
  }
  function getDraggedJobId(e) {
    const context = readDragContext(e);
    return context.jobId || draggedJobId || selectedBucketJobId;
  }
  function handleDragStart(e, jobId, sourceWorkerId = "", sourceDate = "") {
    const context = { jobId, sourceWorkerId, sourceDate };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", jobId);
    e.dataTransfer.setData("application/x-jobsched-job", JSON.stringify(context));
    e.dataTransfer.setData("application/json", JSON.stringify(context));
    setDraggedJobId(jobId);
    if (sourceWorkerId && sourceDate) {
      setSelectedBucketJobId(null);
      setSelectedBooking({ jobId, workerId: sourceWorkerId, date: sourceDate });
    } else {
      setSelectedBucketJobId(jobId);
      setSelectedBooking(null);
    }
  }
  function bookSelectedJob(workerId, date) {
    if (!selectedBucketJobId) return;
    const job = data.jobs.find(j => j.id === selectedBucketJobId);
    const workerName = getWorkerName(data.teamMembers, workerId);
    if (!job) return;
    if (!confirm(`Book "${job.title}" to ${workerName} on ${formatIsoForDisplay(date)}?`)) return;
    scheduleJob(selectedBucketJobId, workerId, date, { jobId: selectedBucketJobId });
    setSelectedBucketJobId(null);
  }

  function selectCalendarBooking(jobId, workerId, date) {
    setSelectedBucketJobId(null);
    setSelectedBooking({ jobId, workerId, date });
  }

  function copySelectedBooking() {
    if (!selectedBooking) return;
    const job = data.jobs.find(j => j.id === selectedBooking.jobId);
    if (!job) return;
    if (isLockedCompletedJob(job)) {
      alert("Completed jobs cannot be copied unless returned to active status.");
      return;
    }
    const range = getOccurrenceRange(job, selectedBooking.workerId, selectedBooking.date);
    const durationDays = range ? Math.max(0, daysBetween(range.startDate, range.endDate)) : 0;
    setCopiedBooking({ jobId: job.id, durationDays });
    setJobsSyncMessage(`Copied booking for ${job.title}. Click calendar dates to paste it.`);
  }

  function pasteCopiedBooking(workerId, date) {
    if (!copiedBooking) return;
    const job = data.jobs.find(j => j.id === copiedBooking.jobId);
    if (!job) return;
    if (isLockedCompletedJob(job)) {
      alert("Completed jobs cannot be pasted unless returned to active status.");
      return;
    }
    const workerName = getWorkerName(data.teamMembers, workerId);
    if (!confirm(`Paste booking for "${job.title}" to ${workerName} on ${formatIsoForDisplay(date)}?`)) return;
    updateJobs(j => {
      if (j.id !== job.id) return j;
      const endDate = getIsoDate(addDays(new Date(date + "T00:00:00"), copiedBooking.durationDays || 0));
      const scheduleBlocks = [...(j.scheduleBlocks || []), { id: createId(), workerId, startDate: date, endDate }];
      const assignedTo = (j.assignedTo || []).includes(workerId) ? j.assignedTo : [...(j.assignedTo || []), workerId];
      return logJob({ ...j, assignedTo, scheduleBlocks, category: "Scheduled", completedConfirmed: false, jobStatus: isDefectJob(j) ? "Call back - Defects" : "Scheduled" }, "Booking pasted", `Copied booking pasted to ${workerName} on ${date}.`);
    });
    setSelectedBooking({ jobId: job.id, workerId, date });
  }

  function deleteSelectedBooking() {
    if (!selectedBooking) return;
    const job = data.jobs.find(j => j.id === selectedBooking.jobId);
    if (!job) return;
    if (isLockedCompletedJob(job)) {
      alert("Completed jobs cannot be deleted from the calendar unless returned to active status.");
      return;
    }
    if (!confirm(`Delete this booking for "${job.title}" from the calendar?`)) return;
    updateJobs(j => {
      if (j.id !== job.id) return j;
      const updated = removeScheduledOccurrence(j, selectedBooking.workerId, selectedBooking.date);
      const hasBookings = jobHasAnyBooking(updated);
      return logJob({ ...updated, category: hasBookings ? updated.category : "To be scheduled", jobStatus: hasBookings ? updated.jobStatus : "To be scheduled" }, "Booking deleted", "Selected calendar booking was removed.");
    });
    setSelectedBooking(null);
  }

  function clearQuickActions() {
    setSelectedBooking(null);
    setCopiedBooking(null);
  }

  async function createJobFromPdfFile(file) {
    if (!file) return;
    try {
      const text = await extractTextFromPdf(file);
      const parsed = parseAimJobSheet(text);
      const job = normaliseJob({ ...emptyJob(), ...parsed, category: "To be scheduled" });
      const loggedJob = logJob(job, "Created", `Created from PDF: ${file.name}`);
      updateData({ ...data, jobs: [loggedJob, ...data.jobs] });
      if (session && supabase) persistJobToSupabase(loggedJob).catch(err => setJobsSyncMessage(`Supabase job sync failed: ${err.message}`));
      setActiveCategory("To be scheduled");
    } catch (err) { console.error(err); alert("The PDF could not be read. It may be scanned/image-based."); }
  }

  async function saveJob(jobToSave) {
    const exists = data.jobs.some(j => j.id === jobToSave.id);
    let next = normaliseJob(jobToSave);
    next = logJob(next, exists ? "Updated" : "Created", exists ? "Job details saved." : "Job created.");
    updateData({ ...data, jobs: exists ? data.jobs.map(j => j.id === next.id ? next : j) : [next, ...data.jobs] });
    setEditingJob(null);
    if (session && supabase) {
      try {
        setJobsSyncMessage("Saving job to Supabase...");
        await persistJobToSupabase(next);
        if (isAdminUser) {
          await saveJobFinancialToSupabase(next);
          await syncJobMachineryBookingsToSupabase(next.id, next.machineryBookings || []);
          setMachineryBookings(await fetchMachineryBookingsFromSupabase());
        }
        setJobsSyncMessage(`Saved ${next.title || "job"} to Supabase.`);
      } catch (err) {
        console.error(err);
        setJobsSyncMessage(err?.message ? `Supabase job sync failed: ${err.message}` : "Supabase job sync failed.");
        alert(err?.message || "Could not save job to Supabase.");
      }
    }
  }

  function cancelOrDeleteJob(job) {
    if (job.category === "Cancelled") {
      if (!confirm("Are you sure that you want to permanently delete this job?")) return;
      updateData({ ...data, jobs: data.jobs.filter(j => j.id !== job.id) });
      if (session && supabase) deleteJobFromSupabase(job.id).catch(err => setJobsSyncMessage(`Supabase delete failed: ${err.message}`));
      return;
    }
    if (!confirm("Move this job to the Cancelled bucket?")) return;
    updateJobs(j => j.id === job.id ? logJob({ ...j, category: "Cancelled" }, "Cancelled", "Job moved to Cancelled bucket.") : j);
  }

  function moveToBucket(jobId, category) {
    if (category === "All") return;
    updateJobs(job => {
      if (job.id !== jobId) return job;
      const updated = { ...job, category, assignedTo: category === "Scheduled" ? job.assignedTo : [], startDate: category === "Scheduled" ? job.startDate : "", endDate: category === "Scheduled" ? job.endDate : "", scheduleBlocks: category === "Scheduled" ? (job.scheduleBlocks || []) : [] };
      return logJob(updated, "Status changed", `Moved to ${category}.`);
    });
  }

  function scheduleJob(jobId, workerId, date, dragContext = {}) {
    updateJobs(job => {
      if (job.id !== jobId) return job;
      const wasConfirmed = Boolean(job.clientAccepted);
      const wasCompleted = job.category === "Completed" || job.completedConfirmed;
      let notify = false;
      let keepConfirmed = wasConfirmed;
      let isDefectCallback = Boolean(job.isDefectCallback || job.jobStatus === "Call back - Defects");
      let shouldOpenMessage = false;
      const sourceWorkerId = dragContext?.sourceWorkerId || "";
      const sourceDate = dragContext?.sourceDate || "";
      const isMovingFromCalendar = Boolean(sourceWorkerId && sourceDate && jobOccursForWorkerOnDate(job, sourceWorkerId, sourceDate));
      const todayIso = getIsoDate(new Date());
      const allExistingBookingsArePast = jobHasAnyBooking(job) &&
        (!hasPrimaryBooking(job) || compareIsoDates(job.endDate || job.startDate, todayIso) < 0) &&
        (job.scheduleBlocks || []).every(block => compareIsoDates(block.endDate || block.startDate, todayIso) < 0);

      if (wasCompleted) {
        isDefectCallback = confirm("Is this booking to address defects / a call back from the completed job?");
        if (isDefectCallback) {
          shouldOpenMessage = confirm("Do you want to open the job now to send a reschedule message to the client?");
        }
      } else if (wasConfirmed && (!jobOccursForWorkerOnDate(job, workerId, date) || isMovingFromCalendar)) {
        notify = confirm("This job has a confirmed appointment. Do you wish to notify the contact of the change?");
        if (!notify) keepConfirmed = confirm("Do you want to keep the appointment set as confirmed?");
        shouldOpenMessage = notify;
      }

      let updated;
      if (!hasPrimaryBooking(job) || wasCompleted) {
        updated = { ...job, assignedTo: [workerId], startDate: date, endDate: date, category: "Scheduled", clientAccepted: wasCompleted ? false : keepConfirmed };
      } else if (!isMovingFromCalendar && allExistingBookingsArePast && compareIsoDates(date, todayIso) >= 0) {
        // A scheduled job dragged from the bucket after all of its bookings have
        // expired is a reschedule, not an additional booking. Replace the stale
        // booking range so Supabase and the employee calendar share one clear
        // current assignment after refresh.
        updated = {
          ...job,
          assignedTo: [workerId],
          startDate: date,
          endDate: date,
          scheduleBlocks: [],
          category: "Scheduled",
          clientAccepted: keepConfirmed
        };
      } else if (isMovingFromCalendar) {
        updated = moveScheduledOccurrence(job, sourceWorkerId, sourceDate, workerId, date);
        updated = { ...updated, category: "Scheduled", clientAccepted: keepConfirmed };
      } else if (jobOccursForWorkerOnDate(job, workerId, date)) {
        updated = { ...job, category: "Scheduled", clientAccepted: keepConfirmed };
      } else {
        const scheduleBlocks = [...(job.scheduleBlocks || []), { id: createId(), workerId, startDate: date, endDate: date }];
        const assignedTo = job.assignedTo.includes(workerId) ? job.assignedTo : [...job.assignedTo, workerId];
        updated = { ...job, assignedTo, scheduleBlocks, category: "Scheduled", clientAccepted: keepConfirmed };
      }

      const isTrueReschedule = wasCompleted || allExistingBookingsArePast || isMovingFromCalendar;
      if (isTrueReschedule) {
        const resetAt = new Date().toISOString();
        const previousWorkerIds = Array.from(new Set([
          ...getAllAssignedWorkerIds(job),
          ...Object.keys(job.workerStatus || {}),
          ...Object.keys(job.workerCompletions || {})
        ]));
        const hasPreviousVisitData = previousWorkerIds.some(id =>
          getCurrentWorkerTotalMs(job, id) > 0 ||
          (job.workerStatus?.[id]?.status && job.workerStatus[id].status !== "notStarted") ||
          Boolean(job.workerCompletions?.[id])
        );
        const priorVisits = [...(job.priorVisits || [])];
        if (hasPreviousVisitData) {
          priorVisits.push({
            id: createId(),
            archivedAt: resetAt,
            reason: wasCompleted && isDefectCallback ? "defects_callback" : "rescheduled",
            startDate: job.startDate || "",
            endDate: job.endDate || job.startDate || "",
            assignedTo: previousWorkerIds,
            workerStatus: structuredCloneSafe(job.workerStatus || {}),
            workerCompletions: structuredCloneSafe(job.workerCompletions || {}),
            completedConfirmed: Boolean(job.completedConfirmed || job.category === "Completed")
          });
        }
        const resetWorkerStatus = {};
        getAllAssignedWorkerIds(updated).forEach(id => {
          resetWorkerStatus[id] = { status: "notStarted", totalMs: 0, runningSince: null, updatedAt: resetAt };
        });
        const currentVisitId = createId();
        Object.values(resetWorkerStatus).forEach(state => { state.visitId = currentVisitId; });
        updated = {
          ...updated,
          priorVisits,
          currentVisitId,
          currentVisitStartedAt: resetAt,
          workerStatus: resetWorkerStatus,
          workerCompletions: {},
          completedConfirmed: false,
          category: "Scheduled"
        };
      }

      if (isDefectCallback) {
        updated = { ...updated, jobStatus: "Call back - Defects", isDefectCallback: true, completedConfirmed: false };
      } else if (wasCompleted) {
        updated = { ...updated, jobStatus: "Scheduled", isDefectCallback: false, completedConfirmed: false };
      } else {
        updated = { ...updated, jobStatus: updated.jobStatus || updated.category };
      }

      updated = logJob(updated, wasCompleted && isDefectCallback ? "Call back - Defects" : "Scheduled", wasCompleted && isDefectCallback ? `Defect/call back booked to ${getWorkerName(data.teamMembers, workerId)} on ${date}.` : (isMovingFromCalendar || allExistingBookingsArePast) ? `Moved booking to ${getWorkerName(data.teamMembers, workerId)} on ${date}.` : `Booked to ${getWorkerName(data.teamMembers, workerId)} on ${date}.`);
      if (shouldOpenMessage) setTimeout(() => setEditingJob({ ...updated, _openClientTab: true, _messageMode: "reschedule" }), 10);
      return updated;
    });
    setDraggedJobId(null);
    setSelectedBucketJobId(null);
    setSelectedBooking({ jobId, workerId, date });
  }

  function extendJob(jobId, newEndDate) {
    updateJobs(job => {
      if (job.id !== jobId) return job;
      const end = compareIsoDates(newEndDate, job.startDate) < 0 ? job.startDate : newEndDate;
      return logJob({ ...job, endDate: end }, "Rescheduled", `End date changed to ${end}.`);
    });
  }

  function toggleJobCheckbox(jobId, field) {
    updateJobs(job => job.id === jobId ? logJob({ ...job, [field]: !job[field] }, "Updated", `${field} set to ${!job[field]}.`) : job);
  }

  async function saveCalendarItem(item) {
    if (item.type === "adHoc" || item.type === "travel") {
      const job = normaliseJob({
        ...emptyJob(),
        title: item.type === "travel" ? "Travel/accommodation comments" : (item.text.split("\n")[0] || "Ad hoc task"),
        notes: item.text,
        category: "Scheduled",
        assignedTo: [item.workerId],
        startDate: item.startDate,
        endDate: item.endDate,
        clientAccepted: true,
        isAdHoc: item.type === "adHoc",
        isTravelComment: item.type === "travel",
        attachments: []
      });
      let loggedJob = logJob(job, "Created", item.type === "travel" ? "Travel/accommodation comment added." : "Ad hoc job added.");
      updateData({ ...data, jobs: [loggedJob, ...data.jobs] });
      if (session && supabase) {
        try {
          await persistJobToSupabase(loggedJob);
          if (item.type === "travel" && item.travelPdfFile) {
            const uploadedPdf = await uploadAttachmentToSupabase({
              jobId: loggedJob.id,
              workerId: item.workerId,
              file: item.travelPdfFile,
              bucket: "accommodation-confirmations",
              attachmentType: "accommodation_confirmation",
              label: "Accommodation confirmation PDF",
              uploadedBy: currentUser?.id || null
            });
            loggedJob = logJob({ ...loggedJob, attachments: [...(loggedJob.attachments || []), uploadedPdf] }, "Accommodation PDF uploaded", "Accommodation confirmation PDF uploaded to Supabase Storage.");
            updateData({ ...data, jobs: [loggedJob, ...data.jobs] });
            await persistJobToSupabase(loggedJob);
          }
        } catch (err) {
          setJobsSyncMessage(`Supabase job sync failed: ${err.message}`);
          alert(err?.message || "Could not save item to Supabase.");
        }
      }
    } else if (item.type === "leave") {
      const leave = { id: createId(), workerId: item.workerId, leaveType: item.leaveType, startDate: item.startDate, endDate: item.endDate, notes: item.notes || "" };
      updateData({ ...data, leaveRecords: [leave, ...data.leaveRecords] });
    }
    setCalendarPopup(null);
  }

  async function saveWorkers(workers, deletedWorkerIds = []) {
    if (!isAdminUser) throw new Error("Only admin users can add or edit employees.");
    if (!session || !supabase) {
      updateData({ ...data, teamMembers: workers });
      return workers;
    }

    setWorkersLoading(true);
    try {
      if (deletedWorkerIds.length) await deleteWorkersFromSupabase(deletedWorkerIds);
      await saveWorkersToSupabase(workers);
      await saveEmployeeCostsToSupabase(workers);
      const freshWorkersBase = await fetchWorkersFromSupabase();
      const costMap = await fetchEmployeeCostsFromSupabase();
      const freshWorkers = freshWorkersBase.map(worker => ({ ...worker, internalHourlyCost: costMap[worker.id] ?? "" }));
      setBackendWorkers(freshWorkers);
      updateData({ ...data, teamMembers: freshWorkers });
      setSupabaseCheck({
        status: "connected",
        workers: freshWorkers,
        message: `Authenticated as ${session.user?.email || "user"}. Workers found: ${freshWorkers.length}`
      });
      return freshWorkers;
    } finally {
      setWorkersLoading(false);
    }
  }

  async function inviteWorkerAccess(worker, role = "employee") {
    if (!supabase) throw new Error("Supabase is not configured for this build.");
    if (!worker?.email) throw new Error("Employee needs an email address before an invite can be sent.");

    const { data: inviteResult, error } = await supabase.functions.invoke("invite-worker", {
      body: {
        worker_id: worker.id,
        email: worker.email,
        full_name: worker.name || worker.email,
        role,
        redirect_to: `${window.location.origin}${import.meta.env.BASE_URL}`
      }
    });

    if (error) throw error;
    if (inviteResult?.error) throw new Error(inviteResult.error);
    return inviteResult;
  }

  async function sendDemoMessage(job, customText = "") {
    const messageText = customText || buildScheduleMessage(job);
    if (!messageText.trim()) throw new Error("Enter a message before sending.");
    if (!job.clientPhone) throw new Error("Enter a client phone number before sending an SMS.");

    let savedMessage = null;
    if (session && supabase && isUuid(job.id)) {
      const result = await sendSmsViaSupabase({
        jobId: job.id,
        to: job.clientPhone,
        messageText,
        clientName: job.clientContact || job.client || "Client"
      });
      savedMessage = mapMessageFromSupabase(result?.message || result);
    } else {
      savedMessage = {
        id: createId(),
        jobId: job.id,
        direction: "out",
        channel: "sms",
        from: CURRENT_USER,
        to: job.clientPhone,
        text: messageText,
        date: new Date().toISOString(),
        unread: false,
        actioned: true,
        status: "local-demo"
      };
    }

    let changedJob = null;
    const nextJobs = data.jobs.map(j => {
      if (j.id !== job.id) return j;
      changedJob = logJob({ ...j, appointmentSent: true }, "SMS sent", "SMS sent from Jobsched.");
      return changedJob;
    });
    const nextMessages = savedMessage?.id
      ? [savedMessage, ...data.messages.filter(m => m.id !== savedMessage.id)]
      : data.messages;
    updateData({ ...data, messages: nextMessages, jobs: nextJobs });

    if (changedJob && session && supabase) {
      persistJobToSupabase(changedJob).catch(err => setJobsSyncMessage(`Supabase job sync failed: ${err.message}`));
      insertJobHistoryToSupabase({
        jobId: job.id,
        action: "SMS sent",
        details: "SMS sent from Jobsched via ClickSend.",
        createdBy: currentUser?.id || null
      }).catch(err => console.error("Could not save message history", err));
    }
    return true;
  }

  async function markMessageActioned(message, options = {}) {
    const job = data.jobs.find(j => j.id === message.jobId);
    const allowConfirmBooking = options.allowConfirmBooking !== false;
    const confirmBooking = allowConfirmBooking && message.direction === "in" && job && !job.clientAccepted
      ? confirm("Do you want to confirm this booking from the message?")
      : false;
    const actionText = options.noteText || `Message actioned by ${CURRENT_USER} on ${formatDateTime(new Date().toISOString())}.`;

    const actionedAt = new Date().toISOString();
    updateData({
      ...data,
      messages: data.messages.map(m =>
        m.id === message.id
          ? { ...m, unread: false, actioned: true, actionedBy: CURRENT_USER, actionedAt }
          : m
      ),
      jobs: data.jobs.map(j => {
        if (j.id !== message.jobId) return j;
        const note = { id: createId(), date: actionedAt, user: CURRENT_USER, text: actionText };
        return logJob(
          { ...j, clientAccepted: confirmBooking ? true : j.clientAccepted, noteHistory: [note, ...(j.noteHistory || [])] },
          options.historyAction || "Message actioned",
          options.historyDetails || (confirmBooking ? "Message actioned and booking confirmed." : "Message actioned from inbox.")
        );
      })
    });
    if (session && supabase && isUuid(message.id)) {
      try {
        await markMessageActionedInSupabase({ messageId: message.id, actionedBy: currentUser?.id || null });
      } catch (err) {
        console.error("Could not mark message actioned in Supabase", err);
        setJobsSyncMessage(`Message action failed: ${err.message}`);
      }
    }
  }

  async function replyToMessage(message, replyText) {
    const job = data.jobs.find(j => j.id === message.jobId);
    if (!job) throw new Error("This message is not linked to a job.");

    const messageText = String(replyText || "").trim();
    if (!messageText) throw new Error("Enter a reply before sending.");

    const recipient = message.from || message.phoneNumber || job.clientPhone;
    if (!recipient) throw new Error("No phone number is available for this message.");

    let savedMessage = null;
    if (session && supabase && isUuid(job.id)) {
      const result = await sendSmsViaSupabase({
        jobId: job.id,
        to: recipient,
        messageText,
        clientName: job.clientContact || job.client || "Client"
      });
      savedMessage = result?.message
        ? mapMessageFromSupabase(result.message)
        : {
            id: createId(),
            jobId: job.id,
            direction: "out",
            channel: "sms",
            from: CURRENT_USER,
            to: recipient,
            phoneNumber: recipient,
            text: messageText,
            date: new Date().toISOString(),
            unread: false,
            actioned: true,
            status: "sent",
            provider: "clicksend",
            providerMessageId: result?.provider_message_id || result?.providerMessageId || ""
          };
    } else {
      savedMessage = {
        id: createId(),
        jobId: job.id,
        direction: "out",
        channel: "sms",
        from: CURRENT_USER,
        to: recipient,
        phoneNumber: recipient,
        text: messageText,
        date: new Date().toISOString(),
        unread: false,
        actioned: true,
        status: "local-demo"
      };
    }

    const actionedAt = new Date().toISOString();
    const actionText = `Reply sent and inbound message actioned by ${CURRENT_USER} on ${formatDateTime(actionedAt)}.`;
    const actionedMessage = { ...message, unread: false, actioned: true, actionedBy: CURRENT_USER, actionedAt };
    const nextMessages = [savedMessage, ...data.messages.map(m => m.id === message.id ? actionedMessage : m).filter(m => m.id !== savedMessage.id)];

    updateData({
      ...data,
      messages: nextMessages,
      jobs: data.jobs.map(j => {
        if (j.id !== job.id) return j;
        const note = { id: createId(), date: actionedAt, user: CURRENT_USER, text: `${actionText}

Reply: ${messageText}` };
        return logJob(
          { ...j, appointmentSent: true, noteHistory: [note, ...(j.noteHistory || [])] },
          "SMS reply sent",
          "Reply sent from message inbox and original message actioned."
        );
      })
    });

    if (session && supabase && isUuid(message.id)) {
      try {
        await markMessageActionedInSupabase({ messageId: message.id, actionedBy: currentUser?.id || null });
        await insertJobHistoryToSupabase({
          jobId: job.id,
          action: "SMS reply sent",
          details: "Reply sent from Jobsched and original message actioned.",
          createdBy: currentUser?.id || null
        });
      } catch (err) {
        console.error("Could not mark replied message actioned in Supabase", err);
        setJobsSyncMessage(`Message action failed: ${err.message}`);
      }
    }

    return true;
  }

  async function updateWorkerJobStatus(jobId, workerId, nextStatus) {
    const workerName = getWorkerName(data.teamMembers, workerId);
    const statusLabel = STATUS_META[nextStatus]?.label || nextStatus;

    // Update the employee screen immediately, but do not move the whole job to
    // Completed. Admin confirmation remains the only action that completes the job.
    updateJobs(job => {
      if (job.id !== jobId) return job;
      const now = Date.now();
      const rawCurrent = job.workerStatus?.[workerId] || { status: "notStarted", totalMs: 0, runningSince: null };
      const currentVisitId = getCurrentVisitId(job);
      const belongsToCurrentVisit = !isDefectJob(job) || !currentVisitId || rawCurrent.visitId === currentVisitId;
      const current = belongsToCurrentVisit ? rawCurrent : { status: "notStarted", totalMs: 0, runningSince: null, visitId: currentVisitId };
      let totalMs = current.totalMs || 0;
      if (current.status === "running" && current.runningSince) totalMs += now - current.runningSince;
      const runningSince = nextStatus === "running" ? now : null;
      const updatedStatus = {
        ...job.workerStatus,
        [workerId]: {
          status: nextStatus,
          totalMs,
          runningSince,
          updatedAt: new Date().toISOString(),
          visitId: currentVisitId || null
        }
      };
      return logJob({ ...job, workerStatus: updatedStatus }, "Employee status", `${workerName} changed status to ${statusLabel}.`);
    }, { persist: false });

    if (session && supabase && isUuid(jobId) && isUuid(workerId)) {
      try {
        const currentJob = data.jobs.find(item => item.id === jobId);
        const rawPriorStatus = currentJob?.workerStatus?.[workerId] || { status: "notStarted", totalMs: 0, runningSince: null };
        const currentVisitId = getCurrentVisitId(currentJob);
        const priorStatus = (!isDefectJob(currentJob) || !currentVisitId || rawPriorStatus.visitId === currentVisitId)
          ? rawPriorStatus
          : { status: "notStarted", totalMs: 0, runningSince: null, visitId: currentVisitId };
        const now = Date.now();
        let totalMs = Number(priorStatus.totalMs) || 0;
        if (priorStatus.status === "running" && priorStatus.runningSince) totalMs += now - Number(priorStatus.runningSince);
        await updateAssignedBookingStatusInSupabase({
          jobId,
          workerId,
          status: nextStatus,
          totalMs,
          runningSince: nextStatus === "running" ? now : null,
          updatedAt: new Date(now).toISOString(),
          visitId: currentVisitId || null
        });
        await insertJobHistoryToSupabase({
          jobId,
          action: "Employee status",
          details: `${workerName} changed status to ${statusLabel}.`,
          createdBy: currentUser?.id || null
        });
      } catch (err) {
        console.error("Could not save employee status", err);
        alert(`Status was not saved: ${err.message}`);
      }
    }
  }

  function confirmJobComplete(jobId) {
    updateJobs(job => {
      if (job.id !== jobId) return job;
      return logJob({ ...job, category: "Completed", jobStatus: "Completed", completedConfirmed: true }, "Completed", "Supervisor confirmed job complete from calendar.");
    });
  }

  async function addEmployeeAttachments(jobId, workerId, files) {
    const fileList = [...(files || [])];
    if (!fileList.length) return;

    const workerName = getWorkerName(data.teamMembers, workerId);
    let newAttachments = [];

    if (session && supabase && isUuid(jobId)) {
      try {
        setJobsSyncMessage("Uploading photo/file attachment(s) to Supabase Storage...");
        for (const file of fileList) {
          const uploaded = await uploadAttachmentToSupabase({
            jobId,
            workerId,
            file,
            bucket: "job-photos",
            attachmentType: file.type?.startsWith("image/") ? "photo" : "employee_file",
            label: "Employee photo/file",
            uploadedBy: currentUser?.id || null
          });
          newAttachments.push(uploaded);
        }
        setJobsSyncMessage(`Uploaded ${newAttachments.length} attachment(s) to Supabase Storage.`);
      } catch (err) {
        console.error(err);
        alert(err?.message || "Could not upload attachment to Supabase Storage.");
        setJobsSyncMessage(err?.message ? `Attachment upload failed: ${err.message}` : "Attachment upload failed.");
        return;
      }
    } else {
      newAttachments = fileList.map(file => ({
        id: createId(),
        name: file.name,
        type: file.type || "file",
        size: file.size,
        addedAt: new Date().toISOString(),
        addedBy: workerName,
        source: "local-metadata-only"
      }));
    }

    let changedJob = null;
    updateJobs(job => {
      if (job.id !== jobId) return job;
      changedJob = logJob(
        { ...job, attachments: [...(job.attachments || []), ...newAttachments] },
        "Photos/files added",
        `${workerName} added ${newAttachments.length} photo/file attachment(s).`
      );
      return changedJob;
    }, { persist: false });

    if (session && supabase) {
      insertJobNoteToSupabase({
        jobId,
        workerId,
        noteText: `${workerName} uploaded ${newAttachments.length} photo/file attachment(s).`,
        noteType: "attachment_upload",
        createdBy: currentUser?.id || null
      }).catch(err => console.error("Could not save attachment note", err));
      insertJobHistoryToSupabase({
        jobId,
        action: "Attachment uploaded",
        details: `${workerName} uploaded ${newAttachments.length} photo/file attachment(s).`,
        createdBy: currentUser?.id || null
      }).catch(err => console.error("Could not save attachment history", err));
    }
  }

  async function saveEmployeeCompletion(jobId, workerId, completion) {
    let changedJob = null;
    const nextJobs = data.jobs.map(job => {
      if (job.id !== jobId) return job;

      const workerName = getWorkerName(data.teamMembers, workerId);
      const workerCompletions = {
        ...(job.workerCompletions || {}),
        [workerId]: {
          ...(job.workerCompletions?.[workerId] || {}),
          ...completion,
          visitId: getCurrentVisitId(job) || null,
          submittedComplete: getCurrentWorkerStatus(job, workerId) === "completed",
          updatedAt: new Date().toISOString(),
          updatedBy: workerName
        }
      };

      changedJob = logJob(
        { ...job, workerCompletions },
        "Completion update",
        completion.requiresAnotherTrade
          ? `${workerName} added completion notes and requested follow-up attendance from another trade.`
          : `${workerName} added completion notes.`
      );
      return changedJob;
    });

    updateData({
      ...data,
      jobs: nextJobs,
      messages: completion.requiresAnotherTrade
        ? [{
            id: createId(),
            jobId,
            direction: "internal",
            from: getWorkerName(data.teamMembers, workerId),
            text: `Completion note: job requires another trade. ${completion.followUpTrade ? `Suggested trade: ${completion.followUpTrade}. ` : ""}${completion.completionDescription || ""}`,
            date: new Date().toISOString(),
            unread: true
          }, ...data.messages]
        : data.messages
    });

    if (changedJob && session && supabase) {
      const workerName = getWorkerName(data.teamMembers, workerId);
      const noteParts = [
        completion.completionDescription ? `Works: ${completion.completionDescription}` : "",
        completion.materialsUsed ? `Materials: ${completion.materialsUsed}` : "",
        completion.requiresAnotherTrade ? `Another trade required${completion.followUpTrade ? `: ${completion.followUpTrade}` : ""}` : ""
      ].filter(Boolean);
      const noteText = noteParts.length ? noteParts.join("\n") : `${workerName} saved a completion update.`;
      try {
        const activeVisitId = getCurrentVisitId(changedJob) || "original";
        // The dedicated completion ledger is the source of truth and must save.
        // Legacy note/history writes are supplementary and must not make a
        // successful employee submission appear to have failed.
        await upsertCompletionSubmissionToSupabase({
          jobId,
          workerId,
          visitId: activeVisitId,
          completion,
          createdBy: currentUser?.id || null
        });
        const supplementaryWrites = await Promise.allSettled([
          insertJobNoteToSupabase({
            jobId,
            workerId,
            noteText,
            noteType: completion.requiresAnotherTrade ? "completion_follow_up" : "completion",
            visitId: activeVisitId,
            createdBy: currentUser?.id || null
          }),
          insertJobHistoryToSupabase({
            jobId,
            action: "Completion update",
            details: completion.requiresAnotherTrade
              ? `${workerName} saved a completion update and requested another trade.`
              : `${workerName} saved a completion update.`,
            createdBy: currentUser?.id || null
          })
        ]);
        supplementaryWrites.forEach(result => {
          if (result.status === "rejected") console.warn("Supplementary completion history write failed", result.reason);
        });
        setJobsSyncMessage("Employee update saved to Supabase.");
      } catch (err) {
        setJobsSyncMessage(`Employee update save failed: ${err.message}`);
        throw err;
      }
    }
    return true;
  }

  async function signIn(email, password) {
    if (!supabase) throw new Error("Supabase is not configured for this build.");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  async function sendPasswordReset(email) {
    if (!supabase) throw new Error("Supabase is not configured for this build.");
    const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  }

  async function updatePassword(newPassword) {
    if (!supabase) throw new Error("Supabase is not configured for this build.");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    setPasswordSetupMode("");
    cleanAuthUrl();
  }

  const topButtons = (
    <div className="actions top-menu">
      {currentUser && <span className="current-user-pill">{currentUser.email} · {profileLoading ? "checking role" : currentRole}</span>}
    </div>
  );

  return (
    <div className={activeView === "admin" ? "app admin-mode" : currentUser ? "app nav-mode employee-mode" : "app"}>
      {currentUser && <SideNav unreadMessages={unreadMessages} isAdmin={isAdminUser} onShare={() => setShareHubOpen(true)} onMessages={() => setMessagesOpen(true)} onPeople={() => setPeopleOpen(true)} onReports={() => setReportsOpen(true)} onTools={() => setToolsOpen(true)} onSettings={() => setSettingsOpen(true)} />}
      <header className="topbar aim-topbar">
        <div className="brand-block">
          <img src={`${import.meta.env.BASE_URL}aim-logo.png`} alt="AIM Construction Group WA" className="aim-logo" />
        </div>
        {topButtons}
      </header>


      {!currentUser ? (
        <AuthPanel onSignIn={signIn} onForgotPassword={sendPasswordReset} loading={authLoading} />
      ) : toolsOpen ? (
        <ToolRegisterPage
          tools={tools}
          history={toolHistory}
          workers={data.teamMembers}
          currentWorkerId={employeeId}
          isAdmin={isAdminUser}
          onClose={()=>setToolsOpen(false)}
          onRefresh={async()=>{
            const [freshTools, freshHistory] = await Promise.all([fetchToolsFromSupabase(), fetchToolHistoryFromSupabase()]);
            setTools(freshTools);
            setToolHistory(freshHistory);
          }}
        />
      ) : activeView === "admin" ? (
        <>
          <section className="toolbar">
            <div className="search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search title, client, JB, WO, PO, address..."/></div>
            <div className="week-controls"><button className="secondary" onClick={()=>setWeekStart(addDays(weekStart,-7))}><ChevronLeft size={16}/> Previous</button><button className="secondary" onClick={()=>setWeekStart(getStartOfWeek(new Date()))}>This week</button><button className="secondary" onClick={()=>setWeekStart(addDays(weekStart,7))}>Next <ChevronRight size={16}/></button></div>
          </section>
          <section className="admin-view-tabs">
            <button className={adminTab === "schedule" ? "active" : ""} onClick={() => setAdminTab("schedule")}>Schedule view</button>
            <button className={adminTab === "machinery" ? "active" : ""} onClick={() => setAdminTab("machinery")}>Machinery</button>
            <button className={adminTab === "attention" ? "active" : ""} onClick={() => setAdminTab("attention")}>Job Dashboard</button>
          </section>
          {adminTab === "attention" ? (
            <NeedsAttentionView jobs={data.jobs} workers={data.teamMembers} days={days} leaveRecords={data.leaveRecords} messages={data.messages} activeTab={dashboardTab} setActiveTab={setDashboardTab} onOpenJob={setEditingJob} />
          ) : adminTab === "machinery" ? (
            <MachineryView machines={machinery} bookings={machineryBookings} jobs={data.jobs} workers={data.teamMembers} days={days} selectedMachineId={selectedMachineId} setSelectedMachineId={setSelectedMachineId} onAddBooking={(context)=>setMachineryBookingOpen(context)} onEditBooking={(booking)=>setMachineryBookingOpen({ booking })} />
          ) : (
          <main className="workspace">
            <aside className={`bucket-panel ${bucketsCollapsed ? "collapsed" : ""}`}>
              <div className="bucket-title"><PanelLeft size={18}/><div><h2>Job buckets</h2><span>{filteredJobs.length} jobs displayed</span></div><button type="button" className="bucket-collapse-button" onClick={()=>setBucketsCollapsed(v=>!v)} aria-label={bucketsCollapsed ? "Expand job buckets" : "Collapse job buckets"}>{bucketsCollapsed ? <ChevronDown size={18}/> : <ChevronUp size={18}/>}</button></div>
              <div className="bucket-collapsible-content">
              <label>Client filter<select value={clientFilter} onChange={e=>setClientFilter(e.target.value)}><option>All</option>{clientOptions.map(c=><option key={c}>{c}</option>)}</select></label>
              <button
                className="primary full-width bucket-new-job pdf-drop-button"
                onClick={() => setEditingJob(emptyJob())}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = [...(e.dataTransfer.files || [])].find(f => f.name.toLowerCase().endsWith(".pdf"));
                  createJobFromPdfFile(file);
                }}
              >
                <Plus size={16}/> New job / Drop PDF
              </button>
              <div className="bucket-button-grid">{["All",...CATEGORIES].map(cat=>{const count=cat==="All"?bucketJobs.length:bucketJobs.filter(j=>j.category===cat).length;return <button key={cat} className={activeCategory===cat?"active":""} onClick={()=>setActiveCategory(cat)} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault(); const id=getDraggedJobId(e); if(id) moveToBucket(id,cat);}}><span>{cat}</span><em>{count}</em></button>})}</div>
              <div className="selected-bucket-list">{filteredJobs.map(job=><JobCard key={job.id} job={job} workerNames={getAssignedWorkerNames(data.teamMembers, job.assignedTo)} selected={selectedBucketJobId===job.id} onSelect={()=>setSelectedBucketJobId(job.id)} onDragStart={e=>handleDragStart(e,job.id)} onEdit={()=>setEditingJob(job)} onDelete={()=>cancelOrDeleteJob(job)}/>) }{filteredJobs.length===0 && <div className="empty small">No jobs in this bucket</div>}</div>
              </div>
            </aside>
            <section className="calendar-area">
              <section className="worker-filters"><label>Trade<select value={tradeFilter} onChange={e=>setTradeFilter(e.target.value)}><option>All</option>{TRADES.map(t=><option key={t}>{t}</option>)}</select></label><label>Base site<select value={siteFilter} onChange={e=>setSiteFilter(e.target.value)}><option>All</option>{BASE_SITES.map(s=><option key={s}>{s}</option>)}</select></label><label className="inline-check"><input type="checkbox" checked={hideUnavailable} onChange={e=>setHideUnavailable(e.target.checked)}/>Hide workers fully unavailable this week</label><div className="calendar-zoom-controls"><span>{calendarDayCount} days shown</span><button type="button" className="secondary" onClick={()=>setCalendarDayCount(count=>Math.min(14, count === 5 ? 7 : count === 7 ? 10 : 14))} disabled={calendarDayCount >= 14}><ZoomOut size={15}/> Zoom out</button><button type="button" className="secondary" onClick={()=>setCalendarDayCount(count=>Math.max(5, count === 14 ? 10 : count === 10 ? 7 : 5))} disabled={calendarDayCount <= 5}><ZoomIn size={15}/> Zoom in</button></div></section>
              <QuickActionsBar selectedJob={selectedBooking ? data.jobs.find(j=>j.id===selectedBooking.jobId) : null} selectedBooking={selectedBooking} copiedJob={copiedBooking ? data.jobs.find(j=>j.id===copiedBooking.jobId) : null} bucketJob={selectedBucketJobId ? data.jobs.find(j=>j.id===selectedBucketJobId) : null} onCopy={copySelectedBooking} onDelete={deleteSelectedBooking} onClear={clearQuickActions} onClearBucket={()=>setSelectedBucketJobId(null)} />
              <CalendarGrid days={days} dayMin={calendarDayMin} workers={visibleWorkers} jobs={scheduledJobs} leaveRecords={data.leaveRecords} messages={data.messages} selectedJobId={selectedBucketJobId} selectedBooking={selectedBooking} copiedBooking={copiedBooking} onCellPasteBooking={pasteCopiedBooking} onCellSelectBooking={bookSelectedJob} onDropJob={scheduleJob} onDragStart={handleDragStart} onSelectBooking={selectCalendarBooking} onOpenJobMessages={setJobMessagesJob} onAddItem={setCalendarPopup} onEditJob={setEditingJob} onDeleteJob={cancelOrDeleteJob} onToggle={toggleJobCheckbox} onConfirmComplete={confirmJobComplete}/>
            </section>
          </main>
          )}
        </>
      ) : (
        <EmployeeView
          workerId={employeeId}
          setWorkerId={setEmployeeId}
          workers={data.teamMembers}
          days={employeeDays}
          jobs={scheduledJobs}
          leaveRecords={data.leaveRecords}
          onStatus={updateWorkerJobStatus}
          onAddAttachment={addEmployeeAttachments}
          onCompletion={saveEmployeeCompletion}
          canSwitchWorker={isAdminUser}
          machines={machinery}
          machineryBookings={machineryBookings}
        />
      )}

      {currentUser && passwordSetupMode && (
        <PasswordSetupPanel
          mode={passwordSetupMode}
          email={currentUser.email}
          onSave={updatePassword}
          onCancel={() => { setPasswordSetupMode(""); cleanAuthUrl(); }}
        />
      )}

      <footer className="footer-actions"><button className="ghost" onClick={()=>{if(confirm("Reset demo data?")){updateData(initialData)}}}><RotateCcw size={15}/> Reset demo data</button></footer>

      {editingJob && <JobModal job={editingJob} teamMembers={data.teamMembers} isAdmin={isAdminUser} currentUser={currentUser} messages={data.messages} machines={machinery} machineryBookings={machineryBookings} onClose={()=>setEditingJob(null)} onSave={saveJob} onSendMessage={sendDemoMessage} onActionMessage={markMessageActioned} onReplyMessage={replyToMessage} />}
      {reportsOpen && isAdminUser && <ReportsModal jobs={data.jobs} workers={data.teamMembers} onClose={()=>setReportsOpen(false)} />}
      {machinerySettingsOpen && isAdminUser && <MachinerySettingsModal machines={machinery} onClose={()=>setMachinerySettingsOpen(false)} onSave={async(items)=>{try{await saveMachineryToSupabase(items);setMachinery(await fetchMachineryFromSupabase());setMachinerySettingsOpen(false);}catch(err){alert(err.message||"Could not save machinery");}}} />}
      {machineryBookingOpen && isAdminUser && <MachineryBookingModal context={machineryBookingOpen} machines={machinery} bookings={machineryBookings} jobs={data.jobs} workers={data.teamMembers} onClose={()=>setMachineryBookingOpen(null)} onSave={async(booking)=>{try{await saveMachineryBookingToSupabase(booking);setMachineryBookings(await fetchMachineryBookingsFromSupabase());setMachineryBookingOpen(null);}catch(err){alert(err.message||"Could not save machinery booking");}}} onDelete={async(id)=>{if(!confirm("Delete this machinery booking?"))return;await deleteMachineryBookingFromSupabase(id);setMachineryBookings(await fetchMachineryBookingsFromSupabase());setMachineryBookingOpen(null);}} />}
      {calendarPopup && <CalendarItemModal context={calendarPopup} onClose={()=>setCalendarPopup(null)} onSave={saveCalendarItem}/>} 
      {peopleOpen && isAdminUser && <PeopleModal workers={data.teamMembers} usingSupabase={Boolean(session && supabase)} saving={workersLoading} onClose={()=>setPeopleOpen(false)} onSave={async (workers)=>{
        try {
          const freshWorkers = await saveWorkers(workers.items || workers, workers.deletedWorkerIds || []);
          const activeWorkerItems = workers.items || workers;
          const inviteRequests = activeWorkerItems.filter(w => w.sendInvite && w.email && !w.inactive);
          const sent = [];
          for (const request of inviteRequests) {
            const savedWorker = (freshWorkers || activeWorkerItems).find(w =>
              (request.email && w.email && w.email.toLowerCase() === request.email.toLowerCase()) ||
              (request.id && w.id === request.id)
            );
            await inviteWorkerAccess(savedWorker || request, request.appRole || "employee");
            sent.push(request.email);
          }
          if (sent.length) alert(`Invite email sent to: ${sent.join(", ")}`);
          setPeopleOpen(false);
        } catch(err) {
          alert(err?.message || "Could not save employees or send invite.");
        }
      }} />}
      {settingsOpen && currentUser && <SettingsModal currentUser={currentUser} currentRole={currentRole} isAdminUser={isAdminUser} activeView={activeView} isInstalledPwa={isInstalledPwa} canPromptInstall={Boolean(installPrompt)} onInstall={installJobsched} onManageMachinery={()=>{setSettingsOpen(false);setMachinerySettingsOpen(true);}} onManageTools={()=>{setSettingsOpen(false);setToolsOpen(true);}} onClose={()=>setSettingsOpen(false)} onSetView={(nextView)=>{setView(nextView); setSettingsOpen(false);}} onChangePassword={()=>{setPasswordSetupMode("manual"); setSettingsOpen(false);}} onSignOut={async()=>{setSettingsOpen(false); await signOut();}} />}
      {shareHubOpen && <ShareHubModal onClose={()=>setShareHubOpen(false)} onShare={()=>{setShareHubOpen(false); setShareOpen(true)}} onRunSheet={()=>{setShareHubOpen(false); setRunSheetOpen(true)}} />}
      {shareOpen && <ShareScheduleModal data={data} workers={data.teamMembers} onClose={()=>setShareOpen(false)} />}
      {runSheetOpen && <DailyRunSheetModal data={data} workers={data.teamMembers} onClose={()=>setRunSheetOpen(false)} />}
      {messagesOpen && <MessagesModal messages={data.messages} jobs={data.jobs} onClose={()=>setMessagesOpen(false)} onAction={markMessageActioned} onReply={replyToMessage}/>} 
      {jobMessagesJob && <JobMessagesModal job={jobMessagesJob} messages={data.messages.filter(m=>m.jobId===jobMessagesJob.id)} onClose={()=>setJobMessagesJob(null)} onAction={markMessageActioned} onReply={replyToMessage}/>}
      {jobHistoryJob && <HistoryModal job={jobHistoryJob} onClose={()=>setJobHistoryJob(null)}/>} 
    </div>
  );
}


function SupabaseTestPanel({ result, user, jobsSyncMessage, jobsLoading }) {
  const connected = result.status === "connected";
  const checking = result.status === "checking";
  return (
    <section className={`supabase-test-panel ${connected ? "connected" : checking ? "checking" : "error"}`}>
      <div>
        <strong>{connected ? "Supabase authenticated" : checking ? "Checking Supabase" : "Supabase needs attention"}</strong>
        <span>{result.message}</span>
        {user && <span>Current user: {user.email}</span>}
        {jobsSyncMessage && <span>{jobsLoading ? "Loading Supabase jobs..." : jobsSyncMessage}</span>}
      </div>
      {connected && result.workers?.length > 0 && (
        <div className="supabase-worker-list">
          {result.workers.map(worker => (
            <span key={worker.id}>{worker.name || "Unnamed"}{worker.trade ? ` · ${worker.trade}` : ""}{worker.baseSite ? ` · ${worker.baseSite}` : ""}</span>
          ))}
        </div>
      )}
    </section>
  );
}

function AuthPanel({ onSignIn, onForgotPassword, loading }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await onSignIn(email.trim(), password);
    } catch (err) {
      setError(err?.message || "Sign in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function forgotPassword() {
    setError("");
    setNotice("");
    const targetEmail = email.trim();
    if (!targetEmail) {
      setError("Enter your email address first, then click Forgot password.");
      return;
    }
    setResetBusy(true);
    try {
      await onForgotPassword(targetEmail);
      setNotice(`Password reset email sent to ${targetEmail}.`);
    } catch (err) {
      setError(err?.message || "Could not send password reset email.");
    } finally {
      setResetBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <strong>Sign in to AIM CG</strong>
        <p>Use the Supabase user you created, for example your Gary admin login.</p>
        <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required /></label>
        <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required /></label>
        {error && <p className="auth-error">{error}</p>}
        {notice && <p className="auth-success">{notice}</p>}
        <button className="primary" type="submit" disabled={busy || loading}>{busy ? "Signing in..." : loading ? "Checking session..." : "Sign in"}</button>
        <button className="ghost full-width" type="button" onClick={forgotPassword} disabled={resetBusy}>{resetBusy ? "Sending reset email..." : "Forgot password?"}</button>
        <p className="muted">Forgot password sends a Supabase reset email to the address entered above.</p>
      </form>
    </main>
  );
}

function PasswordSetupPanel({ mode, email, onSave, onCancel }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const heading = mode === "invite" ? "Create your AIM CG password" : mode === "recovery" ? "Reset your AIM CG password" : "Set or change your Jobsched password";
  const hint = mode === "invite"
    ? "You have accepted an invite. Create a password now so you can sign in normally next time."
    : mode === "recovery"
      ? "Your reset link has been accepted. Enter a new password to finish the reset."
      : "Enter a new password for your current AIM CG login.";

  async function submit(e) {
    e.preventDefault();
    setError("");
    setNotice("");

    if (password.length < 8) {
      setError("Use at least 8 characters for the password.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The two password fields do not match.");
      return;
    }

    setBusy(true);
    try {
      await onSave(password);
      setNotice("Password saved. You can now use this password next time you sign in.");
      setPassword("");
      setConfirmPassword("");
      setTimeout(() => onCancel?.(), 1200);
    } catch (err) {
      setError(err?.message || "Could not save password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="password-setup-overlay">
      <form className="auth-card password-setup-card" onSubmit={submit}>
        <div className="modal-title-row">
          <div>
            <strong>{heading}</strong>
            <p>{hint}</p>
          </div>
          <button className="icon-button" type="button" onClick={onCancel} aria-label="Close"><X size={18}/></button>
        </div>
        <p className="muted">Current user: {email}</p>
        <label>New password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" required /></label>
        <label>Confirm password<input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" required /></label>
        {error && <p className="auth-error">{error}</p>}
        {notice && <p className="auth-success">{notice}</p>}
        <button className="primary" type="submit" disabled={busy}>{busy ? "Saving password..." : "Save password"}</button>
      </form>
    </div>
  );
}

function NeedsAttentionDashboard({ jobs, workers, days, leaveRecords, messages, onOpenJob }) {
  const activeJobs = jobs.filter(j => j.category !== "Cancelled" && j.category !== "Completed" && !j.isAdHoc && !j.isTravelComment);
  const notReady = activeJobs.filter(j => !getReadiness(j).ready);
  const unread = messages.filter(m => m.unread).length;
  const missingMaterials = activeJobs.filter(isAwaitingMaterials);
  const unconfirmedScheduled = activeJobs.filter(j => j.category === "Scheduled" && !j.clientAccepted);
  const conflictJobs = activeJobs.filter(job => (job.assignedTo || []).some(workerId => {
    const worker = workers.find(w => w.id === workerId);
    if (!worker || !job.startDate || !job.endDate) return false;
    return getDatesInRange(job.startDate, job.endDate).some(date => getWorkerAvailability(worker, date, leaveRecords).status !== "Onsite");
  }));
  const cards = [
    { label: "Action needed", count: notReady.length, hint: "Jobs needing action" },
    { label: "Awaiting materials", count: missingMaterials.length, hint: "Materials not ready" },
    { label: "Unconfirmed", count: unconfirmedScheduled.length, hint: "Scheduled but client not accepted" },
    { label: "Roster conflicts", count: conflictJobs.length, hint: "Assigned during RNR/leave" },
    { label: "Unread messages", count: unread, hint: "Messages needing review" }
  ];
  return <section className="attention-dashboard">{cards.map(card=><div key={card.label} className={card.count?"attention-card warning":"attention-card"}><strong>{card.count}</strong><span>{card.label}</span><em>{card.hint}</em></div>)}</section>;
}


function NeedsAttentionView({ jobs, workers, days, leaveRecords, messages, activeTab, setActiveTab, onOpenJob }) {
  const activeJobs = jobs.filter(j => j.category !== "Cancelled" && j.category !== "Completed" && !j.isAdHoc && !j.isTravelComment);
  const actionNeeded = activeJobs.filter(job => isActionNeeded(job, messages));
  const awaitingMaterials = activeJobs.filter(isAwaitingMaterials);
  const unconfirmed = activeJobs.filter(job => job.category === "Scheduled" && !job.clientAccepted && !job.isAdHoc && !job.isTravelComment);
  const unread = messages.filter(m => m.unread);
  const unreadJobIds = new Set(unread.map(m => m.jobId));
  const unreadJobs = activeJobs.filter(job => unreadJobIds.has(job.id));

  const groups = {
    "Action needed": { jobs: actionNeeded, hint: "Unorganised safety/permits, incomplete job details, or unactioned reschedule/reassign requests" },
    "Awaiting materials": { jobs: awaitingMaterials, hint: "Materials not ready or not checked" },
    "Unconfirmed appointments": { jobs: unconfirmed, hint: "Scheduled jobs not accepted by client" },
    "Unread messages": { jobs: unreadJobs, hint: "Messages requiring review" }
  };
  const selected = groups[activeTab] || groups["Action needed"];

  return (
    <main className="attention-view">
      <section className="attention-hero">
        <div>
          <h2>Job Dashboard</h2>
          <p>Select a category below to see the jobs that need action.</p>
        </div>
      </section>

      <section className="attention-dashboard attention-dashboard-large dashboard-tabs">
        {Object.entries(groups).map(([label, group]) => (
          <button key={label} type="button" onClick={() => setActiveTab(label)} className={activeTab === label ? "attention-card warning active" : group.jobs.length ? "attention-card warning" : "attention-card"}>
            <strong>{group.jobs.length}</strong>
            <span>{label}</span>
            <em>{group.hint}</em>
          </button>
        ))}
      </section>

      <section className="attention-list-panel">
        <h3>{activeTab}</h3>
        {selected.jobs.map(job => {
          const readiness = getReadiness(job);
          return (
            <article key={job.id} className="attention-job-row" onClick={() => onOpenJob(job)}>
              <div>
                <strong>{job.title}</strong>
                <span>{job.client || "No client"} · {job.site || "No site"}</span>
                {activeTab === "Action needed" && <span>{getActionNeededText(job, messages)}</span>}{activeTab !== "Action needed" && !readiness.ready && <span>Missing: {readiness.missing.join(", ")}</span>}
              </div>
              <button className="secondary">Open</button>
            </article>
          );
        })}
        {!selected.jobs.length && <p className="muted">No jobs in this category.</p>}
      </section>
    </main>
  );
}

function QuickActionsBar({ selectedJob, selectedBooking, copiedJob, bucketJob, onCopy, onDelete, onClear, onClearBucket }) {
  if (!selectedJob && !copiedJob && !bucketJob) return null;
  const selectedLocked = selectedJob && isLockedCompletedJob(selectedJob);
  return (
    <div className="quick-actions-bar">
      <strong>Quick actions</strong>
      {bucketJob && <span>Booking: {bucketJob.title}</span>}
      {selectedJob && <span>Selected: {selectedJob.title}</span>}
      {copiedJob && <span>Copied: {copiedJob.title} — click calendar dates to paste</span>}
      {bucketJob && <button type="button" className="ghost" onClick={onClearBucket}>Clear booking selection</button>}
      <button type="button" className="secondary" onClick={onCopy} disabled={!selectedBooking || selectedLocked}><Copy size={15}/> Copy</button>
      <button type="button" className="secondary danger" onClick={onDelete} disabled={!selectedBooking || selectedLocked}><Trash2 size={15}/> Delete booking</button>
      <button type="button" className="ghost" onClick={onClear}>Clear quick actions</button>
      {selectedLocked && <em>Return completed jobs to active status before copy/delete.</em>}
    </div>
  );
}

function ReplyAction({ message, onReply }) {
  const [open, setOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");

  if (!message || message.actioned || message.direction !== "in") return null;

  async function sendReply() {
    const text = replyText.trim();
    if (!text) {
      setStatus("Enter a reply before sending.");
      return;
    }

    try {
      setSending(true);
      setStatus("");
      await onReply?.(message, text);
      setStatus("Reply sent and message actioned.");
      setReplyText("");
      setOpen(false);
    } catch (err) {
      console.error("Could not send reply", err);
      setStatus(err?.message || "Reply failed.");
    } finally {
      setSending(false);
    }
  }

  if (!open) {
    return <button type="button" className="secondary" onClick={() => setOpen(true)}>Reply</button>;
  }

  return (
    <div className="message-reply-box">
      <label>
        Reply
        <textarea rows="3" value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Type a reply to send by SMS..." />
      </label>
      <div className="message-reply-actions">
        <button type="button" className="primary" disabled={sending} onClick={sendReply}>{sending ? "Sending..." : "Send reply"}</button>
        <button type="button" className="secondary" disabled={sending} onClick={() => { setOpen(false); setStatus(""); }}>Cancel</button>
      </div>
      {status && <span className={status.includes("sent") ? "success-text" : "error-text"}>{status}</span>}
    </div>
  );
}

function JobMessagesModal({ job, messages, onClose, onAction, onReply }) {
  const sorted = [...(messages || [])].sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
  return (
    <div className="modal-backdrop">
      <div className="modal mini-modal">
        <div className="modal-header"><h2>Messages - {job.title}</h2><button className="icon" onClick={onClose}><X size={18}/></button></div>
        <div className="message-list compact">
          {sorted.map(m => (
            <article key={m.id} className={m.unread && !m.actioned ? "message-card unread" : "message-card"}>
              <div><strong>{m.direction === "in" ? "Received" : "Sent"}: {m.direction === "in" ? (m.from || m.phoneNumber || "Client") : (m.to || m.phoneNumber || "Client")}</strong><span>{formatDateTime(m.date)}</span></div>
              <p>{m.text || "(No message text)"}</p>
              {m.actioned && m.actionedAt && <em>Actioned {m.actionedBy ? `by ${m.actionedBy} ` : ""}on {formatDateTime(m.actionedAt)}</em>}
              {!m.actioned && m.direction === "in" && <ReplyAction message={m} onReply={onReply || onAction} />}
            </article>
          ))}
          {!sorted.length && <div className="empty small">No SMS/email messages linked to this job yet.</div>}
        </div>
      </div>
    </div>
  );
}

function CalendarGrid({ days, dayMin = "230px", workers, jobs, leaveRecords, messages, selectedJobId, selectedBooking, copiedBooking, onCellPasteBooking, onCellSelectBooking, onDropJob, onDragStart, onSelectBooking, onOpenJobMessages, onAddItem, onEditJob, onDeleteJob, onToggle, onConfirmComplete }) {
  const dayMinNumber = Number.parseInt(dayMin, 10) || 230;
  const calendarMinWidth = 180 + (days.length * dayMinNumber);
  return <div className="calendar-wrap"><div className="calendar-grid" data-day-count={days.length} style={{"--day-count": days.length, "--calendar-day-min": dayMin, minWidth: `${calendarMinWidth}px`}}><div className="corner-cell">Workers</div>{days.map(day=><div key={getIsoDate(day)} className={`day-header ${isToday(day)?"today":""}`}><strong>{formatDayName(day)}</strong><span>{formatDateHeader(day)}</span></div>)}{workers.map(worker=><React.Fragment key={worker.id}><div className="worker-cell"><button className="worker-profile-button" type="button"><strong>{worker.name || "Unnamed worker"}</strong><span>{worker.trade||"No trade"} · {worker.baseSite||"No site"}</span><em>{worker.sapNumber||"No SAP"}</em></button></div>{days.map(day=>{const iso=getIsoDate(day); const availability=getWorkerAvailability(worker, iso, leaveRecords); const dayLeaves=leaveRecords.filter(l=>l.workerId===worker.id && isDateWithinRange(iso,l.startDate,l.endDate)); const cellJobs=jobs.filter(j=>jobOccursForWorkerOnDate(j, worker.id, iso)).sort(sortScheduleItems); return <div key={`${worker.id}-${iso}`} className={`calendar-cell ${isToday(day)?"today-cell":""} ${availability.status==="Onsite"?"onsite-cell":"rnr-cell"}`} onDragOver={e=>{e.preventDefault(); e.dataTransfer.dropEffect="move";}} onClick={(e)=>{ if (e.target !== e.currentTarget) return; if (selectedJobId) onCellSelectBooking(worker.id, iso); else if (copiedBooking) onCellPasteBooking(worker.id, iso); }} onDrop={e=>{e.preventDefault(); const context=readDragContext(e); const id=context.jobId || e.dataTransfer.getData("text/plain"); if(id) onDropJob(id, worker.id, iso, context);}}><div className={`roster-badge ${availability.status==="Onsite"?"onsite":"rnr"}`}>{availability.label}</div><button className="add-cell-job" onClick={()=>onAddItem({workerId:worker.id,workerName:worker.name,date:iso})}><Plus size={14}/> Item</button><div className="cell-jobs">{dayLeaves.map(l=><LeaveCard key={l.id} leave={l} />)}{cellJobs.map(job=>{ const jobMessages = messages.filter(m=>m.jobId===job.id); const hasUnreadMessage = jobMessages.some(m=>m.unread && !m.actioned); const hasAnyMessage = jobMessages.length > 0; const isSelected = selectedBooking?.jobId === job.id && selectedBooking?.workerId === worker.id && selectedBooking?.date === iso; return <CalendarJob key={`${job.id}-${worker.id}-${iso}`} job={job} workerId={worker.id} date={iso} isStart={isJobOccurrenceStart(job, worker.id, iso)} selected={isSelected} hasAnyMessage={hasAnyMessage} hasUnreadMessage={hasUnreadMessage} onSelect={()=>onSelectBooking(job.id,worker.id,iso)} onOpenMessages={()=>onOpenJobMessages(job)} onDragStart={e=>onDragStart(e,job.id,worker.id,iso)} onEdit={()=>onEditJob(job)} onDelete={()=>onDeleteJob(job)} onToggleAppointmentSent={()=>onToggle(job.id,"appointmentSent")} onToggleClientAccepted={()=>onToggle(job.id,"clientAccepted")} onConfirmComplete={()=>onConfirmComplete(job.id)}/>})}</div></div>})}</React.Fragment>)}</div></div>;
}

function CalendarJob({ job, workerId, date, isStart, selected, hasAnyMessage, hasUnreadMessage, onSelect, onOpenMessages, onDragStart, onEdit, onDelete, onToggleAppointmentSent, onToggleClientAccepted, onConfirmComplete }) {
  const status = getCurrentWorkerStatus(job, workerId);
  const meta = STATUS_META[status] || STATUS_META.notStarted;
  const currentVisitId = getCurrentVisitId(job);
  const currentCompletion = job.workerCompletions?.[workerId];
  const completionBelongsToCurrentVisit = !currentVisitId || currentCompletion?.visitId === currentVisitId;
  const completedByTrade = status === "completed" && completionBelongsToCurrentVisit && Boolean(currentCompletion?.submissionId || currentCompletion?.updatedAt);
  const needsAnotherTrade = Object.values(job.workerCompletions || {}).some(c => c.requiresAnotherTrade);
  const defectJob = isDefectJob(job);
  let tabClass = "neutral";
  if (job.category === "Completed" || job.completedConfirmed) tabClass = "completed";
  else if (defectJob) tabClass = "defect";
  else if (isAwaitingMaterials(job) || needsAnotherTrade) tabClass = "followup";
  else if (isMaterialsReady(job) && getReadiness(job).ready) tabClass = "confirmed";
  return (
    <article className={`calendar-job ${selected ? "selected-booking" : ""} ${defectJob ? "defect-callback" : ""} ${job.category === "Completed" || job.completedConfirmed ? "supervisor-complete" : ""} ${completedByTrade && job.category !== "Completed" ? "trade-complete" : ""} ${job.isAdHoc?"ad-hoc":""} ${job.isTravelComment?"travel-comment":""} ${isStart?"range-start":"range-middle"}`} draggable onDragStart={onDragStart} onClick={onSelect}>
      <div className="range-body">
        {hasAnyMessage && <button type="button" className={hasUnreadMessage ? "job-envelope unread" : "job-envelope sent"} title={hasUnreadMessage ? "New message needs action" : "Sent/actioned messages"} onClick={(e)=>{e.stopPropagation(); onOpenMessages();}}><Mail size={13}/></button>}
        {isStart ? (
          <>
            <div className="card-top">
              <span className="calendar-ref-row"><span className="wo">{job.isTravelComment ? "Travel" : job.isAdHoc ? "Ad hoc" : job.quoteNumber || job.jobNumber || "No QUO"}</span>{!job.isAdHoc && !job.isTravelComment && getSafetyPermits(job).length > 0 && <span className={`safety-hardhat ${getSafetyPermitStatus(job)}`} title={getSafetyPermitTitle(job)}>⛑</span>}</span>
              <span className={`status-dot ${status}`} title={meta.label}>{meta.icon}</span>
              <div className="card-actions"><button onClick={(e)=>{e.stopPropagation(); onEdit();}} title="Edit job"><Pencil size={14}/></button></div>
            </div>
            <h3>{job.title}</h3>
            {defectJob && <span className="defect-pill">Call back - Defects</span>}
            {!job.isAdHoc && !job.isTravelComment && job.client && <div className="meta compact-meta"><span title={job.client}>{shortClientName(job.client)}</span></div>}
            {!job.isAdHoc && !job.isTravelComment && <p>Total running: {formatDuration(getWorkerTotalMs(job, workerId))}</p>}
            {!job.isAdHoc && !job.isTravelComment && <div className="appointment-checks"><label><input type="checkbox" checked={!!job.appointmentSent} onChange={(e)=>{e.stopPropagation(); onToggleAppointmentSent();}}/>SMS sent</label><label><input type="checkbox" checked={!!job.clientAccepted} onChange={(e)=>{e.stopPropagation(); onToggleClientAccepted();}}/>Client accepted</label></div>}
            {completedByTrade && job.category !== "Completed" && !job.isAdHoc && !job.isTravelComment && <button className="confirm-complete-button" onClick={(e)=>{e.stopPropagation(); onConfirmComplete();}}>Confirm complete</button>}
          </>
        ) : <div className="continuation"><strong>{job.title}</strong><span>{job.quoteNumber || job.workOrderNumber || ""}</span></div>}
        <span className={`status-tab ${tabClass}`} title="Job status indicator" />
      </div>
    </article>
  );
}

function LeaveCard({ leave }) { return <article className="leave-card"><span className="leave-pill">{leave.leaveType}</span>{leave.notes&&<p>{leave.notes}</p>}</article>; }
function JobCard({ job, workerNames, selected, onSelect, onDragStart, onEdit, onDelete }) {
  return (
    <article className={`card compact bucket-card-minimal ${selected ? "selected" : ""} ${isDefectJob(job) ? "defect-card" : ""}`} draggable onClick={onSelect} onDragStart={onDragStart} onDoubleClick={onEdit}>
      <div className="card-top">
        <span className={`category-pill ${isDefectJob(job) ? "defect" : ""}`}>{isDefectJob(job) ? "Call back - Defects" : job.category}</span>
        <div className="card-actions">
          <button onClick={(e)=>{e.stopPropagation(); onEdit();}}><Pencil size={14}/></button>
          <button onClick={(e)=>{e.stopPropagation(); onDelete();}}><Trash2 size={14}/></button>
        </div>
      </div>
      <h3>{job.title}</h3>
      {job.client && <p className="bucket-client">{job.client}</p>}
      {job.category === "Cancelled" && <p>In Cancelled bucket. Delete again to permanently remove.</p>}
    </article>
  );
}

function JobModal({ job, teamMembers, currentUser, isAdmin = false, messages = [], machines = [], machineryBookings = [], onClose, onSave, onSendMessage, onActionMessage, onReplyMessage }) {
  const [form, setForm] = useState(normaliseJob({ ...job, machineryBookings: (job.machineryBookings?.length ? job.machineryBookings : machineryBookings.filter(b=>b.jobId===job.id)) }));
  const [activeTab, setActiveTab] = useState(job._openClientTab ? "client" : "details");
  const [noteInput, setNoteInput] = useState("");
  const [showNoteInTradeView, setShowNoteInTradeView] = useState(false);
  const [materialInput, setMaterialInput] = useState("");
  const [messageText, setMessageText] = useState(job._messageMode === "reschedule" ? buildRescheduleMessage(normaliseJob(job)) : buildScheduleMessage(normaliseJob(job)));
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [smsSending, setSmsSending] = useState(false);
  const [smsStatus, setSmsStatus] = useState("");
  const jobMessages = useMemo(
    () => [...(messages || [])]
      .filter((m) => m.jobId === form.id)
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)),
    [messages, form.id]
  );
  const tabs = ["details","scheduling","client","notes","materials","attachments","history"];
  function update(field, value){ setForm({...form,[field]:value}); }
  function updateStartDate(value){
    setForm(cur => ({
      ...cur,
      startDate: value,
      endDate: !cur.endDate || compareIsoDates(cur.endDate, value) < 0 ? value : cur.endDate
    }));
  }
  function toggleWorker(id){ const list=form.assignedTo||[]; update("assignedTo", list.includes(id)?list.filter(x=>x!==id):[...list,id]); }
  function addNote(){ if(!noteInput.trim()) return; setForm(cur=>({...cur,noteHistory:[{id:createId(),date:new Date().toISOString(),user:CURRENT_USER,text:noteInput.trim(),showInTradeView:Boolean(showNoteInTradeView)},...(cur.noteHistory||[])]})); setNoteInput(""); setShowNoteInTradeView(false); }
  function addMaterial(){ if(!materialInput.trim()) return; setForm(cur=>({...cur,materials:[...(cur.materials||[]),{id:createId(),text:materialInput.trim(),status:"Required"}]})); setMaterialInput(""); }
  async function addAttachments(files){
    const fileList = [...(files || [])];
    if(!fileList.length) return;
    setAttachmentUploading(true);
    try {
      const items = [];
      if (supabase && isUuid(form.id)) {
        for (const file of fileList) {
          items.push(await uploadAttachmentToSupabase({
            jobId: form.id,
            workerId: null,
            file,
            bucket: file.type?.startsWith("image/") ? "job-photos" : "job-files",
            attachmentType: file.type?.startsWith("image/") ? "photo" : "job_file",
            label: "Job attachment",
            uploadedBy: currentUser?.id || null
          }));
        }
      } else {
        for (const file of fileList) items.push(await fileToAttachment(file, "Job attachment"));
      }
      setForm(cur=>({...cur,attachments:[...(cur.attachments||[]),...items]}));
    } catch (err) {
      console.error(err);
      alert(err?.message || "Could not upload attachment.");
    } finally {
      setAttachmentUploading(false);
    }
  }
  function addScheduleBlock(){ setForm(cur=>({...cur,scheduleBlocks:[...(cur.scheduleBlocks||[]),{id:createId(),workerId:"",startDate:cur.startDate||getIsoDate(new Date()),endDate:cur.endDate||cur.startDate||getIsoDate(new Date())}]})); }
  function updateScheduleBlock(id, field, value){
    setForm(cur=>({
      ...cur,
      scheduleBlocks:(cur.scheduleBlocks||[]).map(b=>{
        if(b.id !== id) return b;
        if(field === "startDate") return { ...b, startDate: value, endDate: !b.endDate || compareIsoDates(b.endDate, value) < 0 ? value : b.endDate };
        if(field === "endDate" && b.startDate && value && compareIsoDates(value, b.startDate) < 0) return { ...b, endDate: b.startDate };
        return { ...b, [field]: value };
      })
    }));
  }
  function removeScheduleBlock(id){ setForm(cur=>({...cur,scheduleBlocks:(cur.scheduleBlocks||[]).filter(b=>b.id!==id)})); }
  function addMachineryBooking(){ setForm(cur=>({...cur,machineryBookings:[...(cur.machineryBookings||[]),{id:createId(),machineId:"",workerId:"",startDate:cur.startDate||getIsoDate(new Date()),endDate:cur.endDate||cur.startDate||getIsoDate(new Date()),period:"full_day",bookingType:"job",description:""}]})); }
  function updateMachineryBooking(id, field, value){ setForm(cur=>({...cur,machineryBookings:(cur.machineryBookings||[]).map(b=>b.id===id?{...b,[field]:value}:b)})); }
  function removeMachineryBooking(id){ setForm(cur=>({...cur,machineryBookings:(cur.machineryBookings||[]).filter(b=>b.id!==id)})); }
  function machineryConflict(row){ return findMachineryConflict(row, machineryBookings.filter(b=>b.jobId!==form.id)); }
  function addSafetyPermit(name){
    if(!name || getSafetyPermits(form).some(p=>p.name===name)) return;
    setForm(cur=>({...cur,safetyPermits:[...getSafetyPermits(cur),{id:createId(),name,organised:false}]}));
  }
  function updateSafetyPermit(id, field, value){
    setForm(cur=>({...cur,safetyPermits:getSafetyPermits(cur).map(p=>p.id===id?{...p,[field]:value}:p)}));
  }
  function removeSafetyPermit(id){
    setForm(cur=>({...cur,safetyPermits:getSafetyPermits(cur).filter(p=>p.id!==id)}));
  }
  async function handleSendClientMessage(){
    setSmsStatus("");
    if(!form.clientPhone){ alert("Enter a client phone number first."); return; }
    setSmsSending(true);
    try {
      const result = await onSendMessage(form, messageText);
      if(result !== false) {
        update("appointmentSent", true);
        setSmsStatus("SMS sent and saved");
      }
    } catch (err) {
      console.error(err);
      setSmsStatus(err?.message || "SMS failed");
      alert(err?.message || "Could not send SMS.");
    } finally {
      setSmsSending(false);
    }
  }
  function submit(e){ e.preventDefault(); if(!form.title.trim()){setActiveTab("details"); alert("Please enter a job title."); return;} const rows=form.machineryBookings||[]; for(const row of rows){ if(!row.machineId||!row.workerId||!row.startDate||!row.endDate){setActiveTab("scheduling");alert("Complete all machinery booking fields or remove the incomplete row.");return;} const machine=machines.find(m=>m.id===row.machineId); if(machine?.status==="out_of_service"){setActiveTab("scheduling");alert(`${machineDisplayName(machine)} is out of service and cannot be booked.`);return;} if(machineryConflict(row)){setActiveTab("scheduling");alert("A machinery booking conflicts with an existing booking.");return;} const duplicate=rows.find(other=>other.id!==row.id&&findMachineryConflict(row,[other])); if(duplicate){setActiveTab("scheduling");alert("Two machinery bookings on this job overlap for the same machine.");return;} } onSave(form); }
  return <div className="modal-backdrop"><form className="modal job-modal-tabs" onSubmit={submit}><div className="modal-header clean-modal-header"><div><h2>{job.title?"Edit job":"New job"}</h2><p>{form.jobNumber||form.workOrderNumber||form.poNumber||"Job details"}</p></div><button type="button" className="icon" onClick={onClose}><X size={18}/></button></div><div className="job-tab-bar">{tabs.map(t=><button type="button" key={t} className={activeTab===t?"active":""} onClick={()=>setActiveTab(t)}>{labelTab(t)}</button>)}</div>
  {activeTab==="details"&&<section className="job-tab-panel"><div className="two-col"><label>Start date<input type="date" value={form.startDate||""} onChange={e=>updateStartDate(e.target.value)}/></label><label>End date<input type="date" value={form.endDate||""} onChange={e=>update("endDate", e.target.value && form.startDate && compareIsoDates(e.target.value, form.startDate) < 0 ? form.startDate : e.target.value)}/></label></div><label>Job title<input value={form.title} onChange={e=>update("title",e.target.value)}/></label><div className="two-col"><label>Client<input value={form.client||""} onChange={e=>update("client",e.target.value)}/></label><label>Address<input value={form.address||""} onChange={e=>update("address",e.target.value)}/></label></div><label>Site / area<select value={form.site||""} onChange={e=>update("site",e.target.value)}><option value="">Not set</option>{JOB_SITES.map(site=><option key={site}>{site}</option>)}</select></label><div className="two-col"><label>Job number<input value={form.jobNumber||""} onChange={e=>update("jobNumber",e.target.value)}/></label><label>Quote number<input value={form.quoteNumber||""} onChange={e=>update("quoteNumber",e.target.value)}/></label></div><div className="two-col"><label>Work order number<input value={form.workOrderNumber||""} onChange={e=>update("workOrderNumber",e.target.value)}/></label><label>PO number<input value={form.poNumber||""} onChange={e=>update("poNumber",e.target.value)}/></label></div>{isAdmin && <label>Job value excluding GST ($)<input type="number" min="0" step="0.01" value={form.jobValue ?? ""} onChange={e=>update("jobValue", e.target.value === "" ? "" : Number(e.target.value))}/></label>}<label>Job description / scope<textarea rows="5" value={form.notes||""} onChange={e=>update("notes",e.target.value)}/></label><label>Work done summary<textarea rows="6" readOnly value={buildWorkDoneSummary(form, teamMembers)} placeholder="Employee completion notes and reassignment requests will appear here."/></label></section>}
  {activeTab==="scheduling"&&<section className="job-tab-panel">
    <div className="two-col"><label>Bucket / schedule category<select value={form.category} onChange={e=>setForm(cur=>{ const nextCategory = e.target.value; const keepDefect = nextCategory === "Scheduled" && cur.jobStatus === "Call back - Defects"; return { ...cur, category: nextCategory, jobStatus: keepDefect ? "Call back - Defects" : nextCategory, isDefectCallback: keepDefect }; })}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></label><label>Work status<input value={form.isDefectCallback ? "Call back - Defects" : "Managed automatically from schedule and Trade View"} readOnly/></label></div>
    <label>Site / area<select value={form.site||""} onChange={e=>update("site",e.target.value)}><option value="">Not set</option>{JOB_SITES.map(site=><option key={site}>{site}</option>)}</select></label>
    {form.jobStatus === "Call back - Defects" && <div className="defect-warning"><strong>Call back / defects job</strong><span>This job will show red on the calendar. Keep the bucket/category as Scheduled once it is rebooked.</span></div>}
    <label>Materials status<select value={form.materialsStatus||"Parts from stock"} onChange={e=>update("materialsStatus",e.target.value)}>{MATERIAL_STATUSES.map(m=><option key={m}>{m}</option>)}</select></label>
    <SafetyPermitPicker permits={getSafetyPermits(form)} onAdd={addSafetyPermit} onToggle={updateSafetyPermit} onRemove={removeSafetyPermit} />
    <div className="worker-picker"><strong>Assigned workers for the main booking dates</strong><p className="muted">The main booking uses the start and end dates on the Details tab.</p><div className="worker-options">{teamMembers.map(m=><label key={m.id} className="check-option"><input type="checkbox" checked={form.assignedTo.includes(m.id)} onChange={()=>toggleWorker(m.id)}/>{m.name}</label>)}</div></div>
    <section className="schedule-blocks-panel"><div className="card-top"><div><strong>Additional booking days / employees</strong><p className="muted">Use this for non-consecutive days, return visits, or different employees on different dates.</p></div><button type="button" className="secondary" onClick={addScheduleBlock}><Plus size={15}/> Add booking</button></div>{(form.scheduleBlocks||[]).map(block=><div className="schedule-block-row" key={block.id}><label>Employee<select value={block.workerId||""} onChange={e=>updateScheduleBlock(block.id,"workerId",e.target.value)}><option value="">Select employee</option>{teamMembers.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label>Start<input type="date" value={block.startDate||""} onChange={e=>updateScheduleBlock(block.id,"startDate",e.target.value)}/></label><label>End<input type="date" value={block.endDate||""} onChange={e=>updateScheduleBlock(block.id,"endDate",e.target.value)}/></label><button type="button" className="icon" onClick={()=>removeScheduleBlock(block.id)}><X size={15}/></button></div>)}{!(form.scheduleBlocks||[]).length&&<p className="muted">No additional booking rows added.</p>}</section>
    {isAdmin && <section className="schedule-blocks-panel machinery-job-panel"><div className="card-top"><div><strong>Machinery bookings</strong><p className="muted">Book one or more machines for all or part of this job.</p></div><button type="button" className="secondary" onClick={addMachineryBooking}><Tractor size={15}/> Add machinery</button></div>{(form.machineryBookings||[]).map(row=>{const conflict=machineryConflict(row);return <div className={`machinery-booking-row ${conflict?"has-conflict":""}`} key={row.id}><label>Machine<select value={row.machineId||""} onChange={e=>updateMachineryBooking(row.id,"machineId",e.target.value)}><option value="">Select machine</option>{machines.filter(m=>m.status!=="out_of_service"&&m.active!==false).map(m=><option key={m.id} value={m.id}>{machineDisplayName(m)}</option>)}</select></label><label>Employee<select value={row.workerId||""} onChange={e=>updateMachineryBooking(row.id,"workerId",e.target.value)}><option value="">Select employee</option>{teamMembers.filter(w=>!w.inactive).map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label><label>Start<input type="date" value={row.startDate||""} onChange={e=>updateMachineryBooking(row.id,"startDate",e.target.value)}/></label><label>End<input type="date" value={row.endDate||""} onChange={e=>updateMachineryBooking(row.id,"endDate",e.target.value)}/></label><label>Period<select value={row.period||"full_day"} onChange={e=>updateMachineryBooking(row.id,"period",e.target.value)}><option value="am">AM</option><option value="pm">PM</option><option value="full_day">Full day</option></select></label><button type="button" className="icon" onClick={()=>removeMachineryBooking(row.id)}><X size={15}/></button>{conflict&&<span className="booking-conflict">Unavailable: {conflict.description||conflict.jobTitle||"existing booking"}</span>}</div>})}{!(form.machineryBookings||[]).length&&<p className="muted">No machinery booked.</p>}</section>}
  </section>}
  {activeTab==="client"&&<section className="job-tab-panel"><div className="two-col"><label>Client contact<input value={form.clientContact||""} onChange={e=>update("clientContact",e.target.value)}/></label><label>Client phone<input value={form.clientPhone||""} onChange={e=>update("clientPhone",e.target.value)} placeholder="e.g. 04xx xxx xxx or +61..."/></label></div><div className="appointment-panel stacked"><label className="check-option plain"><input type="checkbox" checked={!!form.appointmentSent} onChange={e=>update("appointmentSent",e.target.checked)}/>Appointment SMS sent</label><label className="check-option plain"><input type="checkbox" checked={!!form.clientAccepted} onChange={e=>update("clientAccepted",e.target.checked)}/>Client accepted appointment</label><div className="message-template-actions"><button type="button" className="secondary" onClick={()=>setMessageText(buildScheduleMessage(form))}>Scheduling message</button><button type="button" className="secondary" onClick={()=>setMessageText(buildRescheduleMessage(form))}>Reschedule message</button></div><label className="full-width-label">SMS message text<textarea rows="5" value={messageText} onChange={e=>setMessageText(e.target.value)}/></label><button type="button" className={smsStatus === "SMS sent and saved" ? "secondary success-button" : "secondary"} disabled={smsSending} onClick={handleSendClientMessage}><MessageSquare size={16}/> {smsSending ? "Sending..." : smsStatus === "SMS sent and saved" ? "SMS sent" : "Send SMS"}</button>{smsStatus && <span className={smsStatus === "SMS sent and saved" ? "success-text" : "error-text"}>{smsStatus}</span>}<a className="secondary" href={form.clientPhone?`tel:${form.clientPhone}`:undefined} onClick={(e)=>{if(!form.clientPhone){e.preventDefault(); alert("Enter a client phone number first.")}}}><Phone size={16}/> Call client</a></div><section className="message-history-panel"><div className="card-top"><div><strong>SMS history</strong><p className="muted">Sent and received messages linked to this job.</p></div></div><div className="message-list compact">{jobMessages.map(m=><article key={m.id} className={m.unread&&!m.actioned?"message-card unread":"message-card"}><div><strong>{m.direction==="in"?"Received":"Sent"}: {m.direction==="in"?(m.from||m.phoneNumber||"Client"):(m.to||m.phoneNumber||"Client")}</strong><span>{formatDateTime(m.date)}</span></div><p>{m.text||"(No message text)"}</p>{m.actioned&&m.actionedAt&&<em>Actioned {m.actionedBy?`by ${m.actionedBy} `:""}on {formatDateTime(m.actionedAt)}</em>}{!m.actioned&&m.direction==="in"&&<ReplyAction message={m} onReply={onReplyMessage || onActionMessage} />}</article>)}{!jobMessages.length&&<div className="empty small">No SMS messages linked to this job yet.</div>}</div></section></section>}
  {activeTab==="notes"&&<section className="job-tab-panel"><div className="note-entry note-entry-stacked"><textarea rows="3" value={noteInput} onChange={e=>setNoteInput(e.target.value)} placeholder="Add note history entry..."/><label className="inline-check"><input type="checkbox" checked={showNoteInTradeView} onChange={e=>setShowNoteInTradeView(e.target.checked)}/>Show note in Trade View</label><button type="button" className="secondary" onClick={addNote}>Add note</button></div><HistoryList items={form.noteHistory||[]} type="notes" onToggleTrade={(id,value)=>setForm(cur=>({...cur,noteHistory:(cur.noteHistory||[]).map(n=>n.id===id?{...n,showInTradeView:value}:n)}))}/></section>}
  {activeTab==="materials"&&<section className="job-tab-panel"><label>Materials status<select value={form.materialsStatus||"Parts from stock"} onChange={e=>update("materialsStatus",e.target.value)}>{MATERIAL_STATUSES.map(m=><option key={m}>{m}</option>)}</select></label><div className="note-entry"><input value={materialInput} onChange={e=>setMaterialInput(e.target.value)} placeholder="Add material item..."/><button type="button" className="secondary" onClick={addMaterial}><Package size={16}/> Add material</button></div><div className="simple-list">{(form.materials||[]).map(item=><div key={item.id}><span>{item.text}</span><button type="button" onClick={()=>setForm(cur=>({...cur,materials:cur.materials.filter(x=>x.id!==item.id)}))}><X size={14}/></button></div>)}{!(form.materials||[]).length&&<p>No materials added.</p>}</div></section>}
  {activeTab==="attachments"&&<section className="job-tab-panel"><div className="attachment-drop" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault(); addAttachments(e.dataTransfer.files||[]);}}><Paperclip size={24}/><strong>Drag files or photos here</strong><span>Files are uploaded to Supabase Storage and linked to this job.</span><label className="secondary file-pick">Choose files<input type="file" multiple disabled={attachmentUploading} onChange={e=>addAttachments(e.target.files||[])}/></label>{attachmentUploading && <span className="muted">Uploading...</span>}</div><div className="simple-list">{(form.attachments||[]).map(a=><div key={a.id}><span>{a.name} · {formatBytes(a.size)}</span><button type="button" className="mini-action" onClick={()=>openStoredAttachment(a)}><Download size={14}/> Open</button><button type="button" onClick={()=>setForm(cur=>({...cur,attachments:cur.attachments.filter(x=>x.id!==a.id)}))}><X size={14}/></button></div>)}</div></section>}
  {activeTab==="history"&&<section className="job-tab-panel"><HistoryList items={form.jobHistory||[]} type="history"/></section>}
  <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button type="submit" className="primary">Save job</button></div></form></div>
}

function CalendarItemModal({ context, onClose, onSave }) {
  const [mode, setMode] = useState("");
  const [text, setText] = useState("");
  const [leaveType, setLeaveType] = useState("Sick leave");
  const [startDate, setStartDate] = useState(context.date);
  const [endDate, setEndDate] = useState(context.date);
  const [travelPdf, setTravelPdf] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!mode) { alert("Choose an item type."); return; }
    if (compareIsoDates(endDate, startDate) < 0) { alert("End date cannot be before start date."); return; }

    if (mode === "leave") {
      onSave({ type: "leave", workerId: context.workerId, leaveType, startDate, endDate, notes: text });
      return;
    }

    onSave({ type: mode, workerId: context.workerId, text, startDate, endDate, travelPdfFile: mode === "travel" ? travelPdf : null });
  }

  return (
    <div className="modal-backdrop">
      <form className="modal mini-modal" onSubmit={submit}>
        <div className="modal-header"><h2>Add calendar item</h2><button type="button" className="icon" onClick={onClose}><X size={18}/></button></div>
        <p className="modal-note">{context.workerName} · {formatIsoForDisplay(context.date)}</p>
        <div className="choice-grid">
          <button type="button" className={mode === "adHoc" ? "choice-card active" : "choice-card"} onClick={() => setMode("adHoc")}><Wrench/><strong>Ad hoc job</strong><span>Simple non-PO task.</span></button>
          <button type="button" className={mode === "leave" ? "choice-card active" : "choice-card"} onClick={() => setMode("leave")}><CalendarX/><strong>Leave</strong><span>Sick, annual or other leave.</span></button>
          <button type="button" className={mode === "travel" ? "choice-card active" : "choice-card"} onClick={() => setMode("travel")}><Plane/><strong>Travel/accommodation</strong><span>Comments visible on the calendar.</span></button>
        </div>
        {mode && <>
          <div className="two-col"><label>Start date<input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}/></label><label>End date<input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}/></label></div>
          {mode === "leave" && <label>Leave type<select value={leaveType} onChange={e => setLeaveType(e.target.value)}>{LEAVE_TYPES.map(t => <option key={t}>{t}</option>)}</select></label>}
          <label>{mode === "leave" ? "Notes" : "Details"}<textarea rows="4" value={text} onChange={e => setText(e.target.value)}/></label>
          {mode === "travel" && <div className="attachment-drop travel-pdf-drop" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const file = [...(e.dataTransfer.files || [])].find(f => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")); if (file) setTravelPdf(file); }}>
            <Paperclip size={22}/>
            <strong>Drag accommodation confirmation PDF here</strong>
            <span>{travelPdf ? travelPdf.name : "PDF will be attached to the travel/accommodation item."}</span>
            <label className="secondary file-pick">Choose PDF<input type="file" accept="application/pdf" onChange={e => setTravelPdf(e.target.files?.[0] || null)}/></label>
          </div>}
        </>}
        <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button type="submit" className="primary">Save item</button></div>
      </form>
    </div>
  );
}



function MachineryView({ machines, bookings, jobs, workers, days, selectedMachineId, setSelectedMachineId, onAddBooking, onEditBooking }) {
  const activeMachines = machines.filter(m=>m.active!==false);
  return <main className="workspace machinery-workspace">
    <aside className="machinery-list-panel"><div className="bucket-title"><Tractor size={18}/><div><h2>Machinery</h2><span>{activeMachines.length} assets</span></div></div><div className="machine-list">{activeMachines.map(machine=><button key={machine.id} className={selectedMachineId===machine.id?"machine-list-item active":"machine-list-item"} onClick={()=>setSelectedMachineId(machine.id)}><strong>{machineDisplayName(machine)}</strong><span>{machine.registration||"No registration"}</span>{machine.status==="out_of_service"&&<em>Out of service</em>}</button>)}{!activeMachines.length&&<div className="empty small">Add machinery in Settings.</div>}</div></aside>
    <section className="calendar-area"><div className="machinery-toolbar"><div><strong>Machinery calendar</strong><span>AM, PM and full-day availability</span></div><button className="primary" onClick={()=>onAddBooking({machineId:selectedMachineId,date:getIsoDate(new Date())})}><Plus size={15}/> Ad hoc booking</button></div><MachineryCalendar machines={selectedMachineId?activeMachines.filter(m=>m.id===selectedMachineId):activeMachines} bookings={bookings} jobs={jobs} workers={workers} days={days} onAddBooking={onAddBooking} onEditBooking={onEditBooking}/></section>
  </main>;
}

function MachineryCalendar({ machines, bookings, jobs, workers, days, onAddBooking, onEditBooking }) {
  return <div className="calendar-wrap machinery-calendar-wrap"><div className="machinery-calendar-grid" style={{"--day-count":days.length}}><div className="corner-cell">Machine</div>{days.map(day=><div key={getIsoDate(day)} className={`day-header ${isToday(day)?"today":""}`}><strong>{formatDayName(day)}</strong><span>{formatDateHeader(day)}</span></div>)}{machines.map(machine=><React.Fragment key={machine.id}><div className={`worker-cell machine-cell ${machine.status==="out_of_service"?"out-of-service":""}`}><strong>{machineDisplayName(machine)}</strong><span>{machine.registration||machine.baseLocation||""}</span>{machine.status==="out_of_service"&&<em>Out of service</em>}</div>{days.map(day=>{const date=getIsoDate(day);const dayBookings=bookings.filter(b=>b.machineId===machine.id&&isDateWithinRange(date,b.startDate,b.endDate));return <div key={`${machine.id}-${date}`} className={`machinery-day-cell ${machine.status==="out_of_service"?"blocked":""}`}><div className="machinery-period am"><span>AM</span>{renderMachinerySlot(machine,date,"am",dayBookings,jobs,workers,onAddBooking,onEditBooking)}</div><div className="machinery-period pm"><span>PM</span>{renderMachinerySlot(machine,date,"pm",dayBookings,jobs,workers,onAddBooking,onEditBooking)}</div></div>})}</React.Fragment>)}</div></div>;
}
function renderMachinerySlot(machine,date,period,dayBookings,jobs,workers,onAddBooking,onEditBooking){
  if(machine.status==="out_of_service") return <span className="machine-blocked-label">Unavailable</span>;
  const booking=dayBookings.find(b=>b.period==="full_day"||b.period===period);
  if(!booking) return <button className="machine-slot-add" onClick={()=>onAddBooking({machineId:machine.id,date,period})}>+</button>;
  const job=jobs.find(j=>j.id===booking.jobId);const worker=workers.find(w=>w.id===booking.workerId);
  return <button className={`machine-booking ${booking.bookingType}`} onClick={()=>onEditBooking(booking)} title={booking.description||job?.title||"Machinery booking"}><strong>{job?.title||booking.description||booking.bookingType}</strong><span>{worker?.name||"Unassigned"}</span></button>;
}

function MachinerySettingsModal({ machines, onClose, onSave }){
 const [items,setItems]=useState(machines.length?machines:[]);
 function add(){setItems(cur=>[{id:createId(),machineType:"",assetNumber:"",registration:"",baseLocation:"",notes:"",status:"available",active:true},...cur]);}
 function update(id,field,value){setItems(cur=>cur.map(m=>m.id===id?{...m,[field]:value}:m));}
 return <div className="modal-backdrop"><div className="modal machinery-settings-modal"><div className="modal-header"><div><h2>Manage machinery</h2><p>Add assets and control availability.</p></div><button className="icon" onClick={onClose}><X size={18}/></button></div><button className="primary" onClick={add}><Plus size={15}/> Add machine</button><div className="machinery-settings-list">{items.map(m=><section key={m.id} className="machine-settings-card"><div className="two-col"><label>Machine type<input value={m.machineType||""} onChange={e=>update(m.id,"machineType",e.target.value)} placeholder="e.g. Kubota 1.7t"/></label><label>Asset number<input value={m.assetNumber||""} onChange={e=>update(m.id,"assetNumber",e.target.value)}/></label></div><div className="two-col"><label>Registration<input value={m.registration||""} onChange={e=>update(m.id,"registration",e.target.value)}/></label><label>Base location<input value={m.baseLocation||""} onChange={e=>update(m.id,"baseLocation",e.target.value)}/></label></div><label>Status<select value={m.status||"available"} onChange={e=>update(m.id,"status",e.target.value)}><option value="available">Available</option><option value="out_of_service">Out of service</option><option value="inactive">Inactive</option></select></label><label>Notes<textarea rows="2" value={m.notes||""} onChange={e=>update(m.id,"notes",e.target.value)}/></label><label className="inline-check"><input type="checkbox" checked={m.active!==false} onChange={e=>update(m.id,"active",e.target.checked)}/>Show in machinery calendar</label></section>)}{!items.length&&<div className="empty">No machinery added.</div>}</div><div className="modal-actions"><button className="secondary" onClick={onClose}>Cancel</button><button className="primary" onClick={()=>onSave(items)}>Save machinery</button></div></div></div>;
}

function MachineryBookingModal({ context, machines, bookings, jobs, workers, onClose, onSave, onDelete }){
 const existing=context.booking||null;
 const [form,setForm]=useState(existing||{id:createId(),machineId:context.machineId||"",jobId:"",workerId:"",startDate:context.date||getIsoDate(new Date()),endDate:context.date||getIsoDate(new Date()),period:context.period||"full_day",bookingType:"ad_hoc",description:""});
 function update(field,value){setForm(cur=>({...cur,[field]:value}));}
 const conflict=findMachineryConflict(form,bookings.filter(b=>b.id!==form.id));
 const machine=machines.find(m=>m.id===form.machineId);
 async function submit(e){e.preventDefault();if(!form.machineId||!form.startDate||!form.endDate){alert("Select a machine and dates.");return;}if(machine?.status==="out_of_service"){alert("This machine is out of service and cannot be booked.");return;}if(conflict){alert("This machine is already booked for the selected period.");return;}if(form.bookingType!=="job"&&!form.description.trim()){alert("Enter a booking description.");return;}await onSave(form);}
 return <div className="modal-backdrop"><form className="modal machinery-booking-modal" onSubmit={submit}><div className="modal-header"><div><h2>{existing?"Edit machinery booking":"New machinery booking"}</h2><p>AM, PM or full-day booking.</p></div><button type="button" className="icon" onClick={onClose}><X size={18}/></button></div><label>Machine<select value={form.machineId} onChange={e=>update("machineId",e.target.value)}><option value="">Select machine</option>{machines.filter(m=>m.active!==false).map(m=><option key={m.id} value={m.id} disabled={m.status==="out_of_service"}>{machineDisplayName(m)}{m.status==="out_of_service"?" — Out of service":""}</option>)}</select></label><div className="two-col"><label>Booking type<select value={form.bookingType} onChange={e=>update("bookingType",e.target.value)}><option value="ad_hoc">Ad hoc</option><option value="maintenance">Maintenance</option><option value="repairs">Repairs</option><option value="job">Job</option></select></label><label>Employee<select value={form.workerId||""} onChange={e=>update("workerId",e.target.value)}><option value="">Unassigned</option>{workers.filter(w=>!w.inactive).map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label></div>{form.bookingType==="job"?<label>Job<select value={form.jobId||""} onChange={e=>update("jobId",e.target.value)}><option value="">Select job</option>{jobs.filter(j=>j.category!=="Cancelled").map(j=><option key={j.id} value={j.id}>{j.title}</option>)}</select></label>:<label>Description<textarea rows="3" value={form.description||""} onChange={e=>update("description",e.target.value)} placeholder="Enter maintenance, repairs or ad hoc details"/></label>}<div className="two-col"><label>Start<input type="date" value={form.startDate} onChange={e=>update("startDate",e.target.value)}/></label><label>End<input type="date" value={form.endDate} onChange={e=>update("endDate",e.target.value)}/></label></div><label>Period<select value={form.period} onChange={e=>update("period",e.target.value)}><option value="am">AM</option><option value="pm">PM</option><option value="full_day">Full day</option></select></label>{existing&&<div className="booking-audit-summary"><strong>Booking history</strong><span>Created: {formatDateTime(form.createdAt)}</span><span>Last updated: {formatDateTime(form.updatedAt)}</span></div>}{conflict&&<div className="defect-warning"><strong>Booking conflict</strong><span>This machine is already booked during the selected period.</span></div>}<div className="modal-actions">{existing&&<button type="button" className="danger" onClick={()=>onDelete(form.id)}>Delete</button>}<button type="button" className="secondary" onClick={onClose}>Cancel</button><button type="submit" className="primary">Save booking</button></div></form></div>;
}

function ReportsModal({ jobs, workers, onClose }) {
  const [reportType, setReportType] = useState("completed");
  const [startDate, setStartDate] = useState(getIsoDate(addDays(new Date(), -30)));
  const [endDate, setEndDate] = useState(getIsoDate(new Date()));
  const [client, setClient] = useState("All");
  const [workerId, setWorkerId] = useState("All");
  const clients = [...new Set(jobs.map(j=>j.client).filter(Boolean))].sort();
  const rows = useMemo(() => jobs.filter(job => {
    if (job.isTravelComment || job.isAdHoc) return false;
    const completed = job.category === "Completed" || job.completedConfirmed;
    if (reportType === "completed" && !completed) return false;
    if (reportType === "active" && (completed || job.category === "Cancelled")) return false;
    if (client !== "All" && job.client !== client) return false;
    const assigned = getAllAssignedWorkerIds(job);
    if (workerId !== "All" && !assigned.includes(workerId)) return false;
    const date = completed ? getJobCompletionDate(job) : (job.startDate || job.endDate || "");
    return (!startDate || !date || date.slice(0,10) >= startDate) && (!endDate || !date || date.slice(0,10) <= endDate);
  }).map(job => {
    const workerIds = getAllAssignedWorkerIds(job);
    const labourHours = workerIds.reduce((sum,id)=>sum + getWorkerTotalMs(job,id)/3600000,0);
    const labourCost = workerIds.reduce((sum,id)=>{
      const worker = workers.find(w=>w.id===id);
      return sum + (getWorkerTotalMs(job,id)/3600000) * (Number(worker?.internalHourlyCost)||0);
    },0);
    const value = Number(job.jobValue)||0;
    return {
      "Job": job.title,
      "Job number": job.jobNumber,
      "WO": job.workOrderNumber,
      "Quote": job.quoteNumber,
      "PO": job.poNumber,
      "Client": job.client,
      "Address": job.address,
      "Status": job.category,
      "Completed by": workerIds.map(id=>getWorkerName(workers,id)).join(", "),
      "Completion time": getJobCompletionDate(job) ? formatDateTime(getJobCompletionDate(job)) : "",
      "Labour hours": Number(labourHours.toFixed(2)),
      "Job value ex GST": value,
      "Labour cost": Number(labourCost.toFixed(2)),
      "Value less labour": Number((value-labourCost).toFixed(2))
    };
  }), [jobs, workers, reportType, startDate, endDate, client, workerId]);
  const totals = rows.reduce((a,r)=>({hours:a.hours+r["Labour hours"], value:a.value+r["Job value ex GST"], cost:a.cost+r["Labour cost"]}),{hours:0,value:0,cost:0});
  function exportExcel(){ const ws=XLSX.utils.json_to_sheet(rows); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"Jobs report"); XLSX.writeFile(wb,`aim-cg-${reportType}-${startDate}-to-${endDate}.xlsx`); }
  return <div className="modal-backdrop reports-backdrop"><div className="modal reports-modal"><div className="modal-header"><div><h2>Reports</h2><p>Admin-only operational and labour reporting.</p></div><button className="icon" onClick={onClose}><X size={18}/></button></div>
    <div className="report-filters"><label>Report<select value={reportType} onChange={e=>setReportType(e.target.value)}><option value="completed">Jobs completed</option><option value="active">Jobs active</option><option value="all">All jobs</option></select></label><label>From<input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/></label><label>To<input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)}/></label><label>Client<select value={client} onChange={e=>setClient(e.target.value)}><option>All</option>{clients.map(c=><option key={c}>{c}</option>)}</select></label><label>Employee<select value={workerId} onChange={e=>setWorkerId(e.target.value)}><option value="All">All</option>{workers.filter(w=>!w.inactive).map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label></div>
    <div className="report-summary"><strong>{rows.length} jobs</strong><span>{totals.hours.toFixed(2)} labour hours</span><span>{formatMoney(totals.value)} job value</span><span>{formatMoney(totals.cost)} labour cost</span><span>{formatMoney(totals.value-totals.cost)} value less labour</span></div>
    <div className="report-actions"><button className="secondary" onClick={()=>window.print()}><Printer size={16}/> Print / PDF</button><button className="primary" onClick={exportExcel}><Download size={16}/> Export Excel</button></div>
    <div className="report-table-wrap"><table className="report-table"><thead><tr>{rows[0] && Object.keys(rows[0]).map(k=><th key={k}>{k}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{Object.entries(r).map(([k,v])=><td key={k}>{k.includes("value")||k.includes("cost")||k==="Value less labour"?formatMoney(v):v}</td>)}</tr>)}</tbody></table>{!rows.length&&<div className="empty">No jobs match the selected report.</div>}</div>
  </div></div>;
}

function getAllAssignedWorkerIds(job){ return [...new Set([...(job.assignedTo||[]), ...(job.scheduleBlocks||[]).map(b=>b.workerId).filter(Boolean)])]; }
function getJobCompletionDate(job){ const dates=Object.values(job.workerCompletions||{}).map(c=>c?.updatedAt).filter(Boolean).sort(); return dates.at(-1) || job.completedAt || ""; }
function formatMoney(value){ return new Intl.NumberFormat("en-AU",{style:"currency",currency:"AUD"}).format(Number(value)||0); }

function SideNav({ unreadMessages, isAdmin, onShare, onMessages, onPeople, onReports, onTools, onSettings }) {
  return (
    <nav className="side-nav" aria-label="Main actions">
      {isAdmin && <button title="Share" onClick={onShare}><Share2 size={22}/></button>}
      {isAdmin && <button title="Messages" onClick={onMessages} className="side-nav-message"><Inbox size={22}/>{unreadMessages > 0 && <span>{unreadMessages}</span>}</button>}
      {isAdmin && <button title="People" onClick={onPeople}><Users size={22}/></button>}
      {isAdmin && <button title="Reports" onClick={onReports}><BookOpen size={22}/></button>}
      <button title="Tool register" onClick={onTools}><Wrench size={22}/></button>
      <button title="Settings" onClick={onSettings}><Settings size={22}/></button>
    </nav>
  );
}

function SettingsModal({ currentUser, currentRole, isAdminUser, activeView, isInstalledPwa, canPromptInstall, onInstall, onManageMachinery, onManageTools, onClose, onSetView, onChangePassword, onSignOut }) {
  return (
    <div className="modal-backdrop">
      <div className="modal mini-modal settings-menu-modal">
        <div className="modal-header"><div><h2>Settings</h2><p>{currentUser?.email || "Signed in user"} · {currentRole}</p></div><button className="icon" onClick={onClose}><X size={18}/></button></div>
        <div className="settings-action-list">
          {isAdminUser && <button type="button" className={activeView === "admin" ? "choice-card active" : "choice-card"} onClick={() => onSetView("admin")}><UserCog/><strong>Admin View</strong><span>Scheduling, dashboards, reports and administration.</span></button>}
          <button type="button" className={activeView === "employee" ? "choice-card active" : "choice-card"} onClick={() => onSetView("employee")}><Users/><strong>Trade View</strong><span>Assigned work, completion updates and tools.</span></button>
          {isAdminUser && <button type="button" className="choice-card" onClick={onManageMachinery}><Tractor/><strong>Manage machinery</strong><span>Add machines, asset details and out-of-service status.</span></button>}
          {isAdminUser && <button type="button" className="choice-card" onClick={onManageTools}><Wrench/><strong>Manage tools</strong><span>Add, assign, transfer and return tools.</span></button>}
          <button type="button" className="choice-card" onClick={onChangePassword}><Settings/><strong>Change password</strong><span>Set or update the password for this account.</span></button>
          <button type="button" className="choice-card" onClick={onSignOut}><X/><strong>Sign out</strong><span>Log out of AIM CG on this device.</span></button>
          <button type="button" className="choice-card" onClick={onInstall} disabled={isInstalledPwa}><Download/><strong>{isInstalledPwa ? "App Installed" : "Install AIM CG"}</strong><span>{isInstalledPwa ? "AIM CG is running as an installed app on this device." : canPromptInstall ? "Add an AIM CG icon to this device." : "Show instructions to add AIM CG to the home screen."}</span></button>
        </div>
      </div>
    </div>
  );
}

function ToolRegisterPage({ tools, history, workers, currentWorkerId, isAdmin, onClose, onRefresh }) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const visibleTools = tools.filter(tool => {
    const q = query.trim().toLowerCase();
    if (!isAdmin && tool.assignedWorkerId !== currentWorkerId && tool.status !== "available") return true;
    return !q || [tool.description, tool.toolId, tool.serialNumber, tool.brandModel].join(" ").toLowerCase().includes(q);
  });
  const ownHistory = isAdmin ? history : history.filter(item => item.workerId === currentWorkerId || item.fromWorkerId === currentWorkerId);
  async function act(tool, action, workerId = null, reason = "") {
    setBusy(true);
    try { await saveToolActionToSupabase({ tool, action, workerId, reason }); await onRefresh(); }
    catch (error) { alert(error.message || "Tool update failed"); }
    finally { setBusy(false); }
  }
  async function saveTool(form) {
    setBusy(true);
    try { await saveToolToSupabase(form); setEditing(null); await onRefresh(); }
    catch (error) { alert(error.message || "Could not save tool"); }
    finally { setBusy(false); }
  }
  return <main className="tool-register-page"><section className="tool-register-shell"><div className="tool-register-page-header"><div><h1>Tool Register</h1><p>{isAdmin ? "Manage tool allocation, status and history." : "View your tools, sign out available tools and report faults."}</p></div><button className="secondary" onClick={onClose}><ChevronLeft size={17}/> Back</button></div>
    <div className="tool-register-actions"><div className="search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Filter by description or tool ID..."/></div>{isAdmin&&<button className="primary" onClick={()=>setEditing({id:createId(),description:"",toolId:"",serialNumber:"",brandModel:"",status:"available",assignedWorkerId:"",notes:"",active:true,persisted:false})}><Plus size={16}/> Add tool</button>}</div>
    <div className="tool-table-wrap"><table className="tool-table"><thead><tr><th>Description</th><th>Tool ID</th><th>Last/current holder</th><th>Signed out</th><th>Status</th><th>Actions</th></tr></thead><tbody>{visibleTools.map(tool=>{const holder=getWorkerName(workers,tool.assignedWorkerId);return <tr key={tool.id}><td>{tool.description}<small>{tool.brandModel||tool.serialNumber}</small></td><td>{tool.toolId}</td><td>{tool.assignedWorkerId?holder:"—"}</td><td>{tool.signedOutAt?formatDateTime(tool.signedOutAt):"—"}</td><td><span className={`tool-status ${tool.status}`}>{tool.status.replaceAll("_"," ")}</span></td><td><div className="tool-row-actions">{isAdmin&&<button className="mini-action" onClick={()=>setEditing({...tool})}><Pencil size={14}/> Edit</button>}{tool.status==="available"&&<button disabled={busy} className="mini-action" onClick={()=>isAdmin?setEditing({...tool,status:"signed_out"}):act(tool,"sign_out",currentWorkerId)}>{isAdmin?"Assign":"Sign out"}</button>}{tool.status==="signed_out"&&((isAdmin)||tool.assignedWorkerId===currentWorkerId)&&<button disabled={busy} className="mini-action" onClick={()=>act(tool,"return",tool.assignedWorkerId)}>Return</button>}{tool.status!=="out_of_service"&&<button disabled={busy} className="mini-action danger" onClick={()=>{const reason=prompt("Describe the fault / reason");if(reason)act(tool,"out_of_service",tool.assignedWorkerId,reason)}}>Out of service</button>}{isAdmin&&tool.status==="out_of_service"&&<button disabled={busy} className="mini-action" onClick={()=>act(tool,"return_to_service",null,"Returned to service by admin")}>Return to service</button>}</div></td></tr>})}</tbody></table>{!visibleTools.length&&<div className="empty">No tools found.</div>}</div>
    <details className="tool-history-panel"><summary>{isAdmin?"Tool use history":"My tool use history"}</summary>{ownHistory.map(item=><div key={item.id} className="tool-history-row"><strong>{item.action.replaceAll("_"," ")}</strong><span>{item.toolDescription} · {formatDateTime(item.createdAt)}</span><p>{item.reason||""}</p></div>)}{!ownHistory.length&&<p>No history recorded.</p>}</details>
    {editing&&<ToolEditor tool={editing} workers={workers} onClose={()=>setEditing(null)} onSave={saveTool}/>} 
  </section></main>;
}

function ToolEditor({ tool, workers, onClose, onSave }) { const [form,setForm]=useState(tool); const update=(k,v)=>setForm(cur=>({...cur,[k]:v})); return <div className="nested-modal"><div className="modal mini-modal"><div className="modal-header"><h3>{tool.description?"Edit tool":"Add tool"}</h3><button className="icon" onClick={onClose}><X size={16}/></button></div><label>Tool description<input value={form.description||""} onChange={e=>update("description",e.target.value)}/></label><div className="two-col"><label>Tool ID<input value={form.toolId||""} onChange={e=>update("toolId",e.target.value)}/></label><label>Serial number<input value={form.serialNumber||""} onChange={e=>update("serialNumber",e.target.value)}/></label></div><label>Brand / model<input value={form.brandModel||""} onChange={e=>update("brandModel",e.target.value)}/></label><label>Assigned employee<select value={form.assignedWorkerId||""} onChange={e=>update("assignedWorkerId",e.target.value)}><option value="">Unassigned</option>{workers.filter(w=>!w.inactive).map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label><label>Status<select value={form.status||"available"} onChange={e=>update("status",e.target.value)}><option value="available">Available</option><option value="signed_out">Signed out</option><option value="out_of_service">Out of service</option><option value="lost">Lost</option><option value="inactive">Inactive</option></select></label><label>Notes<textarea rows="3" value={form.notes||""} onChange={e=>update("notes",e.target.value)}/></label><div className="modal-actions"><button className="secondary" onClick={onClose}>Cancel</button><button className="primary" onClick={()=>onSave(form)}>Save tool</button></div></div></div> }

function ShareHubModal({ onClose, onShare, onRunSheet }) {
  return (
    <div className="modal-backdrop">
      <div className="modal mini-modal">
        <div className="modal-header"><h2>Share / run sheet</h2><button className="icon" onClick={onClose}><X size={18}/></button></div>
        <div className="choice-grid two-choice">
          <button type="button" className="choice-card" onClick={onShare}><Share2/><strong>Share schedule</strong><span>Export to Excel or share schedule via email.</span></button>
          <button type="button" className="choice-card" onClick={onRunSheet}><FileSheetIcon/><strong>Daily run sheet</strong><span>Prepare the selected day's run sheet.</span></button>
        </div>
      </div>
    </div>
  );
}

function FileSheetIcon(){ return <Package size={22}/>; }

function TradePicker({ value = [], onChange }) {
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  function toggle(trade) {
    onChange(selected.includes(trade) ? selected.filter(t => t !== trade) : [...selected, trade]);
  }
  return (
    <div className="worker-picker trade-picker">
      <strong>Required trade/s</strong>
      <div className="worker-options">{TRADES.map(trade => <label key={trade} className="check-option"><input type="checkbox" checked={selected.includes(trade)} onChange={() => toggle(trade)}/>{trade}</label>)}</div>
    </div>
  );
}

function SafetyPermitPicker({ permits, onAdd, onToggle, onRemove }) {
  const [selected, setSelected] = useState("");
  const available = SAFETY_PERMIT_OPTIONS.filter(option => !permits.some(p => p.name === option));
  function addSelected(value){
    if(!value) return;
    onAdd(value);
    setSelected("");
  }
  return (
    <section className="safety-permit-panel">
      <label>Safety and permits
        <select value={selected} onChange={e => { setSelected(e.target.value); addSelected(e.target.value); }}>
          <option value="">Select safety/permit item</option>
          {available.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
      {permits.length > 0 && <div className="safety-permit-list">
        {permits.map(permit => (
          <div key={permit.id} className={permit.organised ? "safety-permit-row organised" : permit.inProgress ? "safety-permit-row in-progress" : "safety-permit-row outstanding"}>
            <span>{permit.name}</span>
            <label className="check-option plain"><input type="checkbox" checked={!!permit.inProgress} onChange={e => onToggle(permit.id, "inProgress", e.target.checked)} disabled={!!permit.organised} />In progress</label>
            <label className="check-option plain"><input type="checkbox" checked={!!permit.organised} onChange={e => onToggle(permit.id, "organised", e.target.checked)} />Organised</label>
            <button type="button" className="icon" onClick={() => onRemove(permit.id)}><X size={14}/></button>
          </div>
        ))}
      </div>}
    </section>
  );
}

function PeopleModal({ workers, usingSupabase, saving, onClose, onSave }) {
  const [items, setItems] = useState(workers.map(w => ({ inactive: false, accessRevoked: false, appRole: "employee", sendInvite: false, ...w })));
  const [deletedWorkerIds, setDeletedWorkerIds] = useState([]);
  const [filter, setFilter] = useState("");
  const [peopleTab, setPeopleTab] = useState("active");
  const [selectedId, setSelectedId] = useState(workers.find(w => !w.inactive)?.id || workers[0]?.id || "");

  const activeCount = items.filter(w => !w.inactive).length;
  const archivedCount = items.filter(w => w.inactive).length;
  const filtered = items.filter(w => {
    const matchesArchive = peopleTab === "archived" ? !!w.inactive : !w.inactive;
    return matchesArchive && (w.name || "").toLowerCase().includes(filter.toLowerCase());
  });
  const selected = items.find(w => w.id === selectedId) || filtered[0];

  function update(id, field, value) {
    setItems(current => current.map(w => w.id === id ? { ...w, [field]: value } : w));
  }

  function add() {
    const worker = {
      id: `local-${createId()}`,
      name: "",
      trade: "",
      baseSite: "",
      phone: "",
      email: "",
      birthday: "",
      sapNumber: "",
      rosterPattern: "NONE",
      rosterStartDate: "",
      inactive: false,
      accessRevoked: false,
      appRole: "employee",
      sendInvite: false,
      internalHourlyCost: ""
    };
    setItems(current => [worker, ...current]);
    setSelectedId(worker.id);
  }

  function deactivate(worker) {
    if (!worker) return;
    const revoke = confirm(`Do you also want to remove ${worker.name || "this employee"}'s access?`);
    setItems(current => current.map(w => w.id === worker.id ? { ...w, inactive: true, accessRevoked: revoke, sendInvite: false } : w));
    setPeopleTab("archived");
    if (revoke) alert("For this build, access is marked as revoked on the worker record. The final version will also disable the linked Auth user via a secure Edge Function.");
  }

  function reactivate(worker) {
    if (!worker) return;
    setItems(current => current.map(w => w.id === worker.id ? { ...w, inactive: false, accessRevoked: false } : w));
    setPeopleTab("active");
  }

  function permanentlyDelete(worker) {
    if (!worker) return;
    const message = `Permanently delete ${worker.name || "this employee"}? This removes the worker record from Jobsched${usingSupabase ? " and the Supabase workers table" : ""}.`;
    if (!confirm(message)) return;
    if (isUuid(worker.id)) setDeletedWorkerIds(current => current.includes(worker.id) ? current : [...current, worker.id]);
    setItems(current => current.filter(w => w.id !== worker.id));
    setSelectedId("");
  }

  return (
    <div className="modal-backdrop">
      <div className="modal settings-modal">
        <div className="modal-header">
          <div>
            <h2>People</h2>
            <p>{usingSupabase ? "Connected to Supabase workers table." : "Local demo people mode."}</p>
          </div>
          <button className="icon" onClick={onClose}><X size={18}/></button>
        </div>

        <div className="choice-grid two-choice">
          <button type="button" className="choice-card" onClick={add}>
            <Users/>
            <strong>Add employee</strong>
            <span>Create a new worker record and optionally send login access.</span>
          </button>
          <button type="button" className="choice-card active">
            <Pencil/>
            <strong>Edit employee</strong>
            <span>Select an employee from the list and edit their details.</span>
          </button>
        </div>

        <div className="people-layout">
          <aside className="people-list">
            <div className="people-tabs">
              <button type="button" className={peopleTab === "active" ? "active" : ""} onClick={()=>setPeopleTab("active")}>Active <span>{activeCount}</span></button>
              <button type="button" className={peopleTab === "archived" ? "active" : ""} onClick={()=>setPeopleTab("archived")}>Archived <span>{archivedCount}</span></button>
            </div>
            <label>Name filter<input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search employee..."/></label>
            {filtered.map(w=><button key={w.id} type="button" className={selected?.id===w.id?"active":""} onClick={()=>setSelectedId(w.id)}><strong>{w.name||"Unnamed employee"}</strong><span>{w.trade||"No trade"}{w.inactive ? " · archived" : ""}{w.appRole ? ` · ${w.appRole}` : ""}</span></button>)}
            {!filtered.length && <p className="muted">{peopleTab === "archived" ? "No archived employees." : "No active employees found."}</p>}
          </aside>

          {selected && <section className="worker-editor">
            <div className="two-col">
              <label>Name<input value={selected.name} onChange={e=>update(selected.id,"name",e.target.value)}/></label>
              <label>Trade<select value={selected.trade||""} onChange={e=>update(selected.id,"trade",e.target.value)}><option value="">Select</option>{TRADES.map(t=><option key={t}>{t}</option>)}</select></label>
            </div>
            <div className="two-col">
              <label>Phone<input value={selected.phone||""} onChange={e=>update(selected.id,"phone",e.target.value)}/></label>
              <label>Email<input value={selected.email||""} onChange={e=>update(selected.id,"email",e.target.value)}/></label>
            </div>
            <div className="two-col">
              <label>Birthday<input type="date" value={selected.birthday||""} onChange={e=>update(selected.id,"birthday",e.target.value)}/></label>
              <label>SAP number<input value={selected.sapNumber||""} onChange={e=>update(selected.id,"sapNumber",e.target.value)}/></label><label>Internal hourly cost ($/hr, admin only)<input type="number" min="0" step="0.01" value={selected.internalHourlyCost ?? ""} onChange={e=>update(selected.id,"internalHourlyCost",e.target.value === "" ? "" : Number(e.target.value))}/></label>
            </div>
            <div className="two-col">
              <label>Base site<select value={selected.baseSite||""} onChange={e=>update(selected.id,"baseSite",e.target.value)}><option value="">Select</option>{BASE_SITES.map(s=><option key={s}>{s}</option>)}</select></label>
              <label>Roster<select value={selected.rosterPattern||"NONE"} onChange={e=>update(selected.id,"rosterPattern",e.target.value)}>{ROSTER_PATTERNS.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}</select></label>
            </div>

            {selected.rosterPattern==="CUSTOM" ? <CustomRosterEditor worker={selected} update={(field,value)=>update(selected.id,field,value)} /> : <label>Roster start date<input type="date" value={selected.rosterStartDate||""} onChange={e=>update(selected.id,"rosterStartDate",e.target.value)}/></label>}

            <section className="access-panel">
              <strong>App access and permissions</strong>
              <p>Admin has full read/write access. Employee uses the employee view and can read their calendar, add notes and operate job controls.</p>
              <label>Permission level
                <select value={selected.appRole || "employee"} onChange={e=>update(selected.id,"appRole",e.target.value)}>
                  <option value="employee">Employee — calendar read, notes and employee tab only</option>
                  <option value="admin">Admin — full read/write access</option>
                </select>
              </label>
              <label className="check-option plain"><input type="checkbox" checked={!!selected.sendInvite} onChange={e=>update(selected.id,"sendInvite",e.target.checked)} disabled={!usingSupabase || selected.inactive}/>Send invite email / give app access</label>
              {selected.profileId && <p className="muted">Linked to login profile.</p>}
              {selected.accessRevoked && <p className="muted">Access marked for revocation.</p>}
              {!usingSupabase && <p className="muted">Invite emails require Supabase login and the invite-worker Edge Function.</p>}
            </section>

            <section className="archive-actions">
              {!selected.inactive ? (
                <button type="button" className="secondary" onClick={()=>deactivate(selected)}><UserMinus size={15}/> Deactivate and archive employee</button>
              ) : (
                <>
                  <button type="button" className="secondary" onClick={()=>reactivate(selected)}>Reactivate employee</button>
                  <button type="button" className="secondary danger" onClick={()=>permanentlyDelete(selected)}><Trash2 size={15}/> Permanently delete employee</button>
                </>
              )}
            </section>
          </section>}
        </div>

        <div className="modal-actions">
          <button className="secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="primary" onClick={()=>onSave({ items, deletedWorkerIds })} disabled={saving}>{saving ? "Saving..." : "Save people"}</button>
        </div>
      </div>
    </div>
  );
}

function CustomRosterEditor({ worker, update }) {
  return <section className="custom-roster-box"><strong>Custom roster</strong><p>Select the first work period and RNR period. Repeat until is optional; leave it blank for a one-off pattern.</p><div className="two-col"><label>Work start<input type="date" value={worker.customWorkStart||""} onChange={e=>update("customWorkStart",e.target.value)}/></label><label>Work end<input type="date" value={worker.customWorkEnd||""} onChange={e=>update("customWorkEnd",e.target.value)}/></label></div><div className="two-col"><label>RNR start<input type="date" value={worker.customRnrStart||""} onChange={e=>update("customRnrStart",e.target.value)}/></label><label>RNR end<input type="date" value={worker.customRnrEnd||""} onChange={e=>update("customRnrEnd",e.target.value)}/></label></div><label>Repeat until<input type="date" value={worker.customRepeatUntil||""} onChange={e=>update("customRepeatUntil",e.target.value)}/></label></section>;
}

function DailyRunSheetModal({ data, workers, onClose }) {
  const [date, setDate] = useState(getIsoDate(new Date()));
  const rows = buildScheduleRows({ startDate: date, endDate: date, workers, jobs: data.jobs, leaveRecords: data.leaveRecords }).filter(r => r.Title);
  function exportExcel() {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Daily run sheet");
    XLSX.writeFile(wb, `daily-run-sheet-${date}.xlsx`);
  }
  return <div className="modal-backdrop"><div className="modal"><div className="modal-header"><h2>Daily run sheet</h2><button className="icon" onClick={onClose}><X size={18}/></button></div><label>Select date<input type="date" value={date} onChange={e=>setDate(e.target.value)} /></label><div className="run-sheet-list">{rows.map((r,i)=><article key={i} className="run-sheet-card"><strong>{r.Worker}</strong><h3>{r.Title}</h3><p>{r.Address}</p><div className="details"><span><b>Status:</b> {r.Status}</span>{r.WO&&<span><b>WO:</b> {r.WO}</span>}{r.PO&&<span><b>PO:</b> {r.PO}</span>}</div></article>)}{!rows.length&&<div className="empty">No jobs scheduled for this date.</div>}</div><div className="modal-actions"><button className="secondary" onClick={exportExcel}>Export run sheet</button><button className="primary" onClick={onClose}>Done</button></div></div></div>;
}

function ShareScheduleModal({ data, workers, onClose }) { const [startDate,setStartDate]=useState(getIsoDate(getStartOfWeek(new Date()))); const [endDate,setEndDate]=useState(getIsoDate(addDays(getStartOfWeek(new Date()),6))); const [recipientMode,setRecipientMode]=useState("all"); const [period,setPeriod]=useState("week"); function applyPeriod(p){setPeriod(p); const start=getIsoDate(addDays(new Date(),p==="nextDay"?1:0)); const days=p==="nextDay"?0:p==="fortnight"?13:6; setStartDate(start); setEndDate(getIsoDate(addDays(new Date(start+"T00:00:00"),days)));} function rows(){return buildScheduleRows({startDate,endDate,workers,jobs:data.jobs,leaveRecords:data.leaveRecords});} function excel(){const ws=XLSX.utils.json_to_sheet(rows()); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"Schedule"); XLSX.writeFile(wb,`schedule-${startDate}-to-${endDate}.xlsx`);} function email(){const onsite=workers.filter(w=>getDatesInRange(startDate,endDate).some(d=>getWorkerAvailability(w,d,data.leaveRecords).status==="Onsite")); const rec=(recipientMode==="onsite"?onsite:workers).map(w=>w.email).filter(Boolean); if(!rec.length){alert("No worker email addresses available."); return;} const body=rows().map(r=>`${r.Date} - ${r.Worker}: ${r.Title} (${r.Status}) ${r.Address||""}`).join("\n"); window.location.href=`mailto:?bcc=${encodeURIComponent(rec.join(","))}&subject=${encodeURIComponent(`Schedule ${startDate} to ${endDate}`)}&body=${encodeURIComponent(body)}`;} return <div className="modal-backdrop"><div className="modal mini-modal"><div className="modal-header"><h2>Share schedule</h2><button className="icon" onClick={onClose}><X size={18}/></button></div><div className="choice-grid"><button className={period==="nextDay"?"choice-card active":"choice-card"} onClick={()=>applyPeriod("nextDay")}>Next day</button><button className={period==="week"?"choice-card active":"choice-card"} onClick={()=>applyPeriod("week")}>Week</button><button className={period==="fortnight"?"choice-card active":"choice-card"} onClick={()=>applyPeriod("fortnight")}>Fortnight</button></div><div className="two-col"><label>Start<input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/></label><label>End<input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)}/></label></div><label>Recipients<select value={recipientMode} onChange={e=>setRecipientMode(e.target.value)}><option value="all">All workers</option><option value="onsite">Workers onsite in period</option></select></label><div className="modal-actions"><button className="secondary" onClick={excel}>Export to Excel</button><button className="primary" onClick={email}>Share via email</button></div></div></div> }

function MessagesModal({ messages, jobs, onClose, onAction, onReply }) {
  const [tab, setTab] = useState("new");
  const visibleMessages = [...(messages || [])]
    .filter(m => m.channel === "email" || m.channel === "sms" || m.direction === "in" || m.direction === "out")
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  const newMessages = visibleMessages.filter(m => m.direction === "in" && !m.actioned);
  const actionedMessages = visibleMessages.filter(m => m.actioned || m.direction === "out");
  const selectedMessages = tab === "actioned" ? actionedMessages : newMessages;

  return <div className="modal-backdrop"><div className="modal"><div className="modal-header"><h2>Messages</h2><button className="icon" onClick={onClose}><X size={18}/></button></div><div className="message-tabs"><button className={tab === "new" ? "active" : ""} onClick={() => setTab("new")}>New <span>{newMessages.length}</span></button><button className={tab === "actioned" ? "active" : ""} onClick={() => setTab("actioned")}>Actioned / Sent <span>{actionedMessages.length}</span></button></div><div className="message-list">{selectedMessages.map(m=>{const job=jobs.find(j=>j.id===m.jobId); const label=m.direction==="in"?"Received":"Sent"; const party=m.direction==="in"?(m.from||m.phoneNumber||"Client"):(m.to||m.phoneNumber||"Client"); return <article key={m.id} className={m.unread&&!m.actioned?"message-card unread":"message-card"}><div><strong>{label}: {party}</strong><span>{formatDateTime(m.date)}</span></div><p>{m.text||"(No message text)"}</p>{job&&<em>Linked job: {job.title}</em>}{m.actioned&&m.actionedAt&&<em>Actioned {m.actionedBy?`by ${m.actionedBy} `:""}on {formatDateTime(m.actionedAt)}</em>}{!m.actioned&&m.direction==="in"&&<ReplyAction message={m} onReply={onReply || onAction} />}</article>})}{!selectedMessages.length&&<div className="empty">{tab === "actioned" ? "No actioned or sent messages yet." : "No new SMS/email messages."}</div>}</div></div></div>
}

function HistoryModal({ job, onClose }) { return <div className="modal-backdrop"><div className="modal mini-modal"><div className="modal-header"><h2>Job history</h2><button className="icon" onClick={onClose}><X size={18}/></button></div><HistoryList items={job.jobHistory||[]} type="history"/></div></div> }
function HistoryList({ items, onToggleTrade }) { return <div className="history-list">{items.map(i=><div key={i.id}><strong>{i.action||i.user}</strong><span>{formatDateTime(i.date)} · {i.user}</span><p>{i.details||i.text}</p>{onToggleTrade && <label className="inline-check compact-check"><input type="checkbox" checked={Boolean(i.showInTradeView)} onChange={e=>onToggleTrade(i.id,e.target.checked)}/>Show in Trade View</label>}</div>)}{!items.length&&<p>No entries yet.</p>}</div> }

function EmployeeView({ workerId, setWorkerId, workers, days, jobs, leaveRecords, onStatus, onAddAttachment, onCompletion, canSwitchWorker = false, machines = [], machineryBookings = [] }) {
  const [range, setRange] = useState("today");
  const [completionFor, setCompletionFor] = useState(null);
  const [completionDrafts, setCompletionDrafts] = useState({});
  const [completionSaveStatus, setCompletionSaveStatus] = useState({});

  const worker = workers.find(w => w.id === workerId) || (canSwitchWorker ? workers.find(w => !w.inactive) : null);
  const startIso = getIsoDate(days[0]);
  const endIso = getIsoDate(days[days.length - 1]);
  const visible = jobs.filter(j =>
    getDatesInRange(startIso, endIso).some(d => jobOccursForWorkerOnDate(j, worker?.id || "", d))
  );
  const displayDays = range === "today" ? days.slice(0, 1) : range === "tomorrow" ? days.slice(1, 2) : days;

  function updateCompletionDraft(jobId, field, value) {
    setCompletionSaveStatus(current => ({ ...current, [jobId]: "idle" }));
    setCompletionDrafts(current => ({
      ...current,
      [jobId]: {
        completionDescription: "",
        materialsUsed: "",
        requiresAnotherTrade: false,
        followUpTrade: "",
        ...(current[jobId] || {}),
        [field]: value
      }
    }));
  }

  async function saveCompletion(job) {
    const savedCompletion = job.workerCompletions?.[worker.id] || {};
    const existing = (!getCurrentVisitId(job) || savedCompletion.visitId === getCurrentVisitId(job)) ? savedCompletion : {};
    const draft = completionDrafts[job.id] || existing;
    setCompletionSaveStatus(current => ({ ...current, [job.id]: "saving" }));
    try {
      await onCompletion(job.id, worker.id, {
        completionDescription: draft.completionDescription || "",
        materialsUsed: draft.materialsUsed || "",
        requiresAnotherTrade: Boolean(draft.requiresAnotherTrade),
        followUpTrade: draft.followUpTrade || ""
      });
      setCompletionSaveStatus(current => ({ ...current, [job.id]: "saved" }));
      setCompletionFor(null);
    } catch (err) {
      console.error(err);
      setCompletionSaveStatus(current => ({ ...current, [job.id]: "error" }));
      alert(err?.message || "Could not save update.");
    }
  }

  if (!worker) {
    return (
      <main className="employee-view app-like-view">
        <section className="employee-app-header">
          <div>
            <span className="app-kicker">Trade View</span>
            <h2>Login not linked to an employee</h2>
            <p>An administrator needs to link this login to the correct employee record in Manage Employees.</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="employee-view app-like-view">
      <section className="employee-app-header">
        <div>
          <span className="app-kicker">Employee schedule</span>
          <h2>{worker?.name || "Employee"}</h2>
          <p>{worker?.trade || "No trade"} · {worker?.baseSite || "No site"}</p>
        </div>
        {canSwitchWorker ? (
          <label>View as<select value={worker?.id || ""} onChange={e => setWorkerId(e.target.value)}>{workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
        ) : (
          <span className="employee-role-pill">Employee access only</span>
        )}
      </section>

      <div className="employee-range-tabs pill-tabs">
        <button className={range === "today" ? "active" : ""} onClick={() => setRange("today")}>Today</button>
        <button className={range === "tomorrow" ? "active" : ""} onClick={() => setRange("tomorrow")}>Tomorrow</button>
        <button className={range === "fortnight" ? "active" : ""} onClick={() => setRange("fortnight")}>Next 2 weeks</button>
      </div>

      <section className="employee-list">
        {displayDays.map(day => {
          const iso = getIsoDate(day);
          const availability = getWorkerAvailability(worker, iso, leaveRecords);
          const dayJobs = visible.filter(j => jobOccursForWorkerOnDate(j, worker?.id || "", iso)).sort(sortScheduleItems);
          return (
            <div key={iso} className="employee-day">
              <h3>{formatIsoForDisplay(iso)} <span className={`roster-badge ${availability.status === "Onsite" ? "onsite" : "rnr"}`}>{availability.label}</span></h3>
              {dayJobs.map(job => {
                const status = getCurrentWorkerStatus(job, worker.id);
                const savedCompletion = job.workerCompletions?.[worker.id] || {};
                const currentCompletion = (!getCurrentVisitId(job) || savedCompletion.visitId === getCurrentVisitId(job)) ? savedCompletion : {};
                const completion = {
                  completionDescription: "",
                  materialsUsed: "",
                  requiresAnotherTrade: false,
                  followUpTrade: "",
                  ...currentCompletion,
                  ...(completionDrafts[job.id] || {})
                };
                return (
                  <article key={job.id} className={`employee-job-card app-job-card ${isDefectJob(job) ? "employee-defect-job" : ""} ${status === "completed" && !isDefectJob(job) ? "employee-complete" : ""}`}>
                    <div className="employee-job-banner">
                      <div>
                        <span className="wo">{job.workOrderNumber || job.jobNumber || "Job"}</span>
                        <h4>{job.title}</h4>
                        {isDefectJob(job) && <span className="employee-defect-pill">DEFECTS JOB</span>}
                      </div>
                      {!job.isTravelComment && <span className={`status-dot ${status}`}>{STATUS_META[status].icon} {STATUS_META[status].label}</span>}
                    </div>

                    {job.isAdHoc ? (
                      <AdHocEmployeeCard job={job} worker={worker} status={status} onStatus={onStatus} />
                    ) : job.isTravelComment ? (
                      <TravelEmployeeCard job={job} />
                    ) : (
                      <>
                        <p className="address-line">{job.address}</p>
                        <div className="employee-quick-info">
                          <span>{job.site || "No site"}</span>
                          <span>{jobTradeText(job) || "No trade set"}</span>
                          <span>Materials: {job.materialsStatus || "Parts from stock"}</span>
                        </div>
                        {machineryBookings.filter(b=>b.jobId===job.id&&b.workerId===worker.id&&isDateWithinRange(iso,b.startDate,b.endDate)).length>0 && <div className="employee-machinery-panel"><strong><Tractor size={15}/> Machinery assigned</strong>{machineryBookings.filter(b=>b.jobId===job.id&&b.workerId===worker.id&&isDateWithinRange(iso,b.startDate,b.endDate)).map(b=>{const machine=machines.find(m=>m.id===b.machineId);return <span key={b.id}>{machineDisplayName(machine||{})} · {b.period==="full_day"?"Full day":b.period.toUpperCase()}</span>})}</div>}

                        <div className="employee-actions primary-actions-row">
                          <a className="secondary" href={job.clientPhone ? `tel:${job.clientPhone}` : undefined} onClick={(e) => { if (!job.clientPhone) { e.preventDefault(); alert("No client phone number saved."); } }}><Phone size={16}/> Call site contact</a>
                          <button className="secondary" onClick={() => onStatus(job.id, worker.id, "running")}><Play size={16}/> Onsite</button>
                          <button className="secondary" onClick={() => onStatus(job.id, worker.id, "stopped")}><Square size={16}/> Offsite</button>
                          <button className="secondary" onClick={() => onStatus(job.id, worker.id, status === "completed" ? "notStarted" : "completed")}><CheckCircle2 size={16}/> {status === "completed" ? "Mark incomplete" : "Complete"}</button>
                        </div>
                        <p className="time-total"><Clock size={14}/> Total running time: {formatDuration(getWorkerTotalMs(job, worker.id))}</p>

                        <div className="employee-card-tabs">
                          <details open><summary>Job description</summary><pre>{job.notes}</pre></details><details><summary>Job notes</summary>{(job.noteHistory||[]).filter(n=>n.showInTradeView).map(n=><div key={n.id} className="trade-note"><strong>{n.user}</strong><span>{formatDateTime(n.date)}</span><p>{n.text}</p></div>)}{!(job.noteHistory||[]).some(n=>n.showInTradeView)&&<p>No notes shared with Trade View.</p>}</details>
                          <details><summary>Materials list</summary>{(job.materials || []).map(m => <p key={m.id}>• {m.text}</p>)}{!(job.materials || []).length && <p>No materials listed.</p>}</details>
                          <details><summary>Photos</summary><div className="photo-upload-row"><label className="secondary file-pick">Upload photos<input type="file" accept="image/*" multiple onChange={e => onAddAttachment(job.id, worker.id, e.target.files || [])}/></label><label className="secondary file-pick">Camera<input type="file" accept="image/*" capture="environment" onChange={e => onAddAttachment(job.id, worker.id, e.target.files || [])}/></label></div><div className="simple-list">{(job.attachments || []).map(a => <div key={a.id}><span>{a.name} · {formatBytes(a.size)}</span><button type="button" className="mini-action" onClick={() => openStoredAttachment(a)}><Download size={14}/> Open</button></div>)}{!(job.attachments || []).length && <p>No photos/files added.</p>}</div></details>
                          <details open={completionFor === job.id}><summary onClick={() => setCompletionFor(completionFor === job.id ? null : job.id)}>Job completion</summary><label>Description of works<textarea rows="4" value={completion.completionDescription || ""} onChange={e => updateCompletionDraft(job.id, "completionDescription", e.target.value)} placeholder="Describe the works completed..."/></label><label>Approximate materials used<textarea rows="3" value={completion.materialsUsed || ""} onChange={e => updateCompletionDraft(job.id, "materialsUsed", e.target.value)} placeholder="List approximate materials used..."/></label><label className="check-option plain"><input type="checkbox" checked={Boolean(completion.requiresAnotherTrade)} onChange={e => updateCompletionDraft(job.id, "requiresAnotherTrade", e.target.checked)}/>Notify supervisors that this portion is complete but another trade is required</label>{completion.requiresAnotherTrade && <label>Trade required<select value={completion.followUpTrade || ""} onChange={e => updateCompletionDraft(job.id, "followUpTrade", e.target.value)}><option value="">Select trade</option>{TRADES.map(t => <option key={t}>{t}</option>)}</select></label>}<p className="muted">Use the Save update button below to save completion details.</p></details>
                        </div>

                        <div className="employee-save-row"><button className={`primary ${completionSaveStatus[job.id] === "saved" ? "save-success" : ""}`} onClick={() => saveCompletion(job)} disabled={completionSaveStatus[job.id] === "saving"}>{completionSaveStatus[job.id] === "saving" ? "Saving..." : completionSaveStatus[job.id] === "saved" ? "Saved" : "Save update"}</button>{completionSaveStatus[job.id] === "error" && <span className="save-error">Not saved</span>}</div>
                      </>
                    )}
                  </article>
                );
              })}
              {!dayJobs.length && <p className="muted">No jobs scheduled.</p>}
            </div>
          );
        })}
      </section>
    </main>
  );
}

function AdHocEmployeeCard({ job, worker, status, onStatus }) {
  return (
    <div className="ad-hoc-employee-panel">
      <details open><summary>Job description</summary><pre>{job.notes || job.title}</pre></details>
      <div className="employee-actions primary-actions-row compact-employee-actions">
        <button className="secondary" onClick={() => onStatus(job.id, worker.id, status === "completed" ? "notStarted" : "completed")}><CheckCircle2 size={16}/> {status === "completed" ? "Mark incomplete" : "Complete"}</button>
      </div>
      {status === "completed" && <p className="muted">Marked complete.</p>}
    </div>
  );
}

function TravelEmployeeCard({ job }) {
  const pdf = (job.attachments || []).find(a => a.dataUrl || a.url || a.bucket);
  return (
    <div className="travel-employee-panel">
      <div className="employee-quick-info">
        <span>{formatIsoForDisplay(job.startDate)} to {formatIsoForDisplay(job.endDate || job.startDate)}</span>
      </div>
      <details open><summary>Travel / accommodation notes</summary><pre>{job.notes || "No notes added."}</pre></details>
      {pdf ? <button type="button" className="secondary travel-download" onClick={() => openStoredAttachment(pdf)}><Paperclip size={16}/> Download accommodation PDF</button> : <p className="muted">No accommodation PDF attached.</p>}
    </div>
  );
}

function buildWorkDoneSummary(job, workers = []) {
  const lines = [];
  (job.priorVisits || []).forEach((visit, index) => {
    const visitCompletions = visit.workerCompletions || {};
    if (!Object.keys(visitCompletions).length) return;
    lines.push(`Previous visit ${index + 1}${visit.startDate ? ` (${formatIsoForDisplay(visit.startDate)})` : ""}:`);
    Object.entries(visitCompletions).forEach(([workerId, completion]) => {
      const workerName = getWorkerName(workers, workerId);
      const dateText = completion.updatedAt ? ` on ${formatDateTime(completion.updatedAt)}` : "";
      lines.push(`${workerName}${dateText}:`);
      if (completion.completionDescription) lines.push(`Works completed: ${completion.completionDescription}`);
      if (completion.materialsUsed) lines.push(`Materials used: ${completion.materialsUsed}`);
      if (completion.requiresAnotherTrade) lines.push(`Reassignment / follow-up requested: ${completion.followUpTrade || "Another trade required"}`);
    });
    lines.push("");
  });
  const completions = job.workerCompletions || {};
  Object.entries(completions).forEach(([workerId, completion]) => {
    const workerName = getWorkerName(workers, workerId);
    const dateText = completion.updatedAt ? ` on ${formatDateTime(completion.updatedAt)}` : "";
    lines.push(`${workerName}${dateText}:`);
    if (completion.completionDescription) lines.push(`Works completed: ${completion.completionDescription}`);
    if (completion.materialsUsed) lines.push(`Materials used: ${completion.materialsUsed}`);
    if (completion.requiresAnotherTrade) lines.push(`Reassignment / follow-up requested: ${completion.followUpTrade || "Another trade required"}`);
    lines.push("");
  });

  const employeeNotes = (job.noteHistory || []).filter(note => note.user && note.user !== CURRENT_USER);
  if (employeeNotes.length) {
    lines.push("Employee notes:");
    employeeNotes.forEach(note => lines.push(`${formatDateTime(note.date)} - ${note.user}: ${note.text}`));
  }

  return lines.join("\n").trim();
}


function readDragContext(e) {
  const transfer = e?.dataTransfer;
  if (!transfer) return {};
  for (const type of ["application/x-jobsched-job", "application/json"]) {
    try {
      const raw = transfer.getData(type);
      if (raw) return JSON.parse(raw);
    } catch {}
  }
  const jobId = transfer.getData("text/plain");
  return jobId ? { jobId } : {};
}

function mapWorkerFromSupabase(row) {
  return {
    id: row.id,
    profileId: row.profile_id || "",
    name: row.name || "",
    trade: row.trade || "",
    baseSite: row.base_site || "",
    phone: row.phone || "",
    email: row.email || "",
    birthday: row.birthday || "",
    sapNumber: row.sap_number || "",
    rosterPattern: row.roster_pattern || "NONE",
    rosterStartDate: row.roster_start_date || "",
    inactive: Boolean(row.inactive),
    accessRevoked: Boolean(row.access_revoked),
    customWorkStart: row.custom_work_start || "",
    customWorkEnd: row.custom_work_end || "",
    customRnrStart: row.custom_rnr_start || "",
    customRnrEnd: row.custom_rnr_end || "",
    customRepeatUntil: row.custom_repeat_until || "",
    appRole: row.app_role || "employee",
    inviteStatus: row.invite_status || "",
    inviteRequested: Boolean(row.invite_requested),
    invitedAt: row.invited_at || "",
    internalHourlyCost: ""
  };
}

function mapWorkerToSupabase(worker) {
  const row = {
    name: worker.name || "Unnamed employee",
    trade: worker.trade || null,
    base_site: worker.baseSite || null,
    phone: worker.phone || null,
    email: worker.email || null,
    sap_number: worker.sapNumber || null,
    birthday: worker.birthday || null,
    roster_pattern: worker.rosterPattern || "NONE",
    roster_start_date: worker.rosterStartDate || null,
    inactive: Boolean(worker.inactive),
    access_revoked: Boolean(worker.accessRevoked),
    app_role: worker.appRole || "employee",
    invite_requested: Boolean(worker.sendInvite),
    updated_at: new Date().toISOString()
  };

  if (isUuid(worker.id)) row.id = worker.id;
  return row;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function getAuthReturnType() {
  if (typeof window === "undefined") return "";
  const hash = new URLSearchParams((window.location.hash || "").replace(/^#/, ""));
  const search = new URLSearchParams(window.location.search || "");
  return hash.get("type") || search.get("type") || "";
}

function cleanAuthUrl() {
  if (typeof window === "undefined") return;
  const cleanUrl = `${window.location.origin}${import.meta.env.BASE_URL}`;
  window.history.replaceState({}, document.title, cleanUrl);
}

async function fetchEmployeeCostsFromSupabase() {
  if (!supabase) return {};
  const { data, error } = await supabase.from("employee_costs").select("worker_id,hourly_cost");
  if (error) throw error;
  return Object.fromEntries((data || []).map(row => [row.worker_id, row.hourly_cost]));
}

async function saveEmployeeCostsToSupabase(workers) {
  if (!supabase) return;
  const rows = workers.filter(w => isUuid(w.id)).map(w => ({ worker_id: w.id, hourly_cost: w.internalHourlyCost === "" || w.internalHourlyCost == null ? null : Number(w.internalHourlyCost), updated_at: new Date().toISOString() }));
  if (!rows.length) return;
  const { error } = await supabase.from("employee_costs").upsert(rows, { onConflict: "worker_id" });
  if (error) throw error;
}

async function fetchJobFinancialsFromSupabase() {
  if (!supabase) return {};
  const { data, error } = await supabase.from("job_financials").select("job_id,job_value");
  if (error) throw error;
  return Object.fromEntries((data || []).map(row => [row.job_id, row.job_value]));
}

async function saveJobFinancialToSupabase(job) {
  if (!supabase || !isUuid(job.id)) return;
  const { error } = await supabase.from("job_financials").upsert({ job_id: job.id, job_value: job.jobValue === "" || job.jobValue == null ? null : Number(job.jobValue), updated_at: new Date().toISOString() }, { onConflict: "job_id" });
  if (error) throw error;
}

async function fetchWorkersFromSupabase() {
  if (!supabase) throw new Error("Supabase is not configured for this build.");
  const { data, error } = await supabase
    .from("workers")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw error;
  return (data || []).map(mapWorkerFromSupabase);
}

async function saveWorkersToSupabase(workers) {
  if (!supabase) throw new Error("Supabase is not configured for this build.");
  for (const worker of workers) {
    const row = mapWorkerToSupabase(worker);
    let result;
    if (row.id) {
      result = await supabase.from("workers").update(row).eq("id", row.id);
    } else {
      result = await supabase.from("workers").insert(row);
    }
    if (result.error) throw result.error;
  }
}

async function deleteWorkersFromSupabase(workerIds) {
  if (!supabase || !workerIds?.length) return;
  const ids = workerIds.filter(isUuid);
  if (!ids.length) return;
  const { error } = await supabase.from("workers").delete().in("id", ids);
  if (error) throw error;
}


function mapJobFromSupabase(row, bookingRows = []) {
  const payload = row.app_payload || {};
  const bookings = bookingRows
    .filter(b => b.job_id === row.id)
    .sort((a, b) => String(a.start_date || "").localeCompare(String(b.start_date || "")) || String(a.id || "").localeCompare(String(b.id || "")));

  // Supabase does not guarantee row order. Rebuild the main booking from the
  // dates/workers saved in app_payload so a rescheduled job does not randomly
  // become an "additional booking" after refresh.
  const payloadAssigned = Array.isArray(payload.assignedTo) ? payload.assignedTo.filter(Boolean) : [];
  const payloadStart = payload.startDate || "";
  const payloadEnd = payload.endDate || payloadStart || "";
  let primaryBookings = bookings.filter(b =>
    payloadAssigned.includes(b.worker_id) &&
    (!payloadStart || b.start_date === payloadStart) &&
    (!payloadEnd || (b.end_date || b.start_date) === payloadEnd)
  );

  if (!primaryBookings.length && bookings.length) {
    const first = bookings[0];
    primaryBookings = bookings.filter(b =>
      b.start_date === first.start_date &&
      (b.end_date || b.start_date) === (first.end_date || first.start_date)
    );
  }

  const primaryIds = new Set(primaryBookings.map(b => b.id));
  const primary = primaryBookings[0] || bookings[0];
  const extra = bookings.filter(b => !primaryIds.has(b.id));
  const bookingWorkerStatus = bookings.reduce((acc, booking) => {
    if (!booking.worker_id) return acc;
    const rawStatus = String(booking.booking_status || "notStarted").toLowerCase();
    const status = rawStatus === "onsite" ? "running"
      : rawStatus === "offsite" ? "stopped"
      : ["running", "stopped", "completed", "notstarted"].includes(rawStatus)
        ? (rawStatus === "notstarted" ? "notStarted" : rawStatus)
        : "notStarted";
    acc[booking.worker_id] = {
      ...(payload.workerStatus?.[booking.worker_id] || {}),
      status,
      totalMs: Number(booking.total_ms ?? payload.workerStatus?.[booking.worker_id]?.totalMs ?? 0) || 0,
      runningSince: booking.running_since ? new Date(booking.running_since).getTime() : (payload.workerStatus?.[booking.worker_id]?.runningSince || null),
      updatedAt: booking.status_updated_at || booking.updated_at || null,
      visitId: booking.visit_id || payload.workerStatus?.[booking.worker_id]?.visitId || null
    };
    return acc;
  }, {});
  const itemType = row.item_type || payload.itemType || "normal_job";
  return normaliseJob({
    ...payload,
    id: row.id,
    title: row.title || payload.title || "Untitled job",
    client: row.client || "",
    site: row.site || "",
    address: row.address || "",
    jobNumber: row.job_number || "",
    quoteNumber: row.quote_number || "",
    workOrderNumber: row.work_order_number || "",
    poNumber: row.po_number || "",
    jobValue: "",
    notes: row.description || payload.notes || "",
    category: row.category || payload.category || "To be scheduled",
    materialsStatus: row.materials_status || payload.materialsStatus || "Parts from stock",
    clientContact: row.client_contact || "",
    clientPhone: row.client_phone || "",
    appointmentSent: Boolean(row.appointment_sent),
    clientAccepted: Boolean(row.client_accepted),
    completedConfirmed: Boolean(row.completed_confirmed),
    isAdHoc: itemType === "ad_hoc" || Boolean(payload.isAdHoc),
    isTravelComment: itemType === "travel_accommodation" || Boolean(payload.isTravelComment),
    assignedTo: primaryBookings.length ? primaryBookings.map(b => b.worker_id).filter(Boolean) : (primary?.worker_id ? [primary.worker_id] : payloadAssigned),
    startDate: payloadStart || primary?.start_date || "",
    endDate: payloadEnd || primary?.end_date || primary?.start_date || "",
    scheduleBlocks: extra.map(b => ({ id: b.id, workerId: b.worker_id || "", startDate: b.start_date || "", endDate: b.end_date || b.start_date || "" })).filter(b => b.workerId && b.startDate && b.endDate),
    ...normaliseDefectVisitState({
      payload,
      row,
      bookings,
      bookingWorkerStatus
    }),
  });
}


function normaliseDefectVisitState({ payload, row, bookings, bookingWorkerStatus }) {
  const defectJob = Boolean(payload?.isDefectCallback || payload?.jobStatus === "Call back - Defects");
  const currentVisitStartedAt = payload?.currentVisitStartedAt || "";
  const currentVisitId = payload?.currentVisitId || (defectJob && currentVisitStartedAt ? `defect-${currentVisitStartedAt}` : "");
  const mergedStatus = { ...(payload?.workerStatus || {}), ...(bookingWorkerStatus || {}) };
  const priorVisits = Array.isArray(payload?.priorVisits) ? structuredCloneSafe(payload.priorVisits) : [];
  let workerCompletions = { ...(payload?.workerCompletions || {}) };

  if (defectJob && currentVisitId) {
    workerCompletions = Object.fromEntries(
      Object.entries(workerCompletions).filter(([, completion]) => completion?.visitId === currentVisitId)
    );
  }

  if (!defectJob || !currentVisitId) {
    return { currentVisitId, priorVisits, workerCompletions, workerStatus: mergedStatus };
  }

  const staleWorkerStatus = {};
  const currentWorkerStatus = {};
  Object.entries(mergedStatus).forEach(([workerId, state]) => {
    if (state?.visitId === currentVisitId) {
      currentWorkerStatus[workerId] = state;
      return;
    }
    if ((Number(state?.totalMs) || 0) > 0 || (state?.status && state.status !== "notStarted") || workerCompletions?.[workerId]) {
      staleWorkerStatus[workerId] = state;
    }
    currentWorkerStatus[workerId] = {
      status: "notStarted",
      totalMs: 0,
      runningSince: null,
      updatedAt: currentVisitStartedAt || new Date().toISOString(),
      visitId: currentVisitId
    };
  });

  const staleIds = Object.keys(staleWorkerStatus);
  if (staleIds.length) {
    const legacyId = `legacy-defect-${row?.id || "job"}-${currentVisitStartedAt || "visit"}`;
    if (!priorVisits.some(visit => visit.id === legacyId)) {
      priorVisits.push({
        id: legacyId,
        archivedAt: currentVisitStartedAt || new Date().toISOString(),
        reason: "defects_callback_legacy_repair",
        startDate: payload?.startDate || bookings?.[0]?.start_date || "",
        endDate: payload?.endDate || bookings?.[0]?.end_date || bookings?.[0]?.start_date || "",
        assignedTo: staleIds,
        workerStatus: staleWorkerStatus,
        workerCompletions: Object.fromEntries(staleIds.filter(id => workerCompletions?.[id]).map(id => [id, workerCompletions[id]])),
        completedConfirmed: true
      });
    }
    workerCompletions = Object.fromEntries(Object.entries(workerCompletions).filter(([id]) => !staleIds.includes(id)));
  }

  return { currentVisitId, priorVisits, workerCompletions, workerStatus: currentWorkerStatus };
}

function mapJobToSupabase(job) {
  const itemType = job.isTravelComment ? "travel_accommodation" : job.isAdHoc ? "ad_hoc" : "normal_job";
  const { jobValue: _privateJobValue, ...publicJob } = job;
  const payload = {
    ...publicJob,
    id: job.id,
    itemType,
    updatedFromAppAt: new Date().toISOString()
  };
  return {
    id: job.id,
    title: job.title || "Untitled job",
    client: job.client || null,
    site: job.site || null,
    address: job.address || null,
    job_number: job.jobNumber || null,
    quote_number: job.quoteNumber || null,
    work_order_number: job.workOrderNumber || null,
    po_number: job.poNumber || null,
    description: job.notes || null,
    category: job.category || "To be scheduled",
    materials_status: job.materialsStatus || "Parts from stock",
    client_contact: job.clientContact || null,
    client_phone: job.clientPhone || null,
    appointment_sent: Boolean(job.appointmentSent),
    client_accepted: Boolean(job.clientAccepted),
    completed_confirmed: Boolean(job.completedConfirmed),
    item_type: itemType,
    app_payload: payload,
    updated_at: new Date().toISOString()
  };
}

function getJobBookingsForSupabase(job) {
  const rows = [];
  const addBookingRow = ({ id, workerId, startDate, endDate }) => {
    if (!isUuid(job.id) || !workerId || !startDate || !endDate) return;
    const row = {
      job_id: job.id,
      worker_id: workerId,
      start_date: startDate,
      end_date: endDate,
      // Preserve the employee's own status when an admin reschedules or edits
      // the job. Falling back to scheduled keeps new bookings neutral.
      booking_status: getCurrentWorkerStatus(job, workerId) || "notStarted",
      total_ms: Math.max(0, Math.round(Number(job.workerStatus?.[workerId]?.totalMs) || 0)),
      running_since: job.workerStatus?.[workerId]?.runningSince ? new Date(Number(job.workerStatus[workerId].runningSince)).toISOString() : null,
      status_updated_at: job.workerStatus?.[workerId]?.updatedAt || new Date().toISOString(),
      visit_id: job.workerStatus?.[workerId]?.visitId || getCurrentVisitId(job) || null
    };

    // Only send an id to Supabase when it is a real UUID.
    // Sending id: null/undefined can override the table default and trigger
    // "null value in column id violates not-null constraint".
    if (isUuid(id)) row.id = id;
    rows.push(row);
  };

  if (hasPrimaryBooking(job)) {
    (job.assignedTo || []).forEach(workerId => {
      addBookingRow({ workerId, startDate: job.startDate, endDate: job.endDate });
    });
  }

  (job.scheduleBlocks || []).forEach(block => {
    addBookingRow({
      id: block.id,
      workerId: block.workerId,
      startDate: block.startDate,
      endDate: block.endDate
    });
  });

  return rows;
}


function mapAttachmentFromSupabase(row) {
  return {
    id: row.id,
    name: row.file_name || row.object_path?.split("/").pop() || "Attachment",
    type: row.mime_type || "file",
    size: row.size_bytes || 0,
    addedAt: row.created_at || new Date().toISOString(),
    bucket: row.bucket,
    path: row.object_path,
    url: row.public_url || "",
    label: row.label || row.attachment_type || "Attachment",
    attachmentType: row.attachment_type || "file",
    workerId: row.worker_id || "",
    storageBacked: true
  };
}

async function uploadAttachmentToSupabase({ jobId, workerId = null, file, bucket = "job-files", attachmentType = "job_file", label = "Attachment", uploadedBy = null }) {
  if (!supabase) throw new Error("Supabase is not configured for this build.");
  if (!isUuid(jobId)) throw new Error("Save the job to Supabase before uploading attachments.");
  if (!file) throw new Error("No file selected.");
  const safeName = safeFileName(file.name || "attachment");
  const objectPath = `${jobId}/${Date.now()}-${createId()}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(objectPath, file, { cacheControl: "3600", upsert: false, contentType: file.type || "application/octet-stream" });
  if (uploadError) throw uploadError;

  const row = {
    job_id: jobId,
    worker_id: isUuid(workerId) ? workerId : null,
    bucket,
    object_path: objectPath,
    file_name: file.name || safeName,
    mime_type: file.type || "application/octet-stream",
    size_bytes: file.size || 0,
    attachment_type: attachmentType,
    label,
    uploaded_by: isUuid(uploadedBy) ? uploadedBy : null
  };
  const { data, error } = await supabase.from("attachments").insert(row).select("*").single();
  if (error) throw error;
  return mapAttachmentFromSupabase(data);
}

async function openStoredAttachment(attachment) {
  if (!attachment) return;
  if (attachment.dataUrl || attachment.url) {
    window.open(attachment.dataUrl || attachment.url, "_blank", "noopener,noreferrer");
    return;
  }
  if (!supabase || !attachment.bucket || !attachment.path) {
    alert("This attachment does not have a downloadable file link.");
    return;
  }
  const { data, error } = await supabase.storage.from(attachment.bucket).createSignedUrl(attachment.path, 60 * 10);
  if (error) {
    alert(error.message || "Could not create a download link.");
    return;
  }
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

function mergeAttachments(primary = [], secondary = []) {
  const seen = new Set();
  const out = [];
  [...primary, ...secondary].forEach(item => {
    if (!item) return;
    const key = item.id || `${item.bucket || ""}:${item.path || item.name || ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(item);
  });
  return out;
}

function safeFileName(name) {
  return String(name || "attachment")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "attachment";
}

async function fetchMessagesFromSupabase() {
  if (!supabase) throw new Error("Supabase is not configured for this build.");
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    if (error.code === "42P01") return [];
    throw error;
  }
  return (data || []).map(mapMessageFromSupabase);
}

async function sendSmsViaSupabase({ jobId, to, messageText, clientName = "Client" }) {
  if (!supabase) throw new Error("Supabase is not configured for this build.");
  const { data, error } = await supabase.functions.invoke("send-sms", {
    body: {
      job_id: jobId,
      to,
      body: messageText,
      client_name: clientName
    }
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

async function markMessageActionedInSupabase({ messageId, actionedBy = null }) {
  if (!supabase || !isUuid(messageId)) return;
  const { error } = await supabase
    .from("messages")
    .update({
      unread: false,
      actioned: true,
      actioned_by: isUuid(actionedBy) ? actionedBy : null,
      actioned_at: new Date().toISOString(),
      status: "actioned"
    })
    .eq("id", messageId);
  if (error) throw error;
}

function mapMessageFromSupabase(row = {}) {
  const rawDirection = row.direction || row.message_direction || "outbound";
  const direction = rawDirection === "inbound" || rawDirection === "in" ? "in" : "out";

  return {
    id: row.id || createId(),
    jobId: row.job_id || row.jobId || "",
    direction,
    rawDirection,
    channel: row.channel || "sms",
    from: row.from_number || row.from || (direction === "in" ? "Client" : "Jobsched"),
    to: row.to_number || row.to || "",
    phoneNumber: row.phone_number || row.phoneNumber || "",
    text: row.message_body || row.message_text || row.text || row.body || "",
    date: row.received_at || row.created_at || row.date || new Date().toISOString(),
    unread: Boolean(row.unread),
    actioned: Boolean(row.actioned),
    actionedBy: row.actioned_by || row.actionedBy || "",
    actionedAt: row.actioned_at || row.actionedAt || "",
    status: row.status || (direction === "in" ? "received" : "sent"),
    provider: row.provider || "",
    providerMessageId: row.provider_message_id || ""
  };
}

async function updateAssignedBookingStatusInSupabase({ jobId, workerId, status, totalMs = 0, runningSince = null, updatedAt = null, visitId = null }) {
  if (!supabase) throw new Error("Supabase is not configured for this build.");
  const timestamp = updatedAt || new Date().toISOString();
  const { data, error } = await supabase
    .from("job_bookings")
    .update({
      booking_status: status,
      total_ms: Math.max(0, Math.round(Number(totalMs) || 0)),
      running_since: runningSince ? new Date(Number(runningSince)).toISOString() : null,
      status_updated_at: timestamp,
      visit_id: visitId || null,
      updated_at: timestamp
    })
    .eq("job_id", jobId)
    .eq("worker_id", workerId)
    .select("id");

  if (error) throw error;
  if (!data?.length) throw new Error("No assigned booking was found for this worker.");
  return data;
}


async function fetchMachineryFromSupabase(){
 if(!supabase) return [];
 const {data,error}=await supabase.from("machinery").select("*").order("machine_type");
 if(error){if(error.code==="42P01")return[];throw error;}
 return (data||[]).map(r=>({id:r.id,machineType:r.machine_type||"",assetNumber:r.asset_number||"",registration:r.registration||"",baseLocation:r.base_location||"",notes:r.notes||"",status:r.status||"available",active:r.active!==false}));
}
async function saveMachineryToSupabase(items){
 if(!supabase) throw new Error("Supabase is not configured.");
 for(const m of items){const row={machine_type:m.machineType||"Unnamed machine",asset_number:m.assetNumber||null,registration:m.registration||null,base_location:m.baseLocation||null,notes:m.notes||null,status:m.status||"available",active:m.active!==false,updated_at:new Date().toISOString()};if(isUuid(m.id))row.id=m.id;const {error}=await supabase.from("machinery").upsert(row,{onConflict:"id"});if(error)throw error;}
}
async function fetchMachineryBookingsFromSupabase(){
 if(!supabase) return [];
 const {data,error}=await supabase.from("machinery_bookings").select("*").order("start_date");
 if(error){if(error.code==="42P01")return[];throw error;}
 return (data||[]).map(r=>({id:r.id,machineId:r.machine_id,jobId:r.job_id||"",workerId:r.worker_id||"",startDate:r.start_date,endDate:r.end_date||r.start_date,period:r.period||"full_day",bookingType:r.booking_type||"ad_hoc",description:r.description||"",createdBy:r.created_by||"",createdAt:r.created_at,updatedAt:r.updated_at}));
}
async function saveMachineryBookingToSupabase(b){
 if(!supabase)throw new Error("Supabase is not configured.");
 const row={machine_id:b.machineId,job_id:isUuid(b.jobId)?b.jobId:null,worker_id:isUuid(b.workerId)?b.workerId:null,start_date:b.startDate,end_date:b.endDate||b.startDate,period:b.period||"full_day",booking_type:b.bookingType||"ad_hoc",description:b.description||null,updated_at:new Date().toISOString()};if(isUuid(b.id))row.id=b.id;
 const others=(await fetchMachineryBookingsFromSupabase()).filter(x=>x.id!==b.id);if(findMachineryConflict(b,others))throw new Error("This machine is already booked for the selected period.");
 const {error}=await supabase.from("machinery_bookings").upsert(row,{onConflict:"id"});if(error)throw error;
}
async function deleteMachineryBookingFromSupabase(id){if(!supabase||!isUuid(id))return;const {error}=await supabase.from("machinery_bookings").delete().eq("id",id);if(error)throw error;}
async function syncJobMachineryBookingsToSupabase(jobId,rows){
 if(!supabase||!isUuid(jobId))return;
 const {error:deleteError}=await supabase.from("machinery_bookings").delete().eq("job_id",jobId);if(deleteError)throw deleteError;
 for(const b of rows){if(!b.machineId||!b.startDate)continue;await saveMachineryBookingToSupabase({...b,id:isUuid(b.id)?b.id:createId(),jobId,bookingType:"job"});}
}
function machineDisplayName(m){return [m.machineType,m.assetNumber?`Asset ${m.assetNumber}`:""].filter(Boolean).join(" – ")||"Unnamed machine";}
function bookingPeriodsOverlap(a,b){return a==="full_day"||b==="full_day"||a===b;}
function findMachineryConflict(candidate,bookings){if(!candidate?.machineId||!candidate?.startDate)return null;return (bookings||[]).find(b=>b.machineId===candidate.machineId&&isDateRangesOverlap(candidate.startDate,candidate.endDate||candidate.startDate,b.startDate,b.endDate||b.startDate)&&bookingPeriodsOverlap(candidate.period||"full_day",b.period||"full_day"))||null;}
function isDateRangesOverlap(aStart,aEnd,bStart,bEnd){return compareIsoDates(aStart,bEnd)<=0&&compareIsoDates(bStart,aEnd)<=0;}

async function fetchJobsFromSupabase() {
  if (!supabase) throw new Error("Supabase is not configured for this build.");
  const { data: jobRows, error: jobError } = await supabase.from("jobs").select("*").order("updated_at", { ascending: false });
  if (jobError) throw jobError;
  const { data: bookingRows, error: bookingError } = await supabase.from("job_bookings").select("*");
  if (bookingError) throw bookingError;
  const jobIds = (jobRows || []).map(row => row.id).filter(isUuid);
  let attachmentsByJob = {};
  let notesByJob = {};
  let historyByJob = {};
  let completionSubmissionsByJob = {};
  let workerNames = {};
  if (jobIds.length) {
    const [attachmentResult, noteResult, historyResult, completionResult, workerResult] = await Promise.all([
      supabase.from("attachments").select("*").in("job_id", jobIds).order("created_at", { ascending: false }),
      supabase.from("job_notes").select("id,job_id,worker_id,note_text,note_type,visit_id,show_in_trade_view,created_by,created_at").in("job_id", jobIds).order("created_at", { ascending: false }),
      supabase.from("job_history").select("id,job_id,action,details,created_by,created_at").in("job_id", jobIds).order("created_at", { ascending: false }),
      supabase.from("job_completion_submissions").select("*").in("job_id", jobIds).order("submitted_at", { ascending: false }),
      supabase.from("workers").select("id,name")
    ]);

    if (attachmentResult.error && attachmentResult.error.code !== "42P01") throw attachmentResult.error;
    if (noteResult.error && noteResult.error.code !== "42P01" && noteResult.error.code !== "42703") throw noteResult.error;
    if (historyResult.error && historyResult.error.code !== "42P01") throw historyResult.error;
    if (completionResult.error && completionResult.error.code !== "42P01") throw completionResult.error;
    if (workerResult.error) throw workerResult.error;

    workerNames = Object.fromEntries((workerResult.data || []).map(worker => [worker.id, worker.name || "Employee"]));
    attachmentsByJob = (attachmentResult.data || []).reduce((acc, row) => {
      const item = mapAttachmentFromSupabase(row);
      acc[row.job_id] = [...(acc[row.job_id] || []), item];
      return acc;
    }, {});
    notesByJob = (noteResult.data || []).reduce((acc, row) => {
      acc[row.job_id] = [...(acc[row.job_id] || []), row];
      return acc;
    }, {});
    historyByJob = (historyResult.data || []).reduce((acc, row) => {
      acc[row.job_id] = [...(acc[row.job_id] || []), row];
      return acc;
    }, {});
    completionSubmissionsByJob = (completionResult.data || []).reduce((acc, row) => {
      acc[row.job_id] = [...(acc[row.job_id] || []), row];
      return acc;
    }, {});
  }
  return (jobRows || []).map(row => {
    let job = mapJobFromSupabase(row, bookingRows || []);
    const storedAttachments = attachmentsByJob[row.id] || [];
    const remoteNotes = notesByJob[row.id] || [];
    const remoteHistory = historyByJob[row.id] || [];
    const completionSubmissions = completionSubmissionsByJob[row.id] || [];
    const currentVisitId = getCurrentVisitId(job);
    const currentVisitStartedAt = job.currentVisitStartedAt ? new Date(job.currentVisitStartedAt).getTime() : 0;

    const noteHistory = remoteNotes.map(note => ({
      id: note.id,
      date: note.created_at || new Date().toISOString(),
      user: workerNames[note.worker_id] || (note.worker_id ? "Employee" : "Admin"),
      workerId: note.worker_id || "",
      text: note.note_text || "",
      noteType: note.note_type || "general",
      visitId: note.visit_id || "",
      showInTradeView: Boolean(note.show_in_trade_view)
    }));
    const jobHistory = remoteHistory.map(item => ({
      id: item.id,
      date: item.created_at || new Date().toISOString(),
      user: "System",
      action: item.action || "Update",
      details: item.details || ""
    }));

    // Completion submissions are stored in a dedicated ledger. This avoids
    // relying on the jobs JSON payload or on the order in which an employee
    // presses Save update and Complete. Only the active visit is exposed as
    // the current completion in Admin and Trade Views.
    const workerCompletions = {};
    completionSubmissions.forEach(submission => {
      const submissionVisitId = submission.visit_id || "original";
      const activeVisitId = currentVisitId || "original";
      if (!submission.worker_id || submissionVisitId !== activeVisitId) return;
      if (workerCompletions[submission.worker_id]) return;
      workerCompletions[submission.worker_id] = {
        submissionId: submission.id,
        visitId: currentVisitId || null,
        submittedComplete: true,
        completionDescription: submission.completion_description || "",
        materialsUsed: submission.materials_used || "",
        requiresAnotherTrade: Boolean(submission.requires_another_trade),
        followUpTrade: submission.follow_up_trade || "",
        updatedAt: submission.submitted_at || submission.updated_at || new Date().toISOString(),
        updatedBy: workerNames[submission.worker_id] || "Employee"
      };
    });

    // Backward compatibility for updates saved before the dedicated ledger
    // was introduced. A note counts only when it belongs to the active visit.
    remoteNotes.forEach(note => {
      if (!note.worker_id || !["completion", "completion_follow_up"].includes(note.note_type)) return;
      if (workerCompletions[note.worker_id]) return;
      const noteTime = note.created_at ? new Date(note.created_at).getTime() : 0;
      const activeVisitId = currentVisitId || "original";
      const noteVisitId = note.visit_id || "original";
      const belongsToCurrentVisit = noteVisitId === activeVisitId ||
        (!note.visit_id && currentVisitId && noteTime >= currentVisitStartedAt);
      if (!belongsToCurrentVisit) return;
      workerCompletions[note.worker_id] = {
        submissionId: `legacy-note-${note.id}`,
        visitId: currentVisitId || null,
        submittedComplete: true,
        completionDescription: note.note_text || "Completion update submitted.",
        materialsUsed: "",
        requiresAnotherTrade: note.note_type === "completion_follow_up",
        followUpTrade: "",
        updatedAt: note.created_at || new Date().toISOString(),
        updatedBy: workerNames[note.worker_id] || "Employee"
      };
    });

    // Put employee completion submissions into the Admin Notes history as
    // explicit entries, even if the legacy job_notes insert was blocked.
    const completionNotes = completionSubmissions.map(submission => {
      const parts = [
        submission.completion_description ? `Works: ${submission.completion_description}` : "",
        submission.materials_used ? `Materials: ${submission.materials_used}` : "",
        submission.requires_another_trade ? `Another trade required${submission.follow_up_trade ? `: ${submission.follow_up_trade}` : ""}` : ""
      ].filter(Boolean);
      return {
        id: `completion-${submission.id}`,
        date: submission.submitted_at || submission.updated_at || new Date().toISOString(),
        user: workerNames[submission.worker_id] || "Employee",
        workerId: submission.worker_id || "",
        text: parts.join("\n") || "Completion update submitted.",
        noteType: submission.requires_another_trade ? "completion_follow_up" : "completion",
        visitId: submission.visit_id || ""
      };
    });
    job = {
      ...job,
      attachments: mergeAttachments(storedAttachments, job.attachments || []),
      noteHistory: mergeHistoryEntries([...completionNotes, ...noteHistory], job.noteHistory || []),
      jobHistory: mergeHistoryEntries(jobHistory, job.jobHistory || []),
      workerCompletions
    };
    return normaliseJob(job);
  });
}

function mergeHistoryEntries(primary = [], secondary = []) {
  const seen = new Set();
  return [...primary, ...secondary].filter(item => {
    if (!item) return false;
    const key = item.id || `${item.date || ""}:${item.user || ""}:${item.text || item.action || ""}:${item.details || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
}

async function persistJobToSupabase(job) {
  if (!supabase) throw new Error("Supabase is not configured for this build.");
  const normalised = normaliseJob(job);
  const { error: jobError } = await supabase.from("jobs").upsert(mapJobToSupabase(normalised), { onConflict: "id" });
  if (jobError) throw jobError;
  const { error: deleteError } = await supabase.from("job_bookings").delete().eq("job_id", normalised.id);
  if (deleteError) throw deleteError;
  const bookings = getJobBookingsForSupabase(normalised);
  if (bookings.length) {
    const { error: bookingError } = await supabase.from("job_bookings").insert(bookings);
    if (bookingError) throw bookingError;
  }
  await syncArchivedVisitsToSupabase(normalised);
  return normalised;
}

async function syncArchivedVisitsToSupabase(job) {
  if (!supabase || !isUuid(job?.id)) return;
  const visits = Array.isArray(job.priorVisits) ? job.priorVisits : [];
  for (const visit of visits) {
    const visitKey = String(visit.id || "");
    if (!visitKey) continue;
    const workerStatus = visit.workerStatus || {};
    const totalMs = Object.values(workerStatus).reduce((sum, state) => sum + Math.max(0, Number(state?.totalMs) || 0), 0);
    const row = {
      job_id: job.id,
      visit_key: visitKey,
      visit_type: visit.reason || "rescheduled",
      start_date: visit.startDate || null,
      end_date: visit.endDate || visit.startDate || null,
      assigned_to: Array.isArray(visit.assignedTo) ? visit.assignedTo : [],
      worker_status: workerStatus,
      worker_completions: visit.workerCompletions || {},
      total_ms: Math.round(totalMs),
      completed_confirmed: Boolean(visit.completedConfirmed),
      archived_at: visit.archivedAt || new Date().toISOString(),
      snapshot: visit,
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from("job_visit_history").upsert(row, { onConflict: "job_id,visit_key" });
    if (error && error.code !== "42P01") throw error;
  }
}

async function deleteJobFromSupabase(jobId) {
  if (!supabase) throw new Error("Supabase is not configured for this build.");
  const { error } = await supabase.from("jobs").delete().eq("id", jobId);
  if (error) throw error;
}

async function upsertCompletionSubmissionToSupabase({ jobId, workerId, visitId = "original", completion, createdBy = null }) {
  if (!supabase || !isUuid(jobId) || !isUuid(workerId)) {
    throw new Error("A valid job and employee are required to save a completion update.");
  }
  const now = new Date().toISOString();
  const row = {
    job_id: jobId,
    worker_id: workerId,
    visit_id: visitId || "original",
    completion_description: completion?.completionDescription || "",
    materials_used: completion?.materialsUsed || "",
    requires_another_trade: Boolean(completion?.requiresAnotherTrade),
    follow_up_trade: completion?.followUpTrade || null,
    submitted_by: isUuid(createdBy) ? createdBy : null,
    submitted_at: now,
    updated_at: now
  };
  const { data, error } = await supabase
    .from("job_completion_submissions")
    .upsert(row, { onConflict: "job_id,visit_id,worker_id" })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

async function insertJobNoteToSupabase({ jobId, workerId, noteText, noteType = "general", visitId = null, showInTradeView = false, createdBy = null }) {
  if (!supabase || !isUuid(jobId) || !noteText) return;
  const row = {
    job_id: jobId,
    worker_id: isUuid(workerId) ? workerId : null,
    note_text: noteText,
    note_type: noteType,
    visit_id: visitId || null,
    show_in_trade_view: Boolean(showInTradeView),
    created_by: isUuid(createdBy) ? createdBy : null
  };
  const { error } = await supabase.from("job_notes").insert(row);
  if (error) throw error;
}

async function insertJobHistoryToSupabase({ jobId, action, details = "", createdBy = null }) {
  if (!supabase || !isUuid(jobId) || !action) return;
  const row = {
    job_id: jobId,
    action,
    details,
    created_by: isUuid(createdBy) ? createdBy : null
  };
  const { error } = await supabase.from("job_history").insert(row);
  if (error) throw error;
}


async function fetchToolsFromSupabase() {
  if (!supabase) return [];
  const { data, error } = await supabase.from("tools").select("*").order("description");
  if (error) { if (["42P01","42501"].includes(error.code)) return []; throw error; }
  return (data||[]).map(row=>({id:row.id,description:row.description||"",toolId:row.tool_id||"",serialNumber:row.serial_number||"",brandModel:row.brand_model||"",status:row.status||"available",assignedWorkerId:row.assigned_worker_id||"",signedOutAt:row.signed_out_at||"",notes:row.notes||"",active:row.active!==false,persisted:true}));
}
async function fetchToolHistoryFromSupabase() {
  if (!supabase) return [];
  const { data, error } = await supabase.from("tool_transactions").select("*,tools(description,tool_id)").order("created_at",{ascending:false}).limit(500);
  if (error) { if (["42P01","42501"].includes(error.code)) return []; throw error; }
  return (data||[]).map(row=>({id:row.id,toolId:row.tool_id,toolDescription:row.tools?.description||row.tools?.tool_id||"Tool",action:row.action,workerId:row.worker_id||"",fromWorkerId:row.from_worker_id||"",reason:row.reason||"",createdAt:row.created_at}));
}
async function saveToolToSupabase(tool) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const description = String(tool.description || "").trim();
  const toolCode = String(tool.toolId || "").trim();
  if (!description) throw new Error("Tool description is required.");
  if (!toolCode) throw new Error("Tool ID is required.");

  const row = {
    id: tool.id,
    description,
    tool_id: toolCode,
    serial_number: String(tool.serialNumber || "").trim() || null,
    brand_model: String(tool.brandModel || "").trim() || null,
    status: tool.assignedWorkerId && tool.status === "available" ? "signed_out" : (tool.status || "available"),
    assigned_worker_id: tool.assignedWorkerId || null,
    signed_out_at: tool.assignedWorkerId ? (tool.signedOutAt || new Date().toISOString()) : null,
    notes: String(tool.notes || "").trim() || null,
    active: tool.active !== false,
    updated_at: new Date().toISOString()
  };

  const query = tool.persisted
    ? supabase.from("tools").update(row).eq("id", tool.id)
    : supabase.from("tools").insert(row);
  const { data: saved, error } = await query.select("*").single();
  if (error) throw error;
  if (!saved?.id) throw new Error("Supabase did not return the saved tool. The tool was not confirmed as stored.");

  const { error: historyError } = await supabase.from("tool_transactions").insert({
    tool_id: saved.id,
    action: tool.persisted ? "updated" : "created",
    worker_id: saved.assigned_worker_id || null,
    reason: tool.persisted ? "Tool details updated" : "Tool added to register"
  });
  if (historyError) console.warn("Tool saved, but history entry failed", historyError);
  return saved;
}
async function saveToolActionToSupabase({tool,action,workerId,reason}) {
  if (!supabase) throw new Error("Supabase is not configured.");
  let patch={updated_at:new Date().toISOString()};
  if(action==="sign_out") patch={...patch,status:"signed_out",assigned_worker_id:workerId,signed_out_at:new Date().toISOString()};
  if(action==="return") patch={...patch,status:"available",assigned_worker_id:null,signed_out_at:null};
  if(action==="out_of_service") patch={...patch,status:"out_of_service"};
  if(action==="return_to_service") patch={...patch,status:"available",assigned_worker_id:null,signed_out_at:null};
  const {error}=await supabase.from("tools").update(patch).eq("id",tool.id); if(error)throw error;
  const {error:historyError}=await supabase.from("tool_transactions").insert({tool_id:tool.id,action,worker_id:workerId||tool.assignedWorkerId||null,from_worker_id:tool.assignedWorkerId||null,reason:reason||null}); if(historyError)throw historyError;
}

function emptyJob(){ return normaliseJob({id:createId(),title:"",client:"",site:"",requiredTrade:"",requiredTrades:[],materialsStatus:"Parts from stock",jobNumber:"",quoteNumber:"",workOrderNumber:"",poNumber:"",jobValue:"",address:"",clientContact:"",clientPhone:"",category:"To be scheduled",assignedTo:[],startDate:"",endDate:"",notes:"",materials:[],attachments:[],noteHistory:[],jobHistory:[],workerStatus:{},scheduleBlocks:[],safetyPermits:[]}); }
function normaliseJob(job){ const trades = Array.isArray(job.requiredTrades) && job.requiredTrades.length ? job.requiredTrades : (job.requiredTrade ? [job.requiredTrade] : []); const blocks = Array.isArray(job.scheduleBlocks) ? job.scheduleBlocks.map(b=>({id:b.id||createId(),workerId:b.workerId||"",startDate:b.startDate||"",endDate:b.endDate||b.startDate||""})).filter(b=>b.workerId&&b.startDate&&b.endDate) : []; return {client:"",site:"",requiredTrade:trades[0]||job.requiredTrade||"",requiredTrades:trades,materialsStatus:"Parts from stock",jobNumber:"",quoteNumber:"",workOrderNumber:"",poNumber:"",jobValue:"",clientPhone:"",appointmentSent:false,clientAccepted:false,isAdHoc:false,isTravelComment:false,materials:[],attachments:[],noteHistory:[],jobHistory:[],workerStatus:{},workerCompletions:{},priorVisits:[],currentVisitId:"",currentVisitStartedAt:"",completedConfirmed:false,isDefectCallback:false,jobStatus:job.category||"To be scheduled",scheduleBlocks:[],machineryBookings:[],safetyPermits:[],...job,requiredTrade:trades[0]||job.requiredTrade||"",requiredTrades:trades,assignedTo:Array.isArray(job.assignedTo)?job.assignedTo:[],scheduleBlocks:blocks,machineryBookings:Array.isArray(job.machineryBookings)?job.machineryBookings:[],priorVisits:Array.isArray(job.priorVisits)?job.priorVisits:[],safetyPermits:normaliseSafetyPermits(job.safetyPermits),jobStatus:job.jobStatus || (job.isDefectCallback ? "Call back - Defects" : job.category || "To be scheduled"), isDefectCallback:Boolean(job.isDefectCallback || job.jobStatus === "Call back - Defects"), endDate:job.endDate||job.startDate||""}; }
function createId(){ return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function loadData(){ try{const saved=localStorage.getItem(STORAGE_KEY); if(!saved) return initialData; const parsed=JSON.parse(saved); return {...initialData,...parsed,teamMembers:(parsed.teamMembers||[]).map(w=>({birthday:"",sapNumber:w.employeeNumber||"",inactive:false,accessRevoked:false,customWorkStart:"",customWorkEnd:"",customRnrStart:"",customRnrEnd:"",customRepeatUntil:"",...w})),jobs:(parsed.jobs||[]).map(normaliseJob),leaveRecords:parsed.leaveRecords||[],messages:parsed.messages||[]};}catch{return initialData;} }
function saveData(data){ localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
function fileToAttachment(file, label = "Attachment") {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      id: createId(),
      name: file.name || label,
      type: file.type || "application/pdf",
      size: file.size || 0,
      addedAt: new Date().toISOString(),
      label,
      dataUrl: reader.result
    });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function extractTextFromPdf(file){ const buffer=await file.arrayBuffer(); const pdf=await pdfjsLib.getDocument({data:buffer}).promise; const pages=[]; for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i); const content=await page.getTextContent(); pages.push(content.items.map(item=>item.str).join("\n"));} return pages.join("\n\n"); }
function parseAimJobSheet(text){ const compact=text.replace(/\r/g,"\n").replace(/[ \t]+/g," ").replace(/\n+/g,"\n").trim(); const client=extractClient(compact); const address=cleanMultiline(extractBetween(compact,"Job Address","Reference")); const reference=cleanMultiline(extractBetween(compact,"Reference","Job Number")).replace(/, /g," "); const jobNumber=normaliseCode(matchFirst(compact,/Job Number\s+([A-Z]{1,4}\d{3,})/i)||matchFirst(compact,/\b(JB\s*\d{3,})\b/i)); const quoteNumber=normaliseCode(matchFirst(compact,/\b(QUO\s*\d+)\b/i)); const workOrderNumber=normaliseCode(matchFirst(compact,/\b(WO\s*\d+)\b/i)||matchFirst(compact,/\b(WO\d+)\b/i)); const poNumber=normaliseCode(matchFirst(compact,/\b(PO\s*[A-Z]?\d+)\b/i)); return {title:reference,address,client,clientContact:client,site:guessSiteFromText(address),jobNumber,quoteNumber,workOrderNumber,poNumber,notes:extractScope(compact)}; }
function extractClient(text){ const start=text.indexOf("Job Sheet"); const end=text.indexOf("Job Address"); if(start===-1||end===-1) return ""; return cleanMultiline(text.slice(start,end).replace(/Job Sheet/i,"").replace(/\d{1,2}\s+\w+\s+\d{4}/g,"")); }
function extractScope(text){ const m=text.match(/Job Number\s+[A-Z]{1,4}\d{3,}/i); const notes=text.toLowerCase().indexOf("notes"); if(!m||notes===-1) return ""; return text.slice(m.index+m[0].length,notes).split("\n").map(l=>l.trim()).filter(Boolean).join("\n"); }
function extractBetween(text,startLabel,endLabel){ const s=text.toLowerCase().indexOf(startLabel.toLowerCase()); if(s===-1)return""; const rest=text.slice(s+startLabel.length); const e=rest.toLowerCase().indexOf(endLabel.toLowerCase()); return (e===-1?rest:rest.slice(0,e)).trim(); }
function cleanMultiline(v){ return String(v||"").split("\n").map(l=>l.trim()).filter(Boolean).join(", ").trim(); }
function matchFirst(text,regex){ const m=text.match(regex); return m?m[1]:""; }
function normaliseCode(v){ return String(v||"").replace(/\s+/g," ").trim().toUpperCase(); }
function addDays(date,amount){ const d=new Date(date); d.setDate(d.getDate()+amount); return d; }
function getStartOfWeek(date){ const d=new Date(date); d.setHours(0,0,0,0); return d; }
function getIsoDate(date){ const d=new Date(date); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function getDatesInRange(start,end){ const out=[]; let d=new Date(start+"T00:00:00"); const e=new Date(end+"T00:00:00"); while(d<=e){out.push(getIsoDate(d)); d=addDays(d,1);} return out; }
function daysBetween(start,target){ return Math.floor((new Date(target+"T00:00:00")-new Date(start+"T00:00:00"))/(24*60*60*1000)); }
function getRosterStatus(worker,iso){
  if(!worker?.rosterPattern||worker.rosterPattern==="NONE") return "Onsite";
  if(worker.rosterPattern === "CUSTOM") return getCustomRosterStatus(worker, iso);
  if(!worker.rosterStartDate) return "Onsite";
  const p=ROSTER_PATTERNS.find(x=>x.id===worker.rosterPattern);
  if(!p?.onDays||!p?.offDays) return "Onsite";
  const diff=daysBetween(worker.rosterStartDate,iso);
  const day=((diff%(p.onDays+p.offDays))+(p.onDays+p.offDays))%(p.onDays+p.offDays);
  return day<p.onDays?"Onsite":"RNR";
}

function getCustomRosterStatus(worker, iso){
  const ws=worker.customWorkStart, we=worker.customWorkEnd, rs=worker.customRnrStart, re=worker.customRnrEnd;
  if(!ws || !we || !rs || !re) return "Onsite";
  if(isDateWithinRange(iso, ws, we)) return "Onsite";
  if(isDateWithinRange(iso, rs, re)) return "RNR";
  if(!worker.customRepeatUntil || compareIsoDates(iso, worker.customRepeatUntil) > 0) return "Onsite";
  const workDays = daysBetween(ws, we) + 1;
  const rnrDays = daysBetween(rs, re) + 1;
  const cycle = workDays + rnrDays;
  if(cycle <= 0 || compareIsoDates(iso, ws) < 0) return "Onsite";
  const day = ((daysBetween(ws, iso) % cycle) + cycle) % cycle;
  return day < workDays ? "Onsite" : "RNR";
}

function findSchedulingConflicts(job, worker, date, jobs, leaveRecords) {
  const conflicts = [];
  const availability = getWorkerAvailability(worker, date, leaveRecords);
  if (availability.status !== "Onsite") conflicts.push(`${worker.name} is ${availability.label} on ${date}`);
  if (jobTradeText(job) && worker.trade && !getJobTrades(job).includes(worker.trade)) conflicts.push(`Job requires ${jobTradeText(job)}, but ${worker.name} is ${worker.trade}`);
  if (!job.clientAccepted && !job.isAdHoc && !job.isTravelComment) conflicts.push("Client appointment has not been accepted");
  if (isAwaitingMaterials(job) && !job.isAdHoc && !job.isTravelComment) conflicts.push(`Materials status is ${job.materialsStatus}`);
  const clash = jobs.find(other => other.id !== job.id && other.category !== "Cancelled" && other.assignedTo?.includes(worker.id) && isDateWithinRange(date, other.startDate, other.endDate));
  if (clash) conflicts.push(`${worker.name} already has another job scheduled that day: ${clash.title}`);
  return conflicts;
}

function guessSiteFromText(value) {
  const lower = String(value || "").toLowerCase();
  return JOB_SITES.find(site => lower.includes(site.toLowerCase())) || "";
}

function getJobTrades(job){ return Array.isArray(job.requiredTrades) && job.requiredTrades.length ? job.requiredTrades : (job.requiredTrade ? [job.requiredTrade] : []); }
function jobTradeText(job){ return getJobTrades(job).join(", "); }
function isDefectJob(job){ return Boolean(job?.isDefectCallback || job?.jobStatus === "Call back - Defects"); }

function shortClientName(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const lower = raw.toLowerCase();
  if (lower.includes("sodexo")) return "Sodexo Remote Sites";
  if (lower.includes("rio tinto") || lower.includes("rtio")) return "Rio Tinto";
  if (lower.includes("bhp")) return "BHP";
  if (lower.includes("fortescue") || lower.includes("fmg")) return "Fortescue";
  if (lower.includes("mineral resources") || lower.includes("minres")) return "MinRes";
  if (lower.includes("citic")) return "CITIC Pacific Mining";
  const firstPart = raw.split(/[;,]/)[0].trim();
  const withoutBusinessSuffix = firstPart
    .replace(/\b(Pty\.?\s*Ltd\.?|Proprietary\s+Limited|Ltd\.?|Limited|Australia|Western\s+Australia|WA)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return withoutBusinessSuffix || firstPart || raw;
}
function buildScheduleMessage(job){ return `Hi, we have been asked to undertake works to your property, currently we have the job scheduled in for the ${job.startDate||"insert schedule date"}. Please let us know if this would be suitable for you. Thanks, AIM Construction`; }
function buildRescheduleMessage(job){ return `Hi, we need to reschedule the works to your property. We currently have the job rescheduled for the ${job.startDate||"insert new schedule date"}. Please let us know if this would be suitable for you. Thanks, AIM Construction`; }
function buildSmsMessage(job){ return buildScheduleMessage(job); }
function buildScheduleRows({startDate,endDate,workers,jobs,leaveRecords}){ const rows=[]; for(const date of getDatesInRange(startDate,endDate)){for(const w of workers){const a=getWorkerAvailability(w,date,leaveRecords); const js=jobs.filter(j=>jobOccursForWorkerOnDate(j,w.id,date)); if(!js.length) rows.push({Date:date,Worker:w.name,Status:a.label,Title:"",Address:""}); js.forEach(j=>rows.push({Date:date,Worker:w.name,Status:a.label,Title:j.title,Address:j.address,Site:j.site,Trade:jobTradeText(j),Materials:j.materialsStatus,WO:j.workOrderNumber,PO:j.poNumber}));}} return rows; }

function hasPrimaryBooking(job){ return Boolean(job?.startDate && job?.endDate && Array.isArray(job.assignedTo) && job.assignedTo.length); }
function jobHasAnyBooking(job){ return hasPrimaryBooking(job) || (Array.isArray(job?.scheduleBlocks) && job.scheduleBlocks.some(b => b.workerId && b.startDate && b.endDate)); }
function jobOccursForWorkerOnDate(job, workerId, iso){
  if (!job || !workerId || !iso) return false;
  if ((job.assignedTo || []).includes(workerId) && isDateWithinRange(iso, job.startDate, job.endDate)) return true;
  return (job.scheduleBlocks || []).some(b => b.workerId === workerId && isDateWithinRange(iso, b.startDate, b.endDate));
}
function isJobOccurrenceStart(job, workerId, iso){
  const primary = (job.assignedTo || []).includes(workerId) && job.startDate === iso;
  const blockStart = (job.scheduleBlocks || []).some(b => b.workerId === workerId && b.startDate === iso);
  const singleDayExtra = (job.scheduleBlocks || []).some(b => b.workerId === workerId && b.startDate === b.endDate && b.startDate === iso);
  return primary || blockStart || singleDayExtra;
}

function getOccurrenceRange(job, workerId, iso){
  if ((job.assignedTo || []).includes(workerId) && isDateWithinRange(iso, job.startDate, job.endDate)) {
    return { source: "primary", startDate: job.startDate, endDate: job.endDate };
  }
  const block = (job.scheduleBlocks || []).find(b => b.workerId === workerId && isDateWithinRange(iso, b.startDate, b.endDate));
  return block ? { source: "block", blockId: block.id, startDate: block.startDate, endDate: block.endDate } : null;
}

function moveScheduledOccurrence(job, sourceWorkerId, sourceDate, targetWorkerId, targetDate){
  const occurrence = getOccurrenceRange(job, sourceWorkerId, sourceDate);
  if (!occurrence) return job;
  const durationDays = Math.max(0, daysBetween(occurrence.startDate, occurrence.endDate));
  const newStartDate = targetDate;
  const newEndDate = getIsoDate(addDays(new Date(targetDate + "T00:00:00"), durationDays));
  let assignedTo = [...(job.assignedTo || [])];
  let scheduleBlocks = [...(job.scheduleBlocks || [])];

  if (occurrence.source === "primary") {
    assignedTo = assignedTo.filter(id => id !== sourceWorkerId);
    if (!assignedTo.length) {
      assignedTo = [targetWorkerId];
      return { ...job, assignedTo, startDate: newStartDate, endDate: newEndDate, scheduleBlocks };
    }
    const alreadyTargetPrimary = assignedTo.includes(targetWorkerId) && isDateWithinRange(targetDate, job.startDate, job.endDate);
    if (!alreadyTargetPrimary) scheduleBlocks.push({ id: createId(), workerId: targetWorkerId, startDate: newStartDate, endDate: newEndDate });
    return { ...job, assignedTo, scheduleBlocks };
  }

  scheduleBlocks = scheduleBlocks.filter(b => b.id !== occurrence.blockId);
  scheduleBlocks.push({ id: createId(), workerId: targetWorkerId, startDate: newStartDate, endDate: newEndDate });
  if (!assignedTo.includes(targetWorkerId)) assignedTo.push(targetWorkerId);
  return { ...job, assignedTo, scheduleBlocks };
}

function removeScheduledOccurrence(job, sourceWorkerId, sourceDate){
  const occurrence = getOccurrenceRange(job, sourceWorkerId, sourceDate);
  if (!occurrence) return job;
  let assignedTo = [...(job.assignedTo || [])];
  let scheduleBlocks = [...(job.scheduleBlocks || [])];
  let startDate = job.startDate || "";
  let endDate = job.endDate || "";

  if (occurrence.source === "primary") {
    assignedTo = assignedTo.filter(id => id !== sourceWorkerId);
    if (!assignedTo.length) {
      const replacement = scheduleBlocks.shift();
      if (replacement) {
        assignedTo = [replacement.workerId];
        startDate = replacement.startDate;
        endDate = replacement.endDate;
      } else {
        startDate = "";
        endDate = "";
      }
    }
  } else {
    scheduleBlocks = scheduleBlocks.filter(b => b.id !== occurrence.blockId);
  }

  const stillAssigned = new Set();
  assignedTo.forEach(id => id && stillAssigned.add(id));
  scheduleBlocks.forEach(b => b.workerId && stillAssigned.add(b.workerId));

  return { ...job, assignedTo: [...stillAssigned], startDate, endDate, scheduleBlocks };
}

function isLockedCompletedJob(job){
  return Boolean(job && (job.category === "Completed" || job.completedConfirmed || job.jobStatus === "Completed"));
}

function normaliseSafetyPermits(value){
  if(!Array.isArray(value)) return [];
  return value.map(item => {
    if(typeof item === "string") return { id: createId(), name: item, organised: false, inProgress: false };
    return { id: item.id || createId(), name: item.name || item.label || "", organised: Boolean(item.organised), inProgress: Boolean(item.inProgress) };
  }).filter(item => item.name);
}

function getSafetyPermits(job){
  return normaliseSafetyPermits(job?.safetyPermits || []);
}

function hasOutstandingSafetyPermits(job){
  if (job?.isAdHoc || job?.isTravelComment) return false;
  const permits = getSafetyPermits(job);
  return permits.some(permit => !permit.organised);
}

function allSafetyOrganised(job){
  const permits = getSafetyPermits(job);
  return permits.length > 0 && permits.every(permit => permit.organised);
}

function getSafetyPermitStatus(job){
  const permits = getSafetyPermits(job);
  if (!permits.length) return "none";
  if (permits.every(permit => permit.organised)) return "safe";
  if (permits.some(permit => permit.inProgress)) return "progress";
  return "unsafe";
}

function getSafetyPermitTitle(job){
  const status = getSafetyPermitStatus(job);
  if (status === "safe") return "Safety/permits organised";
  if (status === "progress") return "Safety/permits in progress";
  return "Safety/permits still required";
}

function hasUnactionedRequest(job, messages = []){
  if (job?.isAdHoc || job?.isTravelComment) return false;
  const requestWords = /reschedul|reassign|another trade|follow[- ]?up|return visit|action needed/i;
  const linkedMessage = messages.some(m => m.jobId === job.id && !m.actioned && requestWords.test(String(m.text || "")));
  const completionRequest = Object.values(job.workerCompletions || {}).some(c => c.requiresAnotherTrade);
  return linkedMessage || completionRequest;
}

function getActionNeededText(job, messages = []){
  const reasons = [];
  const readiness = getReadiness(job);
  if(!readiness.ready) reasons.push(`Missing: ${readiness.missing.join(", ")}`);
  if(hasOutstandingSafetyPermits(job)) reasons.push("Safety/permit item not organised");
  if(hasUnactionedRequest(job, messages)) reasons.push("Unactioned reschedule/reassign/follow-up request");
  return reasons.join(" · ") || "Action required";
}

function isActionNeeded(job, messages = []){
  return !getReadiness(job).ready || hasOutstandingSafetyPermits(job) || hasUnactionedRequest(job, messages);
}

function sortScheduleItems(a, b){
  if (a.isTravelComment && !b.isTravelComment) return -1;
  if (!a.isTravelComment && b.isTravelComment) return 1;
  if (a.isAdHoc && !b.isAdHoc) return 1;
  if (!a.isAdHoc && b.isAdHoc) return -1;
  return String(a.title || "").localeCompare(String(b.title || ""));
}

function getWorkerName(workers,id){ return workers.find(w=>w.id===id)?.name||id; }
function getAssignedWorkerNames(workers,ids=[]){ return ids.map(id=>getWorkerName(workers,id)).join(", "); }
function getCurrentVisitId(job){
  if (!job || !isDefectJob(job)) return job?.currentVisitId || "";
  return job.currentVisitId || (job.currentVisitStartedAt ? `defect-${job.currentVisitStartedAt}` : "");
}
function getCurrentWorkerStatus(job, workerId){
  const state = job?.workerStatus?.[workerId];
  if (!state) return "notStarted";
  const currentVisitId = getCurrentVisitId(job);
  if (isDefectJob(job) && currentVisitId && state.visitId !== currentVisitId) return "notStarted";
  if (isDefectJob(job) && job.currentVisitStartedAt && state.updatedAt && new Date(state.updatedAt).getTime() < new Date(job.currentVisitStartedAt).getTime()) return "notStarted";
  return state.status || "notStarted";
}
function getCurrentWorkerTotalMs(job,workerId){ const s=job.workerStatus?.[workerId]; if(!s || getCurrentWorkerStatus(job,workerId)==="notStarted" && isDefectJob(job) && getCurrentVisitId(job) && s.visitId!==getCurrentVisitId(job)) return 0; let total=Number(s.totalMs)||0; if(getCurrentWorkerStatus(job,workerId)==="running"&&s.runningSince) total+=Math.max(0,Date.now()-Number(s.runningSince)); return total; }
function getWorkerTotalMs(job,workerId){
  const archived=(job.priorVisits||[]).reduce((sum,visit)=>{ const s=visit?.workerStatus?.[workerId]; if(!s)return sum; let ms=Number(s.totalMs)||0; if(s.status==="running"&&s.runningSince&&visit.archivedAt) ms+=Math.max(0,new Date(visit.archivedAt).getTime()-Number(s.runningSince)); return sum+ms; },0);
  return archived+getCurrentWorkerTotalMs(job,workerId);
}
function formatDuration(ms){ const mins=Math.floor(ms/60000); const h=Math.floor(mins/60); const m=mins%60; return h?`${h}h ${m}m`:`${m}m`; }
function formatBytes(bytes=0){ if(bytes<1024)return `${bytes} B`; if(bytes<1024*1024)return `${Math.round(bytes/1024)} KB`; return `${(bytes/1024/1024).toFixed(1)} MB`; }
function isDateWithinRange(date,start,end){ return !!start&&!!end&&date.localeCompare(start)>=0&&date.localeCompare(end)<=0; }
function compareIsoDates(a,b){ return a.localeCompare(b); }
function isToday(date){ return getIsoDate(date)===getIsoDate(new Date()); }
function formatDayName(date){ return new Intl.DateTimeFormat("en-AU",{weekday:"short"}).format(date); }
function formatDateHeader(date){ return new Intl.DateTimeFormat("en-AU",{day:"2-digit",month:"short"}).format(date); }
function formatIsoForDisplay(iso){ return new Intl.DateTimeFormat("en-AU",{weekday:"short",day:"2-digit",month:"short",year:"numeric"}).format(new Date(iso+"T00:00:00")); }
function formatDateTime(iso){
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-AU",{dateStyle:"short",timeStyle:"short"}).format(date);
}
function labelTab(t){ return ({details:"Details",scheduling:"Scheduling",client:"Client / SMS",notes:"Notes",materials:"Materials",attachments:"Attachments",history:"History"})[t]||t; }


function getWorkerAvailability(worker, iso, leaveRecords = []) {
  if (!worker) return { status: "RNR", label: "Unavailable" };

  const leave = leaveRecords.find(l =>
    l.workerId === worker.id &&
    isDateWithinRange(iso, l.startDate, l.endDate)
  );

  if (leave) {
    return {
      status: "RNR",
      label: leave.leaveType || "Leave"
    };
  }

  const rosterStatus = getRosterStatus(worker, iso);

  return {
    status: rosterStatus,
    label: rosterStatus === "Onsite" ? "Onsite" : "RNR"
  };
}

function effectiveMaterialsStatus(job) {
  const status = String(job?.materialsStatus || "").trim();
  const legacyMap = { "Not checked": "No parts required", "Not required": "No parts required", "Required": "Awaiting supplier quote", "Ready": "All parts arrived" };
  return legacyMap[status] || status || "Parts from stock";
}

function isAwaitingMaterials(job) {
  return ["Awaiting supplier quote", "Ordered", "Partially arrived"].includes(effectiveMaterialsStatus(job));
}

function isMaterialsReady(job) {
  return ["No parts required", "Parts from stock", "All parts arrived"].includes(effectiveMaterialsStatus(job));
}

function getReadiness(job) {
  if (job?.isAdHoc || job?.isTravelComment) return { ready: true, missing: [] };
  const missing = [];

  if (!job.title) missing.push("job title");
  if (!job.client) missing.push("client");
  if (!job.address && !job.site) missing.push("address/site");
  // Blank or Not checked materials status is treated as materials N/A.
  if (isAwaitingMaterials(job)) missing.push(`materials: ${effectiveMaterialsStatus(job)}`);
  if (hasOutstandingSafetyPermits(job)) missing.push("safety/permits organised");

  return {
    ready: missing.length === 0,
    missing
  };
}

createRoot(document.getElementById("root")).render(<App />);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .catch(error => console.error("Jobsched service worker registration failed", error));
  });
}
