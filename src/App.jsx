import { useEffect, useMemo, useState } from "react";

const ADMIN_CODE = "GEOTTESADMIN";
const VENMO = "@Jesse-Geottes";
const STORAGE_KEY = "geottes-lawn-service-clean";
const SUPABASE_URL = "https://kwvgpkefpttvgsdegfee.supabase.co";
const SUPABASE_KEY = "sb_publishable__nV9FlNQQOwbvKQbj7a10w_eUqqXVXe";
const SUPABASE_TABLE = "customers";
const CLOUD_ROW_ID = 1;
const YEARS = [2026, 2027, 2028, 2029];
const MONTHS = ["March", "April", "May", "June", "July", "August", "September", "October"];
const MONTH_INDEX = { March: 2, April: 3, May: 4, June: 5, July: 6, August: 7, September: 8, October: 9 };
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TIMES = ["8:00–10:00 AM", "9:00–11:00 AM", "10:00 AM–12:00 PM", "11:00 AM–1:00 PM", "12:00–2:00 PM", "1:00–3:00 PM", "2:00–4:00 PM", "3:00–5:00 PM", "4:00–6:00 PM", "5:00–7:00 PM"];
const STATUSES = ["Scheduled", "Starting Soon", "In Progress", "Completed", "Needs Review", "Weather Delay"];
const WEATHER = ["Clear", "Watch Weather", "Rain Delay", "Move to Tomorrow"];
const REQUESTS = ["Request reschedule", "Skip next cut", "Add extra trimming", "Request mulch quote", "Report an issue"];

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function firstName(name) {
  return (name || "Customer").trim().split(" ")[0] || "Customer";
}

function normalizeCustomer(customer = {}) {
  const balance = Number(customer.balance) || 0;

  return {
    id: Number(customer.id) || Date.now(),
    name: customer.name || "Customer",
    address: customer.address || "",
    code: String(customer.code || "").toUpperCase(),
    service: customer.service || "Weekly Mow",
    balance,
    paid: customer.paid ?? balance <= 0,
    paymentStatus: customer.paymentStatus || (balance > 0 ? "Unpaid" : "Paid"),
    paidDate: customer.paidDate || "",
    paymentNote: customer.paymentNote || "",
    notes: customer.notes || "",
    weatherNotice: customer.weatherNotice || "",
    visits: arr(customer.visits),
    comments: arr(customer.comments),
    requests: arr(customer.requests),
    history: arr(customer.history)
  };
}

function makeVisit(id, date, time, service, status = "Scheduled", weather = "Clear") {
  return { id, date, time, service, status, weather };
}

function getVisits(customer) {
  return arr(customer?.visits);
}

function getNextVisit(customer) {
  return getVisits(customer).find(visit => visit.status !== "Completed") || getVisits(customer)[0] || null;
}

function dateParts(label) {
  const [monthRaw, dayRaw, yearRaw] = String(label || "March 1, 2026").replace(",", "").split(" ");
  return {
    month: MONTH_INDEX[monthRaw] !== undefined ? monthRaw : "March",
    day: Number(dayRaw) || 1,
    year: YEARS.includes(Number(yearRaw)) ? Number(yearRaw) : 2026
  };
}

function dateObject(label) {
  const parts = dateParts(label);
  return new Date(parts.year, MONTH_INDEX[parts.month], parts.day);
}

function formatDate(date) {
  return `${MONTHS[date.getMonth() - 2] || MONTHS[0]} ${date.getDate()}, ${date.getFullYear()}`;
}

function addWeeks(label, weeks) {
  const date = dateObject(label);
  date.setDate(date.getDate() + weeks * 7);
  return formatDate(date);
}

function visitText(visit) {
  if (!visit) return "No visit scheduled";
  const date = dateObject(visit.date);
  return `${DAYS[date.getDay()]}, ${formatDate(date)} • ${visit.time}`;
}

function todayText() {
  return new Date().toLocaleDateString();
}

function paymentState(customer) {
  const due = Number(customer.balance) || 0;
  const status = customer.paymentStatus || (due > 0 ? "Unpaid" : "Paid");
  if (status === "Paid" || due <= 0) return "paid";
  if (status === "Pending") return "pending";
  return "unpaid";
}

function venmoLink(customer) {
  const amount = Number(customer.balance) || 0;
  const note = encodeURIComponent(`Lawn service - ${customer.address || customer.name || "customer"}`);
  return `https://venmo.com/Jesse-Geottes?txn=pay&amount=${amount}&note=${note}`;
}

function loadCustomers() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved.map(normalizeCustomer) : [];
  } catch {
    return [];
  }
}

function saveCustomers(customers) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(customers));
}
async function loadCloudCustomers() {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?id=eq.${CLOUD_ROW_ID}&select=data`,
      {
        headers: {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Accept-Profile": "public"
}
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("Supabase load failed:", response.status, text);
      return null;
    }

    const rows = await response.json();
    const customers = rows?.[0]?.data?.customers;

    return Array.isArray(customers) ? customers.map(normalizeCustomer) : null;
  } catch (error) {
    console.error("Supabase load crashed:", error);
    return null;
  }
}
async function saveCloudCustomers(customers) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?id=eq.${CLOUD_ROW_ID}`,
      {
        method: "PATCH",
        headers: {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  "Accept-Profile": "public",
  "Content-Profile": "public",
  Prefer: "return=representation"
}
        body: JSON.stringify({
          code: "APP_STATE",
          data: { customers },
          updated_at: new Date().toISOString()
        })
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("Supabase save failed:", response.status, text);
      return false;
    }

    console.log("Supabase save worked");
    return true;
  } catch (error) {
    console.error("Supabase save crashed:", error);
    return false;
  }
}
function Button({ children, onClick, type = "button", variant = "primary", disabled = false }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`btn btn-${variant}`}>
      {children}
    </button>
  );
}

function Card({ children, className = "" }) {
  return <div className={`card ${className}`}>{children}</div>;
}

function Field({ label, value, onChange, options, type = "text", area = false }) {
  return (
    <label className="field">
      <span>{label}</span>
      {options ? (
        <select value={value} onChange={event => onChange(event.target.value)}>
          {options.map(option => <option key={option}>{option}</option>)}
        </select>
      ) : area ? (
        <textarea value={value} onChange={event => onChange(event.target.value)} />
      ) : (
        <input
          type={type}
          value={value}
          min={type === "number" ? "0" : undefined}
          step={type === "number" ? "0.01" : undefined}
          onChange={event => onChange(event.target.value)}
        />
      )}
    </label>
  );
}

function Pill({ children }) {
  const text = String(children || "");
  let color = "blue";
  if (["Paid", "Completed", "Clear"].includes(text)) color = "green";
  if (["Pending", "Needs Review", "Watch Weather"].includes(text)) color = "amber";
  if (["Unpaid", "Rain Delay", "Weather Delay"].includes(text)) color = "red";
  return <span className={`pill pill-${color}`}>{children}</span>;
}

function Header({ onSignOut }) {
  return (
    <header className="header">
      <div className="brand">
        <div className="logo">🌿</div>
        <div>
          <h1>Geottes Lawn Service</h1>
          <p>Private customer portal</p>
        </div>
      </div>
      <Button variant="secondary" onClick={onSignOut}>Sign Out</Button>
    </header>
  );
}

function CalendarPick({ value, onChange }) {
  const selectedParts = dateParts(value);
  const month = selectedParts.month;
  const year = selectedParts.year;
  const monthIndex = MONTH_INDEX[month];
  const blanks = new Date(year, monthIndex, 1).getDay();
  const totalDays = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [...Array(blanks).fill(null), ...Array.from({ length: totalDays }, (_, index) => index + 1)];

  return (
    <div className="calendar">
      <h3>Choose date</h3>

      <div className="chips">
        {YEARS.map(item => (
          <button key={item} type="button" onClick={() => onChange(`${month} ${selectedParts.day}, ${item}`)} className={year === item ? "chip active-dark" : "chip"}>
            {item}
          </button>
        ))}
      </div>

      <div className="chips">
        {MONTHS.map(item => (
          <button key={item} type="button" onClick={() => onChange(`${item} 1, ${year}`)} className={month === item ? "chip active-green" : "chip"}>
            {item}
          </button>
        ))}
      </div>

      <div className="weekdays">
        {DAYS.map(day => <div key={day}>{day}</div>)}
      </div>

      <div className="calendar-grid">
        {cells.map((day, index) => {
          const label = day ? `${month} ${day}, ${year}` : "";
          const selected = Boolean(day) && dateObject(value).toDateString() === dateObject(label).toDateString();
          const weekday = day ? DAYS[new Date(year, monthIndex, day).getDay()] : "";

          return (
            <button key={index} type="button" disabled={!day} onClick={() => onChange(label)} className={selected ? "day selected" : "day"}>
              <strong>{day || ""}</strong>
              {day && <span>{weekday}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PaymentPanel({ customer }) {
  const state = paymentState(customer);
  const due = Number(customer.balance) || 0;
  const status = customer.paymentStatus || (due > 0 ? "Unpaid" : "Paid");

  return (
    <Card className={`payment payment-${state}`}>
      <p className="label">Payment</p>
      <h2>{due > 0 ? `$${due}` : "Paid"}</h2>
      <p>Venmo: <strong>{VENMO}</strong></p>
      <p>Status: <strong>{status}</strong>{customer.paidDate ? ` • Paid ${customer.paidDate}` : ""}</p>
      <a className={`pay-link pay-${state}`} href={venmoLink(customer)} target="_blank" rel="noreferrer">
        {state === "paid" ? "Payment Complete" : "Pay with Venmo"}
      </a>
    </Card>
  );
}

function VisitRow({ visit, editable, onChange, onDelete, canDelete }) {
  return (
    <div className="visit">
      <div>
        <div className="visit-title">
          <strong>{visitText(visit)}</strong>
          <Pill>{visit.status}</Pill>
        </div>
        <p>{visit.service}</p>
        {visit.weather !== "Clear" && <Pill>{visit.weather}</Pill>}
      </div>

      {editable && (
        <div className="visit-actions">
          <select value={visit.status} onChange={event => onChange({ status: event.target.value })}>
            {STATUSES.map(status => <option key={status}>{status}</option>)}
          </select>
          <select value={visit.weather} onChange={event => onChange({ weather: event.target.value, status: event.target.value === "Rain Delay" ? "Weather Delay" : visit.status })}>
            {WEATHER.map(weather => <option key={weather}>{weather}</option>)}
          </select>
          <Button variant="secondary" disabled={!canDelete} onClick={onDelete}>Delete</Button>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="section">
      <h3>{title}</h3>
      <div className="stack">{children}</div>
    </section>
  );
}

function Login({ customers, onAdmin, onCustomer }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const submit = event => {
    event.preventDefault();
    const typed = code.trim().toUpperCase();

    if (typed === ADMIN_CODE) {
      onAdmin();
      return;
    }

    const customer = customers.find(item => item.code === typed);

    if (!customer) {
      setError("That code was not found. Double-check the private portal code.");
      return;
    }

    onCustomer(customer.id);
  };

  return (
    <main className="login">
      <div className="login-bg" />
      <div className="login-content">
        <section className="hero">
          <p>Private Lawn Portal</p>
          <h2>Geottes Lawn Service</h2>
          <span>Customers can view upcoming cuts, payment status, comments, requests, and weather updates.</span>
        </section>

        <Card className="login-card">
          <h3>Open Your Portal</h3>
          <p>Enter your private code below.</p>

          <form onSubmit={submit}>
            <input
              className="code-input"
              value={code}
              onChange={event => {
                setCode(event.target.value);
                setError("");
              }}
              placeholder="Enter private code"
            />
            {error && <p className="error">{error}</p>}
            <Button type="submit">Open Portal</Button>
          </form>

          <p className="hint">Admin code: <strong>{ADMIN_CODE}</strong></p>
        </Card>
      </div>
    </main>
  );
}

function AddCustomer({ customers, onCreate, onCancel }) {
  const nextId = customers.length ? Math.max(...customers.map(customer => Number(customer.id) || 0)) + 1 : 1;
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    address: "",
    code: `CUSTOMER${String(nextId).padStart(3, "0")}`,
    service: "Weekly Mow",
    balance: "0",
    status: "Scheduled",
    weather: "Clear",
    time: TIMES[0],
    date: "March 1, 2026",
    notes: "",
    weatherNotice: ""
  });

  const update = (key, value) => {
    setForm(current => ({ ...current, [key]: key === "code" ? value.toUpperCase() : value }));
    setError("");
  };

  const submit = event => {
    event.preventDefault();

    const code = form.code.trim().toUpperCase();
    const amount = Number(form.balance);

    if (!form.name.trim() || !form.address.trim() || !code || !form.service.trim()) {
      setError("Name, address, code, and service are required.");
      return;
    }

    if (code === ADMIN_CODE) {
      setError("That code is reserved for admin.");
      return;
    }

    if (customers.some(customer => customer.code === code)) {
      setError("Another customer already has that code.");
      return;
    }

    if (!Number.isFinite(amount) || amount < 0) {
      setError("Enter a valid amount due.");
      return;
    }

    const balance = Math.round(amount * 100) / 100;

    onCreate(normalizeCustomer({
      id: nextId,
      name: form.name.trim(),
      address: form.address.trim(),
      code,
      service: form.service.trim(),
      balance,
      paid: balance === 0,
      paymentStatus: balance === 0 ? "Paid" : "Unpaid",
      paidDate: balance === 0 ? todayText() : "",
      notes: form.notes,
      weatherNotice: form.weatherNotice,
      visits: [makeVisit(1, form.date, form.time, form.service.trim(), form.status, form.weather)]
    }));
  };

  return (
    <main className="page narrow">
      <div className="top-row">
        <div>
          <p className="eyebrow">Add Customer</p>
          <h2>Create a customer portal</h2>
          <span>Add their private code, schedule, and payment details.</span>
        </div>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>

      <Card>
        <form className="form-grid" onSubmit={submit}>
          <Field label="Customer name" value={form.name} onChange={value => update("name", value)} />
          <Field label="Portal code" value={form.code} onChange={value => update("code", value)} />
          <Field label="Address" value={form.address} onChange={value => update("address", value)} />
          <Field label="Service type" value={form.service} onChange={value => update("service", value)} />
          <Field label="Amount due" value={form.balance} onChange={value => update("balance", value)} type="number" />
          <Field label="Status" value={form.status} onChange={value => update("status", value)} options={STATUSES} />
          <Field label="Weather" value={form.weather} onChange={value => update("weather", value)} options={WEATHER} />
          <Field label="Time" value={form.time} onChange={value => update("time", value)} options={TIMES} />
          <CalendarPick value={form.date} onChange={value => update("date", value)} />
          <Field label="Private notes" value={form.notes} onChange={value => update("notes", value)} area />
          <Field label="Weather notice" value={form.weatherNotice} onChange={value => update("weatherNotice", value)} area />

          {error && <p className="error full">{error}</p>}

          <Button type="submit">Create Customer</Button>
        </form>
      </Card>
    </main>
  );
}

function CustomerPortal({ customer, onBack, onComment, onRequest }) {
  const [comment, setComment] = useState("");
  const [requestType, setRequestType] = useState(REQUESTS[0]);
  const [requestNote, setRequestNote] = useState("");
  const current = getNextVisit(customer);
  const weather = customer.weatherNotice || getVisits(customer).find(visit => visit.weather !== "Clear")?.weather || "";

  const submitComment = event => {
    event.preventDefault();
    if (!comment.trim()) return;
    onComment(customer.id, comment.trim());
    setComment("");
  };

  const submitRequest = event => {
    event.preventDefault();
    onRequest(customer.id, { type: requestType, note: requestNote.trim(), status: "New" });
    setRequestType(REQUESTS[0]);
    setRequestNote("");
  };

  return (
    <main className="page customer-page">
      <div className="top-row">
        <div>
          <p className="eyebrow">Customer Portal</p>
          <h2>Welcome, {firstName(customer.name)}</h2>
          <span>{customer.address}</span>
        </div>
        <Button variant="secondary" onClick={onBack}>Switch Code</Button>
      </div>

      <Card className="service-card">
        <div>
          <p>Next service</p>
          <h2>{current?.service || customer.service}</h2>
          <span>{current ? visitText(current) : "No visit scheduled"}</span>
        </div>
        <Pill>{current?.status || "Scheduled"}</Pill>
      </Card>

      <div className="two-col">
        <PaymentPanel customer={customer} />
        <Card>
          <p className="label">Weather</p>
          <h3>{weather || "No delay posted"}</h3>
        </Card>
      </div>

      <Section title="Upcoming visits">
        {getVisits(customer).length ? getVisits(customer).map(visit => <VisitRow key={visit.id} visit={visit} />) : <p className="empty">No visits scheduled.</p>}
      </Section>

      <Card>
        <h3>Comment on this week’s cut</h3>
        <form onSubmit={submitComment} className="stack">
          <textarea value={comment} onChange={event => setComment(event.target.value)} placeholder="Example: Please trim closer around the fence next week." />
          <Button type="submit" disabled={!comment.trim()}>Submit Comment</Button>
        </form>
      </Card>

      <Section title="Your comments">
        {customer.comments.length ? customer.comments.map((item, index) => <p key={index} className="empty">{item}</p>) : <p className="empty">No comments yet.</p>}
      </Section>

      <Card>
        <h3>Request a change</h3>
        <form onSubmit={submitRequest} className="stack">
          <Field label="Request type" value={requestType} onChange={setRequestType} options={REQUESTS} />
          <Field label="Details" value={requestNote} onChange={setRequestNote} area />
          <Button type="submit">Submit Request</Button>
        </form>
      </Card>
    </main>
  );
}

function EmptyAdmin({ onAdd }) {
  return (
    <main className="page narrow">
      <Card className="center">
        <div className="big-icon">📁</div>
        <h2>No customers yet</h2>
        <p>Add your first customer to create their private portal.</p>
        <Button onClick={onAdd}>Add First Customer</Button>
      </Card>
    </main>
  );
}

function AdminDashboard({ customers, setCustomers, selectedId, setSelectedId, onAdd }) {
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState("");
  const [draft, setDraft] = useState({
    date: "March 1, 2026",
    time: TIMES[0],
    service: "Weekly Mow",
    status: "Scheduled",
    weather: "Clear"
  });

  const selected = customers.find(customer => customer.id === selectedId) || customers[0];

  const filtered = useMemo(() => {
    return customers.filter(customer => {
      const text = `${customer.name} ${customer.address} ${customer.code}`.toLowerCase();
      return text.includes(search.toLowerCase());
    });
  }, [customers, search]);

  if (!customers.length || !selected) return <EmptyAdmin onAdd={onAdd} />;

  const unpaid = customers.filter(customer => Number(customer.balance) > 0 && customer.paymentStatus !== "Paid");
  const totalDue = customers.reduce((sum, customer) => sum + Number(customer.balance || 0), 0);

  const save = changes => {
    setCustomers(current => current.map(customer => customer.id === selected.id ? normalizeCustomer({ ...customer, ...changes }) : customer));
  };

  const saveVisits = visits => {
    save({ visits, service: getNextVisit({ visits })?.service || selected.service });
  };

  const updateVisit = (id, changes) => {
    const oldVisit = getVisits(selected).find(visit => visit.id === id);
    const newVisits = getVisits(selected).map(visit => visit.id === id ? { ...visit, ...changes } : visit);
    const completed = changes.status === "Completed" && oldVisit?.status !== "Completed";
    const history = completed ? [{ date: oldVisit.date, service: oldVisit.service, status: "Completed", amount: selected.balance, paid: selected.paid }] : [];
    setCustomers(current => current.map(customer => customer.id === selected.id ? normalizeCustomer({ ...customer, visits: newVisits, history: [...arr(customer.history), ...history] }) : customer));
  };

  const addVisit = () => {
    const id = getVisits(selected).length ? Math.max(...getVisits(selected).map(visit => visit.id)) + 1 : 1;
    saveVisits([...getVisits(selected), makeVisit(id, draft.date, draft.time, draft.service, draft.status, draft.weather)]);
  };

  const addRecurring = () => {
    const id = getVisits(selected).length ? Math.max(...getVisits(selected).map(visit => visit.id)) + 1 : 1;
    const added = Array.from({ length: 4 }, (_, index) => makeVisit(id + index, addWeeks(draft.date, index), draft.time, draft.service));
    saveVisits([...getVisits(selected), ...added]);
  };

  const deleteCustomer = () => {
    if (confirm !== "DELETE") return;
    const remaining = customers.filter(customer => customer.id !== selected.id);
    setCustomers(remaining);
    setSelectedId(remaining[0]?.id || null);
    setConfirm("");
  };

  return (
    <main className="page">
      <div className="top-row">
        <div>
          <p className="eyebrow">Admin View</p>
          <h2>Manage customers</h2>
          <span>Schedules, payments, comments, requests, and weather.</span>
        </div>
        <Button onClick={onAdd}>+ Add Customer</Button>
      </div>

      <div className="stats">
        <Card><p>Active Clients</p><h2>{customers.length}</h2></Card>
        <Card><p>Total Due</p><h2>${totalDue}</h2></Card>
        <Card className={unpaid.length ? "stat-red" : "stat-green"}><p>Unpaid Accounts</p><h2>{unpaid.length}</h2></Card>
      </div>

      <div className="admin-layout">
        <Card className="customer-list">
          <h3>Customer Folders</h3>
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search customers..." />

          {filtered.map(customer => {
            const state = paymentState(customer);
            return (
              <button key={customer.id} onClick={() => setSelectedId(customer.id)} className={`customer-button ${state} ${selected.id === customer.id ? "active" : ""}`}>
                <strong>{customer.name}</strong>
                <span>{state === "paid" ? "PAID" : state === "pending" ? "PENDING" : `$${customer.balance} DUE`}</span>
                <small>{customer.address}</small>
                <small>Code: {customer.code}</small>
              </button>
            );
          })}
        </Card>

        <div className="stack">
          <Card>
            <h2>{selected.name}</h2>
            <p>{selected.address}</p>
            <p><strong>Code:</strong> {selected.code}</p>
          </Card>

          <Card>
            <h3>Customer Info</h3>
            <div className="form-grid">
              <Field label="Name" value={selected.name} onChange={value => save({ name: value })} />
              <Field label="Code" value={selected.code} onChange={value => save({ code: value.toUpperCase() })} />
              <Field label="Address" value={selected.address} onChange={value => save({ address: value })} />
              <Field label="Private notes" value={selected.notes} onChange={value => save({ notes: value })} area />
            </div>
          </Card>

          <Card>
            <h3>Payment</h3>
            <div className="form-grid">
              <Field label="Amount due" value={String(selected.balance)} type="number" onChange={value => save({ balance: Math.max(0, Number(value) || 0), paymentStatus: Number(value) <= 0 ? "Paid" : "Unpaid", paid: Number(value) <= 0 })} />
              <Field label="Payment status" value={selected.paymentStatus} onChange={value => save({ paymentStatus: value, paid: value === "Paid", paidDate: value === "Paid" ? todayText() : selected.paidDate })} options={["Unpaid", "Pending", "Paid"]} />
              <Field label="Payment note" value={selected.paymentNote} onChange={value => save({ paymentNote: value })} />
            </div>
            <Button onClick={() => save({ balance: 0, paid: true, paymentStatus: "Paid", paidDate: todayText() })}>Mark Paid</Button>
            <PaymentPanel customer={selected} />
          </Card>

          <Card>
            <h3>Weather Notice</h3>
            <Field label="Message customers see" value={selected.weatherNotice} onChange={value => save({ weatherNotice: value })} area />
          </Card>

          <Card>
            <h3>Add Visits</h3>
            <div className="form-grid">
              <Field label="Service" value={draft.service} onChange={value => setDraft(current => ({ ...current, service: value }))} />
              <Field label="Time" value={draft.time} onChange={value => setDraft(current => ({ ...current, time: value }))} options={TIMES} />
              <CalendarPick value={draft.date} onChange={value => setDraft(current => ({ ...current, date: value }))} />
              <Field label="Status" value={draft.status} onChange={value => setDraft(current => ({ ...current, status: value }))} options={STATUSES} />
              <Field label="Weather" value={draft.weather} onChange={value => setDraft(current => ({ ...current, weather: value }))} options={WEATHER} />
            </div>
            <div className="button-row">
              <Button onClick={addVisit}>Add One-Time Visit</Button>
              <Button variant="secondary" onClick={addRecurring}>Create 4 Weekly Visits</Button>
            </div>
          </Card>

          <Section title="Upcoming Visits">
            {getVisits(selected).map(visit => (
              <VisitRow
                key={visit.id}
                visit={visit}
                editable
                canDelete={getVisits(selected).length > 1}
                onChange={changes => updateVisit(visit.id, changes)}
                onDelete={() => saveVisits(getVisits(selected).filter(item => item.id !== visit.id))}
              />
            ))}
          </Section>

          <Section title="Comments">
            {selected.comments.length ? selected.comments.map((comment, index) => <p className="empty" key={index}>{comment}</p>) : <p className="empty">No comments yet.</p>}
          </Section>

          <Section title="Requests">
            {selected.requests.length ? selected.requests.map((request, index) => <p className="empty" key={index}><strong>{request.type}</strong>{request.note ? ` — ${request.note}` : ""}</p>) : <p className="empty">No requests yet.</p>}
          </Section>

          <Card className="danger">
            <h3>Danger Zone</h3>
            <p>Type DELETE before deleting this customer.</p>
            <input value={confirm} onChange={event => setConfirm(event.target.value)} placeholder="Type DELETE" />
            <Button variant="danger" disabled={confirm !== "DELETE"} onClick={deleteCustomer}>Delete Customer</Button>
          </Card>
        </div>
      </div>
    </main>
  );
}

export default function App() {
  const [customers, setCustomers] = useState(() => loadCustomers());
  const [page, setPage] = useState("home");
  const [selectedId, setSelectedId] = useState(null);
  const [portalId, setPortalId] = useState(null);
  const [cloudReady, setCloudReady] = useState(false);

  useEffect(() => {
    let active = true;

    loadCloudCustomers().then(data => {
      if (!active) return;

      if (Array.isArray(data)) {
        setCustomers(data);
      }

      setCloudReady(true);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    saveCustomers(customers);

    if (cloudReady) {
      saveCloudCustomers(customers);
    }
  }, [customers, cloudReady]);

  useEffect(() => {
    saveCustomers(customers);
  }, [customers]);

  const createCustomer = customer => {
    const item = normalizeCustomer(customer);
    setCustomers(current => [...current, item]);
    setSelectedId(item.id);
    setPage("admin");
  };

  const updateCustomer = (id, changes) => {
    setCustomers(current => current.map(customer => customer.id === id ? normalizeCustomer({ ...customer, ...changes }) : customer));
  };

  const addComment = (id, comment) => {
    const customer = customers.find(item => item.id === id);
    updateCustomer(id, { comments: [...arr(customer?.comments), comment] });
  };

  const addRequest = (id, request) => {
    const customer = customers.find(item => item.id === id);
    updateCustomer(id, { requests: [...arr(customer?.requests), request] });
  };

  const portalCustomer = customers.find(customer => customer.id === portalId);

  const signOut = () => {
    setPage("home");
    setPortalId(null);
  };

  return (
    <div>
      <Header onSignOut={signOut} />

      {page === "home" && (
        <Login
          customers={customers}
          onAdmin={() => setPage("admin")}
          onCustomer={id => {
            setPortalId(id);
            setPage("customer");
          }}
        />
      )}

      {page === "add" && (
        <AddCustomer
          customers={customers}
          onCreate={createCustomer}
          onCancel={() => setPage("admin")}
        />
      )}

      {page === "admin" && (
        <AdminDashboard
          customers={customers}
          setCustomers={setCustomers}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          onAdd={() => setPage("add")}
        />
      )}

      {page === "customer" && (
        portalCustomer ? (
          <CustomerPortal
            customer={portalCustomer}
            onBack={signOut}
            onComment={addComment}
            onRequest={addRequest}
          />
        ) : (
          <Login
            customers={customers}
            onAdmin={() => setPage("admin")}
            onCustomer={id => {
              setPortalId(id);
              setPage("customer");
            }}
          />
        )
      )}
    </div>
  );
}
