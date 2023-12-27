import { isoCalendarId } from '../internal/calendarConfig'
import { DateTimeBag, DateTimeFields, EraYearFields } from '../internal/calendarFields'
import { ensureString } from '../internal/cast'
import { diffPlainDateTimes } from '../internal/diff'
import { IsoDateTimeFields, refineIsoDateTimeArgs } from '../internal/calendarIsoFields'
import { formatDateTimeIso, formatPlainDateTimeIso } from '../internal/formatIso'
import { compareIsoDateTimeFields } from '../internal/epochAndTime'
import { parsePlainDateTime } from '../internal/parseIso'
import { movePlainDateTime } from '../internal/move'
import { roundPlainDateTime } from '../internal/round'
import { DiffOptions, OverflowOptions, prepareOptions, refineDateTimeDisplayOptions } from '../internal/optionsRefine'
import { DurationSlots, IdLike, PlainDateSlots, PlainDateTimeBranding, PlainDateTimeSlots, PlainTimeSlots, getPreferredCalendarSlot } from '../internal/slots'
import { DateModOps, DateRefineOps, DiffOps, MoveOps } from '../internal/calendarOps'
import { DurationFields } from '../internal/durationFields'
import { negateDuration } from '../internal/durationMath'
import { mergePlainDateTimeBag, refinePlainDateTimeBag } from '../internal/bag'
import { plainDateTimesEqual } from '../internal/compare'
import { plainDateTimeToPlainDate, plainDateTimeToPlainMonthDay, plainDateTimeToPlainTime, plainDateTimeToPlainYearMonth, plainDateTimeToZonedDateTime } from '../internal/convert'

export function create<CA, C>(
  refineCalendarArg: (calendarArg: CA) => C,
  isoYear: number,
  isoMonth: number,
  isoDay: number,
  isoHour: number = 0, isoMinute: number = 0, isoSecond: number = 0,
  isoMillisecond: number = 0, isoMicrosecond: number = 0, isoNanosecond: number = 0,
  calendarArg: CA = isoCalendarId as any,
): IsoDateTimeFields & { calendar: C, branding: typeof PlainDateTimeBranding } {
  return {
    ...refineIsoDateTimeArgs(
      isoYear, isoMonth, isoDay,
      isoHour, isoMinute, isoSecond,
      isoMillisecond, isoMicrosecond, isoNanosecond,
    ),
    calendar: refineCalendarArg(calendarArg),
    branding: PlainDateTimeBranding,
  }
}

export function fromString(s: string): PlainDateTimeSlots<string> {
  return {
    ...parsePlainDateTime(ensureString(s)),
    branding: PlainDateTimeBranding,
  }
}

export function fromFields<C>(
  getCalendarOps: (calendarSlot: C) => DateRefineOps<C>,
  calendarSlot: C,
  fields: DateTimeBag,
  options?: OverflowOptions,
): PlainDateTimeSlots<C> {
  const calendarOps = getCalendarOps(calendarSlot)

  return {
    ...refinePlainDateTimeBag(calendarOps, fields, options),
    branding: PlainDateTimeBranding,
  }
}

export function withFields<C>(
  getCalendarOps: (calendarSlot: C) => DateModOps<C>,
  plainDateTimeSlots: PlainDateTimeSlots<C>,
  initialFields: DateTimeFields & Partial<EraYearFields>,
  modFields: DateTimeBag,
  options?: OverflowOptions,
): PlainDateTimeSlots<C> {
  const optionsCopy = prepareOptions(options)
  const calendarSlot = plainDateTimeSlots.calendar
  const calendarOps = getCalendarOps(calendarSlot)

  return {
    ...mergePlainDateTimeBag(
      calendarOps,
      initialFields,
      modFields,
      optionsCopy,
    ),
    branding: PlainDateTimeBranding,
  }
}

export function withPlainTime<C>(
  plainDateTimeSlots: PlainDateTimeSlots<C>,
  plainTimeSlots: PlainTimeSlots,
): PlainDateTimeSlots<C> {
  return {
    ...plainDateTimeSlots,
    ...plainTimeSlots,
    branding: PlainDateTimeBranding,
  }
}

export function withPlainDate<C extends IdLike>(
  plainDateTimeSlots: PlainDateTimeSlots<C>,
  plainDateSlots: PlainDateSlots<C>,
) {
  return {
    ...plainDateTimeSlots,
    ...plainDateSlots,
    // TODO: more DRY with other datetime types
    calendar: getPreferredCalendarSlot(plainDateTimeSlots.calendar, plainDateSlots.calendar),
    branding: PlainDateTimeBranding,
  }
}

// TODO: reusable function across types
export function withCalendar<C>(
  plainDateTimeSlots: PlainDateTimeSlots<C>,
  calendarSlot: C,
): PlainDateTimeSlots<C> {
  return { ...plainDateTimeSlots, calendar: calendarSlot }
}

export const add = movePlainDateTime

export function subtract<C>(
  getCalendarOps: (calendarSlot: C) => MoveOps,
  plainDateTimeSlots: PlainDateTimeSlots<C>,
  durationSlots: DurationFields,
  options?: OverflowOptions,
): PlainDateTimeSlots<C> {
  return add(getCalendarOps, plainDateTimeSlots, negateDuration(durationSlots), options)
}

export function until<C extends IdLike>(
  getCalendarOps: (calendarSlot: C) => DiffOps,
  plainDateTimeSlots0: PlainDateTimeSlots<C>,
  plainDateTimeSlots1: PlainDateTimeSlots<C>,
  options?: DiffOptions,
): DurationSlots {
  return diffPlainDateTimes(getCalendarOps, plainDateTimeSlots0, plainDateTimeSlots1, options)
}

export function since<C extends IdLike>(
  getCalendarOps: (calendarSlot: C) => DiffOps,
  plainDateTimeSlots0: PlainDateTimeSlots<C>,
  plainDateTimeSlots1: PlainDateTimeSlots<C>,
  options?: DiffOptions,
): DurationSlots {
  return diffPlainDateTimes(getCalendarOps, plainDateTimeSlots0, plainDateTimeSlots1, options, true)
}

export const round = roundPlainDateTime

export const compare = compareIsoDateTimeFields

export const equals = plainDateTimesEqual

export const toString = formatPlainDateTimeIso

export function toJSON<C extends IdLike>(
  plainDateTimeSlots0: PlainDateTimeSlots<C>,
): string {
  return formatDateTimeIso(plainDateTimeSlots0.calendar, plainDateTimeSlots0, ...refineDateTimeDisplayOptions(undefined))
}

export const toZonedDateTime = plainDateTimeToZonedDateTime
export const toPlainDate = plainDateTimeToPlainDate
export const toPlainYearMonth = plainDateTimeToPlainYearMonth
export const toPlainMonthDay = plainDateTimeToPlainMonthDay
export const toPlainTime = plainDateTimeToPlainTime
