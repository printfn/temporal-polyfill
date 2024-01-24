import { DateTimeBag } from '../internal/calendarFields'
import { LocalesArg } from '../internal/formatIntl'
import { formatOffsetNano, formatZonedDateTimeIso } from '../internal/formatIso'
import {
  DiffOptions,
  OverflowOptions,
  RoundingOptions,
  ZonedDateTimeDisplayOptions,
  ZonedFieldOptions,
  copyOptions,
  refineZonedFieldOptions,
} from '../internal/optionsRefine'
import { UnitName } from '../internal/units'
import { NumSign, bindArgs, isObjectLike, mapProps } from '../internal/utils'
import { IsoDateTimeFields } from '../internal/calendarIsoFields'
import { ZonedIsoFields, computeHoursInDay, computeStartOfDay, buildZonedIsoFields, zonedEpochSlotsToIso, FixedIsoFields } from '../internal/timeZoneOps'
import { ZonedDateTimeBranding, ZonedDateTimeSlots, createDurationSlots, getId } from '../internal/slots'
import { createSlotClass, getSlots, rejectInvalidBag } from './slotsForClasses'
import { CalendarSlot, getCalendarSlotFromBag, refineCalendarSlot } from './slotsForClasses'
import { TimeZoneSlot, refineTimeZoneSlot } from './slotsForClasses'
import { CalendarArg } from './calendar'
import { Duration, DurationArg, createDuration, toDurationSlots } from './duration'
import { Instant, createInstant } from './instant'
import { PlainDate, PlainDateArg, createPlainDate, toPlainDateSlots } from './plainDate'
import { PlainDateTime, createPlainDateTime } from './plainDateTime'
import { PlainMonthDay, createPlainMonthDay } from './plainMonthDay'
import { PlainTime, PlainTimeArg, createPlainTime } from './plainTime'
import { PlainYearMonth, createPlainYearMonth } from './plainYearMonth'
import { TimeZone, TimeZoneArg } from './timeZone'
import { TimeZoneProtocol } from './timeZoneProtocol'
import { neverValueOf, dateGetters, timeGetters, epochGetters, getCalendarFromSlots, calendarIdGetters } from './mixins'
import { optionalToPlainTimeFields } from './utils'
import { createDateModOps, createDateRefineOps, createDiffOps, createMonthDayRefineOps, createMoveOps, createYearMonthRefineOps } from './calendarOpsQuery'
import { createTimeZoneOffsetOps, createTimeZoneOps } from './timeZoneOpsQuery'
import { ZonedDateTimeBag, refineZonedDateTimeBag, zonedDateTimeWithFields } from '../internal/bag'
import { constructZonedDateTimeSlots } from '../internal/construct'
import { slotsWithCalendar, slotsWithTimeZone, zonedDateTimeWithPlainDate, zonedDateTimeWithPlainTime } from '../internal/mod'
import { moveZonedDateTime } from '../internal/move'
import { diffZonedDateTimes } from '../internal/diff'
import { roundZonedDateTime } from '../internal/round'
import { compareZonedDateTimes, zonedDateTimesEqual } from '../internal/compare'
import { zonedDateTimeToInstant, zonedDateTimeToPlainDate, zonedDateTimeToPlainDateTime, zonedDateTimeToPlainMonthDay, zonedDateTimeToPlainTime, zonedDateTimeToPlainYearMonth } from '../internal/convert'
import { parseZonedDateTime } from '../internal/parseIso'
import { prepZonedDateTimeFormat } from './dateTimeFormat'

export type ZonedDateTime = any
export type ZonedDateTimeArg = ZonedDateTime | ZonedDateTimeBag<CalendarArg, TimeZoneArg> | string

export const [ZonedDateTime, createZonedDateTime] = createSlotClass(
  ZonedDateTimeBranding,
  bindArgs(constructZonedDateTimeSlots, refineCalendarSlot, refineTimeZoneSlot),
  {
    ...epochGetters,
    ...calendarIdGetters,
    ...adaptDateMethods(dateGetters),
    ...adaptDateMethods(timeGetters),
    hoursInDay(slots: ZonedDateTimeSlots<CalendarSlot, TimeZoneSlot>): number {
      return computeHoursInDay(createTimeZoneOps, slots)
    },
    offsetNanoseconds(slots: ZonedDateTimeSlots<CalendarSlot, TimeZoneSlot>) {
      return slotsToIso(slots).offsetNanoseconds
    },
    offset(slots: ZonedDateTimeSlots<CalendarSlot, TimeZoneSlot>): string {
      return formatOffsetNano(slotsToIso(slots).offsetNanoseconds)
    },
    timeZoneId(slots: ZonedDateTimeSlots<CalendarSlot, TimeZoneSlot>): string {
      return getId(slots.timeZone)
    },
  },
  {
    with(slots: ZonedDateTimeSlots<CalendarSlot, TimeZoneSlot>, mod: DateTimeBag, options?: ZonedFieldOptions): ZonedDateTime {
      return createZonedDateTime(
        zonedDateTimeWithFields(createDateModOps, createTimeZoneOps, slots, this, rejectInvalidBag(mod), options),
      )
    },
    withPlainTime(slots: ZonedDateTimeSlots<CalendarSlot, TimeZoneSlot>, plainTimeArg?: PlainTimeArg): ZonedDateTime {
      return createZonedDateTime(
        zonedDateTimeWithPlainTime(createTimeZoneOps, slots, optionalToPlainTimeFields(plainTimeArg))
      )
    },
    withPlainDate(slots: ZonedDateTimeSlots<CalendarSlot, TimeZoneSlot>, plainDateArg: PlainDateArg): ZonedDateTime {
      return createZonedDateTime(
        zonedDateTimeWithPlainDate(createTimeZoneOps, slots, toPlainDateSlots(plainDateArg))
      )
    },
    withTimeZone(slots: ZonedDateTimeSlots<CalendarSlot, TimeZoneSlot>, timeZoneArg: TimeZoneArg): ZonedDateTime {
      return createZonedDateTime(
        slotsWithTimeZone(slots, refineTimeZoneSlot(timeZoneArg))
      )
    },
    withCalendar(slots: ZonedDateTimeSlots<CalendarSlot, TimeZoneSlot>, calendarArg: CalendarArg): ZonedDateTime {
      return createZonedDateTime(
        slotsWithCalendar(slots, refineCalendarSlot(calendarArg))
      )
    },
    add(slots: ZonedDateTimeSlots<CalendarSlot, TimeZoneSlot>, durationArg: DurationArg, options?: OverflowOptions): ZonedDateTime {
      return createZonedDateTime(
        moveZonedDateTime(
          createMoveOps,
          createTimeZoneOps,
          false,
          slots,
          toDurationSlots(durationArg),
          options,
        )
      )
    },
    subtract(slots: ZonedDateTimeSlots<CalendarSlot, TimeZoneSlot>, durationArg: DurationArg, options?: OverflowOptions): ZonedDateTime {
      return createZonedDateTime(
        moveZonedDateTime(
          createMoveOps,
          createTimeZoneOps,
          true,
          slots,
          toDurationSlots(durationArg),
          options,
        )
      )
    },
    until(slots: ZonedDateTimeSlots<CalendarSlot, TimeZoneSlot>, otherArg: ZonedDateTimeArg, options?: DiffOptions): Duration {
      return createDuration(
        createDurationSlots(
          diffZonedDateTimes(
            createDiffOps,
            createTimeZoneOps,
            false,
            slots,
            toZonedDateTimeSlots(otherArg),
            options,
          ),
        )
      )
    },
    since(slots: ZonedDateTimeSlots<CalendarSlot, TimeZoneSlot>, otherArg: ZonedDateTimeArg, options?: DiffOptions): Duration {
      return createDuration(
        createDurationSlots(
          diffZonedDateTimes(
            createDiffOps,
            createTimeZoneOps,
            true,
            slots,
            toZonedDateTimeSlots(otherArg),
            options,
          ),
        )
      )
    },
    round(slots: ZonedDateTimeSlots<CalendarSlot, TimeZoneSlot>, options: RoundingOptions | UnitName): ZonedDateTime {
      return createZonedDateTime(
        roundZonedDateTime(createTimeZoneOps, slots, options)
      )
    },
    startOfDay(slots: ZonedDateTimeSlots<CalendarSlot, TimeZoneSlot>): ZonedDateTime {
      return createZonedDateTime(
        computeStartOfDay(createTimeZoneOps, slots)
      )
    },
    equals(slots: ZonedDateTimeSlots<CalendarSlot, TimeZoneSlot>, otherArg: ZonedDateTimeArg): boolean {
      return zonedDateTimesEqual(slots, toZonedDateTimeSlots(otherArg))
    },
    toString(slots: ZonedDateTimeSlots<CalendarSlot, TimeZoneSlot>, options?: ZonedDateTimeDisplayOptions): string {
      return formatZonedDateTimeIso(createTimeZoneOffsetOps, slots, options)
    },
    toJSON(slots: ZonedDateTimeSlots<CalendarSlot, TimeZoneSlot>): string {
      return formatZonedDateTimeIso(createTimeZoneOffsetOps, slots)
    },
    toLocaleString(slots: ZonedDateTimeSlots<CalendarSlot, TimeZoneSlot>, locales: LocalesArg, options: Intl.DateTimeFormatOptions = {}): string {
      const [format, epochMilli] = prepZonedDateTimeFormat(locales, options, slots)
      return format.format(epochMilli)
    },
    toInstant(slots: ZonedDateTimeSlots<CalendarSlot, TimeZoneSlot>): Instant {
      return createInstant(
        zonedDateTimeToInstant(slots)
      )
    },
    toPlainDate(slots: ZonedDateTimeSlots<CalendarSlot, TimeZoneSlot>): PlainDate {
      return createPlainDate(
        zonedDateTimeToPlainDate(createTimeZoneOffsetOps, slots)
      )
    },
    toPlainTime(slots: ZonedDateTimeSlots<CalendarSlot, TimeZoneSlot>): PlainTime {
      return createPlainTime(
        zonedDateTimeToPlainTime(createTimeZoneOffsetOps, slots)
      )
    },
    toPlainDateTime(slots: ZonedDateTimeSlots<CalendarSlot, TimeZoneSlot>): PlainDateTime {
      return createPlainDateTime(
        zonedDateTimeToPlainDateTime(createTimeZoneOffsetOps, slots)
      )
    },
    toPlainYearMonth(slots: ZonedDateTimeSlots<CalendarSlot, TimeZoneSlot>): PlainYearMonth {
      return createPlainYearMonth(
        zonedDateTimeToPlainYearMonth(createYearMonthRefineOps, slots, this)
      )
    },
    toPlainMonthDay(slots: ZonedDateTimeSlots<CalendarSlot, TimeZoneSlot>): PlainMonthDay {
      return createPlainMonthDay(
        zonedDateTimeToPlainMonthDay(createMonthDayRefineOps, slots, this)
      )
    },
    getISOFields(slots: ZonedDateTimeSlots<CalendarSlot, TimeZoneSlot>): ZonedIsoFields<CalendarSlot, TimeZoneSlot> {
      return buildZonedIsoFields(createTimeZoneOffsetOps, slots)
    },
    getCalendar: getCalendarFromSlots,
    getTimeZone({ timeZone }: ZonedDateTimeSlots<CalendarSlot, TimeZoneSlot>): TimeZoneProtocol {
      return typeof timeZone === 'string'
        ? new TimeZone(timeZone)
        : timeZone
    },
    valueOf: neverValueOf,
  },
  {
    from(arg: any, options?: ZonedFieldOptions) {
      return createZonedDateTime(toZonedDateTimeSlots(arg, options))
    },
    compare(arg0: ZonedDateTimeArg, arg1: ZonedDateTimeArg): NumSign {
      return compareZonedDateTimes(
        toZonedDateTimeSlots(arg0),
        toZonedDateTimeSlots(arg1),
      )
    }
  }
)

// Utils
// -------------------------------------------------------------------------------------------------

export function toZonedDateTimeSlots(arg: ZonedDateTimeArg, options?: ZonedFieldOptions): ZonedDateTimeSlots<CalendarSlot, TimeZoneSlot> {
  options = copyOptions(options)

  if (isObjectLike(arg)) {
    const slots = getSlots(arg)

    if (slots && slots.branding === ZonedDateTimeBranding) {
      refineZonedFieldOptions(options) // parse unused options
      return slots as ZonedDateTimeSlots<CalendarSlot, TimeZoneSlot>
    }

    const calendarSlot = getCalendarSlotFromBag(arg as any)

    return refineZonedDateTimeBag(
      refineTimeZoneSlot,
      createTimeZoneOps,
      createDateRefineOps(calendarSlot),
      calendarSlot,
      arg as any, // !!!
      options,
    )
  }

  return parseZonedDateTime(arg, options)
}

function slotsToIso(
  slots: ZonedDateTimeSlots<CalendarSlot, TimeZoneSlot>
): FixedIsoFields<CalendarSlot> {
  return zonedEpochSlotsToIso(slots, createTimeZoneOffsetOps)
}

function adaptDateMethods(methods: any) {
  return mapProps(
    (method: any) => {
      return (slots: ZonedDateTimeSlots<CalendarSlot, TimeZoneSlot>) => {
        return method(slotsToIso(slots))
      }
    },
    methods,
  )
}
