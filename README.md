# Simulated AI Video Generator

This is a React-based web application that allows users to upload multiple images and transform them into videos using Simulated AI processing. The application provides a user-friendly interface for uploading images, monitoring processing updates, and viewing the generated videos.

## Features

- Upload multiple images
- Real-time progress tracking
- WebSocket integration for live updates
- Responsive design
- Custom video player for generated videos

## Prerequisites

- Node.js (v14 or later)
- npm (v6 or later)

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/ai-video-generator.git
   cd ai-video-generator
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up environment variables:
   Update the contents of `.env.development` file in the root directory for running locally and add the following:
   ```
   REACT_APP_WEBSOCKET_URL=ws://your-backend-url/ws
   REACT_APP_API_URL=http://your-backend-url
   ```
   Replace `your-backend-url` with the actual URL of your local backend server.

   Similarly, for production build use `.env.production` file

## Usage

1. Start the development server:
   ```
   npm start
   ```

2. Open [http://localhost:3000](http://localhost:3000) in your browser to use the application.

3. Click on "Choose files and generate video" to select and upload images.

4. Monitor the progress bar for each uploaded image.

5. Once processing is complete, view the generated video using the built-in video player.

## Building for Production

To create a production build, run:
```
npm run build
```

The built files will be in the `build` folder, ready for deployment.

## Technologies Used

- React
- TypeScript
- WebSocket for real-time communication
- Tailwind CSS for styling
- Lucide React for icons

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.