
import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Plus, Search, Trash2, Pencil, X, Users, ChevronLeft, ChevronRight,
  PanelLeft, Phone, Mail, MessageSquare, Inbox, Share2, Upload,
  Play, Square, Clock, Paperclip, Package, History, CheckCircle2, UserCog,
  AlertCircle, CalendarX, Plane, Wrench, RotateCcw
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import * as XLSX from "xlsx";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "./styles.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const STORAGE_KEY = "jobsched-v11-clean-employee-photos";
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
  running: { label: "Onsite", icon: "▶" },
  paused: { label: "Paused", icon: "Ⅱ" },
  stopped: { label: "Offsite", icon: "■" },
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
  const [adminTab, setAdminTab] = useState("schedule");
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
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [shareHubOpen, setShareHubOpen] = useState(false);
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

  function markMessageActioned(message) {
    const job = data.jobs.find(j => j.id === message.jobId);
    const confirmBooking = message.direction === "in" && job && !job.clientAccepted
      ? confirm("Do you want to confirm this booking from the message?")
      : false;
    const actionText = `Message actioned by ${CURRENT_USER} on ${formatDateTime(new Date().toISOString())}.`;

    updateData({
      ...data,
      messages: data.messages.map(m =>
        m.id === message.id
          ? { ...m, unread: false, actioned: true, actionedBy: CURRENT_USER, actionedAt: new Date().toISOString() }
          : m
      ),
      jobs: data.jobs.map(j => {
        if (j.id !== message.jobId) return j;
        const note = { id: createId(), date: new Date().toISOString(), user: CURRENT_USER, text: actionText };
        return logJob(
          { ...j, clientAccepted: confirmBooking ? true : j.clientAccepted, noteHistory: [note, ...(j.noteHistory || [])] },
          "Message actioned",
          confirmBooking ? "Message actioned and booking confirmed." : "Message actioned from inbox."
        );
      })
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

  function confirmJobComplete(jobId) {
    updateJobs(job => {
      if (job.id !== jobId) return job;
      return logJob({ ...job, category: "Completed" }, "Completed", "Supervisor confirmed job complete from calendar.");
    });
  }

  function addEmployeeAttachments(jobId, workerId, files) {
    const fileList = [...(files || [])];
    if (!fileList.length) return;

    updateJobs(job => {
      if (job.id !== jobId) return job;

      const newAttachments = fileList.map(file => ({
        id: createId(),
        name: file.name,
        type: file.type || "file",
        size: file.size,
        addedAt: new Date().toISOString(),
        addedBy: getWorkerName(data.teamMembers, workerId),
        source: "employee-photo-demo"
      }));

      return logJob(
        { ...job, attachments: [...(job.attachments || []), ...newAttachments] },
        "Photos added",
        `${getWorkerName(data.teamMembers, workerId)} added ${newAttachments.length} photo/file attachment(s).`
      );
    });
  }

  function saveEmployeeCompletion(jobId, workerId, completion) {
    updateData({
      ...data,
      jobs: data.jobs.map(job => {
        if (job.id !== jobId) return job;

        const workerName = getWorkerName(data.teamMembers, workerId);
        const workerCompletions = {
          ...(job.workerCompletions || {}),
          [workerId]: {
            ...(job.workerCompletions?.[workerId] || {}),
            ...completion,
            updatedAt: new Date().toISOString(),
            updatedBy: workerName
          }
        };

        return logJob(
          { ...job, workerCompletions },
          "Completion update",
          completion.requiresAnotherTrade
            ? `${workerName} added completion notes and requested follow-up attendance from another trade.`
            : `${workerName} added completion notes.`
        );
      }),
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
  }

  const topButtons = (
    <div className="actions top-menu">
      <button className={view === "admin" ? "primary" : "secondary"} onClick={() => setView("admin")}>Admin</button>
      <button className={view === "employee" ? "primary" : "secondary"} onClick={() => setView("employee")}>Employee</button>
    </div>
  );

  return (
    <div className={view === "admin" ? "app admin-mode" : "app"}>
      {view === "admin" && <SideNav unreadMessages={unreadMessages} onShare={() => setShareHubOpen(true)} onMessages={() => setMessagesOpen(true)} onPeople={() => setPeopleOpen(true)} />}
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
          <section className="admin-view-tabs">
            <button className={adminTab === "schedule" ? "active" : ""} onClick={() => setAdminTab("schedule")}>Schedule view</button>
            <button className={adminTab === "attention" ? "active" : ""} onClick={() => setAdminTab("attention")}>Needs attention</button>
          </section>
          {adminTab === "attention" ? (
            <NeedsAttentionView jobs={data.jobs} workers={data.teamMembers} days={days} leaveRecords={data.leaveRecords} messages={data.messages} onOpenJob={setEditingJob} />
          ) : (
          <main className="workspace">
            <aside className="bucket-panel">
              <div className="bucket-title"><PanelLeft size={18}/><div><h2>Job buckets</h2><span>{filteredJobs.length} jobs displayed</span></div></div>
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
              <div className="bucket-button-grid">{["All",...CATEGORIES].map(cat=>{const count=cat==="All"?data.jobs.length:data.jobs.filter(j=>j.category===cat).length;return <button key={cat} className={activeCategory===cat?"active":""} onClick={()=>setActiveCategory(cat)} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault(); const id=getDraggedJobId(e); if(id) moveToBucket(id,cat);}}><span>{cat}</span><em>{count}</em></button>})}</div>
              <div className="selected-bucket-list">{filteredJobs.map(job=><JobCard key={job.id} job={job} workerNames={getAssignedWorkerNames(data.teamMembers, job.assignedTo)} onDragStart={e=>handleDragStart(e,job.id)} onEdit={()=>setEditingJob(job)} onDelete={()=>cancelOrDeleteJob(job)}/>) }{filteredJobs.length===0 && <div className="empty small">No jobs in this bucket</div>}</div>
            </aside>
            <section className="calendar-area">
              <section className="worker-filters"><label>Trade<select value={tradeFilter} onChange={e=>setTradeFilter(e.target.value)}><option>All</option>{TRADES.map(t=><option key={t}>{t}</option>)}</select></label><label>Base site<select value={siteFilter} onChange={e=>setSiteFilter(e.target.value)}><option>All</option>{BASE_SITES.map(s=><option key={s}>{s}</option>)}</select></label><label className="inline-check"><input type="checkbox" checked={hideUnavailable} onChange={e=>setHideUnavailable(e.target.checked)}/>Hide workers fully unavailable this week</label></section>
              <CalendarGrid days={days} workers={visibleWorkers} jobs={scheduledJobs} leaveRecords={data.leaveRecords} messages={data.messages} onDropJob={scheduleJob} onDragStart={handleDragStart} onAddItem={setCalendarPopup} onEditJob={setEditingJob} onDeleteJob={cancelOrDeleteJob} onExtendJob={extendJob} onToggle={toggleJobCheckbox} onConfirmComplete={confirmJobComplete}/>
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
          onAddNote={(jobId,text)=>updateJobs(job=>job.id===jobId?logJob({...job,noteHistory:[{id:createId(),date:new Date().toISOString(),user:getWorkerName(data.teamMembers, employeeId),text},...(job.noteHistory||[])]},"Note added",`Employee note added by ${getWorkerName(data.teamMembers, employeeId)}.`):job)}
          onStatus={updateWorkerJobStatus}
          onAddAttachment={addEmployeeAttachments}
          onCompletion={saveEmployeeCompletion}
        />
      )}

      <footer className="footer-actions"><button className="ghost" onClick={()=>{if(confirm("Reset demo data?")){updateData(initialData)}}}><RotateCcw size={15}/> Reset demo data</button></footer>

      {editingJob && <JobModal job={editingJob} teamMembers={data.teamMembers} onClose={()=>setEditingJob(null)} onSave={saveJob} onSendMessage={sendDemoMessage} onViewHistory={(job)=>setJobHistoryJob(job)} />}
      {calendarPopup && <CalendarItemModal context={calendarPopup} onClose={()=>setCalendarPopup(null)} onSave={saveCalendarItem}/>} 
      {peopleOpen && <PeopleModal workers={data.teamMembers} onClose={()=>setPeopleOpen(false)} onSave={(workers)=>{saveWorkers(workers); setPeopleOpen(false)}} />}
      {shareHubOpen && <ShareHubModal onClose={()=>setShareHubOpen(false)} onShare={()=>{setShareHubOpen(false); setShareOpen(true)}} onRunSheet={()=>{setShareHubOpen(false); setRunSheetOpen(true)}} />}
      {shareOpen && <ShareScheduleModal data={data} workers={data.teamMembers} onClose={()=>setShareOpen(false)} />}
      {runSheetOpen && <DailyRunSheetModal data={data} workers={data.teamMembers} onClose={()=>setRunSheetOpen(false)} />}
      {messagesOpen && <MessagesModal messages={data.messages} jobs={data.jobs} onClose={()=>setMessagesOpen(false)} onAction={markMessageActioned}/>} 
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


function NeedsAttentionView({ jobs, workers, days, leaveRecords, messages, onOpenJob }) {
  const activeJobs = jobs.filter(j => j.category !== "Cancelled" && j.category !== "Completed");
  const rows = activeJobs.map(job => ({ job, readiness: getReadiness(job) }));
  const notReady = rows.filter(row => !row.readiness.ready);
  const awaitingMaterials = activeJobs.filter(job => !["Ready", "Not required"].includes(job.materialsStatus || "Not checked"));
  const unconfirmed = activeJobs.filter(job => job.category === "Scheduled" && !job.clientAccepted && !job.isAdHoc && !job.isTravelComment);
  const unread = messages.filter(m => m.unread);

  const cards = [
    { label: "Not ready", count: notReady.length, hint: "Missing key scheduling information" },
    { label: "Awaiting materials", count: awaitingMaterials.length, hint: "Materials not ready or not checked" },
    { label: "Unconfirmed appointments", count: unconfirmed.length, hint: "Scheduled jobs not accepted by client" },
    { label: "Unread messages", count: unread.length, hint: "Messages requiring review" }
  ];

  return (
    <main className="attention-view">
      <section className="attention-hero">
        <div>
          <h2>Needs attention</h2>
          <p>Use this view to clear blockers before jobs reach the schedule.</p>
        </div>
      </section>

      <section className="attention-dashboard attention-dashboard-large">
        {cards.map(card => (
          <div key={card.label} className={card.count ? "attention-card warning" : "attention-card"}>
            <strong>{card.count}</strong>
            <span>{card.label}</span>
            <em>{card.hint}</em>
          </div>
        ))}
      </section>

      <section className="attention-list-panel">
        <h3>Jobs requiring action</h3>
        {rows.filter(row => !row.readiness.ready || row.job.category === "Awaiting parts" || !row.job.clientAccepted).map(({ job, readiness }) => (
          <article key={job.id} className="attention-job-row" onClick={() => onOpenJob(job)}>
            <div>
              <strong>{job.title || "Untitled job"}</strong>
              <span>{job.client || "No client"} · {job.site || "No site"}</span>
            </div>
            <div className="attention-tags">
              <span>{job.category}</span>
              <span>Materials: {job.materialsStatus || "Not checked"}</span>
              {!readiness.ready && <span>Missing: {readiness.missing.join(", ")}</span>}
            </div>
          </article>
        ))}
        {!rows.some(row => !row.readiness.ready || row.job.category === "Awaiting parts" || !row.job.clientAccepted) && <p className="muted">No jobs currently need attention.</p>}
      </section>
    </main>
  );
}

function CalendarGrid({ days, workers, jobs, leaveRecords, messages, onDropJob, onDragStart, onAddItem, onEditJob, onDeleteJob, onExtendJob, onToggle, onConfirmComplete }) {
  return <div className="calendar-wrap"><div className="calendar-grid" style={{"--day-count": days.length}}><div className="corner-cell">Workers</div>{days.map(day=><div key={getIsoDate(day)} className={`day-header ${isToday(day)?"today":""}`}><strong>{formatDayName(day)}</strong><span>{formatDateHeader(day)}</span></div>)}{workers.map(worker=><React.Fragment key={worker.id}><div className="worker-cell"><button className="worker-profile-button"><strong>{worker.name}</strong><span>{worker.trade||"No trade"} · {worker.baseSite||"No site"}</span><em>{worker.sapNumber||"No SAP"}</em></button></div>{days.map(day=>{const iso=getIsoDate(day); const availability=getWorkerAvailability(worker, iso, leaveRecords); const dayLeaves=leaveRecords.filter(l=>l.workerId===worker.id && isDateWithinRange(iso,l.startDate,l.endDate)); const cellJobs=jobs.filter(j=>j.assignedTo.includes(worker.id)&&isDateWithinRange(iso,j.startDate,j.endDate)); return <div key={`${worker.id}-${iso}`} className={`calendar-cell ${isToday(day)?"today-cell":""} ${availability.status==="Onsite"?"onsite-cell":"rnr-cell"}`} onDragOver={e=>{e.preventDefault(); e.dataTransfer.dropEffect="move";}} onDrop={e=>{e.preventDefault(); const id=e.dataTransfer.getData("text/plain"); if(id) onDropJob(id, worker.id, iso);}}><div className={`roster-badge ${availability.status==="Onsite"?"onsite":"rnr"}`}>{availability.label}</div><button className="add-cell-job" onClick={()=>onAddItem({workerId:worker.id,workerName:worker.name,date:iso})}><Plus size={14}/> Item</button><div className="cell-jobs">{dayLeaves.map(l=><LeaveCard key={l.id} leave={l} />)}{cellJobs.map(job=><CalendarJob key={`${job.id}-${worker.id}-${iso}`} job={job} workerId={worker.id} isStart={job.startDate===iso} isEnd={job.endDate===iso} hasUnreadMessage={messages.some(m=>m.jobId===job.id && m.unread)} onDragStart={e=>onDragStart(e,job.id)} onEdit={()=>onEditJob(job)} onDelete={()=>onDeleteJob(job)} onExtend={()=>onExtendJob(job.id,iso)} onToggleAppointmentSent={()=>onToggle(job.id,"appointmentSent")} onToggleClientAccepted={()=>onToggle(job.id,"clientAccepted")} onConfirmComplete={()=>onConfirmComplete(job.id)}/>)}</div></div>})}</React.Fragment>)}</div></div>;
}

function CalendarJob({ job, workerId, isStart, isEnd, hasUnreadMessage, onDragStart, onEdit, onDelete, onToggleAppointmentSent, onToggleClientAccepted, onConfirmComplete }) {
  const status = job.workerStatus?.[workerId]?.status || "notStarted";
  const meta = STATUS_META[status] || STATUS_META.notStarted;
  const completedByTrade = Object.values(job.workerStatus || {}).some(s => s.status === "completed");
  const needsAnotherTrade = Object.values(job.workerCompletions || {}).some(c => c.requiresAnotherTrade);
  let tabClass = "neutral";
  if (["Awaiting parts"].includes(job.category) || !["Ready", "Not required"].includes(job.materialsStatus || "Not checked")) tabClass = "materials";
  if (needsAnotherTrade) tabClass = "followup";
  if (job.clientAccepted) tabClass = "confirmed";
  return (
    <article className={`calendar-job ${completedByTrade ? "trade-complete" : ""} ${job.isAdHoc?"ad-hoc":""} ${job.isTravelComment?"travel-comment":""} ${isStart?"range-start":"range-middle"}`} draggable onDragStart={onDragStart}>
      <div className="range-body">
        {hasUnreadMessage && <span className="job-envelope"><Mail size={13}/></span>}
        {isStart ? (
          <>
            <div className="card-top">
              <span className="wo">{job.isTravelComment ? "Travel" : job.isAdHoc ? "Ad hoc" : job.quoteNumber || job.jobNumber || "No QUO"}</span>
              <span className={`status-dot ${status}`}>{meta.icon}</span>
              <div className="card-actions"><button onClick={onEdit}><Pencil size={14}/></button><button onClick={onDelete}><Trash2 size={14}/></button></div>
            </div>
            <h3>{job.title}</h3>
            {!job.isAdHoc && !job.isTravelComment && <div className="meta">{job.address&&<span>{job.address}</span>}{job.client&&<span>{job.client}</span>}</div>}
            <p>Total running: {formatDuration(getWorkerTotalMs(job, workerId))}</p>
            {!job.isAdHoc && !job.isTravelComment && <div className="appointment-checks"><label><input type="checkbox" checked={!!job.appointmentSent} onChange={onToggleAppointmentSent}/>SMS sent</label><label><input type="checkbox" checked={!!job.clientAccepted} onChange={onToggleClientAccepted}/>Client accepted</label></div>}
            {completedByTrade && job.category !== "Completed" && <button className="confirm-complete-button" onClick={onConfirmComplete}>Confirm complete</button>}
          </>
        ) : <div className="continuation">{job.quoteNumber || job.title}</div>}
        <span className={`status-tab ${tabClass}`} title="Job status indicator" />
      </div>
    </article>
  );
}

function LeaveCard({ leave }) { return <article className="leave-card"><span className="leave-pill">{leave.leaveType}</span>{leave.notes&&<p>{leave.notes}</p>}</article>; }
function JobCard({ job, workerNames, onDragStart, onEdit, onDelete }) {
  return (
    <article className="card compact" draggable onDragStart={onDragStart}>
      <div className="card-top">
        <span className="category-pill">{job.category}</span>
        <div className="card-actions">
          <button onClick={onEdit}><Pencil size={14}/></button>
          <button onClick={onDelete}><Trash2 size={14}/></button>
        </div>
      </div>
      <h3>{job.title}</h3>
      <div className="details">
        {job.client&&<span><b>Client:</b> {job.client}</span>}
        {job.site&&<span><b>Site:</b> {job.site}</span>}
        {jobTradeText(job)&&<span><b>Trade:</b> {jobTradeText(job)}</span>}
        {job.materialsStatus&&<span><b>Materials:</b> {job.materialsStatus}</span>}
        {job.jobNumber&&<span><b>JB:</b> {job.jobNumber}</span>}
        {job.workOrderNumber&&<span><b>WO:</b> {job.workOrderNumber}</span>}
        {job.poNumber&&<span><b>PO:</b> {job.poNumber}</span>}
        {workerNames&&<span><b>Workers:</b> {workerNames}</span>}
      </div>
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
  {activeTab==="details"&&<section className="job-tab-panel"><div className="pdf-import-box"><label className="pdf-upload"><Upload size={16}/><span>Import AIM job sheet PDF</span><input type="file" accept="application/pdf" onChange={e=>importPdf(e.target.files?.[0])}/></label><small>Reads title, client, address, JB, QUO, WO, PO and scope.</small></div><label>Job title<input value={form.title} onChange={e=>update("title",e.target.value)}/></label><div className="two-col"><label>Client<input value={form.client||""} onChange={e=>update("client",e.target.value)}/></label><label>Address<input value={form.address||""} onChange={e=>update("address",e.target.value)}/></label></div><div className="two-col"><label>Site / area<select value={form.site||""} onChange={e=>update("site",e.target.value)}><option value="">Not set</option>{JOB_SITES.map(site=><option key={site}>{site}</option>)}</select></label><TradePicker value={form.requiredTrades || []} onChange={value => update("requiredTrades", value)} /></div><div className="two-col"><label>Job number<input value={form.jobNumber||""} onChange={e=>update("jobNumber",e.target.value)}/></label><label>Quote number<input value={form.quoteNumber||""} onChange={e=>update("quoteNumber",e.target.value)}/></label></div><div className="two-col"><label>Work order number<input value={form.workOrderNumber||""} onChange={e=>update("workOrderNumber",e.target.value)}/></label><label>PO number<input value={form.poNumber||""} onChange={e=>update("poNumber",e.target.value)}/></label></div>{pdfPreview&&<details className="pdf-preview"><summary>PDF text preview</summary><pre>{pdfPreview}</pre></details>}</section>}
  {activeTab==="scheduling"&&<section className="job-tab-panel">
    <div className="two-col"><label>Category<select value={form.category} onChange={e=>update("category",e.target.value)}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></label><label>Site / area<select value={form.site||""} onChange={e=>update("site",e.target.value)}><option value="">Not set</option>{JOB_SITES.map(site=><option key={site}>{site}</option>)}</select></label></div>
    <div className="two-col"><TradePicker value={form.requiredTrades || []} onChange={value => update("requiredTrades", value)} /><label>Materials status<select value={form.materialsStatus||"Not checked"} onChange={e=>update("materialsStatus",e.target.value)}>{MATERIAL_STATUSES.map(m=><option key={m}>{m}</option>)}</select></label></div>
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

function SideNav({ unreadMessages, onShare, onMessages, onPeople }) {
  return (
    <nav className="side-nav" aria-label="Main actions">
      <button title="Share" onClick={onShare}><Share2 size={22}/></button>
      <button title="Messages" onClick={onMessages} className="side-nav-message"><Inbox size={22}/>{unreadMessages > 0 && <span>{unreadMessages}</span>}</button>
      <button title="People" onClick={onPeople}><Users size={22}/></button>
    </nav>
  );
}

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

function PeopleModal({ workers, onClose, onSave }) {
  const [items,setItems]=useState(workers);
  const [mode,setMode]=useState("edit");
  function update(id,field,value){setItems(items.map(w=>w.id===id?{...w,[field]:value}:w));}
  function add(){setItems([{id:"worker-"+createId(),name:"",trade:"",baseSite:"",phone:"",email:"",birthday:"",sapNumber:"",rosterPattern:"NONE",rosterStartDate:"",accessRevoked:false}, ...items]); setMode("edit");}
  function remove(worker){
    const revoke = confirm(`Do you also want to revoke ${worker.name || "this employee"}'s access?`);
    if(!confirm("Delete this employee from the scheduler?")) return;
    setItems(items.filter(x=>x.id!==worker.id));
    if(revoke) alert("Demo only: access would be revoked in the backend user account system.");
  }
  return <div className="modal-backdrop"><div className="modal settings-modal"><div className="modal-header"><h2>People</h2><button className="icon" onClick={onClose}><X size={18}/></button></div><div className="choice-grid three-choice"><button className={mode==="add"?"choice-card active":"choice-card"} onClick={()=>{setMode("add"); add();}}><Users/><strong>Add employee</strong><span>Create a new employee profile.</span></button><button className={mode==="edit"?"choice-card active":"choice-card"} onClick={()=>setMode("edit")}><Pencil/><strong>Edit employee</strong><span>Update contact, trade, roster and SAP details.</span></button><button className={mode==="delete"?"choice-card active":"choice-card"} onClick={()=>setMode("delete")}><Trash2/><strong>Delete employee</strong><span>Remove employee and optionally revoke access.</span></button></div><div className="settings-list">{items.map(w=><section key={w.id} className="worker-editor"><div className="two-col"><label>Name<input value={w.name} onChange={e=>update(w.id,"name",e.target.value)}/></label><label>Trade<select value={w.trade||""} onChange={e=>update(w.id,"trade",e.target.value)}><option value="">Select</option>{TRADES.map(t=><option key={t}>{t}</option>)}</select></label></div><div className="two-col"><label>Phone<input value={w.phone||""} onChange={e=>update(w.id,"phone",e.target.value)}/></label><label>Email<input value={w.email||""} onChange={e=>update(w.id,"email",e.target.value)}/></label></div><div className="two-col"><label>Birthday<input type="date" value={w.birthday||""} onChange={e=>update(w.id,"birthday",e.target.value)}/></label><label>SAP number<input value={w.sapNumber||""} onChange={e=>update(w.id,"sapNumber",e.target.value)}/></label></div><div className="two-col"><label>Base site<select value={w.baseSite||""} onChange={e=>update(w.id,"baseSite",e.target.value)}><option value="">Select</option>{BASE_SITES.map(s=><option key={s}>{s}</option>)}</select></label><label>Roster<select value={w.rosterPattern||"NONE"} onChange={e=>update(w.id,"rosterPattern",e.target.value)}>{ROSTER_PATTERNS.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}</select></label></div><label>Roster start date<input type="date" value={w.rosterStartDate||""} onChange={e=>update(w.id,"rosterStartDate",e.target.value)}/></label>{mode==="delete"&&<button className="secondary danger" onClick={()=>remove(w)}>Delete employee</button>}</section>)}</div><div className="modal-actions"><button className="secondary" onClick={onClose}>Cancel</button><button className="primary" onClick={()=>onSave(items)}>Save people</button></div></div></div> }


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

function MessagesModal({ messages, jobs, onClose, onAction }) {
  const visibleMessages = messages.filter(m => m.direction === "in" || m.direction === "out" || m.channel === "email" || m.channel === "sms");
  return <div className="modal-backdrop"><div className="modal"><div className="modal-header"><h2>Messages</h2><button className="icon" onClick={onClose}><X size={18}/></button></div><div className="message-list">{visibleMessages.map(m=>{const job=jobs.find(j=>j.id===m.jobId);return <article key={m.id} className={m.unread?"message-card unread":"message-card"}><div><strong>{m.direction==="in"?"Received":"Sent"}: {m.from}</strong><span>{formatDateTime(m.date)}</span></div><p>{m.text}</p>{job&&<em>Linked job: {job.title}</em>}{m.actioned&&<em>Actioned by {m.actionedBy} on {formatDateTime(m.actionedAt)}</em>}{!m.actioned&&<button className="secondary" onClick={()=>onAction(m)}>Mark as actioned</button>}</article>})}{!visibleMessages.length&&<div className="empty">No demo SMS/email messages yet.</div>}</div></div></div> }

function HistoryModal({ job, onClose }) { return <div className="modal-backdrop"><div className="modal mini-modal"><div className="modal-header"><h2>Job history</h2><button className="icon" onClick={onClose}><X size={18}/></button></div><HistoryList items={job.jobHistory||[]} type="history"/></div></div> }
function HistoryList({ items }) { return <div className="history-list">{items.map(i=><div key={i.id}><strong>{i.action||i.user}</strong><span>{formatDateTime(i.date)} · {i.user}</span><p>{i.details||i.text}</p></div>)}{!items.length&&<p>No entries yet.</p>}</div> }

function EmployeeView({ workerId, setWorkerId, workers, days, jobs, leaveRecords, onAddNote, onStatus, onAddAttachment, onCompletion }) {
  const [noteFor, setNoteFor] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [range, setRange] = useState("today");
  const [completionFor, setCompletionFor] = useState(null);
  const [completionDrafts, setCompletionDrafts] = useState({});

  const worker = workers.find(w => w.id === workerId) || workers[0];
  const startIso = getIsoDate(days[0]);
  const endIso = getIsoDate(days[days.length - 1]);
  const visible = jobs.filter(j =>
    j.assignedTo.includes(worker?.id || "") &&
    getDatesInRange(startIso, endIso).some(d => isDateWithinRange(d, j.startDate, j.endDate))
  );
  const displayDays = range === "today" ? days.slice(0, 1) : range === "tomorrow" ? days.slice(1, 2) : days;

  function updateCompletionDraft(jobId, field, value) {
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

  function saveCompletion(job) {
    const existing = job.workerCompletions?.[worker.id] || {};
    const draft = completionDrafts[job.id] || existing;
    onCompletion(job.id, worker.id, {
      completionDescription: draft.completionDescription || "",
      materialsUsed: draft.materialsUsed || "",
      requiresAnotherTrade: Boolean(draft.requiresAnotherTrade),
      followUpTrade: draft.followUpTrade || ""
    });
    setCompletionFor(null);
  }

  return (
    <main className="employee-view app-like-view">
      <section className="employee-app-header">
        <div>
          <span className="app-kicker">Employee schedule</span>
          <h2>{worker?.name || "Employee"}</h2>
          <p>{worker?.trade || "No trade"} · {worker?.baseSite || "No site"}</p>
        </div>
        <label>View as<select value={worker?.id || ""} onChange={e => setWorkerId(e.target.value)}>{workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
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
          const dayJobs = visible.filter(j => isDateWithinRange(iso, j.startDate, j.endDate));
          return (
            <div key={iso} className="employee-day">
              <h3>{formatIsoForDisplay(iso)} <span className={`roster-badge ${availability.status === "Onsite" ? "onsite" : "rnr"}`}>{availability.label}</span></h3>
              {dayJobs.map(job => {
                const status = job.workerStatus?.[worker.id]?.status || "notStarted";
                const completion = {
                  completionDescription: "",
                  materialsUsed: "",
                  requiresAnotherTrade: false,
                  followUpTrade: "",
                  ...(job.workerCompletions?.[worker.id] || {}),
                  ...(completionDrafts[job.id] || {})
                };
                return (
                  <article key={job.id} className="employee-job-card app-job-card">
                    <div className="employee-job-banner">
                      <div>
                        <span className="wo">{job.workOrderNumber || job.jobNumber || "Job"}</span>
                        <h4>{job.title}</h4>
                      </div>
                      <span className={`status-dot ${status}`}>{STATUS_META[status].icon} {STATUS_META[status].label}</span>
                    </div>

                    <p className="address-line">{job.address}</p>
                    <div className="employee-quick-info">
                      <span>{job.site || "No site"}</span>
                      <span>{jobTradeText(job) || "No trade set"}</span>
                      <span>Materials: {job.materialsStatus || "Not checked"}</span>
                    </div>

                    <div className="employee-actions primary-actions-row">
                      <a className="secondary" href={job.clientPhone ? `tel:${job.clientPhone}` : undefined} onClick={(e) => { if (!job.clientPhone) { e.preventDefault(); alert("No client phone number saved."); } }}><Phone size={16}/> Call site contact</a>
                      <button className="secondary" onClick={() => onStatus(job.id, worker.id, "running")}><Play size={16}/> Onsite</button>
                      <button className="secondary" onClick={() => onStatus(job.id, worker.id, "stopped")}><Square size={16}/> Offsite</button>
                      <button className="secondary" onClick={() => onStatus(job.id, worker.id, "completed")}><CheckCircle2 size={16}/> Complete</button>
                    </div>
                    <p className="time-total"><Clock size={14}/> Total running time: {formatDuration(getWorkerTotalMs(job, worker.id))}</p>

                    <div className="employee-card-tabs">
                      <details open><summary>Job description</summary><pre>{job.notes}</pre></details>
                      <details><summary>Materials list</summary>{(job.materials || []).map(m => <p key={m.id}>• {m.text}</p>)}{!(job.materials || []).length && <p>No materials listed.</p>}</details>
                      <details><summary>Photos</summary><div className="photo-upload-row"><label className="secondary file-pick">Upload photos<input type="file" accept="image/*" multiple onChange={e => onAddAttachment(job.id, worker.id, e.target.files || [])}/></label><label className="secondary file-pick">Camera<input type="file" accept="image/*" capture="environment" onChange={e => onAddAttachment(job.id, worker.id, e.target.files || [])}/></label></div><div className="simple-list">{(job.attachments || []).map(a => <div key={a.id}><span>{a.name} · {formatBytes(a.size)}</span></div>)}{!(job.attachments || []).length && <p>No photos/files added.</p>}</div></details>
                      <details open={completionFor === job.id}><summary onClick={() => setCompletionFor(completionFor === job.id ? null : job.id)}>Job completion</summary><label>Description of works<textarea rows="4" value={completion.completionDescription || ""} onChange={e => updateCompletionDraft(job.id, "completionDescription", e.target.value)} placeholder="Describe the works completed..."/></label><label>Approximate materials used<textarea rows="3" value={completion.materialsUsed || ""} onChange={e => updateCompletionDraft(job.id, "materialsUsed", e.target.value)} placeholder="List approximate materials used..."/></label><label className="check-option plain"><input type="checkbox" checked={Boolean(completion.requiresAnotherTrade)} onChange={e => updateCompletionDraft(job.id, "requiresAnotherTrade", e.target.checked)}/>Notify supervisors that this portion is complete but another trade is required</label>{completion.requiresAnotherTrade && <label>Trade required<select value={completion.followUpTrade || ""} onChange={e => updateCompletionDraft(job.id, "followUpTrade", e.target.value)}><option value="">Select trade</option>{TRADES.map(t => <option key={t}>{t}</option>)}</select></label>}<p className="muted">Use the Save update button below to save completion details and notes together.</p></details>
                    </div>

                    <button className="ghost" onClick={() => { setNoteFor(job.id); setCompletionFor(job.id); }}>Add note / completion update</button>
                    {noteFor === job.id && <div className="note-entry"><textarea rows="3" value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add note..."/><button className="primary" onClick={() => { if (noteText.trim()) onAddNote(job.id, noteText); saveCompletion(job); setNoteText(""); setNoteFor(null); setCompletionFor(null); }}>Save update</button></div>}
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

function emptyJob(){ return normaliseJob({id:createId(),title:"",client:"",site:"",requiredTrade:"",requiredTrades:[],materialsStatus:"Not checked",jobNumber:"",quoteNumber:"",workOrderNumber:"",poNumber:"",address:"",clientContact:"",clientPhone:"",category:"To be scheduled",assignedTo:[],startDate:"",endDate:"",notes:"",materials:[],attachments:[],noteHistory:[],jobHistory:[],workerStatus:{}}); }
function normaliseJob(job){ const trades = Array.isArray(job.requiredTrades) && job.requiredTrades.length ? job.requiredTrades : (job.requiredTrade ? [job.requiredTrade] : []); return {client:"",site:"",requiredTrade:trades[0]||job.requiredTrade||"",requiredTrades:trades,materialsStatus:"Not checked",jobNumber:"",quoteNumber:"",workOrderNumber:"",poNumber:"",clientPhone:"",appointmentSent:false,clientAccepted:false,isAdHoc:false,isTravelComment:false,materials:[],attachments:[],noteHistory:[],jobHistory:[],workerStatus:{},workerCompletions:{},...job,requiredTrade:trades[0]||job.requiredTrade||"",requiredTrades:trades,assignedTo:Array.isArray(job.assignedTo)?job.assignedTo:[],endDate:job.endDate||job.startDate||""}; }
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
  if (!jobTradeText(job)) missing.push("required trade");
  if (!job.site) missing.push("site/area");
  if (!["Ready", "Not required"].includes(job.materialsStatus || "Not checked")) missing.push("materials ready");
  return { ready: missing.length === 0, missing };
}

function findSchedulingConflicts(job, worker, date, jobs, leaveRecords) {
  const conflicts = [];
  const availability = getWorkerAvailability(worker, date, leaveRecords);
  if (availability.status !== "Onsite") conflicts.push(`${worker.name} is ${availability.label} on ${date}`);
  if (jobTradeText(job) && worker.trade && !getJobTrades(job).includes(worker.trade)) conflicts.push(`Job requires ${jobTradeText(job)}, but ${worker.name} is ${worker.trade}`);
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

function getJobTrades(job){ return Array.isArray(job.requiredTrades) && job.requiredTrades.length ? job.requiredTrades : (job.requiredTrade ? [job.requiredTrade] : []); }
function jobTradeText(job){ return getJobTrades(job).join(", "); }
function buildSmsMessage(job){ return `Hi ${job.clientContact||""}, this is to confirm your appointment for ${job.title||"your job"} at ${job.address||"your property"} on ${job.startDate||"the scheduled date"}. Please reply to confirm.`; }
function buildScheduleRows({startDate,endDate,workers,jobs,leaveRecords}){ const rows=[]; for(const date of getDatesInRange(startDate,endDate)){for(const w of workers){const a=getWorkerAvailability(w,date,leaveRecords); const js=jobs.filter(j=>j.assignedTo?.includes(w.id)&&isDateWithinRange(date,j.startDate,j.endDate)); if(!js.length) rows.push({Date:date,Worker:w.name,Status:a.label,Title:"",Address:""}); js.forEach(j=>rows.push({Date:date,Worker:w.name,Status:a.label,Title:j.title,Address:j.address,Site:j.site,Trade:jobTradeText(j),Materials:j.materialsStatus,WO:j.workOrderNumber,PO:j.poNumber}));}} return rows; }
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
