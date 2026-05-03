# userscripts

Personal userscripts collection, organized by website and built with Rollup.

## Installation

```bash
npm install
```

## Commands

```bash
npm run validate:manifest
```

Validates `userscripts.json`.

```bash
npm run build
```

Starts an interactive userscript selection and bumps the selected scripts' patch versions.

```bash
npm run build:all
```

Builds all userscripts without changing versions.

```bash
node build.js --script lacentrale.fr/LaCentraleEnhancer
```

Builds one specific userscript and bumps its patch version.

```bash
node build.js --script lacentrale.fr/LaCentraleEnhancer --no-version
```

Builds one specific userscript without changing its version.

## Structure

```text
userscripts.json                 # central manifest
build.js                         # build CLI
rollup.config.js                 # dynamic Rollup configuration
scripts/                         # manifest and validation helpers
dist/                            # generated userscripts
lacentrale.fr/LaCentraleEnhancer # LaCentrale userscript source
```

## Manifest

Userscripts are declared in `userscripts.json`:

```json
{
  "sites": {
    "lacentrale.fr": {
      "scripts": {
        "LaCentraleEnhancer": {
          "version": "0.0.1",
          "entry": "lacentrale.fr/LaCentraleEnhancer/index.js",
          "output": "dist/LaCentraleEnhancer.user.js",
          "includes": ["https://www.lacentrale.fr/listing*"]
        }
      }
    }
  }
}
```

A script identifier uses this format:

```text
<site>/<script>
```

Example:

```text
lacentrale.fr/LaCentraleEnhancer
```

## LaCentraleEnhancer

Userscript for `https://www.lacentrale.fr/listing*`.

Current features:

- sticky pagination inserted into the results list;
- `Preview` button in the top-right corner of each listing card;
- preview overlay with photos, description, price, and vehicle specs;
- photo carousel with previous/next controls, counter, and thumbnails;
- favorite button inside the overlay, wired to LaCentrale's native favorite button;
- internal overlay scrolling with background page scroll lock;
- close via button, backdrop click, or `Escape`.

## Release

The release workflow uses the versions declared in `userscripts.json`.

Recommended tag convention:

```text
<site>-<script>-v<version>
```

Example:

```text
lacentrale.fr-LaCentraleEnhancer-v0.0.1
```
