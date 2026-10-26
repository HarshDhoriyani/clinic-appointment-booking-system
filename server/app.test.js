const { afterEach, beforeEach, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { createDatabase } = require("./database");
const { createApp } = require("./app");

describe("clinic booking API", () => {
  let db;
  let app;

  beforeEach(() => {
    db = createDatabase(":memory:");
    app = createApp(db);
  });

  afterEach(() => db.close());

  async function createSlot(overrides = {}) {
    const response = await request(app).post("/api/slots").send({
      clinicName: "North Clinic",
      startsAt: "2030-05-20T09:00:00Z",
      endsAt: "2030-05-20T09:30:00Z",
      ...overrides,
    });
    assert.equal(response.status, 201);
    return response.body;
  }

  it("rejects invalid time ranges and malformed patient details", async () => {
    const invalidSlot = await request(app).post("/api/slots").send({
      clinicName: "North Clinic",
      startsAt: "2030-05-20T09:30:00Z",
      endsAt: "2030-05-20T09:00:00Z",
    });
    assert.equal(invalidSlot.status, 400);
    assert.match(invalidSlot.body.details[0].message, /after start time/i);

    const slot = await createSlot();
    const invalidBooking = await request(app)
      .post(`/api/slots/${slot.id}/bookings`)
      .send({ patientName: "", patientEmail: "not-an-email" });
    assert.equal(invalidBooking.status, 400);
    assert.equal(invalidBooking.body.error, "Invalid request");
    assert.ok(invalidBooking.body.details.length >= 2);
  });

  it("allows only one booking for a slot, including simultaneous requests", async () => {
    const slot = await createSlot();
    const responses = await Promise.all([
      request(app).post(`/api/slots/${slot.id}/bookings`)
        .send({ patientName: "Alex", patientEmail: "alex@example.com" }),
      request(app).post(`/api/slots/${slot.id}/bookings`)
        .send({ patientName: "Sam", patientEmail: "sam@example.com" }),
    ]);

    assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
    const bookings = db.prepare(
      "SELECT COUNT(*) AS count FROM bookings WHERE slot_id = ? AND status = 'confirmed'",
    ).get(slot.id);
    assert.equal(bookings.count, 1);
  });

  it("releases a slot when its booking is cancelled", async () => {
    const slot = await createSlot();
    const first = await request(app).post(`/api/slots/${slot.id}/bookings`)
      .send({ patientName: "Alex", patientEmail: "alex@example.com" });
    assert.equal(first.status, 201);

    const blockedSlotCancel = await request(app).delete(`/api/slots/${slot.id}`);
    assert.equal(blockedSlotCancel.status, 409);

    const cancelled = await request(app).delete(`/api/bookings/${first.body.id}`);
    assert.equal(cancelled.status, 204);

    const second = await request(app).post(`/api/slots/${slot.id}/bookings`)
      .send({ patientName: "Sam", patientEmail: "sam@example.com" });
    assert.equal(second.status, 201);
  });

  it("lists availability and removes cancelled slots from the list", async () => {
    const slot = await createSlot();
    const booked = await request(app).post(`/api/slots/${slot.id}/bookings`)
      .send({ patientName: "Alex", patientEmail: "alex@example.com" });
    assert.equal(booked.status, 201);

    const listed = await request(app).get("/api/slots");
    assert.equal(listed.status, 200);
    assert.equal(listed.body[0].isAvailable, false);

    await request(app).delete(`/api/bookings/${booked.body.id}`);
    await request(app).delete(`/api/slots/${slot.id}`);
    const afterCancellation = await request(app).get("/api/slots");
    assert.deepEqual(afterCancellation.body, []);
  });
});
