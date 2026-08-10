import { Font } from "@react-pdf/renderer";
import path from "path";

let registered = false;

export function ensureFontsRegistered() {
  if (registered) return;
  Font.register({
    family: "NotoSansJP",
    fonts: [
      { src: path.join(process.cwd(), "public/fonts/NotoSansJP-Regular.ttf"), fontWeight: "normal" },
      { src: path.join(process.cwd(), "public/fonts/NotoSansJP-Bold.ttf"), fontWeight: "bold" }
    ]
  });
  // 日本語テキストが行末で不自然にハイフン区切りされるのを防ぐ
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}

ensureFontsRegistered();
