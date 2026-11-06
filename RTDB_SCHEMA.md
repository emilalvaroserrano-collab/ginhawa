# Ginhawa Realtime Database — Data Model and Ownership

## Implemented paths

```text
/catalog/services/<serviceId>
  { name, description, icon, price, duration, active }
/catalog/therapists/<therapistId>
  { name, specialty, location, initials, price, experience, service,
    description, verified, published } # public-facing sanitized data ONLY
/profiles/<auth.uid>
  { uid, email, displayName, requestedRole, createdAt }
/bookingDrafts/<auth.uid>/<pushId>
  { userId, serviceId, therapistId, mode, date, time, city,
    status: "draft", createdAt }
```

- Clients sign in with Firebase Authentication, which supplies `auth.uid` in RTDB rules.
- Each profile can be created once by its owner. The `requestedRole` property is NOT privileged authorization.
- Drafts can be created and deleted by their owner. They **cannot** be promoted to a confirmed booking or a payment client-side.
- Public catalog is admin-write only. Do not store private therapist credential files, PII or screening information under `/catalog`.
- An `admin: true` custom claim must be assigned server-side via Firebase Admin SDK. No client has permission to issue privileged claims.

## Proposed future paths — NOT IMPLEMENTED / DENY BY DEFAULT

```text
/therapistApplications/<uid>/...          # private credentials; never public
/therapistAvailability/<uid>/<slot>/...  # trusted availability/reservations
/bookings/<bookingId>/...                # validated and confirmed only via trusted API
/bookingParticipants/<uid>/<bookingId>   # private per-user view projection
/payments/<paymentId>/...                # gateway webhooks -> trusted function
/financeLedger/<entryId>/...            # immutable server-controlled ledger
/insuranceFundLedger/<uid>/<entryId>     # ₱50 per qualifying booking (if finalized policy)
/insuranceCycles/<uid>/<cycleId>/...     # separate insurer confirmation
/incidentReports/<caseId>/...           # compartmentalized confidential cases
/incidentEvidence/<caseId>/...          # approved private object storage refs
/auditLogs/<eventId>/...                 # append-only server-controlled events
```

These future branches are intentionally blocked by the root-default deny rule. Do not turn on client write access to financial, medical, credential or investigation records. Add trusted Firebase Functions/Admin SDK endpoints, appropriate role claims, field validation and audit trails before implementation.

**Rules deployment warning:** Publishing `database.rules.json` replaces the rules for the configured Realtime Database instance. Review/merge with any existing project rules before deployment to avoid breaking other live applications. Always test in the Firebase Emulator Suite first.


## Native mobile dispatch paths (new)

See `README_NATIVE_DISPATCH.md` for full booking, privacy and authority contract.

```text
/bookingRequests/{id}                  trusted server only: whole booking, precise address
/customerBookings/{customerUid}/{id}   customer reads, server writes request status
/providerProfiles/{therapistUid}       admin-set approval, verified services
/providerPresence/{therapistUid}       verified therapist online / GPS heartbeat
/providerInbox/{therapistUid}/{id}     private sanitized offers (no precise customer address)
/assignedBookings/{therapistUid}/{id} verified therapist can read assigned address
/providerPushTokens/{therapistUid}     private FCM tokens
/offersByBooking/{id}                  server-side offer idempotency
/bookingQuotas/{customerUid}/{date}    server-side daily limits
```

`submitBooking` and `respondToOffer` are callable Cloud Functions; the browser cannot write `/bookingRequests`, `/customerBookings`, `/assignedBookings`, or `/providerInbox` directly.