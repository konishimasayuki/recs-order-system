import { Font } from "@react-pdf/renderer";
import fs from "fs";
import path from "path";

/**
 * 請求書PDFの日本語フォント登録。
 *
 * Vercel のサーバーレス関数では `public/` がバンドルに含まれるとは限らないため、
 * 想定される置き場所を順に探す。next.config.mjs の outputFileTracingIncludes で
 * 同梱を指示しているが、環境差で見つからない場合に原因の分かる例外を投げる。
 */
const FONT_DIRS = [
  process.env.RECSGPS_FONT_DIR,
  path.join(process.cwd(), "public", "fonts"),
  path.join(process.cwd(), ".next", "server", "public", "fonts")
].filter((d): d is string => Boolean(d));

function findFont(fileName: string): string {
  for (const dir of FONT_DIRS) {
    const candidate = path.join(dir, fileName);
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    `請求書PDF用のフォント ${fileName} が見つかりません。探索したディレクトリ: ${FONT_DIRS.join(", ")}`
  );
}

let registered = false;

export function ensureFontsRegistered(): void {
  if (registered) return;
  Font.register({
    family: "NotoSansJP",
    fonts: [
      { src: findFont("NotoSansJP-Regular.ttf"), fontWeight: "normal" },
      { src: findFont("NotoSansJP-Bold.ttf"), fontWeight: "bold" }
    ]
  });
  // 日本語テキストが行末で不自然にハイフン区切りされるのを防ぐ
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}
