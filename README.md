# Zoom Demeanor Evaluator

A Zoom App powered by Inworld AI Runtime that analyzes meeting audio and video streams using RTMS APIs to provide live evaluation and guidance. This template demonstrates real-time meeting content analysis integrated with Inworld's AI capabilities.

Check out the [app demo video](https://www.youtube.com/watch?v=qq59yXBEWhg).

![App](screenshot.jpg)

<p align="center">
  <a href="https://www.youtube.com/watch?v=D58lVf55duI&list=PLs_RyYO6XhFvYZO7Y-_0f3_uAhNLpvIBK&index=1"><strong>Tutorial Videos</strong></a> ·
  <a href="https://docs.inworld.ai/docs/node/overview"><strong>Read Docs</strong></a> ·
  <a href="https://inworld.ai/runtime"><strong>Get Runtime</strong></a> ·
  <a href="https://docs.inworld.ai/docs/models#llm"><strong>Model Providers</strong></a>
</p>

## Prerequisites

- Node.js (v20 or higher)
- Zoom App with RTMS access
- Ngrok (using your free permanent URL) for local development
- An Inworld AI account and API key

## Get Started

### Step 1: Set Up Zoom App

Create your Zoom App following the [Zoom RTMS Quickstart Guide](https://developers.zoom.us/docs/rtms/quickstart/#step-3-set-up-a-zoom-app-to-use-rtms). This guide includes instructions on setting up your Zoom app and granting RTMS scope permissions.

Set your Home, OAuth and Webhook URLs using your Ngrok permanent URL.

### Step 2: Clone the Repository

```bash
git clone https://github.com/inworld-ai/zoom-demeanor-evaluator-node
cd zoom-demeanor-evaluator-node
```

### Step 3: Install Dependencies

```bash
npm install
```

### Step 4: Configure Environment Variables

Create a `.env` file (copying the `.env.example`) in the project root:

```bash
INWORLD_API_KEY=your_api_key_here
ZM_RTMS_CLIENT=your_zoom_client_id
ZM_RTMS_SECRET=your_zoom_client_secret
```

Get `INWORLD_API_KEY` from your Inworld workspace, and the Zoom credentials from your Zoom App Marketplace page.

**Optional Logging Variables:**

- `LOG_LEVEL` - App logging (ERROR or DEBUG)
- `RTMS_LOG_LEVEL` - RTMS SDK logging (disabled, error, warn, info, or debug)

### Step 5: Set Up Ngrok for Local Development

For local development, use ngrok to expose your server:

```bash
ngrok http --url=your-subdomain.ngrok-free.app 3000
```

### Step 6: Run the Application

```bash
npm start
```

Start a Zoom meeting and the app should be displayed. RTMS data should start coming through to the app.

## Repo Structure

```
zoom-demeanor-evaluator-node/
├── src/
│   ├── inworld/          # Inworld AI integration
│   │   ├── evaluationGraph.js
│   │   ├── guidanceGraph.js
│   │   ├── inworldService.js
│   │   └── visualEvalGraph.js
│   ├── rtms/             # Zoom RTMS integration
│   │   └── websocketHandler.js
│   └── utils/            # Helper utilities
│       ├── applyHeaders.js
│       └── logging.js
├── public/               # Frontend assets
│   ├── css/
│   ├── js/
│   └── index.html
├── index.js              # Entry point
├── package.json          # Dependencies
└── LICENSE               # MIT License
```

## Troubleshooting

If you don't get RTMS data coming through to the app:

- Double check your URLs and scopes in your [Zoom App Marketplace](https://marketplace.zoom.us/) page
- Check in your [Zoom Profile Settings - Zoom Apps](https://zoom.us/profile/setting) and make sure that `Share realtime meeting content with apps` is enabled and `Auto-start apps that access shared realtime meeting content` shows your app as being auto-started
- Verify your ngrok tunnel is running and the URL matches your Zoom app configuration
- Check the console logs with `LOG_LEVEL=DEBUG` and `RTMS_LOG_LEVEL=debug` for detailed error messages

**Bug Reports**: [GitHub Issues](https://github.com/inworld-ai/zoom-demeanor-evaluator-node/issues)

**General Questions**: For general inquiries and support, please email us at support@inworld.ai

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
