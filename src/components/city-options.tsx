import { CITIES, PROVINCES } from "@/lib/constants";

/** <option>s for every Pakistani city grouped by province. Use inside a <select>. */
export function CityOptions() {
  return (
    <>
      {PROVINCES.map((p) => {
        const cities = Object.entries(CITIES).filter(([, c]) => c.province === p);
        if (!cities.length) return null;
        return (
          <optgroup key={p} label={p}>
            {cities.map(([name, c]) => (
              <option key={name} value={name}>
                {name} — {c.urdu}
              </option>
            ))}
          </optgroup>
        );
      })}
    </>
  );
}
