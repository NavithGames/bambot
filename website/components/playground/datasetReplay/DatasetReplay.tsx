"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { JointDetails } from "../RobotLoader";

type DatasetReplayProps = {
  show: boolean;
  onHide: () => void;
  jointDetails: JointDetails[];
  onSync: (angles: { servoId: number; angle: number }[]) => void;
};

type EpisodeData = {
  state: number[];
  action: number[];
}[];

type DatasetJson = {
  total_episodes: number;
  episodes: { [key: string]: EpisodeData };
};

export default function DatasetReplay({
  show,
  onHide,
  jointDetails,
  onSync,
}: DatasetReplayProps) {
  const [dataset, setDataset] = useState<DatasetJson | null>(null);
  const [episode, setEpisode] = useState(0);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [fps, setFps] = useState(30);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load dataset
  useEffect(() => {
    fetch("/datasets/svla_so101_pickplace.json")
      .then((r) => r.json())
      .then((data: DatasetJson) => setDataset(data))
      .catch((e) => console.error("Failed to load dataset:", e));
  }, []);

  const currentEpisode = dataset?.episodes[episode] || [];

  // Sync frame to 3D model
  const syncFrame = useCallback(
    (frameIdx: number) => {
      if (!currentEpisode[frameIdx]) return;
      const state = currentEpisode[frameIdx].state;
      // Map state values to servo IDs (joint 0->servo 1, etc.)
      const revoluteJoints = jointDetails.filter(
        (j) => j.jointType === "revolute"
      );
      const angles = revoluteJoints.map((j, i) => ({
        servoId: j.servoId,
        // Convert from dataset range to servo degrees (dataset is already in degrees-ish)
        // bambot expects 0-360 range, dataset is roughly -100 to 100
        // Offset by 180 to match bambot's center position
        angle: (state[i] ?? 0) + 180,
      }));
      onSync(angles);
    },
    [currentEpisode, jointDetails, onSync]
  );

  // Play loop
  useEffect(() => {
    if (playing && currentEpisode.length > 0) {
      timerRef.current = setInterval(() => {
        setFrame((prev) => {
          const next = prev + 1;
          if (next >= currentEpisode.length) {
            setPlaying(false);
            return prev;
          }
          syncFrame(next);
          return next;
        });
      }, 1000 / fps);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [playing, fps, currentEpisode, syncFrame]);

  // Sync on frame change (manual seek)
  useEffect(() => {
    if (!playing) syncFrame(frame);
  }, [frame, playing, syncFrame]);

  if (!show) return null;

  return (
    <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-sm rounded-lg p-4 text-white w-80 z-50">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold text-sm text-cyan-400">
          Dataset Replay
        </h3>
        <button
          onClick={onHide}
          className="text-gray-400 hover:text-white text-lg"
        >
          ×
        </button>
      </div>

      {!dataset ? (
        <div className="text-gray-400 text-sm">Loading dataset...</div>
      ) : (
        <>
          <div className="mb-3">
            <label className="text-xs text-gray-400">Episode</label>
            <select
              value={episode}
              onChange={(e) => {
                setEpisode(parseInt(e.target.value));
                setFrame(0);
                setPlaying(false);
              }}
              className="w-full bg-gray-800 rounded px-2 py-1 text-sm mt-1"
            >
              {Array.from({ length: dataset.total_episodes }, (_, i) => (
                <option key={i} value={i}>
                  Episode {i} ({dataset.episodes[i]?.length || 0} frames)
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setPlaying(!playing)}
              className={`flex-1 py-1 rounded text-sm font-bold ${
                playing
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-cyan-500 hover:bg-cyan-600"
              }`}
            >
              {playing ? "Pause" : "Play"}
            </button>
            <button
              onClick={() => {
                setFrame(0);
                setPlaying(false);
              }}
              className="px-3 py-1 rounded text-sm bg-gray-700 hover:bg-gray-600"
            >
              Reset
            </button>
          </div>

          <div className="mb-3">
            <input
              type="range"
              min={0}
              max={Math.max(0, currentEpisode.length - 1)}
              value={frame}
              onChange={(e) => {
                setPlaying(false);
                setFrame(parseInt(e.target.value));
              }}
              className="w-full"
            />
            <div className="text-xs text-gray-400 text-center">
              Frame {frame} / {currentEpisode.length - 1}
            </div>
          </div>

          {/* Joint values */}
          <div className="space-y-1">
            {["shoulder_pan", "shoulder_lift", "elbow_flex", "wrist_flex", "wrist_roll", "gripper"].map(
              (name, i) => {
                const val = currentEpisode[frame]?.state[i] ?? 0;
                const pct = Math.max(0, Math.min(100, ((val + 100) / 200) * 100));
                return (
                  <div key={name} className="flex items-center gap-2">
                    <span className="text-xs w-24 text-gray-300 truncate">
                      {name}
                    </span>
                    <div className="flex-1 h-2 bg-gray-700 rounded">
                      <div
                        className="h-full bg-cyan-400 rounded transition-all duration-[33ms]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs w-10 text-right text-gray-400">
                      {val.toFixed(0)}
                    </span>
                  </div>
                );
              }
            )}
          </div>

          <div className="mt-2 text-xs text-gray-500 text-center">
            lerobot/svla_so101_pickplace · 50 eps · 30fps
          </div>
        </>
      )}
    </div>
  );
}
