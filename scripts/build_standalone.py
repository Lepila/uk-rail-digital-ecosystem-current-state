#!/usr/bin/env python3
"""Build a single browser-openable HTML file for the rail ecosystem app."""

from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "dist" / "uk-rail-digital-ecosystem-current-state.html"


def main() -> None:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "styles.css").read_text(encoding="utf-8")
    js = (ROOT / "app.js").read_text(encoding="utf-8")
    data = (ROOT / "data" / "rail-ecosystem.json").read_text(encoding="utf-8")
    html2canvas = (ROOT / "vendor" / "html2canvas.min.js").read_text(encoding="utf-8")
    jspdf = (ROOT / "vendor" / "jspdf.umd.min.js").read_text(encoding="utf-8")

    html = html.replace('    <link rel="stylesheet" href="styles.css" />', f"    <style>\n{css}\n    </style>")
    html = html.replace(
        '    <script src="vendor/html2canvas.min.js"></script>\n    <script src="vendor/jspdf.umd.min.js"></script>\n    <script src="data/rail-ecosystem-data.js"></script>\n    <script src="app.js"></script>',
        f"    <script>\n{html2canvas}\n    </script>\n    <script>\n{jspdf}\n    </script>\n    <script>\nwindow.RAIL_ECOSYSTEM_DATA = {data};\n    </script>\n    <script>\n{js}\n    </script>",
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(html, encoding="utf-8")
    print(OUTPUT)


if __name__ == "__main__":
    main()
