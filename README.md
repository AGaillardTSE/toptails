# Upper-Tail Inequality — Data v1

Complete current website package, updated 15 November 2026.

## Put it on GitHub Pages

1. Extract the ZIP on your computer.
2. Upload **the contents of this folder**, including `data/`, to your repository. Keep `index.html` at the repository root. Upload the extracted files, not the ZIP itself.
3. In repository **Settings → Pages**, choose **Deploy from a branch**, your `main` branch, and **/(root)**. Save.

The pages are already built. No installation, Git LFS, backend, API key or build workflow is required. All data paths work under a repository subdirectory. The repository’s existing custom domain, `uppertaildata.com`, is preserved.

Every data chunk is at most 4 MiB. US relationship plots offer No minimum, 5, 10, 15 and 20 observations per bin; ten is the default. With a minimum selected, adjacent intervals are merged before calculating their weighted means and medians; small-bin observations are not discarded. The No minimum option uses the exported primitive intervals. Other countries offer the minimum-count options available in their source exports. All univariate estimates and KS results are retained.

The opening view loads a small KS bootstrap. Detailed threshold curves, relationship data and composition profiles load only when needed. Data filenames contain content hashes so browser caches cannot mix releases. Previous aggregate asset paths may remain in the repository for compatibility with cached pages. International Forbes estimates and the obsolete assets containing them are removed; US Forbes references are retained.

The current PSID, SCF and CEX relationship inputs use genuine 0.1-percentile primitives and the common age-20–80, positive-food sample. Weighted means and a minimum of ten observations are the defaults. Capital-income definition options are independent and use separately recomputed aggregates. Composition plots use precomputed paper-matched percentile points and R LOESS coordinates. All available adjustment stages are always shown, using the website’s fonts and legend styling. Their source composition samples remain distinct from the log–log sample.

Methodology includes a Pareto-estimation explanation and a synthetic illustration of the Kolmogorov–Smirnov cutoff criterion. Its numerical coordinates reproduce the supplied R example; the research script is not part of this package.

## Preview locally

Run `python3 -m http.server 8000` from this folder and open `http://localhost:8000`. Use an HTTP server: opening the external-data version directly with `file://` will not load its data files.

## Source and rebuilding

- `src/`: editable JavaScript, CSS, HTML templates and methodology.
- `vendor/`: bundled Chart.js and its MIT license.
- `data/`: public, compressed aggregate results, split into binary parts.
- `data_manifest.json`: data order, file sizes and SHA-256 checksums.
- `validation/`: preservation and numerical validation reports.
- `build.py`: portable builder; Python 3 standard library only.

After editing source files, run `python3 build.py --verify` to rebuild the web pages and check every data part. The builder does not recompute research estimates.

To recreate the original, self-contained downloadable HTML, run `python3 build.py --standalone`. It writes both designs to `standalone/` and verifies that the primary page matches the original release byte for byte. These large files are excluded from Git because they exceed GitHub’s normal file-size limit.

`index.html` is the primary site; `inequality_observatory.html` is an identical named entry point; `inequality.html` retains the alternative design. They share one copy of the aggregate data.

This archive contains the complete current public website and everything needed to rebuild it. Private survey/account records, local research inputs and obsolete website backups are not included. The archived previous CEX aggregates already present in the published payload are preserved, while the old CEX choice remains removed from the log–log selector.

See `NOTICE.md` for authorship and licensing. See the site’s Data and Methodology sections for dataset definitions, sources and limitations.

GitHub limits: https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github

GitHub Pages limits: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
