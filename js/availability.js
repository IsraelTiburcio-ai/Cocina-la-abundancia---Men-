export function resolveAvailability(entityAvailability) {
  const fallback = { mode: 'always' };
  if (!entityAvailability || typeof entityAvailability !== 'object') return fallback;

  const allowedModes = ['always', 'schedule', 'manual'];
  if (!allowedModes.includes(entityAvailability.mode)) return fallback;
  return entityAvailability;
}

export function isWithinSchedule(availability, now, timezone) {
  const localNow = getLocalDateParts(now, timezone || 'America/Mexico_City');
  const day = localNow.day;
  const minutes = localNow.hour * 60 + localNow.minute;

  const days = Array.isArray(availability.days) ? availability.days : [];
  const start = parseTimeToMinutes(availability.start, 0);
  const end = parseTimeToMinutes(availability.end, 23 * 60 + 59);

  const inDay = !days.length || days.includes(day);
  if (!inDay) return false;

  if (end >= start) {
    return minutes >= start && minutes <= end;
  }

  return minutes >= start || minutes <= end;
}

export function parseTimeToMinutes(value, fallback) {
  const [h, m] = String(value || '')
    .split(':')
    .map((n) => Number(n));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return fallback;
  return h * 60 + m;
}

export function getLocalDateParts(date, timezone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const weekday = parts.find((p) => p.type === 'weekday')?.value || 'Sun';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value || 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value || 0);

  const dayMap = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return { day: dayMap[weekday] ?? 0, hour, minute };
}
