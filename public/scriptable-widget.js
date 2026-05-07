// Webbes Finance Widget for Scriptable (iOS)
// ─────────────────────────────────────────
// 1. Download the free "Scriptable" app from the App Store
// 2. Create a new script and paste this entire file
// 3. Replace the URL below with your Vercel deployment URL
// 4. Long-press your home screen → Add Widget → Scriptable
// 5. Edit the widget and select this script

const API_URL = "https://webbes-dashboard.vercel.app/api/widget"

async function loadData() {
  const req  = new Request(API_URL)
  const data = await req.loadJSON()
  return data
}

function createWidget(data) {
  const w     = new ListWidget()
  const dark  = Color.black()
  const white = Color.white()
  const gray  = new Color("#888888")
  const green = new Color("#ffffff")

  w.backgroundColor = dark
  w.setPadding(16, 16, 16, 16)

  // Business name header
  const header = w.addText(data.business)
  header.font        = Font.boldSystemFont(11)
  header.textColor   = gray
  header.lineLimit   = 1

  w.addSpacer(4)

  // Main metric: net profit this month
  const profit = data.metrics.monthProfit
  const sign   = profit.raw >= 0 ? "" : "−"

  const mainLabel = w.addText("NET PROFIT")
  mainLabel.font      = Font.boldSystemFont(9)
  mainLabel.textColor = gray

  const mainValue = w.addText(sign + profit.value.replace(/^[+\-]/, ""))
  mainValue.font      = Font.boldSystemFont(28)
  mainValue.textColor = profit.raw >= 0 ? white : gray
  mainValue.minimumScaleFactor = 0.6

  w.addSpacer(8)

  // Two secondary metrics
  const row1 = w.addStack()
  row1.layoutHorizontally()

  addMetric(row1, "MADE", data.metrics.monthRevenue.value)
  row1.addSpacer()
  addMetric(row1, "SPENT", data.metrics.monthExpenses.value)

  w.addSpacer(6)

  const row2 = w.addStack()
  row2.layoutHorizontally()

  addMetric(row2, "CAPITAL", data.metrics.capitalLeft.value)
  row2.addSpacer()
  addMetric(row2, "RUNWAY", data.metrics.runway.value + " mo")

  w.addSpacer()

  // Month label + refresh time
  const footer = w.addText(data.month)
  footer.font      = Font.systemFont(9)
  footer.textColor = new Color("#444444")

  return w
}

function addMetric(stack, label, value) {
  const col   = stack.addStack()
  col.layoutVertically()

  const lbl   = col.addText(label)
  lbl.font      = Font.boldSystemFont(8)
  lbl.textColor = new Color("#666666")

  const val   = col.addText(value)
  val.font      = Font.boldSystemFont(13)
  val.textColor = Color.white()
  val.minimumScaleFactor = 0.7
}

// ── Run ──────────────────────────────────────────────────────────────────────
try {
  const data   = await loadData()
  const widget = createWidget(data)

  if (config.runsInWidget) {
    Script.setWidget(widget)
  } else {
    widget.presentSmall()
  }
} catch (e) {
  const w = new ListWidget()
  w.backgroundColor = Color.black()
  const err = w.addText("Error loading data")
  err.textColor = Color.red()
  err.font = Font.systemFont(12)
  Script.setWidget(w)
}

Script.complete()
