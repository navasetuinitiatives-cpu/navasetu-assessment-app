// Reads pixel size from PNG/JPEG headers (for placing the logo in the Excel report).
export function imageSize(buf, mime) {
  try {
    if (mime === 'image/png') return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    if (mime === 'image/jpeg') { let i = 2; while (i < buf.length) { if (buf[i] !== 0xff) { i++; continue; } const t = buf[i + 1]; if (t >= 0xc0 && t <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(t)) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) }; i += 2 + buf.readUInt16BE(i + 2); } }
  } catch (e) { /* fall through */ }
  return { w: 3, h: 1 };
}
