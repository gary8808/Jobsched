
import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Plus, Search, Trash2, Pencil, X, Users, ChevronLeft, ChevronRight,
  PanelLeft, Phone, Mail, MessageSquare, Inbox, Settings, Share2, Upload,
  Play, Pause, Square, Clock, Paperclip, Package, History, CheckCircle2,
  AlertCircle, CalendarX, Plane, Wrench, RotateCcw
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import * as XLSX from "xlsx";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "./styles.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const STORAGE_KEY = "jobsched-v10-readiness-runsheet";
const CURRENT_USER = "Demo User";

const CATEGORIES = [
  "To be scheduled",
  "Awaiting parts",
  "To be rescheduled",
  "Scheduled",
  "Completed",
  "Cancelled"
];

const TRADES = ["Plumber", "Carpenter", "TA", "Electrician", "Refrigeration", "Boilermaker", "Concreter", "Supervisor"];
const BASE_SITES = ["Paraburdoo", "Brockman", "Busselton", "Karratha", "Tom Price", "Perth", "Other"];
const LEAVE_TYPES = ["Sick leave", "Annual leave", "Other leave"];
const MATERIAL_STATUSES = ["Not checked", "Required", "Ordered", "Partially arrived", "Ready", "Not required"];
const JOB_SITES = BASE_SITES;
const ROSTER_PATTERNS = [
  { id: "NONE", label: "No roster pattern", onDays: 0, offDays: 0 },
  { id: "5_ON_2_OFF", label: "5 days on / 2 off", onDays: 5, offDays: 2 },
  { id: "8_ON_6_OFF", label: "8 days on / 6 off", onDays: 8, offDays: 6 },
  { id: "14_ON_7_OFF", label: "2 weeks on / 1 off", onDays: 14, offDays: 7 },
  { id: "14_ON_14_OFF", label: "2 weeks on / 2 off", onDays: 14, offDays: 14 }
];

const STATUS_META = {
  notStarted: { label: "Not started", icon: "○" },
  running: { label: "Running", icon: "▶" },
  paused: { label: "Paused", icon: "Ⅱ" },
  stopped: { label: "Stopped", icon: "■" },
  completed: { label: "Completed", icon: "✓" }
};

const initialData = {
  teamMembers: [
    { id: "gary", name: "Gary", trade: "Supervisor", baseSite: "Paraburdoo", phone: "0400 000 000", email: "gary@example.com", birthday: "", sapNumber: "SAP001", rosterPattern: "5_ON_2_OFF", rosterStartDate: getIsoDate(new Date()) },
    { id: "mick", name: "Mick", trade: "Carpenter", baseSite: "Busselton", phone: "", email: "", birthday: "", sapNumber: "SAP002", rosterPattern: "8_ON_6_OFF", rosterStartDate: getIsoDate(new Date()) },
    { id: "drew", name: "Drew", trade: "Plumber", baseSite: "Paraburdoo", phone: "", email: "", birthday: "", sapNumber: "SAP003", rosterPattern: "14_ON_7_OFF", rosterStartDate: getIsoDate(new Date()) },
    { id: "gaz", name: "Gaz", trade: "Electrician", baseSite: "Brockman", phone: "", email: "", birthday: "", sapNumber: "SAP004", rosterPattern: "14_ON_14_OFF", rosterStartDate: getIsoDate(new Date()) }
  ],
  jobs: [
    normaliseJob({
      id: createId(),
      title: "790 larnook pool fence panel replacement WO5879466",
      client: "Sodexo Remote Sites Australia Pty Ltd.",
      site: "Paraburdoo",
      requiredTrade: "Carpenter",
      materialsStatus: "Ready",
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
  const [employeeId, setEmployeeId] = useState("gary");
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("To be scheduled");
  const [clientFilter, setClientFilter] = useState("All");
  const [tradeFilter, setTradeFilter] = useState("All");
  const [siteFilter, setSiteFilter] = useState("All");
  const [hideUnavailable, setHideUnavailable] = useState(false);
  const [weekStart, setWeekStart] = useState(getStartOfWeek(new Date()));
  const [editingJob, setEditingJob] = useState(null);
  const [jobHistoryJob, setJobHistoryJob] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [runSheetOpen, setRunSheetOpen] = useState(false);
  const [calendarPopup, setCalendarPopup] = useState(null);
  const [draggedJobId, setDraggedJobId] = useState(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const employeeDays = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(new Date(), i)), []);

  const clientOptions = useMemo(() => Array.from(new Set(data.jobs.map(j => j.client).filter(Boolean))).sort(), [data.jobs]);
  const unreadMessages = data.messages.filter(m => m.unread).length;

  const visibleWorkers = useMemo(() => {
    return data.teamMembers.filter(worker => {
      const matchesTrade = tradeFilter === "All" || worker.trade === tradeFilter;
      const matchesSite = siteFilter === "All" || worker.baseSite === siteFilter;
      const unavailableAllWeek = days.every(day => getWorkerAvailability(worker, getIsoDate(day), data.leaveRecords).status !== "Onsite");
      return matchesTrade && matchesSite && (!hideUnavailable || !unavailableAllWeek);
    });
  }, [data.teamMembers, data.leaveRecords, days, tradeFilter, siteFilter, hideUnavailable]);

  const filteredJobs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.jobs.filter(job => {
      const matchesCategory = activeCategory === "All" || job.category === activeCategory;
      const matchesClient = clientFilter === "All" || job.client === clientFilter;
      const matchesQuery = !q || [job.title, job.client, job.jobNumber, job.quoteNumber, job.workOrderNumber, job.poNumber, job.address, job.clientContact, job.notes].join(" ").toLowerCase().includes(q);
      return matchesCategory && matchesClient && matchesQuery;
    });
  }, [data.jobs, query, activeCategory, clientFilter]);

  const scheduledJobs = data.jobs.filter(job => job.startDate && job.endDate && job.assignedTo?.length && job.category !== "Cancelled");

  function updateData(next) { setData(next); saveData(next); }
  function updateJobs(mutator) { updateData({ ...data, jobs: data.jobs.map(mutator) }); }
  function logJob(job, action, details) {
    return { ...job, jobHistory: [{ id: createId(), date: new Date().toISOString(), user: CURRENT_USER, action, details }, ...(job.jobHistory || [])] };
  }
  function getDraggedJobId(e) { return e.dataTransfer.getData("text/plain") || draggedJobId; }
  function handleDragStart(e, jobId) { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", jobId); setDraggedJobId(jobId); }

  async function createJobFromPdfFile(file) {
    if (!file) return;
    try {
      const text = await extractTextFromPdf(file);
      const parsed = parseAimJobSheet(text);
      const job = normaliseJob({ ...emptyJob(), ...parsed, category: "To be scheduled" });
      updateData({ ...data, jobs: [logJob(job, "Created", `Created from PDF: ${file.name}`), ...data.jobs] });
      setActiveCategory("To be scheduled");
    } catch (err) { console.error(err); alert("The PDF could not be read. It may be scanned/image-based."); }
  }

  function saveJob(jobToSave) {
    const exists = data.jobs.some(j => j.id === jobToSave.id);
    let next = normaliseJob(jobToSave);
    next = logJob(next, exists ? "Updated" : "Created", exists ? "Job details saved." : "Job created.");
    updateData({ ...data, jobs: exists ? data.jobs.map(j => j.id === next.id ? next : j) : [next, ...data.jobs] });
    setEditingJob(null);
  }

  function cancelOrDeleteJob(job) {
    if (job.category === "Cancelled") {
      if (!confirm("Are you sure that you want to permanently delete this job?")) return;
      updateData({ ...data, jobs: data.jobs.filter(j => j.id !== job.id) });
      return;
    }
    if (!confirm("Move this job to the Cancelled bucket?")) return;
    updateJobs(j => j.id === job.id ? logJob({ ...j, category: "Cancelled" }, "Cancelled", "Job moved to Cancelled bucket.") : j);
  }

  function moveToBucket(jobId, category) {
    if (category === "All") return;
    updateJobs(job => {
      if (job.id !== jobId) return job;
      const updated = { ...job, category, assignedTo: category === "Scheduled" ? job.assignedTo : [], startDate: category === "Scheduled" ? job.startDate : "", endDate: category === "Scheduled" ? job.endDate : "" };
      return logJob(updated, "Status changed", `Moved to ${category}.`);
    });
  }

  function scheduleJob(jobId, workerId, date) {
    const jobToSchedule = data.jobs.find(j => j.id === jobId);
    const worker = data.teamMembers.find(w => w.id === workerId);
    if (jobToSchedule && worker) {
      const conflicts = findSchedulingConflicts(jobToSchedule, worker, date, data.jobs, data.leaveRecords);
      if (conflicts.length) {
        const ok = confirm(["Scheduling warning:", "", ...conflicts.map(c => "• " + c), "", "Continue anyway?"].join("\\n"));
        if (!ok) return;
      }
    }

    updateJobs(job => {
      if (job.id !== jobId) return job;
      const wasConfirmed = Boolean(job.clientAccepted);
      let notify = false;
      let keepConfirmed = true;
      if (wasConfirmed && (job.startDate !== date || !job.assignedTo.includes(workerId))) {
        notify = confirm("This job has a confirmed appointment. Do you wish to notify the contact of the change?");
        if (!notify) keepConfirmed = confirm("Do you want to keep the appointment set as confirmed?");
      }
      const assignedTo = job.assignedTo.includes(workerId) ? job.assignedTo : [...job.assignedTo, workerId];
      let updated = { ...job, assignedTo, startDate: date, endDate: date, category: "Scheduled", clientAccepted: keepConfirmed };
      updated = logJob(updated, "Scheduled", `Scheduled to ${getWorkerName(data.teamMembers, workerId)} on ${date}.`);
      if (notify) setTimeout(() => setEditingJob(updated), 10);
      return updated;
    });
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

  function saveCalendarItem(item) {
    if (item.type === "adHoc" || item.type === "travel") {
      const job = normaliseJob({
        ...emptyJob(), title: item.type === "travel" ? "Travel/accommodation comments" : (item.text.split("\n")[0] || "Ad hoc task"),
        notes: item.text, category: "Scheduled", assignedTo: [item.workerId], startDate: item.startDate, endDate: item.endDate,
        clientAccepted: true, isAdHoc: item.type === "adHoc", isTravelComment: item.type === "travel"
      });
      updateData({ ...data, jobs: [logJob(job, "Created", item.type === "travel" ? "Travel/accommodation comment added." : "Ad hoc job added."), ...data.jobs] });
    } else if (item.type === "leave") {
      const leave = { id: createId(), workerId: item.workerId, leaveType: item.leaveType, startDate: item.startDate, endDate: item.endDate, notes: item.notes || "" };
      updateData({ ...data, leaveRecords: [leave, ...data.leaveRecords] });
    }
    setCalendarPopup(null);
  }

  function saveWorkers(workers) { updateData({ ...data, teamMembers: workers }); }

  function sendDemoMessage(job) {
    const message = { id: createId(), jobId: job.id, direction: "out", from: CURRENT_USER, text: buildSmsMessage(job), date: new Date().toISOString(), unread: false };
    const reply = { id: createId(), jobId: job.id, direction: "in", from: job.clientContact || "Client", text: "Demo reply: Confirmed, thank you.", date: new Date(Date.now()+1000).toISOString(), unread: true };
    updateData({ ...data, messages: [reply, message, ...data.messages], jobs: data.jobs.map(j => j.id === job.id ? logJob({ ...j, appointmentSent: true }, "Message sent", "Demo SMS generated.") : j) });
    return true;
  }

  function markMessageRead(message) {
    const job = data.jobs.find(j => j.id === message.jobId);
    const confirmBooking = message.direction === "in" && job && !job.clientAccepted ? confirm("Mark this booking as client accepted?") : false;
    updateData({
      ...data,
      messages: data.messages.map(m => m.id === message.id ? { ...m, unread: false } : m),
      jobs: confirmBooking ? data.jobs.map(j => j.id === message.jobId ? logJob({ ...j, clientAccepted: true }, "Client accepted", "Booking confirmed from message inbox.") : j) : data.jobs
    });
  }

  function updateWorkerJobStatus(jobId, workerId, nextStatus) {
    updateJobs(job => {
      if (job.id !== jobId) return job;
      const now = Date.now();
      const current = job.workerStatus?.[workerId] || { status: "notStarted", totalMs: 0, runningSince: null };
      let totalMs = current.totalMs || 0;
      if (current.status === "running" && current.runningSince) totalMs += now - current.runningSince;
      const runningSince = nextStatus === "running" ? now : null;
      const updatedStatus = { ...job.workerStatus, [workerId]: { status: nextStatus, totalMs, runningSince, updatedAt: new Date().toISOString() } };
      return logJob({ ...job, workerStatus: updatedStatus }, "Employee status", `${getWorkerName(data.teamMembers, workerId)} changed status to ${STATUS_META[nextStatus].label}.`);
    });
  }

  const topButtons = (
    <div className="actions top-menu">
      <button className="secondary" onClick={() => setShareOpen(true)}><Share2 size={16}/> Share schedule</button>
      <button className="secondary" onClick={() => setRunSheetOpen(true)}>Daily run sheet</button>
      <button className="secondary message-menu-button" onClick={() => setMessagesOpen(true)}><Inbox size={16}/> Messages {unreadMessages>0 && <span className="menu-badge">{unreadMessages}</span>}</button>
      <button className="secondary" onClick={() => setSettingsOpen(true)}><Settings size={16}/> Settings</button>
      <button className={view === "admin" ? "primary" : "secondary"} onClick={() => setView("admin")}>Admin</button>
      <button className={view === "employee" ? "primary" : "secondary"} onClick={() => setView("employee")}>Employee</button>
      <button className="primary pdf-drop-button" onClick={() => setEditingJob(emptyJob())} onDragOver={(e)=>{e.preventDefault(); e.dataTransfer.dropEffect="copy";}} onDrop={(e)=>{e.preventDefault(); const file=[...(e.dataTransfer.files||[])].find(f=>f.name.toLowerCase().endsWith(".pdf")); createJobFromPdfFile(file);}}><Plus size={16}/> New job / Drop PDF</button>
    </div>
  );

  return (
    <div className="app">
      <header className="topbar">
        <div><h1>Job Scheduler</h1><p>{view === "admin" ? "Schedule jobs, manage workers, messages and job readiness." : "Employee view: next 2 weeks, job details, notes and time tracking."}</p></div>
        {topButtons}
      </header>

      {view === "admin" ? (
        <>
          <section className="toolbar">
            <div className="search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search title, client, JB, WO, PO, address..."/></div>
            <div className="week-controls"><button className="secondary" onClick={()=>setWeekStart(addDays(weekStart,-7))}><ChevronLeft size={16}/> Previous</button><button className="secondary" onClick={()=>setWeekStart(getStartOfWeek(new Date()))}>This week</button><button className="secondary" onClick={()=>setWeekStart(addDays(weekStart,7))}>Next <ChevronRight size={16}/></button></div>
          </section>
          <NeedsAttentionDashboard jobs={data.jobs} workers={data.teamMembers} days={days} leaveRecords={data.leaveRecords} messages={data.messages} onOpenJob={setEditingJob} />
          <main className="workspace">
            <aside className="bucket-panel">
              <div className="bucket-title"><PanelLeft size={18}/><div><h2>Job buckets</h2><span>{filteredJobs.length} jobs displayed</span></div></div>
              <label>Client filter<select value={clientFilter} onChange={e=>setClientFilter(e.target.value)}><option>All</option>{clientOptions.map(c=><option key={c}>{c}</option>)}</select></label>
              <div className="bucket-button-grid">{["All",...CATEGORIES].map(cat=>{const count=cat==="All"?data.jobs.length:data.jobs.filter(j=>j.category===cat).length;return <button key={cat} className={activeCategory===cat?"active":""} onClick={()=>setActiveCategory(cat)} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault(); const id=getDraggedJobId(e); if(id) moveToBucket(id,cat);}}><span>{cat}</span><em>{count}</em></button>})}</div>
              <div className="selected-bucket-list">{filteredJobs.map(job=><JobCard key={job.id} job={job} workerNames={getAssignedWorkerNames(data.teamMembers, job.assignedTo)} onDragStart={e=>handleDragStart(e,job.id)} onEdit={()=>setEditingJob(job)} onDelete={()=>cancelOrDeleteJob(job)}/>) }{filteredJobs.length===0 && <div className="empty small">No jobs in this bucket</div>}</div>
            </aside>
            <section className="calendar-area">
              <div className="calendar-instructions"><strong>Calendar</strong><span>Use + Item for ad hoc tasks, leave or travel/accommodation comments.</span></div>
              <section className="worker-filters"><label>Trade<select value={tradeFilter} onChange={e=>setTradeFilter(e.target.value)}><option>All</option>{TRADES.map(t=><option key={t}>{t}</option>)}</select></label><label>Base site<select value={siteFilter} onChange={e=>setSiteFilter(e.target.value)}><option>All</option>{BASE_SITES.map(s=><option key={s}>{s}</option>)}</select></label><label className="inline-check"><input type="checkbox" checked={hideUnavailable} onChange={e=>setHideUnavailable(e.target.checked)}/>Hide workers fully unavailable this week</label></section>
              <CalendarGrid days={days} workers={visibleWorkers} jobs={scheduledJobs} leaveRecords={data.leaveRecords} messages={data.messages} onDropJob={scheduleJob} onDragStart={handleDragStart} onAddItem={setCalendarPopup} onEditJob={setEditingJob} onDeleteJob={cancelOrDeleteJob} onExtendJob={extendJob} onToggle={toggleJobCheckbox}/>
            </section>
          </main>
        </>
      ) : (
        <EmployeeView workerId={employeeId} setWorkerId={setEmployeeId} workers={data.teamMembers} days={employeeDays} jobs={scheduledJobs} leaveRecords={data.leaveRecords} onAddNote={(jobId,text)=>updateJobs(job=>job.id===jobId?logJob({...job,noteHistory:[{id:createId(),date:new Date().toISOString(),user:getWorkerName(data.teamMembers, employeeId),text},...(job.noteHistory||[])]},"Note added",`Employee note added by ${getWorkerName(data.teamMembers, employeeId)}.`):job)} onStatus={updateWorkerJobStatus}/>
      )}

      <footer className="footer-actions"><button className="ghost" onClick={()=>{if(confirm("Reset demo data?")){updateData(initialData)}}}><RotateCcw size={15}/> Reset demo data</button></footer>

      {editingJob && <JobModal job={editingJob} teamMembers={data.teamMembers} onClose={()=>setEditingJob(null)} onSave={saveJob} onSendMessage={sendDemoMessage} onViewHistory={(job)=>setJobHistoryJob(job)} />}
      {calendarPopup && <CalendarItemModal context={calendarPopup} onClose={()=>setCalendarPopup(null)} onSave={saveCalendarItem}/>} 
      {settingsOpen && <SettingsModal workers={data.teamMembers} onClose={()=>setSettingsOpen(false)} onSave={(workers)=>{saveWorkers(workers); setSettingsOpen(false)}} />}
      {shareOpen && <ShareScheduleModal data={data} workers={data.teamMembers} onClose={()=>setShareOpen(false)} />}
      {runSheetOpen && <DailyRunSheetModal data={data} workers={data.teamMembers} onClose={()=>setRunSheetOpen(false)} />}
      {messagesOpen && <MessagesModal messages={data.messages} jobs={data.jobs} onClose={()=>setMessagesOpen(false)} onRead={markMessageRead}/>} 
      {jobHistoryJob && <HistoryModal job={jobHistoryJob} onClose={()=>setJobHistoryJob(null)}/>} 
    </div>
  );
}


function NeedsAttentionDashboard({ jobs, workers, days, leaveRecords, messages, onOpenJob }) {
  const activeJobs = jobs.filter(j => j.category !== "Cancelled" && j.category !== "Completed");
  const notReady = activeJobs.filter(j => !getReadiness(j).ready);
  const unread = messages.filter(m => m.unread).length;
  const missingMaterials = activeJobs.filter(j => !["Ready", "Not required"].includes(j.materialsStatus || "Not checked"));
  const unconfirmedScheduled = activeJobs.filter(j => j.category === "Scheduled" && !j.clientAccepted);
  const conflictJobs = activeJobs.filter(job => (job.assignedTo || []).some(workerId => {
    const worker = workers.find(w => w.id === workerId);
    if (!worker || !job.startDate || !job.endDate) return false;
    return getDatesInRange(job.startDate, job.endDate).some(date => getWorkerAvailability(worker, date, leaveRecords).status !== "Onsite");
  }));
  const cards = [
    { label: "Not ready", count: notReady.length, hint: "Missing readiness checks" },
    { label: "Awaiting materials", count: missingMaterials.length, hint: "Materials not ready" },
    { label: "Unconfirmed", count: unconfirmedScheduled.length, hint: "Scheduled but client not accepted" },
    { label: "Roster conflicts", count: conflictJobs.length, hint: "Assigned during RNR/leave" },
    { label: "Unread messages", count: unread, hint: "Messages needing review" }
  ];
  return <section className="attention-dashboard">{cards.map(card=><div key={card.label} className={card.count?"attention-card warning":"attention-card"}><strong>{card.count}</strong><span>{card.label}</span><em>{card.hint}</em></div>)}</section>;
}

function CalendarGrid({ days, workers, jobs, leaveRecords, messages, onDropJob, onDragStart, onAddItem, onEditJob, onDeleteJob, onExtendJob, onToggle }) {
  return <div className="calendar-wrap"><div className="calendar-grid" style={{"--day-count": days.length}}><div className="corner-cell">Workers</div>{days.map(day=><div key={getIsoDate(day)} className={`day-header ${isToday(day)?"today":""}`}><strong>{formatDayName(day)}</strong><span>{formatDateHeader(day)}</span></div>)}{workers.map(worker=><React.Fragment key={worker.id}><div className="worker-cell"><button className="worker-profile-button"><strong>{worker.name}</strong><span>{worker.trade||"No trade"} · {worker.baseSite||"No site"}</span><em>{worker.sapNumber||"No SAP"}</em></button></div>{days.map(day=>{const iso=getIsoDate(day); const availability=getWorkerAvailability(worker, iso, leaveRecords); const dayLeaves=leaveRecords.filter(l=>l.workerId===worker.id && isDateWithinRange(iso,l.startDate,l.endDate)); const cellJobs=jobs.filter(j=>j.assignedTo.includes(worker.id)&&isDateWithinRange(iso,j.startDate,j.endDate)); return <div key={`${worker.id}-${iso}`} className={`calendar-cell ${isToday(day)?"today-cell":""} ${availability.status==="Onsite"?"onsite-cell":"rnr-cell"}`} onDragOver={e=>{e.preventDefault(); e.dataTransfer.dropEffect="move";}} onDrop={e=>{e.preventDefault(); const id=e.dataTransfer.getData("text/plain"); if(id) onDropJob(id, worker.id, iso);}}><div className={`roster-badge ${availability.status==="Onsite"?"onsite":"rnr"}`}>{availability.label}</div><button className="add-cell-job" onClick={()=>onAddItem({workerId:worker.id,workerName:worker.name,date:iso})}><Plus size={14}/> Item</button><div className="cell-jobs">{dayLeaves.map(l=><LeaveCard key={l.id} leave={l} />)}{cellJobs.map(job=><CalendarJob key={`${job.id}-${worker.id}-${iso}`} job={job} workerId={worker.id} isStart={job.startDate===iso} isEnd={job.endDate===iso} hasUnreadMessage={messages.some(m=>m.jobId===job.id && m.unread)} onDragStart={e=>onDragStart(e,job.id)} onEdit={()=>onEditJob(job)} onDelete={()=>onDeleteJob(job)} onExtend={()=>onExtendJob(job.id,iso)} onToggleAppointmentSent={()=>onToggle(job.id,"appointmentSent")} onToggleClientAccepted={()=>onToggle(job.id,"clientAccepted")}/>)}</div></div>})}</React.Fragment>)}</div></div>;
}

function CalendarJob({ job, workerId, isStart, isEnd, hasUnreadMessage, onDragStart, onEdit, onDelete, onExtend, onToggleAppointmentSent, onToggleClientAccepted }) {
  const status = job.workerStatus?.[workerId]?.status || "notStarted";
  const meta = STATUS_META[status] || STATUS_META.notStarted;
  return <article className={`calendar-job ${job.isAdHoc?"ad-hoc":""} ${job.isTravelComment?"travel-comment":""} ${isStart?"range-start":"range-middle"} ${isEnd?"range-end":""}`} draggable onDragStart={onDragStart}><div className="range-body">{hasUnreadMessage&&<span className="job-envelope"><Mail size={13}/></span>}{isStart?<><div className="card-top"><span className="wo">{job.isTravelComment?"Travel":job.isAdHoc?"Ad hoc":job.workOrderNumber||job.jobNumber||"No WO"}</span><span className={`status-dot ${status}`}>{meta.icon}</span><div className="card-actions"><button onClick={onEdit}><Pencil size={14}/></button><button onClick={onDelete}><Trash2 size={14}/></button></div></div><h3>{job.title}</h3>{!job.isAdHoc&&!job.isTravelComment&&<div className="meta">{job.address&&<span>{job.address}</span>}{job.client&&<span>{job.client}</span>}</div>}<p>Total running: {formatDuration(getWorkerTotalMs(job, workerId))}</p>{!job.isAdHoc&&!job.isTravelComment&&<div className="appointment-checks"><label><input type="checkbox" checked={!!job.appointmentSent} onChange={onToggleAppointmentSent}/>SMS sent</label><label><input type="checkbox" checked={!!job.clientAccepted} onChange={onToggleClientAccepted}/>Client accepted</label></div>}</>:<div className="continuation">{job.workOrderNumber||job.title}</div>}<button className="resize-handle" onClick={onExtend}>↔</button></div></article>
}

function LeaveCard({ leave }) { return <article className="leave-card"><span className="leave-pill">{leave.leaveType}</span>{leave.notes&&<p>{leave.notes}</p>}</article>; }
function JobCard({ job, workerNames, onDragStart, onEdit, onDelete }) {
  const readiness = getReadiness(job);
  return (
    <article className="card compact" draggable onDragStart={onDragStart}>
      <div className="card-top">
        <span className="category-pill">{job.category}</span>
        <span className={readiness.ready ? "ready-pill ready" : "ready-pill not-ready"}>{readiness.ready ? "Ready" : "Not ready"}</span>
        <div className="card-actions">
          <button onClick={onEdit}><Pencil size={14}/></button>
          <button onClick={onDelete}><Trash2 size={14}/></button>
        </div>
      </div>
      <h3>{job.title}</h3>
      <div className="details">
        {job.client&&<span><b>Client:</b> {job.client}</span>}
        {job.site&&<span><b>Site:</b> {job.site}</span>}
        {job.requiredTrade&&<span><b>Trade:</b> {job.requiredTrade}</span>}
        {job.materialsStatus&&<span><b>Materials:</b> {job.materialsStatus}</span>}
        {job.jobNumber&&<span><b>JB:</b> {job.jobNumber}</span>}
        {job.workOrderNumber&&<span><b>WO:</b> {job.workOrderNumber}</span>}
        {job.poNumber&&<span><b>PO:</b> {job.poNumber}</span>}
        {workerNames&&<span><b>Workers:</b> {workerNames}</span>}
      </div>
      {!readiness.ready && <p className="readiness-note">Missing: {readiness.missing.join(", ")}</p>}
      {job.category==="Cancelled"&&<p>In Cancelled bucket. Delete again to permanently remove.</p>}
    </article>
  );
}

function JobModal({ job, teamMembers, onClose, onSave, onSendMessage, onViewHistory }) {
  const [form, setForm] = useState(normaliseJob(job));
  const [activeTab, setActiveTab] = useState("details");
  const [noteInput, setNoteInput] = useState("");
  const [materialInput, setMaterialInput] = useState("");
  const [pdfPreview, setPdfPreview] = useState("");
  const tabs = ["details","scheduling","client","notes","materials","attachments","history"];
  function update(field, value){ setForm({...form,[field]:value}); }
  function toggleWorker(id){ const list=form.assignedTo||[]; update("assignedTo", list.includes(id)?list.filter(x=>x!==id):[...list,id]); }
  async function importPdf(file){ if(!file) return; try{const text=await extractTextFromPdf(file); const parsed=parseAimJobSheet(text); setPdfPreview(text.slice(0,2500)); setForm(cur=>normaliseJob({...cur,...parsed})); setActiveTab("details");}catch{alert("The PDF could not be read. It may be scanned/image-based.");}}
  function addNote(){ if(!noteInput.trim()) return; setForm(cur=>({...cur,noteHistory:[{id:createId(),date:new Date().toISOString(),user:CURRENT_USER,text:noteInput.trim()},...(cur.noteHistory||[])]})); setNoteInput(""); }
  function addMaterial(){ if(!materialInput.trim()) return; setForm(cur=>({...cur,materials:[...(cur.materials||[]),{id:createId(),text:materialInput.trim(),status:"Required"}]})); setMaterialInput(""); }
  function addAttachments(files){ const items=[...files].map(f=>({id:createId(),name:f.name,type:f.type||"file",size:f.size,addedAt:new Date().toISOString()})); setForm(cur=>({...cur,attachments:[...(cur.attachments||[]),...items]})); }
  function submit(e){ e.preventDefault(); if(!form.title.trim()){setActiveTab("details"); alert("Please enter a job title."); return;} onSave(form); }
  return <div className="modal-backdrop"><form className="modal job-modal-tabs" onSubmit={submit}><div className="modal-header clean-modal-header"><div><h2>{job.title?"Edit job":"New job"}</h2><p>{form.jobNumber||form.workOrderNumber||form.poNumber||"Job details"}</p></div><button type="button" className="icon" onClick={onClose}><X size={18}/></button></div><div className="job-tab-bar">{tabs.map(t=><button type="button" key={t} className={activeTab===t?"active":""} onClick={()=>setActiveTab(t)}>{labelTab(t)}</button>)}</div>
  {activeTab==="details"&&<section className="job-tab-panel"><div className="pdf-import-box"><label className="pdf-upload"><Upload size={16}/><span>Import AIM job sheet PDF</span><input type="file" accept="application/pdf" onChange={e=>importPdf(e.target.files?.[0])}/></label><small>Reads title, client, address, JB, QUO, WO, PO and scope.</small></div><label>Job title<input value={form.title} onChange={e=>update("title",e.target.value)}/></label><div className="two-col"><label>Client<input value={form.client||""} onChange={e=>update("client",e.target.value)}/></label><label>Address<input value={form.address||""} onChange={e=>update("address",e.target.value)}/></label></div><div className="two-col"><label>Site / area<select value={form.site||""} onChange={e=>update("site",e.target.value)}><option value="">Not set</option>{JOB_SITES.map(site=><option key={site}>{site}</option>)}</select></label><label>Required trade<select value={form.requiredTrade||""} onChange={e=>update("requiredTrade",e.target.value)}><option value="">Not set</option>{TRADES.map(t=><option key={t}>{t}</option>)}</select></label></div><div className="two-col"><label>Job number<input value={form.jobNumber||""} onChange={e=>update("jobNumber",e.target.value)}/></label><label>Quote number<input value={form.quoteNumber||""} onChange={e=>update("quoteNumber",e.target.value)}/></label></div><div className="two-col"><label>Work order number<input value={form.workOrderNumber||""} onChange={e=>update("workOrderNumber",e.target.value)}/></label><label>PO number<input value={form.poNumber||""} onChange={e=>update("poNumber",e.target.value)}/></label></div>{pdfPreview&&<details className="pdf-preview"><summary>PDF text preview</summary><pre>{pdfPreview}</pre></details>}</section>}
  {activeTab==="scheduling"&&<section className="job-tab-panel">
    <div className="readiness-panel">
      {(() => { const r = getReadiness(form); return <><strong>{r.ready ? "Ready to schedule" : "Not ready to schedule"}</strong><span>{r.ready ? "All key checks are complete." : `Missing: ${r.missing.join(", ")}`}</span></>; })()}
    </div>
    <div className="two-col"><label>Category<select value={form.category} onChange={e=>update("category",e.target.value)}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></label><label>Site / area<select value={form.site||""} onChange={e=>update("site",e.target.value)}><option value="">Not set</option>{JOB_SITES.map(site=><option key={site}>{site}</option>)}</select></label></div>
    <div className="two-col"><label>Required trade<select value={form.requiredTrade||""} onChange={e=>update("requiredTrade",e.target.value)}><option value="">Not set</option>{TRADES.map(t=><option key={t}>{t}</option>)}</select></label><label>Materials status<select value={form.materialsStatus||"Not checked"} onChange={e=>update("materialsStatus",e.target.value)}>{MATERIAL_STATUSES.map(m=><option key={m}>{m}</option>)}</select></label></div>
    <div className="two-col"><label>Start date<input type="date" value={form.startDate||""} onChange={e=>update("startDate",e.target.value)}/></label><label>End date<input type="date" value={form.endDate||""} onChange={e=>update("endDate",e.target.value)}/></label></div>
    <div className="worker-picker"><strong>Assigned workers</strong><div className="worker-options">{teamMembers.map(m=><label key={m.id} className="check-option"><input type="checkbox" checked={form.assignedTo.includes(m.id)} onChange={()=>toggleWorker(m.id)}/>{m.name}</label>)}</div></div>
  </section>}
  {activeTab==="client"&&<section className="job-tab-panel"><div className="two-col"><label>Client contact<input value={form.clientContact||""} onChange={e=>update("clientContact",e.target.value)}/></label><label>Client phone<input value={form.clientPhone||""} onChange={e=>update("clientPhone",e.target.value)}/></label></div><div className="appointment-panel"><label className="check-option plain"><input type="checkbox" checked={!!form.appointmentSent} onChange={e=>update("appointmentSent",e.target.checked)}/>Appointment SMS sent</label><label className="check-option plain"><input type="checkbox" checked={!!form.clientAccepted} onChange={e=>update("clientAccepted",e.target.checked)}/>Client accepted appointment</label><button type="button" className="secondary" onClick={()=>{if(onSendMessage(form)) update("appointmentSent",true)}}><MessageSquare size={16}/> Send demo message</button><a className="secondary" href={form.clientPhone?`tel:${form.clientPhone}`:undefined} onClick={(e)=>{if(!form.clientPhone){e.preventDefault(); alert("Enter a client phone number first.")}}}><Phone size={16}/> Call client</a></div></section>}
  {activeTab==="notes"&&<section className="job-tab-panel"><label>Job description / scope<textarea rows="6" value={form.notes||""} onChange={e=>update("notes",e.target.value)}/></label><div className="note-entry"><textarea rows="3" value={noteInput} onChange={e=>setNoteInput(e.target.value)} placeholder="Add note history entry..."/><button type="button" className="secondary" onClick={addNote}>Add note</button></div><HistoryList items={form.noteHistory||[]} type="notes"/></section>}
  {activeTab==="materials"&&<section className="job-tab-panel"><label>Materials status<select value={form.materialsStatus||"Not checked"} onChange={e=>update("materialsStatus",e.target.value)}>{MATERIAL_STATUSES.map(m=><option key={m}>{m}</option>)}</select></label><div className="note-entry"><input value={materialInput} onChange={e=>setMaterialInput(e.target.value)} placeholder="Add material item..."/><button type="button" className="secondary" onClick={addMaterial}><Package size={16}/> Add material</button></div><div className="simple-list">{(form.materials||[]).map(item=><div key={item.id}><span>{item.text}</span><button type="button" onClick={()=>setForm(cur=>({...cur,materials:cur.materials.filter(x=>x.id!==item.id)}))}><X size={14}/></button></div>)}{!(form.materials||[]).length&&<p>No materials added.</p>}</div></section>}
  {activeTab==="attachments"&&<section className="job-tab-panel"><div className="attachment-drop" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault(); addAttachments(e.dataTransfer.files||[]);}}><Paperclip size={24}/><strong>Drag files or photos here</strong><span>GitHub demo stores file names/details only. Backend version can store actual files.</span><label className="secondary file-pick">Choose files<input type="file" multiple onChange={e=>addAttachments(e.target.files||[])}/></label></div><div className="simple-list">{(form.attachments||[]).map(a=><div key={a.id}><span>{a.name} · {formatBytes(a.size)}</span><button type="button" onClick={()=>setForm(cur=>({...cur,attachments:cur.attachments.filter(x=>x.id!==a.id)}))}><X size={14}/></button></div>)}</div></section>}
  {activeTab==="history"&&<section className="job-tab-panel"><button type="button" className="secondary" onClick={()=>onViewHistory(form)}><History size={16}/> View job history</button><HistoryList items={form.jobHistory||[]} type="history"/></section>}
  <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button type="submit" className="primary">Save job</button></div></form></div>
}

function CalendarItemModal({ context, onClose, onSave }) { const [mode,setMode]=useState(""); const [text,setText]=useState(""); const [leaveType,setLeaveType]=useState("Sick leave"); const [startDate,setStartDate]=useState(context.date); const [endDate,setEndDate]=useState(context.date); function submit(e){e.preventDefault(); if(!mode){alert("Choose an item type."); return;} if(compareIsoDates(endDate,startDate)<0){alert("End date cannot be before start date."); return;} if(mode==="leave") onSave({type:"leave",workerId:context.workerId,leaveType,startDate,endDate,notes:text}); else onSave({type:mode,workerId:context.workerId,text,startDate,endDate});} return <div className="modal-backdrop"><form className="modal mini-modal" onSubmit={submit}><div className="modal-header"><h2>Add calendar item</h2><button type="button" className="icon" onClick={onClose}><X size={18}/></button></div><p className="modal-note">{context.workerName} · {formatIsoForDisplay(context.date)}</p><div className="choice-grid"><button type="button" className={mode==="adHoc"?"choice-card active":"choice-card"} onClick={()=>setMode("adHoc")}><Wrench/><strong>Ad hoc job</strong><span>Simple non-PO task.</span></button><button type="button" className={mode==="leave"?"choice-card active":"choice-card"} onClick={()=>setMode("leave")}><CalendarX/><strong>Leave</strong><span>Sick, annual or other leave.</span></button><button type="button" className={mode==="travel"?"choice-card active":"choice-card"} onClick={()=>setMode("travel")}><Plane/><strong>Travel/accommodation</strong><span>Comments visible on the calendar.</span></button></div>{mode&&<><div className="two-col"><label>Start date<input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/></label><label>End date<input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)}/></label></div>{mode==="leave"&&<label>Leave type<select value={leaveType} onChange={e=>setLeaveType(e.target.value)}>{LEAVE_TYPES.map(t=><option key={t}>{t}</option>)}</select></label>}<label>{mode==="leave"?"Notes":"Details"}<textarea rows="4" value={text} onChange={e=>setText(e.target.value)}/></label></>}<div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button type="submit" className="primary">Save item</button></div></form></div> }

function SettingsModal({ workers, onClose, onSave }) { const [items,setItems]=useState(workers); function update(id,field,value){setItems(items.map(w=>w.id===id?{...w,[field]:value}:w));} function add(){setItems([...items,{id:"worker-"+createId(),name:"",trade:"",baseSite:"",phone:"",email:"",birthday:"",sapNumber:"",rosterPattern:"NONE",rosterStartDate:""}]);} return <div className="modal-backdrop"><div className="modal settings-modal"><div className="modal-header"><h2>Settings - employees</h2><button className="icon" onClick={onClose}><X size={18}/></button></div><button className="secondary" onClick={add}><Users size={16}/> Add employee</button><div className="settings-list">{items.map(w=><section key={w.id} className="worker-editor"><div className="two-col"><label>Name<input value={w.name} onChange={e=>update(w.id,"name",e.target.value)}/></label><label>Trade<select value={w.trade||""} onChange={e=>update(w.id,"trade",e.target.value)}><option value="">Select</option>{TRADES.map(t=><option key={t}>{t}</option>)}</select></label></div><div className="two-col"><label>Phone<input value={w.phone||""} onChange={e=>update(w.id,"phone",e.target.value)}/></label><label>Email<input value={w.email||""} onChange={e=>update(w.id,"email",e.target.value)}/></label></div><div className="two-col"><label>Birthday<input type="date" value={w.birthday||""} onChange={e=>update(w.id,"birthday",e.target.value)}/></label><label>SAP number<input value={w.sapNumber||""} onChange={e=>update(w.id,"sapNumber",e.target.value)}/></label></div><div className="two-col"><label>Base site<select value={w.baseSite||""} onChange={e=>update(w.id,"baseSite",e.target.value)}><option value="">Select</option>{BASE_SITES.map(s=><option key={s}>{s}</option>)}</select></label><label>Roster<select value={w.rosterPattern||"NONE"} onChange={e=>update(w.id,"rosterPattern",e.target.value)}>{ROSTER_PATTERNS.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}</select></label></div><label>Roster start date<input type="date" value={w.rosterStartDate||""} onChange={e=>update(w.id,"rosterStartDate",e.target.value)}/></label><button className="ghost danger" onClick={()=>setItems(items.filter(x=>x.id!==w.id))}>Remove employee</button></section>)}</div><div className="modal-actions"><button className="secondary" onClick={onClose}>Cancel</button><button className="primary" onClick={()=>onSave(items)}>Save settings</button></div></div></div> }


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

function MessagesModal({ messages, jobs, onClose, onRead }) { return <div className="modal-backdrop"><div className="modal"><div className="modal-header"><h2>Messages</h2><button className="icon" onClick={onClose}><X size={18}/></button></div><div className="message-list">{messages.map(m=>{const job=jobs.find(j=>j.id===m.jobId);return <article key={m.id} className={m.unread?"message-card unread":"message-card"}><div><strong>{m.direction==="in"?"Received":"Sent"}: {m.from}</strong><span>{formatDateTime(m.date)}</span></div><p>{m.text}</p>{job&&<em>Linked job: {job.title}</em>}{m.unread&&<button className="secondary" onClick={()=>onRead(m)}>Mark read</button>}</article>})}{!messages.length&&<div className="empty">No demo messages yet.</div>}</div></div></div> }
function HistoryModal({ job, onClose }) { return <div className="modal-backdrop"><div className="modal mini-modal"><div className="modal-header"><h2>Job history</h2><button className="icon" onClick={onClose}><X size={18}/></button></div><HistoryList items={job.jobHistory||[]} type="history"/></div></div> }
function HistoryList({ items }) { return <div className="history-list">{items.map(i=><div key={i.id}><strong>{i.action||i.user}</strong><span>{formatDateTime(i.date)} · {i.user}</span><p>{i.details||i.text}</p></div>)}{!items.length&&<p>No entries yet.</p>}</div> }

function EmployeeView({ workerId, setWorkerId, workers, days, jobs, leaveRecords, onAddNote, onStatus }) {
  const [noteFor,setNoteFor]=useState(null);
  const [noteText,setNoteText]=useState("");
  const [range,setRange]=useState("today");
  const worker=workers.find(w=>w.id===workerId)||workers[0];
  const startIso=getIsoDate(days[0]);
  const endIso=getIsoDate(days[days.length-1]);
  const visible=jobs.filter(j=>j.assignedTo.includes(worker?.id||"") && getDatesInRange(startIso,endIso).some(d=>isDateWithinRange(d,j.startDate,j.endDate)));
  const displayDays = range === "today" ? days.slice(0,1) : range === "tomorrow" ? days.slice(1,2) : days;
  return <main className="employee-view"><section className="employee-header-card"><div><h2>Employee view</h2><p>Mobile-first run sheet for the next 2 weeks.</p></div><label>View as<select value={worker?.id||""} onChange={e=>setWorkerId(e.target.value)}>{workers.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label></section><div className="employee-range-tabs"><button className={range==="today"?"active":""} onClick={()=>setRange("today")}>Today</button><button className={range==="tomorrow"?"active":""} onClick={()=>setRange("tomorrow")}>Tomorrow</button><button className={range==="fortnight"?"active":""} onClick={()=>setRange("fortnight")}>Next 2 weeks</button></div><section className="employee-list">{displayDays.map(day=>{const iso=getIsoDate(day); const availability=getWorkerAvailability(worker,iso,leaveRecords); const dayJobs=visible.filter(j=>isDateWithinRange(iso,j.startDate,j.endDate)); return <div key={iso} className="employee-day"><h3>{formatIsoForDisplay(iso)} <span className={`roster-badge ${availability.status==="Onsite"?"onsite":"rnr"}`}>{availability.label}</span></h3>{dayJobs.map(job=>{const status=job.workerStatus?.[worker.id]?.status||"notStarted"; return <article key={job.id} className="employee-job-card"><div className="card-top"><span className="wo">{job.workOrderNumber||job.jobNumber||"Job"}</span><span className={`status-dot ${status}`}>{STATUS_META[status].icon} {STATUS_META[status].label}</span></div><h4>{job.title}</h4><p>{job.address}</p><div className="employee-quick-info"><span>{job.site||"No site"}</span><span>{job.requiredTrade||"No trade set"}</span><span>Materials: {job.materialsStatus||"Not checked"}</span></div><details><summary>Job description</summary><pre>{job.notes}</pre></details><details><summary>Materials list</summary>{(job.materials||[]).map(m=><p key={m.id}>• {m.text}</p>)}{!(job.materials||[]).length&&<p>No materials listed.</p>}</details><div className="employee-actions"><a className="secondary" href={job.clientPhone?`tel:${job.clientPhone}`:undefined} onClick={(e)=>{if(!job.clientPhone){e.preventDefault(); alert("No client phone number saved.")}}}><Phone size={16}/> Call client</a><button className="secondary" onClick={()=>onStatus(job.id,worker.id,"running")}><Play size={16}/> Start</button><button className="secondary" onClick={()=>onStatus(job.id,worker.id,"paused")}><Pause size={16}/> Pause</button><button className="secondary" onClick={()=>onStatus(job.id,worker.id,"stopped")}><Square size={16}/> Stop</button><button className="secondary" onClick={()=>onStatus(job.id,worker.id,"completed")}><CheckCircle2 size={16}/> Complete</button></div><p><Clock size={14}/> Total running time: {formatDuration(getWorkerTotalMs(job, worker.id))}</p><button className="ghost" onClick={()=>setNoteFor(job.id)}>Add note</button>{noteFor===job.id&&<div className="note-entry"><textarea rows="3" value={noteText} onChange={e=>setNoteText(e.target.value)} placeholder="Add note..."/><button className="primary" onClick={()=>{onAddNote(job.id,noteText); setNoteText(""); setNoteFor(null);}}>Save note</button></div>}</article>})}{!dayJobs.length&&<p className="muted">No jobs scheduled.</p>}</div>})}</section></main> }

function emptyJob(){ return normaliseJob({id:createId(),title:"",client:"",site:"",requiredTrade:"",materialsStatus:"Not checked",jobNumber:"",quoteNumber:"",workOrderNumber:"",poNumber:"",address:"",clientContact:"",clientPhone:"",category:"To be scheduled",assignedTo:[],startDate:"",endDate:"",notes:"",materials:[],attachments:[],noteHistory:[],jobHistory:[],workerStatus:{}}); }
function normaliseJob(job){ return {client:"",site:"",requiredTrade:"",materialsStatus:"Not checked",jobNumber:"",quoteNumber:"",workOrderNumber:"",poNumber:"",clientPhone:"",appointmentSent:false,clientAccepted:false,isAdHoc:false,isTravelComment:false,materials:[],attachments:[],noteHistory:[],jobHistory:[],workerStatus:{},...job,assignedTo:Array.isArray(job.assignedTo)?job.assignedTo:[],endDate:job.endDate||job.startDate||""}; }
function createId(){ return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function loadData(){ try{const saved=localStorage.getItem(STORAGE_KEY); if(!saved) return initialData; const parsed=JSON.parse(saved); return {...initialData,...parsed,teamMembers:(parsed.teamMembers||[]).map(w=>({birthday:"",sapNumber:w.employeeNumber||"",...w})),jobs:(parsed.jobs||[]).map(normaliseJob),leaveRecords:parsed.leaveRecords||[],messages:parsed.messages||[]};}catch{return initialData;} }
function saveData(data){ localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
async function extractTextFromPdf(file){ const buffer=await file.arrayBuffer(); const pdf=await pdfjsLib.getDocument({data:buffer}).promise; const pages=[]; for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i); const content=await page.getTextContent(); pages.push(content.items.map(item=>item.str).join("\n"));} return pages.join("\n\n"); }
function parseAimJobSheet(text){ const compact=text.replace(/\r/g,"\n").replace(/[ \t]+/g," ").replace(/\n+/g,"\n").trim(); const client=extractClient(compact); const address=cleanMultiline(extractBetween(compact,"Job Address","Reference")); const reference=cleanMultiline(extractBetween(compact,"Reference","Job Number")).replace(/, /g," "); const jobNumber=normaliseCode(matchFirst(compact,/Job Number\s+([A-Z]{1,4}\d{3,})/i)||matchFirst(compact,/\b(JB\s*\d{3,})\b/i)); const quoteNumber=normaliseCode(matchFirst(compact,/\b(QUO\s*\d+)\b/i)); const workOrderNumber=normaliseCode(matchFirst(compact,/\b(WO\s*\d+)\b/i)||matchFirst(compact,/\b(WO\d+)\b/i)); const poNumber=normaliseCode(matchFirst(compact,/\b(PO\s*[A-Z]?\d+)\b/i)); return {title:reference,address,client,clientContact:client,site:guessSiteFromText(address),jobNumber,quoteNumber,workOrderNumber,poNumber,notes:extractScope(compact)}; }
function extractClient(text){ const start=text.indexOf("Job Sheet"); const end=text.indexOf("Job Address"); if(start===-1||end===-1) return ""; return cleanMultiline(text.slice(start,end).replace(/Job Sheet/i,"").replace(/\d{1,2}\s+\w+\s+\d{4}/g,"")); }
function extractScope(text){ const m=text.match(/Job Number\s+[A-Z]{1,4}\d{3,}/i); const notes=text.toLowerCase().indexOf("notes"); if(!m||notes===-1) return ""; return text.slice(m.index+m[0].length,notes).split("\n").map(l=>l.trim()).filter(Boolean).join("\n"); }
function extractBetween(text,startLabel,endLabel){ const s=text.toLowerCase().indexOf(startLabel.toLowerCase()); if(s===-1)return""; const rest=text.slice(s+startLabel.length); const e=rest.toLowerCase().indexOf(endLabel.toLowerCase()); return (e===-1?rest:rest.slice(0,e)).trim(); }
function cleanMultiline(v){ return String(v||"").split("\n").map(l=>l.trim()).filter(Boolean).join(", ").trim(); }
function matchFirst(text,regex){ const m=text.match(regex); return m?m[1]:""; }
function normaliseCode(v){ return String(v||"").replace(/\s+/g," ").trim().toUpperCase(); }
function addDays(date,amount){ const d=new Date(date); d.setDate(d.getDate()+amount); return d; }
function getStartOfWeek(date){ const d=new Date(date); const day=d.getDay(); d.setDate(d.getDate()+(day===0?-6:1-day)); d.setHours(0,0,0,0); return d; }
function getIsoDate(date){ const d=new Date(date); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function getDatesInRange(start,end){ const out=[]; let d=new Date(start+"T00:00:00"); const e=new Date(end+"T00:00:00"); while(d<=e){out.push(getIsoDate(d)); d=addDays(d,1);} return out; }
function daysBetween(start,target){ return Math.floor((new Date(target+"T00:00:00")-new Date(start+"T00:00:00"))/(24*60*60*1000)); }
function getRosterStatus(worker,iso){ if(!worker?.rosterPattern||worker.rosterPattern==="NONE"||!worker.rosterStartDate) return "Onsite"; const p=ROSTER_PATTERNS.find(x=>x.id===worker.rosterPattern); if(!p?.onDays||!p?.offDays) return "Onsite"; const diff=daysBetween(worker.rosterStartDate,iso); const day=((diff%(p.onDays+p.offDays))+(p.onDays+p.offDays))%(p.onDays+p.offDays); return day<p.onDays?"Onsite":"RNR"; }
function getWorkerAvailability(worker,iso,leaveRecords){ const leave=leaveRecords.find(l=>l.workerId===worker?.id&&isDateWithinRange(iso,l.startDate,l.endDate)); if(leave)return{status:"Leave",label:leave.leaveType}; const r=getRosterStatus(worker,iso); return{status:r,label:r}; }

function getReadiness(job) {
  if (job.category === "Cancelled" || job.category === "Completed") return { ready: true, missing: [] };
  if (job.isAdHoc || job.isTravelComment) return { ready: true, missing: [] };
  const missing = [];
  if (!job.poNumber) missing.push("PO number");
  if (!job.clientAccepted) missing.push("client acceptance");
  if (!job.requiredTrade) missing.push("required trade");
  if (!job.site) missing.push("site/area");
  if (!["Ready", "Not required"].includes(job.materialsStatus || "Not checked")) missing.push("materials ready");
  return { ready: missing.length === 0, missing };
}

function findSchedulingConflicts(job, worker, date, jobs, leaveRecords) {
  const conflicts = [];
  const availability = getWorkerAvailability(worker, date, leaveRecords);
  if (availability.status !== "Onsite") conflicts.push(`${worker.name} is ${availability.label} on ${date}`);
  if (job.requiredTrade && worker.trade && job.requiredTrade !== worker.trade) conflicts.push(`Job requires ${job.requiredTrade}, but ${worker.name} is ${worker.trade}`);
  if (!job.clientAccepted && !job.isAdHoc && !job.isTravelComment) conflicts.push("Client appointment has not been accepted");
  if (!["Ready", "Not required"].includes(job.materialsStatus || "Not checked") && !job.isAdHoc && !job.isTravelComment) conflicts.push(`Materials status is ${job.materialsStatus || "Not checked"}`);
  const clash = jobs.find(other => other.id !== job.id && other.category !== "Cancelled" && other.assignedTo?.includes(worker.id) && isDateWithinRange(date, other.startDate, other.endDate));
  if (clash) conflicts.push(`${worker.name} already has another job scheduled that day: ${clash.title}`);
  return conflicts;
}

function guessSiteFromText(value) {
  const lower = String(value || "").toLowerCase();
  return JOB_SITES.find(site => lower.includes(site.toLowerCase())) || "";
}

function buildSmsMessage(job){ return `Hi ${job.clientContact||""}, this is to confirm your appointment for ${job.title||"your job"} at ${job.address||"your property"} on ${job.startDate||"the scheduled date"}. Please reply to confirm.`; }
function buildScheduleRows({startDate,endDate,workers,jobs,leaveRecords}){ const rows=[]; for(const date of getDatesInRange(startDate,endDate)){for(const w of workers){const a=getWorkerAvailability(w,date,leaveRecords); const js=jobs.filter(j=>j.assignedTo?.includes(w.id)&&isDateWithinRange(date,j.startDate,j.endDate)); if(!js.length) rows.push({Date:date,Worker:w.name,Status:a.label,Title:"",Address:""}); js.forEach(j=>rows.push({Date:date,Worker:w.name,Status:a.label,Title:j.title,Address:j.address,Site:j.site,Trade:j.requiredTrade,Materials:j.materialsStatus,WO:j.workOrderNumber,PO:j.poNumber}));}} return rows; }
function getWorkerName(workers,id){ return workers.find(w=>w.id===id)?.name||id; }
function getAssignedWorkerNames(workers,ids=[]){ return ids.map(id=>getWorkerName(workers,id)).join(", "); }
function getWorkerTotalMs(job,workerId){ const s=job.workerStatus?.[workerId]; if(!s) return 0; let total=s.totalMs||0; if(s.status==="running"&&s.runningSince) total+=Date.now()-s.runningSince; return total; }
function formatDuration(ms){ const mins=Math.floor(ms/60000); const h=Math.floor(mins/60); const m=mins%60; return h?`${h}h ${m}m`:`${m}m`; }
function formatBytes(bytes=0){ if(bytes<1024)return `${bytes} B`; if(bytes<1024*1024)return `${Math.round(bytes/1024)} KB`; return `${(bytes/1024/1024).toFixed(1)} MB`; }
function isDateWithinRange(date,start,end){ return !!start&&!!end&&date.localeCompare(start)>=0&&date.localeCompare(end)<=0; }
function compareIsoDates(a,b){ return a.localeCompare(b); }
function isToday(date){ return getIsoDate(date)===getIsoDate(new Date()); }
function formatDayName(date){ return new Intl.DateTimeFormat("en-AU",{weekday:"short"}).format(date); }
function formatDateHeader(date){ return new Intl.DateTimeFormat("en-AU",{day:"2-digit",month:"short"}).format(date); }
function formatIsoForDisplay(iso){ return new Intl.DateTimeFormat("en-AU",{weekday:"short",day:"2-digit",month:"short",year:"numeric"}).format(new Date(iso+"T00:00:00")); }
function formatDateTime(iso){ return new Intl.DateTimeFormat("en-AU",{dateStyle:"short",timeStyle:"short"}).format(new Date(iso)); }
function labelTab(t){ return ({details:"Details",scheduling:"Scheduling",client:"Client / SMS",notes:"Notes",materials:"Materials",attachments:"Attachments",history:"History"})[t]||t; }

createRoot(document.getElementById("root")).render(<App />);
