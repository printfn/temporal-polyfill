import { OverflowHandlingInt } from '../argParse/overflowHandling'
import { constrainInt } from '../argParse/refine'
import { CalendarImpl } from '../calendarImpl/calendarImpl'
import { Duration } from '../public/duration'
import { DateISOFields } from '../public/types'
import { DateEssentials, DateISOEssentials } from './date'
import { extractDurationTimeFields } from './duration'
import { addDaysMilli, epochMilliToISOFields, isoFieldsToEpochMilli } from './isoMath'

export function addToDateFields(
  dateFields: DateEssentials,
  duration: Duration,
  calendarImpl: CalendarImpl,
  overflowHandling: OverflowHandlingInt,
): DateISOEssentials {
  dateFields = addWholeYears(dateFields, duration.years, calendarImpl, overflowHandling)
  dateFields = addWholeMonths(dateFields, duration.months, calendarImpl, overflowHandling)

  let epochMilli = calendarImpl.epochMilliseconds(dateFields.year, dateFields.month, dateFields.day)

  const [, bigDuration] = extractDurationTimeFields(duration)
  epochMilli = addDaysMilli(
    epochMilli,
    bigDuration.weeks * 7 + bigDuration.days,
  )

  return epochMilliToISOFields(epochMilli)
}

export function addWholeYears(
  { year, month, day }: DateEssentials,
  yearsToAdd: number,
  calendarImpl: CalendarImpl,
  overflowHandling: OverflowHandlingInt,
): DateEssentials {
  year += yearsToAdd
  const newMonth = constrainInt(month, 1, calendarImpl.monthsInYear(year), overflowHandling)
  const newDay = month === newMonth ? day : 1 // month was constrained? reset day
  return { year, month: newMonth, day: newDay }
}

export function addWholeMonths(
  { year, month, day }: DateEssentials,
  monthsToAdd: number,
  calendarImpl: CalendarImpl,
  overflowHandling: OverflowHandlingInt,
): DateEssentials {
  if (monthsToAdd) {
    month += monthsToAdd

    if (monthsToAdd < 0) {
      while (month < 1) {
        month += calendarImpl.monthsInYear(--year)
      }
    } else {
      let monthsInYear
      while (month > (monthsInYear = calendarImpl.monthsInYear(year))) {
        month -= monthsInYear
        year++
      }
    }

    day = constrainInt(day, 1, calendarImpl.daysInMonth(year, month), overflowHandling)
  }
  return { year, month, day }
}

// Unlike the other utils, this functions accepts and returns a DateISOFields object,
// which contains a CALENDAR.
export function addWholeDays(
  fields: DateISOFields,
  days: number,
): DateISOFields {
  if (days) {
    return {
      ...epochMilliToISOFields(addDaysMilli(isoFieldsToEpochMilli(fields), days)),
      calendar: fields.calendar,
    }
  }
  return fields
}
