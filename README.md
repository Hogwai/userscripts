# userscripts

Personal userscripts collection, organized by website and built with Rollup.

## Prerequisites

[Node.js](https://nodejs.org/) 20+ and npm.

```bash
npm install
```

## Scripts

| Script | Site | Description |
|--------|------|-------------|
| `LaCentraleEnhancer` | `lacentrale.fr/listing*` | Sticky pagination, preview overlay with photo carousel, favorites |
| `LinkedInScheduledCalendar` | `linkedin.com/*` | Calendar grid view of scheduled posts with date-based highlights |

### LaCentraleEnhancer

Adds a preview overlay to vehicle listing cards on LaCentrale search results.

- Sticky pagination inserted into the results list
- `Preview` button on each listing card
- Overlay with photos, description, price, and specs
- Photo carousel with previous/next controls, counter, and thumbnails
- Favorite button wired to LaCentrale's native favorite
- Internal scrolling with background scroll lock
- Close via button, backdrop click, or Escape

### LinkedInScheduledCalendar

Adds a calendar view to LinkedIn's scheduled posts modal, making it easier to visualize post dates at a glance.

- `Calendar` toggle button in the modal toolbar
- Monthly calendar grid with numbered day cells
- Scheduled posts highlighted with colored dots by status
- Detail panel showing post content on day click
- Toggle back to list view without losing state
- `Manage scheduled posts` link in the empty-state footer

## Usage

```bash
# Interactive build (select scripts, bumps patch version)
npm run build

# Build all scripts, no version bump
npm run build:all

# Build a specific script with version bump
node build.js --script lacentrale.fr/LaCentraleEnhancer

# Build a specific script, no version bump
node build.js --script linkedin.com/LinkedInScheduledCalendar --no-version

# Validate manifest
npm run validate:manifest

# Clean generated files
npm run clean
```

## Project Structure

```text
userscripts.json                 # Central manifest declaring all scripts
build.js                         # Build CLI (interactive or headless)
rollup.config.js                 # Dynamic Rollup config per script
scripts/                         # Manifest and validation helpers
dist/                            # Generated .user.js bundles

lacentrale.fr/LaCentraleEnhancer/       # Source: LaCentraleEnhancer
  index.js

linkedin.com/LinkedInScheduledCalendar/ # Source: LinkedInScheduledCalendar
  index.js          # Entry point, lifecycle, modal observer
  config.js         # Constants, selectors, URLs
  state.js          # Shared mutable state
  utils.js          # getModalRoot, log
  date-utils.js     # Month map, date parsing, validation
  post-parser.js    # DOM -> post data extraction
  calendar-ui.js    # HTML templates, grid/detail rendering
  buttons.js        # Calendar button and management link injection
```

## Manifest

Scripts are declared in `userscripts.json`. Each entry specifies the source entry point, output path, version, and URL patterns:

```json
{
  "sites": {
    "linkedin.com": {
      "scripts": {
        "LinkedInScheduledCalendar": {
          "version": "0.0.1",
          "entry": "linkedin.com/LinkedInScheduledCalendar/index.js",
          "output": "dist/LinkedInScheduledCalendar.user.js",
          "includes": ["https://www.linkedin.com/*"]
        }
      }
    }
  }
}
```

A script identifier uses the format `<site>/<script>` — e.g. `lacentrale.fr/LaCentraleEnhancer`.

## CI / CD

Two GitHub Actions workflows:

**Build Validation** (`.github/workflows/build.yml`) — runs on every push and PR to `main`:

1. `npm ci`
2. Validates `userscripts.json`
3. Builds all scripts via `npm run build:all`
4. Verifies generated version metadata matches the manifest

**Release** (`.github/workflows/release.yml`) — runs on push to `main` when `userscripts.json` changes, or manually via `workflow_dispatch`:

1. Detects scripts whose version changed since the previous commit
2. Builds each changed script
3. Creates a GitHub Release with the compiled `.user.js` attached

## Release

Increment a script's `version` field in `userscripts.json` and push to `main`. The release workflow will automatically detect the change, build the script, and publish a release.

Tag convention (auto-generated): `<site>-<script>-v<version>`
