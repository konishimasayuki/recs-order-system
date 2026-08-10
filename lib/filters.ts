/** カンマ区切りのクエリ値を、許可された値だけの配列にする */
export function parseMulti(raw: string | undefined, allowed: string[]): string[] {
  return (raw ?? "")
    .split(",")
    .filter(Boolean)
    .filter((v) => allowed.includes(v));
}
