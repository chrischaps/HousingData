# Market Pulse

Market Pulse is a web app for exploring housing prices, laid out like Google Finance but for homes. Search any of 21,000+ U.S. cities, chart its Zillow Home Value Index from 2000 to now over ranges from one month to the full history, overlay up to five markets to compare them, and star the ones you follow so they sync across devices. The dataset is 85 MB as one file; splitting it into a file per market and loading only what you look at brought the first page load down to about 420 KB.

**Project page:** [chaps.dev/projects/market-pulse](https://chaps.dev/projects/market-pulse/) has a screenshot and a summary of the features and the data work.

![Market Pulse showing a home price chart](https://chaps.dev/projects/market-pulse/screenshot.png)

## Running it

The app lives in `housing-data-app/`. It needs Node.js and a Firebase project for sign-in and favorites.

```
cd housing-data-app
npm install
cp .env.example .env     # then fill in your Firebase config
npm run dev              # http://localhost:5173
npm run build            # type-check and build for production
```

The data pipeline runs from the repo root (`npm install` there first): `npm run split-csv` splits the Zillow CSV into one file per market, and `npm run upload-csv` uploads them to Cloud Storage. `scripts/README.md` walks through it.

## Where things are

- `housing-data-app/`: the React 19, TypeScript and Vite app, with Tailwind, Recharts, Firebase Auth and Firestore. Market data is cached in IndexedDB.
- `scripts/`: the CSV split and upload tools.
- `housing-data-poc/`: the original proof of concept, kept as a submodule for reference.
- `Dockerfile`, `nginx.conf`, `cloudbuild.yaml`: deployment to Google Cloud Run.

For using the app, see [USER_GUIDE.md](USER_GUIDE.md). For the architecture and setup in depth, see [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md). The other documents at the root are the plans and notes from each phase of building it.
