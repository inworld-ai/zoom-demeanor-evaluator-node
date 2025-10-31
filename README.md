[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

# Inworld Runtime App Template - Zoom Demeanor Evaluator

This is a Zoom App powered by the Inworld AI Runtime which analyzes meeting audio and video streams using RTMS APIs to provide live evaluation and guidance. It is based on the [Zoom RTMS Quickstart Guide](https://developers.zoom.us/docs/rtms/quickstart/#step-3-set-up-a-zoom-app-to-use-rtms) (follow that for instructions on setting up your Zoom app and granting RTMS scope permissions).

Check out the app demo video [here](https://www.youtube.com/watch?v=qq59yXBEWhg).

![App](screenshot.jpg)

<p align="center">
  <a href="https://www.youtube.com/watch?v=D58lVf55duI&list=PLs_RyYO6XhFvYZO7Y-_0f3_uAhNLpvIBK&index=1"><strong>Tutorial Videos</strong></a> ·
  <a href="https://docs.inworld.ai/docs/node/overview"><strong>Read Docs</strong></a> ·
  <a href="https://inworld.ai/runtime"><strong>Get Runtime</strong></a> ·
  <a href="https://docs.inworld.ai/docs/models#llm"><strong>Model Providers</strong></a>
</p>

## Requirements

- Inworld Runtime
- Node.js v20 or higher
- Zoom App with RTMS access
- Ngrok (using your free permanent URL) for local development

## Zoom Setup

1. Create your Zoom App following [this guide](https://developers.zoom.us/docs/rtms/quickstart/#step-3-set-up-a-zoom-app-to-use-rtms)
2. Set your Home, OAuth and Webhook URLs using your Ngrok permanent URL

## App Setup

1. Create an `.env` file (copying the `.env.example`) and put it in the project root
2. Copy your Base64 API key from the Inworld Portal
3. Add the following environment variables to the `.env` file:
   ```
   INWORLD_API_KEY=<your_api_key>
   ZM_RTMS_CLIENT=<your_zoom_client_id>
   ZM_RTMS_SECRET=<your_zoom_client_secret>
   ```
   Get `INWORLD_API_KEY` from your Inworld workspace, and the Zoom credentials from your Zoom App Marketplace page.
4. Run `npm install`
5. Run the app with `npm start`

## Local Development with ngrok

For local development, use ngrok to expose your server:

```bash
ngrok http --url=your-subdomain.ngrok-free.app 3000
```

Use the .env variables to control logging:

- LOG_LEVEL - App logging (ERROR or DEBUG)
- RTMS_LOG_LEVEL - RTMS SDK logging (disabled, error, warn, info, or debug)

Start a Zoom meeting and the app should be displayed. RTMS data should start coming through to the app.

## Troubleshooting

If you don't get RTMS data coming through to the app: 

- Double check your URLs and scopes in your [Zoom App Marketplace](https://marketplace.zoom.us/) page
- Check in your [Zoom Profile Settings - Zoom Apps](https://zoom.us/profile/setting) and make sure that `Share realtime meeting content with apps` is enabled and `Auto-start apps that access shared realtime meeting content` shows your app as being auto-started.
- Verify your ngrok tunnel is running and the URL matches your Zoom app configuration
- Check the console logs with `LOG_LEVEL=DEBUG` and `RTMS_LOG_LEVEL=debug` for detailed error messages

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.