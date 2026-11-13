/** @type {import('next').NextConfig} */
const nextConfig = {
  // next/image は使っていないので、画像変換の機能そのものを止める（ログイン不要で呼べる入口を減らす）
  images: { unoptimized: true },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // ほかのサイトに埋め込ませない（なりすまし画面でのクリック誘導を防ぐ）
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          // 音声入力のマイクだけ許可し、カメラ・位置情報は使わせない
          { key: 'Permissions-Policy', value: 'microphone=(self), camera=(), geolocation=()' },
        ],
      },
    ]
  },
}
export default nextConfig
