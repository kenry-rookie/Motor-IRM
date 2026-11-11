/**
 * DEC-047 — Phone numbers. ONE rule, used while typing (PhoneInput), by the API
 * (zPhone) and by the database (mirm_phone_valid in migration 5):
 *
 *   Nicaragua                    8888-1111           (8 digits, no prefix)
 *   EE. UU. / Canadá             +1 305-555-1234
 *   Centroamérica (502–507)      +506 8888-1111      (+505 8888-1111 → 8888-1111)
 *   Any other country            +4915123456789      (digits after the +)
 *
 * Without "+", the number is Nicaraguan. Typing "+" first switches to foreign.
 */

const CENTRAL_AMERICA = ["502", "503", "504", "506", "507"];

/** Formats as the person types: never adds digits, only dashes and spaces. */
export function formatPhoneInput(raw: string): string {
  const intl = raw.trimStart().startsWith("+");
  const d = raw.replace(/\D/g, "");
  if (!intl) {
    const n = d.slice(0, 8);
    return n.length > 4 ? `${n.slice(0, 4)}-${n.slice(4)}` : n;
  }
  if (d.startsWith("1")) {
    const n = d.slice(1, 11);
    let out = "+1";
    if (n.length > 0) out += ` ${n.slice(0, 3)}`;
    if (n.length > 3) out += `-${n.slice(3, 6)}`;
    if (n.length > 6) out += `-${n.slice(6)}`;
    return out;
  }
  const cc = d.slice(0, 3);
  if (cc.length === 3 && (CENTRAL_AMERICA.includes(cc) || cc === "505")) {
    const n = d.slice(3, 11);
    return `+${cc}${n ? ` ${n.length > 4 ? `${n.slice(0, 4)}-${n.slice(4)}` : n}` : ""}`;
  }
  return `+${d.slice(0, 15)}`;
}

/** The value to store, or null when it is not a complete phone number. */
export function normalizePhone(raw: string): string | null {
  const f = formatPhoneInput(raw);
  if (/^\+505 \d{4}-\d{4}$/.test(f)) return f.slice(5); // a Nicaraguan number written with +505
  return isValidPhone(f) ? f : null;
}

/** Same as the database function mirm_phone_valid(). */
export function isValidPhone(v: string): boolean {
  return (
    /^\d{4}-\d{4}$/.test(v) ||
    /^\+1 \d{3}-\d{3}-\d{4}$/.test(v) ||
    /^\+50[2-7] \d{4}-\d{4}$/.test(v) ||
    /^\+\d{7,15}$/.test(v)
  );
}

/** Short hint for the field, depending on what is being typed. */
export function phoneHint(v: string): string {
  if (!v.trim().startsWith("+")) return "Nicaragua: 8 dígitos. Para otro país, empiece con +";
  if (v.replace(/\D/g, "").startsWith("1")) return "EE. UU. / Canadá: +1 y 10 dígitos";
  return "Extranjero: + código del país y el número";
}
