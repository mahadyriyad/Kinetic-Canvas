import React, { useEffect, useRef, useState } from 'react';
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { Camera, Hand, HandMetal, Navigation, Loader2, Trash2, Download, Scissors, PenTool, Sparkles, Eraser, Aperture, Palette, Music, Zap, Wand2 } from 'lucide-react';

type Gesture = 'None' | 'Open_Hand' | 'Closed_Fist' | 'Pinch' | 'Pointing' | 'Peace';

let globalThereminOsc: any = null;
let globalThereminGain: any = null;

const initTheremin = () => {
    if (globalThereminOsc) return;
    try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        globalThereminOsc = audioCtx.createOscillator();
        globalThereminGain = audioCtx.createGain();
        globalThereminOsc.type = 'sine';
        globalThereminGain.gain.value = 0;
        globalThereminOsc.connect(globalThereminGain);
        globalThereminGain.connect(audioCtx.destination);
        globalThereminOsc.start();
    } catch(e) {}
}

const updateTheremin = (active: boolean, x: number, y: number, w: number, h: number) => {
    if (!globalThereminOsc || !globalThereminGain) return;
    try {
       const ctx = globalThereminOsc.context;
       if (active) {
           const freq = 1200 - Math.min(1, Math.max(0, y / h)) * 1000;
           const vol = Math.max(0.01, Math.min(0.2, 0.2 * (x / w)));
           globalThereminOsc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.05);
           globalThereminGain.gain.setTargetAtTime(vol, ctx.currentTime, 0.05);
       } else {
           globalThereminGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
       }
    } catch(e) {}
}

const playSound = (type: 'hover' | 'click' | 'clear') => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (type === 'hover') {
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.02, audioCtx.currentTime);
      oscillator.start();
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
      oscillator.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'click') {
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(1200, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      oscillator.start();
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
      oscillator.stop(audioCtx.currentTime + 0.15);
    } else if (type === 'clear') {
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(200, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.3);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      oscillator.start();
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
      oscillator.stop(audioCtx.currentTime + 0.3);
    }
  } catch (e) {}
};

const COLORS = [
  { id: 'emerald', hex: '#10b981' },
  { id: 'cyan', hex: '#06b6d4' },
  { id: 'pink', hex: '#ec4899' },
  { id: 'yellow', hex: '#facc15' },
  { id: 'white', hex: '#ffffff' }
];

export default function HandGestureCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const staticCursorRef = useRef<HTMLDivElement>(null);
  
  const [isLoaded, setIsLoaded] = useState(false);
  const [gesture, setGesture] = useState<Gesture>('None');
  const [error, setError] = useState<string | null>(null);
  const [brushColor, setBrushColor] = useState('#10b981');
  const [brushMode, setBrushMode] = useState<'pen' | 'neon' | 'eraser'>('pen');
  const [brushSize, setBrushSize] = useState<number>(14);
  const [fxModes, setFxModes] = useState({ mandala: false, chroma: false, theremin: false, laser: false, starfield: false });
  
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const requestAnimationFrameRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);
  const lastFistClearTimeRef = useRef<number>(0);
  
  // Mutable refs for performance in loop
  const brushColorRef = useRef('#10b981');
  const brushModeRef = useRef(brushMode);
  const brushSizeRef = useRef(brushSize);
  const fxModesRef = useRef(fxModes);
  const particlesRef = useRef<any[]>([]);
  const isDrawingRef = useRef(false);
  const wasPinchingRef = useRef(false);
  const lastStarDrawTimeRef = useRef<number>(0);
  const smoothedCanvasPointRef = useRef<{x: number, y: number} | null>(null);
  const smoothedClientPointRef = useRef<{x: number, y: number} | null>(null);
  const lastDrawnPointRef = useRef<{x: number, y: number} | null>(null);
  const hoveredElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    brushColorRef.current = brushColor;
    brushModeRef.current = brushMode;
    brushSizeRef.current = brushSize;
    fxModesRef.current = fxModes;
  }, [brushColor, brushMode, brushSize, fxModes]);

  useEffect(() => {
     return () => {
         if (globalThereminOsc) {
             try { globalThereminOsc.stop(); } catch(e) {}
         }
         globalThereminOsc = null;
         globalThereminGain = null;
     };
  }, []);

  const initMediaPipe = async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12/wasm"
      );
      
      const landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 1,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      handLandmarkerRef.current = landmarker;
      startCamera();
    } catch (err) {
      console.error("Mediapipe load error:", err);
      setError("Failed to load AI models. Please check your connection.");
    }
  };

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera not supported.");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: "user" }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.addEventListener('loadeddata', () => {
          setIsLoaded(true);
          renderLoop();
        });
      }
    } catch (err: any) {
      setError(err.message || "Failed to access camera.");
    }
  };

  const calculateDistance = (p1: any, p2: any) => {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
  };
  
  const detectGesture = (landmarks: any[]): Gesture => {
    if (!landmarks || landmarks.length === 0) return 'None';
    const wrist = landmarks[0];
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];
    
    // Check extension by comparing tip vs PIP joint distance from wrist
    const isIndexExtended = calculateDistance(indexTip, wrist) > calculateDistance(landmarks[6], wrist);
    const isMiddleExtended = calculateDistance(middleTip, wrist) > calculateDistance(landmarks[10], wrist);
    const isRingExtended = calculateDistance(ringTip, wrist) > calculateDistance(landmarks[14], wrist);
    const isPinkyExtended = calculateDistance(pinkyTip, wrist) > calculateDistance(landmarks[18], wrist);

    const pinchDist = calculateDistance(thumbTip, indexTip);
    
    if (isIndexExtended && isMiddleExtended && !isRingExtended && !isPinkyExtended && pinchDist > 0.08) {
      return 'Peace';
    }
    if (pinchDist < 0.06) {
      return 'Pinch';
    }
    if (isIndexExtended && isMiddleExtended && isRingExtended && isPinkyExtended) {
      return 'Open_Hand';
    }
    if (!isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended) {
      return 'Closed_Fist';
    }
    if (isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended) {
      return 'Pointing';
    }
    return 'None';
  };

  const downloadCanvas = () => {
    if (!drawingCanvasRef.current) return;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = drawingCanvasRef.current.width;
    tempCanvas.height = drawingCanvasRef.current.height;
    const tCtx = tempCanvas.getContext('2d')!;
    
    // Fill background black for saving
    tCtx.fillStyle = '#000000';
    tCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    // Flip back because we drew mirrored
    tCtx.translate(tempCanvas.width, 0);
    tCtx.scale(-1, 1);
    tCtx.drawImage(drawingCanvasRef.current, 0, 0);
    
    const link = document.createElement('a');
    link.download = `handy-drawing.png`;
    link.href = tempCanvas.toDataURL('image/png');
    link.click();
  };

  const renderLoop = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const drawCanvas = drawingCanvasRef.current;
    const landmarker = handLandmarkerRef.current;
    const container = containerRef.current;
    const cursor = staticCursorRef.current;
    
    if (!video || !canvas || !landmarker || !drawCanvas || !container || !cursor) return;
    
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      requestAnimationFrameRef.current = requestAnimationFrame(renderLoop);
      return;
    }
    
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      drawCanvas.width = video.videoWidth;
      drawCanvas.height = video.videoHeight;
    }
    
    if (video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      const results = landmarker.detectForVideo(video, performance.now());
      const ctx = canvas.getContext('2d')!;
      const drawCtx = drawCanvas.getContext('2d')!;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (results.landmarks && results.landmarks.length > 0) {
        const handLandmarks = results.landmarks[0];
        
        // Draw Skeleton
        for (const landmark of handLandmarks) {
          ctx.beginPath();
          ctx.arc(landmark.x * canvas.width, landmark.y * canvas.height, 3, 0, 2 * Math.PI);
          ctx.fillStyle = '#10b981';
          ctx.fill();
        }
        
        const detectedGesture = detectGesture(handLandmarks);
        setGesture(detectedGesture);
        
        const indexTip = handLandmarks[8];
        const rect = container.getBoundingClientRect();
        
        // Smoothing Client Position (DOM)
        const targetClientX = Math.max(0, Math.min(rect.width, (1 - indexTip.x) * rect.width));
        const targetClientY = Math.max(0, Math.min(rect.height, indexTip.y * rect.height));
        
        if (!smoothedClientPointRef.current) {
          smoothedClientPointRef.current = { x: targetClientX, y: targetClientY };
        } else {
          smoothedClientPointRef.current.x += (targetClientX - smoothedClientPointRef.current.x) * 0.4;
          smoothedClientPointRef.current.y += (targetClientY - smoothedClientPointRef.current.y) * 0.4;
        }
        
        const cX = smoothedClientPointRef.current.x;
        const cY = smoothedClientPointRef.current.y;
        cursor.style.transform = `translate(${cX}px, ${cY}px)`;
        
        // Visual cursor state
        if (detectedGesture === 'Pinch') {
          cursor.style.borderColor = brushColorRef.current;
          cursor.style.backgroundColor = `${brushColorRef.current}40`;
          cursor.style.transform = `translate(${cX}px, ${cY}px) scale(0.8)`;
        } else {
          cursor.style.borderColor = 'white';
          cursor.style.backgroundColor = 'rgba(255,255,255,0.2)';
        }

        // --- Collision with UI ---
        let overUI = false;
        // Temporarily hide cursor for element detection to avoid hitting itself
        cursor.style.display = 'none';
        const globalX = rect.left + cX;
        const globalY = rect.top + cY;
        const elem = document.elementFromPoint(globalX, globalY) as HTMLElement;
        cursor.style.display = 'block';

        if (hoveredElementRef.current && hoveredElementRef.current !== elem) {
           hoveredElementRef.current.classList.remove('scale-125', 'brightness-125', 'z-50');
           hoveredElementRef.current = null;
        }

        if (elem) {
          const action = elem.getAttribute('data-action');
          if (action) {
            overUI = true;
            if (hoveredElementRef.current !== elem) {
               elem.classList.add('scale-125', 'brightness-125', 'z-50');
               hoveredElementRef.current = elem;
               playSound('hover');
            }
            
            // Trigger action ONLY on initial Pinch (simulate Click)
            if (detectedGesture === 'Pinch' && !wasPinchingRef.current) {
              playSound('click');
              initTheremin();
              const val = elem.getAttribute('data-value');
              if (action === 'color' && val) {
                setBrushColor(val);
              } else if (action === 'mode' && val) {
                setBrushMode(val as any);
              } else if (action === 'size' && val) {
                setBrushSize(parseInt(val));
              } else if (action === 'fx' && val) {
                setFxModes(prev => ({ ...prev, [val]: !prev[val as keyof typeof fxModes] }));
              } else if (action === 'clear') {
                drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
                playSound('clear');
              } else if (action === 'download') {
                downloadCanvas();
              }
            }
          }
        }
        
        wasPinchingRef.current = (detectedGesture === 'Pinch');

        // --- Drawing Logic ---
        const targetCanvasX = indexTip.x * canvas.width;
        const targetCanvasY = indexTip.y * canvas.height;
        
        if (!smoothedCanvasPointRef.current) {
          smoothedCanvasPointRef.current = { x: targetCanvasX, y: targetCanvasY };
        } else {
          smoothedCanvasPointRef.current.x += (targetCanvasX - smoothedCanvasPointRef.current.x) * 0.4;
          smoothedCanvasPointRef.current.y += (targetCanvasY - smoothedCanvasPointRef.current.y) * 0.4;
        }

        const screenX = smoothedCanvasPointRef.current.x;
        const screenY = smoothedCanvasPointRef.current.y;

        const currentColor = fxModesRef.current.chroma ? `hsl(${(Date.now() / 15) % 360}, 100%, 50%)` : brushColorRef.current;

        // Theremin Update
        if (fxModesRef.current.theremin && detectedGesture === 'Pointing') {
            updateTheremin(true, screenX, screenY, canvas.width, canvas.height);
        } else {
            updateTheremin(false, 0, 0, 1, 1);
        }

        // Laser Draw
        if (fxModesRef.current.laser && detectedGesture === 'Pointing' && !overUI) {
            const corners = [
                {x: 0, y: 0}, {x: canvas.width, y: 0},
                {x: 0, y: canvas.height}, {x: canvas.width, y: canvas.height}
            ];
            ctx.lineWidth = 2;
            ctx.strokeStyle = currentColor;
            ctx.shadowBlur = 10;
            ctx.shadowColor = currentColor;
            corners.forEach(c => {
                ctx.beginPath();
                ctx.moveTo(c.x, c.y);
                ctx.lineTo(screenX, screenY);
                ctx.stroke();
            });
            ctx.shadowBlur = 0;
        }

        if (detectedGesture === 'Pinch' && !overUI) {
          if (!isDrawingRef.current) {
            isDrawingRef.current = true;
            lastDrawnPointRef.current = { x: screenX, y: screenY };
          } else if (lastDrawnPointRef.current) {
            
            if (brushModeRef.current === 'eraser') {
               drawCtx.globalCompositeOperation = 'destination-out';
               drawCtx.lineWidth = brushSizeRef.current * 3;
               drawCtx.strokeStyle = 'rgba(0,0,0,1)';
               drawCtx.shadowBlur = 0;
            } else {
               drawCtx.globalCompositeOperation = 'source-over';
               drawCtx.lineWidth = brushSizeRef.current;
               drawCtx.strokeStyle = currentColor;
               
               if (brushModeRef.current === 'neon') {
                  drawCtx.shadowBlur = Math.min(30, brushSizeRef.current * 1.5);
                  drawCtx.shadowColor = currentColor;
               } else {
                  drawCtx.shadowBlur = 0;
               }
            }
            
            drawCtx.lineCap = 'round';
            drawCtx.lineJoin = 'round';

            const drawStroke = (x1: number, y1: number, x2: number, y2: number) => {
                drawCtx.beginPath();
                drawCtx.moveTo(x1, y1);
                drawCtx.lineTo(x2, y2);
                drawCtx.stroke();
            }

            if (fxModesRef.current.mandala && brushModeRef.current !== 'eraser') {
                const cx = canvas.width / 2;
                const cy = canvas.height / 2;
                const segments = 6;
                for (let i = 0; i < segments; i++) {
                    drawCtx.save();
                    drawCtx.translate(cx, cy);
                    drawCtx.rotate(i * (Math.PI * 2 / segments));
                    drawStroke(lastDrawnPointRef.current.x - cx, lastDrawnPointRef.current.y - cy, screenX - cx, screenY - cy);
                    drawCtx.restore();
                }
            } else {
                drawStroke(lastDrawnPointRef.current.x, lastDrawnPointRef.current.y, screenX, screenY);
            }
            
            drawCtx.globalCompositeOperation = 'source-over';
            drawCtx.shadowBlur = 0;
            
            lastDrawnPointRef.current = { x: screenX, y: screenY };

            // Emit particles
            if (fxModesRef.current.starfield && brushModeRef.current !== 'eraser') {
                particlesRef.current.push({
                    x: screenX, y: screenY,
                    vx: (Math.random() - 0.5) * 8,
                    vy: (Math.random() - 0.5) * 8,
                    life: 1.0,
                    color: currentColor
                });
            }
          }
          
          // Draw tracking point on skeleton layer
          ctx.beginPath();
          ctx.arc(screenX, screenY, Math.max(2, brushSizeRef.current / 2), 0, 2 * Math.PI);
          ctx.fillStyle = brushModeRef.current === 'eraser' ? '#ffffff' : currentColor;
          ctx.fill();
        } else {
          isDrawingRef.current = false;
          lastDrawnPointRef.current = null;
          
          if (detectedGesture === 'Peace' && !overUI) {
            if (Date.now() - lastStarDrawTimeRef.current > 50) {
              // Draw star stamp
              drawCtx.save();
              drawCtx.translate(screenX, screenY);
              const rot = Math.random() * Math.PI * 2;
              drawCtx.rotate(rot);
              drawCtx.fillStyle = currentColor;
              drawCtx.shadowColor = currentColor;
              drawCtx.shadowBlur = 15;
              drawCtx.beginPath();
              for (let i = 0; i < 5; i++) {
                  drawCtx.lineTo(Math.cos((18 + i * 72) / 180 * Math.PI) * brushSizeRef.current * 1.5,
                                  -Math.sin((18 + i * 72) / 180 * Math.PI) * brushSizeRef.current * 1.5);
                  drawCtx.lineTo(Math.cos((54 + i * 72) / 180 * Math.PI) * brushSizeRef.current * 0.5,
                                  -Math.sin((54 + i * 72) / 180 * Math.PI) * brushSizeRef.current * 0.5);
              }
              drawCtx.closePath();
              drawCtx.fill();
              drawCtx.restore();
              
              ctx.beginPath();
              ctx.arc(screenX, screenY, brushSizeRef.current * 1.5, 0, 2 * Math.PI);
              ctx.fillStyle = currentColor;
              ctx.fill();
              
              playSound('hover');
              lastStarDrawTimeRef.current = Date.now();
            }
          }
          
          if (detectedGesture === 'Closed_Fist') {
            if (Date.now() - lastFistClearTimeRef.current > 2000) {
              drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
              playSound('clear');
              lastFistClearTimeRef.current = Date.now();
            }
          }
        }

        // Particle logic
        if (particlesRef.current.length > 0) {
            particlesRef.current.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.2; // gravity
                p.life -= 0.03;
                if (p.life > 0) {
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.life * (brushSizeRef.current / 2), 0, 2*Math.PI);
                    ctx.fillStyle = p.color;
                    ctx.globalAlpha = p.life;
                    ctx.fill();
                    ctx.globalAlpha = 1.0;
                }
            });
            particlesRef.current = particlesRef.current.filter(p => p.life > 0);
        }
        
        cursor.style.opacity = '1';
      } else {
        setGesture('None');
        updateTheremin(false, 0, 0, 1, 1);
        isDrawingRef.current = false;
        lastDrawnPointRef.current = null;
        cursor.style.opacity = '0';
      }
    }
    
    requestAnimationFrameRef.current = requestAnimationFrame(renderLoop);
  };

  useEffect(() => {
    initMediaPipe();
    return () => {
      if (requestAnimationFrameRef.current) cancelAnimationFrame(requestAnimationFrameRef.current);
      if (handLandmarkerRef.current) handLandmarkerRef.current.close();
      if (videoRef.current?.srcObject) {
         (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  return (
    <div ref={containerRef} className="flex flex-col h-full bg-black border border-emerald-500/30 overflow-hidden relative max-w-5xl mx-auto w-full aspect-video z-10 cursor-none">
      {!isLoaded && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-40 backdrop-blur-sm font-mono">
          <div className="w-12 h-12 border-2 border-emerald-500/50 rounded-full flex items-center justify-center animate-pulse mb-4">
            <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
          </div>
          <h2 className="text-[10px] font-bold text-emerald-400 tracking-widest uppercase mb-1">INITIALIZING_SKELETON_MAP...</h2>
          <p className="text-slate-500 text-[10px]">AWAITING_CAMERA_FEED</p>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-40 backdrop-blur-sm font-mono">
          <div className="bg-[#141418] border border-red-500/50 p-4 mb-4">
             <Camera className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-[10px] font-bold text-red-400 max-w-md text-center uppercase tracking-widest">{error}</h2>
        </div>
      )}

      {/* Floating System Cursor */}
      <div 
        ref={staticCursorRef}
        className="absolute top-0 left-0 w-8 h-8 -ml-4 -mt-4 rounded-full border-2 border-white bg-white/20 pointer-events-none z-50 transition-colors duration-200"
        style={{ opacity: 0 }}
      >
        <div className="absolute inset-0 m-auto w-1 h-1 bg-white rounded-full"></div>
      </div>

      {/* Toolbar / Actions Overlay */}
      <div className="absolute top-1/2 -translate-y-1/2 left-4 flex flex-col gap-4 z-30 font-mono">
        <div className="bg-[#141418]/80 backdrop-blur-md p-2 border border-slate-800 flex flex-col gap-3 rounded-lg">
          {COLORS.map(c => (
             <div 
               key={c.id}
               data-action="color"
               data-value={c.hex}
               className={`w-10 h-10 rounded-full border-2 transition-all duration-200 cursor-pointer ${brushColor === c.hex ? 'border-white !scale-110 shadow-[0_0_15px_rgba(255,255,255,0.4)]' : 'border-transparent'}`}
               style={{ backgroundColor: c.hex }}
             />
          ))}
          
          <div className="w-full h-px bg-slate-700 my-1" />
          
          <div 
             data-action="clear"
             className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-red-500 transition-all duration-200"
          >
             <Trash2 className="w-5 h-5 pointer-events-none" />
          </div>

          <div 
             data-action="download"
             className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-500 transition-all duration-200"
          >
             <Download className="w-5 h-5 pointer-events-none" />
          </div>
        </div>

        {/* FX Modules Box */}
        <div className="bg-[#141418]/80 backdrop-blur-md p-2 border border-slate-800 flex flex-col gap-3 rounded-lg text-emerald-400 mt-2">
          <div data-action="fx" data-value="mandala" className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer ${fxModes.mandala ? 'bg-indigo-500/20 text-indigo-400 border-2 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.4)]' : 'bg-slate-800 border border-slate-700 text-slate-400'}`}>
              <Aperture className="w-5 h-5 pointer-events-none" />
          </div>
          <div data-action="fx" data-value="chroma" className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer ${fxModes.chroma ? 'bg-rose-500/20 text-rose-400 border-2 border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.4)]' : 'bg-slate-800 border border-slate-700 text-slate-400'}`}>
              <Palette className="w-5 h-5 pointer-events-none" />
          </div>
          <div data-action="fx" data-value="theremin" className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer ${fxModes.theremin ? 'bg-amber-500/20 text-amber-400 border-2 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.4)]' : 'bg-slate-800 border border-slate-700 text-slate-400'}`}>
              <Music className="w-5 h-5 pointer-events-none" />
          </div>
          <div data-action="fx" data-value="laser" className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer ${fxModes.laser ? 'bg-cyan-500/20 text-cyan-400 border-2 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'bg-slate-800 border border-slate-700 text-slate-400'}`}>
              <Zap className="w-5 h-5 pointer-events-none" />
          </div>
          <div data-action="fx" data-value="starfield" className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer ${fxModes.starfield ? 'bg-purple-500/20 text-purple-400 border-2 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'bg-slate-800 border border-slate-700 text-slate-400'}`}>
              <Wand2 className="w-5 h-5 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Right Toolbar / Tools Overlay */}
      <div className="absolute top-1/2 -translate-y-1/2 right-4 flex flex-col gap-4 z-30 font-mono">
        <div className="bg-[#141418]/80 backdrop-blur-md p-2 border border-slate-800 flex flex-col gap-3 rounded-lg text-emerald-400">
          <div 
             data-action="mode"
             data-value="pen"
             className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer ${brushMode === 'pen' ? 'bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-slate-800 border border-slate-700 text-slate-400'}`}
          >
             <PenTool className="w-5 h-5 pointer-events-none" />
          </div>
          <div 
             data-action="mode"
             data-value="neon"
             className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer ${brushMode === 'neon' ? 'bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-slate-800 border border-slate-700 text-slate-400'}`}
          >
             <Sparkles className="w-5 h-5 pointer-events-none" />
          </div>
          <div 
             data-action="mode"
             data-value="eraser"
             className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer ${brushMode === 'eraser' ? 'bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-slate-800 border border-slate-700 text-slate-400'}`}
          >
             <Eraser className="w-5 h-5 pointer-events-none" />
          </div>

          <div className="w-full h-px bg-slate-700 my-1" />

          {/* SIZES */}
          <div 
             data-action="size"
             data-value="6"
             className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer ${brushSize === 6 ? 'bg-slate-700 text-emerald-400 border border-emerald-500' : 'bg-slate-800 border border-slate-700 text-slate-400'}`}
          >
             <div className="w-1.5 h-1.5 bg-current rounded-full pointer-events-none" />
          </div>
          <div 
             data-action="size"
             data-value="14"
             className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer ${brushSize === 14 ? 'bg-slate-700 text-emerald-400 border border-emerald-500' : 'bg-slate-800 border border-slate-700 text-slate-400'}`}
          >
             <div className="w-3 h-3 bg-current rounded-full pointer-events-none" />
          </div>
          <div 
             data-action="size"
             data-value="26"
             className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer ${brushSize === 26 ? 'bg-slate-700 text-emerald-400 border border-emerald-500' : 'bg-slate-800 border border-slate-700 text-slate-400'}`}
          >
             <div className="w-5 h-5 bg-current rounded-full pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Video layer */}
      <video ref={videoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover scale-x-[-1] opacity-40 pointer-events-none" />
      
      {/* Drawing layer */}
      <canvas ref={drawingCanvasRef} className="absolute inset-0 w-full h-full scale-x-[-1] pointer-events-none z-10" />
      
      {/* Landmarks tracking layer */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full scale-x-[-1] pointer-events-none z-20" />

      {/* Active Status Display */}
      <div className="absolute bottom-4 right-4 flex bg-[#141418]/80 backdrop-blur-md p-3 border border-slate-800 shadow-xl items-center space-x-3 z-30 font-mono select-none">
        <div className="p-2 border border-emerald-800 bg-[#0F0F12]">
           {gesture === 'Open_Hand' && <Hand className="w-6 h-6 text-emerald-400" />}
           {gesture === 'Closed_Fist' && <HandMetal className="w-6 h-6 text-emerald-400" />}
           {gesture === 'Pinch' && <div className="w-6 h-6 border-2 border-emerald-500 bg-emerald-500/20" />}
           {gesture === 'Pointing' && <Navigation className="w-6 h-6 text-emerald-400 transform rotate-45" />}
           {gesture === 'Peace' && <Scissors className="w-6 h-6 text-pink-400 transform -rotate-90" />}
           {gesture === 'None' && <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />}
        </div>
        <div>
          <p className="text-[9px] font-bold tracking-widest text-slate-500 uppercase mb-0.5">Gest_Dect</p>
          <p className="text-xs font-bold text-emerald-400 tracking-wider uppercase">
             {gesture.replace('_', ' ')}
          </p>
        </div>
      </div>
      
      {/* Help Overlay */}
      <div className="absolute top-4 right-4 bg-[#141418]/80 py-2 px-3 border border-slate-800 z-30 font-mono text-[9px] text-slate-400 text-right select-none leading-relaxed">
        <p><span className="text-emerald-400 font-bold">PINCH:</span> Hover on Buttons & Pinch to click.</p>
        <p><span className="text-emerald-400 font-bold">PINCH & DRAG:</span> Draw on canvas.</p>
        <p><span className="text-pink-400 font-bold">PEACE SIGN:</span> Draw Magic Stars.</p>
        <p><span className="text-cyan-400 font-bold">POINTING:</span> Play Theremin or Shoot Lasers.</p>
        <p><span className="text-red-400 font-bold">CLOSED FIST:</span> Clear Canvas.</p>
      </div>
    </div>
  );
}
