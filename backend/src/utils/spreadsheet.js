const ExcelJS = require('exceljs');

const FORMULA_PREFIX = /^[=+\-@]/;

const safeSpreadsheetText = (value) => {
  const text = String(value ?? '');
  return FORMULA_PREFIX.test(text) ? `'${text}` : text;
};

const cellToPlainValue = (cell) => {
  if (!cell) return '';
  const value = cell.value;
  if (value === null || value === undefined) return '';

  if (typeof value === 'object') {
    if (value.formula || value.sharedFormula) {
      throw new Error(`第 ${cell.row} 行第 ${cell.col} 列不允许使用公式`);
    }
    if (value.richText) return value.richText.map((item) => item.text || '').join('');
    if (value.text !== undefined) return String(value.text);
    if (value.result !== undefined) return value.result;
    if (value instanceof Date) return value.toISOString();
  }

  return value;
};

const readWorksheetRows = async (
  buffer,
  {
    maxRows = 5000,
    maxColumns = 50,
    maxBytes = 10 * 1024 * 1024
  } = {}
) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Excel 文件为空');
  }
  if (buffer.length > maxBytes) {
    throw new Error(`Excel 文件不能超过 ${Math.floor(maxBytes / 1024 / 1024)}MB`);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer, {
    ignoreNodes: ['dataValidations', 'extLst', 'drawing', 'picture']
  });

  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('Excel 文件中没有工作表');
  if (worksheet.actualColumnCount > maxColumns) {
    throw new Error(`Excel 文件最多允许 ${maxColumns} 列`);
  }
  if (worksheet.actualRowCount < 2) return [];
  if (worksheet.actualRowCount - 1 > maxRows) {
    throw new Error(`单次最多导入 ${maxRows} 行数据`);
  }

  const headers = [];
  worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, columnNumber) => {
    const header = String(cellToPlainValue(cell) ?? '').trim();
    headers[columnNumber] = header;
  });

  const meaningfulHeaders = headers.filter(Boolean);
  if (!meaningfulHeaders.length) throw new Error('Excel 首行必须包含列标题');
  if (new Set(meaningfulHeaders).size !== meaningfulHeaders.length) {
    throw new Error('Excel 列标题不能重复');
  }

  const rows = [];
  for (let rowNumber = 2; rowNumber <= worksheet.actualRowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const item = {};
    let hasValue = false;

    for (let columnNumber = 1; columnNumber < headers.length; columnNumber += 1) {
      const header = headers[columnNumber];
      if (!header) continue;
      const plainValue = cellToPlainValue(row.getCell(columnNumber));
      if (plainValue !== '' && plainValue !== null && plainValue !== undefined) hasValue = true;
      item[header] = plainValue ?? '';
    }

    if (hasValue) rows.push(item);
  }

  return rows;
};

const createWorkbookBuffer = async ({ sheetName, columns, rows }) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Lab Safety Access';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet(String(sheetName || '数据').slice(0, 31), {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  worksheet.columns = columns.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width || 16
  }));

  for (const sourceRow of rows) {
    const safeRow = {};
    for (const column of columns) {
      const value = sourceRow[column.key];
      safeRow[column.key] = typeof value === 'string'
        ? safeSpreadsheetText(value)
        : value;
    }
    worksheet.addRow(safeRow);
  }

  worksheet.getRow(1).font = { bold: true };
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, worksheet.rowCount), column: Math.max(1, columns.length) }
  };

  const output = await workbook.xlsx.writeBuffer({
    useStyles: true,
    useSharedStrings: true
  });
  return Buffer.from(output);
};

module.exports = {
  safeSpreadsheetText,
  readWorksheetRows,
  createWorkbookBuffer
};
