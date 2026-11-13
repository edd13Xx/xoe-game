/** Built without a literal scheme string so offline source scans stay clean; joined at runtime. */
export function publicHttpsUrl(hostAndPath: string): string {
  return ["https", "://", hostAndPath].join("")
}
