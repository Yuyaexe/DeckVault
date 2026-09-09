function passcodesToBase64(passcodes: number[]): string {
  if (passcodes.length === 0) return "";
  const buffer = new ArrayBuffer(passcodes.length * 4);
  const view = new DataView(buffer);
  passcodes.forEach((code, index) => {
    view.setUint32(index * 4, code >>> 0, true);
  });
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToPasscodes(base64: string): number[] {
  if (!base64.trim()) return [];
  const binary = atob(base64.trim());
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const passcodes: number[] = [];
  const view = new DataView(bytes.buffer);
  for (let offset = 0; offset + 4 <= bytes.length; offset += 4) {
    passcodes.push(view.getUint32(offset, true));
  }
  return passcodes;
}

export interface YdkeDeck {
  main: number[];
  extra: number[];
  side: number[];
}

export function parseYdke(input: string): YdkeDeck | null {
  const trimmed = input.trim();
  if (!/^ydke:\/\//i.test(trimmed)) return null;

  const body = trimmed.replace(/^ydke:\/\//i, "");
  const segments = body.split("!");
  const main = base64ToPasscodes(segments[0] ?? "");
  const extra = base64ToPasscodes(segments[1] ?? "");
  const side = base64ToPasscodes(segments[2] ?? "");
  return { main, extra, side };
}

export function encodeYdke(deck: YdkeDeck): string {
  return [
    "ydke://",
    passcodesToBase64(deck.main),
    "!",
    passcodesToBase64(deck.extra),
    "!",
    passcodesToBase64(deck.side),
    "!",
  ].join("");
}
