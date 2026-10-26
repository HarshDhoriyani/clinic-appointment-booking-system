import { useEffect, useState } from "react";

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail = body.details?.map((item) => item.message).join(", ");
    throw new Error(detail || body.error || "Request failed. Please try again.");
  }
  return response.status === 204 ? null : response.json();
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatWeekday(value) {
  return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(new Date(value));
}

export default function App() {
  const [slots, setSlots] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [patientName, setPatientName] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [myBookings, setMyBookings] = useState({});
  const [clinicName, setClinicName] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [busy, setBusy] = useState(false);

  async function refreshSlots() {
    setSlots(await api("/api/slots"));
  }

  useEffect(() => {
    refreshSlots().catch((reason) => setError(reason.message));
  }, []);

  async function perform(action, successMessage) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      await refreshSlots();
      setMessage(successMessage);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }

  function bookSlot(slotId) {
    perform(async () => {
      const booking = await api(`/api/slots/${slotId}/bookings`, {
        method: "POST",
        body: JSON.stringify({ patientName, patientEmail }),
      });
      setMyBookings((current) => ({ ...current, [slotId]: booking.id }));
    }, "Your appointment is booked.");
  }

  function cancelBooking(slotId) {
    perform(async () => {
      await api(`/api/bookings/${myBookings[slotId]}`, { method: "DELETE" });
      setMyBookings((current) => {
        const updated = { ...current };
        delete updated[slotId];
        return updated;
      });
    }, "Your booking has been cancelled.");
  }

  function cancelSlot(slotId) {
    perform(async () => {
      await api(`/api/slots/${slotId}`, { method: "DELETE" });
    }, "Appointment slot cancelled.");
  }

  function createSlot(event) {
    event.preventDefault();
    perform(async () => {
      await api("/api/slots", {
        method: "POST",
        body: JSON.stringify({
          clinicName,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
        }),
      });
      setClinicName("");
      setStartsAt("");
      setEndsAt("");
    }, "Appointment slot published.");
  }

  return (
    <main className="page">
      <header className="topbar">
        <a className="brand" href="/" aria-label="CareSlot home">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
          </span>
          <span>Care<span className="brand-accent">Slot</span></span>
        </a>
        <nav className="topbar-nav" aria-label="Main navigation">
          <a href="#appointments">Appointments</a>
          <a className="nav-cta" href="#publish">For clinics <span>↗</span></a>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="hero-kicker"><span className="live-dot" /> HEALTHCARE, ON YOUR SCHEDULE</span>
          <h1>A healthier you starts with <span>one appointment.</span></h1>
          <p>Find a time that works, choose your clinic, and take the next step in your care — all in a few clicks.</p>
          <a className="hero-link" href="#appointments">Find your appointment <span aria-hidden="true">↓</span></a>
          <div className="hero-trust"><span className="trust-check">✓</span> Simple, secure appointment booking</div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="hero-orbit orbit-one" />
          <div className="hero-orbit orbit-two" />
          <div className="hero-spark spark-one">✳</div>
          <div className="hero-spark spark-two">✦</div>
          <div className="doctor-card">
            <div className="doctor-avatar">
              <svg viewBox="0 0 120 120" fill="none">
                <circle cx="60" cy="60" r="60" fill="#D7EEE5" />
                <path d="M25 111c3-23 16-35 35-35s32 12 35 35" fill="#397E70" />
                <path d="M40 47c0-17 8-27 21-27 14 0 22 10 22 27v12c0 15-9 25-22 25S40 74 40 59V47Z" fill="#C9825D" />
                <path d="M38 48c-2-20 8-32 25-32 17 0 25 13 22 32l-4 2c-2-10-7-15-17-17-7 7-16 10-26 10l-1 5-4 2Z" fill="#263B38" />
                <path d="M48 56h1m23 0h1" stroke="#263B38" strokeWidth="4" strokeLinecap="round" />
                <path d="M53 69c4 3 10 3 14 0" stroke="#9C5848" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M53 80v9l7 8 8-8v-9" fill="#C9825D" />
                <path d="M50 81 60 95l10-14 14 8-9 28H45l-9-28 14-8Z" fill="white" />
                <path d="M60 95v22" stroke="#D5E5E0" strokeWidth="2" />
                <path d="M60 97v10m-5-5h10" stroke="#65A694" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
            <div className="doctor-info"><strong>Care, made simple</strong><span>Find the right time for you</span></div>
          </div>
          <div className="availability-float"><span className="float-icon">✓</span><span><strong>Appointments</strong><small>Easy to book, easy to manage</small></span></div>
        </div>
      </section>

      <div className="notices" aria-live="polite">
        {error && <div className="notice error" role="alert"><span>!</span>{error}</div>}
        {message && <div className="notice success" role="status"><span>✓</span>{message}</div>}
      </div>

      <section className="booking-section" id="appointments">
        <div className="section-heading">
          <div className="heading-copy"><span className="eyebrow">YOUR NEXT STEP</span><h2>Find an appointment</h2><p>Choose a clinic and time that work for you.</p></div>
          <span className="slot-count"><span className="count-dot" />{slots.filter((slot) => slot.isAvailable).length} available</span>
        </div>
        <div className="booking-layout">
          <div className="slot-list">
            {slots.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon" aria-hidden="true">
                  <svg viewBox="0 0 48 48" fill="none"><rect x="7" y="11" width="34" height="30" rx="7" stroke="currentColor" strokeWidth="2" /><path d="M15 7v8m18-8v8M8 20h32m-21 8h10m-10 6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                </div>
                <h3>No appointments just yet</h3><p>New appointment times will show up here as soon as they’re available.</p>
              </div>
            ) : slots.map((slot) => (
              <article className={`slot-card ${slot.isAvailable ? "" : "unavailable"}`} key={slot.id}>
                <div className="date-tile"><span>{formatWeekday(slot.startsAt)}</span><strong>{new Date(slot.startsAt).getDate()}</strong></div>
                <div className="slot-details">
                  <h3>{slot.clinicName}</h3>
                  <p><span className="time-icon" aria-hidden="true">◷</span>{formatDate(slot.startsAt)} <span className="detail-divider">·</span> {formatTime(slot.startsAt)} – {formatTime(slot.endsAt)}</p>
                </div>
                {slot.isAvailable
                  ? <div className="slot-actions">
                    <button className="button primary" disabled={busy || !patientName.trim() || !patientEmail.trim()} onClick={() => bookSlot(slot.id)}>Book this time <span aria-hidden="true">→</span></button>
                    <button className="text-action" disabled={busy} onClick={() => cancelSlot(slot.id)}>Remove slot</button>
                  </div>
                  : myBookings[slot.id]
                    ? <button className="button cancel" disabled={busy} onClick={() => cancelBooking(slot.id)}>Cancel booking</button>
                    : <span className="booked-label"><span />Booked</span>}
              </article>
            ))}
          </div>
          <aside className="patient-panel">
            <div className="panel-heading"><span className="panel-icon" aria-hidden="true">01</span><span className="panel-step">STEP ONE</span></div>
            <h3>Who’s booking?</h3>
            <p>Add your details to reserve an appointment.</p>
            <label htmlFor="patient-name">Full name</label>
            <input id="patient-name" autoComplete="name" value={patientName} onChange={(event) => setPatientName(event.target.value)} placeholder="e.g. Alex Morgan" />
            <label htmlFor="patient-email">Email address</label>
            <input id="patient-email" type="email" autoComplete="email" value={patientEmail} onChange={(event) => setPatientEmail(event.target.value)} placeholder="you@example.com" />
            <div className="privacy-note"><span aria-hidden="true">✓</span> Your details are only used for this booking.</div>
          </aside>
        </div>
      </section>

      <section className="publish-section" id="publish">
        <div className="publish-intro">
          <span className="eyebrow">FOR CLINICS</span>
          <h2>Make room for better care.</h2>
          <p>Publish an appointment slot and help someone take their next step.</p>
          <span className="publish-tag"><span>✳</span> Clinic partner tools</span>
        </div>
        <form className="publish-form" onSubmit={createSlot}>
          <div className="publish-form-heading"><strong>Publish a slot</strong><span>All fields are required</span></div>
          <label>Clinic name<input required maxLength="120" value={clinicName} onChange={(event) => setClinicName(event.target.value)} placeholder="Northside Family Clinic" /></label>
          <div className="date-fields">
            <label>Starts<input required type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label>
            <label>Ends<input required type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} /></label>
          </div>
          <button className="button primary" disabled={busy || !clinicName.trim() || !startsAt || !endsAt}>Publish appointment <span aria-hidden="true">→</span></button>
        </form>
      </section>
      <footer><a className="footer-brand" href="/"><span className="brand-mark">+</span> Care<span>Slot</span></a><span>Care that fits your day.</span><span className="footer-copy">© 2026 CareSlot</span></footer>
    </main>
  );
}
