const APP_TIME_ZONE = process.env.APP_TIME_ZONE || 'Asia/Shanghai';

const TIMESTAMP_KEYS = new Set([
  'created_at',
  'updated_at',
  'createdAt',
  'updatedAt',
  'submit_time',
  'submitTime',
  'lastWrongTime',
  'last_wrong_time',
  'applied_at',
  'appliedAt',
  'timestamp'
]);

const dateTimeFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23'
});

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

const partsToObject = (parts) => Object.fromEntries(
  parts
    .filter((part) => part.type !== 'literal')
    .map((part) => [part.type, part.value])
);

const formatAppDateTime = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = partsToObject(dateTimeFormatter.formatToParts(date));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
};

const formatAppDate = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = partsToObject(dateFormatter.formatToParts(date));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const utcDateTimeNow = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

const parseStoredUtcDateTime = (value) => {
  if (value instanceof Date) return value;
  if (typeof value !== 'string') return null;

  const text = value.trim();
  if (!text) return null;

  // SQLite CURRENT_TIMESTAMP and this application's explicit submit timestamps
  // are stored as timezone-less UTC strings: YYYY-MM-DD HH:mm:ss.
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(text)) {
    const normalized = `${text.replace(' ', 'T')}Z`;
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  // Also support normal ISO timestamps that already contain Z or an offset.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(text)
      && /(Z|[+-]\d{2}:?\d{2})$/i.test(text)) {
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

const toAppDateTime = (value) => {
  const parsed = parseStoredUtcDateTime(value);
  return parsed ? formatAppDateTime(parsed) : value;
};

const localizeTimestampFields = (value, parentKey = '') => {
  if (Array.isArray(value)) {
    return value.map((item) => localizeTimestampFields(item));
  }

  if (!value || typeof value !== 'object' || value instanceof Date) {
    return TIMESTAMP_KEYS.has(parentKey) ? toAppDateTime(value) : value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => {
      if (TIMESTAMP_KEYS.has(key)) return [key, toAppDateTime(child)];
      return [key, localizeTimestampFields(child, key)];
    })
  );
};

module.exports = {
  APP_TIME_ZONE,
  formatAppDateTime,
  formatAppDate,
  utcDateTimeNow,
  toAppDateTime,
  localizeTimestampFields
};
