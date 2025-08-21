import basicSsl from '@vitejs/plugin-basic-ssl'

export default {
  plugins: [basicSsl()],
  server: {
    https: true,
    host: '0.0.0.0',
  },
}