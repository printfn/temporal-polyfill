import { isoCalendarId, japaneseCalendarId } from './calendarConfig'
import { DateBag, DateTimeBag, DayFields, DurationBag, EraYearOrYear, MonthDayBag, MonthDayFields, MonthFields, TimeBag, TimeFields, YearFields, YearMonthBag, allYearFieldNames, dateFieldNamesAlpha, dayFieldNames, eraYearFieldNames, monthCodeDayFieldNames, monthDayFieldNames, monthFieldNames, offsetFieldNames, timeAndOffsetFieldNames, timeAndZoneFieldNames, timeFieldDefaults, timeFieldNamesAlpha, timeFieldNamesAsc, timeZoneFieldNames, yearFieldNames, yearMonthCodeFieldNames, yearMonthFieldNames } from './calendarFields'
import { computeIsoDaysInMonth, isoMonthsInYear } from './calendarIso'
import { NativeDateRefineDeps, NativeMonthDayRefineOps, NativeYearMonthRefineDeps, eraYearToYear, getCalendarEraOrigins, getCalendarLeapMonthMeta, monthCodeNumberToMonth, monthToMonthCodeNumber, parseMonthCode } from './calendarNative'
import { IsoDateTimeFields, IsoTimeFields, isoTimeFieldDefaults, isoTimeFieldNamesAsc } from './calendarIsoFields'
import { isoEpochFirstLeapYear, constrainIsoTimeFields } from './calendarIso'
import { checkIsoDateInBounds, checkIsoDateTimeInBounds, checkIsoYearMonthInBounds } from './epochAndTime'
import { EpochDisambig, OffsetDisambig, Overflow } from './options'
import { BoundArg, Callable, bindArgs, clampEntity, clampProp, getDefinedProp, mapPropNamesToConstant, pluckProps, remapProps } from './utils'
import { OverflowOptions, ZonedFieldOptions, overflowMapNames, overrideOverflowOptions, copyOptions, refineOverflowOptions, refineZonedFieldOptions } from './optionsRefine'
import { DurationFields, durationFieldDefaults, durationFieldNamesAlpha, durationFieldNamesAsc } from './durationFields'
import { TimeZoneOps, getMatchingInstantFor } from './timeZoneOps'
import { DayTimeNano } from './dayTimeNano'
import { DateModOps, DateRefineOps, FieldsOp, MergeFieldsOp, MonthDayModOps, MonthDayRefineOps, YearMonthModOps, YearMonthRefineOps } from './calendarOps'
import { parseOffsetNano } from './parseIso'
import { requireNumberIsPositive, requireObjectlike, toInteger, toPositiveInteger, toStrictInteger, toStringViaPrimitive } from './cast'
import { MarkerSlotsNoCalendar, checkDurationFields } from './durationMath'
import { DateSlots, DurationBranding, DurationSlots, PlainDateBranding, PlainDateSlots, PlainDateTimeBranding, PlainDateTimeSlots, PlainMonthDayBranding, PlainMonthDaySlots, PlainTimeBranding, PlainTimeSlots, PlainYearMonthBranding, PlainYearMonthSlots, ZonedDateTimeBranding, ZonedDateTimeSlots, createDurationSlots, createPlainDateTimeSlots, createPlainDateSlots, createPlainMonthDaySlots, createPlainTimeSlots, createPlainYearMonthSlots, createZonedDateTimeSlots } from './slots'
import * as errorMessages from './errorMessages'

export type PlainDateBag<C> = DateBag & { calendar?: C }
export type PlainDateTimeBag<C> = DateBag & TimeBag & { calendar?: C }
export type ZonedDateTimeBag<C, T> = PlainDateTimeBag<C> & { timeZone: T, offset?: string }
export type PlainTimeBag = TimeBag
export type PlainYearMonthBag<C> = YearMonthBag & { calendar?: C }
export type PlainMonthDayBag<C> = MonthDayBag & { calendar?: C }

// Config
// -------------------------------------------------------------------------------------------------

const dateFieldRefiners = {
  era: toStringViaPrimitive,
  eraYear: toInteger,
  year: toInteger,
  month: toPositiveInteger,
  monthCode: toStringViaPrimitive,
  day: toPositiveInteger,
}

const timeFieldRefiners = mapPropNamesToConstant(timeFieldNamesAsc, toInteger)

const durationFieldRefiners = mapPropNamesToConstant(durationFieldNamesAsc, toStrictInteger)

const builtinRefiners = {
  ...dateFieldRefiners,
  ...timeFieldRefiners,
  ...durationFieldRefiners,
  offset: toStringViaPrimitive,
}

// High-Level Refining
// -------------------------------------------------------------------------------------------------

export function refineMaybeZonedDateTimeBag<C, TA, T>(
  refineTimeZoneArg: (timeZoneArg: TA) => T,
  getTimeZoneOps: (timeZoneArg: T) => TimeZoneOps,
  calendarOps: DateRefineOps<C>,
  bag: ZonedDateTimeBag<unknown, TA>,
): MarkerSlotsNoCalendar<T> {
  const fields = refineCalendarFields(
    calendarOps,
    bag,
    dateFieldNamesAlpha, // validFieldNames
    [], // requireFields
    timeAndZoneFieldNames, // forcedValidFieldNames
  ) as ZonedDateTimeBag<unknown, TA>

  if (fields.timeZone !== undefined) {
    const isoDateFields = calendarOps.dateFromFields(fields as any)
    const isoTimeFields = refineTimeBag(fields)

    // must happen after datetime fields
    const timeZoneSlot = refineTimeZoneArg(fields.timeZone)
    const timeZoneOps = getTimeZoneOps(timeZoneSlot)

    const epochNanoseconds = getMatchingInstantFor(
      timeZoneOps,
      { ...isoDateFields, ...isoTimeFields },
      fields.offset !== undefined ? parseOffsetNano(fields.offset) : undefined,
    )

    return { epochNanoseconds, timeZone: timeZoneSlot }
  } else {
    const isoDateInternals = calendarOps.dateFromFields(fields as any)
    return { ...isoDateInternals, ...isoTimeFieldDefaults }
  }
}

export function refineZonedDateTimeBag<C, TA, T>(
  refineTimeZoneArg: (timeZoneArg: TA) => T,
  getTimeZoneOps: (timeZoneSlot: T) => TimeZoneOps,
  calendarOps: DateRefineOps<C>,
  calendarSlot: C,
  bag: ZonedDateTimeBag<unknown, TA>,
  options: ZonedFieldOptions | undefined,
): ZonedDateTimeSlots<C, T> {
  const fields = refineCalendarFields(
    calendarOps,
    bag,
    dateFieldNamesAlpha, // validFieldNames
    timeZoneFieldNames, // requireFields
    timeAndZoneFieldNames, // forcedValidFieldNames
  ) as ZonedDateTimeBag<unknown, TA>

  const timeZoneSlot = refineTimeZoneArg(fields.timeZone!) // guaranteed via refineCalendarFields
  const [overflow, offsetDisambig, epochDisambig] = refineZonedFieldOptions(options)
  const isoDateFields = calendarOps.dateFromFields(
    fields as any,
    overrideOverflowOptions(options, overflow),
  )
  const isoTimeFields = refineTimeBag(fields, overflow)
  const timeZoneOps = getTimeZoneOps(timeZoneSlot)

  const epochNanoseconds = getMatchingInstantFor(
    timeZoneOps,
    { ...isoDateFields, ...isoTimeFields },
    fields.offset !== undefined ? parseOffsetNano(fields.offset) : undefined,
    offsetDisambig,
    epochDisambig,
  )

  return createZonedDateTimeSlots(
    epochNanoseconds,
    timeZoneSlot,
    calendarSlot,
  )
}

export function refinePlainDateTimeBag<C>(
  calendarOps: DateRefineOps<C>,
  bag: DateTimeBag,
  options: OverflowOptions | undefined,
): PlainDateTimeSlots<C> {
  const fields = refineCalendarFields(
    calendarOps,
    bag,
    dateFieldNamesAlpha,
    [], // requiredFields
    timeFieldNamesAsc, // forcedValidFieldNames
  ) as DateTimeBag

  const overflow = refineOverflowOptions(options)
  const isoDateInternals = calendarOps.dateFromFields(
    fields as any,
    overrideOverflowOptions(options, overflow),
  )
  const isoTimeFields = refineTimeBag(fields, overflow)

  const isoFields = checkIsoDateTimeInBounds({
    ...isoDateInternals,
    ...isoTimeFields,
  })

  return createPlainDateTimeSlots(isoFields)
}

export function refinePlainDateBag<C>(
  calendarOps: DateRefineOps<C>,
  bag: DateBag,
  options: OverflowOptions | undefined,
  requireFields: string[] = [],
): PlainDateSlots<C> {
  const fields = refineCalendarFields(
    calendarOps,
    bag,
    dateFieldNamesAlpha,
    requireFields,
  )

  return calendarOps.dateFromFields(fields as any, options)
}

export function refinePlainYearMonthBag<C>(
  calendarOps: YearMonthRefineOps<C>,
  bag: YearMonthBag,
  options: OverflowOptions | undefined,
  requireFields?: string[],
): PlainYearMonthSlots<C> {
  const fields = refineCalendarFields(
    calendarOps,
    bag,
    yearMonthFieldNames,
    requireFields,
  )

  return calendarOps.yearMonthFromFields(fields, options)
}

export function refinePlainMonthDayBag<C>(
  calendarOps: MonthDayRefineOps<C>,
  calendarAbsent: boolean,
  bag: MonthDayBag,
  options?: OverflowOptions,
  requireFields: string[] = [], // when called from Calendar
): PlainMonthDaySlots<C> {
  const fields = refineCalendarFields(
    calendarOps,
    bag,
    dateFieldNamesAlpha,
    requireFields,
  )

  // Callers who omit the calendar are not writing calendar-independent
  // code. In that case, `monthCode`/`year` can be omitted; `month` and
  // `day` are sufficient. Add a `year` to satisfy calendar validation.
  if (calendarAbsent && fields.month !== undefined && fields.monthCode === undefined && fields.year === undefined) {
    fields.year = isoEpochFirstLeapYear
  }

  return calendarOps.monthDayFromFields(fields, options)
}

export function refinePlainTimeBag(
  bag: TimeBag,
  options?: OverflowOptions, // optional b/c func API can use directly
): PlainTimeSlots {
  const overflow = refineOverflowOptions(options) // spec says overflow parsed first
  const fields = refineFields(bag, timeFieldNamesAlpha, [], true) as TimeBag // disallowEmpty

  return createPlainTimeSlots(refineTimeBag(fields, overflow))
}

export function refineDurationBag(bag: DurationBag): DurationSlots {
  // refine in 'partial' mode
  const durationFields = refineFields(bag, durationFieldNamesAlpha) as DurationBag

  return createDurationSlots(
    checkDurationFields({
      ...durationFieldDefaults,
      ...durationFields
    }),
  )
}

// Low-level Refining
// -------------------------------------------------------------------------------------------------

function refineCalendarFields(
  calendarOps: { fields: FieldsOp },
  bag: Record<string, unknown>,
  validFieldNames: string[], // does NOT need to be alphabetized
  requiredFieldNames: string[] = [], // a subset of validFieldNames
  forcedValidFieldNames: string[] = [],
): Record<string, unknown> {
  const fieldNames = [
    ...calendarOps.fields(validFieldNames),
    ...forcedValidFieldNames,
  ].sort()

  return refineFields(bag, fieldNames, requiredFieldNames)
}

/*
If `requiredFieldNames` is undefined, assume 'partial' mode where defaults don't apply
*/
function refineFields(
  bag: Record<string, unknown>,
  validFieldNames: string[], // must be alphabetized!!!
  requiredFieldNames?: string[],
  disallowEmpty: boolean = !requiredFieldNames,
): Record<string, unknown> {
  const res: Record<string, unknown> = {}
  let anyMatching = false
  let prevFieldName: undefined | string

  for (const fieldName of validFieldNames) {
    if (fieldName === prevFieldName) {
      throw new RangeError(errorMessages.duplicateFields(fieldName))
    }
    if (fieldName === 'constructor' || fieldName === '__proto__') {
      throw new RangeError(errorMessages.forbiddenField(fieldName))
    }

    let fieldVal = bag[fieldName]

    if (fieldVal !== undefined) {
      anyMatching = true

      if (builtinRefiners[fieldName as keyof typeof builtinRefiners]) {
        fieldVal = (builtinRefiners[fieldName as keyof typeof builtinRefiners] as Callable)(fieldVal, fieldName)
      }

      res[fieldName] = fieldVal
    } else if (requiredFieldNames) {
      if (requiredFieldNames.includes(fieldName)) { // TODO: have caller use a Set
        throw new TypeError(errorMessages.missingField(fieldName))
      }

      res[fieldName] = timeFieldDefaults[fieldName as keyof typeof timeFieldDefaults]
    }

    prevFieldName = fieldName
  }

  // only check zero fields during .with() calls
  // for .from() calls, empty-bag-checking will happen within the CalendarImpl
  if (disallowEmpty && !anyMatching) {
    throw new TypeError(errorMessages.noValidFields)
  }

  return res
}

function refineTimeBag(fields: TimeBag, overflow?: Overflow): IsoTimeFields {
  return constrainIsoTimeFields(
    timeFieldsToIso({ ...timeFieldDefaults, ...fields }),
    overflow,
  )
}

const timeFieldsToIso = bindArgs(
  remapProps<TimeFields, IsoTimeFields>,
  timeFieldNamesAsc,
  isoTimeFieldNamesAsc,
)

export const isoTimeFieldsToCal = bindArgs(
  remapProps<IsoTimeFields, TimeFields>,
  isoTimeFieldNamesAsc,
  timeFieldNamesAsc,
)

// High-Level Mod
// -------------------------------------------------------------------------------------------------

export function zonedDateTimeWithFields<C, T>(
  getCalendarOps: (calendarSlot: C) => DateModOps<C>,
  getTimeZoneOps: (timeZoneSlot: T) => TimeZoneOps,
  zonedDateTimeSlots: ZonedDateTimeSlots<C, T>,
  initialFields: DateTimeBag,
  modFields: DateTimeBag,
  options?: ZonedFieldOptions,
): ZonedDateTimeSlots<C, T> {
  const optionsCopy = copyOptions(options)
  const { calendar, timeZone } = zonedDateTimeSlots
  const calendarOps = getCalendarOps(calendar)
  const timeZoneOps = getTimeZoneOps(timeZone)

  return createZonedDateTimeSlots(
    mergeZonedDateTimeBag(
      calendarOps,
      timeZoneOps,
      initialFields,
      modFields,
      optionsCopy,
    ),
    timeZone,
    calendar,
  )
}

export function plainDateTimeWithFields<C>(
  getCalendarOps: (calendarSlot: C) => DateModOps<C>,
  plainDateTimeSlots: PlainDateTimeSlots<C>,
  initialFields: DateTimeBag,
  modFields: DateTimeBag,
  options?: OverflowOptions,
): PlainDateTimeSlots<C> {
  const optionsCopy = copyOptions(options)
  const calendarSlot = plainDateTimeSlots.calendar
  const calendarOps = getCalendarOps(calendarSlot)

  return createPlainDateTimeSlots(
    mergePlainDateTimeBag(
      calendarOps,
      initialFields,
      modFields,
      optionsCopy,
    ),
  )
}

export function plainDateWithFields<C>(
  getCalendarOps: (calendarSlot: C) => DateModOps<C>,
  plainDateSlots: PlainDateSlots<C>,
  initialFields: DateBag,
  modFields: DateBag,
  options?: OverflowOptions,
): PlainDateSlots<C> {
  const optionsCopy = copyOptions(options)
  const calendarSlot = plainDateSlots.calendar
  const calendarOps = getCalendarOps(calendarSlot)

  return mergePlainDateBag(calendarOps, initialFields, modFields, optionsCopy)
}

export function plainYearMonthWithFields<C>(
  getCalendarOps: (calendar: C) => YearMonthModOps<C>,
  plainYearMonthSlots: PlainYearMonthSlots<C>,
  initialFields: YearMonthBag,
  mod: YearMonthBag,
  options?: OverflowOptions,
): PlainYearMonthSlots<C> {
  const optionsCopy = copyOptions(options)
  const calendarSlot = plainYearMonthSlots.calendar
  const calendarOps = getCalendarOps(calendarSlot)

  return createPlainYearMonthSlots(
    mergePlainYearMonthBag(calendarOps, initialFields, mod, optionsCopy)
  )
}

export function plainMonthDayWithFields<C>(
  getCalendarOps: (calendarSlot: C) => MonthDayModOps<C>,
  plainMonthDaySlots: PlainMonthDaySlots<C>,
  initialFields: MonthDayFields,
  modFields: MonthDayBag,
  options?: OverflowOptions,
): PlainMonthDaySlots<C> {
  const optionsCopy = copyOptions(options)
  const calendarSlot = plainMonthDaySlots.calendar
  const calendarOps = getCalendarOps(calendarSlot)

  return mergePlainMonthDayBag(calendarOps, initialFields, modFields, optionsCopy)
}

export function plainTimeWithFields(
  initialFields: TimeFields,
  mod: TimeBag,
  options?: OverflowOptions,
): PlainTimeSlots {
  return createPlainTimeSlots(mergePlainTimeBag(initialFields, mod, options))
}

export function durationWithFields(
  slots: DurationSlots,
  fields: DurationBag,
): DurationSlots {
  return createDurationSlots(
    mergeDurationBag(slots, fields),
  )
}

// Low-Level Mod ("merging")
// -------------------------------------------------------------------------------------------------

function mergeZonedDateTimeBag<C>(
  calendarOps: DateModOps<C>,
  timeZoneOps: TimeZoneOps,
  zonedDateTime: any,
  mod: DateTimeBag, // TODO: allow offset. correct base type tho?
  options: ZonedFieldOptions | undefined,
): DayTimeNano {
  const fields = mergeCalendarFields(
    calendarOps,
    zonedDateTime as any,
    mod,
    dateFieldNamesAlpha, // validFieldNames
    timeAndOffsetFieldNames, // forcedValidFieldNames
    offsetFieldNames, // requiredObjFieldNames
  ) as ZonedDateTimeBag<unknown, unknown>

  const [overflow, offsetDisambig, epochDisambig] = refineZonedFieldOptions(options, OffsetDisambig.Prefer)
  const isoDateFields = calendarOps.dateFromFields(
    fields as any,
    overrideOverflowOptions(options, overflow),
  )
  const isoTimeFields = refineTimeBag(fields, overflow)

  return getMatchingInstantFor(
    timeZoneOps,
    { ...isoDateFields, ...isoTimeFields },
    parseOffsetNano(fields.offset!), // guaranteed via mergeCalendarFields
    offsetDisambig,
    epochDisambig,
  )
}

function mergePlainDateTimeBag<C>(
  calendarOps: DateModOps<C>,
  plainDateTime: any,
  mod: DateTimeBag,
  options: OverflowOptions | undefined,
): IsoDateTimeFields & { calendar: C } {
  const fields = mergeCalendarFields(
    calendarOps,
    plainDateTime,
    mod,
    dateFieldNamesAlpha, // validFieldNames
    timeFieldNamesAsc, // forcedValidFieldNames
  ) as DateTimeBag

  const overflow = refineOverflowOptions(options)
  const isoDateInternals = calendarOps.dateFromFields(
    fields as any,
    overrideOverflowOptions(options, overflow),
  )
  const isoTimeFields = refineTimeBag(fields, overflow)

  return checkIsoDateTimeInBounds({
    ...isoDateInternals,
    ...isoTimeFields,
  })
}

function mergePlainDateBag<C>(
  calendarOps: DateModOps<C>,
  plainDate: any,
  mod: DateBag,
  options: OverflowOptions | undefined,
): PlainDateSlots<C> {
  const fields = mergeCalendarFields(
    calendarOps,
    plainDate,
    mod,
    dateFieldNamesAlpha,
  )

  return calendarOps.dateFromFields(fields as any, options)
}

function mergePlainYearMonthBag<C>(
  calendarOps: YearMonthModOps<C>,
  plainYearMonth: any,
  bag: YearMonthBag,
  options: OverflowOptions | undefined,
): PlainYearMonthSlots<C> {
  const fields = mergeCalendarFields(
    calendarOps,
    plainYearMonth,
    bag,
    yearMonthFieldNames,
  )

  return calendarOps.yearMonthFromFields(fields, options)
}

function mergePlainMonthDayBag<C>(
  calendarOps: MonthDayModOps<C>,
  plainMonthDay: any,
  bag: MonthDayBag,
  options: OverflowOptions | undefined,
): PlainMonthDaySlots<C> {
  const fields = mergeCalendarFields(
    calendarOps,
    plainMonthDay,
    bag,
    dateFieldNamesAlpha,
  )

  return calendarOps.monthDayFromFields(fields, options)
}

function mergePlainTimeBag(
  plainTime: any,
  bag: TimeBag,
  options: OverflowOptions | undefined,
): IsoTimeFields {
  const overflow = refineOverflowOptions(options) // spec says overflow parsed first
  const origFields = pluckProps(timeFieldNamesAlpha, plainTime)
  const newFields = refineFields(bag, timeFieldNamesAlpha)
  const mergedFields = { ...origFields, ...newFields }

  return refineTimeBag(mergedFields, overflow)
}

function mergeDurationBag(
  durationFields: DurationFields,
  bag: DurationBag
): DurationFields {
  const newFields = refineFields(bag, durationFieldNamesAlpha)
  const mergedFields = { ...durationFields, ...newFields }

  return checkDurationFields(mergedFields)
}

function mergeCalendarFields(
  calendarOps: { fields: FieldsOp, mergeFields: MergeFieldsOp },
  obj: Record<string, unknown>,
  bag: Record<string, unknown>,
  validFieldNames: string[], // does NOT need to be alphabetized
  forcedValidFieldNames: string[] = [],
  requiredObjFieldNames: string[] = [],
): Record<string, unknown> {
  const fieldNames = [
    ...calendarOps.fields(validFieldNames),
    ...forcedValidFieldNames
  ].sort()

  let fields = refineFields(obj, fieldNames, requiredObjFieldNames)
  const partialFields = refineFields(bag, fieldNames)

  fields = calendarOps.mergeFields(fields, partialFields)
  return refineFields(fields, fieldNames, []) // guard against ridiculous .mergeField results
}

// Conversion that involves bags
// -------------------------------------------------------------------------------------------------

export function convertToPlainMonthDay<C>(
  calendarOps: MonthDayRefineOps<C>,
  input: any,
): PlainMonthDaySlots<C> {
  const fields = refineCalendarFields(
    calendarOps,
    input as any,
    monthCodeDayFieldNames,
  )

  return calendarOps.monthDayFromFields(fields)
}

export function convertToPlainYearMonth<C>(
  calendarOps: YearMonthRefineOps<C>,
  input: any,
  options?: OverflowOptions,
): PlainYearMonthSlots<C> {
  const fields = refineCalendarFields(
    calendarOps,
    input as any,
    yearMonthCodeFieldNames,
  )

  return calendarOps.yearMonthFromFields(fields, options)
}

/*
Responsible for ensuring bag is an object. Best place?
*/
export function convertPlainMonthDayToDate<C>(
  calendarOps: DateModOps<C>,
  plainMonthDay: any,
  bag: YearFields,
): PlainDateSlots<C> {
  return convertToIso(
    calendarOps,
    plainMonthDay, // input
    monthCodeDayFieldNames, // inputFieldNames
    requireObjectlike(bag), // extra
    yearFieldNames, // extraFieldNames
  )
}

/*
Responsible for ensuring bag is an object. Best place?
*/
export function convertPlainYearMonthToDate<C>(
  calendarOps: DateModOps<C>,
  plainYearMonth: any,
  bag: DayFields,
): PlainDateSlots<C> {
  return convertToIso(
    calendarOps,
    plainYearMonth, // input
    yearMonthCodeFieldNames, // inputFieldNames
    requireObjectlike(bag), // extra
    dayFieldNames, // extraFieldNames
  )
}

function convertToIso<C>(
  calendarOps: DateModOps<C>,
  input: any,
  inputFieldNames: string[], // must be alphabetized!!!
  extra: {},
  extraFieldNames: string[], // must be alphabetized!!!
): PlainDateSlots<C> {
  inputFieldNames = calendarOps.fields(inputFieldNames)
  input = pluckProps(inputFieldNames, input as Record<string, unknown>)

  extraFieldNames = calendarOps.fields(extraFieldNames)
  extra = refineFields(extra, extraFieldNames, [])

  let mergedFields = calendarOps.mergeFields(input, extra)
  mergedFields = refineFields(mergedFields, [...inputFieldNames, ...extraFieldNames].sort(), [])

  return calendarOps.dateFromFields(mergedFields as any)
}

// Native *-from-fields
// -------------------------------------------------------------------------------------------------

export function nativeDateFromFields(
  this: NativeDateRefineDeps,
  fields: DateBag,
  options?: OverflowOptions,
): PlainDateSlots<string> {
  const overflow = refineOverflowOptions(options)
  const year = refineYear(this, fields)
  const month = refineMonth(this, fields, year, overflow)
  const day = refineDay(this, fields as DayFields, month, year, overflow)
  const isoFields = this.isoFields(year, month, day)

  return createPlainDateSlots(
    checkIsoDateInBounds(isoFields),
    this.id || isoCalendarId,
  )
}

export function nativeYearMonthFromFields(
  this: NativeYearMonthRefineDeps,
  fields: YearMonthBag,
  options?: OverflowOptions,
): PlainYearMonthSlots<string> {
  const overflow = refineOverflowOptions(options)
  const year = refineYear(this, fields)
  const month = refineMonth(this, fields, year, overflow)
  const isoFields = this.isoFields(year, month, 1)

  return createPlainYearMonthSlots(
    checkIsoYearMonthInBounds(isoFields),
    this.id || isoCalendarId,
  )
}

export function nativeMonthDayFromFields(
  this: NativeMonthDayRefineOps,
  fields: DateBag,
  options?: OverflowOptions
): PlainMonthDaySlots<string> {
  const overflow = refineOverflowOptions(options)
  let isIso = !this.id
  let { monthCode, year, month } = fields as DateBag
  let monthCodeNumber: number
  let isLeapMonth: boolean
  let normalYear: number | undefined
  let normalMonth: number | undefined
  let normalDay: number

  if (monthCode !== undefined) {
    [monthCodeNumber, isLeapMonth] = parseMonthCode(monthCode)
    normalDay = getDefinedProp(fields, 'day')

    // query calendar for year/month
    const res = this.yearMonthForMonthDay(monthCodeNumber, isLeapMonth, normalDay)
    if (!res) { throw new RangeError(errorMessages.failedYearGuess) }
    [normalYear, normalMonth] = res

    // monthCode conflicts with month?
    if (month !== undefined && month !== normalMonth) {
      throw new RangeError(errorMessages.mismatchingMonthAndCode)
    }

    // constrain (what refineMonth/refineDay would normally do)
    if (isIso) {
      normalMonth = clampEntity('month', normalMonth, 1, isoMonthsInYear, Overflow.Reject) // reject because never leap months
      normalDay = clampEntity('day', normalDay, 1, computeIsoDaysInMonth(year !== undefined ? year : normalYear, normalMonth), overflow)
    }
  } else {
    // refine year/month/day
    normalYear = (year === undefined && isIso) ? isoEpochFirstLeapYear : refineYear(this, fields as EraYearOrYear)
    normalMonth = refineMonth(this, fields, normalYear, overflow)
    normalDay = refineDay(this, fields as DayFields, normalMonth, normalYear, overflow)

    // compute monthCode
    const leapMonth = this.leapMonth(normalYear)
    isLeapMonth = normalMonth === leapMonth
    monthCodeNumber = monthToMonthCodeNumber(normalMonth, leapMonth)

    // query calendar for normalized year/month
    const res = this.yearMonthForMonthDay(monthCodeNumber, isLeapMonth, normalDay)
    if (!res) { throw new RangeError(errorMessages.failedYearGuess) }
    [normalYear, normalMonth] = res
  }

  return createPlainMonthDaySlots(
    this.isoFields(normalYear, normalMonth, normalDay),
    this.id || isoCalendarId,
  )
}

export function nativeFieldsMethod(
  this: NativeYearMonthRefineDeps,
  fieldNames: string[],
): string[] {
  if (getCalendarEraOrigins(this) && fieldNames.includes('year')) {
    return [...fieldNames, ...eraYearFieldNames]
  }
  return fieldNames
}

export function nativeMergeFields(
  this: NativeYearMonthRefineDeps,
  baseFields: Record<string, unknown>,
  additionalFields: Record<string, unknown>
): Record<string, unknown> {
  const merged = Object.assign(Object.create(null), baseFields)

  spliceFields(merged, additionalFields, monthFieldNames)

  if (getCalendarEraOrigins(this)) {
    spliceFields(merged, additionalFields, allYearFieldNames)

    // eras begin mid-year?
    if (this.id === japaneseCalendarId) {
      spliceFields(
        merged,
        additionalFields,
        monthDayFieldNames, // any found?
        eraYearFieldNames, // then, delete these
      )
    }
  }

  return merged
}

// Low-level Native Utils
// -------------------------------------------------------------------------------------------------

function refineYear(
  calendarNative: NativeYearMonthRefineDeps,
  fields: DateBag
): number {
  let { era, eraYear, year } = fields
  const eraOrigins = getCalendarEraOrigins(calendarNative)

  if (era !== undefined || eraYear !== undefined) {
    if (era === undefined || eraYear === undefined) {
      throw new TypeError(errorMessages.mismatchingEraParts)
    }

    if (!eraOrigins) {
      throw new RangeError(errorMessages.forbiddenEraParts)
    }

    const eraOrigin = eraOrigins[era]
    if (eraOrigin === undefined) {
      throw new RangeError(errorMessages.invalidEra(era))
    }

    const yearByEra = eraYearToYear(eraYear, eraOrigin)
    if (year !== undefined && year !== yearByEra) {
      throw new RangeError(errorMessages.mismatchingYearAndEra)
    }

    year = yearByEra
  } else if (year === undefined) {
    throw new TypeError(errorMessages.missingYear(eraOrigins))
  }

  return year
}

function refineMonth(
  calendarNative: NativeYearMonthRefineDeps,
  fields: Partial<MonthFields>,
  year: number,
  overflow: Overflow
): number {
  let { month, monthCode } = fields

  if (monthCode !== undefined) {
    const monthByCode = refineMonthCode(calendarNative, monthCode, year, overflow)

    if (month !== undefined && month !== monthByCode) {
      throw new RangeError(errorMessages.mismatchingMonthAndCode)
    }

    month = monthByCode
    overflow = Overflow.Reject // monthCode parsing doesn't constrain
  } else if (month === undefined) {
    throw new TypeError(errorMessages.missingMonth)
  }

  return clampEntity(
    'month',
    month,
    1,
    calendarNative.monthsInYearPart(year),
    overflow
  )
}

function refineMonthCode(
  calendarNative: NativeYearMonthRefineDeps,
  monthCode: string,
  year: number,
  overflow: Overflow,
) {
  const leapMonth = calendarNative.leapMonth(year)
  const [monthCodeNumber, wantsLeapMonth] = parseMonthCode(monthCode)
  let month = monthCodeNumberToMonth(monthCodeNumber, wantsLeapMonth, leapMonth)

  if (wantsLeapMonth) {
    const leapMonthMeta = getCalendarLeapMonthMeta(calendarNative)

    // calendar does not support leap years
    if (leapMonthMeta === undefined) {
      throw new RangeError(errorMessages.invalidLeapMonth)
    }

    // leap year has a maximum
    else if (leapMonthMeta > 0) {
      if (month > leapMonthMeta) {
        throw new RangeError(errorMessages.invalidLeapMonth)
      }
      if (leapMonth === undefined) {
        if (overflow === Overflow.Reject) {
          throw new RangeError(errorMessages.invalidLeapMonth)
        } else {
          month-- // M05L -> M05
        }
      }
    }

    // leap year is constant
    else {
      if (month !== -leapMonthMeta) {
        throw new RangeError(errorMessages.invalidLeapMonth)
      }
      if (leapMonth === undefined) {
        if (overflow === Overflow.Reject) {
          throw new RangeError(errorMessages.invalidLeapMonth)
        } else {
           // ex: M05L -> M06
        }
      }
    }
  }

  return month
}

function refineDay(
  calendarNative: NativeDateRefineDeps,
  fields: DayFields,
  month: number,
  year: number,
  overflow?: Overflow
): number {
  return clampProp(
    fields,
    'day',
    1,
    calendarNative.daysInMonthParts(year, month),
    overflow
  )
}

function spliceFields(
  dest: any,
  additional: any,
  allPropNames: string[],
  deletablePropNames?: string[],
): void {
  let anyMatching = false
  const nonMatchingPropNames: string[] = []

  for (const propName of allPropNames) {
    if (additional[propName] !== undefined) {
      anyMatching = true
    } else {
      nonMatchingPropNames.push(propName)
    }
  }

  Object.assign(dest, additional)

  if (anyMatching) {
    for (const deletablePropName of (deletablePropNames || nonMatchingPropNames)) {
      delete dest[deletablePropName]
    }
  }
}
