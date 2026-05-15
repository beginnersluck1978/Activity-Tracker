// ─────────────────────────────────────────────────────────────────────────────
//  Activity Logger — Google Apps Script
//  Paste this entire file into your Apps Script editor, save, and re-deploy
//  as a Web App (Execute as: Me, Who has access: Anyone).
// ─────────────────────────────────────────────────────────────────────────────

const TIMEZONE = "America/Winnipeg";

function doGet() {
  return jsonResponse_({ ok: true, message: "Activity Logger API is running" });
}

function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    const data = parseRequestBody_(e);
    const action = data.action;

    // ── Existing actions ───────────────────────────────────────────────────────

    if (action === "createActivity") {
      const user = cleanString_(data.user || "default");
      closeActiveActivity_(sheet, user);
      sheet.appendRow([
        data.recordId || Utilities.getUuid(),
        user,
        cleanString_(data.activity || ""),
        cleanString_(data.date || formatWinnipegDate_(new Date())),
        normalizeTimeValue_(data.startTime),
        "",
        true,
        "Active",
        data.createdAt || new Date().toISOString(),
      ]);
      return jsonResponse_({ ok: true, message: "Activity created" });
    }

    if (action === "endActivity") {
      const user = cleanString_(data.user || "default");
      const ended = endActiveActivity_(sheet, user);
      return jsonResponse_({
        ok: true,
        message: ended ? "Activity ended" : "No active activity found",
      });
    }

    if (action === "getCurrentActivity") {
      const user = cleanString_(data.user || "default");
      const activity = getCurrentActivity_(sheet, user);
      return jsonResponse_({ ok: true, activity });
    }

    // ── New actions ────────────────────────────────────────────────────────────

    if (action === "getRecentActivities") {
      const user = cleanString_(data.user || "default");
      const limit = parseInt(data.limit || "15");
      const activities = getRecentActivities_(sheet, user, limit);
      return jsonResponse_({ ok: true, activities });
    }

    if (action === "updateActivity") {
      const updated = updateActivity_(sheet, data);
      return jsonResponse_({ ok: true, updated });
    }

    if (action === "batchUpdate") {
      // Update multiple activities in one call (used for boundary-time edits)
      const updates = data.updates || [];
      let count = 0;
      for (const update of updates) {
        if (updateActivity_(sheet, update)) count++;
      }
      return jsonResponse_({ ok: true, updated: count });
    }

    if (action === "insertActivity") {
      // Insert a backdated/completed activity WITHOUT auto-closing other rows
      const user = cleanString_(data.user || "default");
      sheet.appendRow([
        data.recordId || Utilities.getUuid(),
        user,
        cleanString_(data.activity || ""),
        cleanString_(data.date || formatWinnipegDate_(new Date())),
        data.startTime ? normalizeTimeValue_(data.startTime) : currentWinnipegTime_(),
        data.endTime ? normalizeTimeValue_(data.endTime) : "",
        data.isActive !== undefined ? data.isActive : false,
        data.status || "Completed",
        data.createdAt || new Date().toISOString(),
      ]);
      return jsonResponse_({ ok: true, message: "Activity inserted" });
    }

    return jsonResponse_({ ok: false, message: "Unknown action: " + action });
  } catch (error) {
    return jsonResponse_({
      ok: false,
      message: error && error.message ? error.message : String(error),
    });
  }
}

// ── New helper functions ───────────────────────────────────────────────────────

function getRecentActivities_(sheet, user, limit) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0];
  const rows = values.slice(1);
  const col = indexMap_(headers);

  const userRows = rows
    .filter((row) => matchesUser_(row[col.user], user))
    .map((row) => ({
      recordId: String(row[col.recordId]),
      user: String(row[col.user]),
      activity: String(row[col.activity]),
      date: String(row[col.date]),
      startTime: String(row[col.startTime]),
      endTime: String(row[col.endTime]),
      isActive: isActive_(row[col.isActive]),
      status: String(row[col.status]),
      createdAt: String(row[col.createdAt]),
    }));

  // Return the last `limit` rows, newest first
  return userRows.slice(-limit).reverse();
}

function updateActivity_(sheet, data) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return false;

  const headers = values[0];
  const rows = values.slice(1);
  const col = indexMap_(headers);
  const targetId = String(data.recordId || "").trim();

  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][col.recordId]).trim() === targetId) {
      const sheetRow = i + 2; // +1 for header, +1 for 1-based index

      if (data.activity !== undefined)
        sheet.getRange(sheetRow, col.activity + 1).setValue(cleanString_(data.activity));

      if (data.date !== undefined)
        sheet.getRange(sheetRow, col.date + 1).setValue(cleanString_(data.date));

      if (data.startTime !== undefined)
        sheet.getRange(sheetRow, col.startTime + 1).setValue(normalizeTimeValue_(data.startTime));

      if (data.endTime !== undefined)
        sheet.getRange(sheetRow, col.endTime + 1).setValue(
          data.endTime ? normalizeTimeValue_(data.endTime) : ""
        );

      if (data.isActive !== undefined)
        sheet.getRange(sheetRow, col.isActive + 1).setValue(data.isActive);

      if (data.status !== undefined)
        sheet.getRange(sheetRow, col.status + 1).setValue(data.status);

      return true;
    }
  }

  return false; // Record not found
}

// ── Existing helper functions (unchanged) ─────────────────────────────────────

function getCurrentActivity_(sheet, user) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return null;

  const headers = values[0];
  const rows = values.slice(1);
  const col = indexMap_(headers);

  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    if (matchesUser_(row[col.user], user) && isActive_(row[col.isActive])) {
      return {
        recordId: row[col.recordId],
        user: row[col.user],
        activity: row[col.activity],
        date: row[col.date],
        startTime: row[col.startTime],
        endTime: row[col.endTime],
        isActive: row[col.isActive],
        status: row[col.status],
        createdAt: row[col.createdAt],
      };
    }
  }

  return null;
}

function closeActiveActivity_(sheet, user) {
  return endActiveActivity_(sheet, user);
}

function endActiveActivity_(sheet, user) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return false;

  const headers = values[0];
  const rows = values.slice(1);
  const col = indexMap_(headers);
  const serverNow = currentWinnipegTime_();

  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    if (matchesUser_(row[col.user], user) && isActive_(row[col.isActive])) {
      const sheetRow = i + 2;
      sheet.getRange(sheetRow, col.endTime + 1).setValue(serverNow);
      sheet.getRange(sheetRow, col.isActive + 1).setValue(false);
      sheet.getRange(sheetRow, col.status + 1).setValue("Completed");
      return true;
    }
  }

  return false;
}

function currentWinnipegTime_() {
  return Utilities.formatDate(new Date(), TIMEZONE, "HH:mm:ss");
}

function normalizeTimeValue_(value) {
  if (typeof value === "string" && /^\d{2}:\d{2}:\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  if (value) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      return Utilities.formatDate(d, TIMEZONE, "HH:mm:ss");
    }
  }
  return currentWinnipegTime_();
}

function formatWinnipegDate_(dateObj) {
  return Utilities.formatDate(dateObj, TIMEZONE, "M/d/yyyy");
}

function cleanString_(value) {
  return String(value || "").trim();
}

function matchesUser_(cellValue, user) {
  return String(cellValue || "").trim() === String(user || "").trim();
}

function isActive_(value) {
  return value === true || String(value).toLowerCase() === "true";
}

function parseRequestBody_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error("Missing request body");
  }
  return JSON.parse(e.postData.contents);
}

function indexMap_(headers) {
  return {
    recordId: headers.indexOf("Record ID"),
    user: headers.indexOf("User"),
    activity: headers.indexOf("Activity"),
    date: headers.indexOf("Date"),
    startTime: headers.indexOf("Start Time"),
    endTime: headers.indexOf("End Time"),
    isActive: headers.indexOf("Is Active"),
    status: headers.indexOf("Status"),
    createdAt: headers.indexOf("Created At"),
  };
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
