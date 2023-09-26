import { CalendarArg, CalendarProtocol } from './calendar'
import { isoCalendarId } from './calendarConfig'
import { dateGetterNames } from './calendarFields'
import { queryCalendarOps } from './calendarOpsQuery'
import { CalendarOps } from './calendarOps'
import { getPublicCalendar } from './calendarPublic'
import {
  convertToPlainMonthDay,
  convertToPlainYearMonth,
  mergeZonedDateTimeBag,
  refineZonedDateTimeBag,
} from './convert'
import { diffZonedDateTimes } from './diff'
import { Duration, DurationArg, createDuration, toDurationSlots } from './duration'
import { negateDurationInternals } from './durationFields'
import { Instant, createInstant } from './instant'
import { LocalesArg, slotsToLocaleString } from './intlFormat'
import {
  IsoTimeFields,
  isoTimeFieldDefaults,
  pluckIsoTimeFields,
} from './isoFields'
import {
  CalendarPublic,
  IsoDateTimePublic,
  getPublicIdOrObj, pluckIsoDateInternals,
  pluckIsoDateTimeInternals
} from './isoInternals'
import {
  formatOffsetNano,
  formatZonedDateTimeIso,
} from './isoFormat'
import {
  checkEpochNanoInBounds,
} from './isoMath'
import { isZonedDateTimesEqual } from './equality'
import { parseZonedDateTime } from './isoParse'
import { moveZonedDateTime } from './move'
import {
  DiffOptions,
  EpochDisambig,
  OffsetDisambig,
  OverflowOptions,
  RoundingOptions,
  ZonedDateTimeDisplayOptions,
  ZonedFieldOptions,
  refineOverflowOptions,
  refineZonedFieldOptions,
} from './options'
import { PlainDate, PlainDateArg, createPlainDate, toPlainDateSlots } from './plainDate'
import { PlainDateTime, PlainDateTimeBag, PlainDateTimeMod, createPlainDateTime } from './plainDateTime'
import { PlainMonthDay, createPlainMonthDay } from './plainMonthDay'
import { PlainTime, PlainTimeArg, createPlainTime, toPlainTimeSlots } from './plainTime'
import { PlainYearMonth, createPlainYearMonth } from './plainYearMonth'
import { roundZonedDateTime } from './round'
import { TimeZoneArg, TimeZoneProtocol } from './timeZone'
import {
  computeNanosecondsInDay,
  getMatchingInstantFor,
  getPublicTimeZone,
  queryTimeZoneOps,
  zonedInternalsToIso,
} from './timeZoneOps'
import { UnitName, nanoInHour } from './units'
import { NumSign, defineGetters, defineProps, isObjectlike } from './utils'
import { bigIntToDayTimeNano, compareDayTimeNanos } from './dayTimeNano'
import { ensureString, toBigInt } from './cast'
import { DurationBranding, InstantBranding, PlainDateBranding, PlainDateTimeBranding, PlainMonthDayBranding, PlainTimeBranding, PlainYearMonthBranding, ZonedDateTimeBranding, ZonedDateTimeSlots, createCalendarIdGetterMethods, createEpochGetterMethods, createViaSlots, createZonedCalendarGetterMethods, createZonedTimeGetterMethods, getSlots, getSpecificSlots, neverValueOf, setSlots } from './slots'

export type ZonedDateTimeBag = PlainDateTimeBag & { timeZone: TimeZoneArg, offset?: string }
export type ZonedDateTimeMod = PlainDateTimeMod
export type ZonedDateTimeArg = ZonedDateTime | ZonedDateTimeBag | string

// TODO: make DRY with TimeZoneArg (it's a subset)
export type TimeZonePublic = TimeZoneProtocol | string
export type ZonedPublic = IsoDateTimePublic & { timeZone: TimeZonePublic, offset: string }

export class ZonedDateTime {
  constructor(
    epochNano: bigint,
    timeZoneArg: TimeZoneArg,
    calendarArg: CalendarArg = isoCalendarId,
  ) {
    setSlots(this, {
      branding: ZonedDateTimeBranding,
      epochNanoseconds: checkEpochNanoInBounds(bigIntToDayTimeNano(toBigInt(epochNano))),
      timeZone: queryTimeZoneOps(timeZoneArg), // TODO: validate string/object somehow?
      calendar: queryCalendarOps(calendarArg),
    } as ZonedDateTimeSlots)
  }

  with(mod: ZonedDateTimeMod, options?: ZonedFieldOptions): ZonedDateTime {
    getZonedDateTimeSlots(this) // validate `this`
    return createZonedDateTime({
      branding: ZonedDateTimeBranding,
      ...mergeZonedDateTimeBag(this, mod, options)
    })
  }

  withPlainTime( plainTimeArg?: PlainTimeArg): ZonedDateTime {
    const slots = getZonedDateTimeSlots(this)
    const { calendar, timeZone } = slots
    const isoFields = {
      ...zonedInternalsToIso(slots),
      ...optionalToPlainTimeFields(plainTimeArg),
    }

    const epochNano = getMatchingInstantFor(
      timeZone,
      isoFields,
      isoFields.offsetNanoseconds,
      false, // hasZ
      OffsetDisambig.Prefer, // OffsetDisambig
      undefined, // EpochDisambig
      false, // fuzzy
    )

    return createZonedDateTime({
      branding: ZonedDateTimeBranding,
      epochNanoseconds: epochNano,
      timeZone,
      calendar,
    })
  }

  // TODO: more DRY with withPlainTime and zonedDateTimeWithBag?
  withPlainDate(plainDateArg: PlainDateArg): ZonedDateTime {
    const slots = getZonedDateTimeSlots(this)
    const { timeZone } = slots
    const plainDateSlots = toPlainDateSlots(plainDateArg)
    const isoFields = {
      ...zonedInternalsToIso(slots),
      ...plainDateSlots,
    }

    const epochNano = getMatchingInstantFor(
      timeZone,
      isoFields,
      isoFields.offsetNanoseconds,
      false, // hasZ
      OffsetDisambig.Prefer, // OffsetDisambig
      undefined, // EpochDisambig
      false, // fuzzy
    )

    return createZonedDateTime({
      branding: ZonedDateTimeBranding,
      epochNanoseconds: epochNano,
      timeZone,
      // TODO: more DRY with other datetime types
      calendar: getPreferredCalendar(plainDateSlots.calendar, slots.calendar),
    })
  }

  withTimeZone(timeZoneArg: TimeZoneArg): ZonedDateTime {
    return createZonedDateTime({
      ...getZonedDateTimeSlots(this),
      timeZone: queryTimeZoneOps(timeZoneArg),
    })
  }

  withCalendar(calendarArg: CalendarArg): ZonedDateTime {
    return createZonedDateTime({
      ...getZonedDateTimeSlots(this),
      calendar: queryCalendarOps(calendarArg),
    })
  }

  add(durationArg: DurationArg, options?: OverflowOptions): ZonedDateTime {
    return createZonedDateTime({
      branding: ZonedDateTimeBranding,
      ...moveZonedDateTime(
        getZonedDateTimeSlots(this),
        toDurationSlots(durationArg),
        refineOverflowOptions(options),
      ),
    })
  }

  subtract(durationArg: DurationArg, options?: OverflowOptions): ZonedDateTime {
    return createZonedDateTime({
      branding: ZonedDateTimeBranding,
      ...moveZonedDateTime(
        getZonedDateTimeSlots(this),
        negateDurationInternals(toDurationSlots(durationArg)),
        refineOverflowOptions(options),
      ),
    })
  }

  until(otherArg: ZonedDateTimeArg, options?: DiffOptions): Duration {
    return createDuration({
      branding: DurationBranding,
      ...diffZonedDateTimes(getZonedDateTimeSlots(this), toZonedDateTimeSlots(otherArg), options)
    })
  }

  since(otherArg: ZonedDateTimeArg, options?: DiffOptions): Duration {
    return createDuration({
      branding: DurationBranding,
      ...diffZonedDateTimes(getZonedDateTimeSlots(this), toZonedDateTimeSlots(otherArg), options, true)
    })
  }

  /*
  Do param-list destructuring here and other methods!
  */
  round(options: RoundingOptions | UnitName): ZonedDateTime {
    return createZonedDateTime({
      branding: ZonedDateTimeBranding,
      ...roundZonedDateTime(getZonedDateTimeSlots(this), options)
    })
  }

  startOfDay(): ZonedDateTime {
    const slots = getZonedDateTimeSlots(this)
    let { epochNanoseconds, timeZone, calendar } = slots

    const isoFields = {
      ...zonedInternalsToIso(slots),
      ...isoTimeFieldDefaults,
    }

    epochNanoseconds = getMatchingInstantFor(
      timeZone,
      isoFields,
      undefined, // offsetNanoseconds
      false, // z
      OffsetDisambig.Reject,
      EpochDisambig.Compat,
      true, // fuzzy
    )

    return createZonedDateTime({
      branding: ZonedDateTimeBranding,
      epochNanoseconds,
      timeZone,
      calendar,
    })
  }

  equals(otherArg: ZonedDateTimeArg): boolean {
    return isZonedDateTimesEqual(getZonedDateTimeSlots(this), toZonedDateTimeSlots(otherArg))
  }

  // TODO: more DRY with Instant::toString
  toString(options?: ZonedDateTimeDisplayOptions): string {
    return formatZonedDateTimeIso(getZonedDateTimeSlots(this), options)
  }

  toJSON(): string {
    return formatZonedDateTimeIso(getZonedDateTimeSlots(this))
  }

  toLocaleString(locales: LocalesArg, options: Intl.DateTimeFormatOptions = {}) {
    const slots = getZonedDateTimeSlots(this)

    // Copy options so accessing doesn't cause side-effects
    // TODO: stop this from happening twice, in slotsToLocaleString too
    options = { ...options }

    if ('timeZone' in options) {
      throw new TypeError('Cannot specify TimeZone')
    }

    return slotsToLocaleString(slots, locales, options)
  }

  toInstant(): Instant {
    return createInstant({
      branding: InstantBranding,
      epochNanoseconds: getZonedDateTimeSlots(this).epochNanoseconds
    })
  }

  toPlainDate(): PlainDate {
    return createPlainDate({
      branding: PlainDateBranding,
      ...pluckIsoDateInternals(zonedInternalsToIso(getZonedDateTimeSlots(this)))
    })
  }

  toPlainTime(): PlainTime {
    return createPlainTime({
      branding: PlainTimeBranding,
      ...pluckIsoTimeFields(zonedInternalsToIso(getZonedDateTimeSlots(this)))
    })
  }

  toPlainDateTime(): PlainDateTime {
    return createPlainDateTime({
      branding: PlainDateTimeBranding,
      ...pluckIsoDateTimeInternals(zonedInternalsToIso(getZonedDateTimeSlots(this))),
    })
  }

  toPlainYearMonth(): PlainYearMonth {
    getZonedDateTimeSlots(this) // validate `this` // TODO: make sure all other classes do same
    return createPlainYearMonth({
      branding: PlainYearMonthBranding,
      ...convertToPlainYearMonth(this),
    })
  }

  toPlainMonthDay(): PlainMonthDay {
    getZonedDateTimeSlots(this) // validate `this`
    return createPlainMonthDay({
      branding: PlainMonthDayBranding,
      ...convertToPlainMonthDay(this),
    })
  }

  getISOFields(): ZonedPublic {
    const slots = getZonedDateTimeSlots(this)
    return {
      ...pluckIsoDateTimeInternals(zonedInternalsToIso(slots)),
      // alphabetical
      calendar: getPublicIdOrObj(slots.calendar) as CalendarPublic,
      offset: formatOffsetNano(
        // TODO: more DRY
        zonedInternalsToIso(slots).offsetNanoseconds,
      ),
      timeZone: getPublicIdOrObj(slots.timeZone) as TimeZonePublic,
    }
  }

  getCalendar(): CalendarProtocol {
    return getPublicCalendar(getZonedDateTimeSlots(this))
  }

  getTimeZone(): TimeZoneProtocol {
    return getPublicTimeZone(getZonedDateTimeSlots(this))
  }

  get hoursInDay(): number {
    const slots = getZonedDateTimeSlots(this)
    return computeNanosecondsInDay(
      slots.timeZone,
      zonedInternalsToIso(slots),
    ) / nanoInHour
  }

  // TODO: more DRY
  get offsetNanoseconds(): number {
    return zonedInternalsToIso(getZonedDateTimeSlots(this)).offsetNanoseconds
  }

  // TODO: more DRY
  get offset(): string {
    return formatOffsetNano(
      zonedInternalsToIso(getZonedDateTimeSlots(this)).offsetNanoseconds,
    )
  }

  get timeZoneId(): string {
    return getZonedDateTimeSlots(this).timeZone.id
  }

  static from(arg: any, options?: ZonedFieldOptions) {
    return createZonedDateTime(toZonedDateTimeSlots(arg, options))
  }

  static compare(arg0: ZonedDateTimeArg, arg1: ZonedDateTimeArg): NumSign {
    return compareDayTimeNanos(
      toZonedDateTimeSlots(arg0).epochNanoseconds,
      toZonedDateTimeSlots(arg1).epochNanoseconds,
    )
  }
}

defineProps(ZonedDateTime.prototype, {
  [Symbol.toStringTag]: 'Temporal.' + ZonedDateTimeBranding,
  valueOf: neverValueOf,
})

defineGetters(ZonedDateTime.prototype, {
  ...createCalendarIdGetterMethods(ZonedDateTimeBranding),
  ...createZonedCalendarGetterMethods(ZonedDateTimeBranding, dateGetterNames),
  ...createZonedTimeGetterMethods(ZonedDateTimeBranding),
  ...createEpochGetterMethods(ZonedDateTimeBranding),
})

// Utils
// -------------------------------------------------------------------------------------------------

export function createZonedDateTime(slots: ZonedDateTimeSlots): ZonedDateTime {
  return createViaSlots(ZonedDateTime, slots)
}

export function getZonedDateTimeSlots(zonedDateTime: ZonedDateTime): ZonedDateTimeSlots {
  return getSpecificSlots(ZonedDateTimeBranding, zonedDateTime) as ZonedDateTimeSlots
}

export function toZonedDateTimeSlots(arg: ZonedDateTimeArg, options?: ZonedFieldOptions): ZonedDateTimeSlots {
  if (isObjectlike(arg)) {
    const slots = getSlots(arg)
    if (slots && slots.branding === ZonedDateTimeBranding) {
      refineZonedFieldOptions(options) // parse unused options
      return slots as ZonedDateTimeSlots
    }
    return { ...refineZonedDateTimeBag(arg as any, options), branding: ZonedDateTimeBranding }
  }
  refineZonedFieldOptions(options) // parse unused options
  return { ...parseZonedDateTime(ensureString(arg), options), branding: ZonedDateTimeBranding }
}

// TODO: DRY
function optionalToPlainTimeFields(timeArg: PlainTimeArg | undefined): IsoTimeFields {
  return timeArg === undefined ? isoTimeFieldDefaults : toPlainTimeSlots(timeArg)
}

// TODO: DRY
// similar to checkCalendarsCompatible
// `a` takes precedence if both the same ID
function getPreferredCalendar(a: CalendarOps, b: CalendarOps): CalendarOps {
  // fast path. doesn't read IDs
  if (a === b) {
    return a
  }

  const aId = a.id
  const bId = b.id

  if (aId !== isoCalendarId) {
    if (aId !== bId && bId !== isoCalendarId) {
      throw new RangeError('Incompatible calendars')
    }

    return a
  }

  return b
}
