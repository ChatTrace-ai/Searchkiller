# research/ — Research Dashboard Page

The main research results page (`/research?q=<keyword>`). Orchestrates the full pipeline:
1. Calls `/api/plan` to decompose the keyword
2. Calls `/api/research/fetch` to retrieve context
3. Starts parallel streams for report and mind-map
4. Renders a split-view dashboard with live Markdown + interactive D3 tree
