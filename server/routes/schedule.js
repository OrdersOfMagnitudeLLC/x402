const express = require('express');

const router = express.Router();

// POST /schedule/timezone/convert - Convert timestamp from one timezone to another
router.post('/timezone/convert', async (req, res) => {
  try {
    const { timestamp, from_timezone, to_timezone } = req.body;
    
    if (!timestamp || !from_timezone || !to_timezone) {
      return res.status(400).json({ error: 'timestamp, from_timezone, and to_timezone are required' });
    }
    
    const date = new Date(timestamp);
    
    try {
      const fromStr = date.toLocaleString('en-US', { timeZone: from_timezone });
      const toStr = date.toLocaleString('en-US', { timeZone: to_timezone });
      const toDate = new Date(toStr);
      
      res.json({
        original: timestamp,
        from_timezone,
        to_timezone,
        converted: toDate.toISOString(),
        formatted: toStr
      });
    } catch (e) {
      return res.status(400).json({ error: 'invalid_timezone', details: e.message });
    }
  } catch (error) {
    console.error('Schedule timezone convert error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /schedule/timezone/list - List available timezones by region
router.post('/timezone/list', async (req, res) => {
  try {
    const { region } = req.body;
    
    // Common timezones by region
    const timezoneRegions = {
      'Americas': ['America/New_York', 'America/Los_Angeles', 'America/Chicago', 'America/Denver', 'America/Toronto', 'America/Mexico_City', 'America/Sao_Paulo', 'America/Buenos_Aires'],
      'Europe': ['Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Rome', 'Europe/Madrid', 'Europe/Amsterdam', 'Europe/Zurich', 'Europe/Moscow'],
      'Asia': ['Asia/Tokyo', 'Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Singapore', 'Asia/Seoul', 'Asia/Dubai', 'Asia/Mumbai', 'Asia/Bangkok'],
      'Australia': ['Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane', 'Australia/Perth'],
      'Africa': ['Africa/Johannesburg', 'Africa/Cairo', 'Africa/Lagos', 'Africa/Nairobi']
    };
    
    if (region && timezoneRegions[region]) {
      res.json({ region, timezones: timezoneRegions[region] });
    } else {
      res.json({ all_regions: Object.keys(timezoneRegions), timezones: timezoneRegions });
    }
  } catch (error) {
    console.error('Schedule timezone list error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /schedule/timezone/current - Get current time in a specific timezone
router.post('/timezone/current', async (req, res) => {
  try {
    const { timezone } = req.body;
    
    if (!timezone) {
      return res.status(400).json({ error: 'timezone is required' });
    }
    
    try {
      const now = new Date();
      const currentStr = now.toLocaleString('en-US', { timeZone: timezone });
      const currentDate = new Date(currentStr);
      
      res.json({
        timezone,
        current_time: currentDate.toISOString(),
        formatted: currentStr,
        unix_timestamp: Math.floor(currentDate.getTime() / 1000)
      });
    } catch (e) {
      return res.status(400).json({ error: 'invalid_timezone' });
    }
  } catch (error) {
    console.error('Schedule timezone current error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /schedule/slot/next - Calculate next available time slot given constraints
router.post('/slot/next', async (req, res) => {
  try {
    const { start_after, duration_minutes, working_hours, exclude_weekends } = req.body;
    
    if (!start_after || !duration_minutes) {
      return res.status(400).json({ error: 'start_after and duration_minutes are required' });
    }
    
    const startDate = new Date(start_after);
    const duration = duration_minutes * 60 * 1000;
    const workHours = working_hours || { start: 9, end: 17 };
    const excludeWeekends = exclude_weekends !== false;
    
    let candidate = new Date(startDate);
    let found = false;
    let attempts = 0;
    const maxAttempts = 100;
    
    while (!found && attempts < maxAttempts) {
      attempts++;
      const day = candidate.getDay();
      const hour = candidate.getHours();
      
      // Skip weekends if configured
      if (excludeWeekends && (day === 0 || day === 6)) {
        candidate.setDate(candidate.getDate() + 1);
        candidate.setHours(workHours.start, 0, 0, 0);
        continue;
      }
      
      // Check if within working hours
      if (hour >= workHours.start && hour < workHours.end) {
        // Check if slot fits within working hours
        const slotEnd = new Date(candidate.getTime() + duration);
        const slotEndHour = slotEnd.getHours();
        
        if (slotEndHour <= workHours.end) {
          found = true;
          break;
        }
      }
      
      // Move to next hour
      candidate.setHours(candidate.getHours() + 1);
      if (candidate.getHours() >= workHours.end) {
        candidate.setDate(candidate.getDate() + 1);
        candidate.setHours(workHours.start, 0, 0, 0);
      }
    }
    
    if (!found) {
      return res.json({ available: false, reason: 'no_slot_found_within_range' });
    }
    
    res.json({
      available: true,
      slot_start: candidate.toISOString(),
      slot_end: new Date(candidate.getTime() + duration).toISOString(),
      duration_minutes
    });
  } catch (error) {
    console.error('Schedule slot next error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /schedule/slot/find-multiple - Find multiple available time slots
router.post('/slot/find-multiple', async (req, res) => {
  try {
    const { start_after, duration_minutes, count, working_hours, exclude_weekends } = req.body;
    
    if (!start_after || !duration_minutes || !count) {
      return res.status(400).json({ error: 'start_after, duration_minutes, and count are required' });
    }
    
    const slots = [];
    let currentSearch = new Date(start_after);
    
    for (let i = 0; i < count; i++) {
      const response = await fetch('http://localhost:3000/schedule/slot/next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_after: currentSearch,
          duration_minutes,
          working_hours,
          exclude_weekends
        })
      });
      
      const data = await response.json();
      
      if (!data.available) {
        break;
      }
      
      slots.push({
        slot_start: data.slot_start,
        slot_end: data.slot_end
      });
      
      currentSearch = new Date(data.slot_end);
    }
    
    res.json({ slots, count: slots.length, requested: count });
  } catch (error) {
    console.error('Schedule slot find-multiple error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /schedule/working-hours/between - Calculate working hours between two timestamps
router.post('/working-hours/between', async (req, res) => {
  try {
    const { start, end, working_hours, exclude_weekends } = req.body;
    
    if (!start || !end) {
      return res.status(400).json({ error: 'start and end are required' });
    }
    
    const startDate = new Date(start);
    const endDate = new Date(end);
    const workHours = working_hours || { start: 9, end: 17 };
    const excludeWeekends = exclude_weekends !== false;
    
    let totalMinutes = 0;
    let current = new Date(startDate);
    
    while (current < endDate) {
      const day = current.getDay();
      const hour = current.getHours();
      
      // Skip weekends if configured
      if (excludeWeekends && (day === 0 || day === 6)) {
        current.setDate(current.getDate() + 1);
        current.setHours(0, 0, 0, 0);
        continue;
      }
      
      // Check if within working hours
      if (hour >= workHours.start && hour < workHours.end) {
        totalMinutes++;
      }
      
      current = new Date(current.getTime() + 60000); // Add 1 minute
    }
    
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    res.json({
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      working_hours: `${hours}h ${minutes}m`,
      total_minutes: totalMinutes,
      total_hours: totalMinutes / 60
    });
  } catch (error) {
    console.error('Schedule working-hours between error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /schedule/working-hours/daily - Calculate working hours for a specific day
router.post('/working-hours/daily', async (req, res) => {
  try {
    const { date, working_hours } = req.body;
    
    if (!date) {
      return res.status(400).json({ error: 'date is required' });
    }
    
    const targetDate = new Date(date);
    const workHours = working_hours || { start: 9, end: 17 };
    const day = targetDate.getDay();
    
    // Check if weekend
    const isWeekend = day === 0 || day === 6;
    
    if (isWeekend) {
      return res.json({
        date: targetDate.toISOString(),
        is_weekend: true,
        working_hours: 0,
        working_minutes: 0
      });
    }
    
    const totalMinutes = (workHours.end - workHours.start) * 60;
    
    res.json({
      date: targetDate.toISOString(),
      is_weekend: false,
      working_hours: `${workHours.end - workHours.start}h`,
      working_minutes: totalMinutes,
      work_start: workHours.start,
      work_end: workHours.end
    });
  } catch (error) {
    console.error('Schedule working-hours daily error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /schedule/business-day/add - Add business days to a date
router.post('/business-day/add', async (req, res) => {
  try {
    const { date, days } = req.body;
    
    if (!date || days === undefined) {
      return res.status(400).json({ error: 'date and days are required' });
    }
    
    const startDate = new Date(date);
    let businessDaysAdded = 0;
    let currentDate = new Date(startDate);
    
    while (businessDaysAdded < days) {
      currentDate.setDate(currentDate.getDate() + 1);
      const day = currentDate.getDay();
      
      if (day !== 0 && day !== 6) {
        businessDaysAdded++;
      }
    }
    
    res.json({
      original: startDate.toISOString(),
      days_added: days,
      result: currentDate.toISOString()
    });
  } catch (error) {
    console.error('Schedule business-day add error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /schedule/business-day/subtract - Subtract business days from a date
router.post('/business-day/subtract', async (req, res) => {
  try {
    const { date, days } = req.body;
    
    if (!date || days === undefined) {
      return res.status(400).json({ error: 'date and days are required' });
    }
    
    const startDate = new Date(date);
    let businessDaysSubtracted = 0;
    let currentDate = new Date(startDate);
    
    while (businessDaysSubtracted < days) {
      currentDate.setDate(currentDate.getDate() - 1);
      const day = currentDate.getDay();
      
      if (day !== 0 && day !== 6) {
        businessDaysSubtracted++;
      }
    }
    
    res.json({
      original: startDate.toISOString(),
      days_subtracted: days,
      result: currentDate.toISOString()
    });
  } catch (error) {
    console.error('Schedule business-day subtract error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /schedule/business-day/count - Count business days between two dates
router.post('/business-day/count', async (req, res) => {
  try {
    const { start, end } = req.body;
    
    if (!start || !end) {
      return res.status(400).json({ error: 'start and end are required' });
    }
    
    const startDate = new Date(start);
    const endDate = new Date(end);
    let businessDays = 0;
    let currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const day = currentDate.getDay();
      if (day !== 0 && day !== 6) {
        businessDays++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    res.json({
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      business_days: businessDays
    });
  } catch (error) {
    console.error('Schedule business-day count error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /schedule/holiday/country - Lookup holidays by country code and year
router.post('/holiday/country', async (req, res) => {
  try {
    const { country_code, year } = req.body;
    
    if (!country_code) {
      return res.status(400).json({ error: 'country_code is required' });
    }
    
    const targetYear = year || new Date().getFullYear();
    
    // Simplified holiday data (in production, use a proper holiday API)
    const holidayData = {
      'US': [
        { name: 'New Year', date: `${targetYear}-01-01` },
        { name: 'Martin Luther King Jr. Day', date: `${targetYear}-01-15` },
        { name: 'Presidents Day', date: `${targetYear}-02-19` },
        { name: 'Memorial Day', date: `${targetYear}-05-27` },
        { name: 'Independence Day', date: `${targetYear}-07-04` },
        { name: 'Labor Day', date: `${targetYear}-09-02` },
        { name: 'Columbus Day', date: `${targetYear}-10-14` },
        { name: 'Veterans Day', date: `${targetYear}-11-11` },
        { name: 'Thanksgiving', date: `${targetYear}-11-28` },
        { name: 'Christmas', date: `${targetYear}-12-25` }
      ],
      'UK': [
        { name: 'New Year', date: `${targetYear}-01-01` },
        { name: 'Good Friday', date: `${targetYear}-03-29` },
        { name: 'Easter Monday', date: `${targetYear}-04-01` },
        { name: 'Early May Bank Holiday', date: `${targetYear}-05-06` },
        { name: 'Spring Bank Holiday', date: `${targetYear}-05-27` },
        { name: 'Summer Bank Holiday', date: `${targetYear}-08-26` },
        { name: 'Christmas Day', date: `${targetYear}-12-25` },
        { name: 'Boxing Day', date: `${targetYear}-12-26` }
      ],
      'DE': [
        { name: 'New Year', date: `${targetYear}-01-01` },
        { name: 'Good Friday', date: `${targetYear}-03-29` },
        { name: 'Easter Monday', date: `${targetYear}-04-01` },
        { name: 'Labor Day', date: `${targetYear}-05-01` },
        { name: 'Ascension Day', date: `${targetYear}-05-09` },
        { name: 'Whit Monday', date: `${targetYear}-05-20` },
        { name: 'German Unity Day', date: `${targetYear}-10-03` },
        { name: 'Christmas Day', date: `${targetYear}-12-25` },
        { name: 'Boxing Day', date: `${targetYear}-12-26` }
      ]
    };
    
    const holidays = holidayData[country_code.toUpperCase()] || [];
    
    res.json({
      country_code: country_code.toUpperCase(),
      year: targetYear,
      holidays,
      count: holidays.length
    });
  } catch (error) {
    console.error('Schedule holiday country error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /schedule/holiday/check - Check if a specific date is a holiday
router.post('/holiday/check', async (req, res) => {
  try {
    const { date, country_code } = req.body;
    
    if (!date) {
      return res.status(400).json({ error: 'date is required' });
    }
    
    const targetDate = new Date(date);
    const dateString = targetDate.toISOString().split('T')[0];
    const countryCode = country_code || 'US';
    
    // Simplified check (in production, use proper holiday API)
    const isHoliday = false; // Would check against holiday database
    const holidayName = null;
    
    res.json({
      date: dateString,
      country_code: countryCode.toUpperCase(),
      is_holiday: isHoliday,
      holiday_name: holidayName
    });
  } catch (error) {
    console.error('Schedule holiday check error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /schedule/weekend/check - Check if a date falls on weekend
router.post('/weekend/check', async (req, res) => {
  try {
    const { date } = req.body;
    
    if (!date) {
      return res.status(400).json({ error: 'date is required' });
    }
    
    const targetDate = new Date(date);
    const day = targetDate.getDay();
    const isWeekend = day === 0 || day === 6;
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day];
    
    res.json({
      date: targetDate.toISOString(),
      day_of_week: day,
      day_name: dayName,
      is_weekend: isWeekend
    });
  } catch (error) {
    console.error('Schedule weekend check error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /schedule/date/format - Format date to various string formats
router.post('/date/format', async (req, res) => {
  try {
    const { date, format } = req.body;
    
    if (!date) {
      return res.status(400).json({ error: 'date is required' });
    }
    
    const targetDate = new Date(date);
    
    const formats = {
      iso: targetDate.toISOString(),
      iso_date: targetDate.toISOString().split('T')[0],
      us: targetDate.toLocaleDateString('en-US'),
      european: targetDate.toLocaleDateString('en-GB'),
      unix: Math.floor(targetDate.getTime() / 1000),
      rfc2822: targetDate.toUTCString(),
      year: targetDate.getFullYear(),
      month: targetDate.getMonth() + 1,
      day: targetDate.getDate()
    };
    
    if (format && formats[format]) {
      res.json({ date: targetDate.toISOString(), format, result: formats[format] });
    } else {
      res.json({ date: targetDate.toISOString(), formats });
    }
  } catch (error) {
    console.error('Schedule date format error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /schedule/date/parse - Parse date string to timestamp
router.post('/date/parse', async (req, res) => {
  try {
    const { date_string } = req.body;
    
    if (!date_string) {
      return res.status(400).json({ error: 'date_string is required' });
    }
    
    const parsed = new Date(date_string);
    
    if (isNaN(parsed.getTime())) {
      return res.status(400).json({ error: 'invalid_date_string' });
    }
    
    res.json({
      input: date_string,
      parsed: parsed.toISOString(),
      unix_timestamp: Math.floor(parsed.getTime() / 1000),
      valid: true
    });
  } catch (error) {
    console.error('Schedule date parse error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /schedule/date/add - Add duration (days, hours, etc) to date
router.post('/date/add', async (req, res) => {
  try {
    const { date, days, hours, minutes, seconds } = req.body;
    
    if (!date) {
      return res.status(400).json({ error: 'date is required' });
    }
    
    const targetDate = new Date(date);
    
    if (days) targetDate.setDate(targetDate.getDate() + days);
    if (hours) targetDate.setHours(targetDate.getHours() + hours);
    if (minutes) targetDate.setMinutes(targetDate.getMinutes() + minutes);
    if (seconds) targetDate.setSeconds(targetDate.getSeconds() + seconds);
    
    res.json({
      original: date,
      added: { days, hours, minutes, seconds },
      result: targetDate.toISOString()
    });
  } catch (error) {
    console.error('Schedule date add error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /schedule/date/subtract - Subtract duration from date
router.post('/date/subtract', async (req, res) => {
  try {
    const { date, days, hours, minutes, seconds } = req.body;
    
    if (!date) {
      return res.status(400).json({ error: 'date is required' });
    }
    
    const targetDate = new Date(date);
    
    if (days) targetDate.setDate(targetDate.getDate() - days);
    if (hours) targetDate.setHours(targetDate.getHours() - hours);
    if (minutes) targetDate.setMinutes(targetDate.getMinutes() - minutes);
    if (seconds) targetDate.setSeconds(targetDate.getSeconds() - seconds);
    
    res.json({
      original: date,
      subtracted: { days, hours, minutes, seconds },
      result: targetDate.toISOString()
    });
  } catch (error) {
    console.error('Schedule date subtract error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /schedule/date/difference - Calculate difference between two dates
router.post('/date/difference', async (req, res) => {
  try {
    const { start, end, unit } = req.body;
    
    if (!start || !end) {
      return res.status(400).json({ error: 'start and end are required' });
    }
    
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffMs = endDate.getTime() - startDate.getTime();
    
    const differences = {
      milliseconds: diffMs,
      seconds: diffMs / 1000,
      minutes: diffMs / (1000 * 60),
      hours: diffMs / (1000 * 60 * 60),
      days: diffMs / (1000 * 60 * 60 * 24),
      weeks: diffMs / (1000 * 60 * 60 * 24 * 7)
    };
    
    if (unit && differences[unit]) {
      res.json({ start: startDate.toISOString(), end: endDate.toISOString(), unit, difference: differences[unit] });
    } else {
      res.json({ start: startDate.toISOString(), end: endDate.toISOString(), differences });
    }
  } catch (error) {
    console.error('Schedule date difference error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /schedule/recurring/next - Calculate next occurrence of recurring event
router.post('/recurring/next', async (req, res) => {
  try {
    const { start_date, frequency, interval } = req.body;
    
    if (!start_date || !frequency) {
      return res.status(400).json({ error: 'start_date and frequency are required' });
    }
    
    const startDate = new Date(start_date);
    const freq = frequency.toLowerCase();
    const int = interval || 1;
    
    const nextDate = new Date(startDate);
    
    switch (freq) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + int);
        break;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + (int * 7));
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + int);
        break;
      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + int);
        break;
      default:
        return res.status(400).json({ error: 'invalid_frequency', valid: ['daily', 'weekly', 'monthly', 'yearly'] });
    }
    
    res.json({
      start_date: startDate.toISOString(),
      frequency,
      interval: int,
      next_occurrence: nextDate.toISOString()
    });
  } catch (error) {
    console.error('Schedule recurring next error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /schedule/recurring/series - Generate series of recurring dates
router.post('/recurring/series', async (req, res) => {
  try {
    const { start_date, frequency, interval, count } = req.body;
    
    if (!start_date || !frequency || !count) {
      return res.status(400).json({ error: 'start_date, frequency, and count are required' });
    }
    
    const startDate = new Date(start_date);
    const freq = frequency.toLowerCase();
    const int = interval || 1;
    const series = [];
    
    let currentDate = new Date(startDate);
    
    for (let i = 0; i < count; i++) {
      series.push(currentDate.toISOString());
      
      switch (freq) {
        case 'daily':
          currentDate.setDate(currentDate.getDate() + int);
          break;
        case 'weekly':
          currentDate.setDate(currentDate.getDate() + (int * 7));
          break;
        case 'monthly':
          currentDate.setMonth(currentDate.getMonth() + int);
          break;
        case 'yearly':
          currentDate.setFullYear(currentDate.getFullYear() + int);
          break;
      }
    }
    
    res.json({
      start_date: startDate.toISOString(),
      frequency,
      interval: int,
      count,
      series
    });
  } catch (error) {
    console.error('Schedule recurring series error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
