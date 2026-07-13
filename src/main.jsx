import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Plus,
  Search,
  Trash2,
  Pencil,
  X,
  Users,
  ChevronLeft,
  ChevronRight,
  PanelLeft,
  GripVertical,
  Phone,
  Mail,
  BadgeCheck,
  MessageSquare,
  Upload,
  CalendarX,
  Wrench,
  Download,
  Send,
  Share2,
  Inbox,
  MailOpen,
  History,
  Plane
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import * as XLSX from "xlsx";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "./styles.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const STORAGE_KEY = "job-scheduler-calendar-buckets-v7";

const CATEGORIES = [
  "To be scheduled",
  "Awaiting parts",
  "To be rescheduled",
  "Scheduled",
  "Completed"
];

const TRADES = [
  "Plumber",
  "Carpenter",
  "TA",
  "Electrician",
  "Refrigeration",
  "Boilermaker",
  "Concreter",
  "Supervisor"
];

const BASE_SITES = [
  "Paraburdoo",
  "Brockman",
  "Busselton",
  "Karratha",
  "Tom Price",
  "Perth",
  "Other"
];

const ROSTER_PATTERNS = [
  { id: "NONE", label: "No roster pattern", onDays: 0, offDays: 0 },
  { id: "5_ON_2_OFF", label: "5 days on / 2 off", onDays: 5, offDays: 2 },
  { id: "8_ON_6_OFF", label: "8 days on / 6 off", onDays: 8, offDays: 6 },
  { id: "14_ON_7_OFF", label: "2 weeks on / 1 off", onDays: 14, offDays: 7 },
  { id: "14_ON_14_OFF", label: "2 weeks on / 2 off", onDays: 14, offDays: 14 }
];

const LEAVE_TYPES = ["Sick leave", "Annual leave", "Other leave"];

const initialData = {
  teamMembers: [
    {
      id: "gary",
      name: "Gary",
      trade: "Supervisor",
      baseSite: "Paraburdoo",
      phone: "0400 000 000",
      email: "gary@example.com",
      employeeNumber: "EMP001",
      rosterPattern: "5_ON_2_OFF",
      rosterStartDate: getIsoDate(new Date())
    },
    {
      id: "mick",
      name: "Mick",
      trade: "Carpenter",
      baseSite: "Busselton",
      phone: "",
      email: "",
      employeeNumber: "EMP002",
      rosterPattern: "8_ON_6_OFF",
      rosterStartDate: getIsoDate(new Date())
    },
    {
      id: "drew",
      name: "Drew",
      trade: "Plumber",
      baseSite: "Paraburdoo",
      phone: "",
      email: "",
      employeeNumber: "EMP003",
      rosterPattern: "14_ON_7_OFF",
      rosterStartDate: getIsoDate(new Date())
    },
    {
      id: "gaz",
      name: "Gaz",
      trade: "Electrician",
      baseSite: "Brockman",
      phone: "",
      email: "",
      employeeNumber: "EMP004",
      rosterPattern: "14_ON_14_OFF",
      rosterStartDate: getIsoDate(new Date())
    }
  ],
  jobs: [
    {
      id: createId(),
      title: "790 larnook pool fence panel replacement WO5879466",
      jobNumber: "JB04953",
      quoteNumber: "QUO 10574",
      workOrderNumber: "WO 5879466",
      poNumber: "PO D087307",
      address: "247 Balcatta Road, Balcatta, Western Australia 6021, Australia",
      clientContact: "Sodexo Remote Sites Australia Pty Ltd.",
      clientPhone: "",
      category: "To be scheduled",
      assignedTo: [],
      startDate: "",
      endDate: "",
      appointmentSent: false,
      clientAccepted: false,
      notes:
        "Mobilise to site with personnel, materials and equipment\nCarry out the required paperwork for the tasks being carried out\nInstall the barricading and signage as required\nRemove damaged pool fencing panels\nTidy site and demobilise",
      noteHistory: [
        {
          id: createId(),
          date: new Date().toISOString(),
          text: "Job imported after PO received."
        }
      ],
      isAdHoc: false,
      jobHistory: [
        {
          id: createId(),
          date: new Date().toISOString(),
          user: "Demo User",
          action: "Created",
          details: "Job imported after PO received."
        }
      ]
    }
  ],
  leaveRecords: [],
  messages: []
};

function App() {
  const [data, setData] = useState(loadData);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("To be scheduled");
  const [clientFilter, setClientFilter] = useState("All");
  const [tradeFilter, setTradeFilter] = useState("All");
  const [siteFilter, setSiteFilter] = useState("All");
  const [hideUnavailable, setHideUnavailable] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [editingWorker, setEditingWorker] = useState(null);
  const [calendarPopup, setCalendarPopup] = useState(null);
  const [exportStartDate, setExportStartDate] = useState(getIsoDate(getStartOfWeek(new Date())));
  const [exportEndDate, setExportEndDate] = useState(getIsoDate(addDays(getStartOfWeek(new Date()), 6)));
  const [emailPeriod, setEmailPeriod] = useState("nextDay");
  const [emailRecipients, setEmailRecipients] = useState("all");
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [jobHistoryJob, setJobHistoryJob] = useState(null);
  const [draggedJobId, setDraggedJobId] = useState(null);
  const [weekStart, setWeekStart] = useState(getStartOfWeek(new Date()));

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart]
  );

  const visibleWorkers = useMemo(() => {
    return data.teamMembers.filter((worker) => {
      const matchesTrade = tradeFilter === "All" || worker.trade === tradeFilter;
      const matchesSite = siteFilter === "All" || worker.baseSite === siteFilter;

      const unavailableAllWeek = days.every((day) => {
        const availability = getWorkerAvailability(
          worker,
          getIsoDate(day),
          data.leaveRecords
        );
        return availability.status !== "Onsite";
      });

      return matchesTrade && matchesSite && (!hideUnavailable || !unavailableAllWeek);
    });
  }, [data.teamMembers, data.leaveRecords, days, tradeFilter, siteFilter, hideUnavailable]);

  const clientOptions = useMemo(() => {
    return Array.from(
      new Set(
        data.jobs
          .map((job) => job.clientContact)
          .filter(Boolean)
          .map((client) => client.trim())
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [data.jobs]);

  const searchMatchedJobs = useMemo(() => {
    const q = query.trim().toLowerCase();

    return data.jobs.filter((job) => {
      return (
        !q ||
        [
          job.title,
          job.jobNumber,
          job.quoteNumber,
          job.workOrderNumber,
          job.poNumber,
          job.address,
          job.clientContact,
          job.clientPhone,
          job.category,
          job.notes,
          getAssignedWorkerNames(data.teamMembers, job.assignedTo)
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    });
  }, [data.jobs, data.teamMembers, query]);

  const clientMatchedJobs = searchMatchedJobs.filter((job) => {
    return clientFilter === "All" || job.clientContact === clientFilter;
  });

  const bucketJobs = clientMatchedJobs.filter((job) => {
    return activeCategory === "All" || job.category === activeCategory;
  });

  const scheduledJobs = clientMatchedJobs.filter(
    (job) => job.startDate && job.endDate && job.assignedTo?.length
  );

  const unreadMessages = (data.messages || []).filter((message) => !message.read).length;

  function updateData(next) {
    setData(next);
    saveData(next);
  }

  function getDraggedJobId(e) {
    return e.dataTransfer.getData("text/plain") || draggedJobId;
  }

  function handleDragStart(e, jobId) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", jobId);
    setDraggedJobId(jobId);
  }

  function addJob(defaults = {}) {
    setEditingJob(emptyJob(defaults));
  }

  async function createJobFromPdfFile(file) {
    if (!file) return;

    try {
      const text = await extractTextFromPdf(file);
      const parsed = parseAimJobSheet(text);
      const job = withJobHistory(
        normaliseJob({
          ...emptyJob(),
          ...parsed,
          category: "To be scheduled",
          notes: parsed.notes || ""
        }),
        "Created from PDF",
        `PDF dropped onto New job button: ${file.name}`
      );

      updateData({ ...data, jobs: [job, ...data.jobs] });
      setActiveCategory("To be scheduled");
      alert("PDF imported and new job created in To be scheduled.");
    } catch (error) {
      console.error(error);
      alert("The PDF could not be read. It may be scanned/image-based or in an unsupported format.");
    }
  }

  function saveJob(jobToSave) {
    const normalised = normaliseJob(jobToSave);
    const existing = data.jobs.find((j) => j.id === normalised.id);

    let jobToStore = normalised;

    if (existing) {
      const changes = describeJobChanges(existing, normalised);
      if (changes.length) {
        jobToStore = withJobHistory(normalised, "Edited", changes.join("; "));
      }
    } else {
      jobToStore = withJobHistory(normalised, "Created", "Job manually created.");
    }

    const nextJobs = existing
      ? data.jobs.map((j) => (j.id === jobToStore.id ? jobToStore : j))
      : [jobToStore, ...data.jobs];

    updateData({ ...data, jobs: nextJobs });
    setEditingJob(null);
  }

  function saveWorker(workerToSave) {
    const normalised = {
      ...workerToSave,
      trade: workerToSave.trade || "",
      baseSite: workerToSave.baseSite || "",
      rosterPattern: workerToSave.rosterPattern || "NONE",
      rosterStartDate: workerToSave.rosterStartDate || ""
    };

    const exists = data.teamMembers.some((w) => w.id === normalised.id);

    const nextWorkers = exists
      ? data.teamMembers.map((w) => (w.id === normalised.id ? normalised : w))
      : [...data.teamMembers, normalised];

    updateData({ ...data, teamMembers: nextWorkers });
    setEditingWorker(null);
  }

  function deleteJob(jobId) {
    if (!confirm("Delete this job?")) return;
    updateData({ ...data, jobs: data.jobs.filter((j) => j.id !== jobId) });
  }

  function deleteLeave(leaveId) {
    if (!confirm("Delete this leave entry?")) return;
    updateData({
      ...data,
      leaveRecords: data.leaveRecords.filter((leave) => leave.id !== leaveId)
    });
  }

  function scheduleJob(jobId, workerId, startDate) {
    const newMessages = [];

    const nextJobs = data.jobs.map((job) => {
      if (job.id !== jobId) return job;

      const currentAssigned = Array.isArray(job.assignedTo) ? job.assignedTo : [];
      const assignedTo = currentAssigned.includes(workerId)
        ? currentAssigned
        : [...currentAssigned, workerId];

      const isReschedule =
        Boolean(job.clientAccepted) &&
        Boolean(job.startDate) &&
        (job.startDate !== startDate || job.endDate !== startDate);

      let clientAccepted = Boolean(job.clientAccepted);
      let appointmentSent = Boolean(job.appointmentSent);

      if (isReschedule) {
        const notify = confirm(
          "This job already has client acceptance ticked and is being rescheduled. Would you like to notify the contact of the change?"
        );

        if (notify) {
          appointmentSent = true;
          const smsBody = buildRescheduleSmsMessage({ ...job, startDate, endDate: startDate });
          if (job.clientPhone) {
            window.location.href = `sms:${job.clientPhone}?&body=${encodeURIComponent(smsBody)}`;
          } else {
            alert("No client phone number is saved on this job. Add a phone number before sending SMS.");
          }

          newMessages.push({
            id: createId(),
            jobId: job.id,
            direction: "outgoing",
            from: "Scheduler",
            to: job.clientContact || job.clientPhone || "Client",
            body: smsBody,
            date: new Date().toISOString(),
            read: true
          });
        } else {
          clientAccepted = confirm(
            "Would you like to keep the appointment marked as confirmed? Choose Cancel to untick client accepted."
          );
        }
      }

      return withJobHistory(
        normaliseJob({
          ...job,
          assignedTo,
          startDate,
          endDate: startDate,
          category: "Scheduled",
          appointmentSent,
          clientAccepted
        }),
        isReschedule ? "Rescheduled" : "Scheduled",
        `${job.title || "Job"} scheduled to ${startDate}.`
      );
    });

    updateData({
      ...data,
      jobs: nextJobs,
      messages: [...newMessages, ...(data.messages || [])]
    });
  }

  function extendJob(jobId, newEndDate) {
    updateData({
      ...data,
      jobs: data.jobs.map((job) => {
        if (job.id !== jobId) return job;

        const start = job.startDate || newEndDate;
        const end = compareIsoDates(newEndDate, start) < 0 ? start : newEndDate;

        return withJobHistory(
          normaliseJob({
            ...job,
            startDate: start,
            endDate: end,
            category: "Scheduled"
          }),
          "Date changed",
          `Job date range changed to ${start} - ${end}.`
        );
      })
    });
  }

  function toggleJobCheckbox(jobId, field) {
    updateData({
      ...data,
      jobs: data.jobs.map((job) => {
        if (job.id !== jobId) return job;
        const nextValue = !job[field];
        return withJobHistory(
          { ...job, [field]: nextValue },
          field === "clientAccepted" ? "Client acceptance changed" : "SMS status changed",
          `${field} set to ${nextValue ? "yes" : "no"}.`
        );
      })
    });
  }

  function addWorkerToJob(jobId, workerId) {
    updateData({
      ...data,
      jobs: data.jobs.map((job) => {
        if (job.id !== jobId) return job;

        const currentAssigned = Array.isArray(job.assignedTo)
          ? job.assignedTo
          : [];

        if (currentAssigned.includes(workerId)) return job;

        return normaliseJob({
          ...job,
          assignedTo: [...currentAssigned, workerId],
          category: job.startDate ? "Scheduled" : job.category
        });
      })
    });
  }

  function moveToBucket(jobId, category) {
    if (category === "All") return;

    updateData({
      ...data,
      jobs: data.jobs.map((job) =>
        job.id === jobId
          ? normaliseJob({
              ...job,
              category,
              assignedTo: category === "Scheduled" ? job.assignedTo : [],
              startDate: category === "Scheduled" ? job.startDate : "",
              endDate: category === "Scheduled" ? job.endDate : ""
            })
          : job
      )
    });
  }

  function saveCalendarItem(item) {
    if (item.type === "adHoc") {
      const job = normaliseJob({
        id: createId(),
        title: item.text.split("\n")[0] || "Ad hoc task",
        jobNumber: "",
        quoteNumber: "",
        workOrderNumber: "",
        poNumber: "",
        address: "",
        clientContact: "",
        clientPhone: "",
        category: "Scheduled",
        assignedTo: [item.workerId],
        startDate: item.startDate,
        endDate: item.endDate,
        appointmentSent: false,
        clientAccepted: true,
        notes: item.text,
        isAdHoc: true
      });

      updateData({ ...data, jobs: [job, ...data.jobs] });
    }

    if (item.type === "travel") {
      const job = normaliseJob({
        id: createId(),
        title: "Travel / accommodation comment",
        jobNumber: "",
        quoteNumber: "",
        workOrderNumber: "",
        poNumber: "",
        address: "",
        clientContact: "",
        clientPhone: "",
        category: "Scheduled",
        assignedTo: [item.workerId],
        startDate: item.startDate,
        endDate: item.endDate,
        appointmentSent: false,
        clientAccepted: true,
        notes: item.text,
        isAdHoc: true,
        isTravelComment: true
      });

      updateData({ ...data, jobs: [withJobHistory(job, "Travel/accommodation comment created", item.text), ...data.jobs] });
    }

    if (item.type === "leave") {
      const leave = {
        id: createId(),
        workerId: item.workerId,
        leaveType: item.leaveType,
        startDate: item.startDate,
        endDate: item.endDate,
        notes: item.notes || ""
      };

      updateData({ ...data, leaveRecords: [leave, ...data.leaveRecords] });
    }

    setCalendarPopup(null);
  }

  function recordSmsDemo(jobToMessage) {
    const normalised = normaliseJob(jobToMessage);
    const phone = normalised.clientPhone?.trim();

    if (!phone) {
      alert("Enter a client phone number first.");
      return false;
    }

    const body = buildSmsMessage(normalised);
    const outgoing = {
      id: createId(),
      jobId: normalised.id,
      direction: "outgoing",
      from: "Scheduler",
      to: normalised.clientContact || phone,
      body,
      date: new Date().toISOString(),
      read: true
    };

    const demoReply = {
      id: createId(),
      jobId: normalised.id,
      direction: "incoming",
      from: normalised.clientContact || phone,
      to: "Scheduler",
      body: "Demo reply: Yes, that appointment is confirmed.",
      date: new Date(Date.now() + 60000).toISOString(),
      read: false
    };

    updateData({
      ...data,
      jobs: data.jobs.map((job) =>
        job.id === normalised.id
          ? withJobHistory({ ...job, appointmentSent: true }, "Message sent", "Appointment SMS opened/sent from job.")
          : job
      ),
      messages: [demoReply, outgoing, ...(data.messages || [])]
    });

    window.location.href = `sms:${phone}?&body=${encodeURIComponent(body)}`;
    return true;
  }

  function openMessage(message) {
    const job = data.jobs.find((item) => item.id === message.jobId);
    let nextJobs = data.jobs;

    if (message.direction === "incoming" && job && !job.clientAccepted) {
      const confirmBooking = confirm(
        `Message from ${message.from}:\n\n${message.body}\n\nWould you like to mark this job appointment as client accepted?`
      );

      if (confirmBooking) {
        nextJobs = data.jobs.map((item) =>
          item.id === job.id
            ? withJobHistory(
                { ...item, clientAccepted: true },
                "Client accepted",
                "Appointment confirmed from message inbox."
              )
            : item
        );
      }
    } else {
      alert(`${message.direction === "incoming" ? "From" : "To"}: ${message.direction === "incoming" ? message.from : message.to}\n\n${message.body}`);
    }

    updateData({
      ...data,
      jobs: nextJobs,
      messages: (data.messages || []).map((item) =>
        item.id === message.id ? { ...item, read: true } : item
      )
    });
  }

  function addTeamMember() {
    setEditingWorker(emptyWorker());
  }

  function removeTeamMember(memberId) {
    if (
      !confirm(
        "Remove this worker from the calendar? They will also be removed from assigned jobs and leave records."
      )
    ) {
      return;
    }

    updateData({
      teamMembers: data.teamMembers.filter((m) => m.id !== memberId),
      jobs: data.jobs.map((job) => ({
        ...job,
        assignedTo: Array.isArray(job.assignedTo)
          ? job.assignedTo.filter((id) => id !== memberId)
          : []
      })),
      leaveRecords: data.leaveRecords.filter((leave) => leave.workerId !== memberId)
    });
  }

  function resetDemoData() {
    if (!confirm("Reset all jobs, workers and leave to demo data?")) return;
    updateData(initialData);
    setWeekStart(getStartOfWeek(new Date()));
  }

  function exportCalendarToExcel() {
    if (compareIsoDates(exportEndDate, exportStartDate) < 0) {
      alert("Export end date cannot be before start date.");
      return;
    }

    const rows = buildScheduleRows({
      startDate: exportStartDate,
      endDate: exportEndDate,
      workers: visibleWorkers,
      jobs: scheduledJobs,
      leaveRecords: data.leaveRecords
    });

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Schedule");
    XLSX.writeFile(workbook, `job-schedule-${exportStartDate}-to-${exportEndDate}.xlsx`);
  }

  function sendScheduleEmailDemo() {
    const today = getIsoDate(new Date());
    const startDate = emailPeriod === "nextDay" ? getIsoDate(addDays(new Date(), 1)) : today;
    const endDate =
      emailPeriod === "nextDay"
        ? startDate
        : emailPeriod === "week"
          ? getIsoDate(addDays(new Date(), 6))
          : getIsoDate(addDays(new Date(), 13));

    const recipientWorkers = data.teamMembers.filter((worker) => {
      if (emailRecipients === "all") return true;

      return getDatesInRange(startDate, endDate).some((date) => {
        return getWorkerAvailability(worker, date, data.leaveRecords).status === "Onsite";
      });
    });

    const emails = recipientWorkers.map((worker) => worker.email).filter(Boolean);

    if (!emails.length) {
      alert("No worker email addresses are available for the selected option.");
      return;
    }

    const rows = buildScheduleRows({
      startDate,
      endDate,
      workers: recipientWorkers,
      jobs: data.jobs.filter((job) => job.startDate && job.endDate && job.assignedTo?.length),
      leaveRecords: data.leaveRecords
    });

    const body = buildScheduleEmailBody(rows, startDate, endDate);
    const subject = `Work schedule ${startDate} to ${endDate}`;
    window.location.href = `mailto:?bcc=${encodeURIComponent(emails.join(","))}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>Job Scheduler</h1>
          <p>Import job PDFs, sort jobs into buckets, then drag them onto the worker calendar.</p>
        </div>

        <div className="actions top-menu">
          <button className="secondary" onClick={() => setShareModalOpen(true)}>
            <Share2 size={16} /> Share schedule
          </button>
          <button className="secondary message-menu-button" onClick={() => setMessagesOpen(true)}>
            <Inbox size={16} /> Messages
            {unreadMessages > 0 && <span className="menu-badge">{unreadMessages}</span>}
          </button>
          <button className="secondary" onClick={addTeamMember}>
            <Users size={16} /> Add worker
          </button>
          <button
            className="primary"
            onClick={() => addJob()}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }}
            onDrop={(e) => {
              e.preventDefault();
              const file = Array.from(e.dataTransfer.files || []).find(
                (item) => item.type === "application/pdf" || item.name.toLowerCase().endsWith(".pdf")
              );
              createJobFromPdfFile(file);
            }}
            title="Click to create a job, or drag an AIM job sheet PDF onto this button"
          >
            <Plus size={16} /> New job / Drop PDF
          </button>
        </div>
      </header>

      <section className="toolbar">
        <div className="search">
          <Search size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, JB number, WO, PO, address, contact..."
          />
        </div>

        <div className="week-controls">
          <button className="secondary" onClick={() => setWeekStart(addDays(weekStart, -7))}>
            <ChevronLeft size={16} /> Previous
          </button>

          <button className="secondary" onClick={() => setWeekStart(getStartOfWeek(new Date()))}>
            This week
          </button>

          <button className="secondary" onClick={() => setWeekStart(addDays(weekStart, 7))}>
            Next <ChevronRight size={16} />
          </button>
        </div>
      </section>

      <main className="workspace">
        <aside className="bucket-panel">
          <div className="bucket-title">
            <PanelLeft size={18} />
            <div>
              <h2>Job buckets</h2>
              <span>{bucketJobs.length} jobs displayed</span>
            </div>
          </div>

          <div className="bucket-button-grid">
            {["All", ...CATEGORIES].map((category) => {
              const count =
                category === "All"
                  ? clientMatchedJobs.length
                  : clientMatchedJobs.filter((job) => job.category === category).length;

              return (
                <button
                  key={category}
                  className={activeCategory === category ? "active" : ""}
                  onClick={() => setActiveCategory(category)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const jobId = getDraggedJobId(e);
                    if (jobId) moveToBucket(jobId, category);
                    setDraggedJobId(null);
                  }}
                >
                  <span>{category}</span>
                  <em>{count}</em>
                </button>
              );
            })}
          </div>

          <label className="client-filter">
            Client
            <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}>
              <option>All</option>
              {clientOptions.map((client) => (
                <option key={client}>{client}</option>
              ))}
            </select>
          </label>

          <div
            className="selected-bucket-list"
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const jobId = getDraggedJobId(e);
              if (jobId && activeCategory !== "All") moveToBucket(jobId, activeCategory);
              setDraggedJobId(null);
            }}
          >
            {bucketJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                compact
                workerNames={getAssignedWorkerNames(data.teamMembers, job.assignedTo)}
                onDragStart={(e) => handleDragStart(e, job.id)}
                onEdit={() => setEditingJob(job)}
                onDelete={() => deleteJob(job.id)}
              />
            ))}

            {bucketJobs.length === 0 && (
              <div className="empty small">No jobs in this bucket yet</div>
            )}
          </div>
        </aside>

        <section className="calendar-area">
          <div className="calendar-instructions">
            <strong>Calendar</strong>
            <span>
              Click a worker name to edit details. Use + Item in a calendar cell for ad hoc tasks or leave.
            </span>
          </div>

          <section className="worker-filters">
            <label>
              Trade
              <select value={tradeFilter} onChange={(e) => setTradeFilter(e.target.value)}>
                <option>All</option>
                {TRADES.map((trade) => (
                  <option key={trade}>{trade}</option>
                ))}
              </select>
            </label>

            <label>
              Base site
              <select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}>
                <option>All</option>
                {BASE_SITES.map((site) => (
                  <option key={site}>{site}</option>
                ))}
              </select>
            </label>

            <label className="inline-check">
              <input
                type="checkbox"
                checked={hideUnavailable}
                onChange={(e) => setHideUnavailable(e.target.checked)}
              />
              Hide workers fully unavailable this week
            </label>

            <button
              className="ghost"
              onClick={() => {
                setTradeFilter("All");
                setSiteFilter("All");
                setHideUnavailable(false);
              }}
            >
              Clear filters
            </button>
          </section>

          <div className="calendar-wrap">
            <div className="calendar-grid" style={{ "--day-count": days.length }}>
              <div className="corner-cell">
                <span>Workers</span>
              </div>

              {days.map((day) => (
                <div key={getIsoDate(day)} className={`day-header ${isToday(day) ? "today" : ""}`}>
                  <strong>{formatDayName(day)}</strong>
                  <span>{formatDateHeader(day)}</span>
                </div>
              ))}

              {visibleWorkers.map((member) => (
                <React.Fragment key={member.id}>
                  <div
                    className="worker-cell"
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const jobId = getDraggedJobId(e);
                      if (jobId) addWorkerToJob(jobId, member.id);
                      setDraggedJobId(null);
                    }}
                  >
                    <button
                      className="worker-profile-button"
                      onClick={() => setEditingWorker(member)}
                      title="View or edit worker"
                    >
                      <strong>{member.name || "Unnamed worker"}</strong>
                      <span>{member.trade || "No trade"} · {member.baseSite || "No site"}</span>
                      {member.employeeNumber && <em>{member.employeeNumber}</em>}
                    </button>

                    <button title="Remove worker" onClick={() => removeTeamMember(member.id)}>
                      <X size={15} />
                    </button>
                  </div>

                  {days.map((day) => {
                    const iso = getIsoDate(day);
                    const availability = getWorkerAvailability(member, iso, data.leaveRecords);
                    const dayLeaves = data.leaveRecords.filter(
                      (leave) =>
                        leave.workerId === member.id &&
                        isDateWithinRange(iso, leave.startDate, leave.endDate)
                    );

                    const cellJobs = scheduledJobs.filter(
                      (job) =>
                        Array.isArray(job.assignedTo) &&
                        job.assignedTo.includes(member.id) &&
                        isDateWithinRange(iso, job.startDate, job.endDate)
                    );

                    return (
                      <div
                        key={`${member.id}-${iso}`}
                        className={`calendar-cell ${isToday(day) ? "today-cell" : ""} ${
                          availability.status === "Onsite" ? "onsite-cell" : "rnr-cell"
                        }`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const jobId = getDraggedJobId(e);
                          if (jobId) scheduleJob(jobId, member.id, iso);
                          setDraggedJobId(null);
                        }}
                      >
                        <div
                          className={`roster-badge ${
                            availability.status === "Onsite" ? "onsite" : "rnr"
                          }`}
                        >
                          {availability.label}
                        </div>

                        <button
                          className="add-cell-job"
                          onClick={() =>
                            setCalendarPopup({
                              workerId: member.id,
                              workerName: member.name,
                              date: iso
                            })
                          }
                        >
                          <Plus size={14} /> Item
                        </button>

                        <div className="cell-jobs">
                          {dayLeaves.map((leave) => (
                            <LeaveCard
                              key={leave.id}
                              leave={leave}
                              isStart={leave.startDate === iso}
                              onDelete={() => deleteLeave(leave.id)}
                            />
                          ))}

                          {cellJobs.map((job) => {
                            const isStart = job.startDate === iso;
                            const isEnd = job.endDate === iso;

                            return (
                              <CalendarJob
                                key={`${job.id}-${member.id}-${iso}`}
                                job={job}
                                isStart={isStart}
                                isEnd={isEnd}
                                workerNames={getAssignedWorkerNames(data.teamMembers, job.assignedTo)}
                                onDragStart={(e) => handleDragStart(e, job.id)}
                                onEdit={() => setEditingJob(job)}
                                onDelete={() => deleteJob(job.id)}
                                onExtend={() => extendJob(job.id, iso)}
                                onToggleAppointmentSent={() =>
                                  toggleJobCheckbox(job.id, "appointmentSent")
                                }
                                onToggleClientAccepted={() =>
                                  toggleJobCheckbox(job.id, "clientAccepted")
                                }
                                hasUnreadMessage={(data.messages || []).some((message) => message.jobId === job.id && !message.read)}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="footer-actions">
        <button className="ghost" onClick={resetDemoData}>
          Reset demo data
        </button>
      </footer>

      {editingJob && (
        <JobModal
          job={editingJob}
          teamMembers={data.teamMembers}
          onClose={() => setEditingJob(null)}
          onSave={saveJob}
          onSendMessage={recordSmsDemo}
          onViewHistory={(jobToView) => setJobHistoryJob(jobToView)}
        />
      )}

      {editingWorker && (
        <WorkerModal
          worker={editingWorker}
          onClose={() => setEditingWorker(null)}
          onSave={saveWorker}
        />
      )}

      {calendarPopup && (
        <CalendarItemModal
          context={calendarPopup}
          onClose={() => setCalendarPopup(null)}
          onSave={saveCalendarItem}
        />
      )}

      {shareModalOpen && (
        <ShareScheduleModal
          exportStartDate={exportStartDate}
          setExportStartDate={setExportStartDate}
          exportEndDate={exportEndDate}
          setExportEndDate={setExportEndDate}
          emailPeriod={emailPeriod}
          setEmailPeriod={setEmailPeriod}
          emailRecipients={emailRecipients}
          setEmailRecipients={setEmailRecipients}
          onExport={exportCalendarToExcel}
          onEmail={sendScheduleEmailDemo}
          onClose={() => setShareModalOpen(false)}
        />
      )}

      {messagesOpen && (
        <MessagesModal
          messages={data.messages || []}
          jobs={data.jobs}
          onOpenMessage={openMessage}
          onClose={() => setMessagesOpen(false)}
        />
      )}

      {jobHistoryJob && (
        <JobHistoryModal
          job={jobHistoryJob}
          onClose={() => setJobHistoryJob(null)}
        />
      )}
    </div>
  );
}

function CalendarJob({
  job,
  isStart,
  isEnd,
  workerNames,
  onDragStart,
  onEdit,
  onDelete,
  onExtend,
  onToggleAppointmentSent,
  onToggleClientAccepted,
  hasUnreadMessage
}) {
  return (
    <article
      className={`calendar-job ${job.isAdHoc ? "ad-hoc" : ""} ${job.isTravelComment ? "travel-comment" : ""} ${
        isStart ? "range-start" : "range-middle"
      } ${isEnd ? "range-end" : ""}`}
      draggable
      onDragStart={onDragStart}
    >
      <div className="range-body">
        {hasUnreadMessage && <span className="job-envelope" title="Unread message"><Mail size={13} /></span>}
        {isStart ? (
          <>
            <div className="card-top">
              <span className="wo">{job.isTravelComment ? "Travel" : job.isAdHoc ? "Ad hoc" : job.workOrderNumber || job.jobNumber || "No WO"}</span>
              <div className="card-actions">
                <button onClick={onEdit} title="Edit job">
                  <Pencil size={14} />
                </button>
                <button onClick={onDelete} title="Delete job">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <h3>{job.title || "Untitled job"}</h3>

            {!job.isAdHoc && (
              <div className="meta">
                {job.address && <span>{job.address}</span>}
                {job.clientContact && <span>{job.clientContact}</span>}
              </div>
            )}

            {workerNames && <p>{workerNames}</p>}

            {!job.isAdHoc && (
              <div className="appointment-checks">
                <label>
                  <input
                    type="checkbox"
                    checked={Boolean(job.appointmentSent)}
                    onChange={onToggleAppointmentSent}
                  />
                  SMS sent
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={Boolean(job.clientAccepted)}
                    onChange={onToggleClientAccepted}
                  />
                  Client accepted
                </label>
              </div>
            )}
          </>
        ) : (
          <div className="continuation">
            <GripVertical size={14} />
            <span>{job.workOrderNumber || job.title}</span>
          </div>
        )}

        <button className="resize-handle" title="Extend job to this day" onClick={onExtend}>
          ↔
        </button>
      </div>
    </article>
  );
}

function LeaveCard({ leave, isStart, onDelete }) {
  return (
    <article className="leave-card">
      <div className="card-top">
        <span className="leave-pill">{leave.leaveType}</span>
        {isStart && (
          <button onClick={onDelete} title="Delete leave">
            <Trash2 size={14} />
          </button>
        )}
      </div>
      {isStart && leave.notes && <p>{leave.notes}</p>}
    </article>
  );
}

function JobCard({ job, onDragStart, onEdit, onDelete, compact = false, workerNames = "" }) {
  return (
    <article className={`card ${compact ? "compact" : ""}`} draggable onDragStart={onDragStart}>
      <div className="card-top">
        <span className="category-pill">{job.category}</span>

        <div className="card-actions">
          <button onClick={onEdit} title="Edit job">
            <Pencil size={14} />
          </button>
          <button onClick={onDelete} title="Delete job">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <h3>{job.title || "Untitled job"}</h3>

      <div className="details">
        {job.jobNumber && <span><b>JB:</b> {job.jobNumber}</span>}
        {job.workOrderNumber && <span><b>WO:</b> {job.workOrderNumber}</span>}
        {job.poNumber && <span><b>PO:</b> {job.poNumber}</span>}
        {job.address && <span><b>Address:</b> {job.address}</span>}
        {workerNames && <span><b>Workers:</b> {workerNames}</span>}
      </div>

      {job.notes && <p>{job.notes}</p>}
    </article>
  );
}

function JobModal({ job, teamMembers, onClose, onSave, onSendMessage, onViewHistory }) {
  const [form, setForm] = useState(job);
  const [activeTab, setActiveTab] = useState("details");
  const [noteInput, setNoteInput] = useState("");
  const [pdfPreview, setPdfPreview] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);

  const noteCount = Array.isArray(form.noteHistory) ? form.noteHistory.length : 0;
  const historyCount = Array.isArray(form.jobHistory) ? form.jobHistory.length : 0;

  function update(field, value) {
    setForm({ ...form, [field]: value });
  }

  function toggleWorker(workerId) {
    const assigned = Array.isArray(form.assignedTo) ? form.assignedTo : [];

    const next = assigned.includes(workerId)
      ? assigned.filter((id) => id !== workerId)
      : [...assigned, workerId];

    update("assignedTo", next);
  }

  async function importPdf(file) {
    if (!file) return;

    try {
      setPdfBusy(true);
      const text = await extractTextFromPdf(file);
      const parsed = parseAimJobSheet(text);

      setPdfPreview(text.slice(0, 3000));

      setForm((current) => ({
        ...current,
        ...parsed,
        category: current.category || "To be scheduled",
        notes: parsed.notes || current.notes
      }));
      setActiveTab("details");
    } catch (error) {
      console.error(error);
      alert("The PDF could not be read. It may be scanned/image-based or in an unsupported format.");
    } finally {
      setPdfBusy(false);
    }
  }

  function sendMockSms() {
    const sent = onSendMessage(form);
    if (sent) {
      update("appointmentSent", true);
    }
  }

  function addHistoryNote() {
    if (!noteInput.trim()) return;

    setForm((current) => ({
      ...current,
      noteHistory: [
        { id: createId(), date: new Date().toISOString(), text: noteInput.trim() },
        ...(Array.isArray(current.noteHistory) ? current.noteHistory : [])
      ]
    }));
    setNoteInput("");
  }

  function submit(e) {
    e.preventDefault();

    if (!form.title.trim()) {
      alert("Please enter a job title.");
      setActiveTab("details");
      return;
    }

    onSave(form);
  }

  return (
    <div className="modal-backdrop">
      <form className="modal job-modal-tabs" onSubmit={submit}>
        <div className="modal-header clean-modal-header">
          <div>
            <h2>{job.title ? "Edit job" : "New job"}</h2>
            <p>{form.jobNumber || form.workOrderNumber || form.poNumber || "Job details"}</p>
          </div>
          <button type="button" className="icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="job-tab-bar">
          <button type="button" className={activeTab === "details" ? "active" : ""} onClick={() => setActiveTab("details")}>
            Details
          </button>
          <button type="button" className={activeTab === "schedule" ? "active" : ""} onClick={() => setActiveTab("schedule")}>
            Scheduling
          </button>
          <button type="button" className={activeTab === "client" ? "active" : ""} onClick={() => setActiveTab("client")}>
            Client / SMS
          </button>
          <button type="button" className={activeTab === "notes" ? "active" : ""} onClick={() => setActiveTab("notes")}>
            Notes {noteCount > 0 && <span>{noteCount}</span>}
          </button>
          <button type="button" className={activeTab === "history" ? "active" : ""} onClick={() => setActiveTab("history")}>
            History {historyCount > 0 && <span>{historyCount}</span>}
          </button>
        </div>

        {activeTab === "details" && (
          <section className="job-tab-panel">
            <div className="pdf-import-box compact-import">
              <label className="pdf-upload">
                <Upload size={16} />
                <span>{pdfBusy ? "Reading PDF..." : "Import AIM job sheet PDF"}</span>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => importPdf(e.target.files?.[0])}
                />
              </label>
              <small>Fills title, address, JB number, QUO, WO, PO and scope notes.</small>
            </div>

            <label>
              Job title
              <input value={form.title} onChange={(e) => update("title", e.target.value)} />
            </label>

            <div className="two-col">
              <label>
                Job number
                <input value={form.jobNumber || ""} onChange={(e) => update("jobNumber", e.target.value)} />
              </label>

              <label>
                Quote number
                <input value={form.quoteNumber || ""} onChange={(e) => update("quoteNumber", e.target.value)} />
              </label>
            </div>

            <div className="two-col">
              <label>
                Work order number
                <input
                  value={form.workOrderNumber || ""}
                  onChange={(e) => update("workOrderNumber", e.target.value)}
                />
              </label>

              <label>
                PO number
                <input value={form.poNumber || ""} onChange={(e) => update("poNumber", e.target.value)} />
              </label>
            </div>

            <label>
              Address
              <input value={form.address || ""} onChange={(e) => update("address", e.target.value)} />
            </label>

            {pdfPreview && (
              <details className="pdf-preview">
                <summary>PDF extracted text preview</summary>
                <pre>{pdfPreview}</pre>
              </details>
            )}
          </section>
        )}

        {activeTab === "schedule" && (
          <section className="job-tab-panel">
            <div className="two-col">
              <label>
                Category
                <select value={form.category} onChange={(e) => update("category", e.target.value)}>
                  {CATEGORIES.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </label>

              <label>
                Start date
                <input type="date" value={form.startDate} onChange={(e) => update("startDate", e.target.value)} />
              </label>
            </div>

            <div className="two-col">
              <label>
                End date
                <input type="date" value={form.endDate} onChange={(e) => update("endDate", e.target.value)} />
              </label>
              <div className="form-help-box">
                <strong>Scheduling note</strong>
                <span>Assign workers here, or drag the job from the bucket onto the calendar.</span>
              </div>
            </div>

            <div className="worker-picker">
              <strong>Assigned workers</strong>

              <div className="worker-options">
                {teamMembers.map((member) => (
                  <label key={member.id} className="check-option">
                    <input
                      type="checkbox"
                      checked={Array.isArray(form.assignedTo) && form.assignedTo.includes(member.id)}
                      onChange={() => toggleWorker(member.id)}
                    />
                    {member.name}
                  </label>
                ))}
              </div>
            </div>
          </section>
        )}

        {activeTab === "client" && (
          <section className="job-tab-panel">
            <div className="two-col">
              <label>
                Client contact
                <input
                  value={form.clientContact || ""}
                  onChange={(e) => update("clientContact", e.target.value)}
                />
              </label>

              <label>
                Client phone
                <input value={form.clientPhone || ""} onChange={(e) => update("clientPhone", e.target.value)} />
              </label>
            </div>

            <div className="appointment-panel clean-appointment-panel">
              <label className="check-option plain">
                <input
                  type="checkbox"
                  checked={Boolean(form.appointmentSent)}
                  onChange={(e) => update("appointmentSent", e.target.checked)}
                />
                Appointment SMS sent
              </label>

              <label className="check-option plain">
                <input
                  type="checkbox"
                  checked={Boolean(form.clientAccepted)}
                  onChange={(e) => update("clientAccepted", e.target.checked)}
                />
                Client accepted appointment
              </label>

              <button type="button" className="secondary" onClick={sendMockSms}>
                <MessageSquare size={16} /> Open SMS message
              </button>
            </div>
          </section>
        )}

        {activeTab === "notes" && (
          <section className="job-tab-panel">
            <label>
              Current notes / scope
              <textarea rows="7" value={form.notes} onChange={(e) => update("notes", e.target.value)} />
            </label>

            <section className="note-history-panel clean-note-panel">
              <div className="note-history-header">
                <strong>Notes history</strong>
                <span>{noteCount} entries</span>
              </div>

              <div className="note-history-add">
                <textarea
                  rows="3"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="Add a dated note, for example: Client confirmed appointment, materials ordered, access issue..."
                />
                <button type="button" className="secondary" onClick={addHistoryNote}>
                  Add note
                </button>
              </div>

              <div className="note-history-list">
                {noteCount > 0 ? (
                  form.noteHistory.map((entry) => (
                    <article key={entry.id}>
                      <strong>{formatDateTime(entry.date)}</strong>
                      <p>{entry.text}</p>
                    </article>
                  ))
                ) : (
                  <div className="empty small">No history notes yet</div>
                )}
              </div>
            </section>
          </section>
        )}

        {activeTab === "history" && (
          <section className="job-tab-panel">
            <div className="history-tab-actions">
              <div>
                <strong>Job change history</strong>
                <span>Demo history now. With a backend this will record the actual logged-in user.</span>
              </div>
              <button type="button" className="secondary compact-button" onClick={() => onViewHistory(form)}>
                <History size={15} /> Open full history
              </button>
            </div>

            <div className="history-list embedded-history-list">
              {historyCount > 0 ? (
                form.jobHistory.slice(0, 8).map((entry) => (
                  <article key={entry.id}>
                    <div>
                      <strong>{entry.action}</strong>
                      <span>{formatDateTime(entry.date)} · {entry.user || "Demo User"}</span>
                    </div>
                    <p>{entry.details}</p>
                  </article>
                ))
              ) : (
                <div className="empty small">No job history yet</div>
              )}
            </div>
          </section>
        )}

        <div className="modal-actions sticky-modal-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary">
            Save job
          </button>
        </div>
      </form>
    </div>
  );
}

function CalendarItemModal({ context, onClose, onSave }) {
  const [mode, setMode] = useState("");
  const [adHocText, setAdHocText] = useState("");
  const [leaveType, setLeaveType] = useState("Sick leave");
  const [startDate, setStartDate] = useState(context.date);
  const [endDate, setEndDate] = useState(context.date);
  const [leaveNotes, setLeaveNotes] = useState("");

  function submit(e) {
    e.preventDefault();

    if (!mode) {
      alert("Choose Ad hoc job or Leave.");
      return;
    }

    if (compareIsoDates(endDate, startDate) < 0) {
      alert("End date cannot be before start date.");
      return;
    }

    if (mode === "adHoc") {
      if (!adHocText.trim()) {
        alert("Enter the ad hoc task details.");
        return;
      }

      onSave({
        type: "adHoc",
        workerId: context.workerId,
        text: adHocText.trim(),
        startDate,
        endDate
      });
    }

    if (mode === "travel") {
      if (!adHocText.trim()) {
        alert("Enter the travel/accommodation comments.");
        return;
      }

      onSave({
        type: "travel",
        workerId: context.workerId,
        text: adHocText.trim(),
        startDate,
        endDate
      });
    }

    if (mode === "leave") {
      onSave({
        type: "leave",
        workerId: context.workerId,
        leaveType,
        startDate,
        endDate,
        notes: leaveNotes.trim()
      });
    }
  }

  return (
    <div className="modal-backdrop">
      <form className="modal mini-modal" onSubmit={submit}>
        <div className="modal-header">
          <h2>Add calendar item</h2>
          <button type="button" className="icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <p className="modal-note">
          {context.workerName} · {formatIsoForDisplay(context.date)}
        </p>

        <div className="choice-grid">
          <button
            type="button"
            className={mode === "adHoc" ? "choice-card active" : "choice-card"}
            onClick={() => setMode("adHoc")}
          >
            <Wrench size={22} />
            <strong>Create ad hoc job</strong>
            <span>Simple task such as pack away stock or collect materials.</span>
          </button>

          <button
            type="button"
            className={mode === "leave" ? "choice-card active" : "choice-card"}
            onClick={() => setMode("leave")}
          >
            <CalendarX size={22} />
            <strong>Enter leave</strong>
            <span>Sick leave, annual leave or other leave over a date range.</span>
          </button>

          <button
            type="button"
            className={mode === "travel" ? "choice-card active" : "choice-card"}
            onClick={() => setMode("travel")}
          >
            <Plane size={22} />
            <strong>Travel and accommodation comments</strong>
            <span>Add travel, flights, accommodation or mobilisation notes.</span>
          </button>
        </div>

        {mode === "adHoc" && (
          <>
            <div className="two-col">
              <label>
                Start date
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </label>
              <label>
                End date
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </label>
            </div>

            <label>
              Ad hoc task details
              <textarea
                rows="5"
                value={adHocText}
                onChange={(e) => setAdHocText(e.target.value)}
                placeholder="Example: Pack away stock, clean workshop, collect materials..."
              />
            </label>
          </>
        )}

        {mode === "travel" && (
          <>
            <div className="two-col">
              <label>
                Start date
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </label>
              <label>
                End date
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </label>
            </div>

            <label>
              Travel and accommodation comments
              <textarea
                rows="5"
                value={adHocText}
                onChange={(e) => setAdHocText(e.target.value)}
                placeholder="Example: Book camp accommodation, arrange travel, flight details, mobilisation notes..."
              />
            </label>
          </>
        )}

        {mode === "leave" && (
          <>
            <label>
              Leave type
              <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
                {LEAVE_TYPES.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>

            <div className="two-col">
              <label>
                Start date
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </label>
              <label>
                End date
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </label>
            </div>

            <label>
              Leave notes
              <textarea
                rows="4"
                value={leaveNotes}
                onChange={(e) => setLeaveNotes(e.target.value)}
                placeholder="Optional notes"
              />
            </label>
          </>
        )}

        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary">
            Save item
          </button>
        </div>
      </form>
    </div>
  );
}


function ShareScheduleModal({
  exportStartDate,
  setExportStartDate,
  exportEndDate,
  setExportEndDate,
  emailPeriod,
  setEmailPeriod,
  emailRecipients,
  setEmailRecipients,
  onExport,
  onEmail,
  onClose
}) {
  return (
    <div className="modal-backdrop">
      <div className="modal mini-modal">
        <div className="modal-header">
          <h2>Share schedule</h2>
          <button type="button" className="icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <section className="share-section">
          <h3>Export to Excel</h3>
          <div className="two-col">
            <label>
              From
              <input
                type="date"
                value={exportStartDate}
                onChange={(e) => setExportStartDate(e.target.value)}
              />
            </label>
            <label>
              To
              <input
                type="date"
                value={exportEndDate}
                onChange={(e) => setExportEndDate(e.target.value)}
              />
            </label>
          </div>
          <button type="button" className="secondary" onClick={onExport}>
            <Download size={16} /> Export Excel
          </button>
        </section>

        <section className="share-section">
          <h3>Share by email demo</h3>
          <div className="two-col">
            <label>
              Period
              <select value={emailPeriod} onChange={(e) => setEmailPeriod(e.target.value)}>
                <option value="nextDay">Next day</option>
                <option value="week">Next week</option>
                <option value="fortnight">Next fortnight</option>
              </select>
            </label>
            <label>
              Recipients
              <select value={emailRecipients} onChange={(e) => setEmailRecipients(e.target.value)}>
                <option value="all">All workers</option>
                <option value="onsite">Workers onsite in period</option>
              </select>
            </label>
          </div>
          <button type="button" className="secondary" onClick={onEmail}>
            <Send size={16} /> Open email
          </button>
        </section>

        <div className="modal-actions">
          <button type="button" className="primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

function MessagesModal({ messages, jobs, onOpenMessage, onClose }) {
  const sorted = [...messages].sort((a, b) => String(b.date).localeCompare(String(a.date)));

  return (
    <div className="modal-backdrop">
      <div className="modal messages-modal">
        <div className="modal-header">
          <h2>Messages</h2>
          <button type="button" className="icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="message-list">
          {sorted.length ? (
            sorted.map((message) => {
              const job = jobs.find((item) => item.id === message.jobId);
              return (
                <article key={message.id} className={message.read ? "message-card" : "message-card unread"}>
                  <div className="message-card-head">
                    <div>
                      <strong>{message.direction === "incoming" ? "Incoming" : "Outgoing"}</strong>
                      <span>{formatDateTime(message.date)}</span>
                    </div>
                    {!message.read && <em>Unread</em>}
                  </div>
                  <p>{message.body}</p>
                  {job && <small>Linked job: {job.title}</small>}
                  <button type="button" className="secondary" onClick={() => onOpenMessage(message)}>
                    <MailOpen size={16} /> Read message
                  </button>
                </article>
              );
            })
          ) : (
            <div className="empty small">No messages yet. Sending an SMS demo from a job will create a demo inbox reply.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function JobHistoryModal({ job, onClose }) {
  const history = Array.isArray(job.jobHistory) ? job.jobHistory : [];

  return (
    <div className="modal-backdrop">
      <div className="modal mini-modal">
        <div className="modal-header">
          <h2>Job history</h2>
          <button type="button" className="icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <p className="modal-note">{job.title || "Untitled job"}</p>

        <div className="history-list">
          {history.length ? (
            history.map((entry) => (
              <article key={entry.id}>
                <div>
                  <strong>{entry.action}</strong>
                  <span>{formatDateTime(entry.date)}</span>
                </div>
                <p>{entry.details}</p>
                <em>By {entry.user || "Demo User"}</em>
              </article>
            ))
          ) : (
            <div className="empty small">No tracked changes yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function WorkerModal({ worker, onClose, onSave }) {
  const [form, setForm] = useState(worker);

  function update(field, value) {
    setForm({ ...form, [field]: value });
  }

  function submit(e) {
    e.preventDefault();

    if (!form.name.trim()) {
      alert("Please enter a worker name.");
      return;
    }

    onSave(form);
  }

  return (
    <div className="modal-backdrop">
      <form className="modal worker-modal" onSubmit={submit}>
        <div className="modal-header">
          <h2>Worker profile</h2>
          <button type="button" className="icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="two-col">
          <label>
            Name
            <input value={form.name} onChange={(e) => update("name", e.target.value)} />
          </label>

          <label>
            Trade
            <select value={form.trade || ""} onChange={(e) => update("trade", e.target.value)}>
              <option value="">Select trade</option>
              {TRADES.map((trade) => (
                <option key={trade}>{trade}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="two-col">
          <label>
            Base site
            <select value={form.baseSite || ""} onChange={(e) => update("baseSite", e.target.value)}>
              <option value="">Select site</option>
              {BASE_SITES.map((site) => (
                <option key={site}>{site}</option>
              ))}
            </select>
          </label>

          <label>
            Employee number
            <input
              value={form.employeeNumber}
              onChange={(e) => update("employeeNumber", e.target.value)}
            />
          </label>
        </div>

        <div className="two-col">
          <label>
            Contact number
            <input value={form.phone} onChange={(e) => update("phone", e.target.value)} />
          </label>

          <label>
            Email
            <input value={form.email} onChange={(e) => update("email", e.target.value)} />
          </label>
        </div>

        <div className="two-col">
          <label>
            Roster pattern
            <select
              value={form.rosterPattern || "NONE"}
              onChange={(e) => update("rosterPattern", e.target.value)}
            >
              {ROSTER_PATTERNS.map((pattern) => (
                <option key={pattern.id} value={pattern.id}>
                  {pattern.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Roster start date
            <input
              type="date"
              value={form.rosterStartDate || ""}
              onChange={(e) => update("rosterStartDate", e.target.value)}
            />
          </label>
        </div>

        <div className="worker-summary">
          <div>
            <Phone size={15} />
            <span>{form.phone || "No phone number entered"}</span>
          </div>
          <div>
            <Mail size={15} />
            <span>{form.email || "No email entered"}</span>
          </div>
          <div>
            <BadgeCheck size={15} />
            <span>{form.employeeNumber || "No employee number entered"}</span>
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary">
            Save worker
          </button>
        </div>
      </form>
    </div>
  );
}

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function emptyJob(defaults = {}) {
  const start = defaults.startDate ?? "";

  return normaliseJob({
    id: createId(),
    title: "",
    jobNumber: "",
    quoteNumber: "",
    workOrderNumber: "",
    poNumber: "",
    address: "",
    clientContact: "",
    clientPhone: "",
    category: start ? "Scheduled" : "To be scheduled",
    assignedTo: [],
    startDate: start,
    endDate: defaults.endDate ?? start,
    appointmentSent: false,
    clientAccepted: false,
    notes: "",
    isAdHoc: false,
    ...defaults
  });
}

function emptyWorker() {
  return {
    id: "worker-" + createId(),
    name: "",
    trade: "",
    baseSite: "",
    phone: "",
    email: "",
    employeeNumber: "",
    rosterPattern: "NONE",
    rosterStartDate: ""
  };
}

function normaliseJob(job) {
  return {
    jobNumber: "",
    quoteNumber: "",
    workOrderNumber: "",
    poNumber: "",
    clientPhone: "",
    appointmentSent: false,
    clientAccepted: false,
    noteHistory: [],
    jobHistory: [],
    isAdHoc: false,
    isTravelComment: false,
    ...job,
    noteHistory: Array.isArray(job.noteHistory) ? job.noteHistory : [],
    jobHistory: Array.isArray(job.jobHistory) ? job.jobHistory : [],
    assignedTo: Array.isArray(job.assignedTo) ? job.assignedTo : [],
    endDate: job.endDate || job.startDate || ""
  };
}

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return initialData;

    const parsed = JSON.parse(saved);

    return {
      ...parsed,
      teamMembers: (parsed.teamMembers || []).map((worker) => ({
        trade: worker.trade || worker.role || "",
        baseSite: "",
        phone: "",
        email: "",
        employeeNumber: "",
        rosterPattern: "NONE",
        rosterStartDate: "",
        ...worker
      })),
      jobs: (parsed.jobs || []).map((job) => normaliseJob(job)),
      leaveRecords: parsed.leaveRecords || [],
      messages: parsed.messages || []
    };
  } catch {
    return initialData;
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

async function extractTextFromPdf(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pageTexts = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map((item) => item.str).join("\n");
    pageTexts.push(text);
  }

  return pageTexts.join("\n\n");
}

function parseAimJobSheet(text) {
  const compact = text.replace(/\r/g, "\n").replace(/[ \t]+/g, " ").replace(/\n+/g, "\n").trim();

  const clientRaw = extractClientName(compact);
  const addressRaw = extractBetween(compact, "Job Address", "Reference");
  const referenceRaw =
    extractBetween(compact, "Reference", "Job Number") ||
    extractBetween(compact, "Reference", "Notes");

  const jobNumber =
    matchFirst(compact, /Job Number\s+([A-Z]{1,4}\d{3,})/i) ||
    matchFirst(compact, /\b(JB\s*\d{3,})\b/i);

  const quoteNumber = matchFirst(compact, /\b(QUO\s*\d+)\b/i);
  const workOrderNumber =
    matchFirst(compact, /\b(WO\s*\d+)\b/i) ||
    matchFirst(compact, /\b(WO\d+)\b/i);
  const poNumber = matchFirst(compact, /\b(PO\s*[A-Z]?\d+)\b/i);

  const notesSection = extractAfter(compact, "Notes");
  const scope = extractScope(compact);

  return {
    title: cleanReference(referenceRaw),
    address: cleanMultiline(addressRaw),
    clientContact: clientRaw,
    jobNumber: normaliseCode(jobNumber),
    quoteNumber: normaliseCode(quoteNumber),
    workOrderNumber: normaliseCode(workOrderNumber),
    poNumber: normaliseCode(poNumber),
    notes: [scope, notesSection ? `\nPDF notes:\n${notesSection}` : ""]
      .filter(Boolean)
      .join("\n")
      .trim()
  };
}

function extractClientName(text) {
  const match = text.match(/Job Sheet[^\n]*\n([\s\S]*?)\nJob Address/i);
  if (!match) return "";

  const lines = match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const clientLines = [];

  for (const line of lines) {
    if (/^\d+\s+/.test(line)) break;
    if (/^(balcatta|perth|tom price|paraburdoo|karratha)$/i.test(line)) break;
    if (/^western australia/i.test(line)) break;
    if (/^australia$/i.test(line) && clientLines.length > 0 && !/pty|ltd|limited/i.test(clientLines.join(" "))) break;
    clientLines.push(line);
    if (clientLines.length >= 3) break;
  }

  return clientLines.join(" ").replace(/\s+/g, " ").trim();
}

function cleanReference(value) {
  return cleanMultiline(value).replace(/\s+/g, " ").trim();
}

function cleanMultiline(value) {
  return String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(", ")
    .replace(/\s+,/g, ",")
    .trim();
}

function extractBetween(text, startLabel, endLabel) {
  const start = text.toLowerCase().indexOf(startLabel.toLowerCase());
  if (start === -1) return "";

  const afterStart = text.slice(start + startLabel.length);
  const end = afterStart.toLowerCase().indexOf(endLabel.toLowerCase());

  if (end === -1) return afterStart.trim();
  return afterStart.slice(0, end).trim();
}

function extractAfter(text, label) {
  const start = text.toLowerCase().indexOf(label.toLowerCase());
  if (start === -1) return "";

  return text
    .slice(start + label.length)
    .replace(/\b\d+\s*\/\s*\d+\b/g, "")
    .trim();
}

function extractScope(text) {
  const jobNumberMatch = text.match(/Job Number\s+[A-Z]{1,4}\d{3,}/i);
  const notesIndex = text.toLowerCase().indexOf("notes");

  if (!jobNumberMatch || notesIndex === -1 || notesIndex <= jobNumberMatch.index) {
    return "";
  }

  return text
    .slice(jobNumberMatch.index + jobNumberMatch[0].length, notesIndex)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function matchFirst(text, regex) {
  const match = text.match(regex);
  return match ? match[1] : "";
}

function normaliseCode(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toUpperCase();
}


function withJobHistory(job, action, details) {
  return {
    ...job,
    jobHistory: [
      {
        id: createId(),
        date: new Date().toISOString(),
        user: "Demo User",
        action,
        details
      },
      ...(Array.isArray(job.jobHistory) ? job.jobHistory : [])
    ]
  };
}

function describeJobChanges(before, after) {
  const changes = [];

  const fields = [
    ["category", "Status"],
    ["startDate", "Start date"],
    ["endDate", "End date"],
    ["clientAccepted", "Client accepted"],
    ["appointmentSent", "SMS sent"],
    ["title", "Title"],
    ["address", "Address"],
    ["workOrderNumber", "Work order"],
    ["poNumber", "PO number"]
  ];

  for (const [field, label] of fields) {
    if (String(before[field] ?? "") !== String(after[field] ?? "")) {
      changes.push(`${label}: ${before[field] || "blank"} → ${after[field] || "blank"}`);
    }
  }

  const beforeAssigned = (before.assignedTo || []).join(",");
  const afterAssigned = (after.assignedTo || []).join(",");
  if (beforeAssigned !== afterAssigned) {
    changes.push("Assigned workers changed");
  }

  return changes;
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function getStartOfWeek(date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + mondayOffset);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function getIsoDate(date) {
  const copy = new Date(date);
  const year = copy.getFullYear();
  const month = String(copy.getMonth() + 1).padStart(2, "0");
  const day = String(copy.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysBetween(startDate, targetDate) {
  const start = new Date(startDate + "T00:00:00");
  const target = new Date(targetDate + "T00:00:00");
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((target - start) / msPerDay);
}

function getRosterStatus(worker, isoDate) {
  if (!worker.rosterPattern || worker.rosterPattern === "NONE") return "Onsite";
  if (!worker.rosterStartDate) return "Onsite";

  const pattern = ROSTER_PATTERNS.find((p) => p.id === worker.rosterPattern);
  if (!pattern || !pattern.onDays || !pattern.offDays) return "Onsite";

  const cycleLength = pattern.onDays + pattern.offDays;
  const difference = daysBetween(worker.rosterStartDate, isoDate);
  const dayInCycle = ((difference % cycleLength) + cycleLength) % cycleLength;

  return dayInCycle < pattern.onDays ? "Onsite" : "RNR";
}

function getWorkerAvailability(worker, isoDate, leaveRecords) {
  const leave = leaveRecords.find(
    (item) =>
      item.workerId === worker.id &&
      isDateWithinRange(isoDate, item.startDate, item.endDate)
  );

  if (leave) {
    return {
      status: "Leave",
      label: leave.leaveType
    };
  }

  const rosterStatus = getRosterStatus(worker, isoDate);

  return {
    status: rosterStatus,
    label: rosterStatus
  };
}

function getDatesInRange(startDate, endDate) {
  const dates = [];
  let current = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");

  while (current <= end) {
    dates.push(getIsoDate(current));
    current = addDays(current, 1);
  }

  return dates;
}

function buildScheduleRows({ startDate, endDate, workers, jobs, leaveRecords }) {
  const rows = [];

  for (const date of getDatesInRange(startDate, endDate)) {
    for (const worker of workers) {
      const availability = getWorkerAvailability(worker, date, leaveRecords);
      const workerJobs = jobs.filter(
        (job) =>
          Array.isArray(job.assignedTo) &&
          job.assignedTo.includes(worker.id) &&
          isDateWithinRange(date, job.startDate, job.endDate)
      );

      const workerLeave = leaveRecords.filter(
        (leave) => leave.workerId === worker.id && isDateWithinRange(date, leave.startDate, leave.endDate)
      );

      rows.push({
        Date: date,
        Worker: worker.name || "",
        Trade: worker.trade || "",
        Site: worker.baseSite || "",
        Availability: availability.label,
        Leave: workerLeave.map((leave) => leave.leaveType).join(", "),
        Jobs: workerJobs.map((job) => job.title).join(" | "),
        "Job Numbers": workerJobs.map((job) => job.jobNumber).filter(Boolean).join(" | "),
        "Work Orders": workerJobs.map((job) => job.workOrderNumber).filter(Boolean).join(" | "),
        "PO Numbers": workerJobs.map((job) => job.poNumber).filter(Boolean).join(" | "),
        Addresses: workerJobs.map((job) => job.address).filter(Boolean).join(" | "),
        Notes: workerJobs.map((job) => job.notes).filter(Boolean).join(" | ")
      });
    }
  }

  return rows;
}

function buildScheduleEmailBody(rows, startDate, endDate) {
  const grouped = rows.filter((row) => row.Jobs || row.Leave);

  if (!grouped.length) {
    return `Schedule ${startDate} to ${endDate}\n\nNo scheduled jobs or leave found for this period.`;
  }

  return [
    `Schedule ${startDate} to ${endDate}`,
    "",
    ...grouped.map((row) => {
      return `${row.Date} - ${row.Worker} (${row.Availability})\nJobs: ${row.Jobs || "None"}\nLeave: ${row.Leave || "None"}\nWO: ${row["Work Orders"] || "N/A"}\nAddress: ${row.Addresses || "N/A"}`;
    })
  ].join("\n\n");
}


function buildRescheduleSmsMessage(job) {
  const dateText = job.startDate
    ? new Intl.DateTimeFormat("en-AU", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric"
      }).format(new Date(job.startDate + "T00:00:00"))
    : "the new scheduled date";

  return `Hi ${job.clientContact || ""}, your appointment for ${
    job.title || "your job"
  } at ${job.address || "your property"} has been rescheduled to ${dateText}. Please reply to confirm this updated appointment.`;
}

function buildSmsMessage(job) {
  const dateText = job.startDate
    ? new Intl.DateTimeFormat("en-AU", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric"
      }).format(new Date(job.startDate))
    : "the scheduled date";

  return `Hi ${job.clientContact || ""}, this is to confirm your appointment for ${
    job.title || "your job"
  } at ${job.address || "your property"} on ${dateText}. Please reply to confirm this appointment.`;
}

function formatDayName(date) {
  return new Intl.DateTimeFormat("en-AU", { weekday: "short" }).format(date);
}

function formatDateHeader(date) {
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short"
  }).format(date);
}

function formatIsoForDisplay(isoDate) {
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(isoDate + "T00:00:00"));
}

function formatDateTime(value) {
  try {
    return new Intl.DateTimeFormat("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function isToday(date) {
  return getIsoDate(date) === getIsoDate(new Date());
}

function isDateWithinRange(date, start, end) {
  if (!start || !end) return false;
  return compareIsoDates(date, start) >= 0 && compareIsoDates(date, end) <= 0;
}

function compareIsoDates(a, b) {
  return a.localeCompare(b);
}

function getAssignedWorkerNames(teamMembers, ids = []) {
  if (!Array.isArray(ids)) return "";

  return ids
    .map((id) => teamMembers.find((member) => member.id === id)?.name)
    .filter(Boolean)
    .join(", ");
}

createRoot(document.getElementById("root")).render(<App />);
