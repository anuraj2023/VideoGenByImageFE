import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from './components/ui/button';
import { useToast } from './components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Upload, Video, WifiOff } from 'lucide-react';
import CustomVideoPlayer from './CustomVideoPlayer';
import './index.css';

const WEBSOCKET_URL = process.env.REACT_APP_WEBSOCKET_URL || "ws://localhost:8000/ws";
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

interface VideoDetails {
  id: number;
  file: File;
  progress: number;
  videoUrl: string | null;
  isProcessing: boolean;
}

const App: React.FC = () => {
  const [uploadQueue, setUploadQueue] = useState<VideoDetails[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connectWebSocket = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const newSocket = new WebSocket(WEBSOCKET_URL);

    newSocket.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      toast({
        title: 'WebSocket Connected',
        description: 'Ready to process images.',
      });
      socketRef.current = newSocket;
    };

    newSocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('Received WebSocket message:', data);
      setUploadQueue(prevQueue =>
        prevQueue.map(task => {
          if (task.file.name === data.filename) {
            if (data.type === 'progress') {
              return { ...task, progress: data.value, isProcessing: true };
            } else if (data.type === 'complete') {
              const url = `${API_URL}${data.video_url}`;
              console.log("file url is : ", url);
              return { ...task, videoUrl: url, isProcessing: false, progress: 100 };
            }
          }
          return task;
        })
      );
      if (data.type === 'complete') {
        toast({
          title: 'Video generation complete!',
          description: `Video for ${data.filename} is ready to view.`,
        });
      }
    };

    newSocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
      toast({
        title: 'WebSocket Error',
        description: 'There was an error with the WebSocket connection.',
        variant: 'destructive',
      });
    };

    newSocket.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
      toast({
        title: 'WebSocket Disconnected',
        description: 'Attempting to reconnect...',
        variant: 'destructive',
      });
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, 5000);
    };

    socketRef.current = newSocket;
  }, [toast]);

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connectWebSocket]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const files = Array.from(event.target.files);
      setUploadQueue(prevQueue => [
        ...prevQueue,
        ...files.map((file, index) => ({
          id: prevQueue.length + index + 1,
          file,
          progress: 0,
          videoUrl: null,
          isProcessing: false,
        })),
      ]);
    }
  };

  const uploadAllFiles = useCallback(async () => {
    const formData = new FormData();
    uploadQueue.forEach(task => {
      if (!task.isProcessing) {
        formData.append('files', task.file);
      }
    });

    try {
      const response = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      setUploadQueue(prevQueue =>
        prevQueue.map(task => ({
          ...task,
          isProcessing: true,
        }))
      );

      data.files.forEach((filename: string) => {
        socketRef.current?.send(JSON.stringify({
          action: 'start_processing',
          filename: filename
        }));
      });

      toast({
        title: 'Upload successful',
        description: 'Your images are being processed.',
      });
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Upload failed',
        description: 'There was an error uploading your images. Please try again.',
        variant: 'destructive',
      });
    }
  }, [uploadQueue, toast]);

  useEffect(() => {
    if (uploadQueue.some(task => !task.isProcessing)) {
      uploadAllFiles();
    }
  }, [uploadQueue, uploadAllFiles]);

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="max-w-3xl mx-auto bg-white shadow-lg rounded-lg overflow-hidden">
        <CardHeader className="bg-blue-800 text-white p-6">
          <CardTitle className="text-2xl font-bold flex items-center justify-between">
            <div className="flex items-center">
              <Video className="mr-2 w-6 h-6" /> Simulated AI Video Generator
            </div>
            {!isConnected && (
              <div className="flex items-center text-red-300">
                <WifiOff className="mr-2 w-5 h-5" /> Disconnected
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="mb-6">
            <label htmlFor="file-upload" className="block text-lg font-medium text-gray-700 mb-2">
              Choose one or more images
            </label>
            <div className="mt-1 flex items-center">
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center px-4 py-2 bg-blue-500 text-white border border-transparent rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                disabled={!isConnected}
              >
                <Upload className="mr-2 w-5 h-5" /> Choose files and generate video
              </Button>
              <input
                ref={fileInputRef}
                id="file-upload"
                name="file-upload"
                type="file"
                className="sr-only"
                onChange={handleFileChange}
                accept="image/*"
                multiple
                disabled={!isConnected}
              />
            </div>
          </div>
          {uploadQueue.length > 0 && (
            <div className="mt-6 space-y-6">
              {uploadQueue.map(task => (
                <div key={task.id} className="bg-white shadow-sm rounded-lg p-4">
                  <h2 className="text-lg font-semibold mb-2">{task.file.name}</h2>
                  {!task.videoUrl && (
                    <>
                      <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                        <div 
                          className="bg-blue-600 h-2.5 rounded-full" 
                          style={{ width: `${task.progress}%` }}
                        ></div>
                      </div>
                      <p className="text-center mt-2 text-sm text-gray-600">{task.progress}% complete</p>
                    </>
                  )}
                  {task.videoUrl && <CustomVideoPlayer src={task.videoUrl} />}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default App;