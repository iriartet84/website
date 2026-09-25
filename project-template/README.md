# Project template

Starting point for a live project on the portfolio. Copy this folder into a new
public repository (one repository per substantial project). The project can be
written in any language: all the portfolio needs is one JSON file that the
project publishes on its GitHub Pages site.

```
run.sh ──► site/latest.json ──► validate ──► history/ (dated copy)
       ──► GitHub Pages ──► POST <portfolio>/api/projects/refresh
                                   │
                                   ▼
             the portfolio fetches latest.json, validates it, stores it,
             and refreshes /projects, /projects/<slug> and Home
```

The portfolio never runs the project's code and never fetches the file while a
visitor is loading a page. It keeps the last valid copy, so a failed run or a
broken file leaves the project page exactly as it was.

## What's here

| Path | What it does |
| --- | --- |
| `run.sh` | Entry point. Runs the analysis and writes `site/latest.json`. |
| `src/main.py` | Example pipeline (synthetic data). Replace it. |
| `site/` | Everything in it is published on GitHub Pages: the output file, and optionally an app to embed, CSV downloads, figures. |
| `history/` | A dated copy of every published output, committed by the workflow. It gives a public record of past estimates (vintages). |
| `scripts/validate-output.mjs` | Checks the output against the contract. Zero dependencies. The workflow stops before publishing an invalid file. |
| `schema/portfolio-output-1.json` | The contract as a JSON Schema. It's generated from the website's `lib/project-output.ts` with `npm run schema:output`. |
| `workflows/publish.yml` | Schedule → run → validate → history → Pages → wait → notify. Goes in `.github/workflows/` of the project repository (it's kept outside `.github/` here so it never runs in the website repository). |

## Setting up a new project

1. **Create the repository.** Make a new public repository and copy this
   folder's contents into it. Move `workflows/publish.yml` to
   `.github/workflows/publish.yml`. Add the language setup the project needs
   in `publish.yml` (Python is set up by default; R, Node and Julia examples
   are commented out). Replace `src/main.py`, and edit `run.sh` if the
   command changes.
2. **Turn on Pages.** Go to Settings → Pages → Build and deployment → Source,
   and choose **GitHub Actions**.
3. **Add the variables and secrets.** Go to Settings → Secrets and variables →
   Actions.
   - Variable `PORTFOLIO_URL`: the site's address, e.g.
     `https://toribioiriarte.netlify.app`.
   - Variable `PORTFOLIO_PROJECT_SLUG`: the project's slug on the portfolio
     (its address is `/projects/<slug>`).
   - Secret `PORTFOLIO_REFRESH_SECRET`: the same value as the site's
     `PROJECT_REFRESH_SECRET` environment variable on Netlify.
   - Any API keys the project uses, as secrets. Pass them to `run.sh` in the
     workflow's `env:` block. Never commit keys; the repository is public.
4. **Create the project on the portfolio.** In `/admin/projects`, add the
   project and save. Then, under **Edit page → Live data**:
   - set **Output file URL** to `https://<user>.github.io/<repo>/latest.json`;
   - set the update frequency;
   - click **Check now**.
5. **Run it.** Go to Actions → Publish → Run workflow. After the first run,
   the schedule in `publish.yml` takes over.

Without the variables in step 3, the workflow still publishes to Pages. It
just doesn't notify the portfolio, which then picks up the new output within
6 hours through its own scheduled check.

## The output file (`portfolio-output/1`)

```json
{
  "schema": "portfolio-output/1",
  "updatedAt": "2026-09-24T06:20:00Z",
  "status": "ok",
  "headline": [
    {
      "id": "gdp_nowcast",
      "label": "Q3 GDP growth nowcast",
      "value": 0.4,
      "unit": "% q/q",
      "change": 0.1,
      "asOf": "2026-09-24",
      "note": "Change since last week's estimate"
    }
  ],
  "series": [
    {
      "id": "nowcast",
      "label": "Nowcast",
      "unit": "% q/q",
      "points": [["2026-07-01", 0.3, 0.1, 0.5], ["2026-08-01", 0.35, 0.15, 0.55]]
    }
  ],
  "notes": "Optional note shown under the key figures.",
  "downloads": [
    { "label": "Full dataset (CSV)", "url": "https://<user>.github.io/<repo>/data.csv" }
  ]
}
```

**Top-level fields**

- `schema` and `updatedAt` are required. `updatedAt` is a date (`2026-09-24`)
  or a date-time with a timezone (`2026-09-24T06:20:00Z`). The portfolio shows
  it as "Data updated 3 hours ago".
- `status` is `ok`, `degraded` or `error`. Anything other than `ok` shows a
  short warning on the project page.

**`headline`** holds up to 12 key figures. The first one also appears on the
project's card and in Home's Featured Projects. Each figure has:

- `value`: a number, or short text (e.g. `"Expansion"`);
- `unit`: shown after the value (units starting with `%` attach directly:
  `2.4%`);
- `change`: the change since the previous estimate, in the same unit.

**`series`** holds up to 20 series of up to 5,000 points each. Each point is
`[x, y]` or `[x, y, lower, upper]`; the last two draw an uncertainty band.

- `x` is an ISO date or a number.
- `y` may be `null` for a gap.
- A Chart section on the project page picks up to 4 series.

**Other fields**

- `notes`: optional, shown under the key figures.
- `downloads`: optional. Each one needs an https URL.
- Extra fields are allowed and ignored. Put anything the project's own app
  needs next to `latest.json` in `site/`.

**Limits.** The file can be at most 1 MB. Publish larger datasets as
downloads.

Check a file locally with:

```sh
bash run.sh && node scripts/validate-output.mjs site/latest.json
```

## Embedding an app

A project can also publish an interactive app: a static JS/Observable app in
`site/`, or a Shiny, Dash or Streamlit app hosted elsewhere. To show it on the
project page:

1. Set **Embedded app URL** in the project's Live data settings.
2. Add a **Live app** section to the page.
3. Make sure the app's origin is listed in the site's `PROJECT_EMBED_ORIGINS`
   environment variable. For GitHub Pages this is `https://<user>.github.io`,
   which covers all project repositories. Changing it needs a Netlify
   redeploy.

The app loads only when a visitor clicks it, in a sandboxed frame.
