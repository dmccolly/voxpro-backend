# Events & RSVP API - Quick Reference

Quick reference guide for the Events and RSVP Management API endpoints.

## Base URL
```
https://xajo-bs7d-cagt.n7e.xano.io/api:pYeQctVX
```

## Events Management (6 endpoints)

### 1. List All Events
```
GET /events
```
**Query Params:** status, event_type, is_public, is_featured, start_date, end_date, search, tags, limit, offset, sort_by, sort_order

### 2. Create Event
```
POST /events
```
**Required:** title, start_datetime

### 3. Get Single Event
```
GET /events/{id}
```
**Query Params:** include_rsvps

### 4. Update Event
```
PATCH /events/{id}
```
**Body:** Any event fields to update

### 5. Delete Event
```
DELETE /events/{id}
```
**Query Params:** send_cancellation

### 6. Get Event Statistics
```
GET /events/{id}/stats
```
**Returns:** Overview, capacity, timeline, demographics, sources, engagement metrics

## RSVP Management (6 endpoints)

### 7. Submit RSVP
```
POST /events/{id}/rsvp
```
**Required:** attendee_name, attendee_email

### 8. Get All RSVPs for Event
```
GET /events/{id}/rsvps
```
**Query Params:** response_status, checked_in, search, limit, offset, sort_by, sort_order

### 9. Get Single RSVP
```
GET /event_rsvps/{id}
```

### 10. Update RSVP
```
PATCH /event_rsvps/{id}
```
**Body:** Any RSVP fields to update

### 11. Cancel RSVP
```
DELETE /event_rsvps/{id}
```
**Query Params:** send_notification

### 12. Check In Attendee
```
POST /event_rsvps/{id}/check-in
```
**Body:** checked_in (true), check_in_notes (optional)

## Calendar & Integration (2 endpoints)

### 13. Get Calendar Events
```
GET /events/calendar
```
**Required:** start_date, end_date
**Query Params:** timezone, status, is_public

### 14. Get Upcoming Events
```
GET /events/upcoming
```
**Query Params:** limit, days_ahead, event_type, is_featured, include_full

## Response Format

All endpoints return JSON with this structure:

**Success:**
```json
{
  "success": true,
  "event": { ... },  // or "events", "rsvp", "rsvps", etc.
  "message": "Operation successful"
}
```

**Error:**
```json
{
  "success": false,
  "error": "Error message",
  "details": { ... }  // optional
}
```

## Common Status Codes

- `200` - Success
- `400` - Bad Request (validation error)
- `404` - Not Found
- `409` - Conflict (e.g., duplicate RSVP, capacity reached)
- `500` - Server Error

## Event Status Values

- `draft` - Not yet published
- `published` - Live and accepting RSVPs
- `cancelled` - Event cancelled
- `completed` - Event has ended

## RSVP Response Status Values

- `attending` - Confirmed attendance
- `maybe` - Tentative
- `not_attending` - Declined
- `waitlist` - On waitlist (event at capacity)

## Database Tables

### events
Primary table for event information with fields: id, title, description, event_type, location, virtual_link, start_datetime, end_datetime, timezone, capacity, is_public, is_featured, status, image_url, organizer_name, organizer_email, organizer_id, tags, created_at, updated_at, created_by, metadata

### event_rsvps
RSVP tracking with fields: id, event_id, attendee_name, attendee_email, attendee_phone, attendee_id, response_status, guest_count, dietary_restrictions, special_requests, checked_in, checked_in_at, registration_source, confirmation_sent, reminder_sent, created_at, updated_at, metadata

**Unique Constraint:** (event_id, attendee_email)
**Foreign Key:** event_id → events.id (CASCADE delete)

## Key Features

✅ Full CRUD operations for events
✅ RSVP management with capacity control
✅ Automatic waitlist management
✅ Check-in functionality
✅ Event statistics and analytics
✅ Calendar integration
✅ Upcoming events feed
✅ Search and filtering
✅ Timezone support
✅ Guest count tracking
✅ Dietary restrictions and special requests
✅ Email notification hooks

## Implementation Steps

1. Create database tables in Xano
2. Set up foreign key and unique constraints
3. Create all 14 API endpoints
4. Add validation logic
5. Implement capacity management
6. Add waitlist promotion logic
7. Test all endpoints
8. (Optional) Add email notifications
9. (Optional) Add authentication

For detailed implementation instructions, see `EVENTS_RSVP_API_DOCUMENTATION.md`
