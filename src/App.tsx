import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from './components/ui/button';
import { useToast } from './components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Upload, Video, WifiOff } from 'lucide-react';
import CustomVideoPlayer from './CustomVideoPlayer';
import './index.css';

const WEBSOCKET_URL = process.env.REACT_APP_WEBSOCKET_URL || "ws://localhost:8000/ws";
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 5000; // 5 seconds

interface VideoDetails {
  id: number;
  file: File;
  progress: number;
  videoUrl: string | null;
  isProcessing: boolean;
  status?: string;
}

interface WebSocketMessage {
  type: string;
  filename?: string;
  value?: number;
  video_url?: string;
  message?: string;
  status?: string;
}

const App: React.FC = () => {
  const [uploadQueue, setUploadQueue] = useState<VideoDetails[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [shouldReconnect, setShouldReconnect] = useState(true);
  const [isExplicitlyDisconnected, setIsExplicitlyDisconnected] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const confirmationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const processMessage = useCallback((data: WebSocketMessage) => {
    if (data.filename) {
      setUploadQueue(prevQueue =>
        prevQueue.map(task => {
          if (task.file.name === data.filename) {
            if (data.type === 'progress') {
              if (data.value === 100) {
                return { ...task, progress: data.value, isProcessing: true, status: 'Generating video...' };
              }
              return { ...task, progress: data.value || 0, isProcessing: true };
            } else if (data.type === 'complete') {
              const url = `${API_URL}${data.video_url}`;
              console.log("file url is : ", url);
              toast({
                title: 'Video generation complete!',
                description: `Video for ${data.filename} is ready to view.`,
              });
              return { ...task, videoUrl: url, isProcessing: false, progress: 100, status: 'Complete' };
            }
          }
          return task;
        })
      );
    }
  }, [toast]);

  const handleDisconnect = useCallback((event?: CloseEvent) => {
    console.log('Handling WebSocket disconnect', event);
    setIsConnected(false);
    
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    
    if (!isExplicitlyDisconnected && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
      toast({
        title: 'WebSocket Disconnected',
        description: `Attempting to reconnect... (Attempt ${reconnectAttemptsRef.current + 1}/${MAX_RECONNECT_ATTEMPTS})`,
        variant: 'destructive',
      });

      reconnectAttemptsRef.current++;
      setTimeout(() => {
        setShouldReconnect(true);
      }, RECONNECT_DELAY);
    } else if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      toast({
        title: 'Connection Failed',
        description: 'Maximum reconnection attempts reached. Please refresh the page.',
        variant: 'destructive',
      });
      setIsExplicitlyDisconnected(true);
    } else {
      toast({
        title: 'Connection Restricted',
        description: 'Another client is currently connected. Please try again later.',
        variant: 'destructive',
      });
    }
  }, [toast, isExplicitlyDisconnected]);

  const connectWebSocket = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN || !shouldReconnect || isExplicitlyDisconnected) {
      return;
    }

    console.log('Attempting to connect WebSocket');
    const newSocket = new WebSocket(WEBSOCKET_URL);

    newSocket.onopen = () => {
      console.log('WebSocket connection opened');
      // 5 seconds timeout to connect to Web Socket
      confirmationTimeoutRef.current = setTimeout(() => {
        console.log('No confirmation received, closing connection');
        newSocket.close(1000, "No confirmation received");
      }, 5000); 
    };

    newSocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('Received WebSocket message:', data);
      if (data.type === 'error' && data.message === 'Another client is already connected') {
        setIsExplicitlyDisconnected(true);
        newSocket.close();
      } else if (data.type === 'connection' && data.status === 'established') {
        if (confirmationTimeoutRef.current) {
          clearTimeout(confirmationTimeoutRef.current);
        }
        console.log('WebSocket connection fully established');
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        setShouldReconnect(false);
        setIsExplicitlyDisconnected(false);
        toast({
          title: 'WebSocket Connected',
          description: 'Ready to process images.',
        });
        socketRef.current = newSocket;

        // Send ping every 30 seconds
        pingIntervalRef.current = setInterval(() => {
          if (newSocket.readyState === WebSocket.OPEN) {
            newSocket.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      } else {
        processMessage(data);
      }
    };

    newSocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    newSocket.onclose = (event) => {
      console.log('WebSocket closed:', event);
      handleDisconnect(event);
    };

    socketRef.current = newSocket;
  }, [toast, processMessage, handleDisconnect, shouldReconnect, isExplicitlyDisconnected]);

  useEffect(() => {
    if (shouldReconnect && !isExplicitlyDisconnected) {
      connectWebSocket();
    }

    return () => {
      if (confirmationTimeoutRef.current) {
        clearTimeout(confirmationTimeoutRef.current);
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connectWebSocket, shouldReconnect, isExplicitlyDisconnected]);

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
    if (!isConnected) {
      toast({
        title: 'Upload failed',
        description: 'WebSocket is not connected. Please try again when connected.',
        variant: 'destructive',
      });
      return;
    }

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
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({
            action: 'start_processing',
            filename: filename
          }));
        } else {
          console.error('WebSocket is not open. Unable to start processing.');
          toast({
            title: 'Processing delayed',
            description: 'WebSocket is not connected. Processing will start when reconnected.',
            variant: 'destructive',
          });
        }
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
  }, [uploadQueue, toast, isConnected]);

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
                disabled={!isConnected || isExplicitlyDisconnected}
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
                disabled={!isConnected || isExplicitlyDisconnected}
              />
            </div>
          </div>
          {uploadQueue.length > 0 && (
            <div className="mt-6 space-y-6">
              {uploadQueue.map(task => {
                const filename = task.videoUrl 
                  ? task.videoUrl.split('/').pop()
                  : task.file.name;
                return (
                  <div key={task.id} className="bg-white shadow-sm rounded-lg p-4">
                    <h2 className="text-lg font-semibold mb-2">{filename}</h2>
                    {!task.videoUrl && (
                      <div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                          <div 
                            className="bg-blue-600 h-2.5 rounded-full" 
                            style={{ width: `${task.progress}%` }}
                          >
                          </div>
                        </div>
                        <p className="text-center mt-2 text-sm text-gray-600">
                          {task.status || `${task.progress}% complete`}
                        </p>
                      </div>
                    )}
                    {task.videoUrl && <CustomVideoPlayer src={task.videoUrl} />}
                  </div>
                );
              })}
            </div>      
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default App;