// ─────────────────────────────────────────────
//  PERSONALIZATION — edit these values for each user
// ─────────────────────────────────────────────

export const userConfig = {
  // The user ID that gets stored in the spreadsheet
  userId: "james",

  // Display name shown in the app header
  displayName: "James",

  // Timezone for all date/time calculations
  timezone: "America/Winnipeg",

  // Your Google Sheet URL (the "Open Sheet" link in the app)
  sheetUrl:
    "https://docs.google.com/spreadsheets/d/1M75bxtHgB5HWZZ4nyRjwzciN4BI2kSeq-flJZk3TlfM/edit?gid=0#gid=0",

  // Your Google Apps Script web app URL
  apiUrl:
    "https://script.google.com/macros/s/AKfycbxOZ1XQTApK6ha3EkTtaAHPV6jbcZZPbuIj80kIPM-hoaJ_I3zzWuhXcH5dOOV9dDGR/exec",

  // Background image:
  //   - Use a filename from the /public folder, e.g. "bg-ski.jpg"
  //   - Or use a full URL, e.g. "https://example.com/my-photo.jpg"
  backgroundImage: "bg-ski.jpg",

  // How many recent activities to fetch and display
  recentActivityLimit: 15,
};
