import { refineMaybeZonedDateTimeBag } from './convert'
import { DurationFields, durationFieldIndexes } from './durationFields'
import { pluckIsoDateInternals } from './isoInternals'
import { parseZonedOrPlainDateTime } from './isoParse'
import { toString, ensureObjectlike, toInteger, ensureString } from './cast'
import { DayTimeUnit, TimeUnit, Unit, UnitName, nanoInUtcDay, unitNameMap, unitNanoMap } from './units'
import {
  BoundArg,
  clampEntity,
  isObjectlike,
  roundExpand,
  roundHalfCeil,
  roundHalfEven,
  roundHalfExpand,
  roundHalfFloor,
  roundHalfTrunc,
} from './utils'

// public
import type { TimeZoneArg } from './timeZone'
import type { PlainDate } from './plainDate'
import type { ZonedDateTime, ZonedDateTimeBag } from './zonedDateTime'
import { IsoDateSlots, PlainDateSlots, PlainTimeBranding, ZonedDateTimeSlots, ZonedEpochSlots, getSlots } from './slots'

// Compound Options
// -------------------------------------------------------------------------------------------------
// TODO: always good to spread options tuples? better to nest?

export function refineOverflowOptions(
  options: OverflowOptions | undefined,
): Overflow | undefined {
  return options === undefined ? undefined : refineOverflow(options)
}

export type ZonedFieldOptions = OverflowOptions & EpochDisambigOptions & OffsetDisambigOptions

export type ZonedFieldTuple = [
  Overflow,
  OffsetDisambig,
  EpochDisambig,
]

export function refineZonedFieldOptions(options: ZonedFieldOptions | undefined, isMerge?: boolean): ZonedFieldTuple {
  options = normalizeOptions(options)

  // alphabetical
  const epochDisambig = refineEpochDisambig(options) // "disambig"
  const offsetDisambig = refineOffsetDisambig(options, isMerge ?  OffsetDisambig.Prefer : OffsetDisambig.Reject) // "offset"
  const overflow = refineOverflow(options)

  return [
    overflow,
    offsetDisambig,
    epochDisambig,
  ]
}

export function refineEpochDisambigOptions(options: EpochDisambigOptions | undefined): EpochDisambig {
  return refineEpochDisambig(normalizeOptions(options))
}

export type DiffOptions = LargestUnitOptions & SmallestUnitOptions & RoundingIncOptions & RoundingModeOptions

export type DiffTuple = [
  Unit, // largestUnit
  Unit, // smallestUnit
  number, // roundingInc
  RoundingMode
]

export function refineDiffOptions(
  roundingModeInvert: boolean | undefined,
  options: DiffOptions | undefined,
  defaultLargestUnit: Unit,
  maxUnit = Unit.Year,
  minUnit = Unit.Nanosecond,
  defaultRoundingMode: RoundingMode = RoundingMode.Trunc,
): DiffTuple {
  options = normalizeOptions(options)

  // alphabetical
  let largestUnit: any = refineLargestUnit(options, maxUnit, minUnit, -1 as any)
  let roundingInc = parseRoundingIncInteger(options)
  let roundingMode = refineRoundingMode(options, defaultRoundingMode)
  let smallestUnit = refineSmallestUnit(options, maxUnit, minUnit, minUnit)

  if (largestUnit === -1) {
    largestUnit = Math.max(defaultLargestUnit, smallestUnit)
  } else if (smallestUnit > largestUnit) {
    throw new RangeError('smallestUnit must be smaller than largestUnit')
  }

  roundingInc = refineRoundingInc(roundingInc, smallestUnit as DayTimeUnit, true)

  if (roundingModeInvert) {
    roundingMode = invertRoundingMode(roundingMode)
  }

  return [largestUnit, smallestUnit, roundingInc, roundingMode]
}

export function refineCalendarDiffOptions(
  options: LargestUnitOptions | undefined, // TODO: definitely make large-unit type via generics
): Unit { // TODO: only year/month/week/day???
  options = normalizeOptions(options)
  return refineLargestUnit(options, Unit.Year, Unit.Day, Unit.Day)
}

export type RoundTuple = [
  Unit, // smallestUnit
  number,
  RoundingMode,
]

const smallestUnitStr = 'smallestUnit'
const largestUnitStr = 'largestUnit'
const totalUnitStr = 'unit'

// TODO: DRY with DiffOptions?
export type RoundingOptions = SmallestUnitOptions & RoundingIncOptions & RoundingModeOptions

/*
Always related to time
*/
export function refineRoundOptions(
  options: RoundingOptions | UnitName,
  maxUnit: DayTimeUnit = Unit.Day,
  solarMode?: boolean,
): RoundTuple {
  options = normalizeUnitNameOptions(options, smallestUnitStr)

  // alphabetical
  let roundingInc = parseRoundingIncInteger(options)
  const roundingMode = refineRoundingMode(options, RoundingMode.HalfExpand)
  const smallestUnit = refineSmallestUnit(options, maxUnit) as DayTimeUnit

  roundingInc = refineRoundingInc(roundingInc, smallestUnit, undefined, solarMode)

  return [smallestUnit, roundingInc, roundingMode]
}

export type DurationRoundOptions = DiffOptions & RelativeToOptions

export type DurationRoundTuple = [
  ...DiffTuple,
  RelativeToInternals?,
]

/*
TODO: much more DRY with refineDiffOptions
This function is YUCK
*/
export function refineDurationRoundOptions(
  options: DurationRoundOptions,
  defaultLargestUnit: Unit
): DurationRoundTuple {
  options = normalizeUnitNameOptions(options, smallestUnitStr)

  // alphabeitcal
  let largestUnit: any = refineLargestUnit(options, undefined, undefined, -1 as any)
  const relativeToInternals = refineRelativeTo(options)
  let roundingInc = parseRoundingIncInteger(options)
  const roundingMode = refineRoundingMode(options, RoundingMode.HalfExpand)
  let smallestUnit: any = refineSmallestUnit(options, undefined, undefined, -1 as any)

  if (smallestUnit === -1 && largestUnit === -1) {
    throw new RangeError('Must have either smallestUnit or largestUnit')
  }
  if (smallestUnit === -1) {
    smallestUnit = Unit.Nanosecond
  }
  if (largestUnit === -1) {
    largestUnit = Math.max(smallestUnit, defaultLargestUnit)
  }
  if (smallestUnit !== -1 && smallestUnit > largestUnit) {
    throw new RangeError('SmallestUnit cant be bigger than largestUnit')
  }

  roundingInc = refineRoundingInc(roundingInc, smallestUnit as DayTimeUnit, true)

  return [largestUnit, smallestUnit, roundingInc, roundingMode, relativeToInternals]
}

export type TotalUnitOptionsWithRel = TotalUnitOptions & RelativeToOptions

export function refineTotalOptions(
  options: TotalUnitOptionsWithRel | UnitName
): [
  Unit,
  RelativeToInternals | undefined,
] {
  options = normalizeUnitNameOptions(options, totalUnitStr)

  // alphabetical
  const relativeToInternals = refineRelativeTo(options)
  const totalUnit = refineTotalUnit(options) // required

  return [
    totalUnit, // required
    relativeToInternals,
  ]
}

export function refineRelativeToOptions(options: RelativeToOptions | undefined): RelativeToInternals | undefined {
  return refineRelativeTo(normalizeOptions(options))
}

export type InstantDisplayOptions =
  { timeZone: TimeZoneArg } &
  TimeDisplayOptions

export type InstantDisplayTuple = [
  TimeZoneArg,
  ...TimeDisplayTuple,
]

export function refineInstantDisplayOptions(options: InstantDisplayOptions | undefined): InstantDisplayTuple {
  options = normalizeOptions(options)

  // alphabetical
  const timeDisplayTuple = refineTimeDisplayTuple(options)
  const timeZone: TimeZoneArg = options.timeZone

  return [
    timeZone, // TODO: possibly not needed after moving away from Record
    ...timeDisplayTuple,
  ]
}

export type ZonedDateTimeDisplayOptions =
  & CalendarDisplayOptions
  & TimeZoneDisplayOptions
  & OffsetDisplayOptions
  & TimeDisplayOptions

export type ZonedDateTimeDisplayTuple = [
  CalendarDisplay,
  TimeZoneDisplay,
  OffsetDisplay,
  ...TimeDisplayTuple,
]

export function refineZonedDateTimeDisplayOptions(options: ZonedDateTimeDisplayOptions | undefined): ZonedDateTimeDisplayTuple {
  options = normalizeOptions(options)
  return [
    refineCalendarDisplay(options),
    refineTimeZoneDisplay(options),
    refineOffsetDisplay(options),
    ...refineTimeDisplayTuple(options),
  ]
}

export type DateTimeDisplayOptions = CalendarDisplayOptions & TimeDisplayOptions

export type DateTimeDisplayTuple = [
  CalendarDisplay,
  ...TimeDisplayTuple,
]

export function refineDateTimeDisplayOptions(options: DateTimeDisplayOptions | undefined): DateTimeDisplayTuple {
  options = normalizeOptions(options)
  return [
    refineCalendarDisplay(options),
    ...refineTimeDisplayTuple(options),
  ]
}

export function refineDateDisplayOptions(options: CalendarDisplayOptions | undefined): CalendarDisplay {
  return refineCalendarDisplay(normalizeOptions(options))
}

export type TimeDisplayTuple = [
  nanoInc: number,
  roundingMode: RoundingMode,
  subsecDigits: SubsecDigits | -1 | undefined
]

// TODO: lock-down subset of Unit here?
export type TimeDisplayOptions = SmallestUnitOptions & RoundingModeOptions & SubsecDigitsOptions

export function refineTimeDisplayOptions(
  options: TimeDisplayOptions | undefined,
  maxSmallestUnit?: TimeUnit
): TimeDisplayTuple {
  return refineTimeDisplayTuple(normalizeOptions(options), maxSmallestUnit)
}

function refineTimeDisplayTuple(
  options: TimeDisplayOptions,
  maxSmallestUnit: TimeUnit = Unit.Minute
): TimeDisplayTuple {
  // need to refine, even if not used
  // alphabetical
  const subsecDigits = refineSubsecDigits(options) // "fractionalSecondDigits". rename in our code?
  const roundingMode = refineRoundingMode(options, RoundingMode.Trunc)
  const smallestUnit = refineSmallestUnit(options, maxSmallestUnit, Unit.Nanosecond, -1 as number)

  if ((smallestUnit as number) !== -1) {
    return [
      unitNanoMap[smallestUnit],
      roundingMode,
      (smallestUnit < Unit.Minute)
        ? (9 - (smallestUnit * 3)) as SubsecDigits
        : -1, // hide seconds --- NOTE: not relevant when maxSmallestUnit is <minute !!!
    ]
  }

  return [
    subsecDigits === undefined ? 1 : 10 ** (9 - subsecDigits),
    roundingMode,
    subsecDigits,
  ]
}

//
// TODO: generic for DayTimeUnit/TimeUnit?

interface SmallestUnitOptions {
  smallestUnit?: UnitName | keyof DurationFields
}

// TODO: rename to CalendarDiffOptions?
export interface LargestUnitOptions {
  largestUnit?: UnitName | keyof DurationFields
}

interface TotalUnitOptions {
  unit: UnitName | keyof DurationFields
}

//

const refineSmallestUnit = refineUnitOption.bind<
  undefined, [BoundArg], // bound
  [SmallestUnitOptions, Unit?, Unit?, Unit?], // unbound
  Unit // return
>(undefined, smallestUnitStr)

const refineLargestUnit = refineUnitOption.bind<
  undefined, [BoundArg], // bound
  [LargestUnitOptions, Unit?, Unit?, Unit?], // unbound
  Unit
>(undefined, largestUnitStr)

// TODO: get totalUnitStr closer to this! etc
const refineTotalUnit = refineUnitOption.bind<
  undefined, [BoundArg], // bound
  [TotalUnitOptions, Unit?, Unit?, Unit?], // unbound
  Unit
>(undefined, totalUnitStr)

// Overflow
// -------------------------------------------------------------------------------------------------

export const enum Overflow {
  Constrain,
  Reject,
}

export interface OverflowOptions {
  overflow?: keyof typeof overflowMap
}

const overflowMap = {
  constrain: Overflow.Constrain,
  reject: Overflow.Reject,
}

export const overflowMapNames = Object.keys(overflowMap) as (keyof typeof overflowMap)[]

const refineOverflow = refineChoiceOption.bind<
  undefined, [BoundArg, BoundArg], // bound
  [OverflowOptions, Overflow?], // unbound
  Overflow // return
>(undefined, 'overflow', overflowMap)

// Epoch Disambig
// -------------------------------------------------------------------------------------------------

export const enum EpochDisambig {
  Compat,
  Reject,
  Earlier,
  Later,
}

export interface EpochDisambigOptions {
  disambiguation?: keyof typeof epochDisambigMap
}

const epochDisambigMap = {
  compatible: EpochDisambig.Compat,
  reject: EpochDisambig.Reject,
  earlier: EpochDisambig.Earlier,
  later: EpochDisambig.Later,
}

const refineEpochDisambig = refineChoiceOption.bind<
  undefined, [BoundArg, BoundArg], // bound
  [EpochDisambigOptions, EpochDisambig?], // unbound
  EpochDisambig // return
>(undefined, 'disambiguation', epochDisambigMap)

// Offset Disambig
// -------------------------------------------------------------------------------------------------

export const enum OffsetDisambig {
  Reject,
  Use,
  Prefer,
  Ignore,
}

export interface OffsetDisambigOptions {
  offset?: keyof typeof offsetDisambigMap
}

const offsetDisambigMap = {
  reject: OffsetDisambig.Reject,
  use: OffsetDisambig.Use,
  prefer: OffsetDisambig.Prefer,
  ignore: OffsetDisambig.Ignore,
}

const refineOffsetDisambig = refineChoiceOption.bind<
  undefined, [BoundArg, BoundArg], // bound
  [OffsetDisambigOptions, OffsetDisambig?], // unbound
  OffsetDisambig // return
>(undefined, 'offset', offsetDisambigMap)

// Calendar Display
// -------------------------------------------------------------------------------------------------

export const enum CalendarDisplay {
  Auto,
  Never,
  Critical,
  Always,
}

export interface CalendarDisplayOptions {
  calendarName?: keyof typeof calendarDisplayMap
}

const calendarDisplayMap = {
  auto: CalendarDisplay.Auto,
  never: CalendarDisplay.Never,
  critical: CalendarDisplay.Critical,
  always: CalendarDisplay.Always,
}

const refineCalendarDisplay = refineChoiceOption.bind<
  undefined, [BoundArg, BoundArg], // bound
  [CalendarDisplayOptions, CalendarDisplay?], // unbound
  CalendarDisplay // return
>(undefined, 'calendarName', calendarDisplayMap)

// TimeZone Display
// -------------------------------------------------------------------------------------------------

export const enum TimeZoneDisplay {
  Auto,
  Never,
  Critical,
}

export interface TimeZoneDisplayOptions {
  timeZoneName?: keyof typeof timeZoneDisplayMap
}

const timeZoneDisplayMap = {
  auto: TimeZoneDisplay.Auto,
  never: TimeZoneDisplay.Never,
  critical: TimeZoneDisplay.Critical,
}

const refineTimeZoneDisplay = refineChoiceOption.bind<
  undefined, [BoundArg, BoundArg], // bound
  [TimeZoneDisplayOptions, TimeZoneDisplay?], // unbound
  TimeZoneDisplay // return
>(undefined, 'timeZoneName', timeZoneDisplayMap)

// Offset Display
// -------------------------------------------------------------------------------------------------

export const enum OffsetDisplay {
  Auto,
  Never,
}

export interface OffsetDisplayOptions {
  offset?: keyof typeof offsetDisplayMap
}

const offsetDisplayMap = {
  auto: OffsetDisplay.Auto,
  never: OffsetDisplay.Never,
}

const refineOffsetDisplay = refineChoiceOption.bind<
  undefined, [BoundArg, BoundArg], // bound
  [OffsetDisplayOptions, OffsetDisplay?], // unbound
  OffsetDisplay // return
>(undefined, 'offset', offsetDisplayMap)

// Rounding Mode
// -------------------------------------------------------------------------------------------------

export const enum RoundingMode {
  // modes that get inverted (see invertRoundingMode)
  Floor,
  HalfFloor,
  Ceil,
  HalfCeil,
  // other modes
  Trunc, // default for most things (still true??)
  HalfTrunc,
  Expand,
  HalfExpand, // default for date/time/duration::round() (lots of things!)
  HalfEven,
}

export interface RoundingModeOptions {
  roundingMode?: keyof typeof roundingModeMap
}

const roundingModeMap = {
  floor: RoundingMode.Floor,
  halfFloor: RoundingMode.HalfFloor,
  ceil: RoundingMode.Ceil,
  halfCeil: RoundingMode.HalfCeil,
  trunc: RoundingMode.Trunc,
  halfTrunc: RoundingMode.HalfTrunc,
  expand: RoundingMode.Expand,
  halfExpand: RoundingMode.HalfExpand,
  halfEven: RoundingMode.HalfEven,
}

// Caller should always supply default
const refineRoundingMode = refineChoiceOption.bind<
  undefined, [BoundArg, BoundArg], // bound
  [RoundingModeOptions, RoundingMode?], // unbound
  RoundingMode // return
>(undefined, 'roundingMode', roundingModeMap)

export const roundingModeFuncs = [
  Math.floor,
  roundHalfFloor,
  Math.ceil,
  roundHalfCeil,
  Math.trunc,
  roundHalfTrunc,
  roundExpand,
  roundHalfExpand,
  roundHalfEven,
]

function invertRoundingMode(roundingMode: RoundingMode): RoundingMode {
  if (roundingMode < 4) {
    return (roundingMode + 2) % 4
  }
  return roundingMode
}

// Rounding Increment
// -------------------------------------------------------------------------------------------------

export interface RoundingIncOptions {
  roundingIncrement?: number
}

const roundingIncName = 'roundingIncrement'

function parseRoundingIncInteger(
  options: RoundingIncOptions,
): number {
  let roundingInc = options[roundingIncName]

  if (roundingInc === undefined) {
    return 1
  }

  return toInteger(roundingInc)
}

function refineRoundingInc(
  roundingInc: number,
  smallestUnit: DayTimeUnit,
  allowManyLargeUnits?: boolean,
  solarMode?: boolean,
): number {
  const upUnitNano = solarMode ? nanoInUtcDay : unitNanoMap[smallestUnit + 1]

  if (upUnitNano) {
    const unitNano = unitNanoMap[smallestUnit]
    const maxRoundingInc = upUnitNano / unitNano
    roundingInc = clampEntity(
      roundingIncName,
      roundingInc,
      1,
      maxRoundingInc - (solarMode ? 0 : 1),
      Overflow.Reject
    )

    // % is dangerous, but -0 will be falsy just like 0
    if (upUnitNano % (roundingInc * unitNano)) {
      throw new RangeError('Must be multiple')
    }
  } else {
    roundingInc = clampEntity(
      roundingIncName,
      roundingInc,
      1,
      allowManyLargeUnits ? 10 ** 9 : 1,
      Overflow.Reject
    )
  }

  return roundingInc
}

// Subsec Digits
// -------------------------------------------------------------------------------------------------

/*
addons:
  -1 means hide seconds
  undefined means 'auto' (display all digits but no trailing zeros)
*/
export type SubsecDigits = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export interface SubsecDigitsOptions {
  fractionalSecondDigits?: SubsecDigits
}

const subsecDigitsName = 'fractionalSecondDigits'

function refineSubsecDigits(options: SubsecDigitsOptions): SubsecDigits | undefined {
  let subsecDigits = options[subsecDigitsName]

  if (subsecDigits !== undefined) {
    if (typeof subsecDigits !== 'number') {
      if (toString(subsecDigits) === 'auto') {
        return
      }

      throw new RangeError(`fractionalSecondDigits must be 'auto' or 0 through 9`)
    }

    subsecDigits = clampEntity(subsecDigitsName, Math.floor(subsecDigits), 0, 9, Overflow.Reject) as SubsecDigits
  }

  return subsecDigits
}

// Relative-To
// -------------------------------------------------------------------------------------------------

export interface RelativeToOptions {
  relativeTo?: ZonedDateTime | PlainDate | string // TODO: include 'bag' in here
}

// TODO: use in definition of `createMarkerSystem` ?
type RelativeToInternals = ZonedEpochSlots | IsoDateSlots

function refineRelativeTo(options: RelativeToOptions): RelativeToInternals | undefined {
  const { relativeTo } = options

  if (relativeTo !== undefined) {
    if (isObjectlike(relativeTo)) {
      const slots = getSlots(relativeTo)
      const { branding } = slots || {}

      if (
        branding === 'ZonedDateTime' ||
        branding === 'PlainDate'
      ) {
        return slots as (ZonedDateTimeSlots | PlainDateSlots)
      } else if (branding === 'PlainDateTime') {
        return pluckIsoDateInternals(slots as any)
      }

      return refineMaybeZonedDateTimeBag(relativeTo as unknown as ZonedDateTimeBag)
    }

    return parseZonedOrPlainDateTime(ensureString(relativeTo))
  }
}

// Utils
// -------------------------------------------------------------------------------------------------

/*
If defaultUnit is undefined, will throw error if not specified
*/
function refineUnitOption<O>(
  optionName: (keyof O) & string,
  options: O,
  maxUnit: Unit = Unit.Year,
  minUnit: Unit = Unit.Nanosecond,
  defaultUnit?: Unit,
): Unit {
  // TODO: more DRY
  if (!isObjectlike(options)) {
    throw TypeError('Options must be object')
  }

  let unitName = options[optionName] as (string | undefined)

  if (unitName === undefined) {
    if (defaultUnit === undefined) {
      throw new RangeError('Must specify' + optionName) // best error?
    }
    return defaultUnit
  }

  unitName = toString(unitName)

  // TODO: more DRY with above block, but need to work with toString'd value
  if (unitName === 'auto') {
    if (defaultUnit === undefined) {
      throw new RangeError('Must specify' + optionName) // best error?
    }
    return defaultUnit
  }

  const unit = unitNameMap[unitName as UnitName] ??
    durationFieldIndexes[unitName as (keyof DurationFields)]

  if (unit === undefined) {
    throw new RangeError('Invalid unit ' + optionName) // correct error?
  }
  if (unit < minUnit || unit > maxUnit) { // TODO: use clamp?
    throw new RangeError('Out of bounds' + optionName)
  }

  return unit
}

function refineChoiceOption<O>(
  optionName: keyof O,
  enumNameMap: Record<string, number>,
  options: O,
  defaultChoice = 0,
): number {
  // TODO: more DRY
  if (!isObjectlike(options)) {
    throw TypeError('Options must be object')
  }

  const enumName = options[optionName]
  if (enumName === undefined) {
    return defaultChoice
  }

  const enumNum = enumNameMap[toString(enumName as string)]
  if (enumNum === undefined) {
    throw new RangeError('Must be one of the choices')
  }
  return enumNum
}

// ---

export function normalizeOptions<O extends {}>(options: O | undefined): O {
  if (options === undefined) {
    return {} as O
  }
  return ensureObjectlike(options)
}

function normalizeUnitNameOptions<O extends {}>(
  options: O | UnitName,
  optionName: keyof O,
): O {
  if (typeof options === 'string') {
    return { [optionName]: options } as O
  }
  return ensureObjectlike(options)
}

/*
Used for to* and diff* functions
*/
export function prepareOptions<O>(options: O): O {
  if (options === undefined) {
    return undefined as any
  }
  if (isObjectlike(options)) {
    return Object.assign(Object.create(null), options)
  }
  throw new TypeError('Options must be object')
}
