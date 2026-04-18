export const brand = {
  name: 'Viewpulse',
  tagline: 'Discover your hidden YouTube watching patterns',
  url: 'https://youtube-analytic.rachkovan.com',
  colors: {
    primary: '#FF6B6B',
    primaryDark: '#E85555',
    background: '#1A1A2E',
    backgroundLight: '#252540',
    surface: '#2D2D4A',
    text: '#FFFFFF',
    textMuted: '#A0A0B8',
    accent: '#6B8EFF',
    accentGreen: '#4ADE80',
    error: '#FF6B6B',
  },
  logo: '/icon.svg',
};

export const social = {
  twitter: '@viewpulse',
  github: 'yevgeniusr/youtube-analytic',
};

export const appConfig = {
  port: 3000,
  env: {
    public: {
      NEXT_PUBLIC_APP_URL: brand.url,
      NEXT_PUBLIC_APP_NAME: brand.name,
    },
    required: [
      'NEXT_PUBLIC_APP_URL',
      'GEMINI_API_KEY',
      'OPENAI_API_KEY',
    ],
  },
};
