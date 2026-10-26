const express = require("express");
const cors = require("cors");
const { z, ZodError } = require("zod");

const slotInput = z.object({
  clinicName: z.string().trim().min(1, "Clinic name is required").max(120),
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
}).refine((slot) => Date.parse(slot.startsAt) < Date.parse(slot.endsAt), {
  message: "End time must be after start time",
  path: ["endsAt"],
});

const bookingInput = z.object({
  patientName: z.string().trim().min(1, "Patient name is required").max(120),
  patientEmail: z.email("Enter a valid email address").max(254),
});

function createApp(db) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const listSlots = db.prepare(`
    SELECT s.id, s.clinic_name AS clinicName, s.starts_at AS startsAt,
      s.ends_at AS endsAt, s.status,
      CASE WHEN b.id IS NULL THEN 1 ELSE 0 END AS isAvailable
    FROM slots s
    LEFT JOIN bookings b ON b.slot_id = s.id AND b.status = 'confirmed'
    WHERE s.status = 'available'
    ORDER BY s.starts_at
  `);

  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

  app.get("/api/slots", (_req, res) => {
    res.json(listSlots.all().map((slot) => ({
      ...slot,
      isAvailable: Boolean(slot.isAvailable),
    })));
  });

  app.post("/api/slots", (req, res, next) => {
    try {
      const input = slotInput.parse(req.body);
      const result = db.prepare(`
        INSERT INTO slots (clinic_name, starts_at, ends_at)
        VALUES (?, ?, ?)
      `).run(input.clinicName, new Date(input.startsAt).toISOString(), new Date(input.endsAt).toISOString());
      const slot = db.prepare(`
        SELECT id, clinic_name AS clinicName, starts_at AS startsAt, ends_at AS endsAt, status
        FROM slots WHERE id = ?
      `).get(result.lastInsertRowid);
      res.status(201).json(slot);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/slots/:slotId", (req, res, next) => {
    try {
      const slotId = Number(req.params.slotId);
      if (!Number.isSafeInteger(slotId) || slotId < 1) {
        return res.status(400).json({ error: "Slot ID must be a positive integer" });
      }
      const cancelSlot = db.transaction((id) => {
        const slot = db.prepare("SELECT id, status FROM slots WHERE id = ?").get(id);
        if (!slot || slot.status === "cancelled") {
          return { error: "Active slot not found", status: 404 };
        }
        const activeBooking = db.prepare(
          "SELECT id FROM bookings WHERE slot_id = ? AND status = 'confirmed'",
        ).get(id);
        if (activeBooking) {
          return { error: "Cancel the booking before cancelling this slot", status: 409 };
        }
        db.prepare("UPDATE slots SET status = 'cancelled' WHERE id = ?").run(id);
        return { cancelled: true };
      });
      const outcome = cancelSlot.immediate(slotId);
      if (outcome.error) {
        return res.status(outcome.status).json({ error: outcome.error });
      }
      return res.status(204).end();
    } catch (error) {
      return next(error);
    }
  });

  app.post("/api/slots/:slotId/bookings", (req, res, next) => {
    try {
      const slotId = Number(req.params.slotId);
      if (!Number.isSafeInteger(slotId) || slotId < 1) {
        return res.status(400).json({ error: "Slot ID must be a positive integer" });
      }
      const input = bookingInput.parse(req.body);
      const reserve = db.transaction(() => {
        const slot = db.prepare("SELECT id, status FROM slots WHERE id = ?").get(slotId);
        if (!slot || slot.status !== "available") {
          return { error: "Slot not found", status: 404 };
        }
        const result = db.prepare(`
          INSERT INTO bookings (slot_id, patient_name, patient_email)
          VALUES (?, ?, ?)
        `).run(slotId, input.patientName, input.patientEmail.trim().toLowerCase());
        return {
          booking: db.prepare(`
            SELECT id, slot_id AS slotId, patient_name AS patientName,
              patient_email AS patientEmail, status, created_at AS createdAt
            FROM bookings WHERE id = ?
          `).get(result.lastInsertRowid),
        };
      });
      const outcome = reserve.immediate();
      if (outcome.error) {
        return res.status(outcome.status).json({ error: outcome.error });
      }
      return res.status(201).json(outcome.booking);
    } catch (error) {
      if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
        return res.status(409).json({ error: "This slot has already been booked" });
      }
      return next(error);
    }
  });

  app.delete("/api/bookings/:bookingId", (req, res, next) => {
    try {
      const bookingId = Number(req.params.bookingId);
      if (!Number.isSafeInteger(bookingId) || bookingId < 1) {
        return res.status(400).json({ error: "Booking ID must be a positive integer" });
      }
      const booking = db.prepare("SELECT id, status FROM bookings WHERE id = ?").get(bookingId);
      if (!booking || booking.status === "cancelled") {
        return res.status(404).json({ error: "Active booking not found" });
      }
      db.prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ?").run(bookingId);
      return res.status(204).end();
    } catch (error) {
      return next(error);
    }
  });

  app.use((error, _req, res, _next) => {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: "Invalid request",
        details: error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }
    if (error instanceof SyntaxError && "body" in error) {
      return res.status(400).json({ error: "Request body must contain valid JSON" });
    }
    console.error(error);
    return res.status(500).json({ error: "An unexpected server error occurred" });
  });

  return app;
}

module.exports = { createApp };
