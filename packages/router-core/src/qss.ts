/**
 * Program is a reimplementation of the `qss` package:
 * Copyright (c) Luke Edwards luke.edwards05@gmail.com, MIT License
 * https://github.com/lukeed/qss/blob/master/license.md
 *
 * This reimplementation matches `URLSearchParams` encode/decode
 * (application/x-www-form-urlencoded) without constructing one on
 * every call. The last encode result is interned for repeated
 * stringify of the same search object.
 *
 * Update: this implementation has also been mangled to
 * fit exactly our use-case (single value per key in encoding).
 */

function percentEncodeByte(code: number): string {
  return '%' + (code + 256).toString(16).toUpperCase().slice(1)
}

/**
 * Encode one component the way `URLSearchParams` does:
 * unreserved is `*-.0-9A-Z_a-z`, space becomes `+`, everything else is %HH.
 */
function encodeFormComponent(value: unknown): string {
  const str = typeof value === 'string' ? value : String(value)
  const len = str.length
  let i = 0
  for (; i < len; i++) {
    const c = str.charCodeAt(i)
    if (
      (c >= 48 && c <= 57) ||
      (c >= 65 && c <= 90) ||
      (c >= 97 && c <= 122) ||
      c === 42 ||
      c === 45 ||
      c === 46 ||
      c === 95
    ) {
      continue
    }
    break
  }
  if (i === len) return str

  let out = str.slice(0, i)
  for (; i < len; i++) {
    const c = str.charCodeAt(i)
    if (
      (c >= 48 && c <= 57) ||
      (c >= 65 && c <= 90) ||
      (c >= 97 && c <= 122) ||
      c === 42 ||
      c === 45 ||
      c === 46 ||
      c === 95
    ) {
      out += str[i]
    } else if (c === 32) {
      out += '+'
    } else if (c < 128) {
      out += percentEncodeByte(c)
    } else {
      return (
        out +
        encodeURIComponent(str.slice(i))
          .replace(/%20/g, '+')
          .replace(/[!'()~]/g, (ch) => percentEncodeByte(ch.charCodeAt(0)))
      )
    }
  }
  return out
}

function decodeFormComponent(str: string): string {
  const plus = str.indexOf('+')
  const pct = str.indexOf('%')
  if (plus === -1 && pct === -1) return str
  const input = plus === -1 ? str : str.replace(/\+/g, ' ')
  try {
    return decodeURIComponent(input)
  } catch {
    return input
  }
}

/**
 * Encodes an object into a query string.
 * @param obj - The object to encode into a query string.
 * @param stringify - An optional custom stringify function.
 * @returns The encoded query string.
 * @example
 * ```
 * // Example input: encode({ token: 'foo', key: 'value' })
 * // Expected output: "token=foo&key=value"
 * ```
 */
let lastEncodeObj: Record<string, any> | undefined
let lastEncodeFn: ((value: any) => string) | undefined
let lastEncodeOut = ''

export function encode(
  obj: Record<string, any>,
  stringify: (value: any) => string = String,
): string {
  if (obj === lastEncodeObj && stringify === lastEncodeFn) return lastEncodeOut

  let out = ''
  let first = true
  for (const key in obj) {
    const val = obj[key]
    if (val === undefined) continue
    if (!first) out += '&'
    else first = false
    out += encodeFormComponent(key)
    out += '='
    out += encodeFormComponent(stringify(val))
  }

  lastEncodeObj = obj
  lastEncodeFn = stringify
  lastEncodeOut = out
  return out
}

/**
 * Converts a string value to its appropriate type (string, number, boolean).
 * @param mix - The string value to convert.
 * @returns The converted value.
 * @example
 * // Example input: toValue("123")
 * // Expected output: 123
 */
function toValue(str: unknown) {
  if (!str) return ''

  if (str === 'false') return false
  if (str === 'true') return true
  return +str * 0 === 0 && +str + '' === str ? +str : str
}
/**
 * Decodes a query string into an object.
 * @param str - The query string to decode.
 * @returns The decoded key-value pairs in an object format.
 * @example
 * // Example input: decode("token=foo&key=value")
 * // Expected output: { "token": "foo", "key": "value" }
 */
export function decode(str: any): any {
  const result: Record<string, unknown> = Object.create(null)
  if (str == null) return result
  if (typeof str !== 'string') str = String(str)
  if (!str) return result

  let offset = str.charCodeAt(0) === 63 ? 1 : 0
  const len = str.length
  while (offset < len) {
    let amp = str.indexOf('&', offset)
    if (amp === -1) amp = len
    if (amp === offset) {
      offset++
      continue
    }

    const eq = str.indexOf('=', offset)
    const rawKey =
      eq === -1 || eq > amp ? str.slice(offset, amp) : str.slice(offset, eq)
    const rawVal = eq === -1 || eq > amp ? '' : str.slice(eq + 1, amp)
    offset = amp + 1

    const key = decodeFormComponent(rawKey)
    const value = toValue(decodeFormComponent(rawVal))

    const previousValue = result[key]
    if (previousValue == null) {
      result[key] = value
    } else if (Array.isArray(previousValue)) {
      previousValue.push(value)
    } else {
      result[key] = [previousValue, value]
    }
  }

  return result
}
