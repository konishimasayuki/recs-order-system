/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  experimental: {
    // 請求書PDFは実行時に public/fonts のTTFを読む。
    // 静的アセットはサーバーレス関数のバンドルに自動では含まれないため明示的に同梱する。
    outputFileTracingIncludes: {
      "/api/invoice/[orderId]": ["./public/fonts/**"]
    }
  }
};

export default nextConfig;
