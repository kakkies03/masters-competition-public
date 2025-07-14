// https://script.google.com/u/0/home/projects/1yzS7BlyNF6QYAz8J-TQek8QU1DzU-MZDy60xcqSavZOkhaI5nZ7qx7of/edit

function doGet() {
  const sheet = SpreadsheetApp.openById("14Nheq4KCqEjYiHHJm-_v3ZX4rKGcT2f_3mBVr1LKfRU").getSheetByName("2025年度公認大会一覧");
  const values = sheet.getDataRange().getValues();

  return ContentService
    .createTextOutput(JSON.stringify(values))
    .setMimeType(ContentService.MimeType.JSON);
}
