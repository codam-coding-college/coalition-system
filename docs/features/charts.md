# Charts

## Overview

The charts endpoints provides data for front-end charts, rendered in the browser using Chart.js.

## Implementation

Chart data is computed server-side by `src/routes/charts.ts`, which queries database records and aggregates them into time-series data. The result is passed to the front-end upon request, which then renders it into a Chart.js chart.

The client-side script `static/js/codam-charts.js` handles the Chart.js initialization and rendering.

Chart data is cached in memory. The cache is invalidated whenever a new score is created (via `generateChartAllCoalitionScoreHistory()` and `generateChartCoalitionScoreHistory()` called from `src/handlers/points.ts` after each score creation).
