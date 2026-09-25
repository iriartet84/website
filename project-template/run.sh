#!/usr/bin/env bash
# The project's entry point: run the analysis and write the portfolio output
# to site/latest.json (format: schema/portfolio-output-1.json). Anything else
# written to site/ is published on GitHub Pages too — an app to embed, CSV
# downloads, figures.
#
# Replace the example with the project's pipeline, in any language:
#   python src/main.py      Rscript src/main.R      node src/main.mjs
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p site
python3 src/main.py --out site/latest.json
