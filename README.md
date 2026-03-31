# GoHighLevel Booking (Next.js)

This project is a Next.js booking flow integrated with GoHighLevel.

## Required Environment Variables

Each deployment must define its own values:

- `GOHIGHLEVEL_API_KEY`
- `GOHIGHLEVEL_CALENDAR_ID`
- `GOHIGHLEVEL_LOCATION_ID`

The server owns runtime calendar/location selection. Client requests do not choose production calendar IDs.

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` with the required variables:

```env
GOHIGHLEVEL_API_KEY=your_api_key
GOHIGHLEVEL_CALENDAR_ID=your_calendar_id
GOHIGHLEVEL_LOCATION_ID=your_location_id
```

3. Start development server:

```bash
npm run dev
```

## Verification

```bash
npm run test
npm run lint
npm run build
```

## Deployment Notes

- Configure environment variables per deployed project/environment (Preview/Production).
- Do not hardcode calendar IDs or location IDs in source files.
