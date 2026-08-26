/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  experimental: {
    // 請求書PDFは実行時に public/fonts のTTFとロゴ画像（配置されていれば）を読む。
    // 静的アセットはサーバーレス関数のバンドルに自動では含まれないため明示的に同梱する。
    outputFileTracingIncludes: {
      "/api/invoice/[invoiceId]": ["./public/fonts/**", "./public/logo*.png"]
    }
  }
};

export default nextConfig;
