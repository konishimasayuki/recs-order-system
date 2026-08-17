// fontkit 2系は型定義を同梱していない。請求書PDFで文字幅の実測に使う分だけ宣言する。
declare module "fontkit" {
  interface GlyphRun {
    advanceWidth: number;
  }
  interface Font {
    unitsPerEm: number;
    layout(text: string): GlyphRun;
  }
  export function openSync(path: string): Font;
}
