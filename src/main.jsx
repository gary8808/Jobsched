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
  BadgeCheck
} from "lucide-react";
import "./styles.css";

const STORAGE_KEY = "job-scheduler-calendar-buckets-v2";

const CATEGORIES = [
  "To be scheduled",
  "Awaiting parts",
  "To be rescheduled",
  "Scheduled",
  "Completed"
];

const ROSTER_PATTERNS = [
  { id: "NONE", label: "No roster pattern", onDays: 0, offDays: 0 },
  { id: "5_ON_2_OFF", label: "5 days on / 2 off", onDays: 5, offDays: 2 },
  { id: "8_ON_6_OFF", label: "8 days on / 6 off", onDays: 8, offDays: 6 },
  { id: "14_ON_7_OFF", label: "2 weeks on / 1 off", onDays: 14, offDays: 7 },
  { id: "14_ON_14_OFF", label: "2 weeks on / 2 off", onDays: 14, offDays: 14 }
];

const initialData = {
  teamMembers: [
    {
      id: "gary",
      name: "Gary",
      role: "Supervisor",
      phone: "0400 000 000",
      email: "gary@example.com",
      employeeNumber: "EMP001",
      rosterPattern: "5_ON_2_OFF",
      rosterStartDate: getIsoDate(new Date())
    },
    {
      id: "mick",
      name: "Mick",
      role: "Carpentry",
      phone: "",
      email: "",
      employeeNumber: "EMP002",
      rosterPattern: "8_ON_6_OFF",
      rosterStartDate: getIsoDate(new Date())
    },
    {
      id: "drew",
      name: "Drew",
      role: "Plumbing",
      phone: "",
      email: "",
      employeeNumber: "EMP003",
      rosterPattern: "14_ON_7_OFF",
      rosterStartDate: getIsoDate(new Date())
    },
    {
      id: "gaz",
      name: "Gaz",
      role: "Electrical",
      phone: "",
      email: "",
      employeeNumber: "EMP004",
      rosterPattern: "14_ON_14_OFF",
      rosterStartDate: getIsoDate(new Date())
    }
  ],
  jobs: [
    {
      id: crypto.randomUUID(),
      title: "Repair damaged roller door rail",
      workOrderNumber: "WO-1048",
      address: "Village accommodation, Paraburdoo",
      clientContact: "Steve",
      category: "To be scheduled",
      assignedTo: [],
      startDate: "",
      endDate: "",
      notes: "Cut out damaged RHS, weld new rail, paint welds, demobilise."
    },
    {
      id: crypto.randomUUID(),
      title: "Install Colorbond fencing",
      workOrderNumber: "WO-1052",
      address: "Residential property, Busselton",
      clientContact: "Property Team",
      category: "Awaiting parts",
      assignedTo: [],
      startDate: "",
      endDate: "",
      notes: "Awaiting final material confirmation."
    },
    {
      id: crypto.randomUUID(),
      title: "AC vent patching and painting",
      workOrderNumber: "WO-1061",
      address: "Accommodation unit TBC",
      clientContact: "Amy",
      category: "To be rescheduled",
      assignedTo: ["gary"],
      startDate: getIsoDate(addDays(new Date(), 2)),
      endDate: getIsoDate(addDays(new Date(), 3)),
      notes: "Tenant may need transit room before works proceed."
    }
  ]
};

function App() {
  const [data, setData] = useState(loadData);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [editingJob, setEditingJob] = useState(null);
  const [editingWorker, setEditingWorker] = useState(null);
  const [draggedJobId, setDraggedJobId] = useState(null);
  const [weekStart, setWeekStart] = useState(getStartOfWeek(new Date()));

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  }, [weekStart]);

  const searchMatchedJobs = useMemo(() => {
    const q = query.trim().toLowerCase();

    return data.jobs.filter((job) => {
      return (
        !q ||
        [
          job.title,
          job.workOrderNumber,
          job.address,
          job.clientContact,
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

  const bucketJobs = searchMatchedJobs.filter((job) => {
    const matchesCategory =
      activeCategory === "All" || job.category === activeCategory;

    return (
      matchesCategory &&
      job.category !== "Scheduled" &&
      job.category !== "Completed"
    );
  });

  const scheduledJobs = searchMatchedJobs.filter(
    (job) => job.startDate && job.endDate && job.assignedTo?.length
  );

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

  function saveJob(jobToSave) {
    const normalised = {
      ...jobToSave,
      assignedTo: Array.isArray(jobToSave.assignedTo)
        ? jobToSave.assignedTo
        : [],
      endDate: jobToSave.endDate || jobToSave.startDate || ""
    };

    const exists = data.jobs.some((j) => j.id === normalised.id);

    const nextJobs = exists
      ? data.jobs.map((j) => (j.id === normalised.id ? normalised : j))
      : [normalised, ...data.jobs];

    updateData({ ...data, jobs: nextJobs });
    setEditingJob(null);
  }

  function saveWorker(workerToSave) {
    const normalised = {
      ...workerToSave,
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
    const ok = confirm("Delete this job?");
    if (!ok) return;

    updateData({
      ...data,
      jobs: data.jobs.filter((j) => j.id !== jobId)
    });
  }

  function scheduleJob(jobId, workerId, startDate) {
    updateData({
      ...data,
      jobs: data.jobs.map((job) => {
        if (job.id !== jobId) return job;

        const currentAssigned = Array.isArray(job.assignedTo)
          ? job.assignedTo
          : [];

        const assignedTo = currentAssigned.includes(workerId)
          ? currentAssigned
          : [...currentAssigned, workerId];

        return {
          ...job,
          assignedTo,
          startDate,
          endDate: startDate,
          category: "Scheduled"
        };
      })
    });
  }

  function extendJob(jobId, newEndDate) {
    updateData({
      ...data,
      jobs: data.jobs.map((job) => {
        if (job.id !== jobId) return job;

        const start = job.startDate || newEndDate;
        const end =
          compareIsoDates(newEndDate, start) < 0 ? start : newEndDate;

        return {
          ...job,
          startDate: start,
          endDate: end,
          category: "Scheduled"
        };
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

        return {
          ...job,
          assignedTo: [...currentAssigned, workerId],
          category: job.startDate ? "Scheduled" : job.category
        };
      })
    });
  }

  function moveToBucket(jobId, category) {
    updateData({
      ...data,
      jobs: data.jobs.map((job) =>
        job.id === jobId
          ? {
              ...job,
              category,
              assignedTo: category === "Scheduled" ? job.assignedTo : [],
              startDate: category === "Scheduled" ? job.startDate : "",
              endDate: category === "Scheduled" ? job.endDate : ""
            }
          : job
      )
    });
  }

  function addTeamMember() {
    setEditingWorker(emptyWorker());
  }

  function removeTeamMember(memberId) {
    const ok = confirm(
      "Remove this worker from the calendar? They will also be removed from assigned jobs."
    );
    if (!ok) return;

    updateData({
      teamMembers: data.teamMembers.filter((m) => m.id !== memberId),
      jobs: data.jobs.map((job) => ({
        ...job,
        assignedTo: Array.isArray(job.assignedTo)
          ? job.assignedTo.filter((id) => id !== memberId)
          : []
      }))
    });
  }

  function resetDemoData() {
    const ok = confirm("Reset all jobs and workers to demo data?");
    if (!ok) return;

    updateData(initialData);
    setWeekStart(getStartOfWeek(new Date()));
  }

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>Job Scheduler</h1>
          <p>Store jobs in buckets, then drag them onto the worker calendar.</p>
        </div>

        <div className="actions">
          <button className="secondary" onClick={addTeamMember}>
            <Users size={16} /> Add worker
          </button>
          <button className="primary" onClick={() => addJob()}>
            <Plus size={16} /> New job
          </button>
        </div>
      </header>

      <section className="toolbar">
        <div className="search">
          <Search size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, work order, address, contact..."
          />
        </div>

        <div className="week-controls">
          <button
            className="secondary"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
          >
            <ChevronLeft size={16} /> Previous
          </button>

          <button
            className="secondary"
            onClick={() => setWeekStart(getStartOfWeek(new Date()))}
          >
            This week
          </button>

          <button
            className="secondary"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
          >
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
              <span>{bucketJobs.length} visible jobs</span>
            </div>
          </div>

          <div className="category-filter">
            {["All", ...CATEGORIES].map((category) => (
              <button
                key={category}
                className={activeCategory === category ? "active" : ""}
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="bucket-dropzones">
            {CATEGORIES.filter((category) => category !== "Scheduled").map(
              (category) => {
                const categoryJobs = bucketJobs.filter(
                  (job) => job.category === category
                );

                return (
                  <section
                    key={category}
                    className="bucket-section"
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();

                      const jobId = getDraggedJobId(e);

                      if (jobId) {
                        moveToBucket(jobId, category);
                      }

                      setDraggedJobId(null);
                    }}
                  >
                    <div className="bucket-section-header">
                      <strong>{category}</strong>
                      <span>{categoryJobs.length}</span>
                    </div>

                    <div className="bucket-job-list">
                      {categoryJobs.map((job) => (
                        <JobCard
                          key={job.id}
                          job={job}
                          compact
                          workerNames={getAssignedWorkerNames(
                            data.teamMembers,
                            job.assignedTo
                          )}
                          onDragStart={(e) => handleDragStart(e, job.id)}
                          onEdit={() => setEditingJob(job)}
                          onDelete={() => deleteJob(job.id)}
                        />
                      ))}

                      {categoryJobs.length === 0 && (
                        <div className="empty small">Drop jobs here</div>
                      )}
                    </div>
                  </section>
                );
              }
            )}
          </div>
        </aside>

        <section className="calendar-area">
          <div className="calendar-instructions">
            <strong>Calendar</strong>
            <span>
              Click a worker name to view or edit their details. Calendar cells
              show whether each worker is Onsite or RNR based on their roster.
            </span>
          </div>

          <div className="calendar-wrap">
            <div
              className="calendar-grid"
              style={{ "--day-count": days.length }}
            >
              <div className="corner-cell">
                <span>Workers</span>
              </div>

              {days.map((day) => (
                <div
                  key={getIsoDate(day)}
                  className={`day-header ${isToday(day) ? "today" : ""}`}
                >
                  <strong>{formatDayName(day)}</strong>
                  <span>{formatDateHeader(day)}</span>
                </div>
              ))}

              {data.teamMembers.map((member) => (
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

                      if (jobId) {
                        addWorkerToJob(jobId, member.id);
                      }

                      setDraggedJobId(null);
                    }}
                  >
                    <button
                      className="worker-profile-button"
                      onClick={() => setEditingWorker(member)}
                      title="View or edit worker"
                    >
                      <strong>{member.name}</strong>
                      <span>{member.role || "Team member"}</span>
                      {member.employeeNumber && (
                        <em>{member.employeeNumber}</em>
                      )}
                    </button>

                    <button
                      title="Remove worker"
                      onClick={() => removeTeamMember(member.id)}
                    >
                      <X size={15} />
                    </button>
                  </div>

                  {days.map((day) => {
                    const iso = getIsoDate(day);
                    const rosterStatus = getRosterStatus(member, iso);

                    const cellJobs = scheduledJobs.filter(
                      (job) =>
                        Array.isArray(job.assignedTo) &&
                        job.assignedTo.includes(member.id) &&
                        isDateWithinRange(iso, job.startDate, job.endDate)
                    );

                    return (
                      <div
                        key={`${member.id}-${iso}`}
                        className={`calendar-cell ${
                          isToday(day) ? "today-cell" : ""
                        } ${rosterStatus === "RNR" ? "rnr-cell" : "onsite-cell"}`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();

                          const jobId = getDraggedJobId(e);

                          if (jobId) {
                            scheduleJob(jobId, member.id, iso);
                          }

                          setDraggedJobId(null);
                        }}
                      >
                        <div
                          className={`roster-badge ${
                            rosterStatus === "RNR" ? "rnr" : "onsite"
                          }`}
                        >
                          {rosterStatus}
                        </div>

                        <button
                          className="add-cell-job"
                          onClick={() =>
                            addJob({
                              assignedTo: [member.id],
                              startDate: iso,
                              endDate: iso,
                              category: "Scheduled"
                            })
                          }
                        >
                          <Plus size={14} /> Add
                        </button>

                        <div className="cell-jobs">
                          {cellJobs.map((job) => {
                            const isStart = job.startDate === iso;
                            const isEnd = job.endDate === iso;

                            return (
                              <CalendarJob
                                key={`${job.id}-${member.id}-${iso}`}
                                job={job}
                                isStart={isStart}
                                isEnd={isEnd}
                                workerNames={getAssignedWorkerNames(
                                  data.teamMembers,
                                  job.assignedTo
                                )}
                                onDragStart={(e) => handleDragStart(e, job.id)}
                                onEdit={() => setEditingJob(job)}
                                onDelete={() => deleteJob(job.id)}
                                onExtend={() => extendJob(job.id, iso)}
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
        />
      )}

      {editingWorker && (
        <WorkerModal
          worker={editingWorker}
          onClose={() => setEditingWorker(null)}
          onSave={saveWorker}
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
  onExtend
}) {
  return (
    <article
      className={`calendar-job ${isStart ? "range-start" : "range-middle"} ${
        isEnd ? "range-end" : ""
      }`}
      draggable
      onDragStart={onDragStart}
    >
      <div className="range-body">
        {isStart ? (
          <>
            <div className="card-top">
              <span className="wo">{job.workOrderNumber || "No WO"}</span>
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

            <div className="meta">
              {job.address && <span>{job.address}</span>}
              {job.clientContact && <span>{job.clientContact}</span>}
            </div>

            {workerNames && <p>{workerNames}</p>}
          </>
        ) : (
          <div className="continuation">
            <GripVertical size={14} />
            <span>{job.workOrderNumber || job.title}</span>
          </div>
        )}

        <button
          className="resize-handle"
          title="Extend job to this day"
          onClick={onExtend}
        >
          ↔
        </button>
      </div>
    </article>
  );
}

function JobCard({
  job,
  onDragStart,
  onEdit,
  onDelete,
  compact = false,
  workerNames = ""
}) {
  return (
    <article
      className={`card ${compact ? "compact" : ""}`}
      draggable
      onDragStart={onDragStart}
    >
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
        {job.workOrderNumber && (
          <span>
            <b>WO:</b> {job.workOrderNumber}
          </span>
        )}

        {job.address && (
          <span>
            <b>Address:</b> {job.address}
          </span>
        )}

        {job.clientContact && (
          <span>
            <b>Contact:</b> {job.clientContact}
          </span>
        )}

        {workerNames && (
          <span>
            <b>Workers:</b> {workerNames}
          </span>
        )}
      </div>

      {job.notes && <p>{job.notes}</p>}
    </article>
  );
}

function JobModal({ job, teamMembers, onClose, onSave }) {
  const [form, setForm] = useState(job);

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

  function submit(e) {
    e.preventDefault();

    if (!form.title.trim()) {
      alert("Please enter a job title.");
      return;
    }

    onSave(form);
  }

  return (
    <div className="modal-backdrop">
      <form className="modal" onSubmit={submit}>
        <div className="modal-header">
          <h2>{job.title ? "Edit job" : "New job"}</h2>
          <button type="button" className="icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <label>
          Job title
          <input
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
          />
        </label>

        <div className="two-col">
          <label>
            Work order number
            <input
              value={form.workOrderNumber}
              onChange={(e) => update("workOrderNumber", e.target.value)}
            />
          </label>

          <label>
            Client contact
            <input
              value={form.clientContact}
              onChange={(e) => update("clientContact", e.target.value)}
            />
          </label>
        </div>

        <label>
          Address
          <input
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
          />
        </label>

        <div className="three-col">
          <label>
            Category
            <select
              value={form.category}
              onChange={(e) => update("category", e.target.value)}
            >
              {CATEGORIES.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>

          <label>
            Start date
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => update("startDate", e.target.value)}
            />
          </label>

          <label>
            End date
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => update("endDate", e.target.value)}
            />
          </label>
        </div>

        <div className="worker-picker">
          <strong>Assigned workers</strong>

          <div className="worker-options">
            {teamMembers.map((member) => (
              <label key={member.id} className="check-option">
                <input
                  type="checkbox"
                  checked={
                    Array.isArray(form.assignedTo) &&
                    form.assignedTo.includes(member.id)
                  }
                  onChange={() => toggleWorker(member.id)}
                />
                {member.name}
              </label>
            ))}
          </div>
        </div>

        <label>
          Notes
          <textarea
            rows="4"
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
          />
        </label>

        <div className="modal-actions">
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
            Role / trade
            <input value={form.role} onChange={(e) => update("role", e.target.value)} />
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

        <label>
          Employee number
          <input
            value={form.employeeNumber}
            onChange={(e) => update("employeeNumber", e.target.value)}
          />
        </label>

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

function emptyJob(defaults = {}) {
  const start = defaults.startDate ?? "";

  return {
    id: crypto.randomUUID(),
    title: "",
    workOrderNumber: "",
    address: "",
    clientContact: "",
    category: start ? "Scheduled" : "To be scheduled",
    assignedTo: [],
    startDate: start,
    endDate: defaults.endDate ?? start,
    notes: "",
    ...defaults
  };
}

function emptyWorker() {
  const id = "worker-" + crypto.randomUUID();

  return {
    id,
    name: "",
    role: "",
    phone: "",
    email: "",
    employeeNumber: "",
    rosterPattern: "NONE",
    rosterStartDate: ""
  };
}

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return initialData;

    const parsed = JSON.parse(saved);

    return {
      ...parsed,
      teamMembers: parsed.teamMembers.map((worker) => ({
        phone: "",
        email: "",
        employeeNumber: "",
        rosterPattern: "NONE",
        rosterStartDate: "",
        ...worker
      }))
    };
  } catch {
    return initialData;
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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

function formatDayName(date) {
  return new Intl.DateTimeFormat("en-AU", { weekday: "short" }).format(date);
}

function formatDateHeader(date) {
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short"
  }).format(date);
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
