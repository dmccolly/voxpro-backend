# Events and RSVP Management API Documentation

This document provides comprehensive documentation for the Events and RSVP Management API endpoints in Xano. These endpoints enable full event lifecycle management, RSVP tracking, attendee check-in, and calendar integration.

## Table of Contents

1. [Database Schema](#database-schema)
2. [Events Management Endpoints](#events-management-endpoints)
3. [RSVP Management Endpoints](#rsvp-management-endpoints)
4. [Calendar & Integration Endpoints](#calendar--integration-endpoints)
5. [Implementation Guide](#implementation-guide)
6. [Error Handling](#error-handling)
7. [Usage Examples](#usage-examples)

---

## Database Schema

### Events Table

The `events` table stores all event information.

```sql
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  event_type VARCHAR(50),
  location VARCHAR(255),
  virtual_link VARCHAR(500),
  start_datetime TIMESTAMP NOT NULL,
  end_datetime TIMESTAMP,
  timezone VARCHAR(50) DEFAULT 'UTC',
  capacity INTEGER,
  is_public BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'draft',
  image_url VARCHAR(500),
  organizer_name VARCHAR(255),
  organizer_email VARCHAR(255),
  organizer_id INTEGER,
  tags TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INTEGER,
  metadata JSON
);
```

**Field Descriptions:**
- `title`: Event name (required)
- `description`: Full event description with HTML support
- `event_type`: Category (e.g., 'workshop', 'webinar', 'meetup', 'conference')
- `location`: Physical address for in-person events
- `virtual_link`: URL for virtual events (Zoom, Google Meet, etc.)
- `start_datetime`: Event start time (required)
- `end_datetime`: Event end time
- `timezone`: Timezone identifier (e.g., 'America/New_York')
- `capacity`: Maximum number of attendees (null = unlimited)
- `is_public`: Whether event appears in public listings
- `is_featured`: Featured events get priority display
- `status`: Event status ('draft', 'published', 'cancelled', 'completed')
- `image_url`: Event banner/thumbnail image
- `organizer_name`: Event organizer display name
- `organizer_email`: Organizer contact email
- `organizer_id`: Reference to user/member ID
- `tags`: Comma-separated tags for categorization
- `metadata`: Additional flexible data storage (JSON)

### Event RSVPs Table

The `event_rsvps` table tracks attendee registrations and responses.

```sql
CREATE TABLE event_rsvps (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  event_id INTEGER NOT NULL,
  attendee_name VARCHAR(255) NOT NULL,
  attendee_email VARCHAR(255) NOT NULL,
  attendee_phone VARCHAR(50),
  attendee_id INTEGER,
  response_status VARCHAR(20) DEFAULT 'attending',
  guest_count INTEGER DEFAULT 1,
  dietary_restrictions TEXT,
  special_requests TEXT,
  checked_in BOOLEAN DEFAULT false,
  checked_in_at TIMESTAMP,
  registration_source VARCHAR(50),
  confirmation_sent BOOLEAN DEFAULT false,
  reminder_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  metadata JSON,
  UNIQUE KEY unique_event_attendee (event_id, attendee_email),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);
```

**Field Descriptions:**
- `event_id`: Reference to events table (required)
- `attendee_name`: Full name of attendee (required)
- `attendee_email`: Email address (required, unique per event)
- `attendee_phone`: Contact phone number
- `attendee_id`: Reference to user/member ID if registered
- `response_status`: RSVP status ('attending', 'maybe', 'not_attending', 'waitlist')
- `guest_count`: Number of guests including attendee (default: 1)
- `dietary_restrictions`: Special dietary needs
- `special_requests`: Any special accommodations needed
- `checked_in`: Whether attendee has checked in at event
- `checked_in_at`: Timestamp of check-in
- `registration_source`: Where RSVP came from (e.g., 'website', 'email', 'social')
- `confirmation_sent`: Whether confirmation email was sent
- `reminder_sent`: Whether reminder email was sent
- `metadata`: Additional flexible data storage (JSON)

### Indexes

```sql
CREATE INDEX idx_events_start_datetime ON events(start_datetime);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_is_public ON events(is_public);
CREATE INDEX idx_events_is_featured ON events(is_featured);
CREATE INDEX idx_event_rsvps_event_id ON event_rsvps(event_id);
CREATE INDEX idx_event_rsvps_attendee_email ON event_rsvps(attendee_email);
CREATE INDEX idx_event_rsvps_response_status ON event_rsvps(response_status);
CREATE INDEX idx_event_rsvps_checked_in ON event_rsvps(checked_in);
```

---

## Events Management Endpoints

### 1. GET /events - List All Events

Retrieve a list of events with optional filtering and pagination.

**Endpoint:** `GET /events`

**Query Parameters:**
- `status` (string, optional): Filter by status ('draft', 'published', 'cancelled', 'completed')
- `event_type` (string, optional): Filter by event type
- `is_public` (boolean, optional): Filter by public visibility
- `is_featured` (boolean, optional): Filter featured events
- `start_date` (string, optional): Filter events starting after this date (ISO 8601)
- `end_date` (string, optional): Filter events starting before this date (ISO 8601)
- `search` (string, optional): Search in title and description
- `tags` (string, optional): Comma-separated tags to filter by
- `limit` (integer, optional): Number of results per page (default: 20, max: 100)
- `offset` (integer, optional): Number of results to skip (default: 0)
- `sort_by` (string, optional): Sort field ('start_datetime', 'created_at', 'title') (default: 'start_datetime')
- `sort_order` (string, optional): Sort direction ('asc', 'desc') (default: 'asc')

**Response:**
```json
{
  "success": true,
  "events": [
    {
      "id": 1,
      "title": "Web Development Workshop",
      "description": "<p>Learn modern web development techniques...</p>",
      "event_type": "workshop",
      "location": "123 Main St, San Francisco, CA",
      "virtual_link": null,
      "start_datetime": "2025-11-15T14:00:00Z",
      "end_datetime": "2025-11-15T17:00:00Z",
      "timezone": "America/Los_Angeles",
      "capacity": 50,
      "is_public": true,
      "is_featured": true,
      "status": "published",
      "image_url": "https://example.com/images/workshop.jpg",
      "organizer_name": "Tech Community",
      "organizer_email": "events@techcommunity.com",
      "organizer_id": 42,
      "tags": "web,development,workshop",
      "created_at": "2025-10-01T10:00:00Z",
      "updated_at": "2025-10-15T12:30:00Z",
      "created_by": 42,
      "metadata": {},
      "rsvp_count": 35,
      "attending_count": 32,
      "waitlist_count": 3,
      "spots_remaining": 15
    }
  ],
  "total": 1,
  "pagination": {
    "limit": 20,
    "offset": 0,
    "has_more": false
  }
}
```

**Xano Implementation:**
1. Create GET endpoint `/events`
2. Add query parameters as function inputs
3. Query `events` table with filters
4. Add subquery to count RSVPs: `SELECT COUNT(*) FROM event_rsvps WHERE event_id = events.id`
5. Calculate `spots_remaining` as `capacity - attending_count` (null if capacity is null)
6. Return paginated results with metadata

---

### 2. POST /events - Create Event

Create a new event.

**Endpoint:** `POST /events`

**Request Body:**
```json
{
  "title": "Web Development Workshop",
  "description": "<p>Learn modern web development techniques...</p>",
  "event_type": "workshop",
  "location": "123 Main St, San Francisco, CA",
  "virtual_link": null,
  "start_datetime": "2025-11-15T14:00:00Z",
  "end_datetime": "2025-11-15T17:00:00Z",
  "timezone": "America/Los_Angeles",
  "capacity": 50,
  "is_public": true,
  "is_featured": false,
  "status": "draft",
  "image_url": "https://example.com/images/workshop.jpg",
  "organizer_name": "Tech Community",
  "organizer_email": "events@techcommunity.com",
  "organizer_id": 42,
  "tags": "web,development,workshop",
  "metadata": {}
}
```

**Required Fields:**
- `title` (string)
- `start_datetime` (string, ISO 8601)

**Response:**
```json
{
  "success": true,
  "event": {
    "id": 1,
    "title": "Web Development Workshop",
    "description": "<p>Learn modern web development techniques...</p>",
    "event_type": "workshop",
    "location": "123 Main St, San Francisco, CA",
    "virtual_link": null,
    "start_datetime": "2025-11-15T14:00:00Z",
    "end_datetime": "2025-11-15T17:00:00Z",
    "timezone": "America/Los_Angeles",
    "capacity": 50,
    "is_public": true,
    "is_featured": false,
    "status": "draft",
    "image_url": "https://example.com/images/workshop.jpg",
    "organizer_name": "Tech Community",
    "organizer_email": "events@techcommunity.com",
    "organizer_id": 42,
    "tags": "web,development,workshop",
    "created_at": "2025-10-23T10:00:00Z",
    "updated_at": "2025-10-23T10:00:00Z",
    "created_by": 42,
    "metadata": {}
  },
  "message": "Event created successfully"
}
```

**Xano Implementation:**
1. Create POST endpoint `/events`
2. Add validation for required fields (title, start_datetime)
3. Validate start_datetime is in the future
4. Validate end_datetime is after start_datetime (if provided)
5. Insert into `events` table
6. Return created event with success message

---

### 3. GET /events/{id} - Get Single Event

Retrieve detailed information about a specific event.

**Endpoint:** `GET /events/{id}`

**Path Parameters:**
- `id` (integer, required): Event ID

**Query Parameters:**
- `include_rsvps` (boolean, optional): Include RSVP list (default: false)

**Response:**
```json
{
  "success": true,
  "event": {
    "id": 1,
    "title": "Web Development Workshop",
    "description": "<p>Learn modern web development techniques...</p>",
    "event_type": "workshop",
    "location": "123 Main St, San Francisco, CA",
    "virtual_link": null,
    "start_datetime": "2025-11-15T14:00:00Z",
    "end_datetime": "2025-11-15T17:00:00Z",
    "timezone": "America/Los_Angeles",
    "capacity": 50,
    "is_public": true,
    "is_featured": true,
    "status": "published",
    "image_url": "https://example.com/images/workshop.jpg",
    "organizer_name": "Tech Community",
    "organizer_email": "events@techcommunity.com",
    "organizer_id": 42,
    "tags": "web,development,workshop",
    "created_at": "2025-10-01T10:00:00Z",
    "updated_at": "2025-10-15T12:30:00Z",
    "created_by": 42,
    "metadata": {},
    "rsvp_count": 35,
    "attending_count": 32,
    "maybe_count": 3,
    "not_attending_count": 5,
    "waitlist_count": 0,
    "checked_in_count": 0,
    "spots_remaining": 15
  }
}
```

**Xano Implementation:**
1. Create GET endpoint `/events/:id`
2. Query `events` table by ID
3. Add subqueries for RSVP statistics:
   - Total RSVPs
   - Count by response_status
   - Checked-in count
4. Calculate spots_remaining
5. Return 404 if event not found

---

### 4. PATCH /events/{id} - Update Event

Update an existing event.

**Endpoint:** `PATCH /events/{id}`

**Path Parameters:**
- `id` (integer, required): Event ID

**Request Body:** (all fields optional)
```json
{
  "title": "Updated Workshop Title",
  "description": "<p>Updated description...</p>",
  "status": "published",
  "is_featured": true,
  "capacity": 60
}
```

**Response:**
```json
{
  "success": true,
  "event": {
    "id": 1,
    "title": "Updated Workshop Title",
    "description": "<p>Updated description...</p>",
    "event_type": "workshop",
    "location": "123 Main St, San Francisco, CA",
    "virtual_link": null,
    "start_datetime": "2025-11-15T14:00:00Z",
    "end_datetime": "2025-11-15T17:00:00Z",
    "timezone": "America/Los_Angeles",
    "capacity": 60,
    "is_public": true,
    "is_featured": true,
    "status": "published",
    "image_url": "https://example.com/images/workshop.jpg",
    "organizer_name": "Tech Community",
    "organizer_email": "events@techcommunity.com",
    "organizer_id": 42,
    "tags": "web,development,workshop",
    "created_at": "2025-10-01T10:00:00Z",
    "updated_at": "2025-10-23T11:00:00Z",
    "created_by": 42,
    "metadata": {}
  },
  "message": "Event updated successfully"
}
```

**Xano Implementation:**
1. Create PATCH endpoint `/events/:id`
2. Query event by ID to verify it exists
3. Update only provided fields
4. Validate constraints (dates, capacity vs current RSVPs)
5. Update `updated_at` timestamp
6. Return updated event

---

### 5. DELETE /events/{id} - Delete Event

Delete an event and all associated RSVPs.

**Endpoint:** `DELETE /events/{id}`

**Path Parameters:**
- `id` (integer, required): Event ID

**Query Parameters:**
- `send_cancellation` (boolean, optional): Send cancellation emails to attendees (default: false)

**Response:**
```json
{
  "success": true,
  "message": "Event deleted successfully",
  "rsvps_deleted": 35
}
```

**Xano Implementation:**
1. Create DELETE endpoint `/events/:id`
2. Query event by ID to verify it exists
3. If `send_cancellation` is true, trigger email notifications
4. Delete from `events` table (CASCADE will delete RSVPs)
5. Return success with count of deleted RSVPs

---

### 6. GET /events/{id}/stats - Get Event Statistics

Retrieve detailed statistics and analytics for an event.

**Endpoint:** `GET /events/{id}/stats`

**Path Parameters:**
- `id` (integer, required): Event ID

**Response:**
```json
{
  "success": true,
  "event_id": 1,
  "statistics": {
    "overview": {
      "total_rsvps": 40,
      "attending": 32,
      "maybe": 3,
      "not_attending": 5,
      "waitlist": 0,
      "checked_in": 28,
      "no_show": 4
    },
    "capacity": {
      "total_capacity": 50,
      "spots_taken": 32,
      "spots_remaining": 18,
      "utilization_rate": 64.0
    },
    "timeline": {
      "first_rsvp": "2025-10-02T08:15:00Z",
      "last_rsvp": "2025-11-14T23:45:00Z",
      "rsvps_last_24h": 5,
      "rsvps_last_7d": 12
    },
    "demographics": {
      "total_guests": 45,
      "average_guest_count": 1.4,
      "dietary_restrictions_count": 8,
      "special_requests_count": 3
    },
    "sources": {
      "website": 25,
      "email": 10,
      "social": 5
    },
    "engagement": {
      "confirmation_sent": 40,
      "reminder_sent": 35,
      "check_in_rate": 87.5
    }
  }
}
```

**Xano Implementation:**
1. Create GET endpoint `/events/:id/stats`
2. Query event to verify it exists
3. Aggregate statistics from `event_rsvps` table:
   - Count by response_status
   - Count checked_in
   - Calculate rates and percentages
   - Group by registration_source
   - Time-based aggregations
4. Return comprehensive statistics object

---

## RSVP Management Endpoints

### 7. POST /events/{id}/rsvp - Submit RSVP

Submit or update an RSVP for an event.

**Endpoint:** `POST /events/{id}/rsvp`

**Path Parameters:**
- `id` (integer, required): Event ID

**Request Body:**
```json
{
  "attendee_name": "John Doe",
  "attendee_email": "john@example.com",
  "attendee_phone": "+1-555-0123",
  "attendee_id": 123,
  "response_status": "attending",
  "guest_count": 2,
  "dietary_restrictions": "Vegetarian",
  "special_requests": "Wheelchair accessible seating",
  "registration_source": "website",
  "metadata": {
    "company": "Tech Corp",
    "role": "Developer"
  }
}
```

**Required Fields:**
- `attendee_name` (string)
- `attendee_email` (string)

**Response:**
```json
{
  "success": true,
  "rsvp": {
    "id": 1,
    "event_id": 1,
    "attendee_name": "John Doe",
    "attendee_email": "john@example.com",
    "attendee_phone": "+1-555-0123",
    "attendee_id": 123,
    "response_status": "attending",
    "guest_count": 2,
    "dietary_restrictions": "Vegetarian",
    "special_requests": "Wheelchair accessible seating",
    "checked_in": false,
    "checked_in_at": null,
    "registration_source": "website",
    "confirmation_sent": true,
    "reminder_sent": false,
    "created_at": "2025-10-23T10:00:00Z",
    "updated_at": "2025-10-23T10:00:00Z",
    "metadata": {
      "company": "Tech Corp",
      "role": "Developer"
    }
  },
  "message": "RSVP submitted successfully",
  "is_waitlist": false
}
```

**Xano Implementation:**
1. Create POST endpoint `/events/:id/rsvp`
2. Validate event exists and is published
3. Check if attendee already has RSVP (by email)
4. If exists, update existing RSVP
5. If new, check capacity:
   - If spots available, create RSVP with status 'attending'
   - If full, create with status 'waitlist'
6. Send confirmation email (set confirmation_sent = true)
7. Return RSVP with waitlist indicator

---

### 8. GET /events/{id}/rsvps - Get All RSVPs

Retrieve all RSVPs for an event.

**Endpoint:** `GET /events/{id}/rsvps`

**Path Parameters:**
- `id` (integer, required): Event ID

**Query Parameters:**
- `response_status` (string, optional): Filter by status ('attending', 'maybe', 'not_attending', 'waitlist')
- `checked_in` (boolean, optional): Filter by check-in status
- `search` (string, optional): Search in attendee name or email
- `limit` (integer, optional): Number of results per page (default: 50, max: 200)
- `offset` (integer, optional): Number of results to skip (default: 0)
- `sort_by` (string, optional): Sort field ('created_at', 'attendee_name') (default: 'created_at')
- `sort_order` (string, optional): Sort direction ('asc', 'desc') (default: 'asc')

**Response:**
```json
{
  "success": true,
  "event_id": 1,
  "rsvps": [
    {
      "id": 1,
      "event_id": 1,
      "attendee_name": "John Doe",
      "attendee_email": "john@example.com",
      "attendee_phone": "+1-555-0123",
      "attendee_id": 123,
      "response_status": "attending",
      "guest_count": 2,
      "dietary_restrictions": "Vegetarian",
      "special_requests": "Wheelchair accessible seating",
      "checked_in": false,
      "checked_in_at": null,
      "registration_source": "website",
      "confirmation_sent": true,
      "reminder_sent": false,
      "created_at": "2025-10-23T10:00:00Z",
      "updated_at": "2025-10-23T10:00:00Z",
      "metadata": {
        "company": "Tech Corp",
        "role": "Developer"
      }
    }
  ],
  "total": 1,
  "pagination": {
    "limit": 50,
    "offset": 0,
    "has_more": false
  }
}
```

**Xano Implementation:**
1. Create GET endpoint `/events/:id/rsvps`
2. Validate event exists
3. Query `event_rsvps` table with filters
4. Apply pagination and sorting
5. Return paginated results

---

### 9. GET /event_rsvps/{id} - Get Single RSVP

Retrieve details of a specific RSVP.

**Endpoint:** `GET /event_rsvps/{id}`

**Path Parameters:**
- `id` (integer, required): RSVP ID

**Response:**
```json
{
  "success": true,
  "rsvp": {
    "id": 1,
    "event_id": 1,
    "event_title": "Web Development Workshop",
    "event_start_datetime": "2025-11-15T14:00:00Z",
    "attendee_name": "John Doe",
    "attendee_email": "john@example.com",
    "attendee_phone": "+1-555-0123",
    "attendee_id": 123,
    "response_status": "attending",
    "guest_count": 2,
    "dietary_restrictions": "Vegetarian",
    "special_requests": "Wheelchair accessible seating",
    "checked_in": false,
    "checked_in_at": null,
    "registration_source": "website",
    "confirmation_sent": true,
    "reminder_sent": false,
    "created_at": "2025-10-23T10:00:00Z",
    "updated_at": "2025-10-23T10:00:00Z",
    "metadata": {
      "company": "Tech Corp",
      "role": "Developer"
    }
  }
}
```

**Xano Implementation:**
1. Create GET endpoint `/event_rsvps/:id`
2. Query `event_rsvps` table by ID
3. Join with `events` table to include event details
4. Return 404 if RSVP not found

---

### 10. PATCH /event_rsvps/{id} - Update RSVP

Update an existing RSVP.

**Endpoint:** `PATCH /event_rsvps/{id}`

**Path Parameters:**
- `id` (integer, required): RSVP ID

**Request Body:** (all fields optional)
```json
{
  "response_status": "maybe",
  "guest_count": 1,
  "dietary_restrictions": "Vegan",
  "special_requests": ""
}
```

**Response:**
```json
{
  "success": true,
  "rsvp": {
    "id": 1,
    "event_id": 1,
    "attendee_name": "John Doe",
    "attendee_email": "john@example.com",
    "attendee_phone": "+1-555-0123",
    "attendee_id": 123,
    "response_status": "maybe",
    "guest_count": 1,
    "dietary_restrictions": "Vegan",
    "special_requests": "",
    "checked_in": false,
    "checked_in_at": null,
    "registration_source": "website",
    "confirmation_sent": true,
    "reminder_sent": false,
    "created_at": "2025-10-23T10:00:00Z",
    "updated_at": "2025-10-23T11:30:00Z",
    "metadata": {
      "company": "Tech Corp",
      "role": "Developer"
    }
  },
  "message": "RSVP updated successfully"
}
```

**Xano Implementation:**
1. Create PATCH endpoint `/event_rsvps/:id`
2. Query RSVP by ID to verify it exists
3. Update only provided fields
4. If changing response_status, check capacity constraints
5. Update `updated_at` timestamp
6. Return updated RSVP

---

### 11. DELETE /event_rsvps/{id} - Cancel RSVP

Cancel an RSVP and remove it from the event.

**Endpoint:** `DELETE /event_rsvps/{id}`

**Path Parameters:**
- `id` (integer, required): RSVP ID

**Query Parameters:**
- `send_notification` (boolean, optional): Send cancellation confirmation email (default: false)

**Response:**
```json
{
  "success": true,
  "message": "RSVP cancelled successfully",
  "event_id": 1,
  "spots_freed": 2
}
```

**Xano Implementation:**
1. Create DELETE endpoint `/event_rsvps/:id`
2. Query RSVP by ID to verify it exists
3. Get guest_count before deletion
4. If `send_notification` is true, send cancellation email
5. Delete from `event_rsvps` table
6. Check if waitlist exists and promote next attendee
7. Return success with spots freed

---

### 12. POST /event_rsvps/{id}/check-in - Check In Attendee

Mark an attendee as checked in at the event.

**Endpoint:** `POST /event_rsvps/{id}/check-in`

**Path Parameters:**
- `id` (integer, required): RSVP ID

**Request Body:**
```json
{
  "checked_in": true,
  "check_in_notes": "Arrived on time"
}
```

**Response:**
```json
{
  "success": true,
  "rsvp": {
    "id": 1,
    "event_id": 1,
    "attendee_name": "John Doe",
    "attendee_email": "john@example.com",
    "response_status": "attending",
    "guest_count": 2,
    "checked_in": true,
    "checked_in_at": "2025-11-15T14:05:00Z",
    "metadata": {
      "company": "Tech Corp",
      "role": "Developer",
      "check_in_notes": "Arrived on time"
    }
  },
  "message": "Attendee checked in successfully"
}
```

**Xano Implementation:**
1. Create POST endpoint `/event_rsvps/:id/check-in`
2. Query RSVP by ID to verify it exists
3. Validate event is today or in progress
4. Update `checked_in` field to true
5. Set `checked_in_at` to current timestamp
6. Store check_in_notes in metadata if provided
7. Return updated RSVP

---

## Calendar & Integration Endpoints

### 13. GET /events/calendar - Get Events for Calendar

Retrieve events formatted for calendar display.

**Endpoint:** `GET /events/calendar`

**Query Parameters:**
- `start_date` (string, required): Start of date range (ISO 8601)
- `end_date` (string, required): End of date range (ISO 8601)
- `timezone` (string, optional): Timezone for date conversion (default: 'UTC')
- `status` (string, optional): Filter by status (default: 'published')
- `is_public` (boolean, optional): Filter by public visibility (default: true)

**Response:**
```json
{
  "success": true,
  "events": [
    {
      "id": 1,
      "title": "Web Development Workshop",
      "start": "2025-11-15T14:00:00Z",
      "end": "2025-11-15T17:00:00Z",
      "allDay": false,
      "url": "/events/1",
      "color": "#3788d8",
      "extendedProps": {
        "event_type": "workshop",
        "location": "123 Main St, San Francisco, CA",
        "virtual_link": null,
        "capacity": 50,
        "rsvp_count": 35,
        "spots_remaining": 15,
        "is_featured": true,
        "organizer_name": "Tech Community",
        "image_url": "https://example.com/images/workshop.jpg"
      }
    }
  ],
  "total": 1
}
```

**Xano Implementation:**
1. Create GET endpoint `/events/calendar`
2. Validate date range (max 1 year)
3. Query `events` table with date range filter
4. Format response for FullCalendar or similar libraries
5. Include RSVP counts and availability
6. Return calendar-formatted events

---

### 14. GET /events/upcoming - Get Upcoming Events

Retrieve upcoming events with optional filtering.

**Endpoint:** `GET /events/upcoming`

**Query Parameters:**
- `limit` (integer, optional): Number of events to return (default: 10, max: 50)
- `days_ahead` (integer, optional): Number of days to look ahead (default: 30)
- `event_type` (string, optional): Filter by event type
- `is_featured` (boolean, optional): Filter featured events
- `include_full` (boolean, optional): Include events at capacity (default: true)

**Response:**
```json
{
  "success": true,
  "events": [
    {
      "id": 1,
      "title": "Web Development Workshop",
      "description": "<p>Learn modern web development techniques...</p>",
      "event_type": "workshop",
      "location": "123 Main St, San Francisco, CA",
      "virtual_link": null,
      "start_datetime": "2025-11-15T14:00:00Z",
      "end_datetime": "2025-11-15T17:00:00Z",
      "timezone": "America/Los_Angeles",
      "capacity": 50,
      "is_public": true,
      "is_featured": true,
      "status": "published",
      "image_url": "https://example.com/images/workshop.jpg",
      "organizer_name": "Tech Community",
      "tags": "web,development,workshop",
      "rsvp_count": 35,
      "spots_remaining": 15,
      "is_full": false,
      "days_until": 23
    }
  ],
  "total": 1
}
```

**Xano Implementation:**
1. Create GET endpoint `/events/upcoming`
2. Calculate date range (now to now + days_ahead)
3. Query `events` table with filters:
   - start_datetime >= NOW()
   - start_datetime <= NOW() + days_ahead
   - status = 'published'
   - is_public = true
4. Add RSVP counts and availability calculations
5. Calculate days_until for each event
6. Sort by start_datetime ascending
7. Apply limit
8. Return upcoming events

---

## Implementation Guide

### Step 1: Create Database Tables in Xano

1. Navigate to your Xano workspace
2. Go to Database section
3. Create `events` table with all fields as specified in schema
4. Create `event_rsvps` table with all fields as specified in schema
5. Set up foreign key relationship: `event_rsvps.event_id` → `events.id` with CASCADE delete
6. Add unique constraint on `event_rsvps(event_id, attendee_email)`
7. Create all indexes as specified

### Step 2: Create API Endpoints

For each endpoint:

1. Go to API section in Xano
2. Create new endpoint with specified method and path
3. Add input parameters (path params, query params, body)
4. Add validation logic for required fields
5. Add database queries
6. Add response formatting
7. Test endpoint with sample data

### Step 3: Add Business Logic

**Capacity Management:**
```
When creating RSVP:
1. Get event capacity
2. Count current attending RSVPs
3. If attending_count >= capacity:
   - Set response_status to 'waitlist'
   - Return is_waitlist: true
4. Else:
   - Set response_status to 'attending'
   - Return is_waitlist: false
```

**Waitlist Promotion:**
```
When RSVP is cancelled:
1. Get guest_count from cancelled RSVP
2. Query waitlist RSVPs ordered by created_at
3. Promote next N attendees (where N = guest_count)
4. Update their response_status to 'attending'
5. Send promotion notification emails
```

**Event Statistics:**
```
For /events/{id}/stats:
1. Count RSVPs by response_status
2. Calculate percentages
3. Count checked_in attendees
4. Calculate check-in rate
5. Group by registration_source
6. Calculate time-based metrics
```

### Step 4: Add Email Notifications (Optional)

Create email templates for:
- RSVP confirmation
- RSVP update confirmation
- Event reminder (24 hours before)
- Waitlist promotion
- Event cancellation
- Check-in confirmation

Integrate with SendGrid or similar service using Xano's external API calls.

### Step 5: Set Up Authentication (Optional)

Add authentication to endpoints that require it:
- POST /events (organizers only)
- PATCH /events/{id} (organizers only)
- DELETE /events/{id} (organizers only)
- GET /events/{id}/stats (organizers only)
- GET /events/{id}/rsvps (organizers only)

Public endpoints (no auth required):
- GET /events
- GET /events/{id}
- POST /events/{id}/rsvp
- GET /events/calendar
- GET /events/upcoming

### Step 6: Test All Endpoints

Use Xano's built-in API testing or tools like Postman to test:
1. Create event
2. List events with various filters
3. Get single event
4. Update event
5. Submit RSVP
6. List RSVPs
7. Update RSVP
8. Check in attendee
9. Get event statistics
10. Cancel RSVP
11. Delete event
12. Get calendar events
13. Get upcoming events

---

## Error Handling

All endpoints should return consistent error responses:

### Validation Error (400)
```json
{
  "success": false,
  "error": "Validation failed",
  "details": {
    "title": "Title is required",
    "start_datetime": "Start date must be in the future"
  }
}
```

### Not Found (404)
```json
{
  "success": false,
  "error": "Event not found",
  "event_id": 999
}
```

### Conflict (409)
```json
{
  "success": false,
  "error": "RSVP already exists for this email",
  "existing_rsvp_id": 123
}
```

### Capacity Error (409)
```json
{
  "success": false,
  "error": "Event is at capacity",
  "message": "This event is full. You have been added to the waitlist.",
  "is_waitlist": true,
  "rsvp_id": 124
}
```

### Server Error (500)
```json
{
  "success": false,
  "error": "Internal server error",
  "message": "An unexpected error occurred. Please try again later."
}
```

---

## Usage Examples

### JavaScript/React Service

```javascript
// eventsService.js
const XANO_BASE_URL = process.env.REACT_APP_XANO_BASE_URL || 'https://xajo-bs7d-cagt.n7e.xano.io/api:pYeQctVX';

/**
 * Get all events with optional filters
 */
export const getEvents = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    
    if (filters.status) params.append('status', filters.status);
    if (filters.event_type) params.append('event_type', filters.event_type);
    if (filters.is_public !== undefined) params.append('is_public', filters.is_public);
    if (filters.is_featured !== undefined) params.append('is_featured', filters.is_featured);
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    if (filters.search) params.append('search', filters.search);
    if (filters.tags) params.append('tags', filters.tags);
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.offset) params.append('offset', filters.offset);
    if (filters.sort_by) params.append('sort_by', filters.sort_by);
    if (filters.sort_order) params.append('sort_order', filters.sort_order);
    
    const url = `${XANO_BASE_URL}/events${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch events: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Get events error:', error);
    return { 
      success: false, 
      error: error.message, 
      events: [],
      total: 0
    };
  }
};

/**
 * Create a new event
 */
export const createEvent = async (eventData) => {
  try {
    const response = await fetch(`${XANO_BASE_URL}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventData),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create event: ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Create event error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get single event by ID
 */
export const getEvent = async (eventId, includeRsvps = false) => {
  try {
    const url = `${XANO_BASE_URL}/events/${eventId}${includeRsvps ? '?include_rsvps=true' : ''}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch event: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Get event error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update an event
 */
export const updateEvent = async (eventId, eventData) => {
  try {
    const response = await fetch(`${XANO_BASE_URL}/events/${eventId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventData),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update event: ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Update event error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete an event
 */
export const deleteEvent = async (eventId, sendCancellation = false) => {
  try {
    const url = `${XANO_BASE_URL}/events/${eventId}${sendCancellation ? '?send_cancellation=true' : ''}`;
    const response = await fetch(url, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to delete event: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Delete event error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get event statistics
 */
export const getEventStats = async (eventId) => {
  try {
    const response = await fetch(`${XANO_BASE_URL}/events/${eventId}/stats`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch event stats: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Get event stats error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Submit RSVP for an event
 */
export const submitRsvp = async (eventId, rsvpData) => {
  try {
    const response = await fetch(`${XANO_BASE_URL}/events/${eventId}/rsvp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(rsvpData),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to submit RSVP: ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Submit RSVP error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all RSVPs for an event
 */
export const getEventRsvps = async (eventId, filters = {}) => {
  try {
    const params = new URLSearchParams();
    
    if (filters.response_status) params.append('response_status', filters.response_status);
    if (filters.checked_in !== undefined) params.append('checked_in', filters.checked_in);
    if (filters.search) params.append('search', filters.search);
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.offset) params.append('offset', filters.offset);
    if (filters.sort_by) params.append('sort_by', filters.sort_by);
    if (filters.sort_order) params.append('sort_order', filters.sort_order);
    
    const url = `${XANO_BASE_URL}/events/${eventId}/rsvps${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch RSVPs: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Get event RSVPs error:', error);
    return { success: false, error: error.message, rsvps: [] };
  }
};

/**
 * Get single RSVP by ID
 */
export const getRsvp = async (rsvpId) => {
  try {
    const response = await fetch(`${XANO_BASE_URL}/event_rsvps/${rsvpId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch RSVP: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Get RSVP error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update an RSVP
 */
export const updateRsvp = async (rsvpId, rsvpData) => {
  try {
    const response = await fetch(`${XANO_BASE_URL}/event_rsvps/${rsvpId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(rsvpData),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update RSVP: ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Update RSVP error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Cancel an RSVP
 */
export const cancelRsvp = async (rsvpId, sendNotification = false) => {
  try {
    const url = `${XANO_BASE_URL}/event_rsvps/${rsvpId}${sendNotification ? '?send_notification=true' : ''}`;
    const response = await fetch(url, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to cancel RSVP: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Cancel RSVP error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Check in attendee
 */
export const checkInAttendee = async (rsvpId, checkInData = {}) => {
  try {
    const response = await fetch(`${XANO_BASE_URL}/event_rsvps/${rsvpId}/check-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        checked_in: true,
        ...checkInData
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to check in attendee: ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Check in attendee error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get events for calendar display
 */
export const getCalendarEvents = async (startDate, endDate, timezone = 'UTC') => {
  try {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
      timezone: timezone
    });
    
    const response = await fetch(`${XANO_BASE_URL}/events/calendar?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch calendar events: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Get calendar events error:', error);
    return { success: false, error: error.message, events: [] };
  }
};

/**
 * Get upcoming events
 */
export const getUpcomingEvents = async (limit = 10, daysAhead = 30, filters = {}) => {
  try {
    const params = new URLSearchParams({
      limit: limit.toString(),
      days_ahead: daysAhead.toString()
    });
    
    if (filters.event_type) params.append('event_type', filters.event_type);
    if (filters.is_featured !== undefined) params.append('is_featured', filters.is_featured);
    if (filters.include_full !== undefined) params.append('include_full', filters.include_full);
    
    const response = await fetch(`${XANO_BASE_URL}/events/upcoming?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch upcoming events: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Get upcoming events error:', error);
    return { success: false, error: error.message, events: [] };
  }
};
```

### Example React Component

```javascript
import React, { useState, useEffect } from 'react';
import { getUpcomingEvents, submitRsvp } from './services/eventsService';

function UpcomingEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    setLoading(true);
    const result = await getUpcomingEvents(10, 30);
    if (result.success) {
      setEvents(result.events);
    }
    setLoading(false);
  };

  const handleRsvp = async (eventId) => {
    const rsvpData = {
      attendee_name: 'John Doe',
      attendee_email: 'john@example.com',
      response_status: 'attending',
      guest_count: 1
    };

    const result = await submitRsvp(eventId, rsvpData);
    if (result.success) {
      alert('RSVP submitted successfully!');
      loadEvents(); // Reload to update counts
    } else {
      alert(`Error: ${result.error}`);
    }
  };

  if (loading) return <div>Loading events...</div>;

  return (
    <div className="upcoming-events">
      <h2>Upcoming Events</h2>
      {events.map(event => (
        <div key={event.id} className="event-card">
          <h3>{event.title}</h3>
          <p>{new Date(event.start_datetime).toLocaleDateString()}</p>
          <p>{event.location || event.virtual_link}</p>
          <p>
            {event.spots_remaining > 0 
              ? `${event.spots_remaining} spots remaining`
              : 'Event is full'}
          </p>
          <button 
            onClick={() => handleRsvp(event.id)}
            disabled={event.is_full}
          >
            RSVP Now
          </button>
        </div>
      ))}
    </div>
  );
}

export default UpcomingEvents;
```

---

## Summary

This API provides a complete solution for event management with the following capabilities:

**Events Management:**
- Create, read, update, and delete events
- Rich event metadata (location, virtual links, capacity, etc.)
- Event status management (draft, published, cancelled, completed)
- Featured events and categorization
- Comprehensive event statistics

**RSVP Management:**
- Submit and manage RSVPs
- Automatic capacity management and waitlist
- Guest count tracking
- Dietary restrictions and special requests
- Check-in functionality
- RSVP status tracking (attending, maybe, not attending)

**Calendar Integration:**
- Calendar-formatted event data
- Upcoming events feed
- Date range queries
- Timezone support

**Analytics:**
- Event statistics and metrics
- RSVP tracking and reporting
- Check-in rates
- Registration source tracking
- Engagement metrics

All endpoints follow RESTful conventions and return consistent JSON responses with proper error handling.
