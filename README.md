# Civic Register — prototype

A front-end prototype of a civic problem-reporting platform with three roles
sharing one ledger of reported problems. No backend or signup — everything
runs from `index.html` and is saved to your browser's local storage.

## How to run

Just open `index.html` in a browser (double-click it, or drag it into a
browser window). No server or build step needed.

Because data is stored in your browser's local storage, use the **same
browser** to log in as different roles and see how a report moves between
them. Signing out does not erase data — it's still there next time you open
the app in that browser.

## Demo accounts

| Role | Username | Password |
|---|---|---|
| Resident | `citizen_raj` | `citizen123` |
| Resident | `citizen_maya` | `citizen123` |
| Department staff (Sanitation) | `staff_amara` | `staff123` |
| Department staff (Roads) | `staff_kofi` | `staff123` |
| Department staff (Water) | `staff_priya` | `staff123` |
| Administrator | `admin` | `admin123` |

The login screen also has these pre-filled — click a demo account to fill
the form.

## How the flow works

1. **Resident** submits a problem (title, category, description, optional
   photo). It lands in the administrator's triage inbox.
2. **Administrator** sets a priority and assigns it to a department staff
   member from the triage inbox.
3. **Department staff** posts progress updates (note, percent complete,
   optional photo) against their assignments, then marks the job
   **completed** with a completion photo.
4. **Resident** sees the full progress timeline with photos, and rates the
   completed work (1–5 stars) with optional feedback.
5. Rating awards **coins** to the staff member who did the work
   (rating × 10 coins).
6. **Administrator** can convert any staff member's coin balance into a
   cash payout from the Rewards & payouts screen (10 coins = 1 unit of
   currency) and sees the payout history.

## Notes on this prototype

- All data (users, reports, photos, coin balances, payout history) lives in
  `localStorage` under the key `civic_register_db_v1`. Clearing your
  browser's site data for this file resets it back to the seeded demo data.
- Photos are resized client-side before being stored, to keep local storage
  usage reasonable.
- This is a working prototype for demoing the flow end-to-end, not a
  production system — there's no real authentication, server, or database.

## Project structure

The UI is organized into a core stylesheet, a responsive experience layer, and a reusable `js/ui/list-controls.js` module for report searching, filters, empty states, and result counts. Role workflows remain in `js/app.js`.

```
civic-register/
├── index.html        Page shell + login template
├── css/styles.css     Design system and all styling
├── js/app.js          Data model, auth, and all three dashboards
└── README.md
```
