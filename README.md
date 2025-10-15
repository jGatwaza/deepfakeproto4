# AI Image Generation Detector (Flask + React/Vite)

Dashboard-style prototype to analyze images for possible AI generation using metadata (EXIF/ICC) and simple image heuristics (blockiness, noise, histogram entropy).

Tech stack:
- Flask (Python 3.11) on Vercel Serverless Functions
- vercel-wsgi (compat handler, optional)
- Pillow, piexif, numpy, scikit-image
- React + Vite + TypeScript + Fluent UI

## Project Structure

```
root/
  api/
    index.py          # Flask app with /analyze and /analyze-url
  frontend/
    src/              # React app (dashboard UI)
    index.html
    package.json
    vite.config.ts
  requirements.txt
  vercel.json
```

## Endpoints

- POST `/api/analyze` (multipart): form-data field `file`
- POST `/api/analyze-url` (json): `{ "url": "https://..." }`

Response:
```json
{
  "score": 0.68,
  "label": "Possibly AI-generated",
  "reasons": ["Suspicious metadata", "low compression noise"],
  "metadata": {"...": "..."},
  "metrics": {"blockiness": 0.1, "noise_estimate": 0.3, "hist_entropy": 0.4}
}
```

## Local Development

Backend:
1. Use Python 3.11. Create venv and install deps:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```
2. Run Flask server:
   ```bash
   python3 api/index.py
   # Serves at http://127.0.0.1:5000
   ```

Frontend:
1. Install Node deps:
   ```bash
   cd frontend
   npm install
   ```
2. Start Vite dev server (proxy to Flask):
   ```bash
   npm run dev
   # http://localhost:5173
   # API calls to /api/* are proxied to http://127.0.0.1:5000
   ```

Build frontend locally:
```bash
cd frontend
npm run build
```
Assets output to `frontend/dist/`.

## Deployment on Vercel

This repo is configured as a single Vercel project:
- Static frontend build via `@vercel/static-build` from `frontend/` to `frontend/dist/`.
- Python Serverless Function at `api/index.py` (runtime python3.11).

Steps:
1. Push to a Git repo (GitHub/GitLab/Bitbucket).
2. Import the repo into Vercel.
3. Vercel reads `vercel.json` and builds:
   - Install Node deps in `frontend/` and run `npm run build`.
   - Install Python deps from `requirements.txt` for `api/`.
4. After deploy, your app is available at your Vercel domain. API endpoints under `/api/*`.

## Notes

- Heuristics are indicative, not definitive. Images can be edited/optimized.
- Some hosts block image fetching for `/api/analyze-url`.
- Large images are resized before computing metrics for performance.

## License

MIT