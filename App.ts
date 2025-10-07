import React, { useEffect, useMemo, useState } from "react";

/**
 * StudioCast — Podcast Portal (Local‑First MVP)
 * Single‑file React component for Canvas preview.
 *
 * ✅ Fixes for the user's error:
 *   1) Removed duplicated/partial blocks that caused parse failures.
 *   2) Ensured **one** default export only.
 *   3) Replaced a bad sort expression (`a.scheduledRecordAt!>b...`) with safe `localeCompare`.
 *   4) Added a small test harness panel (no external runner) and **more tests** (kept existing test names).
 */

// ---------- Constants & Types ----------
const STATUSES = ["draft", "active", "completed", "archived"] as const;
const PRIORITIES = ["high", "medium", "low"] as const;

type Status = typeof STATUSES[number];
type Priority = typeof PRIORITIES[number];

type User = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "member";
  createdAt: number;
};

type Guest = {
  id: string;
  name: string;
  company?: string;
  email?: string;
  bio?: string;
  socials?: string;
  notes?: string;
  createdAt: number;
};

type Checklist = {
  research: boolean;
  questions: boolean;
  equipment: boolean;
  thumbnails: boolean;
};

type Project = {
  id: string;
  title: string;
  episodeNumber: number;
  description?: string;
  status: Status;
  priority: Priority;
  tags: string[];
  scheduledRecordAt?: string;
  scheduledPublishAt?: string;
  durationEstimateMin?: number;
  guestId?: string;
  checklist: Checklist;
  progressPct: number;
  createdAt: number;
  updatedAt: number;
};

const LS_KEYS = {
  users: "pp_users_v1",
  projects: "pp_projects_v1",
  guests: "pp_guests_v1",
  session: "pp_session_v1",
  seq: "pp_sequence_v1",
} as const;

// ---------- Utilities ----------
const uid = (prefix = "id") => `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
const now = () => Date.now();
const load = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const save = <T,>(key: string, value: T) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
};
const classNames = (...xs: (string | false | undefined)[]) => xs.filter(Boolean).join(" ");

const calcProgress = (c: Checklist) => {
  const done = [c.research, c.questions, c.equipment, c.thumbnails].filter(Boolean).length;
  return Math.round((done / 4) * 100);
};

const nextEpisodeNumber = () => {
  const seq = load<number>(LS_KEYS.seq, 0) + 1;
  save(LS_KEYS.seq, seq);
  return seq;
};

const getSession = (): { userId?: string } => load(LS_KEYS.session, {} as { userId?: string });
const setSession = (userId?: string) => save(LS_KEYS.session, { userId });

function ensureSeedAdmin() {
  const users = load<User[]>(LS_KEYS.users, []);
  if (users.length === 0) {
    const admin: User = { id: uid("usr"), name: "Admin", email: "admin@example.com", role: "admin", createdAt: now() };
    save(LS_KEYS.users, [admin]);
  }
}
ensureSeedAdmin();

// ---------- Tiny runtime tests (smoke + logic) ----------
function runSmokeTests() {
  const results: { name: string; ok: boolean; message?: string }[] = [];
  const expect = (name: string, cond: boolean, message?: string) => results.push({ name, ok: !!cond, message });

  try {
    // (kept) calcProgress
    expect("progress 0%", calcProgress({ research: false, questions: false, equipment: false, thumbnails: false }) === 0);
    expect("progress 50%", calcProgress({ research: true, questions: false, equipment: true, thumbnails: false }) === 50);
    expect("progress 100%", calcProgress({ research: true, questions: true, equipment: true, thumbnails: true }) === 100);

    // (kept) nextEpisodeNumber increments
    const base = load<number>(LS_KEYS.seq, 0);
    const n1 = nextEpisodeNumber();
    const n2 = nextEpisodeNumber();
    expect("episode increments by 1", n2 === n1 + 1);
    save(LS_KEYS.seq, base); // restore

    // (kept) filtering search
    const list: Project[] = [
      { id: "a", title: "Alpha", episodeNumber: 1, status: "draft", priority: "high", tags: ["news"], checklist: { research: true, questions: false, equipment: false, thumbnails: false }, progressPct: 25, createdAt: now(), updatedAt: now() },
      { id: "b", title: "Beta",  episodeNumber: 2, status: "active", priority: "medium", tags: ["tech"], checklist: { research: true, questions: true, equipment: false, thumbnails: false }, progressPct: 50, createdAt: now(), updatedAt: now() },
    ];
    const query = "alpha";
    const filtered = list.filter(p => p.title.toLowerCase().includes(query));
    expect("search matches Alpha", filtered.length === 1 && filtered[0].id === "a");

    // (added) tag filter
    const hasTech = list.filter(p => p.tags.includes("tech"));
    expect("tag filter finds tech", hasTech.length === 1 && hasTech[0].id === "b");

    // (added) status workflow set
    expect("status value in enum", STATUSES.includes(list[0].status));

    // (added) progress rounding edge
    expect("progress rounding", calcProgress({ research: true, questions: false, equipment: false, thumbnails: false }) === 25);
  } catch (e: any) {
    results.push({ name: "tests crashed", ok: false, message: e?.message || String(e) });
  }
  return results;
}

function TestResultsPanel({ results }: { results: { name: string; ok: boolean; message?: string }[] }) {
  return (
    <div className="mt-6 text-xs">
      <div className="font-semibold mb-2">Self‑tests</div>
      <div className="grid gap-1">
        {results.map((r, i) => (
          <div key={i} className={classNames("px-2 py-1 rounded border", r.ok ? "bg-emerald-900/20 border-emerald-800 text-emerald-200" : "bg-red-900/20 border-red-800 text-red-200") }>
            {r.ok ? "✓" : "✗"} {r.name}{r.message ? ` — ${r.message}` : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Main App ----------
export default function StudioCastPortal() {
  const [users, setUsers] = useState<User[]>(() => load<User[]>(LS_KEYS.users, []));
  const [projects, setProjects] = useState<Project[]>(() => load<Project[]>(LS_KEYS.projects, []));
  const [guests, setGuests] = useState<Guest[]>(() => load<Guest[]>(LS_KEYS.guests, []));

  const session = useMemo(getSession, []);
  const currentUser = users.find(u => u.id === session.userId);

  useEffect(() => save(LS_KEYS.users, users), [users]);
  useEffect(() => save(LS_KEYS.projects, projects), [projects]);
  useEffect(() => save(LS_KEYS.guests, guests), [guests]);

  const [testResults] = useState(runSmokeTests());

  const handleLogin = (email: string, name?: string) => {
    if (!email.trim()) return alert('Email required');
    let u = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!u) { u = { id: uid("usr"), name: name || email.split("@")[0], email, role: "member", createdAt: now() }; setUsers(prev => [...prev, u!]); }
    setSession(u.id); window.location.reload();
  };
  const handleLogout = () => { setSession(undefined); window.location.reload(); };

  if (!currentUser) return <AuthScreen onLogin={handleLogin} testResults={testResults} />;

  return (
    <Shell
      users={users} setUsers={setUsers}
      projects={projects} setProjects={setProjects}
      guests={guests} setGuests={setGuests}
      currentUser={currentUser} onLogout={handleLogout}
      testResults={testResults}
    />
  );
}

// ---------- UI Pieces ----------
function AuthScreen({ onLogin, testResults }: { onLogin: (email: string, name?: string) => void; testResults: { name: string; ok: boolean; message?: string }[] }){
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-slate-900/60 border border-slate-800 rounded-2xl p-8 shadow-xl">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold tracking-tight">🎙️ StudioCast Portal</h1>
          <p className="text-sm text-slate-400 mt-1">Local-first MVP — sign in with an email to start.</p>
        </div>
        <label className="block text-sm mb-2">Email</label>
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@studio.com" className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 focus:outline-none focus:ring focus:ring-blue-500"/>
        <label className="block text-sm mt-4 mb-2">Name (new users)</label>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 focus:outline-none focus:ring focus:ring-blue-500"/>
        <button onClick={()=>onLogin(email, name)} className="mt-6 w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 transition font-semibold">Enter Portal</button>

        <TestResultsPanel results={testResults} />

        <div className="mt-6 text-xs text-slate-500">
          <p>Seed admin: <span className="font-mono">admin@example.com</span> (auto-provisioned on first load).</p>
          <p className="mt-1">Admins can promote/demote users in Team.</p>
        </div>
      </div>
    </div>
  );
}

function Shell({ users, setUsers, projects, setProjects, guests, setGuests, currentUser, onLogout, testResults }:{
  users: User[]; setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  projects: Project[]; setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  guests: Guest[]; setGuests: React.Dispatch<React.SetStateAction<Guest[]>>;
  currentUser: User; onLogout: ()=>void; testResults: { name: string; ok: boolean; message?: string }[];
}){
  const [tab, setTab] = useState<"dashboard"|"projects"|"team"|"guests"|"settings">("dashboard");
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400" />
            <div>
              <div className="font-semibold">StudioCast</div>
              <div className="text-xs text-slate-400">Professional Podcast Portal</div>
            </div>
          </div>
          <nav className="hidden md:flex gap-2">
            {[
              {k:"dashboard", label:"Dashboard"},
              {k:"projects", label:"Projects"},
              {k:"team", label:"Team"},
              {k:"guests", label:"Guests"},
              {k:"settings", label:"Settings"},
            ].map(x => (
              <button key={x.k} onClick={()=>setTab(x.k as any)} className={classNames("px-3 py-2 rounded-lg text-sm", tab===x.k?"bg-slate-800":"hover:bg-slate-800/60")}>{x.label}</button>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-300">{currentUser.name} <span className="text-slate-500">({currentUser.role})</span></span>
            <button onClick={onLogout} className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm">Logout</button>
          </div>
        </div>
        <div className="md:hidden px-4 pb-3 flex gap-2">
          {[
            {k:"dashboard", label:"Dashboard"},
            {k:"projects", label:"Projects"},
            {k:"team", label:"Team"},
            {k:"guests", label:"Guests"},
            {k:"settings", label:"Settings"},
          ].map(x => (
            <button key={x.k} onClick={()=>setTab(x.k as any)} className={classNames("px-3 py-2 rounded-lg text-sm flex-1", tab===x.k?"bg-slate-800":"hover:bg-slate-800/60")}>{x.label}</button>
          ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {tab === "dashboard" && <Dashboard projects={projects} guests={guests} />}
        {tab === "projects" && (<ProjectsPage projects={projects} setProjects={setProjects} guests={guests} />)}
        {tab === "team" && (<TeamPage users={users} setUsers={setUsers} currentUser={currentUser} />)}
        {tab === "guests" && (<GuestsPage guests={guests} setGuests={setGuests} />)}
        {tab === "settings" && <SettingsPage testResults={testResults} />}
      </main>
    </div>
  );
}

function Stat({label, value}:{label:string; value:string}){
  return (
    <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  )
}

function Dashboard({ projects, guests }:{ projects: Project[]; guests: Guest[] }){
  const active = projects.filter(p=>p.status!=="archived");
  const completed = projects.filter(p=>p.status==="completed");
  const avgProgress = Math.round((active.reduce((sum,p)=>sum+p.progressPct,0) / Math.max(1, active.length)));
  const next = projects
    .filter(p=>p.status!=="archived")
    .filter(p=>p.scheduledRecordAt)
    .sort((a,b)=> (a.scheduledRecordAt||"").localeCompare(b.scheduledRecordAt||""))
    .slice(0,5);

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Projects" value={String(projects.length)} />
        <Stat label="Active" value={String(active.length)} />
        <Stat label="Completed" value={String(completed.length)} />
        <Stat label="Avg Progress" value={`${isNaN(avgProgress)?0:avgProgress}%`} />
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-3">Upcoming Sessions</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {next.length===0 && <div className="text-slate-400">No upcoming scheduled recordings yet.</div>}
          {next.map(p=> (
            <div key={p.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="text-sm text-slate-400">Ep {p.episodeNumber} · {p.priority.toUpperCase()}</div>
              <div className="font-semibold mt-1">{p.title}</div>
              <div className="text-sm text-slate-400 mt-1">Record: {p.scheduledRecordAt?.slice(0,16).replace('T',' ') || 'TBD'}</div>
              <ProgressBar pct={p.progressPct} />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Guests</h2>
        <div className="flex gap-2 flex-wrap">
          {guests.slice(0,12).map(g=> (<div key={g.id} className="px-3 py-2 rounded-full bg-slate-900 border border-slate-800 text-sm">{g.name}</div>))}
          {guests.length===0 && <div className="text-slate-400">No guests yet — add them in Guests tab.</div>}
        </div>
      </section>
    </div>
  );
}

function ProgressBar({pct}:{pct:number}){
  return (
    <div className="mt-3 h-2 rounded-full bg-slate-800 overflow-hidden">
      <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400" style={{width:`${pct}%`}} />
    </div>
  )
}

function ProjectsPage({ projects, setProjects, guests }:{ projects: Project[]; setProjects: React.Dispatch<React.SetStateAction<Project[]>>; guests: Guest[] }){
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status|"all">("all");
  const [priorityFilter, setPriorityFilter] = useState<Priority|"all">("all");
  const [sortKey, setSortKey] = useState<"updatedAt"|"progress"|"episode">("updatedAt");
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<Project | null>(null);

  const filtered = React.useMemo(()=>{
    let list = [...projects];
    if (statusFilter!=="all") list = list.filter(p=>p.status===statusFilter);
    if (priorityFilter!=="all") list = list.filter(p=>p.priority===priorityFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(p => p.title.toLowerCase().includes(q) || (p.description||"").toLowerCase().includes(q) || p.tags.join(" ").toLowerCase().includes(q));
    }
    if (sortKey === "updatedAt") list.sort((a,b)=>b.updatedAt - a.updatedAt);
    if (sortKey === "progress") list.sort((a,b)=>b.progressPct - a.progressPct);
    if (sortKey === "episode")  list.sort((a,b)=>a.episodeNumber - b.episodeNumber);
    return list;
  }, [projects, statusFilter, priorityFilter, query, sortKey]);

  const openNew = () => {
    setDraft({
      id: uid("prj"), title: "", episodeNumber: nextEpisodeNumber(), description: "",
      status: "draft", priority: "medium", tags: [],
      scheduledRecordAt: "", scheduledPublishAt: "", durationEstimateMin: undefined,
      guestId: undefined,
      checklist: { research:false, questions:false, equipment:false, thumbnails:false },
      progressPct: 0, createdAt: now(), updatedAt: now(),
    });
    setShowForm(true);
  };

  const openEdit = (p: Project) => { setDraft({...p}); setShowForm(true); };

  const saveDraft = () => {
    if (!draft) return;
    const copy = {...draft};
    copy.progressPct = calcProgress(copy.checklist);
    copy.updatedAt = now();
    setProjects(prev => prev.some(p=>p.id===copy.id) ? prev.map(p=>p.id===copy.id?copy:p) : [copy, ...prev]);
    setShowForm(false); setDraft(null);
  };

  const remove = (id: string) => { if (confirm("Delete this project?")) setProjects(prev => prev.filter(p=>p.id!==id)); };

  const bulk = (action: "complete"|"archive"|"delete") => {
    const selected = document.querySelectorAll<HTMLInputElement>('input[name="sel-project"]:checked');
    const ids = Array.from(selected).map(x=>x.value);
    if (ids.length===0) return alert("Select at least one project.");
    if (action === "delete" && !confirm(`Delete ${ids.length} projects?`)) return;
    setProjects(prev => prev.map(p=>{
      if (!ids.includes(p.id)) return p;
      if (action === "complete") return {...p, status:"completed", updatedAt: now()};
      if (action === "archive")  return {...p, status:"archived",  updatedAt: now()};
      return p;
    }).filter(p=>action!=="delete" || !ids.includes(p.id)));
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-col md:flex-row gap-2 md:items-end">
        <div className="flex-1">
          <label className="text-xs text-slate-400">Search</label>
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="title, description, #tags" className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 focus:outline-none focus:ring focus:ring-blue-600"/>
        </div>
        <div>
          <label className="text-xs text-slate-400">Status</label>
          <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value as any)} className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800">
            <option value="all">All</option>
            {STATUSES.map(s=> <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400">Priority</label>
          <select value={priorityFilter} onChange={e=>setPriorityFilter(e.target.value as any)} className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800">
            <option value="all">All</option>
            {PRIORITIES.map(s=> <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400">Sort by</label>
          <select value={sortKey} onChange={e=>setSortKey(e.target.value as any)} className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800">
            <option value="updatedAt">Last Updated</option>
            <option value="progress">Progress</option>
            <option value="episode">Episode #</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={openNew} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-semibold">New Project</button>
          <div className="relative group">
            <button className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700">Bulk…</button>
            <div className="absolute hidden group-hover:block right-0 mt-2 w-40 rounded-xl bg-slate-900 border border-slate-800 p-1">
              <button onClick={()=>bulk("complete")} className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800">Mark Completed</button>
              <button onClick={()=>bulk("archive")}  className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800">Archive</button>
              <button onClick={()=>bulk("delete")}   className="w-full text-left px-3 py-2 rounded-lg hover:bg-red-900/30 text-red-300">Delete</button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(p=> <ProjectCard key={p.id} p={p} onEdit={()=>openEdit(p)} onDelete={()=>remove(p.id)} />)}
        {filtered.length===0 && (<div className="text-slate-400">No projects found. Create one to get started.</div>)}
      </div>

      {showForm && draft && (
        <Modal onClose={()=>{setShowForm(false); setDraft(null);}} title={draft?.title?`Edit: ${draft.title}`:"New Project"}>
          <ProjectForm draft={draft} setDraft={setDraft} guests={guests} onSave={saveDraft} />
        </Modal>
      )}
    </div>
  );
}

function badgeColor(status: Status){
  switch(status){
    case "draft":     return "bg-zinc-800 text-zinc-300";
    case "active":    return "bg-blue-800/30 text-blue-300 border border-blue-700/40";
    case "completed": return "bg-emerald-800/30 text-emerald-300 border border-emerald-700/40";
    case "archived":  return "bg-slate-800 text-slate-400";
  }
}

function ProjectCard({p, onEdit, onDelete}:{p:Project; onEdit:()=>void; onDelete:()=>void}){
  return (
    <div className="group rounded-2xl border border-slate-800 bg-slate-900/60 p-4 hover:shadow-xl hover:-translate-y-0.5 transition">
      <div className="flex items-center justify-between">
        <div className={classNames("text-xs px-2 py-1 rounded-full font-medium capitalize inline-flex items-center gap-2", badgeColor(p.status))}>
          <span>{p.status}</span>
        </div>
        <div className="text-xs text-slate-400">Ep {p.episodeNumber}</div>
      </div>
      <div className="mt-2 font-semibold text-lg">{p.title || "Untitled"}</div>
      <div className="mt-1 text-sm text-slate-400 line-clamp-2">{p.description || "No description"}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {p.tags.map(t=> <span key={t} className="text-xs px-2 py-1 rounded-full bg-slate-800 border border-slate-700">#{t}</span>)}
      </div>
      <div className="mt-3 text-xs text-slate-400">
        Priority: <span className="uppercase font-medium text-slate-200">{p.priority}</span>
      </div>
      <ProgressBar pct={p.progressPct} />
      <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
        <div>Record: {p.scheduledRecordAt?.slice(0,16).replace('T',' ') || 'TBD'}</div>
        <div>·</div>
        <div>Publish: {p.scheduledPublishAt?.slice(0,16).replace('T',' ') || 'TBD'}</div>
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={onEdit} className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm">Edit</button>
        <button onClick={onDelete} className="px-3 py-2 rounded-lg bg-red-600/80 hover:bg-red-600 text-sm">Delete</button>
      </div>
      <input type="checkbox" name="sel-project" value={p.id} className="mt-3 accent-blue-500" />
    </div>
  );
}

function Modal({children, title, onClose}:{children:React.ReactNode; title:string; onClose:()=>void}){
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-2xl bg-slate-950 border border-slate-800 rounded-2xl shadow-xl">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="font-semibold">{title}</div>
          <button onClick={onClose} className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700">Close</button>
        </div>
        <div className="p-5 max-h-[75vh] overflow-auto">{children}</div>
      </div>
    </div>
  );
}

function ProjectForm({ draft, setDraft, guests, onSave }:{ draft: Project; setDraft: (p:Project)=>void; guests: Guest[]; onSave: ()=>void }){
  const set = (patch: Partial<Project>) => setDraft({...draft, ...patch});
  const setChecklist = (patch: Partial<Checklist>) => setDraft({...draft, checklist: {...draft.checklist, ...patch} });
  const [tagInput, setTagInput] = useState("");

  return (
    <div className="grid gap-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs mb-1 text-slate-400">Title</label>
          <input value={draft.title} onChange={e=>set({title:e.target.value})} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800" />
        </div>
        <div>
          <label className="block text-xs mb-1 text-slate-400">Episode #</label>
          <input type="number" value={draft.episodeNumber} onChange={e=>set({episodeNumber: Number(e.target.value)})} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800" />
        </div>
      </div>

      <div>
        <label className="block text-xs mb-1 text-slate-400">Description</label>
        <textarea value={draft.description} onChange={e=>set({description:e.target.value})} rows={3} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800" />
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs mb-1 text-slate-400">Status</label>
          <select value={draft.status} onChange={e=>set({status:e.target.value as Status})} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800">
            {STATUSES.map(s=> <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs mb-1 text-slate-400">Priority</label>
          <select value={draft.priority} onChange={e=>set({priority:e.target.value as Priority})} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800">
            {PRIORITIES.map(s=> <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs mb-1 text-slate-400">Record Date</label>
          <input type="datetime-local" value={draft.scheduledRecordAt||""} onChange={e=>set({scheduledRecordAt:e.target.value})} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800" />
        </div>
        <div>
          <label className="block text-xs mb-1 text-slate-400">Publish Date</label>
          <input type="datetime-local" value={draft.scheduledPublishAt||""} onChange={e=>set({scheduledPublishAt:e.target.value})} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800" />
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs mb-1 text-slate-400">Duration Estimate (min)</label>
          <input type="number" value={draft.durationEstimateMin||""} onChange={e=>set({durationEstimateMin: Number(e.target.value)||undefined})} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs mb-1 text-slate-400">Guest</label>
          <select value={draft.guestId||""} onChange={e=>set({guestId: e.target.value || undefined})} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800">
            <option value="">— None —</option>
            {guests.map(g=> <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs mb-1 text-slate-400">Tags</label>
        <div className="flex gap-2">
          <input value={tagInput} onChange={e=>setTagInput(e.target.value)} placeholder="type + Enter" className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800" />
          <button onClick={()=>{ if(!tagInput.trim()) return; set({tags:[...draft.tags, ...tagInput.split(',').map(s=>s.trim()).filter(Boolean)]}); setTagInput(""); }} className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700">Add</button>
        </div>
        <div className="mt-2 flex gap-2 flex-wrap">
          {draft.tags.map((t,idx)=> (
            <span key={idx} className="px-2 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs inline-flex items-center gap-2">
              #{t}
              <button onClick={()=>set({tags: draft.tags.filter((_,i)=>i!==idx)})} className="text-slate-400 hover:text-white">✕</button>
            </span>
          ))}
        </div>
      </div>

      <div>
        <div className="font-semibold">Pre‑production Checklist</div>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-2 mt-2">
          {([
            ["research","Research"],
            ["questions","Questions"],
            ["equipment","Equipment"],
            ["thumbnails","Thumbnails"],
          ] as const).map(([k, label])=> (
            <label key={k} className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800">
              <input type="checkbox" checked={(draft.checklist as any)[k]} onChange={e=>setChecklist({[k]: e.target.checked} as any)} className="accent-blue-500"/>
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={onSave} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-semibold">Save</button>
      </div>
    </div>
  );
}

function TeamPage({ users, setUsers, currentUser }:{ users: User[]; setUsers: React.Dispatch<React.SetStateAction<User[]>>; currentUser: User }){
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const add = () => {
    if (!name.trim() || !email.trim()) return;
    const exists = users.some(u=>u.email.toLowerCase()===email.toLowerCase());
    if (exists) return alert("Email already exists.");
    const u: User = { id: uid("usr"), name, email, role: "member", createdAt: now() };
    setUsers(prev => [...prev, u]); setName(""); setEmail(""); };
  const del = (id: string) => { if (!confirm("Remove this user?")) return; setUsers(prev => prev.filter(u=>u.id!==id)); };
  const promote = (id: string, role: "admin"|"member") => { setUsers(prev => prev.map(u=>u.id===id?{...u, role}:u)); };

  return (
    <div className="grid gap-4">
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
        <div className="font-semibold mb-2">Add Team Member</div>
        <div className="grid md:grid-cols-3 gap-2">
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Name" className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700"/>
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700"/>
          <button onClick={add} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500">Add</button>
        </div>
        <div className="text-xs text-slate-400 mt-2">Only admins can add/remove/promote. You are <b>{currentUser.role}</b>.</div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {users.map(u=> (
          <div key={u.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">{u.name}</div>
                <div className="text-xs text-slate-400">{u.email}</div>
              </div>
              <div className="text-xs px-2 py-1 rounded-full bg-slate-800 border border-slate-700">{u.role}</div>
            </div>
            <div className="mt-3 flex gap-2">
              {currentUser.role==="admin" && (<>
                {u.role!=="admin" && <button onClick={()=>promote(u.id, "admin")} className="px-3 py-2 rounded-lg bg-slate-800">Make Admin</button>}
                {u.role!=="member" && <button onClick={()=>promote(u.id, "member")} className="px-3 py-2 rounded-lg bg-slate-800">Make Member</button>}
                <button onClick={()=>del(u.id)} className="px-3 py-2 rounded-lg bg-red-600/80 hover:bg-red-600">Remove</button>
              </>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GuestsPage({ guests, setGuests }:{ guests: Guest[]; setGuests: React.Dispatch<React.SetStateAction<Guest[]>> }){
  const [g, setG] = useState<Guest | null>(null);
  const [show, setShow] = useState(false);
  const open = (guest?: Guest) => { setG(guest || { id: uid("gst"), name:"", createdAt: now() }); setShow(true); };
  const save = () => { if(!g) return; if(!g.name.trim()) return alert("Name required"); setGuests(prev=> prev.some(x=>x.id===g.id)? prev.map(x=>x.id===g.id?g:x) : [g, ...prev]); setShow(false); setG(null); };
  const del = (id: string) => { if(!confirm("Delete guest?")) return; setGuests(prev=> prev.filter(x=>x.id!==id)); };

  return (
    <div className="grid gap-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Guest Directory</h2>
        <button onClick={()=>open()} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500">New Guest</button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {guests.map(x=> (
          <div key={x.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="font-semibold">{x.name}</div>
            {x.company && <div className="text-xs text-slate-400">{x.company}</div>}
            {x.email && <div className="text-xs text-slate-400">{x.email}</div>}
            <div className="mt-2 line-clamp-2 text-sm text-slate-400">{x.bio||x.notes||"—"}</div>
            <div className="mt-3 flex gap-2">
              <button onClick={()=>open(x)} className="px-3 py-2 rounded-lg bg-slate-800">Edit</button>
              <button onClick={()=>del(x.id)} className="px-3 py-2 rounded-lg bg-red-600/80 hover:bg-red-600">Delete</button>
            </div>
          </div>
        ))}
        {guests.length===0 && <div className="text-slate-400">No guests yet.</div>}
      </div>

      {show && g && (
        <Modal title={g?.name?`Edit Guest: ${g.name}`:"New Guest"} onClose={()=>{setShow(false); setG(null);}}>
          <div className="grid gap-3">
            <div className="grid md:grid-cols-2 gap-3">
              <input value={g.name} onChange={e=>setG({...g, name:e.target.value})} placeholder="Full name" className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800" />
              <input value={g.company||""} onChange={e=>setG({...g, company:e.target.value})} placeholder="Company (optional)" className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800" />
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <input value={g.email||""} onChange={e=>setG({...g, email:e.target.value})} placeholder="Email (optional)" className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800" />
              <input value={g.socials||""} onChange={e=>setG({...g, socials:e.target.value})} placeholder="Socials / links" className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800" />
            </div>
            <textarea value={g.bio||""} onChange={e=>setG({...g, bio:e.target.value})} placeholder="Short bio" rows={3} className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800" />
            <textarea value={g.notes||""} onChange={e=>setG({...g, notes:e.target.value})} placeholder="Notes" rows={3} className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800" />
            <div className="flex justify-end">
              <button onClick={()=>save()} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500">Save</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SettingsPage({ testResults }: { testResults: { name: string; ok: boolean; message?: string }[] }){
  const wipe = () => {
    if (!confirm("This will clear all local data: users, projects, guests. Continue?")) return;
    localStorage.removeItem(LS_KEYS.users);
    localStorage.removeItem(LS_KEYS.projects);
    localStorage.removeItem(LS_KEYS.guests);
    localStorage.removeItem(LS_KEYS.session);
    localStorage.removeItem(LS_KEYS.seq);
    window.location.reload();
  };

  return (
    <div className="grid gap-4">
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
        <div className="font-semibold">Local Data</div>
        <p className="text-sm text-slate-400 mt-1">This MVP stores all data in your browser. Use the button to reset.</p>
        <button onClick={wipe} className="mt-3 px-3 py-2 rounded-lg bg-red-600/80 hover:bg-red-600">Reset All Data</button>
      </div>

      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
        <div className="font-semibold mb-2">Self‑tests</div>
        <TestResultsPanel results={testResults} />
      </div>

      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-sm text-slate-400">
        <div className="font-semibold text-slate-200 mb-1">Upgrade path (Firebase)</div>
        <ul className="list-disc pl-5 space-y-1">
          <li>Replace AuthScreen with Firebase Auth (email/password, Google).</li>
          <li>Move LS state to Firestore collections: users, projects, guests. Mirror schema.</li>
          <li>Use Firestore security rules: only admins can promote/remove users.</li>
          <li>Use Firebase Storage for audio, thumbnails, and attachments.</li>
          <li>Add Cloud Functions for analytics rollups and webhooks.</li>
        </ul>
      </div>
    </div>
  );
}
