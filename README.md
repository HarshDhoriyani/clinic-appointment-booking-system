# CareSlot – Clinic Appointment Booking

A responsive React interface and Node.js API for publishing clinic appointment slots and booking them with SQLite-backed protection against double booking.

## Requirements

- Node.js 20 or newer
- npm

## Run locally

1. Install API dependencies from the project root:

   ```sh
   npm install
   ```

2. Install frontend dependencies:

   ```sh
   cd client
   npm install
   ```

3. Start the API from the project root in one terminal:

   ```sh
   npm start
   ```

   The API listens on `http://localhost:3000`. SQLite creates `data/clinic.db` automatically. Set `DATABASE_PATH` to use a different database file.

4. Start the React app from `client` in a second terminal:

   ```sh
   npm run dev
   ```

   Open the Vite URL shown in the terminal (usually `http://localhost:5173`). Vite proxies `/api` requests to the API.

## Run tests

From the project root:

```sh
npm test
```

Tests use an isolated in-memory SQLite database and cover input validation, concurrent attempts to book a single slot, cancellation and rebooking, and slot availability.

## API

All endpoints use JSON under `/api`. Invalid input returns `400` with an `error` and field-level `details`. Conflicting actions return `409`; missing resources return `404`.

### `GET /api/slots`

Lists active slots in start-time order, including their current availability.

### `POST /api/slots`

Publishes a clinic slot. Times must be ISO 8601 timestamps with an offset, and the end must follow the start.

```sh
curl -X POST http://localhost:3000/api/slots \
  -H "Content-Type: application/json" \
  -d '{"clinicName":"North Clinic","startsAt":"2030-05-20T09:00:00Z","endsAt":"2030-05-20T09:30:00Z"}'
```

Returns `201 Created` with the slot.

### `DELETE /api/slots/:slotId`

Cancels an active slot. A slot with a confirmed booking must have its booking cancelled first. Returns `204 No Content`.

### `POST /api/slots/:slotId/bookings`

Books the slot for a patient. Names are required; email must be valid.

```sh
curl -X POST http://localhost:3000/api/slots/1/bookings \
  -H "Content-Type: application/json" \
  -d '{"patientName":"Alex Morgan","patientEmail":"alex@example.com"}'
```

Returns `201 Created` with the booking, or `409 Conflict` if the slot is already booked.

### `DELETE /api/bookings/:bookingId`

Cancels an active booking and makes the slot bookable again. Returns `204 No Content`.

### `GET /api/health`

Returns `{"status":"ok"}` when the API is running.

## Booking correctness

Booking creation is performed inside a SQLite transaction, and the database has a partial unique index allowing at most one `confirmed` booking per slot. The database constraint is the final guard against simultaneous requests; the API translates that conflict into `409 Conflict`. Cancelling a booking changes its status, freeing the slot without deleting booking history.
