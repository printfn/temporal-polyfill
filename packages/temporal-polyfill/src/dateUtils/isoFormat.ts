import {
  CALENDAR_DISPLAY_ALWAYS,
  CALENDAR_DISPLAY_NEVER,
  CalendarDisplayInt,
} from '../argParse/calendarDisplay'
import { DurationToStringConfig, TimeToStringConfig } from '../argParse/isoFormatOptions'
import { TIME_ZONE_DISPLAY_NEVER, TimeZoneDisplayInt } from '../argParse/timeZoneDisplay'
import { isoCalendarID } from '../calendarImpl/isoCalendarImpl'
import { TimeISOEssentials, nanoToWrappedTimeFields, timeISOToNano } from '../dateUtils/time'
import { DateISOFields, DateTimeISOFields } from '../public/types'
import { roundToIncrementBI } from '../utils/math'
import { getSignStr, padZeros } from '../utils/string'
import { addWholeDays } from './add'
import { nanoToDayTimeFields } from './dayTime'
import { SignedDurationFields } from './duration'
import { HOUR, MINUTE, SECOND, nanoInMicro, nanoInMilli } from './units'

export function formatDateTimeISO(
  fields: DateTimeISOFields,
  formatConfig: TimeToStringConfig,
): string {
  const [timePart, dayDelta] = formatTimeISO(fields, formatConfig)
  return formatDateISO(addWholeDays(fields, dayDelta)) + 'T' + timePart
}

export function formatDateISO(fields: DateISOFields): string {
  return formatYearMonthISO(fields) + '-' + padZeros(fields.isoDay, 2)
}

export function formatYearMonthISO(fields: DateISOFields): string {
  const { isoYear } = fields
  return (
    (isoYear < 1000 || isoYear > 9999)
      ? getSignStr(isoYear) + padZeros(Math.abs(isoYear), 6)
      : padZeros(isoYear, 4)
  ) + '-' + padZeros(fields.isoMonth, 2)
}

export function formatMonthDayISO(fields: DateISOFields): string {
  return padZeros(fields.isoMonth, 2) + '-' + padZeros(fields.isoDay, 2)
}

export function formatTimeISO(
  fields: TimeISOEssentials,
  formatConfig: TimeToStringConfig,
): [string, number] {
  const nano = roundToIncrementBI(
    timeISOToNano(fields),
    formatConfig.roundingIncrement,
    formatConfig.roundingMode,
  )

  const [roundedFields, dayDelta] = nanoToWrappedTimeFields(nano)
  const parts: string[] = [padZeros(roundedFields.hour, 2)]

  if (formatConfig.smallestUnit <= MINUTE) {
    parts.push(padZeros(roundedFields.minute, 2))

    if (formatConfig.smallestUnit <= SECOND) {
      parts.push(
        padZeros(roundedFields.second, 2) +
          formatPartialSeconds(
            roundedFields.millisecond,
            roundedFields.microsecond,
            roundedFields.nanosecond,
            formatConfig.fractionalSecondDigits,
          ),
      )
    }
  }

  return [parts.join(':'), dayDelta]
}

export function formatOffsetISO(offsetNano: number): string {
  const fields = nanoToDayTimeFields(BigInt(Math.abs(offsetNano)), HOUR) // TODO: cleaner util
  return getSignStr(offsetNano) +
    padZeros(fields.hour!, 2) + ':' +
    padZeros(fields.minute!, 2) +
    (fields.second
      ? ':' + padZeros(fields.second, 2)
      : '')
}

export function formatCalendarID(
  calendarID: string | undefined,
  display: CalendarDisplayInt,
): string {
  if (
    calendarID && ( // might be blank if custom calendar implementation
      display === CALENDAR_DISPLAY_ALWAYS ||
      (display !== CALENDAR_DISPLAY_NEVER && calendarID !== isoCalendarID)
    )
  ) {
    return `[u-ca=${calendarID}]`
  }
  return ''
}

export function formatTimeZoneID(timeZoneID: string, display: TimeZoneDisplayInt): string {
  if (display !== TIME_ZONE_DISPLAY_NEVER) {
    return `[${timeZoneID}]`
  }
  return ''
}

export function formatDurationISO(
  fields: SignedDurationFields,
  formatConfig: DurationToStringConfig,
): string {
  const { smallestUnit, fractionalSecondDigits } = formatConfig
  const { sign, hours, minutes, seconds } = fields
  const partialSecondsStr = smallestUnit < SECOND
    ? formatPartialSeconds(
      fields.milliseconds,
      fields.microseconds,
      fields.nanoseconds,
      fractionalSecondDigits,
    )
    : ''
  return (sign < 0 ? '-' : '') + 'P' +
    collapseDurationTuples([
      [fields.years, 'Y'],
      [fields.months, 'M'],
      [fields.weeks, 'W'],
      [fields.days, 'D', !sign], // ensures 'P0D' if empty duration
    ]) +
    (hours || minutes || seconds || partialSecondsStr
      ? 'T' +
      collapseDurationTuples([
        [hours, 'H'],
        [minutes, 'M'],
        [
          smallestUnit <= SECOND ? seconds : 0,
          partialSecondsStr + 'S',
          partialSecondsStr, // ensures seconds if partialSecondsStr
        ],
      ])
      : '')
}

function collapseDurationTuples(tuples: [number, string, unknown?][]): string {
  return tuples.map(([num, postfix, forceShow]) => {
    if (forceShow || num) {
      return Math.abs(num) + postfix
    }
    return ''
  }).join('')
}

function formatPartialSeconds(
  milliseconds: number,
  microseconds: number,
  nanoseconds: number,
  fractionalSecondDigits: number | undefined,
): string {
  const totalNano = Math.abs( // abs() in case of negative duration fields
    nanoseconds +
    microseconds * nanoInMicro +
    milliseconds * nanoInMilli,
  )

  let afterDecimal = padZeros(totalNano, 9)
  afterDecimal = fractionalSecondDigits === undefined
    ? afterDecimal.replace(/0+$/, '') // strip trailing zeros
    : afterDecimal.substr(0, fractionalSecondDigits)

  return afterDecimal ? '.' + afterDecimal : ''
}
