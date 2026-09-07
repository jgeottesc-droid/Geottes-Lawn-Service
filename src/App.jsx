import { useEffect, useRef, useState } from "react";
import {
  ADMIN_CODE,
  VENMO,
  TIMES,
  STATUSES,
  WEATHER,
  REQUESTS,
  arr,
  firstName,
  normalizeCustomer,
  getVisits,
  getNextVisit,
  dateObject,
  formatDate,
  addWeeks,
  visitText,
  paymentState,
  venmoLink,
  loadCloudCustomers,
  saveCloudCustomers,
  saveCustomers,
  money,
  isoDate,
  fromISO,
  recordPayment,
  changeVisit,
  appendVisits,
} from "./data";

function Icon({ name, size = 20 }) {
  const paths = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M20 8a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87" />
        <circle cx="9" cy="7" r="4" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2" />
      </>
    ),
    message: (
      <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9H13a8.5 8.5 0 0 1 8 8v.5Z" />
    ),
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    wallet: (
      <>
        <rect x="3" y="5" width="18" height="15" rx="2" />
        <path d="M16 10h5v5h-5zM3 5l13-3v3" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    leaf: (
      <>
        <path d="M20 3c-9-1-16 3-16 10a7 7 0 0 0 7 7c7 0 10-8 9-17Z" />
        <path d="M4 21 15 10" />
      </>
    ),
    logout: (
      <>
        <path d="M9 5H4v14h5M10 12h11m-4-4 4 4-4 4" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    weather: (
      <>
        <path d="M7 15a4 4 0 1 1 .5-8A6 6 0 0 1 19 9a3 3 0 0 1-1 6H7ZM8 18l-1 3m6-3-1 3m6-3-1 3" />
      </>
    ),
    pin: (
      <>
        <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    chevron: <path d="m9 5 7 7-7 7" />,
    history: (
      <>
        <path d="M3 11a9 9 0 1 1 2.6 7M3 4v7h7M12 7v5l3 2" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.leaf}
    </svg>
  );
}
function Button({
  children,
  icon,
  variant = "primary",
  className = "",
  ...props
}) {
  return (
    <button
      type="button"
      className={`btn btn-${variant} ${className}`}
      {...props}
    >
      {icon && <Icon name={icon} />} {children}
    </button>
  );
}
function Brand({ inverse = false }) {
  return (
    <div className={`brand ${inverse ? "inverse" : ""}`}>
      <span className="brand-mark">
        <Icon name="leaf" size={25} />
      </span>
      <span>
        GEOTTES<small>LAWN SERVICE</small>
      </span>
    </div>
  );
}
function Pill({ children }) {
  const tone = ["Paid", "Completed", "Clear", "Handled"].includes(children)
    ? "green"
    : ["Unpaid", "Rain Delay", "Weather Delay"].includes(children)
      ? "amber"
      : "neutral";
  return <span className={`pill ${tone}`}>{children}</span>;
}

function serviceHistory(customer) {
  const legacy = arr(customer?.history).map((item, index) => ({
    ...item,
    id: `history-${index}`,
    status: item.status || "Completed",
  }));
  const completedVisits = getVisits(customer)
    .filter((visit) => visit.status === "Completed")
    .map((visit) => ({ ...visit, id: `visit-${visit.id}` }));
  const seen = new Set();

  return [...legacy, ...completedVisits]
    .filter((item) => {
      const key = `${item.date}|${item.service}|${item.status}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => dateObject(b.date) - dateObject(a.date));
}
function Field({ label, options, area, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      {options ? (
        <select {...props}>
          {options.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      ) : area ? (
        <textarea {...props} />
      ) : (
        <input {...props} />
      )}
    </label>
  );
}
function Empty({ title, children }) {
  return (
    <div className="empty">
      <Icon name="leaf" size={26} />
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  );
}
function SectionHead({ title, detail, children }) {
  return (
    <div className="section-head">
      <div>
        <h2>{title}</h2>
        {detail && <p>{detail}</p>}
      </div>
      {children}
    </div>
  );
}
function DateBadge({ date }) {
  const parsed = dateObject(date);
  return (
    <div className="date-badge">
      <span>{parsed.toLocaleDateString("en-US", { month: "short" })}</span>
      <strong>{parsed.getDate()}</strong>
    </div>
  );
}
function Modal({ title, subtitle, children, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-label={title}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Login({ customers, ready, error: connectionError, onLogin, onRetry }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [show, setShow] = useState(false);
  function submit(event) {
    event.preventDefault();
    const typed = code.trim().toUpperCase();
    if (typed === ADMIN_CODE) return onLogin("owner");
    const customer = customers.find((item) => item.code === typed);
    if (customer) onLogin(customer.id);
    else setError("That code wasn’t found. Check your code and try again.");
  }
  return (
    <main className="login">
      <div className="login-story">
        <Brand inverse />
        <div className="login-title">
          <span className="overline">YOUR LAWN, TAKEN CARE OF.</span>
          <h1>
            A little less
            <br />
            on your <em>list.</em>
          </h1>
          <p>
            Your next cut, payments, and a direct line to Jesse. All in one
            place.
          </p>
          <div className="login-features">
            <span>
              <Icon name="calendar" /> Know what’s next
            </span>
            <span>
              <Icon name="wallet" /> Pay in a moment
            </span>
            <span>
              <Icon name="message" /> Stay in touch
            </span>
          </div>
        </div>
        <span className="login-foot">
          Geottes Lawn Service · Customer & owner access
        </span>
      </div>
      <div className="login-entry">
        <div className="login-form">
          <span className="eyebrow">WELCOME BACK</span>
          <h2>
            Your lawn.
            <br />
            Your portal.
          </h2>
          <p>Enter the private code Jesse gave you.</p>
          <form onSubmit={submit}>
            <label className="field">
              <span>Portal code</span>
              <div className="password-field">
                <input
                  autoComplete="current-password"
                  autoCapitalize="characters"
                  spellCheck="false"
                  type={show ? "text" : "password"}
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value);
                    setError("");
                  }}
                  placeholder="Your private code"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  aria-label={show ? "Hide code" : "Show code"}
                >
                  {show ? "Hide" : "Show"}
                </button>
              </div>
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {connectionError && (
              <div className="error" role="alert">
                Your portal couldn’t connect.{" "}
                <button type="button" onClick={onRetry}>
                  Try again
                </button>
              </div>
            )}
            <Button
              type="submit"
              icon="arrow"
              disabled={!ready || !code.trim()}
              className="full"
            >
              {ready ? "Open my portal" : "Connecting…"}
            </Button>
          </form>
          <p className="login-help">
            Use your existing customer or owner code.
          </p>
        </div>
        <span className="entry-foot">
          <Icon name="leaf" size={16} /> A well-kept lawn starts here.
        </span>
      </div>
    </main>
  );
}
function PaymentCard({ customer }) {
  const due = Number(customer.balance) || 0;
  return (
    <section className="panel payment-card">
      <div className="section-head">
        <span className="eyebrow">YOUR BALANCE</span>
        <Pill>{due <= 0 ? "Paid" : customer.paymentStatus}</Pill>
      </div>
      <div className="balance">{money(due)}</div>
      <p>
        {due > 0 ? "For your lawn service" : "You’re all caught up. Thank you!"}
      </p>
      {due > 0 && (
        <a
          className="btn btn-primary full"
          href={venmoLink(customer)}
          target="_blank"
          rel="noreferrer"
        >
          Pay with Venmo <Icon name="arrow" />
        </a>
      )}
      <small>
        {VENMO}
        {customer.paidDate && due <= 0 ? ` · Paid ${customer.paidDate}` : ""}
      </small>
    </section>
  );
}
function NextCut({ customer }) {
  const visit = getNextVisit(customer);
  return (
    <section className="next-cut">
      <div className="section-head">
        <span className="overline">NEXT ON YOUR LAWN</span>
        <Icon name="calendar" size={24} />
      </div>
      {visit ? (
        <>
          <h2>{visit.date}</h2>
          <p className="next-time">{visit.time}</p>
          <div className="next-bottom">
            <span>{visit.service}</span>
            <Pill>{visit.status}</Pill>
          </div>
        </>
      ) : (
        <>
          <h2>
            A fresh cut
            <br />
            is on the way.
          </h2>
          <p>Jesse will update your next visit here.</p>
          <div className="next-bottom">
            <span>{customer.service}</span>
            <Pill>Not scheduled</Pill>
          </div>
        </>
      )}
    </section>
  );
}
function CustomerPortal({ customer, update, writable }) {
  const [tab, setTab] = useState("Home");
  const [mode, setMode] = useState("Comment");
  const [message, setMessage] = useState("");
  const [request, setRequest] = useState(REQUESTS[0]);
  const [sent, setSent] = useState("");
  const visits = getVisits(customer)
    .filter((visit) => visit.status !== "Completed")
    .sort((a, b) => dateObject(a.date) - dateObject(b.date));
  const weather =
    customer.weatherNotice ||
    visits.find((visit) => visit.weather && visit.weather !== "Clear")?.weather;
  function send(event) {
    event.preventDefault();
    if (!writable || (mode === "Comment" && !message.trim())) return;
    update(customer.id, (current) =>
      mode === "Comment"
        ? { ...current, comments: [...arr(current.comments), message.trim()] }
        : {
            ...current,
            requests: [
              ...arr(current.requests),
              { type: request, note: message.trim(), status: "New" },
            ],
          },
    );
    setMessage("");
    setSent(
      mode === "Comment"
        ? "Your comment has been added."
        : "Your request has been added. Jesse will review it.",
    );
  }
  return (
    <main className="customer-page">
      <div className="page-title">
        <div>
          <span className="eyebrow">YOUR CUSTOMER PORTAL</span>
          <h1>
            Hi, {firstName(customer.name)}
            <span className="title-dot">.</span>
          </h1>
          <p>
            <Icon name="pin" size={17} />
            {customer.address}
          </p>
        </div>
        <span className="service-label">{customer.service}</span>
      </div>
      <nav className="customer-tabs" aria-label="Your portal">
        {["Home", "Visits", "Messages", "History"].map((item) => (
          <button
            key={item}
            aria-current={tab === item ? "page" : undefined}
            onClick={() => {
              setTab(item);
              setSent("");
            }}
          >
            {item}
          </button>
        ))}
      </nav>
      {tab === "Home" && (
        <>
          <div className="portal-summary">
            <NextCut customer={customer} />
            <PaymentCard customer={customer} />
          </div>
          {weather && (
            <div className="weather-notice">
              <Icon name="weather" />
              <div>
                <strong>Weather update</strong>
                <p>{weather}</p>
              </div>
            </div>
          )}
          <section className="panel contact-card">
            <div>
              <span className="eyebrow">LET’S KEEP IN TOUCH</span>
              <h2>Need to change something?</h2>
              <p>
                Leave a note about your lawn or request a change to your next
                cut.
              </p>
            </div>
            <Button
              variant="secondary"
              icon="message"
              onClick={() => setTab("Messages")}
            >
              Message Jesse
            </Button>
          </section>
        </>
      )}
      {tab === "Visits" && (
        <section className="panel">
          <SectionHead
            title="Upcoming visits"
            detail="Your latest schedule and service updates."
          />
          {visits.length ? (
            visits.map((visit) => (
              <div className="visit-line" key={visit.id}>
                <DateBadge date={visit.date} />
                <div className="grow">
                  <strong>{visit.date}</strong>
                  <p>
                    {visit.time} · {visit.service}
                  </p>
                </div>
                <div className="status-stack">
                  <Pill>{visit.status}</Pill>
                  {visit.weather !== "Clear" && <Pill>{visit.weather}</Pill>}
                </div>
              </div>
            ))
          ) : (
            <Empty title="No upcoming visits">
              Your next scheduled cut will appear here.
            </Empty>
          )}
        </section>
      )}
      {tab === "Messages" && (
        <div className="message-layout">
          <section className="panel">
            <SectionHead title="Message Jesse" />
            <div className="segmented">
              {["Comment", "Request a change"].map((item) => (
                <button
                  key={item}
                  aria-pressed={mode === item}
                  onClick={() => {
                    setMode(item);
                    setSent("");
                  }}
                >
                  {item}
                </button>
              ))}
            </div>
            <form className="form-stack" onSubmit={send}>
              <fieldset disabled={!writable}>
                {mode !== "Comment" && (
                  <Field
                    label="What do you need?"
                    options={REQUESTS}
                    value={request}
                    onChange={(event) => setRequest(event.target.value)}
                  />
                )}
                <Field
                  label={
                    mode === "Comment" ? "Your comment" : "Details (optional)"
                  }
                  area
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Anything you’d like Jesse to know…"
                />
                <Button
                  type="submit"
                  icon="arrow"
                  disabled={mode === "Comment" && !message.trim()}
                >
                  Send {mode === "Comment" ? "comment" : "request"}
                </Button>
              </fieldset>
              {sent && (
                <p className="success" role="status">
                  {sent}
                </p>
              )}
            </form>
          </section>
          <section className="panel">
            <SectionHead title="Your messages" />
            {!customer.comments.length && !customer.requests.length && (
              <Empty title="You’re all up to date">
                Your comments and requests will appear here.
              </Empty>
            )}
            {[...customer.requests].reverse().map((item, index) => (
              <div className="message-item" key={`r${index}`}>
                <div className="section-head">
                  <strong>{item.type}</strong>
                  <Pill>{item.status || "New"}</Pill>
                </div>
                <p>{item.note}</p>
              </div>
            ))}
            {[...customer.comments].reverse().map((comment, index) => (
              <div className="message-item" key={`c${index}`}>
                <span className="eyebrow">YOUR COMMENT</span>
                <p>{comment}</p>
              </div>
            ))}
          </section>
        </div>
      )}
      {tab === "History" && (
        <section className="panel">
          <SectionHead title="Service history" />
          {serviceHistory(customer).length ? (
            serviceHistory(customer).map((item) => (
              <div className="visit-line" key={item.id}>
                <DateBadge date={item.date} />
                <div className="grow">
                  <strong>{item.service}</strong>
                  <p>
                    {item.date}
                    {item.time ? ` · ${item.time}` : ""}
                  </p>
                </div>
                <Pill>{item.status}</Pill>
              </div>
            ))
          ) : (
            <Empty title="A clean slate">
              Completed services will appear here.
            </Empty>
          )}
        </section>
      )}
      <footer className="portal-footer">
        <Brand />
        <span>Thanks for choosing Geottes Lawn Service.</span>
      </footer>
    </main>
  );
}

function CustomerForm({ customer, customers, onSave, onClose }) {
  const creating = !customer;
  const [form, setForm] = useState(
    customer
      ? { ...customer }
      : {
          name: "",
          address: "",
          code: "",
          service: "Weekly Mow",
          balance: "0",
          notes: "",
          weatherNotice: "",
        },
  );
  const [firstVisit, setFirstVisit] = useState(false);
  const [date, setDate] = useState(isoDate(formatDate(new Date())));
  const [time, setTime] = useState(TIMES[0]);
  const [error, setError] = useState("");
  function field(key) {
    return {
      value: form[key],
      onChange: (event) => setForm({ ...form, [key]: event.target.value }),
    };
  }
  function submit(event) {
    event.preventDefault();
    const code = form.code.trim().toUpperCase();
    if (
      !form.name.trim() ||
      !form.address.trim() ||
      !code ||
      !form.service.trim()
    )
      return setError("Name, address, service, and portal code are required.");
    if (
      code === ADMIN_CODE ||
      customers.some((item) => item.id !== customer?.id && item.code === code)
    )
      return setError(
        "That portal code is already in use. Choose a different code.",
      );
    const next = normalizeCustomer({
      ...form,
      code,
      name: form.name.trim(),
      address: form.address.trim(),
      id:
        customer?.id ||
        Math.max(0, ...customers.map((item) => Number(item.id))) + 1,
    });
    if (creating && firstVisit)
      next.visits = appendVisits(next, {
        date: fromISO(date),
        time,
        service: next.service,
      }).visits;
    onSave(next);
  }
  return (
    <Modal
      title={creating ? "Add a customer" : "Customer details"}
      subtitle={customer?.name || "Create their private portal."}
      onClose={onClose}
    >
      <form className="form-stack" onSubmit={submit}>
        <div className="form-grid">
          <Field label="Customer name" required {...field("name")} />
          <Field label="Portal code" required {...field("code")} />
          <Field label="Address" required {...field("address")} />
          <Field label="Service" required {...field("service")} />
          {creating && (
            <Field
              label="Starting balance ($)"
              type="number"
              min="0"
              step="0.01"
              {...field("balance")}
            />
          )}
        </div>
        <Field label="Private owner notes" area {...field("notes")} />
        {creating && (
          <>
            <label className="check-label">
              <input
                type="checkbox"
                checked={firstVisit}
                onChange={(event) => setFirstVisit(event.target.checked)}
              />
              Schedule their first cut
            </label>
            {firstVisit && (
              <div className="form-grid">
                <Field
                  label="Date"
                  type="date"
                  required
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
                <Field
                  label="Arrival window"
                  options={TIMES}
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                />
              </div>
            )}
          </>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            {creating ? "Create customer" : "Save details"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function PaymentForm({ customer, onSave, onClose, adjust = false }) {
  const [amount, setAmount] = useState(String(customer.balance));
  const [note, setNote] = useState(adjust ? customer.paymentNote : "");
  const [status, setStatus] = useState(customer.paymentStatus);
  const [error, setError] = useState("");
  function submit(event) {
    event.preventDefault();
    try {
      if (adjust) {
        const balance = Math.round(Number(amount) * 100) / 100;
        if (!Number.isFinite(balance) || balance < 0)
          throw new Error("Enter a valid balance.");
        if (balance > 0 && status === "Paid")
          throw new Error(
            "To mark this paid, record the payment or set the balance to zero.",
          );
        onSave({
          ...customer,
          balance,
          paid: balance === 0,
          paymentStatus: balance === 0 ? "Paid" : status,
          paymentNote: note,
        });
      } else onSave(recordPayment(customer, amount, note));
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <Modal
      title={adjust ? "Manage balance" : "Record a payment"}
      subtitle={customer.name}
      onClose={onClose}
    >
      <form className="form-stack" onSubmit={submit}>
        <div className="payment-summary">
          <span>Current balance</span>
          <strong>{money(customer.balance)}</strong>
        </div>
        <Field
          label={adjust ? "Balance ($)" : "Amount received ($)"}
          autoFocus
          type="number"
          min={adjust ? "0" : "0.01"}
          step="0.01"
          max={adjust ? undefined : customer.balance}
          required
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
        {adjust && (
          <Field
            label="Payment status"
            options={["Unpaid", "Pending", "Paid"]}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          />
        )}
        <Field
          label={adjust ? "Payment notes" : "Note (optional)"}
          area
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        {!adjust && (
          <p className="muted">
            Remaining after payment:{" "}
            <strong>
              {money(Math.max(0, Number(customer.balance) - Number(amount)))}
            </strong>
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" icon="check">
            {adjust ? "Save balance" : "Record payment"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function VisitForm({ customer, visit, onSave, onClose }) {
  const [form, setForm] = useState(
    visit
      ? { ...visit }
      : {
          date: formatDate(new Date()),
          time: TIMES[0],
          service: customer.service,
          status: "Scheduled",
          weather: "Clear",
        },
  );
  const [repeat, setRepeat] = useState(false);
  const [error, setError] = useState("");
  const field = (key) => ({
    value: form[key],
    onChange: (event) => setForm({ ...form, [key]: event.target.value }),
  });
  function submit(event) {
    event.preventDefault();
    try {
      const next = visit
        ? changeVisit(customer, visit.id, form)
        : appendVisits(customer, form, repeat ? 4 : 1);
      onSave(next);
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <Modal
      title={visit ? "Edit cut" : "Schedule a cut"}
      subtitle={customer.name}
      onClose={onClose}
    >
      <form className="form-stack" onSubmit={submit}>
        <div className="form-grid">
          <Field
            label="Date"
            type="date"
            required
            value={isoDate(form.date)}
            onChange={(event) =>
              event.target.value &&
              setForm({ ...form, date: fromISO(event.target.value) })
            }
          />
          <Field label="Arrival window" options={TIMES} {...field("time")} />
          <Field label="Service" required {...field("service")} />
          <Field label="Status" options={STATUSES} {...field("status")} />
          <Field
            label="Weather"
            options={WEATHER}
            value={form.weather}
            onChange={(event) =>
              setForm({
                ...form,
                weather: event.target.value,
                status:
                  event.target.value === "Rain Delay"
                    ? "Weather Delay"
                    : form.status,
              })
            }
          />
        </div>
        {!visit && (
          <label className="check-label">
            <input
              type="checkbox"
              checked={repeat}
              onChange={(event) => setRepeat(event.target.checked)}
            />
            Repeat weekly for 4 cuts
          </label>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" icon="calendar">
            {visit ? "Save cut" : repeat ? "Schedule 4 cuts" : "Schedule cut"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function QuickScheduleForm({ customers, initialCustomer, onSave, onClose }) {
  const firstChoice =
    initialCustomer ||
    customers.find((customer) => !getNextVisit(customer)) ||
    customers[0];
  const [customerId, setCustomerId] = useState(firstChoice?.id || "");
  const [date, setDate] = useState("");
  const [time, setTime] = useState(TIMES[0]);
  const [service, setService] = useState(firstChoice?.service || "Weekly Mow");
  const [repeat, setRepeat] = useState(false);
  const [error, setError] = useState("");
  const customer = customers.find(
    (item) => String(item.id) === String(customerId),
  );
  const quickCustomers = [...customers].sort(
    (a, b) =>
      Number(Boolean(getNextVisit(a))) - Number(Boolean(getNextVisit(b))),
  );

  function suggestedCut(item) {
    const latest = [...getVisits(item)].sort(
      (a, b) => dateObject(b.date) - dateObject(a.date),
    )[0];
    return {
      date: addWeeks(latest?.date || formatDate(new Date()), 1),
      time: latest?.time || TIMES[0],
      service: latest?.service || item.service,
    };
  }

  function scheduleRecommended(item) {
    const draft = suggestedCut(item);
    try {
      onSave(item, appendVisits(item, draft), draft.date);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    if (!customer) return;
    const draft = suggestedCut(customer);
    setDate(isoDate(draft.date));
    setTime(draft.time);
    setService(draft.service);
    setError("");
  }, [customerId]);

  function chooseOffset(weeks) {
    const latest = [...getVisits(customer)].sort(
      (a, b) => dateObject(b.date) - dateObject(a.date),
    )[0];
    setDate(isoDate(addWeeks(latest?.date || formatDate(new Date()), weeks)));
  }

  function submit(event) {
    event.preventDefault();
    if (!customer || !date) return;
    try {
      onSave(
        customer,
        appendVisits(
          customer,
          { date: fromISO(date), time, service },
          repeat ? 4 : 1,
        ),
        fromISO(date),
      );
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal
      title="Quick schedule"
      subtitle="Choose a customer and their next cut is scheduled."
      onClose={onClose}
    >
      <div
        className="quick-pick-list"
        aria-label="Choose a customer to schedule"
      >
        {quickCustomers.map((item) => {
          const draft = suggestedCut(item);
          return (
            <button
              type="button"
              className="quick-pick-row"
              key={item.id}
              onClick={() => scheduleRecommended(item)}
              aria-label={`Schedule ${item.name} for ${draft.date}`}
            >
              <span className="avatar">
                {item.name
                  .split(" ")
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join("")}
              </span>
              <span className="quick-pick-customer">
                <strong>{item.name}</strong>
                <small>{item.address}</small>
              </span>
              <span className="quick-pick-date">
                <strong>{draft.date}</strong>
                <small>{draft.service}</small>
              </span>
              <span className="quick-pick-action">
                Schedule <Icon name="arrow" size={16} />
              </span>
            </button>
          );
        })}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <details className="custom-schedule-details">
        <summary>Choose a different date or time</summary>
        <form className="form-stack quick-schedule-form" onSubmit={submit}>
          <label className="field">
            <span>Customer</span>
            <select
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
            >
              {customers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          {customer && (
            <div className="schedule-customer-summary">
              <span className="avatar">
                {customer.name
                  .split(" ")
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join("")}
              </span>
              <div>
                <strong>{customer.address}</strong>
                <small>
                  {getNextVisit(customer)
                    ? `Currently scheduled: ${getNextVisit(customer).date}`
                    : "No upcoming cut scheduled"}
                </small>
              </div>
            </div>
          )}
          <div className="date-shortcuts" aria-label="Quick date choices">
            <button type="button" onClick={() => chooseOffset(1)}>
              Latest visit + 7 days
            </button>
            <button type="button" onClick={() => chooseOffset(2)}>
              Latest visit + 14 days
            </button>
            <button
              type="button"
              onClick={() => setDate(isoDate(formatDate(new Date())))}
            >
              Today
            </button>
          </div>
          <div className="form-grid">
            <Field
              label="Date"
              type="date"
              required
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
            <Field
              label="Arrival window"
              options={TIMES}
              value={time}
              onChange={(event) => setTime(event.target.value)}
            />
          </div>
          <Field
            label="Service"
            required
            value={service}
            onChange={(event) => setService(event.target.value)}
          />
          <label className="check-label">
            <input
              type="checkbox"
              checked={repeat}
              onChange={(event) => setRepeat(event.target.checked)}
            />
            Add 4 weekly cuts starting on this date
          </label>
          <div className="modal-actions">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" icon="calendar">
              {repeat ? "Schedule 4 cuts" : "Schedule cut"}
            </Button>
          </div>
        </form>
      </details>
    </Modal>
  );
}
function WeatherForm({ customer, onSave, onClose }) {
  const [text, setText] = useState(customer.weatherNotice);
  return (
    <Modal
      title="Weather notice"
      subtitle={`Visible to ${customer.name}`}
      onClose={onClose}
    >
      <form
        className="form-stack"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({ ...customer, weatherNotice: text });
        }}
      >
        <Field
          label="Customer message"
          area
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Rain is moving this week’s cut to tomorrow."
        />
        <div className="modal-actions">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save notice</Button>
        </div>
      </form>
    </Modal>
  );
}
function DeleteForm({ customer, item, onDelete, onClose }) {
  const [typed, setTyped] = useState("");
  return (
    <Modal
      title={`Delete ${item?.label || "customer"}?`}
      subtitle={customer.name}
      onClose={onClose}
    >
      <p>
        {item
          ? "This item will be removed permanently."
          : "This removes the customer’s portal, schedule, messages, and history permanently."}
      </p>
      {!item && (
        <Field
          label="Type DELETE to confirm"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
        />
      )}
      <div className="modal-actions">
        <Button variant="secondary" onClick={onClose}>
          Keep {item?.label || "customer"}
        </Button>
        <Button
          variant="danger"
          disabled={!item && typed !== "DELETE"}
          onClick={onDelete}
        >
          Delete {item?.label || "customer"}
        </Button>
      </div>
    </Modal>
  );
}

function Owner({ customers, update, create, remove, writable }) {
  const [view, setView] = useState("Overview");
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [detailTab, setDetailTab] = useState("Schedule");
  const [modal, setModal] = useState(null);
  const [notice, setNotice] = useState("");
  const [scheduleFilter, setScheduleFilter] = useState("All upcoming");
  const [historySearch, setHistorySearch] = useState("");
  const selected = customers.find((item) => item.id === selectedId);
  const modalCustomer = customers.find((item) => item.id === modal?.customerId);
  const due = customers.filter((item) => Number(item.balance) > 0);
  const totalDue = due.reduce((sum, item) => sum + Number(item.balance), 0);
  const scheduled = customers
    .flatMap((customer) =>
      getVisits(customer)
        .filter((visit) => visit.status !== "Completed")
        .map((visit) => ({ customer, visit })),
    )
    .sort((a, b) => dateObject(a.visit.date) - dateObject(b.visit.date));
  const openRequests = customers
    .flatMap((customer) =>
      arr(customer.requests).map((request, index) => ({
        customer,
        request,
        index,
      })),
    )
    .filter(({ request }) => request.status !== "Handled");
  const today = formatDate(new Date());
  const todayCuts = scheduled.filter(({ visit }) => visit.date === today);
  const todayDate = dateObject(today);
  const nextWeekDate = new Date(todayDate);
  nextWeekDate.setDate(nextWeekDate.getDate() + 7);
  const overdueCuts = scheduled.filter(
    ({ visit }) => dateObject(visit.date) < todayDate,
  );
  const weekCuts = scheduled.filter(({ visit }) => {
    const date = dateObject(visit.date);
    return date >= todayDate && date <= nextWeekDate;
  });
  const unscheduled = customers.filter((customer) => !getNextVisit(customer));
  const shownSchedule =
    scheduleFilter === "Next 7 days"
      ? weekCuts
      : scheduleFilter === "Overdue"
        ? overdueCuts
        : scheduled;
  const completedCuts = customers
    .flatMap((customer) =>
      serviceHistory(customer).map((item) => ({ customer, item })),
    )
    .sort((a, b) => dateObject(b.item.date) - dateObject(a.item.date));
  const shownHistory = completedCuts.filter(({ customer, item }) =>
    `${customer.name} ${customer.address} ${item.date} ${item.service}`
      .toLowerCase()
      .includes(historySearch.toLowerCase()),
  );
  const filtered = customers.filter(
    (customer) =>
      `${customer.name} ${customer.address} ${customer.code}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (filter !== "Balance due" || Number(customer.balance) > 0),
  );
  function pick(customer) {
    setSelectedId(customer.id);
    setDetailTab("Schedule");
    setView("Customers");
    setNotice("");
  }
  function open(type, customer, extra = {}) {
    if (writable) setModal({ type, customerId: customer?.id, ...extra });
  }
  function save(customer) {
    update(customer.id, () => customer);
    setModal(null);
    setNotice("Change added. Check the save status above.");
  }
  function complete(customer, visit) {
    update(customer.id, (current) =>
      changeVisit(current, visit.id, { status: "Completed" }),
    );
    setNotice(`Cut completed for ${firstName(customer.name)}.`);
  }
  function nextWeek(customer) {
    const latest = [...getVisits(customer)].sort(
      (a, b) => dateObject(b.date) - dateObject(a.date),
    )[0];
    const draft = {
      date: addWeeks(latest?.date || today, 1),
      time: latest?.time || TIMES[0],
      service: latest?.service || customer.service,
    };
    try {
      const next = appendVisits(customer, draft);
      update(customer.id, () => next);
      setNotice(`Next cut scheduled for ${draft.date}.`);
    } catch (err) {
      setNotice(err.message);
    }
  }
  function routeRows(rows) {
    return rows.map(({ customer, visit }) => (
      <div className="route-row" key={`${customer.id}-${visit.id}`}>
        <DateBadge date={visit.date} />
        <button className="row-link grow" onClick={() => pick(customer)}>
          <strong>{customer.name}</strong>
          <span>{customer.address}</span>
          <small>
            {visit.date} · {visit.time}
          </small>
        </button>
        <Pill>{visit.status}</Pill>
        <Button
          variant="secondary"
          icon="check"
          disabled={!writable}
          onClick={() => complete(customer, visit)}
        >
          Complete cut
        </Button>
        <button
          className="icon-button"
          aria-label={`Edit cut for ${customer.name}`}
          disabled={!writable}
          onClick={() => open("visit", customer, { visit })}
        >
          <Icon name="chevron" />
        </button>
      </div>
    ));
  }
  return (
    <div className="owner-layout">
      <aside className="sidebar">
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav aria-label="Owner navigation">
          {[
            ["Overview", "grid"],
            ["Customers", "users"],
            ["Schedule", "calendar"],
            ["History", "history"],
            ["Messages", "message"],
          ].map(([label, icon]) => (
            <button
              key={label}
              aria-current={view === label ? "page" : undefined}
              onClick={() => {
                setView(label);
                setNotice("");
              }}
            >
              <Icon name={icon} />
              <span>{label}</span>
              {label === "Messages" && openRequests.length > 0 && (
                <b>{openRequests.length}</b>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="owner-avatar">JG</div>
          <div>
            <strong>Jesse Geottes</strong>
            <span>Owner workspace</span>
          </div>
        </div>
      </aside>
      <main className="owner-main">
        <div className="page-title">
          <div>
            <span className="eyebrow">
              {new Date()
                .toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })
                .toUpperCase()}
            </span>
            <h1>
              {view === "Overview" ? "Let’s get growing." : view}
              <span className="title-dot">
                {view === "Overview" ? "" : "."}
              </span>
            </h1>
            <p>
              {view === "Overview"
                ? "A clear view of your day. A few clicks to keep it moving."
                : view === "Customers"
                  ? "Everything for each customer, together."
                  : view === "Schedule"
                    ? "Every upcoming cut, in date order."
                    : view === "History"
                      ? "Every lawn you’ve completed, all in one place."
                      : "Keep up with customer notes and requests."}
            </p>
          </div>
          <div className="page-actions">
            <Button
              variant="secondary"
              icon="plus"
              disabled={!writable}
              onClick={() => open("create")}
            >
              Add customer
            </Button>
            <Button
              icon="calendar"
              disabled={!writable || !customers.length}
              onClick={() => open("quick-schedule")}
            >
              Schedule a cut
            </Button>
          </div>
        </div>
        {notice && (
          <div className="notice" role="status">
            <Icon name="check" />
            {notice}
            <button
              className="icon-button"
              aria-label="Dismiss message"
              onClick={() => setNotice("")}
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        )}
        {view === "Overview" && (
          <>
            <div className="stats">
              <button
                className="stat stat-feature"
                onClick={() => setView("Schedule")}
              >
                <span>
                  <Icon name="calendar" />
                  Cuts today
                </span>
                <strong>
                  {todayCuts.length}
                  <small>scheduled</small>
                </strong>
                <div>
                  View your schedule <Icon name="arrow" />
                </div>
              </button>
              <button
                className="stat"
                onClick={() => {
                  setFilter("Balance due");
                  setSelectedId(null);
                  setView("Customers");
                }}
              >
                <span>
                  <Icon name="wallet" />
                  Outstanding balance
                </span>
                <strong>{money(totalDue)}</strong>
                <div>
                  {due.length} {due.length === 1 ? "customer" : "customers"}{" "}
                  with a balance <Icon name="arrow" />
                </div>
              </button>
              <button className="stat" onClick={() => setView("Messages")}>
                <span>
                  <Icon name="message" />
                  Open requests
                </span>
                <strong>
                  {openRequests.length}
                  <small>to review</small>
                </strong>
                <div>
                  Go to messages <Icon name="arrow" />
                </div>
              </button>
            </div>
            <div className="overview-columns">
              <section className="panel">
                <SectionHead
                  title={
                    todayCuts.length ? "Today’s cuts" : "Next on the schedule"
                  }
                  detail={
                    todayCuts.length
                      ? "Finish a cut right from here."
                      : "Your earliest scheduled work."
                  }
                >
                  <button
                    className="text-button"
                    onClick={() => setView("Schedule")}
                  >
                    View all <Icon name="arrow" size={16} />
                  </button>
                </SectionHead>
                {scheduled.length ? (
                  routeRows(
                    (todayCuts.length ? todayCuts : scheduled).slice(0, 5),
                  )
                ) : (
                  <Empty title="Your schedule is clear">
                    Open a customer to schedule their next cut.
                  </Empty>
                )}
              </section>
              <section className="panel balances-panel">
                <SectionHead title="Balances to collect" />
                <div>
                  {due.length ? (
                    due.slice(0, 5).map((customer) => (
                      <div className="balance-row" key={customer.id}>
                        <button
                          className="row-link"
                          onClick={() => pick(customer)}
                        >
                          <strong>{customer.name}</strong>
                          <span>{money(customer.balance)}</span>
                        </button>
                        <Button
                          variant="secondary"
                          disabled={!writable}
                          onClick={() => open("payment", customer)}
                        >
                          Record payment
                        </Button>
                      </div>
                    ))
                  ) : (
                    <Empty title="All caught up">
                      No customer balances are outstanding.
                    </Empty>
                  )}
                </div>
              </section>
            </div>
            <section className="panel schedule-shortcut">
              <div>
                <span className="eyebrow">QUICK SCHEDULING</span>
                <h2>Put the next cut on the calendar</h2>
                <p>
                  Choose a customer. Their usual service and time will be ready
                  for you.
                </p>
              </div>
              <Button
                icon="calendar"
                disabled={!writable || !customers.length}
                onClick={() => open("quick-schedule")}
              >
                Schedule a cut
              </Button>
            </section>
          </>
        )}
        {view === "Schedule" && (
          <div className="schedule-center">
            <div className="schedule-stats">
              <button onClick={() => setScheduleFilter("Next 7 days")}>
                <span>Next 7 days</span>
                <strong>{weekCuts.length}</strong>
                <small>cuts</small>
              </button>
              <button
                className={overdueCuts.length ? "attention" : ""}
                onClick={() => setScheduleFilter("Overdue")}
              >
                <span>Overdue</span>
                <strong>{overdueCuts.length}</strong>
                <small>need attention</small>
              </button>
              <button onClick={() => setScheduleFilter("All upcoming")}>
                <span>Not scheduled</span>
                <strong>{unscheduled.length}</strong>
                <small>customers</small>
              </button>
            </div>
            <div className="schedule-columns">
              <section className="panel">
                <SectionHead
                  title="Upcoming cuts"
                  detail={`${shownSchedule.length} shown · ${scheduled.length} total`}
                >
                  <div className="schedule-filter">
                    <select
                      aria-label="Filter schedule"
                      value={scheduleFilter}
                      onChange={(event) =>
                        setScheduleFilter(event.target.value)
                      }
                    >
                      {["All upcoming", "Next 7 days", "Overdue"].map(
                        (item) => (
                          <option key={item}>{item}</option>
                        ),
                      )}
                    </select>
                    <Button
                      icon="plus"
                      disabled={!writable || !customers.length}
                      onClick={() => open("quick-schedule")}
                    >
                      Add cut
                    </Button>
                  </div>
                </SectionHead>
                {shownSchedule.length ? (
                  routeRows(shownSchedule)
                ) : (
                  <Empty title="Nothing in this view">
                    Choose another filter or schedule a cut.
                  </Empty>
                )}
              </section>
              <section className="panel unscheduled-panel">
                <SectionHead
                  title="Needs a next cut"
                  detail={`${unscheduled.length} customers without an upcoming visit`}
                />
                {unscheduled.length ? (
                  unscheduled.map((customer) => (
                    <div className="unscheduled-row" key={customer.id}>
                      <button
                        className="row-link"
                        onClick={() => pick(customer)}
                      >
                        <strong>{customer.name}</strong>
                        <span>{customer.address}</span>
                      </button>
                      <Button
                        variant="secondary"
                        disabled={!writable}
                        onClick={() => open("quick-schedule", customer)}
                      >
                        Schedule
                      </Button>
                    </div>
                  ))
                ) : (
                  <Empty title="Everyone is scheduled">
                    Every customer has an upcoming cut.
                  </Empty>
                )}
              </section>
            </div>
          </div>
        )}
        {view === "Customers" && (
          <div className={`customers-layout ${selected ? "has-selected" : ""}`}>
            <section className="panel customer-directory">
              <div className="search-field">
                <Icon name="search" />
                <input
                  aria-label="Search customers"
                  placeholder="Name, address, or code"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <div className="segmented">
                {["All", "Balance due"].map((item) => (
                  <button
                    key={item}
                    aria-pressed={filter === item}
                    onClick={() => setFilter(item)}
                  >
                    {item}
                    {item === "All"
                      ? ` · ${customers.length}`
                      : ` · ${due.length}`}
                  </button>
                ))}
              </div>
              <div className="directory-list">
                {filtered.map((customer) => (
                  <button
                    className={`customer-row ${selectedId === customer.id ? "selected" : ""}`}
                    aria-label={`${customer.name}, ${customer.address}, ${money(customer.balance)} balance`}
                    key={customer.id}
                    onClick={() => pick(customer)}
                  >
                    <span className="avatar">
                      {customer.name
                        .split(" ")
                        .map((s) => s[0])
                        .slice(0, 2)
                        .join("")}
                    </span>
                    <span className="customer-row-text">
                      <strong>{customer.name}</strong>
                      <small>{customer.address}</small>
                    </span>
                    <span
                      className={`customer-balance ${Number(customer.balance) > 0 ? "due" : ""}`}
                    >
                      {Number(customer.balance) > 0
                        ? money(customer.balance)
                        : "Paid"}
                    </span>
                  </button>
                ))}
                {!filtered.length && (
                  <Empty title="No matching customers">
                    {customers.length
                      ? "Try another name or clear the filter."
                      : "Add your first customer to get started."}
                  </Empty>
                )}
              </div>
            </section>
            <section className="customer-detail">
              {selected ? (
                <>
                  <button
                    className="text-button mobile-back"
                    onClick={() => setSelectedId(null)}
                  >
                    ← All customers
                  </button>
                  <div className="detail-heading">
                    <div>
                      <span className="eyebrow">CUSTOMER DETAILS</span>
                      <h2>{selected.name}</h2>
                      <p>{selected.address}</p>
                    </div>
                    <Button
                      variant="secondary"
                      disabled={!writable}
                      onClick={() => open("edit", selected)}
                    >
                      Edit details
                    </Button>
                  </div>
                  <div className="detail-summary">
                    <div>
                      <span>Balance due</span>
                      <strong>{money(selected.balance)}</strong>
                      <Pill>{selected.paymentStatus}</Pill>
                    </div>
                    <div>
                      <span>Next cut</span>
                      <strong className="next-date">
                        {getNextVisit(selected)?.date || "Not scheduled"}
                      </strong>
                      <small>
                        {getNextVisit(selected)?.time || selected.service}
                      </small>
                    </div>
                  </div>
                  <div className="quick-actions">
                    <Button
                      icon="wallet"
                      disabled={!writable || Number(selected.balance) <= 0}
                      onClick={() => open("payment", selected)}
                    >
                      Record payment
                    </Button>
                    <Button
                      variant="secondary"
                      icon="plus"
                      disabled={!writable}
                      onClick={() => open("visit", selected)}
                    >
                      New cut
                    </Button>
                    <Button
                      variant="secondary"
                      icon="calendar"
                      disabled={!writable}
                      onClick={() => nextWeek(selected)}
                    >
                      Next cut +7 days
                    </Button>
                  </div>
                  <nav className="detail-tabs" aria-label="Customer details">
                    {["Schedule", "Messages", "Account"].map((item) => (
                      <button
                        key={item}
                        aria-current={detailTab === item ? "page" : undefined}
                        onClick={() => setDetailTab(item)}
                      >
                        {item}
                      </button>
                    ))}
                  </nav>
                  {detailTab === "Schedule" && (
                    <div className="panel">
                      <SectionHead title="Visits" />
                      <div className="detail-visits">
                        {[...getVisits(selected)]
                          .sort(
                            (a, b) => dateObject(a.date) - dateObject(b.date),
                          )
                          .map((visit) => (
                            <div className="detail-visit" key={visit.id}>
                              <div className="visit-line">
                                <DateBadge date={visit.date} />
                                <div className="grow">
                                  <strong>{visit.date}</strong>
                                  <p>
                                    {visit.time}
                                    <br />
                                    {visit.service}
                                  </p>
                                </div>
                                <Pill>{visit.status}</Pill>
                              </div>
                              <div className="visit-actions">
                                {visit.status !== "Completed" && (
                                  <Button
                                    variant="secondary"
                                    icon="check"
                                    disabled={!writable}
                                    onClick={() => complete(selected, visit)}
                                  >
                                    Complete cut
                                  </Button>
                                )}
                                <button
                                  className="text-button"
                                  disabled={!writable}
                                  onClick={() =>
                                    open("visit", selected, { visit })
                                  }
                                >
                                  Edit cut
                                </button>
                                <button
                                  className="text-button danger-text"
                                  disabled={!writable}
                                  onClick={() =>
                                    open("delete", selected, {
                                      item: { label: "cut", visitId: visit.id },
                                    })
                                  }
                                >
                                  Delete
                                </button>
                                {visit.weather !== "Clear" && (
                                  <Pill>{visit.weather}</Pill>
                                )}
                              </div>
                            </div>
                          ))}
                        {!getVisits(selected).length && (
                          <Empty title="No visits yet">
                            Use New cut to schedule a visit.
                          </Empty>
                        )}
                      </div>
                    </div>
                  )}
                  {detailTab === "Messages" && (
                    <div className="panel">
                      <SectionHead title="Comments & requests" />
                      {renderMessages(selected)}
                    </div>
                  )}
                  {detailTab === "Account" && (
                    <div className="panel account-details">
                      <SectionHead title="Account & settings" />
                      <div className="account-row">
                        <div>
                          <span>Portal code</span>
                          <strong className="portal-code">
                            {selected.code}
                          </strong>
                        </div>
                        <Button
                          variant="secondary"
                          disabled={!writable}
                          onClick={() => open("edit", selected)}
                        >
                          Edit details
                        </Button>
                      </div>
                      <div className="account-row">
                        <div>
                          <span>Payment</span>
                          <strong>
                            {money(selected.balance)} · {selected.paymentStatus}
                          </strong>
                          {selected.paidDate && (
                            <p>Last paid: {selected.paidDate}</p>
                          )}
                        </div>
                        <Button
                          variant="secondary"
                          disabled={!writable}
                          onClick={() => open("adjust", selected)}
                        >
                          Manage balance
                        </Button>
                      </div>
                      {selected.paymentNote && (
                        <p className="preserve-lines muted">
                          {selected.paymentNote}
                        </p>
                      )}
                      <div className="account-row">
                        <div>
                          <span>Weather notice</span>
                          <p>{selected.weatherNotice || "No active notice"}</p>
                        </div>
                        <Button
                          variant="secondary"
                          icon="weather"
                          disabled={!writable}
                          onClick={() => open("weather", selected)}
                        >
                          Edit notice
                        </Button>
                      </div>
                      <div className="account-notes">
                        <span className="eyebrow">PRIVATE OWNER NOTES</span>
                        <p className="preserve-lines">
                          {selected.notes || "No private notes yet."}
                        </p>
                      </div>
                      <details className="history-details">
                        <summary>
                          Service history ({serviceHistory(selected).length})
                        </summary>
                        {serviceHistory(selected).map((item) => (
                          <div className="message-item" key={item.id}>
                            <strong>{item.date}</strong>
                            <p>
                              {item.service} · {item.status}
                            </p>
                          </div>
                        ))}
                      </details>
                      <div className="danger-zone">
                        <span>Remove this customer and their portal</span>
                        <button
                          className="text-button danger-text"
                          disabled={!writable}
                          onClick={() => open("delete", selected)}
                        >
                          Delete customer
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="panel select-customer">
                  <Icon name="users" size={34} />
                  <h2>Choose a customer</h2>
                  <p>
                    Schedule cuts, record payments, and manage their portal.
                  </p>
                </div>
              )}
            </section>
          </div>
        )}
        {view === "History" && (
          <div className="history-center">
            <div className="history-summary">
              <div>
                <span>Completed lawns</span>
                <strong>{completedCuts.length}</strong>
              </div>
              <div>
                <span>Customers served</span>
                <strong>
                  {
                    new Set(completedCuts.map(({ customer }) => customer.id))
                      .size
                  }
                </strong>
              </div>
            </div>
            <section className="panel">
              <SectionHead
                title="All completed lawns"
                detail={`${shownHistory.length} of ${completedCuts.length} cuts shown`}
              >
                <div className="search-field history-search">
                  <Icon name="search" />
                  <input
                    aria-label="Search completed lawns"
                    placeholder="Customer, address, service, or date"
                    value={historySearch}
                    onChange={(event) => setHistorySearch(event.target.value)}
                  />
                </div>
              </SectionHead>
              {shownHistory.length ? (
                shownHistory.map(({ customer, item }) => (
                  <div
                    className="history-row"
                    key={`${customer.id}-${item.id}`}
                    aria-label={`${customer.name}, ${item.date}, ${item.service}, completed`}
                  >
                    <DateBadge date={item.date} />
                    <button
                      className="row-link grow"
                      onClick={() => pick(customer)}
                    >
                      <strong>{customer.name}</strong>
                      <span>{customer.address}</span>
                      <small>
                        {item.service}
                        {item.time ? ` · ${item.time}` : ""}
                      </small>
                    </button>
                    <Pill>{item.status}</Pill>
                  </div>
                ))
              ) : (
                <Empty
                  title={
                    completedCuts.length
                      ? "No matching cuts"
                      : "No completed lawns yet"
                  }
                >
                  {completedCuts.length
                    ? "Try another customer, address, service, or date."
                    : "Cuts appear here as soon as you mark them complete."}
                </Empty>
              )}
            </section>
          </div>
        )}
        {view === "Messages" && (
          <div className="inbox">
            {customers
              .filter(
                (customer) =>
                  customer.comments.length || customer.requests.length,
              )
              .map((customer) => (
                <section className="panel" key={customer.id}>
                  <SectionHead title={customer.name} detail={customer.address}>
                    <button
                      className="text-button"
                      onClick={() => pick(customer)}
                    >
                      Customer <Icon name="arrow" size={16} />
                    </button>
                  </SectionHead>
                  {renderMessages(customer)}
                </section>
              ))}
            {!customers.some(
              (customer) =>
                customer.comments.length || customer.requests.length,
            ) && (
              <section className="panel">
                <Empty title="No messages yet">
                  Customer comments and requests will appear here.
                </Empty>
              </section>
            )}
          </div>
        )}
        <footer className="owner-footer">
          Geottes Lawn Service{" "}
          <span>
            {customers.length} customer portals · {scheduled.length} upcoming
            cuts · {completedCuts.length} completed
          </span>
        </footer>
      </main>
      {modal?.type === "create" && (
        <CustomerForm
          customers={customers}
          onSave={(customer) => {
            create(customer);
            setModal(null);
            pick(customer);
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "quick-schedule" && (
        <QuickScheduleForm
          customers={customers}
          initialCustomer={modalCustomer}
          onClose={() => setModal(null)}
          onSave={(customer, next, scheduledDate) => {
            update(customer.id, () => next);
            setModal(null);
            setNotice(
              `Cut scheduled for ${customer.name} on ${scheduledDate}.`,
            );
          }}
        />
      )}
      {modalCustomer && modal?.type === "edit" && (
        <CustomerForm
          customer={modalCustomer}
          customers={customers}
          onSave={save}
          onClose={() => setModal(null)}
        />
      )}
      {modalCustomer && ["payment", "adjust"].includes(modal?.type) && (
        <PaymentForm
          customer={modalCustomer}
          adjust={modal.type === "adjust"}
          onSave={save}
          onClose={() => setModal(null)}
        />
      )}
      {modalCustomer && modal?.type === "visit" && (
        <VisitForm
          customer={modalCustomer}
          visit={modal.visit}
          onSave={save}
          onClose={() => setModal(null)}
        />
      )}
      {modalCustomer && modal?.type === "weather" && (
        <WeatherForm
          customer={modalCustomer}
          onSave={save}
          onClose={() => setModal(null)}
        />
      )}
      {modalCustomer && modal?.type === "delete" && (
        <DeleteForm
          customer={modalCustomer}
          item={modal.item}
          onClose={() => setModal(null)}
          onDelete={() => {
            if (modal.item?.visitId !== undefined)
              update(modalCustomer.id, (current) => ({
                ...current,
                visits: getVisits(current).filter(
                  (visit) => visit.id !== modal.item.visitId,
                ),
              }));
            else if (modal.item?.commentIndex !== undefined)
              update(modalCustomer.id, (current) => ({
                ...current,
                comments: current.comments.filter(
                  (_, index) => index !== modal.item.commentIndex,
                ),
              }));
            else {
              remove(modalCustomer.id);
              setSelectedId(null);
            }
            setModal(null);
          }}
        />
      )}
    </div>
  );
  function renderMessages(customer) {
    return (
      <>
        {!customer.comments.length && !customer.requests.length && (
          <Empty title="No messages yet" />
        )}
        {customer.requests.map((request, index) => (
          <div className="message-item" key={`request${index}`}>
            <div className="section-head">
              <strong>{request.type}</strong>
              <Pill>{request.status || "New"}</Pill>
            </div>
            {request.note && <p>{request.note}</p>}
            <button
              className="text-button"
              disabled={!writable}
              onClick={() =>
                update(customer.id, (current) => ({
                  ...current,
                  requests: current.requests.map((item, i) =>
                    i === index
                      ? {
                          ...item,
                          status: item.status === "Handled" ? "New" : "Handled",
                        }
                      : item,
                  ),
                }))
              }
            >
              {request.status === "Handled" ? "Reopen request" : "Mark handled"}
            </button>
          </div>
        ))}
        {customer.comments.map((comment, index) => (
          <div className="message-item" key={`comment${index}`}>
            <span className="eyebrow">COMMENT</span>
            <p className="preserve-lines">{comment}</p>
            <button
              className="text-button danger-text"
              disabled={!writable}
              onClick={() =>
                open("delete", customer, {
                  item: { label: "comment", commentIndex: index },
                })
              }
            >
              Delete comment
            </button>
          </div>
        ))}
      </>
    );
  }
}

export default function App() {
  const [customers, setCustomers] = useState([]);
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  const [sync, setSync] = useState("Connecting");
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const current = useRef([]);
  const pending = useRef(null);
  const saving = useRef(false);
  const blocked = useRef(true);
  useEffect(() => {
    let active = true;
    setReady(false);
    setLoadError(false);
    blocked.current = true;
    loadCloudCustomers().then((data) => {
      if (!active) return;
      if (!data) {
        setLoadError(true);
        setSync("Connection unavailable");
        return;
      }
      current.current = data;
      setCustomers(data);
      try {
        saveCustomers(data);
      } catch {}
      setReady(true);
      blocked.current = false;
      setSync("All changes saved");
    });
    return () => {
      active = false;
    };
  }, [retry]);
  useEffect(() => {
    const warn = (event) => {
      if (pending.current || saving.current || sync === "Save failed") {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [sync]);
  async function flush() {
    if (saving.current || blocked.current) return;
    saving.current = true;
    while (pending.current) {
      const next = pending.current;
      pending.current = null;
      setSync("Saving changes…");
      let ok = false;
      try {
        ok = await saveCloudCustomers(next);
      } catch {}
      if (!ok) {
        blocked.current = true;
        pending.current = current.current;
        setSync("Save failed");
        break;
      }
      if (!pending.current) setSync("All changes saved");
    }
    saving.current = false;
  }
  function commit(transform) {
    if (blocked.current) return;
    const next = transform(current.current).map(normalizeCustomer);
    current.current = next;
    setCustomers(next);
    try {
      saveCustomers(next);
    } catch {}
    pending.current = next;
    void flush();
  }
  function update(id, transform) {
    commit((items) =>
      items.map((item) => (item.id === id ? transform(item) : item)),
    );
  }
  const writable = ready && sync !== "Save failed";
  const customer = customers.find((item) => item.id === session);
  const owner = session === "owner";
  if (session === null)
    return (
      <Login
        customers={customers}
        ready={ready}
        error={loadError}
        onLogin={setSession}
        onRetry={() => setRetry((value) => value + 1)}
      />
    );
  return (
    <>
      <header className="app-header">
        <Brand />
        <div className="header-right">
          <span
            className={`sync ${sync === "Save failed" ? "failed" : ""}`}
            role="status"
          >
            <i />
            {sync}
          </span>
          <span className="role-label">{owner ? "OWNER" : "CUSTOMER"}</span>
          <button
            className="icon-button"
            aria-label="Sign out"
            onClick={() => setSession(null)}
          >
            <Icon name="logout" />
          </button>
        </div>
      </header>
      {sync === "Save failed" && (
        <div className="save-error" role="alert">
          Your last change hasn’t saved. Another device may have updated the
          account, or the connection was interrupted. Keep this page open and
          reload the latest records before making more changes.{" "}
          <button
            onClick={() => {
              if (
                window.confirm(
                  "Reload the latest saved records? Unsaved changes on this page will be discarded.",
                )
              ) {
                pending.current = null;
                setRetry((value) => value + 1);
              }
            }}
          >
            Reload saved records
          </button>
        </div>
      )}
      {owner ? (
        <Owner
          customers={customers}
          update={update}
          create={(item) => commit((items) => [...items, item])}
          remove={(id) =>
            commit((items) => items.filter((item) => item.id !== id))
          }
          writable={writable}
        />
      ) : customer ? (
        <CustomerPortal
          customer={customer}
          update={update}
          writable={writable}
        />
      ) : (
        <main className="customer-page">
          <Empty title="Portal unavailable">
            Sign out and enter your code again.
          </Empty>
        </main>
      )}
    </>
  );
}
