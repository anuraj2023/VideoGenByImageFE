// src/App.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "./components/ui/button";
import { Progress } from "./components/ui/progress";
import { useToast } from "./components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Upload, Video } from 'lucide-react';
import './globals.css';

const App: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const handleWebSocketMessage = useCallback((event: MessageEvent) => {
    const data = JSON.parse(event.data);
    if (data.type === 'progress') {
      setProgress(data.value);
    } else if (data.type === 'complete') {
      setVideoUrl(data.video_url);
      toast({
        title: "Video generation complete!",
        description: "Your video is now ready to view.",
      });
    }
  }, [toast]);

  useEffect(() => {
    const socket = new WebSocket('ws://localhost:8000/ws');
    socket.onmessage = handleWebSocketMessage;

    return () => {
      socket.close();
    };
  }, [handleWebSocketMessage]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      toast({
        title: "Upload successful",
        description: "Your image has been uploaded and is being processed.",
      });
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Upload failed",
        description: "There was an error uploading your image. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="max-w-md mx-auto bg-white shadow-xl rounded-lg overflow-hidden">
        <CardHeader className="bg-gray-800 text-white p-6">
          <CardTitle className="text-2xl font-bold flex items-center">
            <Video className="mr-2" /> LeyLine Video Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="mb-6">
            <label htmlFor="file-upload" className="block text-xl font-medium text-gray-700 mb-2">
              Choose an image
            </label>
            <div className="mt-1 flex">
              <label
                htmlFor="file-upload"
                className="cursor-pointer bg-blue-50 text-blue-700 px-4 py-2 rounded-l-md border border-gray-300 font-medium text-sm hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 h-10 flex items-center"
              >
                Choose file
              </label>
              <span className="flex-1 px-3 py-2 text-gray-500 bg-gray-50 rounded-r-md border border-l-0 border-gray-300 h-10 flex items-center">
                {selectedFile ? selectedFile.name : "No file chosen"}
              </span>
              <input
                id="file-upload"
                name="file-upload"
                type="file"
                className="sr-only"
                onChange={handleFileChange}
                accept="image/*"
              />
            </div>
          </div>
          <Button
            onClick={handleUpload}
            disabled={!selectedFile}
            className="w-full flex items-center justify-center bg-blue-500 hover:bg-blue-600 text-white h-10"
          >
            <Upload className="mr-2" /> Upload and Generate Video
          </Button>
          {progress > 0 && progress < 100 && (
            <div className="mt-6">
              <Progress value={progress} className="w-full h-2" />
              <p className="text-center mt-2 text-sm text-gray-600">{progress}% complete</p>
            </div>
          )}
          {videoUrl && (
            <div className="mt-6">
              <h2 className="text-lg font-semibold mb-2">Generated Video</h2>
              <video src={videoUrl} controls className="w-full rounded-lg shadow-md" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default App;