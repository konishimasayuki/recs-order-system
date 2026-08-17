/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  experimental: {
    // 請求書PDFは実行時に public/fonts のTTFとロゴ・社印画像を読む。
    // 静的アセットはサーバーレス関数のバンドルに自動では含まれないため明示的に同梱する。
    outputFileTracingIncludes: {
      "/api/invoice/[orderId]": ["./public/fonts/**", "./public/logo.png", "./public/seal.png"]
    }
  }
};

export default nextConfig;
